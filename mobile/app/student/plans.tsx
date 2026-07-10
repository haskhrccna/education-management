import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { CurriculumPlan } from '@/src/api';
import { useCurriculumPlans } from '@/src/hooks/useCurriculumPlans';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

function formatDate(dateStr: string, lang: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function paceLabel(pace: CurriculumPlan['pace'], isAr: boolean): string {
  if (pace === 'BEHIND') return isAr ? 'متأخر' : 'Behind';
  if (pace === 'AHEAD') return isAr ? 'متقدم' : 'Ahead';
  return isAr ? 'في الموعد' : 'On pace';
}

export default function StudentPlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const { plans, isLoading, error, refetch } = useCurriculumPlans();

  const PACE_COLORS: Record<CurriculumPlan['pace'], string> = {
    ON_PACE: COLORS.success,
    BEHIND: COLORS.error,
    AHEAD: COLORS.primary,
  };

  const renderPlan = ({ item }: { item: CurriculumPlan }) => {
    const paceColor = PACE_COLORS[item.pace];
    return (
      <View style={[styles.card, { backgroundColor: COLORS.surface, borderLeftColor: paceColor }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.planName, { color: COLORS.text }]}>{item.name}</Text>
          <View style={[styles.paceBadge, { backgroundColor: paceColor + '22' }]}>
            <Ionicons
              name={
                item.pace === 'BEHIND'
                  ? 'alert-circle-outline'
                  : item.pace === 'AHEAD'
                    ? 'rocket-outline'
                    : 'checkmark-circle-outline'
              }
              size={13}
              color={paceColor}
            />
            <Text style={[styles.paceText, { color: paceColor }]}>{paceLabel(item.pace, isAr)}</Text>
          </View>
        </View>
        {item.items.map((planItem) => (
          <View key={planItem.id} style={styles.itemRow}>
            <Text style={[styles.itemName, { color: COLORS.text }]}>
              {isAr ? planItem.surah?.nameAr : planItem.surah?.nameEn}
            </Text>
            <Text style={[styles.itemDate, { color: COLORS.textSecondary }]}>
              {formatDate(planItem.targetDate, i18n.language)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>{isAr ? 'خطط الحفظ' : 'Curriculum plans'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl * 2 }} color={COLORS.primary} />
      ) : error ? (
        <TouchableOpacity style={styles.errorBox} onPress={() => refetch()}>
          <Text style={[styles.errorText, { color: COLORS.error }]}>{t('loadFailed')}</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={renderPlan}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 80 },
            plans.length === 0 && styles.emptyContainer,
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="map-outline" size={48} color={COLORS.textSecondary} />
              <Text style={[styles.emptyTitle, { color: COLORS.text }]}>
                {isAr ? 'لا توجد خطط بعد' : 'No plans yet'}
              </Text>
              <Text style={[styles.emptyDesc, { color: COLORS.textSecondary }]}>
                {isAr ? 'سيقوم معلمك بإنشاء خطة حفظ عند الحاجة.' : 'Your teacher can set one up when it makes sense.'}
              </Text>
            </View>
          }
        />
      )}

      <BottomNav role="student" active="home" />
    </View>
  );
}

function createStyles(COLORS: ThemeColors) {
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
    card: { borderRadius: RADIUS.md, borderLeftWidth: 4, padding: SPACING.md, gap: SPACING.xs, ...SHADOWS.sm },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
    planName: { fontSize: 16, fontWeight: '700', flex: 1 },
    paceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
    },
    paceText: { fontSize: 11, fontWeight: '700' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    itemName: { fontSize: 13, fontWeight: '600' },
    itemDate: { fontSize: 12 },
    emptyContainer: { flex: 1 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingTop: SPACING.xl * 2 },
    emptyTitle: { fontSize: 18, fontWeight: '600' },
    emptyDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: SPACING.xl },
    errorBox: { margin: SPACING.md, alignItems: 'center' },
    errorText: { fontSize: 14 },
  });
}
