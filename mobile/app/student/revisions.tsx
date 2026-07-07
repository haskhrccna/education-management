import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useThemeSettings } from '@/src/settings/store';
import { Revision } from '@/src/api';
import { useRevisions } from '@/src/hooks/useRevisions';
import { BottomNav } from '@/src/components/BottomNav';

function formatDate(dateStr: string, lang: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function statusTone(status: string): 'success' | 'warning' | 'error' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'MISSED') return 'error';
  return 'warning';
}

export default function StudentRevisionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const { revisions, isLoading, error, fetchRevisions, markRevision } = useRevisions();

  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  const handleMark = (item: Revision, status: 'COMPLETED' | 'MISSED') => {
    if (item.status !== 'PENDING') return;
    const label = status === 'COMPLETED' ? t('markCompleted') : t('markMissed');
    Alert.alert(label, isAr ? 'هل أنت متأكد؟' : 'Are you sure?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          try {
            await markRevision(item.id, status);
            Alert.alert(t('success'), t('revisionMarked'));
          } catch {
            Alert.alert(t('error'), t('failedToMarkRevision'));
          }
        },
      },
    ]);
  };

  const TONE_COLORS = {
    success: COLORS.success,
    warning: (COLORS as any).warning ?? '#f59e0b',
    error: COLORS.error ?? '#ef4444',
  };

  const STATUS_LABELS: Record<string, string> = {
    PENDING: t('statusPending'),
    COMPLETED: t('statusCompleted'),
    MISSED: t('statusMissed'),
  };

  const renderItem = ({ item }: { item: Revision }) => {
    const tone = statusTone(item.status);
    const toneColor = TONE_COLORS[tone];
    const isDrill = item.ayahId != null;
    const drillColor = TONE_COLORS.warning;
    const surahName = isAr
      ? (item.surah?.name ?? String(item.surahId))
      : (item.surah?.englishName ?? String(item.surahId));

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: COLORS.surface, borderLeftColor: toneColor },
          isDrill && { backgroundColor: drillColor + '11' },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            {isDrill ? (
              <View style={styles.drillBadge}>
                <Ionicons name="flash-outline" size={13} color={drillColor} />
                <Text style={[styles.drillBadgeText, { color: drillColor }]}>
                  {isAr ? 'تدريب على آية ضعيفة' : 'Weak-spot drill'}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.surahName, { color: COLORS.text }]}>
              {surahName}
              {isDrill && item.ayah?.number != null ? ` — ${isAr ? 'آية' : 'Ayah'} ${item.ayah.number}` : ''}
            </Text>
            {item.surah?.juzNumber != null && (
              <Text style={[styles.juzLabel, { color: COLORS.textSecondary }]}>
                {t('juz')} {item.surah.juzNumber}
              </Text>
            )}
            <Text style={[styles.dateLabel, { color: COLORS.textSecondary }]}>
              {formatDate(item.scheduledFor, i18n.language)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: toneColor + '22' }]}>
            <Text style={[styles.statusText, { color: toneColor }]}>{STATUS_LABELS[item.status] ?? item.status}</Text>
          </View>
        </View>

        {item.status === 'PENDING' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.success + '22', borderColor: COLORS.success }]}
              onPress={() => handleMark(item, 'COMPLETED')}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
              <Text style={[styles.actionText, { color: COLORS.success }]}>{t('markCompleted')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.error + '22', borderColor: COLORS.error }]}
              onPress={() => handleMark(item, 'MISSED')}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
              <Text style={[styles.actionText, { color: COLORS.error }]}>{t('markMissed')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>{t('revisionScheduleTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl * 2 }} color={COLORS.primary} />
      ) : error ? (
        <TouchableOpacity style={styles.errorBox} onPress={fetchRevisions}>
          <Text style={[styles.errorText, { color: COLORS.error }]}>{t('loadFailed')}</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={revisions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 80 },
            revisions.length === 0 && styles.emptyContainer,
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchRevisions} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="book-outline" size={48} color={COLORS.textSecondary} />
              <Text style={[styles.emptyTitle, { color: COLORS.text }]}>{t('noRevisions')}</Text>
              <Text style={[styles.emptyDesc, { color: COLORS.textSecondary }]}>{t('noRevisionsDesc')}</Text>
            </View>
          }
        />
      )}

      <BottomNav role="student" active="home" />
    </View>
  );
}

function createStyles(COLORS: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    screen: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
    },
    backBtn: { width: 40, alignItems: 'flex-start' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    list: { padding: SPACING.md, gap: SPACING.sm },
    card: {
      borderRadius: RADIUS.md,
      borderLeftWidth: 4,
      padding: SPACING.md,
      ...SHADOWS.sm,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    drillBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
    drillBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    surahName: { fontSize: 16, fontWeight: '600' },
    juzLabel: { fontSize: 13, marginTop: 2 },
    dateLabel: { fontSize: 13, marginTop: 4 },
    statusBadge: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
    statusText: { fontSize: 12, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      paddingVertical: SPACING.xs,
    },
    actionText: { fontSize: 13, fontWeight: '500' },
    emptyContainer: { flex: 1 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingTop: SPACING.xl * 2 },
    emptyTitle: { fontSize: 18, fontWeight: '600' },
    emptyDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: SPACING.xl },
    errorBox: { margin: SPACING.md, alignItems: 'center' },
    errorText: { fontSize: 14 },
  });
}
