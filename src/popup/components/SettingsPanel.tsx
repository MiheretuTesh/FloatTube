import { Toggle } from './Toggle';
import { ShortcutsHelp } from './ShortcutsHelp';
import { useSettingsStore } from '../store/settings';
import type { OverlayPosition, ThemePreference } from '@/types';

const POSITIONS: ReadonlyArray<{ value: OverlayPosition; label: string }> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
];

const THEMES: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const selectClass =
  'rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm focus-visible:ft-focus dark:border-slate-700 dark:bg-slate-800';

/** The "Settings" tab. */
export function SettingsPanel(): JSX.Element {
  const { settings, update } = useSettingsStore();

  return (
    <div className="ft-scroll max-h-[400px] overflow-y-auto">
      <section className="divide-y divide-slate-100 px-4 py-2 dark:divide-slate-800">
        <Toggle
          id="setting-auto-pip"
          label="Auto pop-out on tab switch"
          description="Float the playing video automatically when you leave the tab."
          checked={settings.autoPip}
          onChange={(v) => void update({ autoPip: v })}
        />
        <Toggle
          id="setting-exit-return"
          label="Close float on return"
          description="Exit the floating player when you come back to the tab."
          checked={settings.exitPipOnReturn}
          onChange={(v) => void update({ exitPipOnReturn: v })}
        />
        <Toggle
          id="setting-overlay"
          label="Show hover button on videos"
          description="Display a 'Pop out' button when hovering a video."
          checked={settings.showOverlayButton}
          onChange={(v) => void update({ showOverlayButton: v })}
        />
      </section>

      <section className="space-y-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <label htmlFor="setting-position" className="text-sm font-medium">
            Hover button corner
          </label>
          <select
            id="setting-position"
            className={selectClass}
            value={settings.overlayPosition}
            onChange={(e) =>
              void update({ overlayPosition: e.target.value as OverlayPosition })
            }
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="setting-minsize" className="text-sm font-medium">
            Ignore videos under
          </label>
          <select
            id="setting-minsize"
            className={selectClass}
            value={settings.minVideoSize}
            onChange={(e) => void update({ minVideoSize: Number(e.target.value) })}
          >
            {[80, 120, 160, 240, 320].map((px) => (
              <option key={px} value={px}>
                {px}px
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="setting-theme" className="text-sm font-medium">
            Theme
          </label>
          <select
            id="setting-theme"
            className={selectClass}
            value={settings.theme}
            onChange={(e) => void update({ theme: e.target.value as ThemePreference })}
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="border-t border-slate-200 dark:border-slate-800">
        <ShortcutsHelp />
      </div>
    </div>
  );
}
