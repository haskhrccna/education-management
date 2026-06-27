import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useParent } from '@/src/hooks/useParent';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useAuthStore } from '@/src/auth/store';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { AppCard, AppText, EmptyState, MetricTile, ProgressBar, SectionHeader } from '@/src/components/design';
import { BottomNav } from '@/src/components/BottomNav';

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
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const user = useAuthStore((s) => s.user);
  const { children, dashboard, isLoading, error, fetchChildren, selectChild } = useParent();

  const selectedStudentId = dashboard?.student.id;

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
              <AppText
                variant="bodyMedium"
                color={isSelected ? '#FFFFFF' : COLORS.textPrimary}
              >
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
        <AppText variant="headlineSmall" color="#FFFFFF">{t('parentDashboard')}</AppText>
        <TouchableOpacity
          onPress={() => router.push('/parent/link-request')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="add-circle-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchChildren} />}
      >
        {error ? (
          <View style={styles.center}>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>{error}</AppText>
            <TouchableOpacity onPress={fetchChildren} style={{ marginTop: SPACING.md }}>
              <AppText variant="bodyMedium" color={COLORS.primary}>{t('retry')}</AppText>
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
              <AppText variant="bodyMedium" color="#FFFFFF">{t('requestChildLink')}</AppText>
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
                          color={
                            statusTone(dashboard.student.status) === 'success'
                              ? COLORS.success
                              : COLORS.warning
                          }
                        >
                          {dashboard.student.status}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </AppCard>

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
                  <AppText variant="bodyMedium" color={COLORS.textSecondary}>{t('noGradesYet')}</AppText>
                ) : (
                  dashboard.grades.slice(0, 3).map((grade) => (
                    <AppCard key={grade.id} colors={COLORS} style={{ marginBottom: SPACING.sm }}>
                      <View style={styles.row}>
                        <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ flex: 1 }}>
                          {grade.type} — {grade.surah ? (isRTL ? grade.surah.nameAr : grade.surah.nameEn) : t('overallRecital')}
                        </AppText>
                        <AppText variant="titleMedium" color={COLORS.primary}>{grade.grade}</AppText>
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
                          {new Date(`${appt.requestedDate}T${appt.requestedTime}`).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}
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
                  <AppText variant="bodySmall" color={COLORS.primary}>{t('readOnlyNote')}</AppText>
                </View>
              </>
            ) : isLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : null}
          </>
        )}
      </ScrollView>

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
  readOnlyBanner: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
});
