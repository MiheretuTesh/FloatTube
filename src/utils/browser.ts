/**
 * Cross-browser compatibility layer.
 *
 * `webextension-polyfill` exposes the promise-based `browser.*` namespace on
 * every engine (Chrome/Edge/Brave/Opera ship callback-based `chrome.*`;
 * Firefox ships `browser.*` natively). Importing this module — instead of
 * touching `chrome` or `browser` directly — keeps the rest of the codebase
 * engine-agnostic.
 */
import browserPolyfill from 'webextension-polyfill';

export const browser = browserPolyfill;

/** Best-effort detection of the host engine, for tiny behavioural tweaks. */
export function detectEngine(): 'firefox' | 'chromium' {
  // Firefox exposes a native `browser` global; Chromium engines do not.
  return typeof (globalThis as { browser?: unknown }).browser !== 'undefined' &&
    typeof (globalThis as { chrome?: unknown }).chrome === 'undefined'
    ? 'firefox'
    : 'chromium';
}

/**
 * Whether the *scriptable* Picture-in-Picture API is available in this
 * document. Firefox intentionally does not implement `requestPictureInPicture`
 * (it offers its own non-scriptable PiP toggle), so callers can degrade
 * gracefully instead of throwing.
 */
export function isPipApiAvailable(): boolean {
  return (
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    document.pictureInPictureEnabled === true &&
    typeof HTMLVideoElement !== 'undefined' &&
    'requestPictureInPicture' in HTMLVideoElement.prototype
  );
}
