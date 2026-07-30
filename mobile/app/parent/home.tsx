import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useParent } from '@/src/hooks/useParent';
import type { ChildSummary, ChildDashboard } from '@/src/api/parents';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { RADIUS, SPACING } from '@/constants/theme';
import { AppCard, AppText, Avatar, EmptyState, MetricTile, SectionHeader, StatusPill } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';
import { isTodayDate } from '@/src/utils/date';

function fullName(p?: { firstName?: string; lastName?: string }): string {
  return `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || '?';
}

function statusTone(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  const s = status.toUpperCase();
  if (s === 'ACTIVE' || s === 'APPROVED') return 'success';
  if (s === 'PENDING') return 'warning';
  if (s === 'DENIED' || s === 'SUSPENDED') return 'error';
  return 'neutral';
}

function todaysAppointment(dashboard: ChildDashboard) {
  // requestedDate is a full ISO instant over the wire, not a bare YYYY-MM-DD —
  // compare local calendar fields, never string equality.
  return dashboard.upcomingAppointments.find((a) => isTodayDate(a.requestedDate));
}

interface ChildCardProps {
  child: ChildSummary;
  dashboard: ChildDashboard | undefined;
  /** This child's dashboard fetch rejected — say so rather than rendering empty facts. */
  failed: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleDigest: (linkId: string, digestOptOut: boolean) => void;
  onDecideConsent: (linkId: string, granted: boolean) => void;
}

function ChildCard({
  child,
  dashboard,
  failed,
  expanded,
  onToggleExpanded,
  onToggleDigest,
  onDecideConsent,
}: ChildCardProps) {
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const lang = i18n.language;
  const { colors: COLORS } = useTheme();
  const router = useRouter();
  const s = createStyles(COLORS);

  const student = dashboard?.student ?? child.student;
  const todaySession = dashboard ? todaysAppointment(dashboard) : undefined;
  const lastGrade = dashboard?.grades[0];
  const streak = dashboard?.streak;
  const teacher = dashboard?.student.assignedTeacher;

  return (
    <AppCard colors={COLORS} style={s.card}>
      <View style={s.headerRow}>
        <Avatar colors={COLORS} label={fullName(student)} />
        <View style={{ flex: 1 }}>
          <AppText variant="titleMedium" color={COLORS.textPrimary}>
            {fullName(student)}
          </AppText>
          <StatusPill colors={COLORS} label={student.status} status={statusTone(student.status)} />
        </View>
      </View>

      {failed && !dashboard ? (
        <View style={s.factRow}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
          <AppText variant="bodyMedium" color={COLORS.error} style={{ marginStart: SPACING.xs, flex: 1 }}>
            {t('parentDashboardLoadFailed')}
          </AppText>
        </View>
      ) : (
        <>
          <View style={s.factRow}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
            <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.xs }}>
              {todaySession
                ? `${new Date(todaySession.requestedDate).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')} ${todaySession.requestedTime}`
                : t('parentNoSessionToday')}
            </AppText>
          </View>

          {lastGrade ? (
            <View style={s.factRow}>
              <Ionicons name="ribbon-outline" size={16} color={COLORS.textSecondary} />
              <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.xs, flex: 1 }}>
                {t('parentLastGrade')}: {lastGrade.type} — {lastGrade.grade}
              </AppText>
            </View>
          ) : null}

          {streak ? (
            <MetricTile
              colors={COLORS}
              value={streak.currentStreak}
              label={`${t('parentCurrentStreak')} (${t('parentStreakDays')})`}
              tone="gold"
              style={{ marginTop: SPACING.sm, alignSelf: 'flex-start' }}
            />
          ) : null}
        </>
      )}

      <View style={[s.digestRow, { borderTopColor: COLORS.borderSubtle }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium" color={COLORS.textPrimary}>
            {t('weeklyDigest')}
          </AppText>
        </View>
        <Switch
          value={!child.digestOptOut}
          onValueChange={(on) => onToggleDigest(child.linkId, !on)}
          trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
          thumbColor="#fff"
        />
      </View>

      {child.guardianConsentStatus ? (
        <View
          style={[
            s.consentBox,
            { borderColor: child.guardianConsentStatus === 'GRANTED' ? COLORS.success : COLORS.warning },
          ]}
        >
          <View style={s.factRow}>
            <Ionicons
              name="mic-outline"
              size={18}
              color={child.guardianConsentStatus === 'GRANTED' ? COLORS.success : COLORS.warning}
            />
            <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.xs }}>
              {t('recordingConsent')}
            </AppText>
          </View>
          {child.guardianConsentStatus === 'GRANTED' ? (
            <TouchableOpacity onPress={() => onDecideConsent(child.linkId, false)} style={{ marginTop: SPACING.xs }}>
              <AppText variant="bodySmall" color={COLORS.error}>
                {t('withdrawConsent')}
              </AppText>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
              <TouchableOpacity
                onPress={() => onDecideConsent(child.linkId, true)}
                style={[s.consentBtn, { backgroundColor: COLORS.success }]}
              >
                <AppText variant="bodySmall" color="#FFFFFF">
                  {t('grantConsent')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDecideConsent(child.linkId, false)}
                style={[s.consentBtn, { backgroundColor: COLORS.error }]}
              >
                <AppText variant="bodySmall" color="#FFFFFF">
                  {t('declineConsent')}
                </AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      <View style={s.chipRow}>
        <TouchableOpacity
          accessibilityRole="button"
          style={s.chip}
          onPress={() =>
            router.push({
              pathname: '/parent/child-reports',
              params: { studentId: student.id, studentName: fullName(student) },
            })
          }
        >
          <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
          <AppText variant="labelLarge" color={COLORS.primary} style={{ marginStart: 4 }}>
            {t('parentViewReport')}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={s.chip}
          onPress={() =>
            router.push({
              pathname: '/parent/child-recordings',
              params: { studentId: student.id, studentName: fullName(student) },
            })
          }
        >
          <Ionicons name="mic-outline" size={16} color={COLORS.primary} />
          <AppText variant="labelLarge" color={COLORS.primary} style={{ marginStart: 4 }}>
            {t('parentViewRecordings')}
          </AppText>
        </TouchableOpacity>
        {teacher ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={s.chip}
            onPress={() =>
              router.push({
                pathname: '/messages/conversation',
                params: { partnerId: teacher.id, partnerName: fullName(teacher) },
              })
            }
          >
            <Ionicons name="chatbubble-outline" size={16} color={COLORS.primary} />
            <AppText variant="labelLarge" color={COLORS.primary} style={{ marginStart: 4 }}>
              {t('parentSendMessage')}
            </AppText>
          </TouchableOpacity>
        ) : (
          <AppText variant="labelLarge" color={COLORS.textMuted} style={s.chip}>
            {t('parentNoTeacherYet')}
          </AppText>
        )}
      </View>

      <TouchableOpacity accessibilityRole="button" onPress={onToggleExpanded} style={s.expandToggle}>
        <AppText variant="labelLarge" color={COLORS.primary}>
          {expanded ? t('parentLessDetails') : t('parentMoreDetails')}
        </AppText>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
      </TouchableOpacity>

      {expanded && dashboard ? (
        <View style={s.expandedSection}>
          <SectionHeader colors={COLORS} title={t('childProgress')} />
          <View style={s.metrics}>
            <MetricTile
              colors={COLORS}
              value={dashboard.memorization.length}
              label={t('surahsInProgress')}
              tone="primary"
            />
            <MetricTile
              colors={COLORS}
              value={dashboard.attendance.filter((a) => a.status.toUpperCase() === 'PRESENT').length}
              label={t('present')}
              tone="success"
            />
            <MetricTile
              colors={COLORS}
              value={dashboard.attendance.filter((a) => a.status.toUpperCase() === 'ABSENT').length}
              label={t('absent')}
              tone="warning"
            />
          </View>

          {dashboard.grades.length > 0 ? (
            <>
              <SectionHeader colors={COLORS} title={t('childGrades')} />
              {dashboard.grades.slice(0, 3).map((grade) => (
                <View key={grade.id} style={s.factRow}>
                  <AppText variant="bodySmall" color={COLORS.textPrimary} style={{ flex: 1 }}>
                    {grade.type} —{' '}
                    {grade.surah ? (isRTL ? grade.surah.nameAr : grade.surah.nameEn) : t('overallRecital')}
                  </AppText>
                  <AppText variant="labelLarge" color={COLORS.primary}>
                    {grade.grade}
                  </AppText>
                </View>
              ))}
            </>
          ) : null}

          {dashboard.upcomingAppointments.length > 0 ? (
            <>
              <SectionHeader colors={COLORS} title={t('childAppointments')} />
              {dashboard.upcomingAppointments.map((appt) => (
                <View key={appt.id} style={s.factRow}>
                  <AppText variant="bodySmall" color={COLORS.textPrimary}>
                    {new Date(appt.requestedDate).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}{' '}
                    {appt.requestedTime} — {fullName(appt.teacher)}
                  </AppText>
                </View>
              ))}
            </>
          ) : null}

          {dashboard.pendingRevisions.length > 0 ? (
            <>
              <SectionHeader colors={COLORS} title={t('childRevisions')} />
              {dashboard.pendingRevisions.map((rev) => (
                <View key={rev.id} style={s.factRow}>
                  <AppText variant="bodySmall" color={COLORS.textPrimary}>
                    {rev.surah ? (isRTL ? rev.surah.nameAr : rev.surah.nameEn) : t('revision')}
                  </AppText>
                </View>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}

export default function ParentHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);
  const {
    children,
    dashboards,
    dashboardsFailed,
    isLoading,
    dashboardsLoading,
    error,
    fetchChildren,
    toggleDigest,
    decideConsent,
  } = useParent();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[s.header, { backgroundColor: COLORS.primary }]}>
        <AppText variant="headlineSmall" color="#FFFFFF">
          {t('parentDashboard')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push('/parent/link-request')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="add-circle-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchChildren} />}
      >
        {error ? (
          <View style={s.center}>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>
              {error}
            </AppText>
            <TouchableOpacity accessibilityRole="button" onPress={fetchChildren} style={{ marginTop: SPACING.md }}>
              <AppText variant="bodyMedium" color={COLORS.primary}>
                {t('retry')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : children.length === 0 && !isLoading ? (
          <View style={s.empty}>
            <EmptyState
              colors={COLORS}
              icon="people-outline"
              title={t('parentNoChildrenYet')}
              description={t('noChildrenYetDesc')}
            />
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push('/parent/link-request')}
            >
              <AppText variant="bodyMedium" color="#FFFFFF">
                {t('requestChildLink')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : isLoading || dashboardsLoading ? (
          <>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </>
        ) : (
          children.map((child) => (
            <ChildCard
              key={child.linkId}
              child={child}
              dashboard={dashboards[child.student.id]}
              failed={dashboardsFailed.has(child.student.id)}
              expanded={expandedId === child.student.id}
              onToggleExpanded={() => setExpandedId((cur) => (cur === child.student.id ? null : child.student.id))}
              onToggleDigest={toggleDigest}
              onDecideConsent={decideConsent}
            />
          ))
        )}
      </ScrollView>

      <SectionHeader colors={COLORS} title={t('achievements')} />
      <View style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md, paddingHorizontal: SPACING.md }}>
        <TouchableOpacity
          style={[s.shortcutTile, { backgroundColor: COLORS.surface }]}
          onPress={() => router.push('/student/gamification')}
        >
          <Ionicons name="trophy-outline" size={28} color={COLORS.primary} />
          <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginTop: SPACING.xs }}>
            {t('gamification')}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.shortcutTile, { backgroundColor: COLORS.surface }]}
          onPress={() => router.push('/student/certificates')}
        >
          <Ionicons name="document-text-outline" size={28} color={COLORS.success} />
          <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginTop: SPACING.xs }}>
            {t('certificates')}
          </AppText>
        </TouchableOpacity>
      </View>
      <BottomNav role="parent" active="home" />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
      borderBottomLeftRadius: RADIUS.lg,
      borderBottomRightRadius: RADIUS.lg,
    },
    body: { padding: SPACING.md, paddingBottom: SPACING['2xl'], gap: SPACING.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
    actionBtn: {
      marginTop: SPACING.lg,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    card: { gap: SPACING.xs },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    factRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs },
    digestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    consentBox: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      marginTop: SPACING.sm,
    },
    consentBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center', minHeight: 44 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      paddingHorizontal: SPACING.sm,
    },
    expandToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: 44,
      marginTop: SPACING.xs,
    },
    expandedSection: {
      marginTop: SPACING.xs,
      paddingTop: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.borderSubtle,
      gap: SPACING.xs,
    },
    metrics: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
    shortcutTile: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
    },
  });
