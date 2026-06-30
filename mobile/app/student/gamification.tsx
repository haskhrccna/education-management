import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGamification } from '@/src/hooks/useGamification';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useThemeSettings } from '@/src/settings/store';
import { getColors, RADIUS, SPACING } from '@/constants/theme';
import { AppCard, AppText, EmptyState, MetricTile, SectionHeader, SegmentedControl } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  flame: 'flame-outline',
  star: 'star-outline',
  medal: 'medal-outline',
  ribbon: 'ribbon-outline',
  trophy: 'trophy-outline',
  crown: 'trophy-outline',
  book: 'book-outline',
  mic: 'mic-outline',
};

export default function GamificationScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const {
    gamification,
    leaderboard,
    leaderboardLoading,
    leaderboardError,
    isLoading,
    error,
    fetchGamification,
    fetchLeaderboard,
  } = useGamification();
  const [scope, setScope] = useState<'all' | 'my-teacher'>('all');

  React.useEffect(() => {
    fetchLeaderboard(scope);
  }, [scope, fetchLeaderboard]);

  // Refresh everything on screen, not just the top stats.
  const onRefresh = () => {
    fetchGamification();
    fetchLeaderboard(scope);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
        <AppText variant="headlineSmall" color="#FFFFFF">
          {t('gamification')}
        </AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      >
        {error ? (
          <View style={styles.center}>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>
              {t('couldntLoad')}
            </AppText>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('retry')}
              onPress={fetchGamification}
              style={{ marginTop: SPACING.md }}
            >
              <AppText variant="bodyMedium" color={COLORS.primary}>
                {t('retry')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : !gamification ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <>
            <SectionHeader colors={COLORS} title={t('streak')} />
            <View style={styles.metrics}>
              <MetricTile
                colors={COLORS}
                value={String(gamification.streak.currentStreak)}
                label={t('currentStreak')}
                tone="gold"
              />
              <MetricTile
                colors={COLORS}
                value={String(gamification.streak.longestStreak)}
                label={t('longestStreak')}
                tone="primary"
              />
            </View>

            <SectionHeader colors={COLORS} title={t('badgeWall')} />
            {gamification.badges.length === 0 ? (
              <EmptyState
                colors={COLORS}
                icon="trophy-outline"
                title={t('noBadgesYet')}
                description={t('noBadgesYetDesc')}
              />
            ) : (
              <View style={styles.badgeGrid}>
                {gamification.badges.map((badge) => (
                  <AppCard key={badge.code} colors={COLORS} style={styles.badgeCard}>
                    <Ionicons name={ICON_MAP[badge.iconKey] || 'star-outline'} size={28} color={COLORS.primary} />
                    <AppText
                      variant="bodySmall"
                      color={COLORS.textPrimary}
                      style={{ marginTop: SPACING.xs, textAlign: 'center' }}
                    >
                      {badge.name}
                    </AppText>
                    <AppText variant="bodySmall" color={COLORS.textSecondary} style={{ textAlign: 'center' }}>
                      {new Date(badge.earnedAt).toLocaleDateString(i18n.language)}
                    </AppText>
                  </AppCard>
                ))}
              </View>
            )}

            <SectionHeader colors={COLORS} title={t('leaderboard')} />
            <SegmentedControl
              colors={COLORS}
              value={scope}
              onChange={(v) => setScope(v as 'all' | 'my-teacher')}
              options={[
                { value: 'all', label: t('leaderboardAll') },
                { value: 'my-teacher', label: t('leaderboardMyTeacher') },
              ]}
              style={{ marginBottom: SPACING.md }}
            />

            {leaderboardLoading ? (
              <>
                <SkeletonCard lines={1} />
                <SkeletonCard lines={1} />
                <SkeletonCard lines={1} />
              </>
            ) : leaderboardError ? (
              <View style={styles.center}>
                <AppText variant="bodyMedium" color={COLORS.textSecondary}>
                  {t('leaderboardError')}
                </AppText>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('retry')}
                  onPress={() => fetchLeaderboard(scope)}
                  style={{ marginTop: SPACING.md }}
                >
                  <AppText variant="bodyMedium" color={COLORS.primary}>
                    {t('retry')}
                  </AppText>
                </TouchableOpacity>
              </View>
            ) : leaderboard.length === 0 ? (
              <EmptyState colors={COLORS} icon="people-outline" title={t('leaderboardEmpty')} />
            ) : (
              leaderboard.slice(0, 10).map((entry) => (
                <AppCard key={entry.userId} colors={COLORS} style={{ marginBottom: SPACING.sm }}>
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.rank,
                        { backgroundColor: entry.rank <= 3 ? COLORS.primaryMuted : COLORS.surfaceAlt },
                      ]}
                    >
                      <AppText variant="titleMedium" color={entry.rank <= 3 ? COLORS.primary : COLORS.textSecondary}>
                        #{entry.rank}
                      </AppText>
                    </View>
                    <AppText
                      variant="bodyMedium"
                      color={COLORS.textPrimary}
                      style={{ flex: 1, marginStart: SPACING.md }}
                    >
                      {entry.name}
                    </AppText>
                    <AppText variant="bodyMedium" color={COLORS.textSecondary}>
                      {entry.currentStreak}
                    </AppText>
                  </View>
                </AppCard>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  body: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  metrics: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  badgeCard: { width: '31%', alignItems: 'center', padding: SPACING.md, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  rank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
