import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';
import { create } from 'zustand';

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
  setTheme: (theme: ThemeColor) => Promise<void>;
  setFontSize: (size: FontSize) => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
  setNotifications: (enabled: boolean) => Promise<void>;
  setCompactView: (enabled: boolean) => Promise<void>;
  setLanguage: (lng: 'ar' | 'en') => Promise<void>;
  loadSettings: () => Promise<void>;
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

  setTheme: async (theme) => {
    set({ theme });
    await saveSettings({ ...get(), theme });
  },

  setFontSize: async (fontSize) => {
    set({ fontSize });
    await saveSettings({ ...get(), fontSize });
  },

  setDarkMode: async (darkMode) => {
    set({ darkMode });
    await saveSettings({ ...get(), darkMode });
  },

  setNotifications: async (notifications) => {
    set({ notifications });
    await saveSettings({ ...get(), notifications });
  },

  setCompactView: async (compactView) => {
    set({ compactView });
    await saveSettings({ ...get(), compactView });
  },

  setLanguage: async (language) => {
    set({ language });
    await i18next.changeLanguage(language);
    await saveSettings({ ...get(), language });
  },

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ ...parsed, isLoaded: true });
        if (parsed.language && parsed.language !== i18next.language) {
          await i18next.changeLanguage(parsed.language);
        }
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },
}));

async function saveSettings(settings: any) {
  try {
    const { isLoaded, loadSettings, ...settingsToSave } = settings;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
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
