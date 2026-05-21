/** Accessible on/off switch built on a native checkbox for screen readers. */
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id: string;
}

export function Toggle({ checked, onChange, label, description, id }: ToggleProps): JSX.Element {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            {description}
          </span>
        )}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ft-focus dark:bg-slate-600"
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4"
        />
      </span>
    </label>
  );
}
