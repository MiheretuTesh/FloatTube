import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { VideoList } from './components/VideoList';
import { SettingsPanel } from './components/SettingsPanel';
import { useTabVideos } from './hooks/useTabVideos';
import { useTheme } from './hooks/useTheme';
import { useSettingsStore } from './store/settings';

type Tab = 'videos' | 'settings';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'videos', label: 'Videos' },
  { id: 'settings', label: 'Settings' },
];

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('videos');
  const { state, loading, togglePip, exitPip, focusNext } = useTabVideos();
  const { settings, loaded, hydrate } = useSettingsStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useTheme(settings.theme);

  // Open straight to Settings if there is nothing to act on.
  useEffect(() => {
    if (!loading && state.videos.length === 0) setTab('settings');
  }, [loading, state.videos.length]);

  return (
    <div className="flex flex-col">
      <Header pipActive={state.pipActive} videoCount={state.videos.length} />

      <nav
        className="flex border-b border-slate-200 dark:border-slate-800"
        role="tablist"
        aria-label="Popup sections"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-semibold transition-colors focus-visible:ft-focus ${
              tab === t.id
                ? 'border-b-2 border-brand-600 text-brand-600 dark:text-brand-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'videos' ? (
          <div role="tabpanel" id="panel-videos" aria-labelledby="tab-videos">
            <VideoList
              state={state}
              loading={loading}
              onToggle={togglePip}
              onFocusNext={focusNext}
            />
            {state.pipActive && (
              <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-800">
                <button
                  type="button"
                  onClick={exitPip}
                  className="w-full rounded-lg bg-red-50 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 focus-visible:ft-focus dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Close floating player
                </button>
              </div>
            )}
          </div>
        ) : (
          <div role="tabpanel" id="panel-settings" aria-labelledby="tab-settings">
            {loaded ? (
              <SettingsPanel />
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 px-4 py-2 text-center text-[11px] text-slate-400 dark:border-slate-800">
        Universal Floating Video · works across tabs, windows &amp; apps
      </footer>
    </div>
  );
}
