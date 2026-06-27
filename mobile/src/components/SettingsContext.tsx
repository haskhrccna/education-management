import React, { createContext, useContext, useMemo } from 'react';
import { useSettingsStore, FONT_SCALE, SPACING_SCALE } from '@/src/settings/store';

interface Scales {
  fontScale: number;
  spacingScale: number;
}

const SettingsContext = createContext<Scales>({ fontScale: 1, spacingScale: 1 });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { fontSize, compactView } = useSettingsStore();
  const scales = useMemo(
    () => ({
      fontScale: FONT_SCALE[fontSize ?? 'medium'] ?? 1,
      spacingScale: compactView ? SPACING_SCALE.compact : SPACING_SCALE.normal,
    }),
    [fontSize, compactView]
  );
  return <SettingsContext.Provider value={scales}>{children}</SettingsContext.Provider>;
}

export function useSettingsScales(): Scales {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return { fontScale: 1, spacingScale: 1 };
  }
  return ctx;
}
