import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { Ionicons } from '@expo/vector-icons';
import { useRecordings } from '@/src/hooks/useRecordings';
import { Recording, getRecordingStatus } from '@/src/api';
import { Image } from 'expo-image';
import { mushafPageUri } from '@/src/lib/mushafAssets';
import { mushafApi } from '@/src/api/mushaf';
import { weakAyahsApi } from '@/src/api/weakAyahs';
import type { AyahDTO } from '@quran-review/shared';
import { SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

type AnyColors = ThemeColors;
type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type AudioModule = typeof import('expo-av');

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
// Strip trailing /api/vX from base to get the server host serving /uploads
const API_HOST = API_BASE.replace(/\/api\/v\d+\/?$/, '');

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const formatTime = (millis: number): string => {
  const total = Math.floor(millis / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const buildAudioUrl = (recording: Recording): string => {
  const url = recording.url || '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_HOST}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function TeacherRecordingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  const { recordings, loading, error, refresh, review } = useRecordings();

  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const soundRef = useRef<any | null>(null);

  // Review modal state
  const [reviewing, setReviewing] = useState<Recording | null>(null);
  const [reviewApproved, setReviewApproved] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Cleanup playback on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync?.().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return recordings;
    return recordings.filter((r) => getRecordingStatus(r) === filter);
  }, [recordings, filter]);

  const counts = useMemo(() => {
    const c = { ALL: recordings.length, PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const r of recordings) {
      const s = getRecordingStatus(r);
      c[s]++;
    }
    return c;
  }, [recordings]);

  const stopPlayback = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
      } catch {
        /* ignore */
      }
      try {
        await soundRef.current.unloadAsync();
      } catch {
        /* ignore */
      }
      soundRef.current = null;
    }
    setPlayingId(null);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
  };

  const getAudio = async (): Promise<AudioModule | null> => {
    try {
      const mod = await import('expo-av');
      return mod;
    } catch {
      Alert.alert(t('error'), t('audioNotAvailable'));
      return null;
    }
  };

  const togglePlay = async (rec: Recording) => {
    try {
      // Toggle pause/resume if same recording is loaded
      if (playingId === rec.id && soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlayingId(null);
          return;
        }
        if (status.isLoaded) {
          await soundRef.current.playAsync();
          setPlayingId(rec.id);
          return;
        }
      }

      // Switching to a new recording — stop the previous one
      await stopPlayback();

      const AudioMod = await getAudio();
      if (!AudioMod) return;

      await AudioMod.Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await AudioMod.Audio.Sound.createAsync(
        { uri: buildAudioUrl(rec) },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPlaybackPosition(status.positionMillis ?? 0);
          if (status.durationMillis) setPlaybackDuration(status.durationMillis);
          if (status.didJustFinish) {
            setPlayingId(null);
            setPlaybackPosition(0);
          }
        }
      );
      soundRef.current = sound;
      setPlayingId(rec.id);
    } catch (err: any) {
      Alert.alert(t('playRecording'), err?.message ?? String(err));
      await stopPlayback();
    }
  };

  const openReview = (rec: Recording, approved: boolean) => {
    setReviewing(rec);
    setReviewApproved(approved);
    setReviewNotes(rec.reviewNotes ?? '');
  };

  // Weak-ayah flag (F2/AC2.3): pick an ayah from the recited page, flag it
  // for the student — feeds the F3 revision queue's weak-page boost.
  const [flagAyahs, setFlagAyahs] = useState<AyahDTO[] | null>(null);
  const [flagLoading, setFlagLoading] = useState(false);

  const openFlagPicker = async () => {
    if (!reviewing?.page) return;
    setFlagLoading(true);
    try {
      const pageData = await mushafApi.getPage(reviewing.page);
      setFlagAyahs(pageData.ayahs);
    } catch {
      Alert.alert(t('error'), t('fetchError'));
    } finally {
      setFlagLoading(false);
    }
  };

  const flagAyah = async (ayahId: number) => {
    if (!reviewing) return;
    try {
      await weakAyahsApi.flag(reviewing.studentId, ayahId);
      setFlagAyahs(null);
      Alert.alert(t('weakAyahFlagged'));
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : String(err));
    }
  };

  const submitReview = async () => {
    if (!reviewing) return;
    setSubmittingReview(true);
    const result = await review(reviewing.id, reviewApproved, reviewNotes.trim() || undefined);
    setSubmittingReview(false);
    if (result) {
      setReviewing(null);
      setReviewNotes('');
      Alert.alert(t('reviewSuccess'));
    } else {
      Alert.alert(t('reviewFailed'), error ?? '');
    }
  };

  const renderItem = ({ item }: { item: Recording }) => (
    <TeacherRecordingCard
      recording={item}
      COLORS={COLORS}
      isRTL={isRTL}
      isPlaying={playingId === item.id}
      playbackPosition={playingId === item.id ? playbackPosition : 0}
      playbackDuration={playingId === item.id ? playbackDuration : 0}
      onTogglePlay={() => togglePlay(item)}
      onApprove={() => openReview(item, true)}
      onReject={() => openReview(item, false)}
    />
  );

  const FilterChip = ({ value, label, count }: { value: FilterStatus; label: string; count: number }) => {
    const active = filter === value;
    return (
      <TouchableOpacity
        onPress={() => setFilter(value)}
        style={[
          styles.chip,
          {
            backgroundColor: active ? COLORS.primary : COLORS.surface,
            borderColor: active ? COLORS.primary : COLORS.surfaceAlt,
          },
        ]}
      >
        <Text style={[styles.chipText, { color: active ? '#fff' : COLORS.textSecondary }]}>
          {label} <Text style={{ fontWeight: '800' }}>{count}</Text>
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
            style={styles.backText}
          />
        </TouchableOpacity>
        <Text style={styles.title}>{t('recordings')}</Text>
        <Text style={styles.subtitle}>
          {recordings.length} {t('recordingsCount')}
        </Text>
      </View>

      <View style={styles.filtersRow}>
        <FilterChip value="ALL" label={t('overview')} count={counts.ALL} />
        <FilterChip value="PENDING" label={t('recordingPending')} count={counts.PENDING} />
        <FilterChip value="APPROVED" label={t('approved')} count={counts.APPROVED} />
        <FilterChip value="REJECTED" label={t('rejected')} count={counts.REJECTED} />
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.error, marginBottom: SPACING.md, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
            ) : (
              <View style={styles.center}>
                <Text style={{ fontSize: 40, marginBottom: SPACING.md }}>🎧</Text>
                <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>{t('noRecordings')}</Text>
              </View>
            )
          }
        />
      )}

      <BottomNav role="teacher" active="reviews" />
      {/* Review modal */}
      <Modal visible={reviewing !== null} animationType="slide" transparent onRequestClose={() => setReviewing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: COLORS.surface }]}>
            <View style={[styles.modalAccent, { backgroundColor: reviewApproved ? COLORS.success : COLORS.error }]} />
            <Text style={[styles.modalTitle, { color: COLORS.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
              {reviewApproved ? t('approveRecording') : t('rejectRecording')}
            </Text>
            {reviewing ? (
              <>
                <Text style={[styles.modalStudent, { color: COLORS.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {reviewing.student
                    ? `${reviewing.student.firstName} ${reviewing.student.lastName}`
                    : t('unknownStudent')}
                </Text>
                <Text style={[styles.modalFile, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {reviewing.fileName}
                </Text>
                {reviewing.page ? (
                  <>
                    {/* AC2.2: the exact recited page beside the audio */}
                    <Image
                      source={{ uri: mushafPageUri(reviewing.page) }}
                      style={{ width: '100%', height: 240, borderRadius: RADIUS.md, marginTop: SPACING.sm }}
                      contentFit="contain"
                      cachePolicy="disk"
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('flagWeakAyah')}
                      onPress={openFlagPicker}
                      disabled={flagLoading}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: SPACING.xs,
                        alignSelf: isRTL ? 'flex-end' : 'flex-start',
                        paddingVertical: SPACING.xs,
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {flagLoading ? (
                        <ActivityIndicator size="small" color={COLORS.warning} />
                      ) : (
                        <Ionicons name="flag-outline" size={16} color={COLORS.warning} />
                      )}
                      <Text style={{ color: COLORS.warning, fontSize: 13, fontWeight: '700' }}>
                        {t('flagWeakAyah')}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </>
            ) : null}

            <Text style={[styles.modalLabel, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('reviewNotes')}
            </Text>
            <TextInput
              value={reviewNotes}
              onChangeText={setReviewNotes}
              placeholder={t('reviewNotesPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              multiline
              style={[
                styles.modalInput,
                {
                  borderColor: COLORS.surfaceAlt,
                  color: COLORS.textPrimary,
                  backgroundColor: COLORS.background,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setReviewing(null)}
                style={[styles.modalBtn, { backgroundColor: COLORS.surfaceAlt }]}
                disabled={submittingReview}
              >
                <Text style={[styles.modalBtnText, { color: COLORS.textPrimary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitReview}
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: reviewApproved ? COLORS.success : COLORS.error,
                    opacity: submittingReview ? 0.6 : 1,
                  },
                ]}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                    {reviewApproved ? t('approveRecording') : t('rejectRecording')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Weak-ayah picker: the recited page's ayahs, one tap to flag (AC2.3). */}
      <Modal visible={flagAyahs !== null} animationType="slide" transparent onRequestClose={() => setFlagAyahs(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: COLORS.surface, maxHeight: '75%' }]}>
            <Text style={[styles.modalTitle, { color: COLORS.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('flagWeakAyah')}
            </Text>
            <ScrollView>
              {(flagAyahs ?? []).map((ayah) => (
                <TouchableOpacity
                  key={ayah.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('ayah')} ${ayah.number}`}
                  onPress={() => flagAyah(ayah.id)}
                  style={{
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: COLORS.surfaceAlt,
                  }}
                >
                  <Text
                    style={{ color: COLORS.textPrimary, fontSize: 15, textAlign: 'right', writingDirection: 'rtl' }}
                    numberOfLines={2}
                  >
                    ({ayah.number}) {ayah.text ?? `${t('ayah')} ${ayah.number}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('cancel')}
              onPress={() => setFlagAyahs(null)}
              style={[styles.modalBtn, { backgroundColor: COLORS.surfaceAlt, marginTop: SPACING.sm }]}
            >
              <Text style={[styles.modalBtnText, { color: COLORS.textPrimary }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

interface TeacherCardProps {
  recording: Recording;
  COLORS: AnyColors;
  isRTL: boolean;
  isPlaying: boolean;
  playbackPosition: number;
  playbackDuration: number;
  onTogglePlay: () => void;
  onApprove: () => void;
  onReject: () => void;
}

function TeacherRecordingCard({
  recording,
  COLORS,
  isRTL,
  isPlaying,
  playbackPosition,
  playbackDuration,
  onTogglePlay,
  onApprove,
  onReject,
}: TeacherCardProps) {
  const { t, i18n } = useTranslation();
  const status = getRecordingStatus(recording);
  const studentName = recording.student
    ? `${recording.student.firstName} ${recording.student.lastName}`.trim()
    : t('unknownStudent');

  const statusColor = status === 'APPROVED' ? COLORS.success : status === 'REJECTED' ? COLORS.error : COLORS.warning;
  const statusBg =
    status === 'APPROVED' ? COLORS.successLight : status === 'REJECTED' ? COLORS.errorLight : COLORS.warningLight;
  const statusLabel =
    status === 'APPROVED' ? t('approved') : status === 'REJECTED' ? t('rejected') : t('recordingPending');

  const progress = playbackDuration > 0 ? Math.min(1, playbackPosition / playbackDuration) : 0;

  return (
    <View
      style={[
        cardStyles.card,
        {
          backgroundColor: COLORS.surface,
          borderLeftColor: statusColor,
          borderLeftWidth: isRTL ? 0 : 4,
          borderRightColor: statusColor,
          borderRightWidth: isRTL ? 4 : 0,
        },
      ]}
    >
      <View style={[cardStyles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[cardStyles.avatar, { backgroundColor: COLORS.primaryMuted }]}>
          <Text style={[cardStyles.avatarText, { color: COLORS.primary }]}>{studentName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginHorizontal: SPACING.md }}>
          <Text style={[cardStyles.studentName, { color: COLORS.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
            {studentName}
          </Text>
          <Text
            style={[cardStyles.fileName, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}
            numberOfLines={1}
          >
            {recording.fileName}
          </Text>
          {recording.page ? (
            <Text style={[cardStyles.fileName, { color: COLORS.primary, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('pageNumber')} {recording.page}
            </Text>
          ) : null}
        </View>
        <View style={[cardStyles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[cardStyles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={[cardStyles.meta, { color: COLORS.textMuted }]}>
        {formatBytes(recording.fileSizeBytes)} ·{' '}
        {new Date(recording.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </Text>
      <Text style={[cardStyles.meta, { color: COLORS.textMuted }]}>
        {recording.scoreStatus === 'SCORED' && recording.accuracyScore != null
          ? `${t('automatedScoreLabel')}: ${Math.round(recording.accuracyScore)}%`
          : t('automatedScoreUnavailable')}
      </Text>

      {/* Playback row */}
      <View style={[cardStyles.playRow, { backgroundColor: COLORS.background }]}>
        <TouchableOpacity
          onPress={onTogglePlay}
          style={[cardStyles.playBtn, { backgroundColor: COLORS.primary }]}
          accessibilityLabel={isPlaying ? t('pauseRecording') : t('playRecording')}
        >
          <Text style={cardStyles.playBtnIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: SPACING.md }}>
          <View style={[cardStyles.progressTrack, { backgroundColor: COLORS.surfaceAlt }]}>
            <View
              style={[
                cardStyles.progressFill,
                { backgroundColor: COLORS.primary, width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
          <Text style={[cardStyles.playTime, { color: COLORS.textSecondary }]}>
            {formatTime(playbackPosition)} {playbackDuration > 0 ? `/ ${formatTime(playbackDuration)}` : ''}
          </Text>
        </View>
      </View>

      {recording.reviewNotes ? (
        <View style={[cardStyles.notesBox, { backgroundColor: COLORS.surfaceAlt }]}>
          <Text style={[cardStyles.notesLabel, { color: COLORS.textSecondary }]}>{t('reviewNotes')}</Text>
          <Text style={[cardStyles.notesText, { color: COLORS.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
            {recording.reviewNotes}
          </Text>
        </View>
      ) : null}

      {status === 'PENDING' && (
        <View style={cardStyles.actionRow}>
          <TouchableOpacity onPress={onReject} style={[cardStyles.actionBtn, { backgroundColor: COLORS.errorLight }]}>
            <Text style={[cardStyles.actionBtnText, { color: COLORS.error }]}>{t('rejectRecording')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onApprove} style={[cardStyles.actionBtn, { backgroundColor: COLORS.success }]}>
            <Text style={[cardStyles.actionBtnText, { color: '#fff' }]}>{t('approveRecording')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOWS.sm, gap: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  studentName: { fontSize: 15, fontWeight: '700' },
  fileName: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  meta: { fontSize: 11, marginTop: 2 },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
  },
  playBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  playBtnIcon: { color: '#fff', fontSize: 12, fontWeight: '800' },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },
  playTime: { fontSize: 11, marginTop: 4 },
  notesBox: { padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.sm },
  notesLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 13, lineHeight: 19 },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actionBtn: { flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
});

const createStyles = (COLORS: AnyColors) =>
  StyleSheet.create({
    header: {
      padding: SPACING.xl,
      paddingTop: SPACING.lg,
      borderBottomLeftRadius: RADIUS['2xl'],
      borderBottomRightRadius: RADIUS['2xl'],
      ...SHADOWS.lg,
    },
    backText: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: SPACING.sm },
    title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
    subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

    filtersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
    },
    chip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      borderWidth: 1,
    },
    chipText: { fontSize: 12, fontWeight: '600' },

    list: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: SPACING['3xl'] },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['3xl'] },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.sm },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalCard: {
      borderTopLeftRadius: RADIUS['2xl'],
      borderTopRightRadius: RADIUS['2xl'],
      padding: SPACING.xl,
      paddingBottom: SPACING['3xl'],
      gap: SPACING.sm,
    },
    modalAccent: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: SPACING.md },
    modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: SPACING.sm },
    modalStudent: { fontSize: 15, fontWeight: '700' },
    modalFile: { fontSize: 12, marginBottom: SPACING.md },
    modalLabel: { fontSize: 12, fontWeight: '600', marginTop: SPACING.sm, marginBottom: 4 },
    modalInput: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      minHeight: 90,
      fontSize: 14,
      textAlignVertical: 'top',
    },
    modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
    modalBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
    modalBtnText: { fontSize: 14, fontWeight: '700' },
  });
