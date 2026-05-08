import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/src/auth/store';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';
import { useMemorization } from '@/src/hooks/useMemorization';

// ─── Mock Quran Data (replaced by API later) ──────────────────────────────────

interface Surah {
  id: number;
  nameAr: string;
  nameEn: string;
  ayahCount: number;
  memorizedAyahs: number;
  juz: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProgressingJuz(surahs: Surah[]): number {
  let best = 1;
  for (const s of surahs) {
    if (s.memorizedAyahs >= s.ayahCount) continue; // complete
    if (s.memorizedAyahs > 0) best = Math.max(best, s.juz);
  }
  return best > 0 ? best : 1;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StudentHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'surahs' | 'schedule' | 'progress'>('surahs');
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  const { progress, surahs: apiSurahs, isLoading: isLoadingProgress, fetchProgress } = useMemorization();

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  // Map API data to the shape sub-components consume
  const SURAH_DATA: Surah[] = apiSurahs.map((s) => {
    const entry = progress.find((e) => e.surahId === s.id);
    return {
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      ayahCount: s.ayahCount,
      memorizedAyahs: entry?.memorizedAyahs ?? 0,
      juz: s.juz,
    };
  });

  // RevisionSchedule API is out of scope — keep empty until Bundle 3
  type RevisionItem = { id: string; surahId: number; surahName: string; date: string; status: 'DUE' | 'UPCOMING' };
  const REVISION_SCHEDULE: RevisionItem[] = [];

  const completedSurahs = SURAH_DATA.filter((s) => s.memorizedAyahs >= s.ayahCount).length;
  const totalMemorized = SURAH_DATA.reduce((sum, s) => sum + s.memorizedAyahs, 0);
  const totalAyahsAll = SURAH_DATA.reduce((sum, s) => sum + s.ayahCount, 0);
  const currentJuz = getProgressingJuz(SURAH_DATA);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{t('studentHomeTitle', { name: user?.firstName || '' })}</Text>
            <Text style={styles.subGreeting}>
              {i18n.language === 'ar' ? 'يا بارك الله فيك في حفظ كتابه' : 'May Allah bless your memorization'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            <TouchableOpacity onPress={() => router.push('/student/grades')} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>{t('myGrades')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>{t('logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completedSurahs}</Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'سورة مكتملة' : 'Complete'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {totalAyahsAll > 0 ? Math.round((totalMemorized / totalAyahsAll) * 100) : 0}%
            </Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'إجمالي التقدم' : 'Overall'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{currentJuz}/30</Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'الجزء' : 'Juz'}</Text>
          </View>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {[
          { key: 'surahs' as const, label: t('myReview') },
          { key: 'schedule' as const, label: t('schedule') },
          { key: 'progress' as const, label: t('progress') },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoadingProgress} onRefresh={fetchProgress} />}
      >
        {activeTab === 'surahs' &&
          (isLoadingProgress && SURAH_DATA.length === 0 ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <SurahsTab surahData={SURAH_DATA} activeJuz={currentJuz} styles={styles} />
          ))}
        {activeTab === 'schedule' && <RevisionScheduleTab revisions={REVISION_SCHEDULE} styles={styles} />}
        {activeTab === 'progress' && (
          <ProgressTab
            surahData={SURAH_DATA}
            totalMemorized={totalMemorized}
            styles={styles}
            i18n={i18n}
            COLORS={COLORS}
            t={t}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Surahs Tab ───────────────────────────────────────────────────────────────

function SurahsTab({ surahData, activeJuz, styles }: { surahData: Surah[]; activeJuz: number; styles: any }) {
  const { t, i18n } = useTranslation();

  // Group by Juz
  const juzGroups: Record<number, Surah[]> = {};
  surahData.forEach((s) => {
    if (!juzGroups[s.juz]) juzGroups[s.juz] = [];
    juzGroups[s.juz].push(s);
  });

  return (
    <View style={{ gap: SPACING.md }}>
      {/* Current Juz highlight */}
      <Animated.View entering={FadeInUp.duration(400)} style={[styles.card, styles.highlightedCard]}>
        <Text style={styles.juzHighlightLabel}>{i18n.language === 'ar' ? 'الجزء الحالي' : 'Current Juz'}</Text>
        <Text style={styles.juzHighlightTitle}>
          {t('juz')} {activeJuz} — {getJuzNameAr(activeJuz)}
        </Text>
      </Animated.View>

      {/* Surah list grouped by Juz */}
      {Object.entries(juzGroups)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([juz, surahs]) => (
          <View key={juz}>
            <Text style={[styles.juzGroupTitle, { marginTop: SPACING.lg }]}>
              {t('juz')} {juz}
            </Text>
            {surahs.map((surah) => (
              <SurahCard key={surah.id} surah={surah} styles={styles} i18n={i18n} />
            ))}
          </View>
        ))}
    </View>
  );
}

function SurahCard({ surah, styles, i18n }: { surah: Surah; styles: any; i18n: any }) {
  const { t } = useTranslation();
  const percent = Math.round((surah.memorizedAyahs / surah.ayahCount) * 100);
  const isComplete = percent === 100;

  return (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.surahCard}>
      <View style={styles.surahInfo}>
        <View style={styles.surahNameRow}>
          <Text style={styles.surahNumber}>{surah.id}</Text>
          <Text style={styles.surahArabic}>{surah.nameAr}</Text>
        </View>
        <Text style={styles.surahEnglish}>{surah.nameEn}</Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBarContainer, !isComplete && { opacity: 0.85 }]}>
        {isComplete ? (
          <Text style={styles.completeBadge}>✓</Text>
        ) : (
          <>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
            </View>
            <Text style={styles.surahProgressText}>
              {surah.memorizedAyahs} / {surah.ayahCount} ({percent}%)
            </Text>
          </>
        )}
      </View>

      {/* Juz badge */}
      <Text style={styles.juzBadge}>
        {t('juz')} {surah.juz}
      </Text>
    </Animated.View>
  );
}

// ─── Revision Schedule Tab ────────────────────────────────────────────────────

function RevisionScheduleTab({
  revisions,
  styles,
}: {
  revisions: { id: string; surahId: number; surahName: string; date: string; status: 'DUE' | 'UPCOMING' }[];
  styles: any;
}) {
  const { i18n } = useTranslation();
  const today = new Date().toISOString().split('T')[0];

  const dueRevisions = revisions.filter((r) => r.date <= today);
  const upcomingRevisions = revisions.filter((r) => r.date > today);

  return (
    <View style={{ gap: SPACING.md }}>
      {/* Due section */}
      {dueRevisions.length > 0 && (
        <Animated.View entering={FadeInUp.duration(400)}>
          <Text style={styles.sectionTitle}>{i18n.language === 'ar' ? 'مراجعة متوقفة اليوم' : 'Due today'}</Text>
          {dueRevisions.map((rev) => (
            <RevisionCard key={rev.id} revision={rev} styles={styles} i18n={i18n} />
          ))}
        </Animated.View>
      )}

      {/* Upcoming section */}
      {upcomingRevisions.length > 0 && (
        <Animated.View entering={FadeInUp.duration(400).delay(100)}>
          <Text style={styles.sectionTitle}>{i18n.language === 'ar' ? 'المراجعات القادمة' : 'Upcoming revisions'}</Text>
          {upcomingRevisions.map((rev) => (
            <RevisionCard key={rev.id} revision={rev} styles={styles} i18n={i18n} />
          ))}
        </Animated.View>
      )}

      {/* Empty state */}
      {revisions.length === 0 && (
        <View style={[styles.card, styles.emptyCard]}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>
            {i18n.language === 'ar' ? 'جدول المراجعة قريباً' : 'Revision schedule coming soon'}
          </Text>
          <Text style={styles.emptyDesc}>
            {i18n.language === 'ar'
              ? 'نعمل على تجهيز هذا القسم. حتى ذلك الحين، تابع تقدمك من تبويب مراجعتي.'
              : 'This section is being prepared. Until then, keep following your progress from My Review.'}
          </Text>
        </View>
      )}
    </View>
  );
}

function RevisionCard({
  revision,
  styles,
  i18n,
}: {
  revision: { id: string; surahId: number; surahName: string; date: string; status: 'DUE' | 'UPCOMING' };
  styles: any;
  i18n: any;
}) {
  const dateObj = new Date(revision.date);
  const isOverdue = revision.date < new Date().toISOString().split('T')[0];

  return (
    <Animated.View entering={FadeInUp.duration(400)} style={[styles.card, isOverdue && styles.dueCard]}>
      <View style={styles.revisionHeader}>
        <View>
          <Text style={styles.revisionSurah}>{revision.surahName}</Text>
          <Text style={styles.revisionDate}>
            {dateObj.toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <View style={[styles.dueBadge, isOverdue ? styles.dueBadgeOverdue : styles.dueBadgeUpcoming]}>
          <Text style={[styles.dueBadgeText, isOverdue && styles.dueBadgeTextOverdue]}>
            {isOverdue
              ? i18n.language === 'ar'
                ? 'متوقفة اليوم'
                : 'Overdue'
              : i18n.language === 'ar'
                ? 'قادمة'
                : 'Upcoming'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────

function ProgressTab({
  surahData,
  totalMemorized,
  styles,
  i18n,
  COLORS,
  t,
}: {
  surahData: Surah[];
  totalMemorized: number;
  styles: any;
  i18n: any;
  COLORS: any;
  t: (k: string) => string;
}) {
  const completedSurahs = surahData.filter((s) => s.memorizedAyahs >= s.ayahCount);
  const inProgressSurahs = surahData.filter((s) => s.memorizedAyahs > 0 && s.memorizedAyahs < s.ayahCount);
  const notStarted = surahData.filter((s) => s.memorizedAyahs === 0);
  const totalAyahs = surahData.reduce((sum, s) => sum + s.ayahCount, 0);

  return (
    <View style={{ gap: SPACING.md }}>
      {/* Weekly streak */}
      <Animated.View entering={FadeInUp.duration(400)} style={[styles.card, styles.streakCard]}>
        <Text style={styles.streakIcon}>🔥</Text>
        <Text style={styles.streakValue}>5</Text>
        <Text style={styles.streakLabel}>{i18n.language === 'ar' ? 'السجل الأسبوعي' : 'Weekly Streak'}</Text>
      </Animated.View>

      {/* Memorization breakdown */}
      <Animated.View entering={FadeInUp.duration(400).delay(100)} style={[styles.card, styles.breakdownCard]}>
        <Text style={styles.breakdownTitle}>
          {i18n.language === 'ar' ? 'تقدم الحفظ الشامل' : 'Overall Memorization'}
        </Text>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownValue, { color: COLORS.success }]}>{completedSurahs.length}</Text>
            <Text style={styles.breakdownLabel}>{i18n.language === 'ar' ? 'سورة مكتملة' : 'Complete'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownValue, { color: COLORS.gold }]}>{inProgressSurahs.length}</Text>
            <Text style={styles.breakdownLabel}>{i18n.language === 'ar' ? 'قيد التقدم' : 'In Progress'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.breakdownItem}>
            <Text style={{ color: COLORS.textMuted }}>{notStarted.length}</Text>
            <Text style={styles.breakdownLabel}>{i18n.language === 'ar' ? 'لم تبدأ' : 'Not Started'}</Text>
          </View>
        </View>

        {/* Total ayahs bar */}
        <View style={{ marginTop: SPACING.lg }}>
          <Text style={styles.totalAyahsLabel}>
            {totalMemorized} / {totalAyahs} ayahs
          </Text>
          <View style={styles.solidProgressBarTrack}>
            <View style={[styles.solidProgressBarFill, { width: `${(totalMemorized / totalAyahs) * 100}%` }]} />
          </View>
        </View>
      </Animated.View>

      {/* Juz list */}
      <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.juzProgressCard}>
        <Text style={styles.breakdownTitle}>{i18n.language === 'ar' ? 'تقدم الجزء' : 'Juz Progress'}</Text>
        {Array.from(new Set(surahData.map((s) => s.juz)))
          .sort((a, b) => a - b)
          .map((juz) => {
            const surahsInJuz = surahData.filter((s) => s.juz === juz);
            const totalAyahsInJuz = surahsInJuz.reduce((s: number, a: Surah) => s + a.ayahCount, 0);
            const memorizedInJuz = surahsInJuz.reduce((s: number, a: Surah) => s + a.memorizedAyahs, 0);
            const percent = totalAyahsInJuz > 0 ? Math.round((memorizedInJuz / totalAyahsInJuz) * 100) : 0;
            return (
              <View key={juz} style={styles.juxRow}>
                <Text style={styles.juxLabel}>
                  {t('juz')} {juz}
                </Text>
                <View style={styles.miniProgressBar}>
                  <View style={[styles.miniBarFill, { width: `${percent}%` }]} />
                </View>
                <Text style={styles.miniPercent}>{percent}%</Text>
              </View>
            );
          })}
      </Animated.View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getJuzNameAr(juz: number): string {
  const names = [
    '',
    'alif lam meem',
    'samman',
    'amman',
    'qad afalah',
    'almulk',
    'amma',
    'yataka tun',
    'naw',
    'al hajr',
    'nur',
    'al anfal',
    'ahzab',
  ];
  return names[juz] || '';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    // Header
    header: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING['2xl'],
      borderBottomLeftRadius: RADIUS['2xl'],
      borderBottomRightRadius: RADIUS['2xl'],
      ...SHADOWS.lg,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.lg,
    },
    greeting: {
      fontSize: 22,
      fontWeight: '800',
      color: '#fff',
      marginBottom: SPACING.xs,
    },
    subGreeting: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.75)',
      fontWeight: '500',
    },
    logoutBtn: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.md,
    },
    logoutText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },

    // Stats row
    statsRow: { flexDirection: 'row', gap: SPACING.md },
    statCard: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      color: COLORS.goldLight,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
      fontWeight: '500',
    },

    // Tabs
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.lg,
      gap: SPACING.sm,
    },
    tab: {
      flex: 1,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.lg,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      ...SHADOWS.sm,
    },
    tabActive: {
      backgroundColor: COLORS.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    tabTextActive: {
      color: '#fff',
    },

    // Content
    content: { flex: 1, paddingHorizontal: SPACING.xl },
    list: { gap: SPACING.md, paddingBottom: SPACING['4xl'] },

    // Card shared
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS['2xl'],
      padding: SPACING.lg,
      ...SHADOWS.sm,
    },
    highlightedCard: {
      borderWidth: 2,
      borderColor: COLORS.gold,
    },

    // Juz highlight card (main content)
    juzHighlightLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    juzHighlightTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primaryDark, marginTop: SPACING.xs },

    // Surahs
    surahCard: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS['2xl'],
      padding: SPACING.lg,
      ...SHADOWS.sm,
    },
    surahInfo: { marginBottom: SPACING.md },
    surahNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    surahNumber: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.primary,
      backgroundColor: COLORS.primaryMuted,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      borderRadius: RADIUS.sm,
    },
    surahArabic: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textPrimary,
      textAlign: 'right',
    },
    surahEnglish: {
      fontSize: 13,
      color: COLORS.textSecondary,
      fontWeight: '500',
      marginTop: 2,
    },
    progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    completeBadge: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.success,
    },
    progressBarTrack: {
      flex: 1,
      height: 8,
      backgroundColor: '#e7e5e4',
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.full,
    },
    surahProgressText: {
      fontSize: 12,
      color: COLORS.textSecondary,
      fontWeight: '500',
      minWidth: 70,
      textAlign: 'right',
    },
    juzBadge: {
      fontSize: 11,
      color: COLORS.primary,
      fontWeight: '600',
      marginTop: SPACING.xs,
    },

    // Juz group title
    juzGroupTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primaryDark, marginBottom: SPACING.sm },

    // Section titles
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.primaryDark,
      marginBottom: SPACING.sm,
    },

    // Due card
    dueCard: {
      borderWidth: 2,
      borderColor: '#ef4444',
    },
    revisionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    revisionSurah: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
    revisionDate: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
    dueBadge: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 4,
      borderRadius: RADIUS.sm,
      backgroundColor: '#fef3c7',
    },
    dueBadgeOverdue: { backgroundColor: '#fee2e2' },
    dueBadgeUpcoming: { backgroundColor: '#dbeafe' },
    dueBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.warning },
    dueBadgeTextOverdue: { color: '#dc2626' },

    // Streak
    streakCard: { alignItems: 'center', borderWidth: 1, borderColor: COLORS.goldMuted },
    streakIcon: { fontSize: 36, marginBottom: SPACING.sm },
    streakValue: { fontSize: 40, fontWeight: '800', color: COLORS.gold },
    streakLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600', marginTop: SPACING.xs },

    // Breakdown
    breakdownCard: { alignItems: 'center' },
    breakdownTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primaryDark, marginBottom: SPACING.lg },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: '100%' },
    breakdownItem: { alignItems: 'center', flex: 1 },
    breakdownValue: { fontSize: 28, fontWeight: '800', color: COLORS.primary, marginBottom: SPACING.xs },
    breakdownLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
    divider: { width: 1, height: 40, backgroundColor: '#e7e5e4' },
    totalAyahsLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', marginBottom: SPACING.xs },

    // Solid progress bar (memorized vs pending)
    solidProgressBarTrack: {
      height: 24,
      backgroundColor: '#e7e5e4',
      borderRadius: RADIUS.full,
      overflow: 'hidden',
      position: 'relative',
    },
    solidProgressBarFill: {
      height: '100%',
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.full,
    },

    // Juz progress card
    juzProgressCard: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS['2xl'],
      padding: SPACING.lg,
      ...SHADOWS.sm,
    },
    juxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.xs,
      borderBottomWidth: 1,
      borderBottomColor: '#f5f5f5',
    },
    juxLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
    miniProgressBar: { flex: 1, height: 6, backgroundColor: '#e7e5e4', borderRadius: RADIUS.full, overflow: 'hidden' },
    miniBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
    miniPercent: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, minWidth: 35, textAlign: 'right' },

    // Empty state
    emptyCard: { alignItems: 'center', padding: SPACING['3xl'], marginTop: SPACING.xl },
    emptyIcon: { fontSize: 48, marginBottom: SPACING.lg },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
    emptyDesc: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
