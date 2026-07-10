import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { Ijazah } from '@/src/api/ijazahs';
import { useIjazahs } from '@/src/hooks/useIjazahs';
import { AppCard, AppText, EmptyState, IconButton } from '@/src/components/design';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

function formatDate(dateStr: string, lang: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function scopeTitle(item: Ijazah, isAr: boolean): string {
  if (item.scope === 'FULL_QURAN') return isAr ? 'إجازة بالقرآن الكريم كاملاً' : 'Ijazah — the full Quran';
  if (item.scope === 'JUZ') return isAr ? `إجازة بالجزء ${item.juzNumber}` : `Ijazah — Juz ${item.juzNumber}`;
  const name = isAr ? item.surah?.nameAr : item.surah?.nameEn;
  return isAr ? `إجازة بسورة ${name ?? ''}` : `Ijazah — ${name ?? 'a surah'}`;
}

export default function StudentIjazahsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const { ijazahs, isLoading, error, refetch, getVerifyUrl, regenerateLink } = useIjazahs();

  const handleShare = async (verificationToken: string) => {
    const url = getVerifyUrl(verificationToken);
    try {
      await Share.share({ url, message: url });
    } catch {
      Linking.openURL(url);
    }
  };

  const handleRegenerateLink = (ijazahId: string) => {
    Alert.alert(
      isAr ? 'تجديد الرابط؟' : 'Regenerate link?',
      isAr ? 'سيتوقف الرابط القديم عن العمل فوراً.' : 'The old shared link will stop working immediately.',
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAr ? 'تجديد' : 'Regenerate',
          style: 'destructive',
          onPress: () => regenerateLink(ijazahId).catch(() => Alert.alert(isAr ? 'خطأ' : 'Error')),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Ijazah }) => {
    const teacherName = item.teacher ? `${item.teacher.firstName} ${item.teacher.lastName}` : '';
    return (
      <AppCard colors={COLORS} style={[styles.card, { borderColor: COLORS.gold }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.medal, { backgroundColor: COLORS.goldMuted }]}>
            <Ionicons name="ribbon" size={22} color={COLORS.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="titleMedium" color={COLORS.textPrimary}>
              {scopeTitle(item, isAr)}
            </AppText>
            <AppText variant="bodySmall" color={COLORS.textSecondary}>
              {formatDate(item.issuedAt, i18n.language)}
            </AppText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: COLORS.divider }]} />

        <AppText variant="bodySmall" color={COLORS.textSecondary}>
          {isAr ? 'أجازها' : 'Endorsed by'} {teacherName}
        </AppText>
        {item.teacherChainRef ? (
          <AppText variant="bodySmall" color={COLORS.textMuted} style={{ marginTop: 2 }}>
            {isAr ? 'السند: ' : 'Sanad: '}
            {item.teacherChainRef}
          </AppText>
        ) : null}

        <View style={styles.shareRow}>
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => handleShare(item.verificationToken)}
          >
            <Ionicons name="share-outline" size={16} color="#fff" />
            <AppText variant="bodySmall" color="#FFFFFF" style={{ marginStart: 6 }}>
              {isAr ? 'مشاركة' : 'Share'}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: COLORS.borderSubtle }]}
            onPress={() => handleRegenerateLink(item.id)}
          >
            <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </AppCard>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <IconButton
          colors={COLORS}
          icon={isAr ? 'chevron-forward' : 'chevron-back'}
          accessibilityLabel={isAr ? 'رجوع' : 'Back'}
          onPress={() => router.back()}
        />
        <AppText variant="titleLarge" color={COLORS.textPrimary}>
          {isAr ? 'الإجازات' : 'Ijazahs'}
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl * 2 }} color={COLORS.primary} />
      ) : error ? (
        <TouchableOpacity style={styles.errorBox} onPress={() => refetch()}>
          <AppText variant="bodyMedium" color={COLORS.error}>
            {isAr ? 'فشل التحميل' : 'Failed to load'}
          </AppText>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={ijazahs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 80 },
            ijazahs.length === 0 && styles.emptyContainer,
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              colors={COLORS}
              icon="ribbon-outline"
              title={isAr ? 'لا توجد إجازات بعد' : 'No ijazahs yet'}
              description={
                isAr
                  ? 'ستظهر هنا عندما يجيزك معلمك على إتمام سورة أو جزء.'
                  : "They'll appear here once your teacher formally endorses a completed portion."
              }
            />
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
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.md,
    },
    list: { padding: SPACING.lg, gap: SPACING.md },
    card: { borderWidth: 1, gap: SPACING.sm, ...SHADOWS.md },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    medal: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    divider: { height: StyleSheet.hairlineWidth },
    shareRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
    shareBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm,
    },
    iconBtn: {
      width: 40,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: { flex: 1, justifyContent: 'center' },
    errorBox: { margin: SPACING.md, alignItems: 'center' },
  });
}
