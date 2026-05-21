/**
 * Settings persistence. Uses `storage.local` (synced everywhere the extension
 * runs) and exposes a change subscription so the content script reacts to
 * settings edited in the popup without a reload.
 */
import { browser } from './browser';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from '@/types';
import { log } from './logger';

/** Load settings, merged over defaults so new keys always have a value. */
export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await browser.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] as Partial<Settings> | undefined) };
  } catch (err) {
    log.warn('Failed to load settings, using defaults', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist settings (whole object — settings are small). */
export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}

/**
 * Subscribe to settings changes. Returns an unsubscribe function.
 */
export function watchSettings(callback: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
    callback({
      ...DEFAULT_SETTINGS,
      ...(changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined),
    });
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
