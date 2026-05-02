import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import { useAppointments } from '@/src/hooks/useAppointments';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/constants/theme';

export default function TeacherHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'myStudents' | 'assignments'>('myStudents');

  const { appointments, isLoading, fetchAppointments } = useAppointments();

  React.useEffect(() => {
    fetchAppointments();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {t('teacherHomeTitle', { name: user?.firstName || '' })}
            </Text>
            <Text style={styles.subGreeting}>
              {i18n.language === 'ar' ? 'جزاك الله خيراً على تعليم القرآن' : 'May Allah reward you for teaching the Quran'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{appointments.length}</Text>
            <Text style={styles.statLabel}>{t('myStudents')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>{t('assignments')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>85%</Text>
            <Text style={styles.statLabel}>
              {i18n.language === 'ar' ? 'معدل الإنجاز' : 'Completion'}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { key: 'myStudents' as const, label: t('myStudents') },
          { key: 'assignments' as const, label: t('assignments') },
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
        ) : activeTab === 'myStudents' ? (
          <MyStudentsTab appointments={appointments} />
        ) : (
          <AssignmentsTab />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MyStudentsTab({ appointments }: { appointments: any[] }) {
  const { t, i18n } = useTranslation();

  if (appointments.length === 0) {
    return (
      <Animated.View entering={FadeInUp.duration(400)} style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>👨‍🎓</Text>
        <Text style={styles.emptyTitle}>{t('noStudentsYet')}</Text>
        <Text style={styles.emptyDesc}>
          {i18n.language === 'ar'
            ? 'ستظهر هنا قائمة طلابك بمجرد تعيينهم إليك'
            : 'Your student list will appear here once assigned'}
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
          style={styles.studentCard}
        >
          <View style={styles.studentHeader}>
            <View style={styles.studentAvatar}>
              <Text style={styles.avatarText}>{a.student?.firstName?.[0] || '?'}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>
                {a.student?.firstName} {a.student?.lastName}
              </Text>
              <Text style={styles.studentEmail}>{a.student?.email}</Text>
            </View>
            <View style={[styles.statusBadge, a.status === 'ACCEPTED' && styles.statusAccepted]}>
              <Text style={[styles.statusText, a.status === 'ACCEPTED' && styles.statusTextAccepted]}>
                {a.status === 'REQUESTED' ? t('awaitingApproval') :
                 a.status === 'ACCEPTED' ? t('approved') :
                 a.status === 'REJECTED' ? t('rejected') : a.status}
              </Text>
            </View>
          </View>

          <View style={styles.studentProgress}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                {i18n.language === 'ar' ? 'سورة البقرة' : 'Surah Al-Baqarah'}
              </Text>
              <Text style={styles.progressValue}>45%</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: '45%' }]} />
            </View>
          </View>

          <View style={styles.studentMeta}>
            <Text style={styles.metaText}>
              📅 {new Date(a.requestedDate).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
            </Text>
            <Text style={styles.metaText}>
              🕐 {a.requestedTime}
            </Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function AssignmentsTab() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.tabContent}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.actionCard}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/teacher/grades')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>📝</Text>
          <Text style={styles.actionBtnText}>
            {t('addReviewTask')}
          </Text>
          <Text style={styles.actionBtnSub}>
            {i18n.language === 'ar' ? 'تعيين سورة أو جزء لمراجعة الطالب' : 'Assign a Surah or Juz for student review'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.secondaryBtn]}
          onPress={() => router.push('/teacher/reports')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={[styles.actionBtnText, styles.secondaryText]}>
            {i18n.language === 'ar' ? 'تقرير التقدم' : 'Progress Report'}
          </Text>
          <Text style={[styles.actionBtnSub, styles.secondarySub]}>
            {i18n.language === 'ar' ? 'عرض تقرير شامل عن تقدم طلابك' : 'View comprehensive report of your students\' progress'}
          </Text>
        </TouchableOpacity>
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

  // Student cards
  studentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  studentEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningLight,
  },
  statusAccepted: {
    backgroundColor: COLORS.successLight,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.warning,
  },
  statusTextAccepted: {
    color: COLORS.success,
  },

  // Progress
  studentProgress: {
    marginBottom: SPACING.md,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e7e5e4',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },

  // Meta
  studentMeta: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Action cards
  actionCard: {
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  actionBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    alignItems: 'center',
    ...SHADOWS.md,
    borderWidth: 2,
    borderColor: COLORS.primaryMuted,
  },
  actionIcon: {
    fontSize: 36,
    marginBottom: SPACING.md,
  },
  actionBtnText: {
    color: COLORS.primaryDark,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  actionBtnSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  secondaryBtn: {
    borderColor: COLORS.goldMuted,
  },
  secondaryText: {
    color: COLORS.gold,
  },
  secondarySub: {
    color: COLORS.textSecondary,
  },
});
