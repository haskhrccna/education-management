import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { parentsApi, type ParentChildReport } from '@/src/api/parents';
import { reportsApi } from '@/src/api';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { AppCard, AppText, EmptyState } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

export default function ChildReportsScreen() {
  const { studentId, studentName } = useLocalSearchParams<{ studentId: string; studentName?: string }>();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);

  const [reports, setReports] = useState<ParentChildReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setError(null);
    try {
      setReports(await parentsApi.getChildReports(studentId));
    } catch (err: any) {
      setError(err?.message ?? t('loadFailed'));
    }
  }, [studentId, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      await reportsApi.downloadReport(id);
    } catch (err: any) {
      Alert.alert(t('error'), err?.message ?? '');
    } finally {
      setDownloadingId(null);
    }
  };

  const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.appBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText variant="titleLarge" style={{ color: COLORS.textPrimary }}>
            {t('parentReportsTitle')}
          </AppText>
          {studentName ? (
            <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
              {studentName}
            </AppText>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={COLORS.primary} />}
      >
        {error ? (
          <TouchableOpacity onPress={load} style={s.errorBanner} accessibilityRole="button">
            <AppText variant="bodyMedium" style={{ color: COLORS.error, textAlign: 'center' }}>
              {error}
            </AppText>
          </TouchableOpacity>
        ) : null}

        {isLoading ? (
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </>
        ) : reports.length === 0 ? (
          <EmptyState colors={COLORS} icon="document-text-outline" title={t('parentNoReportsYet')} />
        ) : (
          reports.map((r) => (
            <AppCard key={r.id} colors={COLORS} style={s.card}>
              <AppText variant="bodyMedium" style={{ color: COLORS.textPrimary }} numberOfLines={3}>
                {r.summary}
              </AppText>
              <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                {new Date(r.generatedAt).toLocaleDateString(dateLocale)}
              </AppText>
              <TouchableOpacity
                accessibilityRole="button"
                style={[s.downloadBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => handleDownload(r.id)}
                disabled={downloadingId === r.id}
              >
                <AppText variant="labelLarge" style={{ color: '#FFFFFF' }}>
                  {t('parentDownloadReport')}
                </AppText>
              </TouchableOpacity>
            </AppCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    appBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
    list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
    card: { gap: 4 },
    downloadBtn: {
      minHeight: 44,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.sm,
    },
    errorBanner: {
      backgroundColor: COLORS.errorLight,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
  });
