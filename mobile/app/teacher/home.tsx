import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import { useAppointments } from '@/src/hooks/useAppointments';
import { useMessages } from '@/src/hooks/useMessages';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';
import { gradesApi, memorizationApi, MemorizationEntry } from '@/src/api';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

type StudentProgressSummary = {
  label: string;
  percent: number | null;
};

function summarizeProgress(entries: MemorizationEntry[], language: string): StudentProgressSummary {
  const active = entries.find((e) => e.memorizedAyahs > 0 && e.memorizedAyahs < e.surah.ayahCount) ?? entries[0];

  if (!active) {
    return { label: language === 'ar' ? 'لم يبدأ بعد' : 'Not started yet', percent: null };
  }

  const percent = active.surah.ayahCount > 0 ? Math.round((active.memorizedAyahs / active.surah.ayahCount) * 100) : 0;
  return { label: language === 'ar' ? active.surah.nameAr : active.surah.nameEn, percent };
}

function classAverageCompletion(progressByStudent: Record<string, StudentProgressSummary>): string {
  const percents = Object.values(progressByStudent)
    .map((p) => p.percent)
    .filter((p): p is number => typeof p === 'number');

  if (percents.length === 0) return '—';
  return `${Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length)}%`;
}

export default function TeacherHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'myStudents' | 'assignments'>('myStudents');
  const [progressByStudent, setProgressByStudent] = useState<Record<string, StudentProgressSummary>>({});
  const [gradeCount, setGradeCount] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  const { appointments, isLoading, fetchAppointments } = useAppointments();
  const { unreadCount, fetchMessages: fetchUnreadCount } = useMessages();
  const { requests: changeRequests, fetchRequests: fetchChangeRequests } = useTeacherChange();
  const pendingChanges = changeRequests.filter((r: any) => r.status === 'PENDING');

  React.useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  React.useEffect(() => {
    fetchUnreadCount();
  }, []);

  React.useEffect(() => {
    fetchChangeRequests();
  }, []);

  React.useEffect(() => {
    const acceptedStudents = appointments
      .filter((a: any) => a.status === 'ACCEPTED' && a.student?.id)
      .map((a: any) => a.student.id);

    if (acceptedStudents.length === 0) {
      setProgressByStudent({});
      setGradeCount(0);
      return;
    }

    let isMounted = true;
    setFetchError(null);

    Promise.all(
      acceptedStudents.map(async (studentId: string) => {
        const [progress, grades] = await Promise.all([
          memorizationApi.getStudentProgress(studentId),
          gradesApi.getStudentGrades(studentId),
        ]);
        return { studentId, progress: summarizeProgress(progress, i18n.language), gradesCount: grades.length };
      })
    )
      .then((summaries) => {
        if (!isMounted) return;
        setProgressByStudent(
          summaries.reduce<Record<string, StudentProgressSummary>>((acc, item) => {
            acc[item.studentId] = item.progress;
            return acc;
          }, {})
        );
        setGradeCount(summaries.reduce((sum, item) => sum + item.gradesCount, 0));
      })
      .catch((err: any) => {
        console.error('Failed to load teacher dashboard summaries:', err.message);
        if (isMounted) {
          setProgressByStudent({});
          setGradeCount(null);
          setFetchError(t('loadFailed'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [appointments, i18n.language]);

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
            <Text style={styles.greeting}>{t('teacherHomeTitle', { name: user?.firstName || '' })}</Text>
            <Text style={styles.subGreeting}>
              {i18n.language === 'ar'
                ? 'جزاك الله خيراً على تعليم القرآن'
                : 'May Allah reward you for teaching the Quran'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
            <View style={styles.msgIconWrap}>
              <TouchableOpacity style={styles.msgIconBtn} onPress={() => router.push('/messages')}>
                <Text style={styles.msgIconText}>💬</Text>
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.msgBadge}>
                  <Text style={styles.msgBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>{t('logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{appointments.length}</Text>
            <Text style={styles.statLabel}>{t('myStudents')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{gradeCount ?? '—'}</Text>
            <Text style={styles.statLabel}>{t('assignments')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{classAverageCompletion(progressByStudent)}</Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'معدل الإنجاز' : 'Completion'}</Text>
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
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchAppointments} />}
      >
        {fetchError && !isLoading && (
          <TouchableOpacity onPress={fetchAppointments} style={styles.errorBanner}>
            <Text style={styles.errorText}>{fetchError}</Text>
          </TouchableOpacity>
        )}
        {isLoading ? (
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </>
        ) : activeTab === 'myStudents' ? (
          <MyStudentsTab
            appointments={appointments}
            progressByStudent={progressByStudent}
            styles={styles}
            pendingChanges={pendingChanges}
          />
        ) : (
          <AssignmentsTab styles={styles} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MyStudentsTab({
  appointments,
  progressByStudent,
  styles,
  pendingChanges,
}: {
  appointments: any[];
  progressByStudent: Record<string, StudentProgressSummary>;
  styles: any;
  pendingChanges: any[];
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();

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
      {pendingChanges.length > 0 && (
        <View style={styles.changeRequestBanner}>
          <Text style={styles.changeRequestText}>
            ⚠️ {pendingChanges.length} {t('studentsPendingChange')}
          </Text>
        </View>
      )}
      {appointments.map((a: any, index: number) => {
        const progress = a.student?.id ? progressByStudent[a.student.id] : undefined;
        const percent = progress?.percent;

        return (
          <TouchableOpacity
            key={a.id}
            activeOpacity={0.85}
            onPress={() =>
              router.push(
                `/teacher/student-detail?id=${a.student?.id}&name=${encodeURIComponent(
                  `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim()
                )}`
              )
            }
          >
            <Animated.View entering={FadeInUp.duration(400).delay(index * 80)} style={styles.studentCard}>
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
                    {a.status === 'REQUESTED'
                      ? t('awaitingApproval')
                      : a.status === 'ACCEPTED'
                        ? t('approved')
                        : a.status === 'REJECTED'
                          ? t('rejected')
                          : a.status}
                  </Text>
                </View>
              </View>

              <View style={styles.studentProgress}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>
                    {progress?.label ?? (i18n.language === 'ar' ? 'جاري تحميل التقدم' : 'Loading progress')}
                  </Text>
                  <Text style={styles.progressValue}>{typeof percent === 'number' ? `${percent}%` : '—'}</Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${percent ?? 0}%` }]} />
                </View>
              </View>

              <View style={styles.studentMeta}>
                <Text style={styles.metaText}>
                  📅 {new Date(a.requestedDate).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
                </Text>
                <Text style={styles.metaText}>🕐 {a.requestedTime}</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AssignmentsTab({ styles }: { styles: any }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.tabContent}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.actionCard}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/teacher/grade-form')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>📝</Text>
          <Text style={styles.actionBtnText}>{t('addReviewTask')}</Text>
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
            {i18n.language === 'ar'
              ? 'عرض تقرير شامل عن تقدم طلابك'
              : "View comprehensive report of your students' progress"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
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
    msgIconWrap: { position: 'relative', marginRight: 6 },
    msgIconBtn: {
      width: 32,
      height: 32,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    msgIconText: { fontSize: 16 },
    msgBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#ef4444',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    msgBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

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

    // Error banner
    errorBanner: {
      backgroundColor: COLORS.errorLight,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    errorText: {
      color: COLORS.error,
      fontSize: 13,
      textAlign: 'center',
    },

    // Change request banner
    changeRequestBanner: {
      backgroundColor: '#fef3c7',
      borderLeftWidth: 4,
      borderLeftColor: '#f59e0b',
      padding: SPACING.sm,
      marginBottom: SPACING.sm,
      borderRadius: 6,
    },
    changeRequestText: { fontSize: 13, color: '#92400e', fontWeight: '600' },
  });
