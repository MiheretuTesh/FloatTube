/**
 * Universal HTML5 video discovery.
 *
 * Responsibilities:
 *  - find every <video> on the page, including inside open shadow roots and
 *    same-origin iframes (cross-origin iframes run their own content-script
 *    instance, because the manifest declares `all_frames: true`);
 *  - keep tracking videos that are inserted later by SPAs / lazy loaders via a
 *    debounced MutationObserver;
 *  - assign each video a stable id and expose a clean snapshot to the rest of
 *    the content script.
 *
 * Performance: there is no polling. A full re-scan only runs on a debounced
 * mutation burst, and `querySelectorAll('*')` (needed for shadow-root hosts)
 * is the heaviest call — acceptable at ~2-3 fps worst case under heavy DOM
 * churn, and idle otherwise.
 */
import { debounce } from '@/utils/dom';
import { log } from '@/utils/logger';
import { isPipApiAvailable } from '@/utils/browser';
import type { DetectedVideo, Settings } from '@/types';

let idCounter = 0;

/** Internal bookkeeping for one tracked video element. */
interface TrackedVideo {
  id: string;
  el: HTMLVideoElement;
}

export type DetectorListener = (videos: TrackedVideo[]) => void;

export class VideoDetector {
  private readonly tracked = new Map<string, TrackedVideo>();
  private readonly idByEl = new WeakMap<HTMLVideoElement, string>();
  private readonly observers = new Set<MutationObserver>();
  private listener: DetectorListener | null = null;
  private settings: Settings;
  private started = false;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /** Begin observing the document. Safe to call once. */
  start(onChange: DetectorListener): void {
    if (this.started) return;
    this.started = true;
    this.listener = onChange;

    const rescan = debounce(() => this.scan(), 350);
    const rootObserver = new MutationObserver((records) => {
      // Only bother re-scanning when nodes were actually added/removed.
      if (records.some((r) => r.addedNodes.length || r.removedNodes.length)) {
        rescan();
      }
    });
    rootObserver.observe(document.documentElement, { childList: true, subtree: true });
    this.observers.add(rootObserver);

    // Initial scan, plus one more once the page settles (covers late hydration).
    this.scan();
    window.addEventListener('load', () => this.scan(), { once: true });
  }

  /** Update the size filter when the user edits settings. */
  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.scan();
  }

  /** Tear everything down. */
  stop(): void {
    this.observers.forEach((o) => o.disconnect());
    this.observers.clear();
    this.tracked.clear();
    this.listener = null;
    this.started = false;
  }

  /** Current tracked videos as an array (insertion order). */
  list(): TrackedVideo[] {
    return [...this.tracked.values()].filter((t) => t.el.isConnected);
  }

  /** Resolve a tracked element by id. */
  getById(id: string): HTMLVideoElement | undefined {
    return this.tracked.get(id)?.el;
  }

  /* -------------------------------------------------------------- */

  /** Recursively collect <video> elements through shadow roots & iframes. */
  private collect(root: Document | ShadowRoot, sink: Set<HTMLVideoElement>): void {
    root.querySelectorAll('video').forEach((v) => sink.add(v as HTMLVideoElement));

    // Descend into open shadow roots.
    root.querySelectorAll('*').forEach((el) => {
      const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (sr) this.collect(sr, sink);
    });

    // Descend into same-origin iframes. Cross-origin frames throw on access
    // and are handled by their own injected content-script instance instead.
    if (root instanceof Document) {
      root.querySelectorAll('iframe').forEach((frame) => {
        try {
          const doc = (frame as HTMLIFrameElement).contentDocument;
          if (doc) this.collect(doc, sink);
        } catch {
          /* cross-origin — ignore */
        }
      });
    }
  }

  /** Full re-scan: reconcile the tracked map against what is on the page. */
  private scan(): void {
    const found = new Set<HTMLVideoElement>();
    try {
      this.collect(document, found);
    } catch (err) {
      log.warn('scan failed', err);
    }

    let changed = false;

    // Add newly discovered, sufficiently large videos.
    for (const el of found) {
      if (!this.qualifies(el)) continue;
      if (this.idByEl.has(el)) continue;
      const id = `v${++idCounter}`;
      this.idByEl.set(el, id);
      this.tracked.set(id, { id, el });
      changed = true;
    }

    // Drop videos that left the DOM.
    for (const [id, t] of this.tracked) {
      if (!t.el.isConnected || !found.has(t.el)) {
        this.tracked.delete(id);
        changed = true;
      }
    }

    if (changed) {
      log.debug(`tracking ${this.tracked.size} video(s)`);
      this.listener?.(this.list());
    }
  }

  /**
   * Filter out tiny/decorative videos (tracking pixels, sticker autoplay loops)
   * while still keeping audio-only or not-yet-laid-out media elements that the
   * user may genuinely want to pop out.
   */
  private qualifies(el: HTMLVideoElement): boolean {
    if (el.tagName !== 'VIDEO') return false;
    const min = this.settings.minVideoSize;
    const w = el.videoWidth || el.clientWidth;
    const h = el.videoHeight || el.clientHeight;
    // A video with no dimensions yet but a source is still a candidate.
    const hasSource = !!(el.currentSrc || el.src || el.querySelector('source'));
    if (!hasSource && el.readyState === 0) return false;
    if (w === 0 && h === 0) return true; // not laid out yet — keep it
    return Math.max(w, h) >= min;
  }
}

/* ------------------------------------------------------------------ */
/* Snapshot helpers                                                    */
/* ------------------------------------------------------------------ */

/** Best-effort human readable title for a video element. */
function deriveTitle(el: HTMLVideoElement): string {
  const candidates = [
    el.getAttribute('title'),
    el.getAttribute('aria-label'),
    el.closest('[aria-label]')?.getAttribute('aria-label'),
    el.closest('[title]')?.getAttribute('title'),
    // Common site-specific containers.
    document.querySelector<HTMLElement>('h1.ytd-watch-metadata, h1.title')?.textContent,
    document.title,
  ];
  for (const c of candidates) {
    const text = c?.trim();
    if (text) return text.length > 90 ? `${text.slice(0, 89)}…` : text;
  }
  return 'Untitled video';
}

/** Build the cross-process snapshot for a single tracked video. */
export function describeVideo(id: string, el: HTMLVideoElement): DetectedVideo {
  const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null;
  return {
    id,
    title: deriveTitle(el),
    durationSeconds: duration,
    currentTime: Number.isFinite(el.currentTime) ? el.currentTime : 0,
    paused: el.paused,
    ended: el.ended,
    muted: el.muted,
    isActive: false,
    inPip: document.pictureInPictureElement === el,
    width: el.videoWidth || el.clientWidth,
    height: el.videoHeight || el.clientHeight,
    pipSupported: isPipApiAvailable() && !el.disablePictureInPicture,
    origin: location.hostname,
  };
}
