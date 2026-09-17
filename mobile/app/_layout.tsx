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

/**
 * Deployment base path for the web build ('/' on a root domain,
 * '/education-management/' on GitHub Pages). `EXPO_BASE_URL` is inlined by
 * the bundler from app.json `experiments.baseUrl`.
 */
/** Browser tab / bookmark / share title for the web build. */
const WEB_DOCUMENT_TITLE = 'مراجعة القرآن · Quran Review';

function getWebBasePath(): string {
  const raw = (process.env.EXPO_BASE_URL ?? '').trim();
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { loadSettings, darkMode, isLoaded, language } = useSettingsStore();
  const { loadSession, user, isLoading: authLoading, isSessionRestored } = useAuthStore();
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

  // PWA: register the offline service worker + add the manifest link tag.
  // Web-only; a no-op on native builds. Base path from app.json baseUrl so
  // the scope works on both GitHub Pages project paths and root domains.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    // The Expo web export does NOT emit a <base> tag, so reading one here
    // always fell back to '/' and registered '/sw.js' — a 404 on a GitHub
    // Pages project site, which silently disabled offline support entirely.
    // EXPO_BASE_URL is inlined at build time from app.json's
    // experiments.baseUrl, and is '' for a root-domain deploy.
    const base = getWebBasePath();
    const scriptUrl = `${base.replace(/\/$/, '')}/sw.js`;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(scriptUrl, { scope: base });
        if (__DEV__) console.log('[PWA] service worker registered:', reg.scope);
      } catch (err) {
        // Registration failure must never blank the app — offline is a
        // progressive enhancement, not a hard dependency.
        console.warn('[PWA] service worker registration failed:', (err as Error)?.message);
      }
    };
    const t = setTimeout(register, 1500); // don't compete with first paint
    return () => clearTimeout(t);
  }, []);
  // Web: keep the browser tab title correct. Expo's static renderer emits an
  // empty react-helmet <title>, and react-helmet re-applies it on hydration
  // and on every navigation — so a title set once at build time would be
  // wiped the moment the app mounts. Re-assert it whenever the route changes.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (document.title !== WEB_DOCUMENT_TITLE) document.title = WEB_DOCUMENT_TITLE;
    document.documentElement.setAttribute('lang', language === 'ar' ? 'ar' : 'en');
  }, [segments, language]);

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

  // Gate on the ONE-TIME session restore, not on `authLoading`. `authLoading`
  // is also true during login/register, and swapping the whole tree for a
  // spinner there unmounted the screen that was awaiting the result — so a
  // failed sign-in came back to a freshly mounted form with its error state
  // wiped, showing the user nothing at all.
  if (!isLoaded || !fontsLoaded || !isSessionRestored) {
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
