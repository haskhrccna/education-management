import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import { useAppointments } from '@/src/hooks/useAppointments';
import { useGrades } from '@/src/hooks/useGrades';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/constants/theme';

export default function StudentHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'myReview' | 'schedule' | 'progress'>('myReview');

  const { appointments, isLoading: apptLoading, fetchAppointments } = useAppointments();
  const { grades, isLoading: gradesLoading, fetchGrades } = useGrades();

  React.useEffect(() => {
    fetchAppointments();
    fetchGrades();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const isLoading = apptLoading || gradesLoading;

  // Mock Quran data for beautiful UI (will be replaced with real API data)
  const currentSurah = { name: 'سورة البقرة', progress: 45, total: 286 };
  const weeklyStreak = 5;
  const totalMemorized = 125;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with gradient effect */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {t('studentHomeTitle', { name: user?.firstName || '' })}
            </Text>
            <Text style={styles.subGreeting}>
              {i18n.language === 'ar' ? 'بارك الله فيك في حفظ كتابه' : 'May Allah bless your memorization'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalMemorized}</Text>
            <Text style={styles.statLabel}>{t('page')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{weeklyStreak}</Text>
            <Text style={styles.statLabel}>{t('days')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round((currentSurah.progress / currentSurah.total) * 100)}%</Text>
            <Text style={styles.statLabel}>{currentSurah.name}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { key: 'myReview' as const, label: t('myReview') },
          { key: 'schedule' as const, label: t('schedule') },
          { key: 'progress' as const, label: t('progress') },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text style={styles.empty}>{t('loading')}</Text>
        ) : activeTab === 'myReview' ? (
          <MyReviewTab appointments={appointments} />
        ) : activeTab === 'schedule' ? (
          <ScheduleTab appointments={appointments} />
        ) : (
          <ProgressTab grades={grades} currentSurah={currentSurah} weeklyStreak={weeklyStreak} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MyReviewTab({ appointments }: { appointments: any[] }) {
  const { t, i18n } = useTranslation();

  if (appointments.length === 0) {
    return (
      <Animated.View entering={FadeInUp.duration(400)} style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>📖</Text>
        <Text style={styles.emptyTitle}>{t('noScheduleYet')}</Text>
        <Text style={styles.emptyDesc}>
          {i18n.language === 'ar'
            ? 'ستظهر هنا مراجعاتك القادمة بمجرد تعيينها من قبل معلمك'
            : 'Your upcoming reviews will appear here once assigned by your teacher'}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {appointments.map((a: any, index: number) => (
        <Animated.View
          key={a.id}
          entering={FadeInUp.duration(400).delay(index * 80)}
          style={styles.reviewCard}
        >
          <View style={styles.reviewHeader}>
            <View style={[styles.statusBadge, a.status === 'ACCEPTED' && styles.statusAccepted]}>
              <Text style={[styles.statusText, a.status === 'ACCEPTED' && styles.statusTextAccepted]}>
                {a.status === 'REQUESTED' ? (i18n.language === 'ar' ? 'مُعين' : 'Assigned') :
                 a.status === 'ACCEPTED' ? (i18n.language === 'ar' ? 'مقبول' : 'Accepted') :
                 a.status === 'REJECTED' ? (i18n.language === 'ar' ? 'مرفوض' : 'Rejected') : a.status}
              </Text>
            </View>
          </View>
          <Text style={styles.reviewTeacher}>
            {a.teacher?.firstName} {a.teacher?.lastName}
          </Text>
          <Text style={styles.reviewDetail}>
            📅 {new Date(a.requestedDate).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
          </Text>
          <Text style={styles.reviewDetail}>
            🕐 {a.requestedTime}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

function ScheduleTab({ appointments }: { appointments: any[] }) {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.tabContent}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.scheduleCard}>
        <Text style={styles.scheduleIcon}>🗓️</Text>
        <Text style={styles.scheduleTitle}>
          {i18n.language === 'ar' ? 'جدول المراجعة الأسبوعي' : 'Weekly Review Schedule'}
        </Text>
        <Text style={styles.scheduleDesc}>
          {i18n.language === 'ar'
            ? 'يتم تحديث الجدول من قبل معلمك. راجع معلمك للتفاصيل.'
            : 'The schedule is updated by your teacher. Check with your teacher for details.'}
        </Text>
      </Animated.View>
    </View>
  );
}

function ProgressTab({ grades, currentSurah, weeklyStreak }: { grades: any[], currentSurah: any, weeklyStreak: number }) {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.tabContent}>
      {/* Current Surah Progress */}
      <Animated.View entering={FadeInUp.duration(400)} style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>{t('currentSurah')}</Text>
          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>{t('inProgress')}</Text>
          </View>
        </View>
        <Text style={styles.surahName}>{currentSurah.name}</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${(currentSurah.progress / currentSurah.total) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {currentSurah.progress} / {currentSurah.total} {i18n.language === 'ar' ? 'آية' : 'verses'}
        </Text>
      </Animated.View>

      {/* Weekly Streak */}
      <Animated.View entering={FadeInUp.duration(400).delay(100)} style={styles.streakCard}>
        <Text style={styles.streakIcon}>🔥</Text>
        <Text style={styles.streakValue}>{weeklyStreak}</Text>
        <Text style={styles.streakLabel}>{t('weeklyStreak')}</Text>
      </Animated.View>

      {/* Overall Progress */}
      <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.overallCard}>
        <Text style={styles.overallTitle}>{t('totalMemorized')}</Text>
        <View style={styles.overallRow}>
          <View style={styles.overallItem}>
            <Text style={styles.overallValue}>{grades.length}</Text>
            <Text style={styles.overallLabel}>
              {i18n.language === 'ar' ? 'سورة' : 'Surahs'}
            </Text>
          </View>
          <View style={styles.overallDivider} />
          <View style={styles.overallItem}>
            <Text style={styles.overallValue}>3</Text>
            <Text style={styles.overallLabel}>
              {i18n.language === 'ar' ? 'جزء' : 'Juz'}
            </Text>
          </View>
          <View style={styles.overallDivider} />
          <View style={styles.overallItem}>
            <Text style={styles.overallValue}>125</Text>
            <Text style={styles.overallLabel}>
              {i18n.language === 'ar' ? 'صفحة' : 'Pages'}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING['2xl'],
    borderBottomLeftRadius: RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
    ...SHADOWS.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: SPACING.xs,
  },
  subGreeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  logoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.goldLight,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  list: {
    gap: SPACING.md,
    paddingBottom: SPACING['4xl'],
  },
  tabContent: {
    gap: SPACING.md,
  },

  // Empty state
  empty: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING['3xl'],
    fontSize: 16,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['3xl'],
    alignItems: 'center',
    ...SHADOWS.md,
    marginTop: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Review cards
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.md,
    borderRightWidth: 4,
    borderRightColor: COLORS.primaryLight,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningLight,
  },
  statusAccepted: {
    backgroundColor: COLORS.successLight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warning,
  },
  statusTextAccepted: {
    color: COLORS.success,
  },
  reviewTeacher: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  reviewDetail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Schedule
  scheduleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    alignItems: 'center',
    ...SHADOWS.md,
    marginTop: SPACING.xl,
  },
  scheduleIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  scheduleDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Progress
  progressCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    ...SHADOWS.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  progressBadge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  surahName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e7e5e4',
    borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  progressText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Streak
  streakCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    alignItems: 'center',
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: COLORS.goldMuted,
  },
  streakIcon: {
    fontSize: 36,
    marginBottom: SPACING.sm,
  },
  streakValue: {
    fontSize: 40,
    fontWeight: '800',
    color: COLORS.gold,
  },
  streakLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },

  // Overall
  overallCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    ...SHADOWS.md,
  },
  overallTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  overallRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  overallItem: {
    alignItems: 'center',
    flex: 1,
  },
  overallValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  overallLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  overallDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e7e5e4',
  },
});
