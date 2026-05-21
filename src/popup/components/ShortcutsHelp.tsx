import { browser, detectEngine } from '@/utils/browser';

const SHORTCUTS: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: 'Alt + Shift + P', action: 'Toggle floating player' },
  { keys: 'Alt + Shift + O', action: 'Exit floating player' },
  { keys: 'Alt + Shift + N', action: 'Next detected video' },
];

/** Reference list of keyboard shortcuts plus a link to customise them. */
export function ShortcutsHelp(): JSX.Element {
  const openShortcutsPage = (): void => {
    // Each engine exposes its own (non-navigable-by-link) shortcuts page.
    const url =
      detectEngine() === 'firefox'
        ? 'about:addons'
        : 'chrome://extensions/shortcuts';
    void browser.tabs.create({ url });
  };

  return (
    <section className="px-4 py-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Keyboard shortcuts
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {SHORTCUTS.map((s) => (
          <li key={s.action} className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">{s.action}</span>
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {s.keys}
            </kbd>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={openShortcutsPage}
        className="mt-2 text-xs font-semibold text-brand-600 hover:underline focus-visible:ft-focus dark:text-brand-400"
      >
        Customise shortcuts →
      </button>
    </section>
  );
}
