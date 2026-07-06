import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { memorizationApi, MemorizationEntry, getRecordingStatus } from '@/src/api';
import { useAuthStore } from '@/src/auth/store';
import { useAppointments } from '@/src/hooks/useAppointments';
import { useMessages } from '@/src/hooks/useMessages';
import { useRecordings } from '@/src/hooks/useRecordings';
import { useRosterHealth } from '@/src/hooks/useRosterHealth';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';
import type { AtRiskReason } from '@/src/api';
import { useThemeSettings } from '@/src/settings/store';
import { useNotifications } from '@/src/hooks/useNotifications';
import {
  AppCard,
  Avatar,
  EmptyState,
  IconButton,
  MetricTile,
  ProgressBar,
  SectionHeader,
  StatusPill,
} from '@/src/components/design';
import { BottomNav } from '@/src/components/BottomNav';
import type { Appointment } from '@/src/api';

type ProgressSummary = { label: string; percent: number | null };

function summarizeProgress(entries: MemorizationEntry[], isAr: boolean): ProgressSummary {
  const active =
    entries.find((entry) => entry.memorizedAyahs > 0 && entry.memorizedAyahs < entry.surah.ayahCount) ?? entries[0];
  if (!active) return { label: isAr ? 'لم يبدأ بعد' : 'Not started', percent: null };
  const percent = active.surah.ayahCount > 0 ? Math.round((active.memorizedAyahs / active.surah.ayahCount) * 100) : 0;
  return { label: isAr ? active.surah.nameAr : active.surah.nameEn, percent };
}

function fullName(person?: { firstName?: string; lastName?: string } | null): string {
  return `${person?.firstName ?? ''} ${person?.lastName ?? ''}`.trim() || '?';
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

function isPendingAppointment(appointment: Appointment): boolean {
  const status = appointment.status?.toUpperCase();
  return status === 'PENDING' || status === 'REQUESTED';
}

function atRiskReasonLabel(reason: AtRiskReason, isAr: boolean): string {
  switch (reason) {
    case 'MISSED_SESSIONS':
      return isAr ? 'غياب متكرر' : 'Missed sessions';
    case 'STREAK_BROKEN':
      return isAr ? 'انقطعت المتابعة' : 'Streak broken';
    case 'GRADE_GAP':
      return isAr ? 'لا تقييم حديث' : 'No recent grade';
  }
}

export default function TeacherHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const logout = useAuthStore((s) => s.logout);
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  const { appointments, isLoading: isLoadingAppointments, fetchAppointments } = useAppointments();
  const { unreadCount, fetchMessages } = useMessages();
  const { requests: changeRequests, fetchRequests } = useTeacherChange();
  const { recordings, loading: isLoadingRecordings, refresh: refreshRecordings } = useRecordings();
  const { atRisk: atRiskStudents, refetch: refetchRoster } = useRosterHealth();
  const [progressByStudent, setProgressByStudent] = useState<Record<string, ProgressSummary>>({});

  const pendingAppointments = useMemo(() => appointments.filter(isPendingAppointment), [appointments]);
  const acceptedAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status?.toUpperCase() === 'ACCEPTED'),
    [appointments]
  );
  const students = useMemo(() => {
    const byId = new Map<string, NonNullable<Appointment['student']>>();
    acceptedAppointments.forEach((appointment) => {
      if (appointment.student?.id) byId.set(appointment.student.id, appointment.student);
    });
    return Array.from(byId.values());
  }, [acceptedAppointments]);
  const pendingChanges = changeRequests.filter((request: any) => request.status === 'PENDING');
  const pendingRecordings = recordings.filter((recording) => getRecordingStatus(recording) === 'PENDING');

  const refreshAll = useCallback(() => {
    fetchAppointments();
    fetchMessages();
    fetchRequests();
    refreshRecordings();
    refetchRoster();
  }, [fetchAppointments, fetchMessages, fetchRequests, refreshRecordings, refetchRoster]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const studentIds = students.map((student) => student.id).filter(Boolean);
    if (studentIds.length === 0) {
      setProgressByStudent({});
      return;
    }

    let mounted = true;
    Promise.all(
      studentIds.map(async (id) => ({
        id,
        progress: summarizeProgress(await memorizationApi.getStudentProgress(id), isAr),
      }))
    )
      .then((results) => {
        if (!mounted) return;
        setProgressByStudent(
          results.reduce<Record<string, ProgressSummary>>((acc, item) => {
            acc[item.id] = item.progress;
            return acc;
          }, {})
        );
      })
      .catch(() => {
        if (mounted) setProgressByStudent({});
      });

    return () => {
      mounted = false;
    };
  }, [students, isAr]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const isRefreshing = isLoadingAppointments || isLoadingRecordings;
  const priorityAppointments = pendingAppointments.slice(0, 2);
  const priorityRecordings = pendingRecordings.slice(0, 2);

  const actionTiles = [
    {
      id: 'requests',
      title: isAr ? 'الطلبات' : 'Requests',
      subtitle: isAr ? 'إدارة المواعيد' : 'Manage sessions',
      icon: 'calendar-outline' as const,
      route: '/teacher/appointments',
      tone: 'primary',
    },
    {
      id: 'grade',
      title: isAr ? 'منح درجة' : 'Give grade',
      subtitle: isAr ? 'تقييم سريع' : 'Quick assessment',
      icon: 'create-outline' as const,
      route: '/teacher/grade-form',
      tone: 'gold',
    },
    {
      id: 'reviews',
      title: isAr ? 'المراجعات' : 'Reviews',
      subtitle: isAr ? 'تسجيلات الطلاب' : 'Student recordings',
      icon: 'mic-outline' as const,
      route: '/teacher/recordings',
      tone: 'info',
    },
    {
      id: 'reports',
      title: isAr ? 'التقارير' : 'Reports',
      subtitle: isAr ? 'تقدم الطلاب' : 'Student progress',
      icon: 'document-text-outline' as const,
      route: '/teacher/reports',
      tone: 'danger',
    },
    {
      id: 'revisions',
      title: isAr ? 'المراجعات' : 'Revisions',
      subtitle: isAr ? 'جدول المراجعة' : 'Revision schedule',
      icon: 'book-outline' as const,
      route: '/teacher/revisions',
      tone: 'info',
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} tintColor={COLORS.primary} />}
      >
        <View style={styles.topCard}>
          <View>
            <Text style={styles.eyebrow}>{isAr ? 'مساحة المعلم' : 'Teacher workspace'}</Text>
            <Text style={styles.title}>{isAr ? 'التدريس' : 'Teaching'}</Text>
            <Text style={styles.subtitle}>
              {isAr
                ? `${pendingAppointments.length + pendingChanges.length + pendingRecordings.length} عناصر تحتاج قراراً`
                : `${pendingAppointments.length + pendingChanges.length + pendingRecordings.length} items need attention`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View>
              <TouchableOpacity onPress={() => router.push('/notifications')} style={{ marginEnd: SPACING.md }}>
                <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
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
              tone="primary"
              accessibilityLabel={isAr ? 'تسجيل الخروج' : 'Log out'}
              onPress={handleLogout}
            />
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricTile colors={COLORS} value={students.length} label={isAr ? 'طلاب' : 'Students'} />
          <MetricTile
            colors={COLORS}
            value={pendingAppointments.length + pendingChanges.length}
            label={isAr ? 'طلبات' : 'Pending'}
            tone="gold"
          />
          <MetricTile
            colors={COLORS}
            value={pendingRecordings.length}
            label={isAr ? 'تسجيلات' : 'Reviews'}
            tone="info"
          />
        </View>

        <View style={styles.quickGrid}>
          {actionTiles.map((action) => (
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
                  size={22}
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

        <SectionHeader title={isAr ? 'قائمة الأولويات' : 'Priority queue'} colors={COLORS} />
        {priorityAppointments.length === 0 && priorityRecordings.length === 0 && pendingChanges.length === 0 ? (
          <AppCard colors={COLORS}>
            <EmptyState
              colors={COLORS}
              icon="checkmark-circle-outline"
              title={isAr ? 'لا توجد عناصر عاجلة' : 'No urgent items'}
              description={isAr ? 'كل شيء مستقر حالياً.' : 'Everything is clear for now.'}
            />
          </AppCard>
        ) : (
          <View style={styles.listStack}>
            {priorityAppointments.map((appointment) => {
              const name = fullName(appointment.student);
              return (
                <TouchableOpacity
                  key={appointment.id}
                  activeOpacity={0.85}
                  onPress={() => router.push('/teacher/appointments')}
                >
                  <AppCard colors={COLORS} style={styles.queueCard}>
                    <Avatar colors={COLORS} label={name} />
                    <View style={styles.queueInfo}>
                      <Text style={styles.rowTitle}>{isAr ? `${name} طلب موعداً` : `${name} requested a session`}</Text>
                      <Text style={styles.rowMeta}>
                        {formatDate(appointment.requestedDate, i18n.language)} - {appointment.requestedTime ?? ''}
                      </Text>
                      <View style={styles.pillRow}>
                        <StatusPill colors={COLORS} label={isAr ? 'مراجعة' : 'Review'} status="warning" />
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </AppCard>
                </TouchableOpacity>
              );
            })}

            {priorityRecordings.map((recording) => {
              const name = fullName(recording.student);
              return (
                <TouchableOpacity
                  key={recording.id}
                  activeOpacity={0.85}
                  onPress={() => router.push('/teacher/recordings')}
                >
                  <AppCard colors={COLORS} style={styles.queueCard}>
                    <View style={styles.recordingIcon}>
                      <Ionicons name="mic-outline" size={22} color={COLORS.info} />
                    </View>
                    <View style={styles.queueInfo}>
                      <Text style={styles.rowTitle}>{isAr ? 'تسجيل جديد للمراجعة' : 'New recitation to review'}</Text>
                      <Text style={styles.rowMeta}>
                        {name} - {recording.fileName}
                      </Text>
                      <StatusPill colors={COLORS} label={isAr ? 'مراجعة الآن' : 'Review now'} status="info" />
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </AppCard>
                </TouchableOpacity>
              );
            })}

            {pendingChanges.slice(0, 1).map((request: any) => {
              const name = fullName(request.student);
              return (
                <TouchableOpacity
                  key={request.id}
                  activeOpacity={0.85}
                  onPress={() => router.push('/teacher/appointments')}
                >
                  <AppCard colors={COLORS} style={styles.queueCard}>
                    <View style={styles.changeIcon}>
                      <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.warning} />
                    </View>
                    <View style={styles.queueInfo}>
                      <Text style={styles.rowTitle}>{name}</Text>
                      <Text style={styles.rowMeta}>{isAr ? 'طلب تغيير معلم' : 'Teacher change request'}</Text>
                    </View>
                    <StatusPill colors={COLORS} label={isAr ? 'بانتظار' : 'Pending'} status="warning" />
                  </AppCard>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <SectionHeader
          title={isAr ? 'طلاب يحتاجون متابعة' : 'Students needing attention'}
          actionLabel={isAr ? 'عرض الكل' : 'View all'}
          onActionPress={() => router.push('/teacher/appointments')}
          colors={COLORS}
        />
        {atRiskStudents.length > 0 ? (
          <View style={styles.listStack}>
            {atRiskStudents.slice(0, 5).map((row) => {
              const name = `${row.firstName} ${row.lastName}`.trim();
              return (
                <TouchableOpacity
                  key={row.studentId}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push(`/teacher/student-detail?id=${row.studentId}&name=${encodeURIComponent(name)}`)
                  }
                >
                  <AppCard colors={COLORS} style={styles.studentCard}>
                    <Avatar colors={COLORS} label={name} size={38} />
                    <View style={styles.studentInfo}>
                      <Text style={styles.rowTitle}>{name}</Text>
                      <View style={styles.pillRow}>
                        {row.reasons.map((reason) => (
                          <StatusPill
                            key={reason}
                            colors={COLORS}
                            label={atRiskReasonLabel(reason, isAr)}
                            status="warning"
                          />
                        ))}
                      </View>
                    </View>
                  </AppCard>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : students.length > 0 ? (
          <View style={styles.listStack}>
            {students.slice(0, 5).map((student, index) => {
              const name = fullName(student);
              const progress = progressByStudent[student.id];
              const tone = index % 2 === 0 ? 'primary' : 'gold';
              return (
                <TouchableOpacity
                  key={student.id}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push(`/teacher/student-detail?id=${student.id}&name=${encodeURIComponent(name)}`)
                  }
                >
                  <AppCard colors={COLORS} style={styles.studentCard}>
                    <Avatar colors={COLORS} label={name} size={38} />
                    <View style={styles.studentInfo}>
                      <View style={styles.studentTop}>
                        <Text style={styles.rowTitle}>{name}</Text>
                        {progress?.percent != null ? <Text style={styles.percentText}>{progress.percent}%</Text> : null}
                      </View>
                      <Text style={styles.rowMeta}>
                        {progress?.label ?? (isAr ? 'جار تحميل التقدم' : 'Loading progress')}
                      </Text>
                      {progress?.percent != null ? (
                        <ProgressBar
                          colors={COLORS}
                          percent={progress.percent}
                          tone={tone === 'gold' ? 'gold' : 'primary'}
                        />
                      ) : null}
                    </View>
                  </AppCard>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <AppCard colors={COLORS}>
            <EmptyState
              colors={COLORS}
              icon="people-outline"
              title={isAr ? 'لا يوجد طلاب بعد' : 'No students yet'}
              description={
                isAr ? 'سيظهر الطلاب بعد قبول المواعيد.' : 'Students appear here after sessions are accepted.'
              }
            />
          </AppCard>
        )}
      </ScrollView>
      <BottomNav role="teacher" active="home" />
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
    topCard: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS['2xl'],
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.darkMode ? COLORS.divider : '#E7ECE6',
      padding: SPACING.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
      ...SHADOWS.md,
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
    subtitle: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
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
      minHeight: 104,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.darkMode ? COLORS.divider : '#E7ECE6',
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
    listStack: {
      gap: SPACING.md,
    },
    queueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    queueInfo: {
      flex: 1,
      gap: 5,
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
    },
    pillRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    recordingIcon: {
      width: 42,
      height: 42,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.infoLight,
    },
    changeIcon: {
      width: 42,
      height: 42,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.warningLight,
    },
    studentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    studentInfo: {
      flex: 1,
      gap: 5,
    },
    studentTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
    percentText: {
      color: COLORS.primary,
      fontSize: 13,
      fontWeight: '800',
    },
  });
