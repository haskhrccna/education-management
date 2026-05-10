import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRequiredParam } from '@/src/hooks/useRequiredParam';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { gradesApi, memorizationApi, Grade, MemorizationEntry } from '@/src/api';
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

function memPct(entries: MemorizationEntry[]): string {
  const total = entries.reduce((s, e) => s + e.surah.ayahCount, 0);
  const done = entries.reduce((s, e) => s + e.memorizedAyahs, 0);
  if (total === 0) return '—';
  return Math.round((done / total) * 100) + '%';
}

export default function TeacherStudentDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const studentId = useRequiredParam('id');
  const { name: studentName } = useLocalSearchParams<{ name?: string }>();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);

  const GRADE_TYPE_LABELS: Record<string, string> = {
    ORAL: t('gradeTypeOral'),
    QUIZ: t('gradeTypeQuiz'),
    EXAM: t('gradeTypeExam'),
    ASSIGNMENT: t('gradeTypeAssignment'),
    PARTICIPATION: t('gradeTypeParticipation'),
  };

  const [grades, setGrades] = useState<Grade[]>([]);
  const [memorization, setMemorization] = useState<MemorizationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!studentId) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.textSecondary }}>{t('notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: COLORS.primary }}>{t('goBack')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    if (!studentId) return;
    Promise.all([gradesApi.getStudentGrades(studentId), memorizationApi.getStudentProgress(studentId)])
      .then(([g, m]) => {
        setGrades(g);
        setMemorization(m);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [studentId]);

  const displayName = studentName ?? 'Student';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: SPACING['4xl'] }}>
        <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{displayName}</Text>
          {!isLoading && (
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{avgScore(grades)}</Text>
                <Text style={styles.statLbl}>{t('avgLabel')}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{grades.length}</Text>
                <Text style={styles.statLbl}>{t('gradesCountLabel')}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{memPct(memorization)}</Text>
                <Text style={styles.statLbl}>{t('memorizedLabel')}</Text>
              </View>
            </View>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: COLORS.textSecondary }}>{error}</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: SPACING.xl, gap: SPACING.md, marginTop: SPACING.lg }}>
            <Text style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>{t('recentGrades')}</Text>
            {grades.length === 0 ? (
              <Text style={{ color: COLORS.textSecondary }}>{t('noGradesRecorded')}</Text>
            ) : (
              grades.slice(0, 5).map((g) => (
                <View
                  key={g.id}
                  style={[
                    styles.gradeCard,
                    { backgroundColor: COLORS.surface, borderLeftColor: TYPE_COLORS[g.type] ?? COLORS.primary },
                  ]}
                >
                  <View style={styles.gradeCardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.badge, { backgroundColor: (TYPE_COLORS[g.type] ?? COLORS.primary) + '22' }]}>
                        <Text style={[styles.badgeText, { color: TYPE_COLORS[g.type] ?? COLORS.primary }]}>
                          {GRADE_TYPE_LABELS[g.type] ?? g.type}
                        </Text>
                      </View>
                      <Text style={[styles.subject, { color: COLORS.textPrimary }]}>{g.subject}</Text>
                      <Text style={[styles.meta, { color: COLORS.textSecondary }]}>
                        {new Date(g.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <Text style={[styles.score, { color: TYPE_COLORS[g.type] ?? COLORS.primary }]}>{g.grade}</Text>
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push(`/teacher/grade-form?studentId=${studentId}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>{t('addGradeFor', { name: displayName })}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    flex: 1,
  },
  statVal: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  center: { alignItems: 'center', padding: SPACING['3xl'] },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  gradeCard: { borderRadius: RADIUS.xl, padding: SPACING.lg, borderLeftWidth: 4, ...SHADOWS.sm },
  gradeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  subject: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  meta: { fontSize: 12 },
  score: { fontSize: 26, fontWeight: '800' },
  addBtn: { borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', ...SHADOWS.sm, marginTop: SPACING.md },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
