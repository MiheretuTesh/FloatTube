/**
 * Background service worker (MV3) / background module (Firefox).
 *
 * Acts as the message bus and per-tab aggregator:
 *  - each frame's content script reports its videos here;
 *  - the popup asks here for a tab-wide, deduplicated video list;
 *  - keyboard commands are received here and routed to the right frame.
 *
 * Aggregating in the background is what makes cross-origin iframe videos work:
 * a frame cannot message a sibling frame directly, but every frame can talk to
 * the background.
 *
 * The worker is stateless across restarts by design — MV3 may suspend it at
 * any time. The registry is treated as a soft cache; content scripts re-report
 * on every relevant event, so a cold registry self-heals within ~1s.
 */
import { browser } from '@/utils/browser';
import { log } from '@/utils/logger';
import type {
  BackgroundToContent,
  CommandId,
  DetectedVideo,
  IncomingMessage,
  TabState,
} from '@/types';

/** id separator between a frame id and the frame-local video id. */
const ID_SEP = '::';

/** Per-frame snapshot stored in the registry. */
interface FrameEntry {
  videos: DetectedVideo[];
  pipActive: boolean;
  updatedAt: number;
}

/** registry: tabId -> frameId -> FrameEntry */
const registry = new Map<number, Map<number, FrameEntry>>();

/* ------------------------------------------------------------------ */
/* Registry maintenance                                                */
/* ------------------------------------------------------------------ */

function frameMap(tabId: number): Map<number, FrameEntry> {
  let map = registry.get(tabId);
  if (!map) {
    map = new Map();
    registry.set(tabId, map);
  }
  return map;
}

/** Merge all frames of a tab into a single aggregated, namespaced snapshot. */
function aggregate(tabId: number): TabState {
  const frames = registry.get(tabId);
  if (!frames) return { videos: [], pipActive: false };

  const videos: DetectedVideo[] = [];
  let pipActive = false;
  for (const [frameId, entry] of frames) {
    pipActive = pipActive || entry.pipActive;
    for (const v of entry.videos) {
      // Namespace the id so the popup can address any frame's video uniquely.
      videos.push({ ...v, id: `${frameId}${ID_SEP}${v.id}` });
    }
  }
  // Active video(s) first, then larger videos.
  videos.sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.width - a.width);
  return { videos, pipActive };
}

/** Reflect the tab's video count on the toolbar icon badge. */
async function updateBadge(tabId: number): Promise<void> {
  const { videos, pipActive } = aggregate(tabId);
  const text = pipActive ? '▢' : videos.length ? String(videos.length) : '';
  try {
    await browser.action.setBadgeText({ tabId, text });
    await browser.action.setBadgeBackgroundColor({ tabId, color: pipActive ? '#16a34a' : '#4f46e5' });
  } catch {
    /* tab may have closed */
  }
}

/* ------------------------------------------------------------------ */
/* Messaging                                                           */
/* ------------------------------------------------------------------ */

interface MinimalSender {
  tab?: { id?: number };
  frameId?: number;
}

browser.runtime.onMessage.addListener(
  (raw: unknown, sender: MinimalSender): Promise<unknown> | undefined => {
    const msg = raw as IncomingMessage;

  // --- from a content-script frame -------------------------------------
  if (msg.kind === 'FRAME_VIDEOS') {
    const tabId = sender.tab?.id;
    if (tabId == null) return undefined;
    const frameId = sender.frameId ?? 0;
    if (msg.videos.length === 0 && !msg.pipActive) {
      registry.get(tabId)?.delete(frameId);
    } else {
      frameMap(tabId).set(frameId, {
        videos: msg.videos,
        pipActive: msg.pipActive,
        updatedAt: Date.now(),
      });
    }
    void updateBadge(tabId);
    return undefined;
  }

  // --- from the popup --------------------------------------------------
  if (msg.kind === 'GET_STATE') {
    return Promise.resolve(aggregate(msg.tabId));
  }

  if (msg.kind === 'TOGGLE_PIP') {
    const [frameId, localId] = splitId(msg.videoId);
    return sendToFrame(msg.tabId, frameId, { kind: 'TOGGLE_PIP', videoId: localId })
      .then(() => ({ ok: true }))
      .catch((err) => ({ ok: false, error: String(err) }));
  }

  if (msg.kind === 'EXIT_PIP') {
    return broadcast(msg.tabId, { kind: 'EXIT_PIP' }).then(() => ({ ok: true }));
  }

  if (msg.kind === 'FOCUS_NEXT') {
    return routeCommand(msg.tabId, 'focus-next-video').then(() => ({ ok: true }));
  }

  return undefined;
});

/** Split a namespaced popup id back into `[frameId, localId]`. */
function splitId(namespaced: string): [number, string] {
  const idx = namespaced.indexOf(ID_SEP);
  if (idx === -1) return [0, namespaced];
  return [Number(namespaced.slice(0, idx)) || 0, namespaced.slice(idx + ID_SEP.length)];
}

/** Send a message to one specific frame of a tab. */
async function sendToFrame(
  tabId: number,
  frameId: number,
  message: BackgroundToContent,
): Promise<void> {
  await browser.tabs.sendMessage(tabId, message, { frameId });
}

/** Send a message to every frame of a tab. */
async function broadcast(tabId: number, message: BackgroundToContent): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (err) {
    log.debug('broadcast failed', err);
  }
}

/* ------------------------------------------------------------------ */
/* Keyboard commands                                                   */
/* ------------------------------------------------------------------ */

browser.commands.onCommand.addListener((command) => {
  void (async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) await routeCommand(tab.id, command as CommandId);
  })();
});

/**
 * Route a command to the most relevant frame: prefer a frame that currently
 * has a video in PiP or a playing video, otherwise fall back to the top frame.
 */
async function routeCommand(tabId: number, command: CommandId): Promise<void> {
  const frames = registry.get(tabId);
  let targetFrame = 0;
  if (frames) {
    let best = -1;
    for (const [frameId, entry] of frames) {
      const score =
        (entry.pipActive ? 100 : 0) +
        (entry.videos.some((v) => !v.paused && !v.ended) ? 10 : 0) +
        entry.videos.length;
      if (score > best) {
        best = score;
        targetFrame = frameId;
      }
    }
  }

  const message: BackgroundToContent =
    command === 'toggle-pip'
      ? { kind: 'TOGGLE_PIP' }
      : command === 'exit-pip'
        ? { kind: 'EXIT_PIP' }
        : { kind: 'FOCUS_NEXT' };

  try {
    await sendToFrame(tabId, targetFrame, message);
  } catch {
    // Frame registry was stale (worker restarted) — fall back to broadcast.
    await broadcast(tabId, message);
  }
}

/* ------------------------------------------------------------------ */
/* Lifecycle cleanup                                                   */
/* ------------------------------------------------------------------ */

browser.tabs.onRemoved.addListener((tabId) => registry.delete(tabId));

// A top-level navigation invalidates that tab's frames; clear the cache so the
// popup never shows videos from the previous page.
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    registry.delete(tabId);
    void browser.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
  }
});

browser.runtime.onInstalled.addListener(() => log.info('Universal Floating Video installed'));
