import i18next from 'i18next';
import { create } from 'zustand';
import { mmkvStorage } from '../storage/mmkvStorage';

export type ThemeColor = 'green' | 'blue' | 'purple' | 'dark';
export type FontSize = 'small' | 'medium' | 'large';

interface SettingsState {
  theme: ThemeColor;
  fontSize: FontSize;
  darkMode: boolean;
  notifications: boolean;
  compactView: boolean;
  language: 'ar' | 'en';
  isLoaded: boolean;
  setTheme: (theme: ThemeColor) => void;
  setFontSize: (size: FontSize) => void;
  setDarkMode: (enabled: boolean) => void;
  setNotifications: (enabled: boolean) => void;
  setCompactView: (enabled: boolean) => void;
  setLanguage: (lng: 'ar' | 'en') => void;
  loadSettings: () => void;
}

const STORAGE_KEY = '@quran_review_settings';

const DEFAULT_SETTINGS = {
  theme: 'green' as ThemeColor,
  fontSize: 'medium' as FontSize,
  darkMode: false,
  notifications: true,
  compactView: false,
  language: 'ar' as const,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isLoaded: false,

  setTheme: (theme) => {
    set({ theme });
    saveSettings({ ...get(), theme });
  },

  setFontSize: (fontSize) => {
    set({ fontSize });
    saveSettings({ ...get(), fontSize });
  },

  setDarkMode: (darkMode) => {
    set({ darkMode });
    saveSettings({ ...get(), darkMode });
  },

  setNotifications: (notifications) => {
    set({ notifications });
    saveSettings({ ...get(), notifications });
  },

  setCompactView: (compactView) => {
    set({ compactView });
    saveSettings({ ...get(), compactView });
  },

  setLanguage: (language) => {
    set({ language });
    i18next.changeLanguage(language);
    saveSettings({ ...get(), language });
  },

  loadSettings: () => {
    const stored = mmkvStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        set({ ...parsed, isLoaded: true });
        if (parsed.language && parsed.language !== i18next.language) {
          i18next.changeLanguage(parsed.language);
        }
      } catch {
        set({ isLoaded: true });
      }
    } else {
      set({ isLoaded: true });
    }
  },
}));

function saveSettings(settings: any) {
  const { isLoaded, loadSettings, ...settingsToSave } = settings;
  mmkvStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
}

/**
 * Theme-only view of the settings store. Selects `theme` and `darkMode`
 * individually so consumers re-render only when those fields change — not on
 * every settings update (font size, notifications, compact view, …). Prefer this
 * in screens over destructuring the whole `useSettingsStore()`.
 */
export function useThemeSettings(): { theme: ThemeColor; darkMode: boolean } {
  const theme = useSettingsStore((s) => s.theme);
  const darkMode = useSettingsStore((s) => s.darkMode);
  return { theme, darkMode };
}

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
