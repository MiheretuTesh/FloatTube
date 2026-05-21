/**
 * Floating "pop out" overlay button.
 *
 * Design decisions:
 *  - A *single* shared button element is reused for whichever video is hovered,
 *    rather than one node per video. This keeps the page DOM footprint at one
 *    extra element no matter how many videos a page has.
 *  - The button is `position: fixed` and re-anchored to the hovered video via
 *    a requestAnimationFrame loop that only runs while the button is visible —
 *    no idle polling.
 *  - Styling lives in `content.css`, injected by the browser via the manifest
 *    `content_scripts.css` entry, so it is not subject to the page's
 *    `style-src` CSP (an injected inline <style> would be).
 *  - The button uses ARIA attributes and is keyboard reachable.
 */
import { throttle } from '@/utils/dom';
import { log } from '@/utils/logger';
import type { OverlayPosition } from '@/types';

const BTN_ID = 'floattube-overlay-button';
const MARGIN = 12;

/** Inline SVG icon (our own element, so innerHTML is safe and CSP-clean). */
const ICON = `
<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5V11h-2V5.5a.5.5 0 0 0-.5-.5h-13a.5.5 0 0 0-.5.5v9c0 .28.22.5.5.5H11v2H5.5A2.5 2.5 0 0 1 3 16.5v-11Z"/>
  <path fill="currentColor" d="M13 13.5c0-.83.67-1.5 1.5-1.5h6c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-6Z"/>
</svg>`;

export class OverlayManager {
  private button: HTMLButtonElement | null = null;
  private hovered: HTMLVideoElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private rafId = 0;
  private enabled = true;
  private position: OverlayPosition = 'top-right';

  constructor(private readonly onActivate: (video: HTMLVideoElement) => void) {}

  /** Apply (or clear) hover handlers for the current set of videos. */
  syncVideos(videos: HTMLVideoElement[]): void {
    for (const v of videos) {
      if (v.dataset.floattubeBound === '1') continue;
      v.dataset.floattubeBound = '1';
      v.addEventListener('pointerenter', this.onVideoEnter);
      v.addEventListener('pointerleave', this.onVideoLeave);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.hideNow();
  }

  setPosition(position: OverlayPosition): void {
    this.position = position;
  }

  dispose(): void {
    this.hideNow();
    this.button?.remove();
    this.button = null;
  }

  /* -------------------------------------------------------------- */

  private ensureButton(): HTMLButtonElement {
    if (this.button) return this.button;
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.className = 'floattube-overlay-button';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Pop out video into a floating player');
    btn.title = 'Pop out (Picture-in-Picture)';
    btn.innerHTML = `${ICON}<span class="floattube-overlay-label">Pop out</span>`;
    btn.addEventListener('pointerenter', this.cancelHide);
    btn.addEventListener('pointerleave', this.scheduleHide);
    btn.addEventListener('click', this.onClick);
    // Appended to <html> so it is never clipped by an overflow:hidden parent.
    (document.documentElement || document.body).appendChild(btn);
    this.button = btn;
    return btn;
  }

  private onVideoEnter = (event: Event): void => {
    if (!this.enabled) return;
    const video = event.currentTarget as HTMLVideoElement;
    this.cancelHide();
    this.hovered = video;
    const btn = this.ensureButton();
    btn.classList.add('floattube-visible');
    this.startTracking();
  };

  private onVideoLeave = (): void => {
    this.scheduleHide();
  };

  private onClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (this.hovered) {
      log.debug('overlay button activated');
      this.onActivate(this.hovered);
    }
  };

  private scheduleHide = (): void => {
    this.cancelHide();
    // Grace period so the pointer can travel from the video onto the button.
    this.hideTimer = setTimeout(() => this.hideNow(), 180);
  };

  private cancelHide = (): void => {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  };

  private hideNow(): void {
    this.cancelHide();
    this.hovered = null;
    this.button?.classList.remove('floattube-visible');
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** rAF loop that keeps the button glued to the hovered video. */
  private startTracking(): void {
    if (this.rafId) return;
    const tick = (): void => {
      if (!this.hovered || !this.button) {
        this.rafId = 0;
        return;
      }
      this.reposition(this.hovered, this.button);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private reposition = throttle((video: HTMLVideoElement, btn: HTMLButtonElement): void => {
    const r = video.getBoundingClientRect();
    // Hide if the video scrolled out of view or collapsed.
    if (r.width < 40 || r.height < 40 || r.bottom < 0 || r.top > window.innerHeight) {
      btn.classList.remove('floattube-visible');
      return;
    }
    btn.classList.add('floattube-visible');
    const top = this.position.startsWith('top')
      ? r.top + MARGIN
      : r.bottom - btn.offsetHeight - MARGIN;
    const left = this.position.endsWith('left')
      ? r.left + MARGIN
      : r.right - btn.offsetWidth - MARGIN;
    btn.style.top = `${Math.round(top)}px`;
    btn.style.left = `${Math.round(left)}px`;
  }, 16);
}
