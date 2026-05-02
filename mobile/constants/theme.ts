// Quran Review — Islamic Premium Design System

export const COLORS = {
  // Primary — Emerald (Islamic green)
  primary: '#047857',
  primaryLight: '#10b981',
  primaryDark: '#064e3b',
  primaryMuted: '#d1fae5',

  // Accent — Gold (traditional Islamic art)
  gold: '#d97706',
  goldLight: '#fbbf24',
  goldMuted: '#fef3c7',

  // Backgrounds
  background: '#fafaf9',
  surface: '#ffffff',
  surfaceAlt: '#fef3c7',
  surfaceGreen: '#ecfdf5',

  // Text
  textPrimary: '#1c1917',
  textSecondary: '#78716c',
  textMuted: '#a8a29e',
  textOnPrimary: '#ffffff',
  textOnGold: '#78350f',

  // Semantic
  success: '#059669',
  successLight: '#d1fae5',
  warning: '#d97706',
  warningLight: '#fef3c7',
  error: '#dc2626',
  errorLight: '#fee2e2',
  info: '#2563eb',
  infoLight: '#dbeafe',

  // Islamic decorative
  deepGreen: '#065f46',
  cream: '#fffbeb',
  parchment: '#fefce8',
  midnight: '#0f172a',
};

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

export const FONTS = {
  // Platform-selective Arabic-friendly stacks
  ios: {
    arabic: 'System',
    body: 'System',
    heading: 'System',
  },
  android: {
    arabic: 'Roboto',
    body: 'Roboto',
    heading: 'Roboto',
  },
  default: {
    arabic: 'System',
    body: 'System',
    heading: 'System',
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
