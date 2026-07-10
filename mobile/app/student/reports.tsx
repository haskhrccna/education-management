import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { Ionicons } from '@expo/vector-icons';
import { reportsApi, Report } from '@/src/api';
import { SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/src/hooks/useTheme';
function parsePeriod(summary: string): { period: string | null; notes: string } {
  const match = summary.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (match) return { period: match[1].trim(), notes: match[2].trim() };
  return { period: null, notes: summary };
}

export default function StudentReportsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setError(null);
    try {
      const data = await reportsApi.getReports();
      setReports(data);
    } catch (err: any) {
      setError(err?.message ?? t('loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    setIsLoading(true);
    fetchReports().finally(() => setIsLoading(false));
  }, [fetchReports]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchReports();
    setIsRefreshing(false);
  }, [fetchReports]);

  const handleDownload = async (reportId: string) => {
    setDownloadingId(reportId);
    try {
      await reportsApi.downloadReport(reportId);
    } catch (err: any) {
      Alert.alert(t('failedToDownloadReport'), err?.response?.data?.message ?? err?.message ?? '');
    } finally {
      setDownloadingId(null);
    }
  };

  const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
            style={styles.backText}
          />
        </TouchableOpacity>
        <Text style={styles.title}>{t('reports')}</Text>
        <Text style={styles.subtitle}>
          {reports.length} {t('reports')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: COLORS.error, marginBottom: SPACING.md }}>{error}</Text>
            <TouchableOpacity onPress={onRefresh}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40, marginBottom: SPACING.md }}>📑</Text>
            <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>{t('noReports')}</Text>
            <Text style={[styles.emptyDesc, { color: COLORS.textSecondary }]}>{t('noReportsDesc')}</Text>
          </View>
        ) : (
          reports.map((r) => {
            const { period, notes } = parsePeriod(r.summary);
            const dateStr = new Date(r.generatedAt).toLocaleDateString(dateLocale, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            return (
              <View key={r.id} style={[styles.card, { backgroundColor: COLORS.surface }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    {period ? (
                      <View style={[styles.periodBadge, { backgroundColor: COLORS.primaryMuted }]}>
                        <Text style={[styles.periodText, { color: COLORS.primary }]}>{period}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.dateLarge, { color: COLORS.textPrimary }]}>{dateStr}</Text>
                    )}
                    {period && (
                      <Text style={[styles.dateText, { color: COLORS.textSecondary, marginTop: SPACING.xs }]}>
                        {dateStr}
                      </Text>
                    )}
                  </View>
                </View>
                {notes.length > 0 && (
                  <Text
                    style={[
                      styles.notesPreview,
                      {
                        color: COLORS.textPrimary,
                        textAlign: isRTL ? 'right' : 'left',
                        writingDirection: isRTL ? 'rtl' : 'ltr',
                      },
                    ]}
                    numberOfLines={4}
                  >
                    {notes}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: COLORS.primary }]}
                  onPress={() => handleDownload(r.id)}
                  disabled={downloadingId === r.id}
                  activeOpacity={0.85}
                >
                  {downloadingId === r.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.downloadText}>⤓ {t('downloadReport')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    header: {
      padding: SPACING.xl,
      paddingTop: SPACING.lg,
      borderBottomLeftRadius: RADIUS['2xl'],
      borderBottomRightRadius: RADIUS['2xl'],
      ...SHADOWS.lg,
    },
    backText: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: SPACING.sm },
    title: { fontSize: 22, fontWeight: '800', color: '#fff' },
    subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: SPACING.xs },
    scroll: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: SPACING['3xl'] },
    card: { borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOWS.sm, gap: SPACING.sm },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
    dateLarge: { fontSize: 16, fontWeight: '700' },
    periodBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: SPACING.md,
      paddingVertical: 4,
      borderRadius: RADIUS.sm,
    },
    periodText: { fontSize: 12, fontWeight: '700' },
    dateText: { fontSize: 12 },
    notesPreview: { fontSize: 14, lineHeight: 20 },
    downloadBtn: {
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    downloadText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING['3xl'],
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.xs },
    emptyDesc: { fontSize: 14, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  });
