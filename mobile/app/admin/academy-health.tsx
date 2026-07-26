import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { AppCard, AppText, EmptyState } from '@/src/components/design';
import { useAcademyHealth } from '@/src/hooks/useAcademyHealth';
import { academyHealthApi, TeacherLoadRow } from '@/src/api/academyHealth';
import { secureStorage } from '@/src/storage/secureStorage';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

interface StatCardProps {
  colors: ThemeColors;
  value: string | number;
  label: string;
  sublabel?: string;
  tone?: 'neutral' | 'warning';
}

/**
 * Board-meeting stat card (AC9.4): one big number + one label, high-contrast
 * (colors.textPrimary — never a low-contrast gray). Deliberately not the
 * shared MetricTile (design.tsx) — that component pins its value at
 * variant="headlineMedium" for dense dashboards; this one-pager wants the
 * largest available variant ("headlineLarge") so it reads from across a room.
 */
function StatCard({ colors, value, label, sublabel, tone = 'neutral' }: StatCardProps) {
  const background = tone === 'warning' ? colors.warningLight : colors.surface;
  const valueColor = tone === 'warning' ? colors.warning : colors.textPrimary;
  return (
    <AppCard colors={colors} style={[styles.statCard, { backgroundColor: background }]}>
      <AppText variant="headlineLarge" color={valueColor}>
        {value}
      </AppText>
      <AppText variant="bodyMedium" color={colors.textSecondary} style={styles.statLabel}>
        {label}
      </AppText>
      {sublabel ? (
        <AppText variant="labelLarge" color={colors.textPrimary} style={styles.statSublabel}>
          {sublabel}
        </AppText>
      ) : null}
    </AppCard>
  );
}

function fullName(row: Pick<TeacherLoadRow, 'firstName' | 'lastName'>): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

export default function AcademyHealthScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const { metrics, isLoading, error, refetch } = useAcademyHealth();

  const handleExportPdf = async () => {
    try {
      const token = (await secureStorage.getItem('auth_token')) ?? '';
      await Linking.openURL(academyHealthApi.exportPdfUrl(token));
    } catch {
      Alert.alert('', t('error'));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.surface, borderBottomColor: COLORS.surfaceAlt }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('goBack')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'} size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <AppText variant="titleLarge" color={COLORS.textPrimary} style={styles.headerTitle}>
          {t('academyHealth')}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl }} color={COLORS.primary} />
      ) : error ? (
        <View style={styles.center}>
          <AppText variant="bodyMedium" color={COLORS.textSecondary}>
            {error}
          </AppText>
          <TouchableOpacity accessibilityRole="button" onPress={() => refetch()} style={{ marginTop: SPACING.md }}>
            <AppText variant="bodyMedium" color={COLORS.primary}>
              {t('retry')}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : !metrics ? (
        <View style={styles.center}>
          <EmptyState colors={COLORS} icon="stats-chart-outline" title={t('noData')} description="" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={COLORS.primary} />
          }
        >
          <View style={styles.grid}>
            <StatCard colors={COLORS} value={metrics.totalStudents} label={t('students')} />
            <StatCard
              colors={COLORS}
              value={metrics.activeThisWeek}
              label={t('activeStudents')}
              sublabel={`${metrics.activeRatePct}% ${t('activeRate')}`}
            />
            <StatCard colors={COLORS} value={metrics.pagesMemorizedThisWeek} label={t('pagesMemorizedThisWeek')} />
            <StatCard colors={COLORS} value={`${metrics.revisionAdherencePct}%`} label={t('revisionAdherence')} />
            <StatCard
              colors={COLORS}
              value={metrics.atRiskCount}
              label={t('atRiskStudents')}
              tone={metrics.atRiskCount > 0 ? 'warning' : 'neutral'}
            />
            <StatCard colors={COLORS} value={`${metrics.completionRatePct}%`} label={t('completionRate')} />
          </View>

          <AppText variant="titleLarge" color={COLORS.textPrimary} style={styles.sectionTitle}>
            {t('teacherLoad')}
          </AppText>
          {metrics.teacherLoad.length === 0 ? (
            <AppCard colors={COLORS}>
              <AppText variant="bodyMedium" color={COLORS.textSecondary}>
                {t('noData')}
              </AppText>
            </AppCard>
          ) : (
            metrics.teacherLoad.map((row) => (
              <AppCard key={row.teacherId} colors={COLORS} style={styles.teacherRow}>
                <AppText variant="titleMedium" color={COLORS.textPrimary} style={{ flex: 1 }}>
                  {fullName(row)}
                </AppText>
                <AppText variant="headlineSmall" color={COLORS.textPrimary}>
                  {row.activeStudents}
                </AppText>
              </AppCard>
            ))
          )}

          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: COLORS.primary }]}
            onPress={handleExportPdf}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('exportPdf')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="document-text-outline" size={20} color={COLORS.textOnPrimary} />
            <AppText variant="titleMedium" color={COLORS.textOnPrimary} style={{ marginStart: SPACING.sm }}>
              {t('exportPdf')}
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    ...SHADOWS.sm,
  },
  backBtn: {
    padding: SPACING.xs,
    marginEnd: SPACING.sm,
  },
  headerTitle: {
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  body: {
    padding: SPACING.lg,
    paddingBottom: SPACING['2xl'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: '47%',
    minHeight: 120,
    justifyContent: 'center',
  },
  statLabel: {
    marginTop: SPACING.xs,
  },
  statSublabel: {
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    marginBottom: SPACING.md,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.lg,
    ...SHADOWS.md,
  },
});
