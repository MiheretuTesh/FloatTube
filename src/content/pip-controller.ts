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
    // The video must have decoded at least one frame before PiP is allowed.
    if (el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForMetadata(el);
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
    return err.message || err.name;
  }
  return err instanceof Error ? err.message : 'Could not start Picture-in-Picture.';
}

/** Resolve once the element has enough data for PiP (or after a short wait). */
function waitForMetadata(el: HTMLVideoElement): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = (): void => {
      el.removeEventListener('loadeddata', done);
      resolve();
    };
    el.addEventListener('loadeddata', done, { once: true });
    setTimeout(done, 1500); // never block the user indefinitely
  });
}
