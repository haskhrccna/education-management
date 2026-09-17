import { Platform, useWindowDimensions } from 'react-native';

export interface Responsive {
  /** Desktop-web viewport (>=1024px). False on native and narrow web. */
  isDesktopWeb: boolean;
  /** Wide tablet / small desktop (>=768px). */
  isTabletUp: boolean;
  /** Number of columns for nav-card grids at this viewport. */
  gridColumns: 2 | 3 | 4;
  /** Web viewport wide enough that a full-bleed form would look broken (>=600px). */
  isWideWeb: boolean;
}

/**
 * Viewport-aware layout helper, used by the admin screens for desktop parity.
 * On native every flag is orientation-derived; on web it tracks the actual
 * window so a desktop browser gets a multi-column, side-nav-friendly shell.
 */
export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= 1024;
  const isTabletUp = width >= 768;
  const gridColumns = (isDesktopWeb ? 4 : isTabletUp ? 3 : 2) as 2 | 3 | 4;
  const isWideWeb = isWeb && width >= 600;
  return { isDesktopWeb, isTabletUp, gridColumns, isWideWeb };
}

/** Max content width for desktop-web screens — keep forms + lists readable. */
export const DESKTOP_CONTENT_MAX_WIDTH = 1120;

/**
 * Max content width for single-column auth screens. A sign-in form stretched
 * across a 1280px browser window reads as an unfinished port, not an app —
 * these screens are the first thing a new academy sees on the web.
 */
export const AUTH_CONTENT_MAX_WIDTH = 460;
