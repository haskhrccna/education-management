import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

export default function PendingApprovalPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Animated.View entering={FadeInUp.duration(600)} style={styles.card}>
          <View style={styles.iconContainer}>
            <Text style={styles.hourglass}>⏳</Text>
            <Animated.View entering={FadeIn.delay(400).duration(800)} style={styles.pulseRing} />
          </View>

          <Text style={styles.title}>{t('pendingApproval')}</Text>
          <Text style={styles.description}>{t('pendingDesc')}</Text>

          <View style={styles.steps}>
            <View style={styles.step}>
              <View style={[styles.stepDot, styles.stepActive]} />
              <Text style={styles.stepText}>✓ {t('submitted')}</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>{t('pendingApproval')}</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>{t('teacherNotes')}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(600).delay(300)} style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/')} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{t('backToLogin')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      padding: SPACING['2xl'],
    },
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS['2xl'],
      padding: SPACING['3xl'],
      alignItems: 'center',
      ...SHADOWS.lg,
      borderTopWidth: 4,
      borderTopColor: COLORS.gold,
    },
    iconContainer: {
      position: 'relative',
      marginBottom: SPACING.lg,
    },
    hourglass: {
      fontSize: 56,
      zIndex: 2,
    },
    pulseRing: {
      position: 'absolute',
      top: -12,
      left: -12,
      right: -12,
      bottom: -12,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.goldMuted,
      opacity: 0.4,
      zIndex: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: COLORS.primaryDark,
      marginBottom: SPACING.sm,
      textAlign: 'center',
    },
    description: {
      fontSize: 15,
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: SPACING['2xl'],
    },
    steps: {
      width: '100%',
      alignItems: 'flex-end',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.xl,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    stepDot: {
      width: 10,
      height: 10,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.textMuted,
    },
    stepActive: {
      backgroundColor: COLORS.success,
    },
    stepLine: {
      width: 2,
      height: 24,
      backgroundColor: '#e7e5e4',
      marginRight: 4,
    },
    stepText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    footer: {
      marginTop: SPACING['3xl'],
      alignItems: 'center',
    },
    button: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING['3xl'],
      ...SHADOWS.md,
    },
    buttonText: {
      color: COLORS.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
  });
