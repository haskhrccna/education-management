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
import { defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { queryClient, queryPersister } from '@/src/lib/queryClient';
import { setupOnlineManager } from '@/src/lib/onlineManager';
import { OfflineBanner } from '@/src/components/OfflineBanner';

setupOnlineManager();

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
        // Do NOT reload on web. React Native Web does not persist forceRTL
        // across a page reload, so `isRTL` resets to false on every load and,
        // for the Arabic-first default, this branch would fire forceRTL +
        // reload on each load — an infinite reload loop that leaves the page
        // permanently blank (the exact GitHub Pages "blank page" symptom).
        // forceRTL() above already flips isRTL in-memory for this render pass,
        // so RN Web resolves start/end styles correctly; we only need to set
        // the document direction for the browser's own layout — no reload.
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('dir', shouldBeRTL ? 'rtl' : 'ltr');
        }
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
    if (!isLoaded || authLoading) return;

    // Any route segment that starts with a protected role folder is protected;
    // everything else (login, register, forgot-password, pending-approval, index) is public.
    // 'account', 'notifications', 'halaqa' added alongside Task 5's new public-route
    // redirect branch below: these are top-level (non-role-prefixed) screens that
    // still require an authenticated user (see account.tsx / notifications.tsx /
    // halaqa/_layout.tsx's own useAuthStore() reads) — without listing them here,
    // the new branch misclassified them as "public" and bounced an active user
    // straight back to home the instant they navigated to any of the three,
    // caught live via `maestro test mobile/e2e/flows/student/01-home-smoke.yaml`
    // (student-home.notifications tap never reached notifications.screen).
    const protectedRoots = new Set([
      'student',
      'teacher',
      'admin',
      'messages',
      'parent',
      'onboarding',
      'account',
      'notifications',
      'halaqa',
    ]);
    const inProtectedScreen = protectedRoots.has(segments[0]);

    if (!user) {
      if (inProtectedScreen) {
        router.replace('/');
      }
    } else if (user.status === 'pending') {
      router.replace('/pending-approval');
    } else if (
      // F5: first sign-in → role onboarding wizard (admin exempt; stamped users skip).
      user.status === 'active' &&
      user.onboardingCompletedAt == null &&
      ['student', 'teacher', 'parent'].includes(user.role) &&
      segments[0] !== 'onboarding'
    ) {
      router.replace(`/onboarding/${user.role}` as never);
    } else if (user.status === 'active' && !inProtectedScreen) {
      // A fully authenticated, active, onboarded user sitting on a PUBLIC
      // route (e.g. loadSession() restored a still-valid Keychain token on a
      // cold app restart, but nothing had ever redirected them off the
      // login/register/forgot-password screens). Without this branch, a real
      // user who force-quits and reopens the app sees the login form on
      // every cold start even though their session never expired.
      router.replace(`/${user.role}/home` as never);
    }
  }, [authLoading, isLoaded, user, segments]);

  if (!isLoaded || !fontsLoaded || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        dehydrateOptions: {
          shouldDehydrateMutation: () => true,
          // Audit-log rows (actor PII, IP addresses, user-agents, raw details
          // JSON) must not land in the unencrypted on-device MMKV cache. This
          // must compose with the library default (status === 'success') —
          // replacing it outright persists failed/in-flight queries too, which
          // hydrate back as stale errors on cold start.
          shouldDehydrateQuery: (query) => query.queryKey[0] !== 'auditLogs' && defaultShouldDehydrateQuery(query),
        },
      }}
      onSuccess={() => {
        // A mutation the user made while offline (e.g. submitting a grade) is
        // queued paused rather than lost — resume it once the cache (and any
        // paused mutations in it) has been restored from disk.
        queryClient.resumePausedMutations();
      }}
    >
      <SettingsProvider>
        <ThemeProvider value={darkMode ? DarkTheme : DefaultTheme}>
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)/index" />
            <Stack.Screen name="onboarding/student" />
            <Stack.Screen name="onboarding/teacher" />
            <Stack.Screen name="onboarding/parent" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="parent" />
            <Stack.Screen name="halaqa" />
            <Stack.Screen name="admin/analytics" />
            <Stack.Screen name="student/mushaf" />
            <Stack.Screen name="student/certificates" />
            <Stack.Screen name="student/gamification" />
            <Stack.Screen name="(auth)/register" />
            <Stack.Screen name="(auth)/pending-approval" />
            <Stack.Screen name="(auth)/forgot-password" />

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
            <Stack.Screen name="admin/academy-profile" />
            <Stack.Screen name="admin/academy-health" />

            {/* Messages */}
            <Stack.Screen name="messages/index" />
            <Stack.Screen name="messages/conversation" />

            {/* Public (unauthenticated — not in protectedRoots above) */}
            <Stack.Screen name="(public)/academy/[slug]" />
          </Stack>
          <StatusBar style={darkMode ? 'light' : 'dark'} />
        </ThemeProvider>
      </SettingsProvider>
    </PersistQueryClientProvider>
  );
}
