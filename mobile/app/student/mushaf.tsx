import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMushaf } from '@/src/hooks/useMushaf';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, RADIUS, SPACING } from '@/constants/theme';
import { AppCard, AppText } from '@/src/components/design';

const TOTAL_PAGES = 604;

export default function MushafScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { page, isLoading, error, fetchPage } = useMushaf();
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    fetchPage(currentPage);
  }, [currentPage, fetchPage]);

  const goNext = () => {
    if (currentPage < TOTAL_PAGES) setCurrentPage((p) => p + 1);
  };
  const goPrev = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
        <AppText variant="headlineSmall" color="#FFFFFF">{t('mushaf')}</AppText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity accessibilityRole="button" onPress={goPrev} disabled={currentPage <= 1} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isRTL ? 'chevron-forward-outline' : 'chevron-back-outline'} size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <AppText variant="titleMedium" color={COLORS.textPrimary}>
          {t('pageNumber')} {currentPage}
        </AppText>
        <TouchableOpacity accessibilityRole="button" onPress={goNext} disabled={currentPage >= TOTAL_PAGES} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isRTL ? 'chevron-back-outline' : 'chevron-forward-outline'} size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : error ? (
        <View style={styles.center}>
          <AppText variant="bodyMedium" color={COLORS.textSecondary}>{error}</AppText>
          <TouchableOpacity accessibilityRole="button" onPress={() => fetchPage(currentPage)} style={{ marginTop: SPACING.md }}>
            <AppText variant="bodyMedium" color={COLORS.primary}>{t('retry')}</AppText>
          </TouchableOpacity>
        </View>
      ) : page ? (
        <View style={styles.page}>
          {page.ayahs.map((ayah) => (
            <TouchableOpacity key={ayah.id} onLongPress={() => { /* TODO log memorization */ }} style={styles.ayah}>
              <AppText variant="bodyLarge" color={COLORS.textPrimary} style={{ textAlign: isRTL ? 'right' : 'left', writingDirection: 'rtl' }}>
                {ayah.text ?? `${t('ayah')} ${ayah.number}`}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  page: { flex: 1, padding: SPACING.md },
  ayah: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
});
