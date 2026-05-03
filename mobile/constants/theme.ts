// Quran Review — Dynamic Islamic Premium Design System

export type ThemeColor = 'green' | 'blue' | 'purple' | 'dark';

// Theme color palettes
const THEME_PALETTES: Record<ThemeColor, { primary: string; primaryLight: string; primaryDark: string; primaryMuted: string }> = {
  green: {
    primary: '#047857',
    primaryLight: '#10b981',
    primaryDark: '#064e3b',
    primaryMuted: '#d1fae5',
  },
  blue: {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1e40af',
    primaryMuted: '#dbeafe',
  },
  purple: {
    primary: '#7c3aed',
    primaryLight: '#a78bfa',
    primaryDark: '#5b21b6',
    primaryMuted: '#ede9fe',
  },
  dark: {
    primary: '#0f172a',
    primaryLight: '#334155',
    primaryDark: '#020617',
    primaryMuted: '#1e293b',
  },
};

// Get colors based on theme
export const getColors = (theme: ThemeColor = 'green', isDark: boolean = false) => {
  const palette = THEME_PALETTES[theme];

  if (isDark) {
    return {
      primary: palette.primaryLight,
      primaryLight: palette.primary,
      primaryDark: '#0f172a',
      primaryMuted: palette.primaryMuted,
      gold: '#fbbf24',
      goldLight: '#fde68a',
      goldMuted: '#451a03',
      background: '#0f172a',
      surface: '#1e293b',
      surfaceAlt: '#334155',
      surfaceGreen: '#064e3b',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      textOnPrimary: '#ffffff',
      textOnGold: '#451a03',
      success: '#10b981',
      successLight: '#064e3b',
      warning: '#f59e0b',
      warningLight: '#451a03',
      error: '#ef4444',
      errorLight: '#450a0a',
      info: '#3b82f6',
      infoLight: '#1e3a8a',
      deepGreen: '#065f46',
      cream: '#1e293b',
      parchment: '#334155',
      midnight: '#020617',
    };
  }

  return {
    primary: palette.primary,
    primaryLight: palette.primaryLight,
    primaryDark: palette.primaryDark,
    primaryMuted: palette.primaryMuted,
    gold: '#d97706',
    goldLight: '#fbbf24',
    goldMuted: '#fef3c7',
    background: '#fafaf9',
    surface: '#ffffff',
    surfaceAlt: '#fef3c7',
    surfaceGreen: '#ecfdf5',
    textPrimary: '#1c1917',
    textSecondary: '#78716c',
    textMuted: '#a8a29e',
    textOnPrimary: '#ffffff',
    textOnGold: '#78350f',
    success: '#059669',
    successLight: '#d1fae5',
    warning: '#d97706',
    warningLight: '#fef3c7',
    error: '#dc2626',
    errorLight: '#fee2e2',
    info: '#2563eb',
    infoLight: '#dbeafe',
    deepGreen: '#065f46',
    cream: '#fffbeb',
    parchment: '#fefce8',
    midnight: '#0f172a',
  };
};

// Static export for backward compatibility (green theme, light mode)
export const COLORS = getColors('green', false);

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  gold: {
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// Font size scale factors
export const FONT_SCALE = {
  small: 0.85,
  medium: 1.0,
  large: 1.15,
};

// Spacing scale for compact view
export const SPACING_SCALE = {
  normal: 1.0,
  compact: 0.7,
};

// Backward-compatible Colors export for legacy template components
export const Colors = {
  light: {
    text: '#1c1917',
    background: '#fafaf9',
    tint: '#047857',
    icon: '#78716c',
    tabIconDefault: '#a8a29e',
    tabIconSelected: '#047857',
  },
  dark: {
    text: '#f8fafc',
    background: '#0f172a',
    tint: '#10b981',
    icon: '#94a3b8',
    tabIconDefault: '#64748b',
    tabIconSelected: '#10b981',
  },
};

// Pre-computed gradient colors for common use
export const GRADIENTS = {
  primary: ['#064e3b', '#047857', '#10b981'] as const,
  gold: ['#92400e', '#d97706', '#fbbf24'] as const,
  header: ['#065f46', '#047857'] as const,
  hero: ['#ecfdf5', '#ffffff'] as const,
  darkHeader: ['#0f172a', '#1e293b'] as const,
};

// Quran Review specific constants
export const QURAN = {
  totalSurahs: 114,
  totalJuz: 30,
  totalPages: 604,
};
