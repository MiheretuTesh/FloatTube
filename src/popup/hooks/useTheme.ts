/**
 * Applies the user's theme preference to the popup document, honouring the OS
 * setting when the preference is `system`.
 */
import { useEffect } from 'react';
import type { ThemePreference } from '@/types';

export function useTheme(preference: ThemePreference): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (): void => {
      const dark = preference === 'dark' || (preference === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };

    apply();
    if (preference === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    return undefined;
  }, [preference]);
}
