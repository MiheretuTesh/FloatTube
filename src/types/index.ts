/**
 * Shared type contracts for Universal Floating Video.
 *
 * Everything that crosses a process boundary (content script <-> background
 * <-> popup) is declared here so the three runtimes stay in sync.
 */

/** A single HTML5 video discovered on a page (or inside one of its frames). */
export interface DetectedVideo {
  /** Stable id. Inside a frame it is a local id; once aggregated by the
   *  background it is namespaced as `${frameId}::${localId}`. */
  id: string;
  /** Best-effort human readable title. */
  title: string;
  /** Duration in seconds, or null when unknown / live stream. */
  durationSeconds: number | null;
  /** Current playback position in seconds. */
  currentTime: number;
  paused: boolean;
  ended: boolean;
  muted: boolean;
  /** True for the video the content script considers "primary" on its page. */
  isActive: boolean;
  /** True when this video currently occupies a Picture-in-Picture window. */
  inPip: boolean;
  /** Rendered pixel dimensions. */
  width: number;
  height: number;
  /** Whether Picture-in-Picture can be requested for this element. */
  pipSupported: boolean;
  /** Origin/hostname the video lives on (useful when it is inside an iframe). */
  origin: string;
}

/** Aggregated per-tab snapshot, as served to the popup. */
export interface TabState {
  videos: DetectedVideo[];
  pipActive: boolean;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  /** Automatically pop the playing video out when the tab is hidden. */
  autoPip: boolean;
  /** Leave Picture-in-Picture automatically when returning to the tab. */
  exitPipOnReturn: boolean;
  /** Show the floating "pop out" button on hover over a video. */
  showOverlayButton: boolean;
  /** Corner the overlay button is anchored to. */
  overlayPosition: OverlayPosition;
  /** Ignore videos smaller than this (px, longest edge) — avoids ad pixels. */
  minVideoSize: number;
  /** Popup colour theme. */
  theme: ThemePreference;
}

export const DEFAULT_SETTINGS: Settings = {
  autoPip: false,
  exitPipOnReturn: true,
  showOverlayButton: true,
  overlayPosition: 'top-right',
  minVideoSize: 160,
  theme: 'system',
};

export const SETTINGS_KEY = 'floattube:settings';

/* ------------------------------------------------------------------ */
/* Messaging                                                           */
/* ------------------------------------------------------------------ */

/** content script -> background */
export type ContentToBackground = {
  kind: 'FRAME_VIDEOS';
  videos: DetectedVideo[];
  pipActive: boolean;
};

/** popup -> background */
export type PopupToBackground =
  | { kind: 'GET_STATE'; tabId: number }
  | { kind: 'TOGGLE_PIP'; tabId: number; videoId: string }
  | { kind: 'EXIT_PIP'; tabId: number }
  | { kind: 'FOCUS_NEXT'; tabId: number };

/** background -> content script */
export type BackgroundToContent =
  | { kind: 'TOGGLE_PIP'; videoId?: string }
  | { kind: 'EXIT_PIP' }
  | { kind: 'FOCUS_NEXT' }
  | { kind: 'REFRESH' };

/** Discriminated union of every message the background may receive. */
export type IncomingMessage = ContentToBackground | PopupToBackground;

/** Keyboard command identifiers — must match the manifest `commands` keys. */
export type CommandId = 'toggle-pip' | 'exit-pip' | 'focus-next-video';
