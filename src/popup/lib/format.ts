/** Formatting helpers for the popup UI. */

/** Format a duration in seconds as `m:ss` or `h:mm:ss`. */
export function formatTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** A `current / total` progress label, omitting the total when unknown. */
export function formatProgress(current: number, total: number | null): string {
  return total != null ? `${formatTime(current)} / ${formatTime(total)}` : formatTime(current);
}
