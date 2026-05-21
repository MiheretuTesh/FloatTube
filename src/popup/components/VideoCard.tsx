import { formatProgress } from '../lib/format';
import type { DetectedVideo } from '@/types';

interface VideoCardProps {
  video: DetectedVideo;
  onToggle: () => void;
}

/** A single detected video with its metadata and a pop-out action. */
export function VideoCard({ video, onToggle }: VideoCardProps): JSX.Element {
  const stateLabel = video.ended
    ? 'Ended'
    : video.paused
      ? 'Paused'
      : 'Playing';

  return (
    <li className="animate-fade-in rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" title={video.title}>
            {video.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {video.origin}
          </p>
        </div>
        {video.isActive && (
          <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-700/40 dark:text-brand-100">
            Active
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              !video.paused && !video.ended
                ? 'text-green-600 dark:text-green-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span aria-hidden="true">{video.paused || video.ended ? '❚❚' : '▶'}</span>
            {stateLabel}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {formatProgress(video.currentTime, video.durationSeconds)}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={!video.pipSupported}
          title={
            video.pipSupported
              ? 'Toggle floating mini-player'
              : 'Picture-in-Picture is unavailable for this video'
          }
          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ft-focus ${
            video.inPip
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700'
          }`}
        >
          {video.inPip ? 'Exit float' : 'Pop out'}
        </button>
      </div>
    </li>
  );
}
