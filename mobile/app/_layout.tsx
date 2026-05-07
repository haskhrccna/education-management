import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { I18nManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import i18n from '@/src/i18n';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/src/settings/store';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { loadSettings, darkMode, isLoaded, language } = useSettingsStore();

  // Force RTL layout for Arabic locale
  useEffect(() => {
    I18nManager.forceRTL(language === 'ar');
  }, [language]);

  useEffect(() => {
    i18n.init();
  }, []);
  useEffect(() => {
    loadSettings();
  }, []);

  if (!isLoaded) return null;

  return (
    <ThemeProvider value={darkMode ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="first-login" />
        <Stack.Screen name="pending-approval" />
        <Stack.Screen name="student/home" />
        <Stack.Screen name="teacher/home" />
        <Stack.Screen name="admin/home" />
        <Stack.Screen name="admin/user-detail" />
        <Stack.Screen name="admin/settings" />
      </Stack>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
