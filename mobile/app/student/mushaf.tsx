import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewToken,
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
import { mushafPageUri as pageUri, TOTAL_MUSHAF_PAGES as TOTAL_PAGES } from '@/src/lib/mushafAssets';
import { useMushafPages } from '@/src/hooks/useMushafPages';
import type { PageStatus } from '@/src/api/mushafPages';

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

const STATUS_ORDER: PageStatus[] = ['NOT_STARTED', 'LEARNING', 'MEMORIZED', 'SOLID'];

export default function MushafScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const { width: W, height: H } = useWindowDimensions();

  const listRef = useRef<FlatList<number>>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [juz, setJuz] = useState<number | null>(null);
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const { statuses, setStatus } = useMushafPages();

  // Status → label/color. Gold marks the earned states only (Rationed Gold);
  // the text label always accompanies the dot (Status-Is-Not-Only-Color).
  const statusMeta = useCallback(
    (s: PageStatus) =>
      ({
        NOT_STARTED: { label: t('statusNotStarted'), color: COLORS.textSecondary },
        LEARNING: { label: t('statusLearning'), color: COLORS.primary },
        MEMORIZED: { label: t('statusMemorized'), color: COLORS.gold },
        SOLID: { label: t('statusSolid'), color: COLORS.gold },
      })[s],
    [t, COLORS]
  );
  const currentStatus: PageStatus = statuses.get(currentPage) ?? 'NOT_STARTED';

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

  // Track the visible page by index — robust to LTR/RTL scroll mirroring, unlike
  // manual contentOffset math. Kept in a ref: RN forbids changing these on the fly.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setCurrentPage(first.index + 1);
  }).current;

  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: W, offset: W * index, index }), [W]);

  const renderPage = useCallback(
    ({ item }: { item: number }) => (
      <Pressable
        onPress={() => setZoomPage(item)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`${t('pageNumber')} ${item}`}
        style={{ width: W, height: bodyHeight, alignItems: 'center', justifyContent: 'center' }}
      >
        <Image
          source={{ uri: pageUri(item) }}
          style={{ width: W, height: bodyHeight || undefined, flex: bodyHeight ? undefined : 1 }}
          contentFit="contain"
          cachePolicy="disk"
          transition={100}
          recyclingKey={String(item)}
        />
      </Pressable>
    ),
    [W, bodyHeight, t]
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
        {W > 0 && bodyHeight > 0 && (
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
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            initialNumToRender={2}
            maxToRenderPerBatch={3}
            windowSize={5}
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

        <View style={{ alignItems: 'center', gap: 4 }}>
          <AppText variant="titleMedium" color={COLORS.textPrimary}>
            {t('pageNumber')} {currentPage} / {TOTAL_PAGES}
          </AppText>
          {juz != null && (
            <AppText variant="labelLarge" color={COLORS.textSecondary}>
              {t('juz')} {juz}
            </AppText>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('pageStatus')}
            onPress={() => setStatusPickerOpen(true)}
            style={[styles.statusChip, { borderColor: statusMeta(currentStatus).color }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.statusDot, { backgroundColor: statusMeta(currentStatus).color }]} />
            <AppText variant="labelLarge" color={statusMeta(currentStatus).color}>
              {statusMeta(currentStatus).label}
            </AppText>
          </TouchableOpacity>
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

      {/* Page memorization status picker (F1): mark the current page in 2 taps. */}
      <Modal
        visible={statusPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusPickerOpen(false)}
      >
        <Pressable style={styles.statusBackdrop} onPress={() => setStatusPickerOpen(false)}>
          <Pressable style={[styles.statusSheet, { backgroundColor: COLORS.surface }]} onPress={() => {}}>
            <AppText variant="titleMedium" color={COLORS.textPrimary} style={{ textAlign: 'center' }}>
              {t('pageStatus')} — {t('pageNumber')} {currentPage}
            </AppText>
            {STATUS_ORDER.map((s) => {
              const meta = statusMeta(s);
              const selected = s === currentStatus;
              return (
                <TouchableOpacity
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={meta.label}
                  onPress={() => {
                    setStatusPickerOpen(false);
                    setStatus(currentPage, s).catch(() => {});
                  }}
                  style={[
                    styles.statusOption,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                    selected && { backgroundColor: COLORS.primaryMuted },
                  ]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                  <AppText
                    variant="bodyMedium"
                    color={selected ? COLORS.primary : COLORS.textPrimary}
                    style={{ flex: 1 }}
                  >
                    {meta.label}
                  </AppText>
                  {selected ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tap-to-zoom: a standalone zoomable image (no paging to fight the pinch). */}
      <Modal visible={zoomPage != null} transparent={false} onRequestClose={() => setZoomPage(null)}>
        <View style={styles.zoomModal}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ width: W, height: H }}
            maximumZoomScale={5}
            minimumZoomScale={1}
            bouncesZoom
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {zoomPage != null && (
              <Image
                source={{ uri: pageUri(zoomPage) }}
                style={{ width: W, height: H }}
                contentFit="contain"
                cachePolicy="disk"
              />
            )}
          </ScrollView>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={() => setZoomPage(null)}
            style={styles.zoomClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  statusSheet: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  statusOption: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  zoomModal: { flex: 1, backgroundColor: '#000000' },
  zoomClose: {
    position: 'absolute',
    top: 44,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
