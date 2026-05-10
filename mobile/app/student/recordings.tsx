import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useRecordings } from '@/src/hooks/useRecordings';
import { Recording, getRecordingStatus } from '@/src/api';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';

type AnyColors = ReturnType<typeof getColors>;

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

const formatDuration = (millis: number): string => {
  const total = Math.floor(millis / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function StudentRecordingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  const { recordings, loading, error, refresh, upload } = useRecordings();

  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState<any | null>(null);
  const [recordingMillis, setRecordingMillis] = useState(0);
  const recordingStartRef = useRef<number | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Stop any active recording on unmount
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync?.().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    try {
      if (!Audio?.requestPermissionsAsync) {
        Alert.alert(t('error'), t('audioNotAvailable'));
        return;
      }
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('recordAudio'), t('micPermissionDenied'));
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.isRecording && status.durationMillis != null) {
            setRecordingMillis(status.durationMillis);
          }
        },
        500
      );
      recordingStartRef.current = Date.now();
      setRecording(rec);
      setRecordingMillis(0);
    } catch (err: any) {
      Alert.alert(t('error'), err?.message ?? String(err));
    }
  };

  const stopAndUploadRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert(t('uploadFailed'));
        return;
      }

      // Reset audio mode so playback works after recording
      if (Audio?.setAudioModeAsync) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      }

      const ext = (uri.split('.').pop() ?? 'm4a').toLowerCase();
      const fileName = `recitation-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
      const contentType =
        ext === 'm4a' ? 'audio/x-m4a' : ext === 'mp4' ? 'audio/mp4' : ext === 'wav' ? 'audio/wav' : 'audio/mpeg';

      await uploadFromUri(uri, fileName, contentType, 0);
    } catch (err: any) {
      Alert.alert(t('uploadFailed'), err?.message ?? String(err));
      setRecording(null);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync?.();
    } catch {
      /* ignore */
    }
    setRecording(null);
    setRecordingMillis(0);
  };

  const pickAudio = async () => {
    try {
      // Guard against missing native module (Expo Go without expo-document-picker)
      if (!DocumentPicker.getDocumentAsync) {
        Alert.alert(t('error'), t('documentPickerNotAvailable') ?? 'File picker is not available in this environment.');
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      const fileName = asset.name || 'audio.mp3';
      const contentType = asset.mimeType || 'audio/mpeg';
      await uploadFromUri(asset.uri, fileName, contentType, asset.size ?? 0);
    } catch (err: any) {
      Alert.alert(t('uploadFailed'), err?.message ?? String(err));
    }
  };

  const uploadFromUri = async (uri: string, fileName: string, contentType: string, sizeBytes: number) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace(/^file:\/\//, '') : uri,
        name: fileName,
        type: contentType,
      } as unknown as Blob);
      formData.append('fileName', fileName);
      formData.append('fileSizeBytes', String(sizeBytes));
      formData.append('contentType', contentType);
      const created = await upload(formData);
      if (!created) {
        Alert.alert(t('uploadFailed'), error ?? '');
      }
    } finally {
      setUploading(false);
    }
  };

  const renderItem = ({ item }: { item: Recording }) => (
    <RecordingCard recording={item} COLORS={COLORS} isRTL={isRTL} />
  );

  const isRecording = recording !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={[styles.backText, { transform: [{ scaleX: isRTL ? -1 : 1 }] }]}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('recordings')}</Text>
        <Text style={styles.subtitle}>
          {recordings.length} {t('recordingsCount')}
        </Text>
      </View>

      {/* Action area */}
      <View style={styles.actionWrap}>
        {isRecording ? (
          <View style={[styles.recordingBanner, { backgroundColor: COLORS.errorLight, borderColor: COLORS.error }]}>
            <View style={[styles.pulseDot, { backgroundColor: COLORS.error }]} />
            <View style={{ flex: 1, marginHorizontal: SPACING.md }}>
              <Text style={[styles.recordingLabel, { color: COLORS.error }]}>{t('recordingInProgress')}</Text>
              <Text style={[styles.recordingTime, { color: COLORS.textPrimary }]}>
                {formatDuration(recordingMillis)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={cancelRecording}
              style={[styles.smallBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.error }]}
              accessibilityLabel={t('cancel')}
            >
              <Text style={[styles.smallBtnText, { color: COLORS.error }]}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={stopAndUploadRecording}
              style={[
                styles.smallBtn,
                { backgroundColor: COLORS.error, marginStart: SPACING.sm, borderColor: COLORS.error },
              ]}
              accessibilityLabel={t('stopRecording')}
            >
              <Text style={[styles.smallBtnText, { color: '#fff' }]}>■</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={startRecording}
              disabled={uploading}
              activeOpacity={0.85}
              style={[styles.actionBtn, { backgroundColor: COLORS.primary, opacity: uploading ? 0.5 : 1 }]}
            >
              <Text style={styles.actionIcon}>●</Text>
              <Text style={styles.actionLabel}>{t('recordAudio')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickAudio}
              disabled={uploading}
              activeOpacity={0.85}
              style={[
                styles.actionBtn,
                styles.actionBtnAlt,
                { backgroundColor: COLORS.surface, borderColor: COLORS.primary, opacity: uploading ? 0.5 : 1 },
              ]}
            >
              <Text style={[styles.actionIcon, { color: COLORS.primary }]}>♪</Text>
              <Text style={[styles.actionLabel, { color: COLORS.primary }]}>{t('pickAudioFile')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {uploading && (
          <View style={[styles.uploadingBar, { backgroundColor: COLORS.primaryMuted }]}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={[styles.uploadingText, { color: COLORS.primary }]}>{t('uploadInProgress')}</Text>
          </View>
        )}
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
          data={recordings}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
            ) : (
              <View style={styles.center}>
                <Text style={{ fontSize: 40, marginBottom: SPACING.md }}>🎙️</Text>
                <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>{t('noRecordings')}</Text>
                <Text style={{ color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                  {t('noRecordingsDesc')}
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Recording Card ────────────────────────────────────────────────────────────

function RecordingCard({ recording, COLORS, isRTL }: { recording: Recording; COLORS: AnyColors; isRTL: boolean }) {
  const { t, i18n } = useTranslation();
  const status = getRecordingStatus(recording);

  const statusColor = status === 'APPROVED' ? COLORS.success : status === 'REJECTED' ? COLORS.error : COLORS.warning;
  const statusBg =
    status === 'APPROVED' ? COLORS.successLight : status === 'REJECTED' ? COLORS.errorLight : COLORS.warningLight;
  const statusLabel =
    status === 'APPROVED'
      ? t('recordingApproved')
      : status === 'REJECTED'
        ? t('recordingRejected')
        : t('recordingPending');

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
      <View style={[cardStyles.statusBadge, { backgroundColor: statusBg }]}>
        <Text style={[cardStyles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
      <Text
        style={[cardStyles.fileName, { color: COLORS.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}
        numberOfLines={1}
      >
        {recording.fileName}
      </Text>
      <Text style={[cardStyles.meta, { color: COLORS.textSecondary }]}>
        {formatBytes(recording.fileSizeBytes)} ·{' '}
        {new Date(recording.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </Text>
      {recording.reviewNotes ? (
        <View style={[cardStyles.notesBox, { backgroundColor: COLORS.surfaceAlt }]}>
          <Text style={[cardStyles.notesLabel, { color: COLORS.textSecondary }]}>{t('teacherNotes')}</Text>
          <Text style={[cardStyles.notesText, { color: COLORS.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
            {recording.reviewNotes}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOWS.sm },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  fileName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  meta: { fontSize: 12 },
  notesBox: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md },
  notesLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 13, lineHeight: 19 },
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

    actionWrap: { padding: SPACING.xl, gap: SPACING.md },
    actionRow: { flexDirection: 'row', gap: SPACING.md },
    actionBtn: {
      flex: 1,
      paddingVertical: SPACING.lg,
      borderRadius: RADIUS.xl,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.sm,
    },
    actionBtnAlt: { borderWidth: 1.5 },
    actionIcon: { fontSize: 22, color: '#fff', marginBottom: 4 },
    actionLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },

    recordingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.lg,
      borderRadius: RADIUS.xl,
      borderWidth: 1.5,
    },
    pulseDot: { width: 12, height: 12, borderRadius: 6 },
    recordingLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    recordingTime: { fontSize: 18, fontWeight: '800', marginTop: 2 },
    smallBtn: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    smallBtnText: { fontSize: 16, fontWeight: '800' },

    uploadingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
    },
    uploadingText: { fontSize: 13, fontWeight: '600' },

    list: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: SPACING['4xl'] },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['3xl'] },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.sm },
  });
