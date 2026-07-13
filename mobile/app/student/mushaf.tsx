import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { RADIUS, SPACING } from '@/constants/theme';
import { AppText } from '@/src/components/design';
import { useTheme } from '@/src/hooks/useTheme';
import { mushafApi } from '@/src/api/mushaf';

const TOTAL_PAGES = 604;

// The Mushaf pages are served as static images by the API, one WebP per page,
// under /mushaf-pages/<page>.webp (see packages/server/scripts/extract_mushaf_pages.py).
// The API base ends in /api/v1; the image host is the same origin without it.
function getImageOrigin(): string {
  const base =
    process.env.EXPO_PUBLIC_API_URL ??
    (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api/v1' : 'http://localhost:4000/api/v1');
  return base.replace(/\/api\/v1\/?$/, '');
}
const IMAGE_ORIGIN = getImageOrigin();
const pageUri = (page: number) => `${IMAGE_ORIGIN}/mushaf-pages/${page}.webp`;

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

export default function MushafScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const { width: W } = useWindowDimensions();

  const listRef = useRef<FlatList<number>>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [juz, setJuz] = useState<number | null>(null);

  // Juz label for the toolbar — best-effort, never blocks the image.
  React.useEffect(() => {
    let active = true;
    mushafApi
      .getPage(currentPage)
      .then((p) => {
        if (active) setJuz(p.juz ?? null);
      })
      .catch(() => {
        if (active) setJuz(null);
      });
    return () => {
      active = false;
    };
  }, [currentPage]);

  const goToPage = useCallback((page: number) => {
    const clamped = Math.min(TOTAL_PAGES, Math.max(1, page));
    setCurrentPage(clamped);
    listRef.current?.scrollToIndex({ index: clamped - 1, animated: true });
  }, []);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (W === 0) return;
      const index = Math.round(e.nativeEvent.contentOffset.x / W);
      const page = index + 1;
      setCurrentPage((prev) => (prev === page ? prev : page));
    },
    [W]
  );

  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: W, offset: W * index, index }), [W]);

  const renderPage = useCallback(
    ({ item }: { item: number }) => (
      <ScrollView
        style={{ width: W }}
        contentContainerStyle={styles.zoomContent}
        maximumZoomScale={4}
        minimumZoomScale={1}
        bouncesZoom
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: pageUri(item) }}
          style={{ width: W, height: bodyHeight || undefined, flex: bodyHeight ? undefined : 1 }}
          contentFit="contain"
          cachePolicy="disk"
          transition={120}
          recyclingKey={String(item)}
        />
      </ScrollView>
    ),
    [W, bodyHeight]
  );

  // Prev/next respect reading direction: in RTL "next" advances the page number.
  const prevChevron = isRTL ? 'chevron-forward-outline' : 'chevron-back-outline';
  const nextChevron = isRTL ? 'chevron-back-outline' : 'chevron-forward-outline';

  const initialIndex = useMemo(() => currentPage - 1, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.9)"
          />
        </TouchableOpacity>
        <AppText variant="headlineSmall" color="#FFFFFF">
          {t('mushaf')}
        </AppText>
        <View style={{ width: 24 }} />
      </View>

      <View
        style={styles.body}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          setBodyHeight((prev) => (prev === h ? prev : h));
        }}
      >
        {W > 0 && (
          <FlatList
            ref={listRef}
            data={PAGES}
            keyExtractor={(p) => String(p)}
            renderItem={renderPage}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={getItemLayout}
            onMomentumScrollEnd={onMomentumEnd}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews
            ListEmptyComponent={<ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />}
          />
        )}
      </View>

      <View style={[styles.toolbar, { borderTopColor: COLORS.borderSubtle, backgroundColor: COLORS.surface }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('previous')}
          onPress={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{ opacity: currentPage <= 1 ? 0.35 : 1 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={prevChevron} size={28} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <AppText variant="titleMedium" color={COLORS.textPrimary}>
            {t('pageNumber')} {currentPage} / {TOTAL_PAGES}
          </AppText>
          {juz != null && (
            <AppText variant="labelLarge" color={COLORS.textSecondary}>
              {t('juz')} {juz}
            </AppText>
          )}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('next')}
          onPress={() => goToPage(currentPage + 1)}
          disabled={currentPage >= TOTAL_PAGES}
          style={{ opacity: currentPage >= TOTAL_PAGES ? 0.35 : 1 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={nextChevron} size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
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
  body: { flex: 1 },
  zoomContent: { flexGrow: 1, justifyContent: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
