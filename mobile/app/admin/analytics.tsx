import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAnalytics } from '@/src/hooks/useAnalytics';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useThemeSettings } from '@/src/settings/store';
import { getColors, RADIUS, SPACING } from '@/constants/theme';
import { AppCard, AppText, EmptyState, MetricTile, ProgressBar, SectionHeader } from '@/src/components/design';
import { BottomNav } from '@/src/components/BottomNav';

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export default function AdminAnalyticsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const lang = i18n.language;
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const { analytics, isLoading, error, fetchAnalytics } = useAnalytics();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
        <AppText variant="headlineSmall" color="#FFFFFF">
          {t('analytics')}
        </AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => fetchAnalytics()} />}
      >
        {error ? (
          <View style={styles.center}>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>
              {error}
            </AppText>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => fetchAnalytics()}
              style={{ marginTop: SPACING.md }}
            >
              <AppText variant="bodyMedium" color={COLORS.primary}>
                {t('retry')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : !analytics ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <>
            <SectionHeader colors={COLORS} title={t('weeklyActiveStudents')} />
            <View style={styles.metrics}>
              <MetricTile
                colors={COLORS}
                value={String(analytics.weeklyActiveStudents.activeCount)}
                label={t('activeStudents')}
                tone="primary"
              />
              <MetricTile
                colors={COLORS}
                value={formatPct(analytics.weeklyActiveStudents.activeRatePct / 100)}
                label={t('activeRate')}
                tone="success"
              />
            </View>

            <SectionHeader colors={COLORS} title={t('surahMissRates')} />
            {analytics.surahMissRates.length === 0 ? (
              <AppText variant="bodyMedium" color={COLORS.textSecondary}>
                {t('noData')}
              </AppText>
            ) : (
              analytics.surahMissRates
                .sort((a, b) => b.missRate - a.missRate)
                .slice(0, 10)
                .map((item) => (
                  <AppCard key={item.surah.id} colors={COLORS} style={{ marginBottom: SPACING.sm }}>
                    <View style={styles.row}>
                      <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ flex: 1 }}>
                        {isRTL ? item.surah.nameAr : item.surah.nameEn}
                      </AppText>
                      <AppText variant="bodySmall" color={COLORS.textMuted}>
                        {item.missCount}/{item.totalAttempts}
                      </AppText>
                    </View>
                    <View style={styles.barWrap}>
                      <View
                        style={[
                          styles.bar,
                          {
                            width: `${Math.min(100, item.missRate * 100)}%`,
                            backgroundColor:
                              item.missRate > 0.5
                                ? COLORS.error
                                : item.missRate > 0.25
                                  ? COLORS.warning
                                  : COLORS.success,
                          },
                        ]}
                      />
                    </View>
                    <AppText
                      variant="bodySmall"
                      color={COLORS.textMuted}
                      style={{ marginTop: SPACING.xs, textAlign: isRTL ? 'left' : 'right' }}
                    >
                      {formatPct(item.missRate)}
                    </AppText>
                  </AppCard>
                ))
            )}

            <SectionHeader colors={COLORS} title={t('teacherLoad')} />
            {analytics.teacherLoad.length === 0 ? (
              <AppText variant="bodyMedium" color={COLORS.textSecondary}>
                {t('noData')}
              </AppText>
            ) : (
              analytics.teacherLoad.map((item) => (
                <TouchableOpacity
                  key={item.teacher.id}
                  onPress={() => router.push(`/admin/user-detail?id=${item.teacher.id}` as any)}
                >
                  <AppCard colors={COLORS} style={{ marginBottom: SPACING.sm }}>
                    <View style={styles.row}>
                      <View style={[styles.avatar, { backgroundColor: COLORS.primaryMuted }]}>
                        <AppText variant="bodyMedium" color={COLORS.primary}>
                          {fullName(item.teacher).charAt(0)}
                        </AppText>
                      </View>
                      <View style={{ flex: 1, marginStart: SPACING.md }}>
                        <AppText variant="titleSmall" color={COLORS.textPrimary}>
                          {fullName(item.teacher)}
                        </AppText>
                        <AppText variant="bodySmall" color={COLORS.textMuted}>
                          {item.teacher.email}
                        </AppText>
                        <View style={styles.teacherMetrics}>
                          <View style={styles.pill}>
                            <AppText variant="bodySmall" color={COLORS.textSecondary}>
                              {t('activeStudents')}: {item.activeStudents}
                            </AppText>
                          </View>
                          <View style={styles.pill}>
                            <AppText variant="bodySmall" color={COLORS.textSecondary}>
                              {t('gradesLast30d')}: {item.gradesLast30d}
                            </AppText>
                          </View>
                          <View style={styles.pill}>
                            <AppText variant="bodySmall" color={COLORS.textSecondary}>
                              {t('sessionsLast30d')}: {item.sessionsLast30d}
                            </AppText>
                          </View>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward-outline" size={20} color={COLORS.textMuted} />
                    </View>
                  </AppCard>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>

      <BottomNav role="admin" active="analytics" />
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
  metrics: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  barWrap: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  bar: { height: '100%', borderRadius: 4 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  pill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.md, backgroundColor: '#F1F5F9' },
});
