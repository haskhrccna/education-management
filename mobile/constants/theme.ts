// Quran Review — Design System tokens
// Primary palette anchored to Material Green 900 (#1B5E20) per design spec.

export type ThemeColor = 'green' | 'blue' | 'purple' | 'dark';

const THEME_PALETTES: Record<ThemeColor, { primary: string; primaryLight: string; primaryDark: string; primaryMuted: string }> = {
  green: {
    primary: '#1B5E20',      // Material Green 900 — Islamic green anchor
    primaryLight: '#4C8C4A', // Green 700 tint
    primaryDark: '#003300',  // Deep green
    primaryMuted: '#E8F5E9', // Green 50 — light surface tint
  },
  blue: {
    primary: '#1565C0',
    primaryLight: '#1976D2',
    primaryDark: '#0D47A1',
    primaryMuted: '#E3F2FD',
  },
  purple: {
    primary: '#6A1B9A',
    primaryLight: '#7B1FA2',
    primaryDark: '#4A148C',
    primaryMuted: '#F3E5F5',
  },
  dark: {
    primary: '#0f172a',
    primaryLight: '#334155',
    primaryDark: '#020617',
    primaryMuted: '#1e293b',
  },
};

export const getColors = (theme: ThemeColor = 'green', isDark: boolean = false) => {
  const palette = THEME_PALETTES[theme];

  if (isDark) {
    return {
      primary: palette.primaryLight,
      primaryLight: palette.primary,
      primaryDark: '#0f172a',
      primaryMuted: palette.primaryMuted,
      // Accent
      gold: '#FFD54F',
      goldLight: '#FFECB3',
      goldMuted: '#33260A',
      // Surfaces
      background: '#121212',
      surface: '#1E1E1E',
      surfaceAlt: '#2C2C2C',
      surfaceGreen: '#1A2E1B',
      // Text
      textPrimary: '#F5F5F5',
      textSecondary: '#9E9E9E',
      textMuted: '#757575',
      textOnPrimary: '#FFFFFF',
      textOnGold: '#33260A',
      // Status
      success: '#66BB6A',
      successLight: '#1A2E1B',
      warning: '#FFB300',
      warningLight: '#33260A',
      error: '#EF5350',
      errorLight: '#2D1111',
      info: '#42A5F5',
      infoLight: '#0D2137',
      // Misc
      deepGreen: '#4C8C4A',
      cream: '#1E1E1E',
      parchment: '#2C2C2C',
      midnight: '#030712',
      divider: '#2C2C2C',
    };
  }

  return {
    primary: palette.primary,
    primaryLight: palette.primaryLight,
    primaryDark: palette.primaryDark,
    primaryMuted: palette.primaryMuted,
    // Accent — amber per design spec (#FFC107)
    gold: '#FFC107',
    goldLight: '#FFD54F',
    goldMuted: '#FFF8E1',
    // Surfaces
    background: '#F5F5F5',   // scaffold — design spec
    surface: '#FFFFFF',
    surfaceAlt: '#FFF8E1',
    surfaceGreen: '#E8F5E9',
    // Text
    textPrimary: '#212121',   // design spec
    textSecondary: '#757575', // design spec
    textMuted: '#9E9E9E',
    textOnPrimary: '#FFFFFF',
    textOnGold: '#3E2723',
    // Status — Material Design palette, design spec
    success: '#388E3C',
    successLight: '#E8F5E9',
    warning: '#FFA000',
    warningLight: '#FFF8E1',
    error: '#D32F2F',
    errorLight: '#FFEBEE',
    info: '#1976D2',
    infoLight: '#E3F2FD',
    // Misc
    deepGreen: '#1B5E20',
    cream: '#FFFDE7',
    parchment: '#FFF9C4',
    midnight: '#212121',
    divider: '#BDBDBD',      // design spec — input borders, separators
  };
};

// Static export for backward compatibility (green theme, light mode)
export const COLORS = getColors('green', false);

// ─── Shadows ─────────────────────────────────────────────────────────────────
// Material elevation system — no custom glows or neumorphism

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 3,
    elevation: 2, // card default — elevation 2 per design spec
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

// ─── Corner radii ─────────────────────────────────────────────────────────────
// Design spec: buttons/inputs 8 · cards 12 · badges/chips 16 (pill)

export const RADIUS = {
  sm: 8,   // buttons, inputs, icon tiles
  md: 12,  // cards
  lg: 16,  // badges, chips (pill)
  xl: 20,
  '2xl': 24,
  full: 9999,
};

// ─── Spacing (8pt grid) ───────────────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

// ─── Typography scale ─────────────────────────────────────────────────────────
// Mirrors AppTheme.textTheme from Flutter source (app_config.dart)

export const TYPOGRAPHY = {
  headlineLarge:  { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  headlineMedium: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  headlineSmall:  { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  titleLarge:     { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  titleMedium:    { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  titleSmall:     { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  bodyLarge:      { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium:     { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall:      { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  labelLarge:     { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
};

// ─── Font families ────────────────────────────────────────────────────────────
// Cairo: Arabic UI · System sans: Latin · Quran text gets Amiri-style treatment

export const FONTS = {
  arabic: 'Cairo',
  ui: 'Cairo', // Cairo has good Latin coverage and loads for both scripts
  quran: 'Cairo', // fallback until Amiri is bundled
};

// ─── Gradients ────────────────────────────────────────────────────────────────
// Design spec: solid primary on welcome/hero cards — no purple-to-blue gradients.
// These are kept minimal for optional decorative use only.

export const GRADIENTS = {
  primary: ['#1B5E20', '#2E7D32'] as const,    // subtle green — nearly solid
  gold: ['#F57F17', '#FFC107', '#FFD54F'] as const,
  header: ['#1B5E20', '#2E7D32'] as const,      // app bar — near-solid green
  hero: ['#E8F5E9', '#FFFFFF'] as const,
  darkHeader: ['#0f172a', '#1e293b'] as const,
};

// ─── Quran domain constants ───────────────────────────────────────────────────

export const QURAN = {
  totalSurahs: 114,
  totalJuz: 30,
  totalPages: 604,
};

// ─── Legacy compat ────────────────────────────────────────────────────────────

export const FONT_SCALE = {
  small: 0.85,
  medium: 1.0,
  large: 1.15,
};

export const SPACING_SCALE = {
  normal: 1.0,
  compact: 0.7,
};

export const Colors = {
  light: {
    text: '#212121',
    background: '#F5F5F5',
    tint: '#1B5E20',
    icon: '#757575',
    tabIconDefault: '#9E9E9E',
    tabIconSelected: '#1B5E20',
  },
  dark: {
    text: '#F5F5F5',
    background: '#121212',
    tint: '#4C8C4A',
    icon: '#9E9E9E',
    tabIconDefault: '#757575',
    tabIconSelected: '#4C8C4A',
  },
};
