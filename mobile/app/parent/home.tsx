import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useParent } from '@/src/hooks/useParent';
import { mushafPagesApi, type PageMemorizationRow } from '@/src/api/mushafPages';
import { derivePageProgress } from '@/src/hooks/useMushafPages';
import { revisionQueueApi, type RevisionQueueResult } from '@/src/api/revisionQueue';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useAuthStore } from '@/src/auth/store';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { AppCard, AppText, EmptyState, MetricTile, ProgressBar, SectionHeader } from '@/src/components/design';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme } from '@/src/hooks/useTheme';

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

export default function ParentHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const lang = i18n.language;
  const isAr = lang === 'ar';
  const { colors: COLORS } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { children, dashboard, isLoading, error, fetchChildren, selectChild, toggleDigest, decideConsent } =
    useParent();

  const selectedStudentId = dashboard?.student.id;
  const selectedChild = children.find((c) => c.student.id === selectedStudentId);

  // Page-level hifz progress for the selected child (F1) — 403-tolerant
  // (a pending link simply hides the line).
  const [childPages, setChildPages] = useState<PageMemorizationRow[]>([]);
  const [childQueue, setChildQueue] = useState<RevisionQueueResult | null>(null);
  const childId = dashboard?.student.id;
  useEffect(() => {
    let active = true;
    if (!childId) {
      setChildPages([]);
      setChildQueue(null);
      return;
    }
    mushafPagesApi
      .getMyPages(childId)
      .then((rows) => {
        if (active) setChildPages(rows);
      })
      .catch(() => {
        if (active) setChildPages([]);
      });
    revisionQueueApi
      .getQueue(childId)
      .then((q) => {
        if (active) setChildQueue(q);
      })
      .catch(() => {
        if (active) setChildQueue(null);
      });
    return () => {
      active = false;
    };
  }, [childId]);
  const childProgress = derivePageProgress(childPages);

  const renderChildSelector = () => {
    if (children.length <= 1) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.selector}
        style={{ marginBottom: SPACING.md }}
      >
        {children.map((child) => {
          const isSelected = child.student.id === selectedStudentId;
          return (
            <TouchableOpacity
              key={child.student.id}
              onPress={() => selectChild(child.student.id)}
              style={[
                styles.childChip,
                {
                  backgroundColor: isSelected ? COLORS.primary : COLORS.surface,
                  borderColor: COLORS.borderSubtle,
                },
              ]}
            >
              <AppText variant="bodyMedium" color={isSelected ? '#FFFFFF' : COLORS.textPrimary}>
                {fullName(child.student)}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
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
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchChildren} />}
      >
        {error ? (
          <View style={styles.center}>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>
              {error}
            </AppText>
            <TouchableOpacity accessibilityRole="button" onPress={fetchChildren} style={{ marginTop: SPACING.md }}>
              <AppText variant="bodyMedium" color={COLORS.primary}>
                {t('retry')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : children.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              colors={COLORS}
              icon="people-outline"
              title={t('noChildrenYet')}
              description={t('noChildrenYetDesc')}
            />
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push('/parent/link-request')}
            >
              <AppText variant="bodyMedium" color="#FFFFFF">
                {t('requestChildLink')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {renderChildSelector()}
            {dashboard ? (
              <>
                <AppCard colors={COLORS}>
                  <View style={styles.row}>
                    <View style={[styles.avatar, { backgroundColor: COLORS.primaryMuted }]}>
                      <AppText variant="headlineMedium" color={COLORS.primary}>
                        {fullName(dashboard.student).charAt(0)}
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="titleMedium" color={COLORS.textPrimary}>
                        {fullName(dashboard.student)}
                      </AppText>
                      <AppText variant="bodySmall" color={COLORS.textSecondary}>
                        {dashboard.student.email}
                      </AppText>
                      <AppText variant="bodySmall" color={COLORS.textSecondary}>
                        {t('pagesMemorized')}: {childProgress.memorized} / 604 ({childProgress.pct}%)
                      </AppText>
                      {childQueue ? (
                        <AppText variant="bodySmall" color={COLORS.textSecondary}>
                          {t('revisionAdherence')}: {childQueue.reviewedThisWeek} {t('reviewedThisWeek')} ·{' '}
                          {childQueue.items.length} {t('dueToday')}
                        </AppText>
                      ) : null}
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              statusTone(dashboard.student.status) === 'success'
                                ? COLORS.successLight
                                : COLORS.warningLight,
                          },
                        ]}
                      >
                        <AppText
                          variant="bodySmall"
                          color={statusTone(dashboard.student.status) === 'success' ? COLORS.success : COLORS.warning}
                        >
                          {dashboard.student.status}
                        </AppText>
                      </View>
                    </View>
                  </View>
                  {selectedChild ? (
                    <View style={[styles.digestRow, { borderTopColor: COLORS.borderSubtle }]}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyMedium" color={COLORS.textPrimary}>
                          {isAr ? 'ملخص أسبوعي بالبريد' : 'Weekly email digest'}
                        </AppText>
                        <AppText variant="bodySmall" color={COLORS.textSecondary}>
                          {isAr
                            ? 'ملخص أسبوعي عن حضور وتقدم هذا الطالب'
                            : "A weekly summary of this child's attendance and progress"}
                        </AppText>
                      </View>
                      <Switch
                        value={!selectedChild.digestOptOut}
                        onValueChange={(on) => toggleDigest(selectedChild.linkId, !on)}
                        trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
                        thumbColor="#fff"
                      />
                    </View>
                  ) : null}
                </AppCard>

                {selectedChild?.guardianConsentStatus ? (
                  <AppCard
                    colors={COLORS}
                    style={{
                      marginTop: SPACING.sm,
                      borderWidth: 1,
                      borderColor: selectedChild.guardianConsentStatus === 'GRANTED' ? COLORS.success : COLORS.warning,
                    }}
                  >
                    <View style={styles.row}>
                      <Ionicons
                        name="mic-outline"
                        size={20}
                        color={selectedChild.guardianConsentStatus === 'GRANTED' ? COLORS.success : COLORS.warning}
                      />
                      <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.sm }}>
                        {isAr ? 'الموافقة على تسجيل التلاوة' : 'Consent to record recitations'}
                      </AppText>
                    </View>
                    <AppText variant="bodySmall" color={COLORS.textSecondary} style={{ marginTop: SPACING.xs }}>
                      {isAr
                        ? 'يستخدم التطبيق تسجيلات صوتية لمراجعة التلاوة. اختياركم مطلوب قبل رفع أي تسجيل لهذا الطالب.'
                        : 'The app collects voice recordings to review recitation. Your choice is required before any recording can be uploaded for this child.'}
                    </AppText>
                    {selectedChild.guardianConsentStatus === 'GRANTED' ? (
                      <TouchableOpacity
                        style={{ marginTop: SPACING.sm }}
                        onPress={() => decideConsent(selectedChild.linkId, false)}
                      >
                        <AppText variant="bodySmall" color={COLORS.error}>
                          {isAr ? 'سحب الموافقة' : 'Withdraw consent'}
                        </AppText>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.actions, { marginTop: SPACING.sm }]}>
                        <TouchableOpacity
                          style={[styles.action, { backgroundColor: COLORS.success, flex: 1 }]}
                          onPress={() => decideConsent(selectedChild.linkId, true)}
                        >
                          <AppText variant="bodySmall" color="#FFFFFF">
                            {isAr ? 'موافق' : 'Grant consent'}
                          </AppText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.action, { backgroundColor: COLORS.error, flex: 1 }]}
                          onPress={() => decideConsent(selectedChild.linkId, false)}
                        >
                          <AppText variant="bodySmall" color="#FFFFFF">
                            {isAr ? 'رفض' : 'Decline'}
                          </AppText>
                        </TouchableOpacity>
                      </View>
                    )}
                  </AppCard>
                ) : null}

                <SectionHeader colors={COLORS} title={t('childProgress')} />
                <View style={styles.metrics}>
                  <MetricTile
                    colors={COLORS}
                    value={dashboard.memorization.length.toString()}
                    label={t('surahsInProgress')}
                    tone="primary"
                  />
                  <MetricTile
                    colors={COLORS}
                    value={dashboard.grades.length.toString()}
                    label={t('recentGrades')}
                    tone="gold"
                  />
                </View>

                <SectionHeader colors={COLORS} title={t('childGrades')} />
                {dashboard.grades.length === 0 ? (
                  <AppText variant="bodyMedium" color={COLORS.textSecondary}>
                    {t('noGradesYet')}
                  </AppText>
                ) : (
                  dashboard.grades.slice(0, 3).map((grade) => (
                    <AppCard key={grade.id} colors={COLORS} style={{ marginBottom: SPACING.sm }}>
                      <View style={styles.row}>
                        <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ flex: 1 }}>
                          {grade.type} —{' '}
                          {grade.surah ? (isRTL ? grade.surah.nameAr : grade.surah.nameEn) : t('overallRecital')}
                        </AppText>
                        <AppText variant="titleMedium" color={COLORS.primary}>
                          {grade.grade}
                        </AppText>
                      </View>
                    </AppCard>
                  ))
                )}

                <SectionHeader colors={COLORS} title={t('childAttendance')} />
                <View style={styles.metrics}>
                  <MetricTile
                    colors={COLORS}
                    value={dashboard.attendance.filter((a) => a.status.toUpperCase() === 'PRESENT').length.toString()}
                    label={t('present')}
                    tone="success"
                  />
                  <MetricTile
                    colors={COLORS}
                    value={dashboard.attendance.filter((a) => a.status.toUpperCase() === 'ABSENT').length.toString()}
                    label={t('absent')}
                    tone="warning"
                  />
                </View>

                {dashboard.upcomingAppointments.length > 0 && (
                  <>
                    <SectionHeader colors={COLORS} title={t('childAppointments')} />
                    {dashboard.upcomingAppointments.map((appt) => (
                      <AppCard key={appt.id} colors={COLORS} style={{ marginBottom: SPACING.sm }}>
                        <AppText variant="bodyMedium" color={COLORS.textPrimary}>
                          {new Date(`${appt.requestedDate}T${appt.requestedTime}`).toLocaleString(
                            lang === 'ar' ? 'ar-SA' : 'en-US'
                          )}
                        </AppText>
                        <AppText variant="bodySmall" color={COLORS.textSecondary}>
                          {t('teacher')}: {fullName(appt.teacher)}
                        </AppText>
                      </AppCard>
                    ))}
                  </>
                )}

                {dashboard.pendingRevisions.length > 0 && (
                  <>
                    <SectionHeader colors={COLORS} title={t('childRevisions')} />
                    {dashboard.pendingRevisions.map((rev) => (
                      <AppCard key={rev.id} colors={COLORS} style={{ marginBottom: SPACING.sm }}>
                        <AppText variant="bodyMedium" color={COLORS.textPrimary}>
                          {rev.surah ? (isRTL ? rev.surah.nameAr : rev.surah.nameEn) : t('revision')}
                        </AppText>
                        <AppText variant="bodySmall" color={COLORS.textSecondary}>
                          {new Date(rev.scheduledFor).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                        </AppText>
                      </AppCard>
                    ))}
                  </>
                )}

                <View style={[styles.readOnlyBanner, { backgroundColor: COLORS.primaryMuted }]}>
                  <AppText variant="bodySmall" color={COLORS.primary}>
                    {t('readOnlyNote')}
                  </AppText>
                </View>
              </>
            ) : isLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : null}
          </>
        )}
      </ScrollView>

      <SectionHeader colors={COLORS} title={t('achievements')} />
      <View style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md }}>
        <TouchableOpacity
          style={[styles.childChip, { backgroundColor: COLORS.surface, flex: 1, alignItems: 'center' }]}
          onPress={() => router.push('/student/gamification')}
        >
          <Ionicons name="trophy-outline" size={28} color={COLORS.primary} />
          <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginTop: SPACING.xs }}>
            {t('gamification')}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.childChip, { backgroundColor: COLORS.surface, flex: 1, alignItems: 'center' }]}
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

const styles = StyleSheet.create({
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
  body: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  actionBtn: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  selector: { paddingVertical: SPACING.sm, gap: SPACING.sm },
  childChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginEnd: SPACING.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  action: { paddingVertical: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: SPACING.md,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
  },
  metrics: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  digestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  readOnlyBanner: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
});
