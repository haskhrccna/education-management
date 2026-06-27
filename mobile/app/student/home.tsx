import React, { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuthStore } from '@/src/auth/store';
import { useAppointments } from '@/src/hooks/useAppointments';
import { useGrades } from '@/src/hooks/useGrades';
import { useMemorization } from '@/src/hooks/useMemorization';
import { useMessages } from '@/src/hooks/useMessages';
import { useSettingsStore } from '@/src/settings/store';
import {
  AppCard,
  Avatar,
  IconButton,
  MetricTile,
  ProgressBar,
  SectionHeader,
  StatusPill,
} from '@/src/components/design';
import { BottomNav } from '@/src/components/BottomNav';
import type { Appointment, Grade } from '@/src/api';

function gradeNumeric(grade: string): number {
  const n = parseFloat(grade);
  return Number.isNaN(n) ? 0 : n;
}

function getStatusTone(status?: string): 'success' | 'warning' | 'error' | 'neutral' {
  const normalized = status?.toUpperCase();
  if (normalized === 'ACCEPTED' || normalized === 'APPROVED') return 'success';
  if (normalized === 'REJECTED') return 'error';
  if (normalized === 'PENDING' || normalized === 'REQUESTED') return 'warning';
  return 'neutral';
}

function localizedStatus(status: string | undefined, isAr: boolean): string {
  const normalized = status?.toUpperCase();
  if (normalized === 'ACCEPTED') return isAr ? 'مقبول' : 'Accepted';
  if (normalized === 'REJECTED') return isAr ? 'مرفوض' : 'Rejected';
  if (normalized === 'PENDING' || normalized === 'REQUESTED') return isAr ? 'بانتظار' : 'Pending';
  return status ?? '';
}

function formatDate(dateStr: string | undefined, lang: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function sortAppointments(a: Appointment, b: Appointment): number {
  const aDate = `${a.requestedDate ?? ''}T${a.requestedTime ?? '00:00'}`;
  const bDate = `${b.requestedDate ?? ''}T${b.requestedTime ?? '00:00'}`;
  return new Date(aDate).getTime() - new Date(bDate).getTime();
}

export default function StudentHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const loadSession = useAuthStore((s) => s.loadSession);
  const { progress, surahs, isLoading: isLoadingProgress, fetchProgress } = useMemorization();
  const { unreadCount, fetchMessages } = useMessages();
  const { appointments, isLoading: isLoadingAppointments, fetchAppointments } = useAppointments();
  const { grades, isLoading: isLoadingGrades, fetchGrades } = useGrades();

  useEffect(() => {
    fetchProgress();
    fetchAppointments();
    fetchGrades();
    fetchMessages();
  }, [fetchProgress, fetchAppointments, fetchGrades, fetchMessages]);

  const onRefresh = useCallback(() => {
    loadSession();
    fetchProgress();
    fetchAppointments();
    fetchGrades();
    fetchMessages();
  }, [loadSession, fetchProgress, fetchAppointments, fetchGrades, fetchMessages]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const totalAyahs = surahs.reduce((sum, surah) => sum + surah.ayahCount, 0);
  const memorizedAyahs = progress.reduce((sum, entry) => sum + entry.memorizedAyahs, 0);
  const overallPercent = totalAyahs > 0 ? Math.round((memorizedAyahs / totalAyahs) * 100) : 0;
  const completedSurahs = progress.filter((entry) => {
    const surah = surahs.find((candidate) => candidate.id === entry.surahId);
    return surah ? entry.memorizedAyahs >= surah.ayahCount : false;
  }).length;
  const activeEntry = progress.find((entry) => {
    const surah = surahs.find((candidate) => candidate.id === entry.surahId);
    return surah && entry.memorizedAyahs > 0 && entry.memorizedAyahs < surah.ayahCount;
  });
  const activeSurah = activeEntry ? surahs.find((candidate) => candidate.id === activeEntry.surahId) : surahs[0];
  const activePercent =
    activeSurah && activeEntry ? Math.round((activeEntry.memorizedAyahs / activeSurah.ayahCount) * 100) : 0;
  const activeLabel = activeSurah
    ? isAr
      ? activeSurah.nameAr
      : activeSurah.nameEn
    : isAr
      ? 'ابدأ الحفظ'
      : 'Start memorizing';

  const acceptedAppointments = appointments.filter((item) => item.status?.toUpperCase() === 'ACCEPTED');
  const nextSession = [...acceptedAppointments].sort(sortAppointments)[0];
  const pendingAppointments = appointments.filter((item) => {
    const status = item.status?.toUpperCase();
    return status === 'PENDING' || status === 'REQUESTED';
  });
  const teacher = user?.assignedTeacher ?? nextSession?.teacher ?? acceptedAppointments[0]?.teacher ?? null;
  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : '';
  const recentGrades: Grade[] = [...grades]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2);
  const averageGrade =
    grades.length > 0
      ? Math.round(grades.reduce((sum, grade) => sum + gradeNumeric(grade.grade), 0) / grades.length)
      : null;

  const isRefreshing = isLoadingProgress || isLoadingAppointments || isLoadingGrades;

  const quickActions = [
    {
      id: 'session',
      icon: 'calendar-outline' as const,
      title: isAr ? 'حجز موعد' : 'Book session',
      subtitle: isAr ? 'تقويم المعلم' : 'Teacher calendar',
      route: '/student/appointments',
      tone: 'primary',
    },
    {
      id: 'record',
      icon: 'mic-outline' as const,
      title: isAr ? 'تسجيل' : 'Record',
      subtitle: isAr ? 'إرسال تلاوة' : 'Submit recitation',
      route: '/student/recordings',
      tone: 'gold',
    },
    {
      id: 'grades',
      icon: 'bar-chart-outline' as const,
      title: isAr ? 'الدرجات' : 'Grades',
      subtitle: isAr ? 'آخر الملاحظات' : 'Latest feedback',
      route: '/student/grades',
      tone: 'info',
    },
    {
      id: 'reports',
      icon: 'document-text-outline' as const,
      title: isAr ? 'التقارير' : 'Reports',
      subtitle: isAr ? 'تقارير المعلم' : 'Teacher reports',
      route: '/student/reports',
      tone: 'danger',
    },
    {
      id: 'revisions',
      icon: 'book-outline' as const,
      title: isAr ? 'المراجعات' : 'Revisions',
      subtitle: isAr ? 'جدول المراجعة' : 'Revision schedule',
      route: '/student/revisions',
      tone: 'info',
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>{isAr ? 'لوحة الطالب' : 'Student dashboard'}</Text>
            <Text style={styles.title}>
              {isAr ? `مرحباً، ${user?.firstName ?? ''}` : `Hi, ${user?.firstName ?? ''}`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View>
              <IconButton
                colors={COLORS}
                icon="chatbubble-outline"
                accessibilityLabel={isAr ? 'الرسائل' : 'Messages'}
                onPress={() => router.push('/messages')}
              />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </View>
            <IconButton
              colors={COLORS}
              icon="log-out-outline"
              tone="ghost"
              accessibilityLabel={isAr ? 'تسجيل الخروج' : 'Log out'}
              onPress={handleLogout}
              style={styles.logoutButton}
            />
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={styles.heroKicker}>{isAr ? 'اليوم' : 'Today'}</Text>
            <Text style={styles.heroTitle}>
              {nextSession
                ? isAr
                  ? `جلسة المراجعة ${nextSession.requestedTime ?? ''}`
                  : `Review at ${nextSession.requestedTime ?? ''}`
                : isAr
                  ? 'لا توجد جلسة اليوم'
                  : 'No session booked'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {nextSession
                ? `${formatDate(nextSession.requestedDate, i18n.language)} - ${nextSession.durationMinutes ?? 30} ${
                    isAr ? 'دقيقة' : 'min'
                  }`
                : isAr
                  ? 'ابدأ بتسجيل تلاوتك أو احجز موعداً'
                  : 'Record your recitation or book a session'}
            </Text>
          </View>
          <View style={styles.progressRing}>
            <Text style={styles.progressValue}>{overallPercent}%</Text>
          </View>
        </View>

        <AppCard colors={COLORS} style={styles.currentCard}>
          <View style={styles.currentIcon}>
            <Ionicons name="book-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.currentInfo}>
            <Text style={styles.cardLabel}>{isAr ? 'الحفظ الحالي' : 'Current memorization'}</Text>
            <Text style={styles.currentTitle}>{activeLabel}</Text>
            <Text style={styles.currentMeta}>
              {activeEntry && activeSurah
                ? `${activeEntry.memorizedAyahs} / ${activeSurah.ayahCount} ${isAr ? 'آية' : 'ayahs'}`
                : isAr
                  ? 'ابدأ أول سورة'
                  : 'Start your first surah'}
            </Text>
            <ProgressBar colors={COLORS} percent={activePercent} />
          </View>
        </AppCard>

        <View style={styles.metricsRow}>
          <MetricTile colors={COLORS} value={completedSurahs} label={isAr ? 'سورة مكتملة' : 'Completed'} />
          <MetricTile colors={COLORS} value={averageGrade ?? '-'} label={isAr ? 'المتوسط' : 'Average'} tone="gold" />
          <MetricTile
            colors={COLORS}
            value={pendingAppointments.length}
            label={isAr ? 'بانتظار' : 'Pending'}
            tone="warning"
          />
        </View>

        <View style={styles.quickGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              activeOpacity={0.85}
              style={styles.actionTile}
              onPress={() => router.push(action.route as any)}
            >
              <View
                style={[
                  styles.actionIcon,
                  action.tone === 'gold' && styles.actionIconGold,
                  action.tone === 'info' && styles.actionIconInfo,
                  action.tone === 'danger' && styles.actionIconDanger,
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={23}
                  color={
                    action.tone === 'gold'
                      ? COLORS.warning
                      : action.tone === 'info'
                        ? COLORS.info
                        : action.tone === 'danger'
                          ? COLORS.error
                          : COLORS.primary
                  }
                />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title={isAr ? 'معلمك' : 'Your teacher'} colors={COLORS} />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(teacherName ? '/messages' : '/student/teacher-change')}
        >
          <AppCard colors={COLORS} style={styles.teacherCard}>
            {teacherName ? <Avatar colors={COLORS} label={teacherName} /> : <View style={styles.emptyAvatar} />}
            <View style={styles.teacherInfo}>
              <Text style={styles.teacherName}>
                {teacherName || (isAr ? 'لم يتم تعيين معلم' : 'No teacher assigned')}
              </Text>
              <Text style={styles.teacherMeta}>
                {teacherName
                  ? unreadCount > 0
                    ? isAr
                      ? `${unreadCount} رسائل غير مقروءة`
                      : `${unreadCount} unread messages`
                    : isAr
                      ? 'جاهز للمراسلة'
                      : 'Ready to message'
                  : isAr
                    ? 'اطلب تعيين معلم'
                    : 'Request teacher assignment'}
              </Text>
            </View>
            <IconButton
              colors={COLORS}
              icon={teacherName ? 'arrow-forward-outline' : 'person-add-outline'}
              tone="primary"
              accessibilityLabel={
                teacherName ? (isAr ? 'فتح الرسائل' : 'Open messages') : isAr ? 'طلب معلم' : 'Request teacher'
              }
              onPress={() => router.push(teacherName ? '/messages' : '/student/teacher-change')}
              size={38}
            />
          </AppCard>
        </TouchableOpacity>

        <SectionHeader
          title={isAr ? 'الدرجات الأخيرة' : 'Recent grades'}
          actionLabel={isAr ? 'عرض الكل' : 'View all'}
          onActionPress={() => router.push('/student/grades')}
          colors={COLORS}
        />
        {recentGrades.length > 0 ? (
          <View style={styles.listStack}>
            {recentGrades.map((grade) => (
              <AppCard key={grade.id} colors={COLORS} style={styles.gradeRow}>
                <View style={styles.gradeInfo}>
                  <Text style={styles.rowTitle}>
                    {grade.surah
                      ? isAr
                        ? grade.surah.nameAr
                        : grade.surah.nameEn
                      : isAr
                        ? 'تلاوة عامة'
                        : 'Overall Recital'}
                  </Text>
                  <Text style={styles.rowMeta}>{formatDate(grade.createdAt, i18n.language)}</Text>
                </View>
                <StatusPill
                  colors={COLORS}
                  label={grade.grade}
                  status={gradeNumeric(grade.grade) >= 75 ? 'success' : 'warning'}
                />
              </AppCard>
            ))}
          </View>
        ) : (
          <AppCard colors={COLORS}>
            <Text style={styles.emptyLine}>{isAr ? 'لا توجد درجات بعد' : 'No grades yet'}</Text>
          </AppCard>
        )}

        <SectionHeader title={isAr ? 'المواعيد القادمة' : 'Upcoming sessions'} colors={COLORS} />
        <AppCard colors={COLORS} style={styles.sessionCard}>
          <View style={styles.sessionIcon}>
            <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.sessionInfo}>
            <Text style={styles.rowTitle}>
              {nextSession ? (isAr ? 'جلسة مراجعة' : 'Review session') : isAr ? 'لا توجد جلسات' : 'No sessions'}
            </Text>
            <Text style={styles.rowMeta}>
              {nextSession
                ? `${formatDate(nextSession.requestedDate, i18n.language)} - ${nextSession.requestedTime ?? ''}`
                : isAr
                  ? 'احجز موعدك القادم'
                  : 'Book your next appointment'}
            </Text>
          </View>
          {nextSession ? (
            <StatusPill
              colors={COLORS}
              label={localizedStatus(nextSession.status, isAr)}
              status={getStatusTone(nextSession.status)}
            />
          ) : null}
        </AppCard>
      </ScrollView>
      <BottomNav role="student" active="home" />
    </View>
  );
}

const createStyles = (COLORS: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING['3xl'],
      gap: SPACING.lg,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
    eyebrow: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 3,
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 26,
      fontWeight: '800',
      lineHeight: 32,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    logoutButton: {
      backgroundColor: COLORS.primary,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: COLORS.error,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },
    hero: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS['2xl'],
      padding: SPACING.xl,
      minHeight: 128,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      ...SHADOWS.md,
    },
    heroText: {
      flex: 1,
    },
    heroKicker: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 12,
      fontWeight: '700',
      marginBottom: SPACING.xs,
    },
    heroTitle: {
      color: '#FFFFFF',
      fontSize: 21,
      fontWeight: '800',
      lineHeight: 27,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: SPACING.xs,
    },
    progressRing: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 8,
      borderColor: COLORS.gold,
      backgroundColor: 'rgba(255,255,255,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressValue: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    currentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    currentIcon: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryMuted,
    },
    currentInfo: {
      flex: 1,
      gap: 3,
    },
    cardLabel: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '800',
    },
    currentTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    currentMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: SPACING.xs,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.md,
    },
    actionTile: {
      width: '47.8%',
      minHeight: 106,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
      padding: SPACING.lg,
      justifyContent: 'center',
      ...SHADOWS.sm,
    },
    actionIcon: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryMuted,
      marginBottom: SPACING.sm,
    },
    actionIconGold: {
      backgroundColor: COLORS.goldMuted,
    },
    actionIconInfo: {
      backgroundColor: COLORS.infoLight,
    },
    actionIconDanger: {
      backgroundColor: COLORS.errorLight,
    },
    actionTitle: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    actionSubtitle: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    teacherCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    emptyAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: COLORS.primaryMuted,
    },
    teacherInfo: {
      flex: 1,
    },
    teacherName: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    teacherMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    listStack: {
      gap: SPACING.md,
    },
    gradeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    gradeInfo: {
      flex: 1,
    },
    rowTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    rowMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
    },
    emptyLine: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    sessionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    sessionIcon: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryMuted,
    },
    sessionInfo: {
      flex: 1,
    },
  });
