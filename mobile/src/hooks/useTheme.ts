import { useMemo } from 'react';
import { getColors } from '@/constants/theme';
import { useIsRTL } from '../i18n/useIsRTL';
import { useThemeSettings } from '../settings/store';

/**
 * One-stop theme hook for screens. Subscribes only to `theme` + `darkMode`
 * (via {@link useThemeSettings}) and memoizes the derived color palette so it is
 * not rebuilt on every render. Also surfaces `isRTL` so screens need a single
 * import instead of separately wiring the settings store, `getColors`, and
 * `useIsRTL`.
 */
/** Palette type for style factories and component props. */
export type ThemeColors = ReturnType<typeof getColors>;

export function useTheme() {
  const { theme, darkMode } = useThemeSettings();
  const isRTL = useIsRTL();
  const colors = useMemo(() => getColors(theme, darkMode), [theme, darkMode]);
  return { colors, isRTL, theme, darkMode };
}
