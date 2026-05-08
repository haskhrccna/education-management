import React, { useEffect } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useGrades } from '@/src/hooks/useGrades';
import { Grade } from '@/src/api';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

const TYPE_COLORS: Record<string, string> = {
  ORAL: '#3b82f6',
  QUIZ: '#22c55e',
  EXAM: '#ef4444',
  ASSIGNMENT: '#f59e0b',
  PARTICIPATION: '#8b5cf6',
};

function avgScore(grades: Grade[]): string {
  const nums = grades.map((g) => parseFloat(g.grade)).filter((n) => !isNaN(n));
  if (nums.length === 0) return '—';
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length).toString();
}

export default function StudentGradesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { grades, isLoading, error, fetchGrades } = useGrades();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);

  const GRADE_TYPE_LABELS: Record<string, string> = {
    ORAL: t('gradeTypeOral'),
    QUIZ: t('gradeTypeQuiz'),
    EXAM: t('gradeTypeExam'),
    ASSIGNMENT: t('gradeTypeAssignment'),
    PARTICIPATION: t('gradeTypeParticipation'),
  };

  useEffect(() => {
    fetchGrades();
  }, []);

  const renderGrade = ({ item }: { item: Grade }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: COLORS.surface, borderLeftColor: TYPE_COLORS[item.type] ?? COLORS.primary },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={[styles.badge, { backgroundColor: (TYPE_COLORS[item.type] ?? COLORS.primary) + '22' }]}>
            <Text style={[styles.badgeText, { color: TYPE_COLORS[item.type] ?? COLORS.primary }]}>{GRADE_TYPE_LABELS[item.type] ?? item.type}</Text>
          </View>
          <Text style={[styles.subject, { color: COLORS.textPrimary, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{item.subject}</Text>
          <Text style={[styles.meta, { color: COLORS.textSecondary }]}>
            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <Text style={[styles.score, { color: TYPE_COLORS[item.type] ?? COLORS.primary }]}>{item.grade}</Text>
      </View>
      {item.notes ? <Text style={[styles.notes, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{item.notes}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('myGrades')}</Text>
        {!isLoading && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{avgScore(grades)}</Text>
              <Text style={styles.statLbl}>{t('avgScore')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{grades.length}</Text>
              <Text style={styles.statLbl}>{t('totalGrades')}</Text>
            </View>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.textSecondary }}>{error}</Text>
          <TouchableOpacity onPress={fetchGrades} style={{ marginTop: SPACING.md }}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={grades}
          keyExtractor={(g) => g.id}
          renderItem={renderGrade}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchGrades} />}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
            ) : (
              <View style={styles.center}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>📋</Text>
                <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>{t('noGradesYet')}</Text>
                <Text style={{ color: COLORS.textSecondary, textAlign: 'center' }}>
                  {t('noGradesDesc')}
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: SPACING.xl,
    paddingTop: SPACING.lg,
    borderBottomLeftRadius: RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
    ...SHADOWS.lg,
    marginBottom: SPACING.md,
  },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: SPACING.sm },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: SPACING.md },
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  stat: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    minWidth: 72,
  },
  statVal: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  list: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: SPACING['4xl'] },
  card: { borderRadius: RADIUS.xl, padding: SPACING.lg, borderLeftWidth: 4, ...SHADOWS.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  subject: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  meta: { fontSize: 12 },
  score: { fontSize: 28, fontWeight: '800' },
  notes: { fontSize: 13, marginTop: SPACING.sm, fontStyle: 'italic' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['3xl'] },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.sm },
});
