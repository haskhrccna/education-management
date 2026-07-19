import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { AppText } from '@/src/components/design';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/auth/store';
import { parentsApi } from '@/src/api/parents';
import { accountApi } from '@/src/api/account';

// F5 parent onboarding: welcome → link to your child. A parent who already
// has an APPROVED link auto-completes straight to home (AC2.3.2).
export default function ParentOnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const markOnboarded = useAuthStore((s) => s.markOnboarded);
  const [checking, setChecking] = useState(true);

  const complete = async (destination: '/parent/home' | '/parent/link-request') => {
    try {
      await accountApi.completeOnboarding();
    } catch {
      /* offline-tolerant */
    }
    markOnboarded();
    router.replace(destination);
  };

  useEffect(() => {
    let active = true;
    parentsApi
      .listLinks()
      .then((links) => {
        if (!active) return;
        if (links.some((l) => l.status === 'APPROVED')) {
          complete('/parent/home'); // AC2.3.2 — already linked, skip the wizard
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <SafeAreaView style={[styles.screen, styles.centerAll, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: COLORS.background }]} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={[styles.heroIcon, { backgroundColor: COLORS.primaryMuted }]}>
          <Ionicons name="people" size={44} color={COLORS.primary} />
        </View>
        <AppText variant="headlineMedium" color={COLORS.textPrimary} style={styles.center}>
          {t('obWelcomeParent')}
        </AppText>
        <AppText variant="bodyMedium" color={COLORS.textSecondary} style={styles.center}>
          {t('obWelcomeParentDesc')}
        </AppText>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('obLinkChild')}
          onPress={() => complete('/parent/link-request')}
          style={[styles.cta, { backgroundColor: COLORS.primary }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppText variant="titleMedium" color="#FFFFFF">
            {t('obLinkChild')}
          </AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centerAll: { justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl, gap: SPACING.lg },
  center: { textAlign: 'center' },
  heroIcon: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: { borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
});
