import { useEffect, useState } from 'react';

import type { ThemePreference } from '@marketsim/ui';

type ResolvedTheme = Exclude<ThemePreference, 'system'>;

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolved = preference === 'system' ? readSystemTheme() : preference;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      document
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'dark' ? '#0c1412' : '#f2f4f0');
    };

    applyTheme();
    media?.addEventListener('change', applyTheme);

    return () => media?.removeEventListener('change', applyTheme);
  }, [preference]);

  return { preference, setPreference } as const;
}
