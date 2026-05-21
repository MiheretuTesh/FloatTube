import { VideoCard } from './VideoCard';
import type { TabState } from '@/types';

interface VideoListProps {
  state: TabState;
  loading: boolean;
  onToggle: (videoId: string) => void;
  onFocusNext: () => void;
}

/** The "Videos" tab: detected videos, an empty state, and quick actions. */
export function VideoList({
  state,
  loading,
  onToggle,
  onFocusNext,
}: VideoListProps): JSX.Element {
  if (loading) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-400">Scanning page…</div>
    );
  }

  if (state.videos.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-3xl" aria-hidden="true">
          🎬
        </p>
        <p className="mt-2 text-sm font-medium">No videos detected here</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Open a page with a video — YouTube, Vimeo, Twitch, a course player or any
          site — then reopen this popup.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="ft-scroll flex max-h-[340px] flex-col gap-2 overflow-y-auto px-4 py-3">
        {state.videos.map((video) => (
          <VideoCard key={video.id} video={video} onToggle={() => onToggle(video.id)} />
        ))}
      </ul>
      {state.videos.length > 1 && (
        <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-800">
          <button
            type="button"
            onClick={onFocusNext}
            className="w-full rounded-lg bg-slate-100 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 focus-visible:ft-focus dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cycle to next video ↻
          </button>
        </div>
      )}
    </div>
  );
}
