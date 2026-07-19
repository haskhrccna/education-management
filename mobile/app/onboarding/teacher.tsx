import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { AppText } from '@/src/components/design';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/auth/store';
import { useRosterHealth } from '@/src/hooks/useRosterHealth';
import { accountApi } from '@/src/api/account';

// F5 teacher onboarding (confirmed flow): welcome → how students reach you
// (the admin assigns them) → optional first curriculum plan. Skip stamps too.
export default function TeacherOnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const markOnboarded = useAuthStore((s) => s.markOnboarded);
  const { roster } = useRosterHealth();
  const [step, setStep] = useState(0);

  const done = async (goPlans: boolean) => {
    try {
      await accountApi.completeOnboarding();
    } catch {
      /* offline-tolerant */
    }
    markOnboarded();
    router.replace(goPlans ? '/teacher/plans' : '/teacher/home');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: COLORS.background }]} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {step === 0 && (
          <>
            <View style={[styles.heroIcon, { backgroundColor: COLORS.primaryMuted }]}>
              <Ionicons name="school" size={44} color={COLORS.primary} />
            </View>
            <AppText variant="headlineMedium" color={COLORS.textPrimary} style={styles.center}>
              {t('obWelcomeTeacher')}
            </AppText>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('obStart')}
              onPress={() => setStep(1)}
              style={[styles.cta, { backgroundColor: COLORS.primary }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText variant="titleMedium" color="#FFFFFF">
                {t('obStart')}
              </AppText>
            </TouchableOpacity>
          </>
        )}

        {step === 1 && (
          <>
            <AppText variant="headlineSmall" color={COLORS.textPrimary} style={styles.center}>
              {t('obHowStudentsArriveTitle')}
            </AppText>
            <AppText variant="bodyMedium" color={COLORS.textSecondary} style={styles.center}>
              {t('obHowStudentsArrive')}
            </AppText>
            <AppText variant="titleMedium" color={COLORS.primary} style={styles.center}>
              {roster.length} {t('students')}
            </AppText>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('continue')}
              onPress={() => setStep(2)}
              style={[styles.cta, { backgroundColor: COLORS.primary }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText variant="titleMedium" color="#FFFFFF">
                {t('continue')}
              </AppText>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <View style={[styles.heroIcon, { backgroundColor: COLORS.primaryMuted }]}>
              <Ionicons name="map" size={44} color={COLORS.primary} />
            </View>
            <AppText variant="headlineSmall" color={COLORS.textPrimary} style={styles.center}>
              {t('obCreateFirstPlan')}
            </AppText>
            <AppText variant="bodyMedium" color={COLORS.textSecondary} style={styles.center}>
              {t('obCreateFirstPlanDesc')}
            </AppText>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('obCreateFirstPlan')}
              onPress={() => done(true)}
              style={[styles.cta, { backgroundColor: COLORS.primary }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText variant="titleMedium" color="#FFFFFF">
                {t('obCreateFirstPlan')}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('skip')}
              onPress={() => done(false)}
              style={styles.skip}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText variant="bodyMedium" color={COLORS.textSecondary}>
                {t('skip')}
              </AppText>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === step ? COLORS.primary : COLORS.borderSubtle }]} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  skip: { alignItems: 'center', paddingVertical: SPACING.xs },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, paddingBottom: SPACING.xl },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
