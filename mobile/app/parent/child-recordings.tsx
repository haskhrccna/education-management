import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { parentsApi, type ParentChildRecording } from '@/src/api/parents';
import { recordingsApi } from '@/src/api';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { AppCard, AppText, EmptyState, StatusPill } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

function recordingTone(r: ParentChildRecording): 'success' | 'error' | 'warning' {
  if (r.approvedAt) return 'success';
  if (r.rejectedAt) return 'error';
  return 'warning';
}

function recordingLabelKey(r: ParentChildRecording): string {
  if (r.approvedAt) return 'parentRecordingApproved';
  if (r.rejectedAt) return 'parentRecordingRejected';
  return 'parentRecordingPending';
}

export default function ChildRecordingsScreen() {
  const { studentId, studentName } = useLocalSearchParams<{ studentId: string; studentName?: string }>();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);

  const [recordings, setRecordings] = useState<ParentChildRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setError(null);
    try {
      setRecordings(await parentsApi.getChildRecordings(studentId));
    } catch (err: any) {
      setError(err?.message ?? t('loadFailed'));
    }
  }, [studentId, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const handlePlay = async (id: string) => {
    setOpeningId(id);
    try {
      await recordingsApi.downloadRecording(id);
    } catch (err: any) {
      Alert.alert(t('error'), err?.message ?? '');
    } finally {
      setOpeningId(null);
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
            {t('parentRecordingsTitle')}
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
        ) : recordings.length === 0 ? (
          <EmptyState colors={COLORS} icon="mic-outline" title={t('parentNoRecordingsYet')} />
        ) : (
          recordings.map((r) => (
            <AppCard key={r.id} colors={COLORS} style={s.card}>
              <View style={s.rowBetween}>
                <AppText variant="bodyMedium" style={{ color: COLORS.textPrimary, flex: 1 }} numberOfLines={1}>
                  {r.fileName}
                </AppText>
                <StatusPill colors={COLORS} label={t(recordingLabelKey(r))} status={recordingTone(r)} />
              </View>
              <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                {new Date(r.createdAt).toLocaleDateString(dateLocale)}
              </AppText>
              <TouchableOpacity
                accessibilityRole="button"
                style={[s.playBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => handlePlay(r.id)}
                disabled={openingId === r.id}
              >
                <Ionicons name="play" size={16} color="#FFFFFF" />
                <AppText variant="labelLarge" style={{ color: '#FFFFFF', marginStart: 4 }}>
                  {t('parentPlayRecording')}
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
    rowBetween: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    playBtn: {
      flexDirection: 'row',
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
