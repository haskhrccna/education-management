import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { I18nManager, View, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import 'react-native-reanimated';
import i18n from '@/src/i18n';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/src/settings/store';
import { useAuthStore } from '@/src/auth/store';
import { SettingsProvider } from '@/src/components/SettingsContext';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister } from '@/src/lib/queryClient';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { loadSettings, darkMode, isLoaded, language } = useSettingsStore();
  const { loadSession, user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  // Cairo: Arabic-first UI font per design spec
  const [fontsLoaded] = useFonts({
    Cairo: require('../assets/fonts/Cairo-Variable.ttf'),
  });

  // Force RTL layout for Arabic locale only when direction actually changes.
  useEffect(() => {
    const shouldBeRTL = language === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
      if (Platform.OS === 'web') {
        window?.location?.reload?.();
      } else {
        const { DevSettings } = require('react-native');
        DevSettings?.reload?.();
      }
    }
  }, [language]);

  useEffect(() => {
    i18n.init();
  }, []);
  useEffect(() => {
    loadSettings();
  }, []);
  useEffect(() => {
    loadSession();
  }, []);

  // Auth gate: redirect based on session state once settings are loaded
  useEffect(() => {
    if (!isLoaded) return;

    // Any route segment that starts with a protected role folder is protected;
    // everything else (login, register, forgot-password, pending-approval, index) is public.
    const protectedRoots = new Set(['student', 'teacher', 'admin', 'messages']);
    const inProtectedScreen = protectedRoots.has(segments[0]);

    if (!user) {
      if (inProtectedScreen) {
        router.replace('/');
      }
    } else if (user.status === 'pending') {
      router.replace('/pending-approval');
    }
  }, [isLoaded, user, segments]);

  if (!isLoaded || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
      <SettingsProvider>
        <ThemeProvider value={darkMode ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="parent" />
            <Stack.Screen name="halaqa" />
            <Stack.Screen name="admin/analytics" />
            <Stack.Screen name="student/mushaf" />
            <Stack.Screen name="student" />
            <Stack.Screen name="student/certificates" />
            <Stack.Screen name="student/gamification" />
            <Stack.Screen name="register" />
            <Stack.Screen name="first-login" />
            <Stack.Screen name="pending-approval" />
            <Stack.Screen name="forgot-password" />

            {/* Student */}
            <Stack.Screen name="student/home" />
            <Stack.Screen name="student/grades" />
            <Stack.Screen name="student/recordings" />
            <Stack.Screen name="student/reports" />
            <Stack.Screen name="student/appointments" />
            <Stack.Screen name="student/teacher-change" />

            {/* Teacher */}
            <Stack.Screen name="teacher/home" />
            <Stack.Screen name="teacher/student-detail" />
            <Stack.Screen name="teacher/grade-form" />
            <Stack.Screen name="teacher/recordings" />
            <Stack.Screen name="teacher/reports" />
            <Stack.Screen name="teacher/appointments" />

            {/* Admin */}
            <Stack.Screen name="admin/home" />
            <Stack.Screen name="admin/user-detail" />
            <Stack.Screen name="admin/settings" />
            <Stack.Screen name="admin/broadcast" />
            <Stack.Screen name="admin/change-requests" />

            {/* Messages */}
            <Stack.Screen name="messages/index" />
            <Stack.Screen name="messages/conversation" />
          </Stack>
          <StatusBar style={darkMode ? 'light' : 'dark'} />
        </ThemeProvider>
      </SettingsProvider>
    </PersistQueryClientProvider>
  );
}
