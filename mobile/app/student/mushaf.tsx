import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMushaf } from '@/src/hooks/useMushaf';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useThemeSettings } from '@/src/settings/store';
import { getColors, RADIUS, SPACING } from '@/constants/theme';
import { AppText } from '@/src/components/design';

const TOTAL_PAGES = 604;
type AudioModule = typeof import('expo-av');
type PlaybackRate = 0.75 | 1;

export default function MushafScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const { page, isLoading, error, fetchPage } = useMushaf();
  const [currentPage, setCurrentPage] = useState(1);
  const [playingAyahId, setPlayingAyahId] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const soundRef = useRef<any | null>(null);

  React.useEffect(() => {
    fetchPage(currentPage);
  }, [currentPage, fetchPage]);

  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync?.().catch(() => {});
      await soundRef.current.unloadAsync?.().catch(() => {});
      soundRef.current = null;
    }
    setPlayingAyahId(null);
  };

  // Stop playback when leaving the page (page change or unmount) — audio
  // should never keep playing for an ayah that's no longer on screen.
  useEffect(() => {
    return () => {
      stopPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const getAudio = async (): Promise<AudioModule | null> => {
    try {
      return await import('expo-av');
    } catch {
      Alert.alert(t('error'), t('audioNotAvailable'));
      return null;
    }
  };

  const togglePlayAyah = async (ayah: { id: number; audioUrl?: string | null }) => {
    if (!ayah.audioUrl) {
      Alert.alert(t('listenToAyah'), t('ayahAudioNotYetAvailable'));
      return;
    }

    if (playingAyahId === ayah.id && soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
        setPlayingAyahId(null);
        return;
      }
      if (status.isLoaded) {
        await soundRef.current.playAsync();
        setPlayingAyahId(ayah.id);
        return;
      }
    }

    await stopPlayback();

    const av = await getAudio();
    if (!av) return;
    const { Audio } = av;

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: ayah.audioUrl },
        { shouldPlay: true, rate: playbackRate, shouldCorrectPitch: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setPlayingAyahId(null);
          }
        }
      );
      soundRef.current = sound;
      setPlayingAyahId(ayah.id);
    } catch (err: any) {
      Alert.alert(t('error'), err?.message ?? String(err));
      await stopPlayback();
    }
  };

  const togglePlaybackSpeed = async () => {
    const nextRate: PlaybackRate = playbackRate === 1 ? 0.75 : 1;
    setPlaybackRate(nextRate);
    if (soundRef.current) {
      await soundRef.current.setRateAsync?.(nextRate, true).catch(() => {});
    }
  };

  const goNext = () => {
    if (currentPage < TOTAL_PAGES) setCurrentPage((p) => p + 1);
  };
  const goPrev = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

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
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
        <AppText variant="headlineSmall" color="#FFFFFF">
          {t('mushaf')}
        </AppText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={goPrev}
          disabled={currentPage <= 1}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isRTL ? 'chevron-forward-outline' : 'chevron-back-outline'}
            size={28}
            color={COLORS.primary}
          />
        </TouchableOpacity>
        <AppText variant="titleMedium" color={COLORS.textPrimary}>
          {t('pageNumber')} {currentPage}
        </AppText>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={goNext}
          disabled={currentPage >= TOTAL_PAGES}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isRTL ? 'chevron-back-outline' : 'chevron-forward-outline'}
            size={28}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.speedRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={playbackRate === 1 ? t('playbackSpeedNormal') : t('playbackSpeedSlow')}
          onPress={togglePlaybackSpeed}
          style={[styles.speedPill, { borderColor: COLORS.border, backgroundColor: COLORS.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="speedometer-outline" size={16} color={COLORS.primary} />
          <AppText variant="labelLarge" color={COLORS.primary} style={{ marginStart: SPACING.xs }}>
            {playbackRate === 1 ? '1×' : '0.75×'}
          </AppText>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : error ? (
        <View style={styles.center}>
          <AppText variant="bodyMedium" color={COLORS.textSecondary}>
            {error}
          </AppText>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => fetchPage(currentPage)}
            style={{ marginTop: SPACING.md }}
          >
            <AppText variant="bodyMedium" color={COLORS.primary}>
              {t('retry')}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : page ? (
        <View style={styles.page}>
          {page.ayahs.map((ayah) => {
            const isPlaying = playingAyahId === ayah.id;
            return (
              <View
                key={ayah.id}
                style={[
                  styles.ayah,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                  isPlaying && { backgroundColor: COLORS.primaryMuted },
                ]}
              >
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('listenToAyah')}
                  onPress={() => togglePlayAyah(ayah)}
                  style={styles.playButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={isPlaying ? 'pause-circle' : 'play-circle-outline'}
                    size={28}
                    color={ayah.audioUrl ? COLORS.primary : COLORS.textSecondary}
                  />
                </TouchableOpacity>
                <AppText
                  variant="bodyLarge"
                  color={COLORS.textPrimary}
                  style={{ flex: 1, textAlign: isRTL ? 'right' : 'left', writingDirection: 'rtl' }}
                >
                  {ayah.text ?? `${t('ayah')} ${ayah.number}`}
                </AppText>
              </View>
            );
          })}
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
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  speedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  page: { flex: 1, padding: SPACING.md },
  ayah: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderRadius: RADIUS.sm,
  },
  playButton: { paddingHorizontal: SPACING.xs },
});
