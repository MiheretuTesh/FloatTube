/**
 * Content script entry point.
 *
 * Runs in every frame of every page (manifest `all_frames: true`). It wires
 * together video detection, the overlay button, the PiP controller and the
 * auto-PiP behaviour, and exposes a small message API to the background
 * service worker.
 *
 * Each frame reports its own videos to the background, which aggregates them
 * across all frames of a tab for the popup — this is how cross-origin iframe
 * videos (YouTube/Vimeo/Twitch embeds, course players, etc.) are supported.
 */
import { browser } from '@/utils/browser';
import { loadSettings, watchSettings } from '@/utils/storage';
import { throttle } from '@/utils/dom';
import { log } from '@/utils/logger';
import { VideoDetector, describeVideo } from './video-detector';
import { OverlayManager } from './overlay';
import { PipController, PipError } from './pip-controller';
import type {
  BackgroundToContent,
  ContentToBackground,
  DetectedVideo,
  Settings,
} from '@/types';

class FloatTubeContent {
  private settings!: Settings;
  private readonly pip = new PipController();
  private detector!: VideoDetector;
  private overlay!: OverlayManager;
  /** Index used by the "next video" command to cycle deterministically. */
  private cycleIndex = 0;
  private readonly boundVideos = new WeakSet<HTMLVideoElement>();

  async init(): Promise<void> {
    this.settings = await loadSettings();

    this.detector = new VideoDetector(this.settings);
    this.overlay = new OverlayManager((video) => void this.activate(video));
    this.overlay.setEnabled(this.settings.showOverlayButton);
    this.overlay.setPosition(this.settings.overlayPosition);

    this.detector.start((videos) => {
      const elements = videos.map((v) => v.el);
      this.overlay.syncVideos(elements);
      elements.forEach((el) => this.bindPlaybackEvents(el));
      this.reportState();
    });

    this.pip.onChange(() => this.reportState());
    watchSettings((next) => this.applySettings(next));
    browser.runtime.onMessage.addListener((msg: unknown) =>
      this.handleMessage(msg as BackgroundToContent),
    );
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    log.info(`content script ready on ${location.host} (PiP API: ${this.pip.supported})`);
    this.reportState();
  }

  /* ----------------------------- settings ----------------------------- */

  private applySettings(next: Settings): void {
    this.settings = next;
    this.detector.updateSettings(next);
    this.overlay.setEnabled(next.showOverlayButton);
    this.overlay.setPosition(next.overlayPosition);
  }

  /* --------------------------- video state ---------------------------- */

  /** Attach lightweight playback listeners so the popup stays in sync. */
  private bindPlaybackEvents(el: HTMLVideoElement): void {
    if (this.boundVideos.has(el)) return;
    this.boundVideos.add(el);
    const push = (): void => this.reportState();
    ['play', 'pause', 'ended', 'seeked', 'loadedmetadata', 'volumechange'].forEach((evt) =>
      el.addEventListener(evt, push),
    );
    // `timeupdate` fires ~4x/s; throttled to ~1/s it keeps the popup fresh
    // without flooding the message channel.
    el.addEventListener('timeupdate', throttle(push, 1000));
  }

  /** Choose the "primary" video: a playing one if possible, else the largest. */
  private pickActive(elements: HTMLVideoElement[]): HTMLVideoElement | null {
    if (elements.length === 0) return null;
    const area = (el: HTMLVideoElement): number =>
      (el.videoWidth || el.clientWidth) * (el.videoHeight || el.clientHeight);
    const playing = elements.filter((el) => !el.paused && !el.ended);
    const pool = playing.length > 0 ? playing : elements;
    return pool.reduce((best, el) => (area(el) > area(best) ? el : best));
  }

  /** Build and send this frame's snapshot to the background. */
  private reportState = throttle((): void => {
    const tracked = this.detector.list();
    const elements = tracked.map((t) => t.el);
    const active = this.pip.activeElement ?? this.pickActive(elements);

    const videos: DetectedVideo[] = tracked.map(({ id, el }) => {
      const snapshot = describeVideo(id, el);
      snapshot.isActive = el === active;
      return snapshot;
    });

    const message: ContentToBackground = {
      kind: 'FRAME_VIDEOS',
      videos,
      pipActive: this.pip.isActive,
    };
    browser.runtime.sendMessage(message).catch(() => {
      /* background may be asleep between events — harmless */
    });
  }, 250);

  /* ----------------------------- actions ------------------------------ */

  /** Toggle PiP for a specific element, surfacing failures to the console. */
  private async activate(video: HTMLVideoElement): Promise<void> {
    try {
      await this.pip.toggle(video);
    } catch (err) {
      if (err instanceof PipError) {
        log.warn(err.message);
        this.flashMessage(err.message);
      } else {
        log.error('PiP toggle failed', err);
      }
    }
    this.reportState();
  }

  private currentActive(): HTMLVideoElement | null {
    return this.pip.activeElement ?? this.pickActive(this.detector.list().map((t) => t.el));
  }

  private async handleMessage(msg: BackgroundToContent): Promise<void> {
    switch (msg?.kind) {
      case 'TOGGLE_PIP': {
        const target = msg.videoId
          ? this.detector.getById(msg.videoId)
          : this.currentActive();
        if (target) await this.activate(target);
        break;
      }
      case 'EXIT_PIP':
        await this.pip.exit();
        this.reportState();
        break;
      case 'FOCUS_NEXT': {
        const elements = this.detector.list().map((t) => t.el);
        if (elements.length === 0) break;
        this.cycleIndex = (this.cycleIndex + 1) % elements.length;
        await this.activate(elements[this.cycleIndex]);
        break;
      }
      case 'REFRESH':
        this.reportState();
        break;
    }
  }

  /* --------------------------- auto-PiP ------------------------------- */

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      if (!this.settings.autoPip || this.pip.isActive || !this.pip.supported) return;
      const elements = this.detector.list().map((t) => t.el);
      const playing = elements.find((el) => !el.paused && !el.ended && el.readyState >= 2);
      if (!playing) return;
      // Best-effort: browsers may reject this without a recent user gesture.
      // When that happens the user can still pop out manually; see README.
      this.pip.enter(playing).catch((err) => log.debug('auto-PiP skipped', err));
    } else if (this.settings.exitPipOnReturn && this.pip.isActive) {
      void this.pip.exit();
    }
  };

  /* --------------------------- feedback ------------------------------- */

  /** Briefly show a transient message (used for PiP errors). */
  private flashMessage(text: string): void {
    const toast = document.createElement('div');
    toast.className = 'floattube-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = text;
    (document.documentElement || document.body).appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('floattube-visible'));
    setTimeout(() => {
      toast.classList.remove('floattube-visible');
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
}

// Guard against double injection (e.g. SPA soft-navigations re-running scripts).
if (!(window as { __floatTubeLoaded?: boolean }).__floatTubeLoaded) {
  (window as { __floatTubeLoaded?: boolean }).__floatTubeLoaded = true;
  void new FloatTubeContent().init();
}
