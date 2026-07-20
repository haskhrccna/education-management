import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { AppText, Avatar } from '@/src/components/design';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/auth/store';
import { accountApi } from '@/src/api/account';

// F5 student onboarding: welcome → your teacher → record your first page.
// No skip (a student can't use the app meaningfully without finishing);
// the unassigned-teacher state still lets the student continue (AC2.1.3).
export default function StudentOnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const user = useAuthStore((s) => s.user);
  const markOnboarded = useAuthStore((s) => s.markOnboarded);
  const [step, setStep] = useState(0);

  const teacher = user?.assignedTeacher ?? null;

  const finish = async () => {
    try {
      await accountApi.completeOnboarding();
    } catch {
      /* offline-tolerant — the server re-gates on next sign-in if this failed */
    }
    markOnboarded();
    router.replace({ pathname: '/student/mushaf', params: { page: '1', record: '1' } });
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: COLORS.background }]} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {step === 0 && (
          <>
            <View style={[styles.heroIcon, { backgroundColor: COLORS.primaryMuted }]}>
              <Ionicons name="book" size={44} color={COLORS.primary} />
            </View>
            <AppText variant="headlineMedium" color={COLORS.textPrimary} style={styles.center}>
              {t('obWelcomeStudent')}
            </AppText>
            <AppText variant="bodyMedium" color={COLORS.textSecondary} style={styles.center}>
              {t('obWelcomeStudentDesc')}
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
              {t('obYourTeacher')}
            </AppText>
            {teacher ? (
              <>
                <View style={styles.teacherRow}>
                  <Avatar colors={COLORS} label={`${teacher.firstName} ${teacher.lastName}`} size={56} />
                  <AppText variant="titleMedium" color={COLORS.textPrimary}>
                    {teacher.firstName} {teacher.lastName}
                  </AppText>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('obSaySalaam')}
                  onPress={() =>
                    router.push({
                      pathname: '/messages/conversation',
                      params: { partnerId: teacher.id, partnerName: `${teacher.firstName} ${teacher.lastName}` },
                    })
                  }
                  style={[styles.ctaOutline, { borderColor: COLORS.primary }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
                  <AppText variant="bodyMedium" color={COLORS.primary}>
                    {t('obSaySalaam')}
                  </AppText>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <AppText variant="bodyMedium" color={COLORS.textSecondary} style={styles.center}>
                  {t('obTeacherSoon')}
                </AppText>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('obRequestTeacher')}
                  onPress={() => router.push('/student/teacher-change')}
                  style={[styles.ctaOutline, { borderColor: COLORS.primary }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AppText variant="bodyMedium" color={COLORS.primary}>
                    {t('obRequestTeacher')}
                  </AppText>
                </TouchableOpacity>
              </>
            )}
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
              <Ionicons name="mic" size={44} color={COLORS.primary} />
            </View>
            <AppText variant="headlineSmall" color={COLORS.textPrimary} style={styles.center}>
              {t('obRecordFirst')}
            </AppText>
            <AppText variant="bodyMedium" color={COLORS.textSecondary} style={styles.center}>
              {t('obRecordFirstDesc')}
            </AppText>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('obRecordFirst')}
              onPress={finish}
              style={[styles.cta, { backgroundColor: COLORS.primary }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText variant="titleMedium" color="#FFFFFF">
                {t('obRecordFirst')}
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
  teacherRow: { alignItems: 'center', gap: SPACING.sm },
  cta: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  ctaOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, paddingBottom: SPACING.xl },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
