/**
 * Popup settings store (Zustand).
 *
 * Zustand is intentionally minimal — settings are a single flat object, so a
 * heavier solution would be over-engineering. The store is the popup's local
 * mirror; `storage.local` remains the source of truth and is what the content
 * script reads.
 */
import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Settings } from '@/types';
import { loadSettings, saveSettings, watchSettings } from '@/utils/storage';

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  /** Load persisted settings and start watching for external changes. */
  hydrate: () => Promise<void>;
  /** Apply a partial update optimistically, then persist it. */
  update: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  hydrate: async () => {
    const settings = await loadSettings();
    set({ settings, loaded: true });
    // Keep the popup in sync if settings change elsewhere.
    watchSettings((next) => set({ settings: next }));
  },

  update: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await saveSettings(settings);
  },
}));
