import React, { useEffect } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useGrades } from '@/src/hooks/useGrades';
import { Grade } from '@/src/api';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme } from '@/src/hooks/useTheme';

function avgScore(grades: Grade[]): string {
  const nums = grades.map((g) => parseFloat(g.grade)).filter((n) => !isNaN(n));
  if (nums.length === 0) return '—';
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length).toString();
}

export default function StudentGradesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { grades, isLoading, error, fetchGrades } = useGrades();
  const { colors: COLORS } = useTheme();
  const typeColorMap = {
    ORAL: COLORS.gradeOral,
    QUIZ: COLORS.gradeQuiz,
    EXAM: COLORS.gradeExam,
    ASSIGNMENT: COLORS.gradeAssignment,
    PARTICIPATION: COLORS.gradeParticipation,
  };
  const gradeTypeColor = (type: string) => typeColorMap[type as keyof typeof typeColorMap] ?? COLORS.primary;

  const GRADE_TYPE_LABELS: Record<string, string> = {
    ORAL: t('gradeTypeOral'),
    QUIZ: t('gradeTypeQuiz'),
    EXAM: t('gradeTypeExam'),
    ASSIGNMENT: t('gradeTypeAssignment'),
    PARTICIPATION: t('gradeTypeParticipation'),
  };

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const renderGrade = ({ item }: { item: Grade }) => (
    <View style={[styles.card, { backgroundColor: COLORS.surface, borderStartColor: gradeTypeColor(item.type) }]}>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: `${gradeTypeColor(item.type)}22` }]}>
          <Text style={[styles.badgeText, { color: gradeTypeColor(item.type) }]}>
            {GRADE_TYPE_LABELS[item.type] ?? item.type}
          </Text>
        </View>
        <Text style={[styles.score, { color: gradeTypeColor(item.type) }]}>{item.grade}</Text>
      </View>

      <Text
        style={[
          styles.subject,
          {
            color: COLORS.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          },
        ]}
      >
        {item.surah ? (isRTL ? item.surah.nameAr : item.surah.nameEn) : t('overallRecital')}
      </Text>
      <Text style={[styles.meta, { color: COLORS.textSecondary }]}>
        {new Date(item.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </Text>
      {item.notes ? (
        <Text
          style={[
            styles.notes,
            {
              color: COLORS.textSecondary,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
          ]}
        >
          {item.notes}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
          />
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
            <View style={styles.empty}>
              <Ionicons name="school-outline" size={40} color={COLORS.textMuted} />
              <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>{t('noGradesYet')}</Text>
            </View>
          }
        />
      )}

      <BottomNav role="student" active="grades" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.sm,
    marginBottom: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    borderStartWidth: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: '800' },
  subject: { fontSize: 16, fontWeight: '700', marginBottom: 4, fontFamily: 'Cairo' },
  meta: { fontSize: 12, marginBottom: SPACING.sm },
  notes: { fontSize: 13, lineHeight: 18 },
  score: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo' },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'Cairo',
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statVal: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', fontFamily: 'Cairo' },
  statLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  list: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING['2xl'] },
  emptyText: { marginTop: SPACING.md, fontSize: 14, fontWeight: '600' },
});
