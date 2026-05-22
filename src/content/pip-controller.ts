/**
 * Picture-in-Picture controller.
 *
 * Wraps the standard `requestPictureInPicture()` API with:
 *  - capability checks (Firefox does not expose a scriptable PiP API);
 *  - single-window semantics (entering PiP for video B exits video A first);
 *  - change notifications so the rest of the extension can stay in sync.
 *
 * The actual floating window is the browser's native PiP window — it is
 * already always-on-top and survives tab/window/application switches, which
 * satisfies the core product requirement without a custom OS-level window.
 */
import { isPipApiAvailable } from '@/utils/browser';
import { log } from '@/utils/logger';

export class PipController {
  private changeListeners = new Set<() => void>();

  constructor() {
    // These bubble from any video element in the document.
    document.addEventListener('enterpictureinpicture', this.handleChange, true);
    document.addEventListener('leavepictureinpicture', this.handleChange, true);
  }

  /** Is the scriptable PiP API usable here at all? */
  get supported(): boolean {
    return isPipApiAvailable();
  }

  /** The video currently in PiP within this document, if any. */
  get activeElement(): HTMLVideoElement | null {
    return (document.pictureInPictureElement as HTMLVideoElement | null) ?? null;
  }

  get isActive(): boolean {
    return this.activeElement !== null;
  }

  /** Toggle PiP for a specific element. Returns the resulting active state. */
  async toggle(el: HTMLVideoElement): Promise<boolean> {
    if (this.activeElement === el) {
      await this.exit();
      return false;
    }
    return this.enter(el);
  }

  /** Request PiP for `el`, exiting any other PiP window first. */
  async enter(el: HTMLVideoElement): Promise<boolean> {
    if (!this.supported) {
      throw new PipError('Picture-in-Picture is not available in this browser.');
    }
    if (el.disablePictureInPicture) {
      throw new PipError('This site disabled Picture-in-Picture for the video.');
    }
    // requestPictureInPicture() throws unless the element has loaded metadata.
    // Lazy / feed videos commonly sit at readyState 0 until played, so prime
    // them here — we are still inside the originating click, which permits
    // play()/load().
    if (el.readyState < HTMLMediaElement.HAVE_METADATA) {
      await primeMetadata(el);
    }
    if (el.readyState < HTMLMediaElement.HAVE_METADATA) {
      throw new PipError('This video hasn’t loaded yet — press play on it, then pop out.');
    }
    if (this.isActive) {
      await document.exitPictureInPicture().catch(() => undefined);
    }
    try {
      await el.requestPictureInPicture();
      log.debug('entered PiP');
      return true;
    } catch (err) {
      // Most commonly a missing user-gesture (NotAllowedError).
      throw new PipError(toReadableError(err));
    }
  }

  /** Exit PiP if active. */
  async exit(): Promise<void> {
    if (this.isActive) {
      await document.exitPictureInPicture().catch((err) => log.warn('exit failed', err));
    }
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  dispose(): void {
    document.removeEventListener('enterpictureinpicture', this.handleChange, true);
    document.removeEventListener('leavepictureinpicture', this.handleChange, true);
    this.changeListeners.clear();
  }

  private handleChange = (): void => {
    this.changeListeners.forEach((l) => l());
  };
}

/** Typed error so callers can surface a friendly message to the user. */
export class PipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipError';
  }
}

function toReadableError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return 'Picture-in-Picture needs a click — use the overlay button or popup.';
    }
    if (err.name === 'InvalidStateError') {
      return 'This video isn’t ready yet — press play on it, then pop out.';
    }
    return err.message || err.name;
  }
  return err instanceof Error ? err.message : 'Could not start Picture-in-Picture.';
}

/**
 * Coax a not-yet-loaded video into producing metadata, then resolve.
 *
 * Lazy / feed videos start at readyState 0. We kick off loading — preferring
 * play() (allowed because we are still inside the originating click) and
 * falling back to load(). Resolves as soon as metadata arrives, or after a
 * safety timeout that stays within the browser's transient-activation window
 * so the subsequent requestPictureInPicture() still counts as user-initiated.
 */
function primeMetadata(el: HTMLVideoElement): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      el.removeEventListener('loadedmetadata', finish);
      el.removeEventListener('loadeddata', finish);
      clearTimeout(timer);
      resolve();
    };

    el.addEventListener('loadedmetadata', finish, { once: true });
    el.addEventListener('loadeddata', finish, { once: true });

    try {
      // `preload="none"` would otherwise refuse to fetch anything.
      if (el.preload === 'none') el.preload = 'metadata';
      const played = el.play();
      if (played && typeof played.catch === 'function') {
        played.catch(() => {
          // Autoplay/site policy refused playback — at least force a load.
          try {
            el.load();
          } catch {
            /* nothing more we can do */
          }
        });
      }
    } catch {
      try {
        el.load();
      } catch {
        /* ignore */
      }
    }

    const timer = setTimeout(finish, 4000);
  });
}
