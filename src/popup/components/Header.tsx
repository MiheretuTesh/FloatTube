/** Popup header: brand identity plus a live Picture-in-Picture status pill. */
interface HeaderProps {
  pipActive: boolean;
  videoCount: number;
}

export function Header({ pipActive, videoCount }: HeaderProps): JSX.Element {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5V10h-2V6.5a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5v8c0 .28.22.5.5.5H11v2H6.5A2.5 2.5 0 0 1 4 14.5v-8Z"
            />
            <path
              fill="currentColor"
              d="M13 13.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5h-5a1.5 1.5 0 0 1-1.5-1.5v-5Z"
            />
          </svg>
        </span>
        <div className="leading-tight">
          <h1 className="text-sm font-bold">Floating Video</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {videoCount === 0
              ? 'No videos on this page'
              : `${videoCount} video${videoCount === 1 ? '' : 's'} detected`}
          </p>
        </div>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          pipActive
            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}
        role="status"
      >
        {pipActive ? '● Floating' : 'Idle'}
      </span>
    </header>
  );
}
