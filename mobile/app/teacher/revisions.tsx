import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { Revision, appointmentsApi, memorizationApi, weakAyahsApi } from '@/src/api';
import { mushafApi } from '@/src/api/mushaf';
import type { AyahDTO } from '@quran-review/shared';
import { useRevisions } from '@/src/hooks/useRevisions';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface SurahOption {
  id: number;
  nameAr: string;
  nameEn: string;
}

function formatDate(dateStr: string, lang: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function statusTone(status: string): 'success' | 'warning' | 'error' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'MISSED') return 'error';
  return 'warning';
}

export default function TeacherRevisionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const { revisions, isLoading, error, fetchRevisions, createRevision, markRevision, removeRevision } = useRevisions();

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [surahs, setSurahs] = useState<SurahOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'SURAH' | 'DRILL'>('SURAH');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [surahAyahs, setSurahAyahs] = useState<AyahDTO[]>([]);
  const [ayahNumberStr, setAyahNumberStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMeta = useCallback(async () => {
    try {
      const [apptsRes, surahsRes] = await Promise.all([appointmentsApi.getMine(), memorizationApi.getSurahs()]);
      const accepted = apptsRes
        .filter((a) => a.status === 'ACCEPTED' && a.student)
        .map((a) => ({ id: a.student!.id, firstName: a.student!.firstName, lastName: a.student!.lastName }));
      const unique = accepted.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
      setStudents(unique);
      if (unique.length > 0) setSelectedStudentId(unique[0].id);

      const mapped: SurahOption[] = surahsRes.map((s: any) => ({
        id: s.id ?? s.number,
        nameAr: s.nameAr ?? String(s.id ?? s.number),
        nameEn: s.nameEn ?? String(s.id ?? s.number),
      }));
      setSurahs(mapped);
      if (mapped.length > 0) setSelectedSurahId(mapped[0].id);
    } catch {
      // non-fatal — form will show empty pickers
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    fetchMeta();
    fetchRevisions();
  }, [fetchMeta, fetchRevisions]);

  useEffect(() => {
    if (mode !== 'DRILL' || !selectedSurahId) {
      setSurahAyahs([]);
      return;
    }
    let cancelled = false;
    mushafApi
      .getSurah(selectedSurahId)
      .then((surah) => {
        if (!cancelled) setSurahAyahs(surah.ayahs ?? []);
      })
      .catch(() => {
        if (!cancelled) setSurahAyahs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedSurahId]);

  const handleAdd = async () => {
    if (!selectedStudentId || !selectedSurahId) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (mode === 'DRILL') {
      const ayahNumber = parseInt(ayahNumberStr, 10);
      const ayah = surahAyahs.find((a) => a.number === ayahNumber);
      if (!ayah) {
        Alert.alert(t('error'), isAr ? 'رقم الآية غير صحيح لهذه السورة' : 'That ayah number is not in this surah');
        return;
      }
      setIsSubmitting(true);
      try {
        await weakAyahsApi.flag(selectedStudentId, ayah.id);
        Alert.alert(t('success'), isAr ? 'تم تحديد الآية كضعيفة' : 'Ayah flagged as weak');
        setShowForm(false);
        setAyahNumberStr('');
        await fetchRevisions();
      } catch (err: any) {
        Alert.alert(t('error'), err?.response?.data?.error ?? err?.message ?? t('failedToAddRevision'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!scheduledDate) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      Alert.alert(t('error'), t('invalidDate'));
      return;
    }
    setIsSubmitting(true);
    try {
      await createRevision(selectedStudentId, selectedSurahId, scheduledDate + 'T00:00:00.000Z');
      Alert.alert(t('success'), t('revisionAdded'));
      setShowForm(false);
      setScheduledDate('');
    } catch (err: any) {
      Alert.alert(t('error'), err?.message ?? t('failedToAddRevision'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMark = (item: Revision, status: 'COMPLETED' | 'MISSED') => {
    const label = status === 'COMPLETED' ? t('markCompleted') : t('markMissed');
    Alert.alert(label, isAr ? 'هل أنت متأكد؟' : 'Are you sure?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          try {
            await markRevision(item.id, status);
          } catch {
            Alert.alert(t('error'), t('failedToMarkRevision'));
          }
        },
      },
    ]);
  };

  const handleDelete = (item: Revision) => {
    Alert.alert(t('deleteRevision'), t('confirmDeleteRevision'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: isAr ? 'حذف' : 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeRevision(item.id);
          } catch {
            Alert.alert(t('error'), t('failedToDeleteRevision'));
          }
        },
      },
    ]);
  };

  const TONE_COLORS = {
    success: COLORS.success,
    warning: (COLORS as any).warning ?? '#f59e0b',
    error: COLORS.error ?? '#ef4444',
  };

  const STATUS_LABELS: Record<string, string> = {
    PENDING: t('statusPending'),
    COMPLETED: t('statusCompleted'),
    MISSED: t('statusMissed'),
  };

  const renderItem = ({ item }: { item: Revision }) => {
    const tone = statusTone(item.status);
    const toneColor = TONE_COLORS[tone];
    const isDrill = item.ayahId != null;
    const surahName = isAr
      ? (item.surah?.name ?? String(item.surahId))
      : (item.surah?.englishName ?? String(item.surahId));

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: COLORS.surface, borderLeftColor: toneColor },
          isDrill && { backgroundColor: TONE_COLORS.warning + '11' },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            {isDrill ? (
              <View style={styles.drillBadge}>
                <Ionicons name="flash-outline" size={13} color={TONE_COLORS.warning} />
                <Text style={[styles.drillBadgeText, { color: TONE_COLORS.warning }]}>
                  {isAr ? 'تدريب على آية ضعيفة' : 'Weak-spot drill'}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.surahName, { color: COLORS.text }]}>
              {surahName}
              {isDrill && item.ayah?.number != null ? ` — ${isAr ? 'آية' : 'Ayah'} ${item.ayah.number}` : ''}
            </Text>
            {item.surah?.juzNumber != null && (
              <Text style={[styles.meta, { color: COLORS.textSecondary }]}>
                {t('juz')} {item.surah.juzNumber}
              </Text>
            )}
            <Text style={[styles.meta, { color: COLORS.textSecondary }]}>
              {formatDate(item.scheduledFor, i18n.language)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: SPACING.xs }}>
            <View style={[styles.statusBadge, { backgroundColor: toneColor + '22' }]}>
              <Text style={[styles.statusText, { color: toneColor }]}>{STATUS_LABELS[item.status] ?? item.status}</Text>
            </View>
            {item.status === 'PENDING' && (
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {item.status === 'PENDING' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.success + '22', borderColor: COLORS.success }]}
              onPress={() => handleMark(item, 'COMPLETED')}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
              <Text style={[styles.actionText, { color: COLORS.success }]}>{t('markCompleted')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.error + '22', borderColor: COLORS.error }]}
              onPress={() => handleMark(item, 'MISSED')}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
              <Text style={[styles.actionText, { color: COLORS.error }]}>{t('markMissed')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>{t('revisionScheduleTitle')}</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setShowForm((v) => !v)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={[styles.form, { backgroundColor: COLORS.surface }]}>
          <Text style={[styles.formTitle, { color: COLORS.text }]}>{t('addRevision')}</Text>

          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                { backgroundColor: mode === 'SURAH' ? COLORS.primary : COLORS.background, borderColor: COLORS.primary },
              ]}
              onPress={() => setMode('SURAH')}
            >
              <Text style={[styles.modeBtnText, { color: mode === 'SURAH' ? '#fff' : COLORS.primary }]}>
                {isAr ? 'مراجعة سورة كاملة' : 'Whole-surah review'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                { backgroundColor: mode === 'DRILL' ? COLORS.primary : COLORS.background, borderColor: COLORS.primary },
              ]}
              onPress={() => setMode('DRILL')}
            >
              <Text style={[styles.modeBtnText, { color: mode === 'DRILL' ? '#fff' : COLORS.primary }]}>
                {isAr ? 'تحديد آية ضعيفة' : 'Flag a weak ayah'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: COLORS.textSecondary }]}>{t('studentLabel')}</Text>
          {loadingMeta ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : students.length === 0 ? (
            <Text style={[styles.noData, { color: COLORS.textSecondary }]}>{t('noAcceptedStudents')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {students.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedStudentId === s.id ? COLORS.primary : COLORS.background,
                      borderColor: COLORS.primary,
                    },
                  ]}
                  onPress={() => setSelectedStudentId(s.id)}
                >
                  <Text style={[styles.chipText, { color: selectedStudentId === s.id ? '#fff' : COLORS.primary }]}>
                    {s.firstName} {s.lastName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={[styles.label, { color: COLORS.textSecondary }]}>{t('selectSurah')}</Text>
          {surahs.length === 0 && loadingMeta ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {surahs.slice(0, 30).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedSurahId === s.id ? COLORS.primary : COLORS.background,
                      borderColor: COLORS.primary,
                    },
                  ]}
                  onPress={() => setSelectedSurahId(s.id)}
                >
                  <Text style={[styles.chipText, { color: selectedSurahId === s.id ? '#fff' : COLORS.primary }]}>
                    {isAr ? s.nameAr : s.nameEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {mode === 'SURAH' ? (
            <>
              <Text style={[styles.label, { color: COLORS.textSecondary }]}>{t('scheduledDate')}</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: COLORS.background,
                    color: COLORS.text,
                    borderColor: COLORS.borderSubtle,
                  },
                ]}
                placeholder="2024-06-15"
                placeholderTextColor={COLORS.textSecondary}
                value={scheduledDate}
                onChangeText={setScheduledDate}
                keyboardType="numbers-and-punctuation"
              />
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: COLORS.textSecondary }]}>{isAr ? 'رقم الآية' : 'Ayah number'}</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: COLORS.background,
                    color: COLORS.text,
                    borderColor: COLORS.borderSubtle,
                  },
                ]}
                placeholder={isAr ? 'مثال: 12' : 'e.g. 12'}
                placeholderTextColor={COLORS.textSecondary}
                value={ayahNumberStr}
                onChangeText={setAyahNumberStr}
                keyboardType="number-pad"
              />
              <Text style={[styles.noData, { color: COLORS.textSecondary }]}>
                {isAr
                  ? 'يبدأ التدريب المتكرر فوراً عبر جدول المراجعة الحالي.'
                  : "Starts a spaced-repetition drill right away, through the student's existing revision schedule."}
              </Text>
            </>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: COLORS.primary, opacity: isSubmitting ? 0.6 : 1 }]}
            onPress={handleAdd}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>
              {isSubmitting
                ? t('submitting')
                : mode === 'DRILL'
                  ? isAr
                    ? 'تحديد كضعيفة'
                    : 'Flag as weak'
                  : t('addRevision')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && !revisions.length ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl * 2 }} color={COLORS.primary} />
      ) : error ? (
        <TouchableOpacity style={styles.errorBox} onPress={fetchRevisions}>
          <Text style={[styles.errorText, { color: COLORS.error }]}>{t('loadFailed')}</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={revisions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 80 },
            revisions.length === 0 && styles.emptyContainer,
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchRevisions} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="book-outline" size={48} color={COLORS.textSecondary} />
              <Text style={[styles.emptyTitle, { color: COLORS.text }]}>{t('noRevisions')}</Text>
              <Text style={[styles.emptyDesc, { color: COLORS.textSecondary }]}>
                {isAr ? 'أضف مراجعة بالضغط على +' : 'Tap + to schedule a revision'}
              </Text>
            </View>
          }
        />
      )}

      <BottomNav role="teacher" active="home" />
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
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
    },
    backBtn: { width: 40, alignItems: 'flex-start' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    form: {
      margin: SPACING.md,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.xs,
      ...SHADOWS.sm,
    },
    formTitle: { fontSize: 16, fontWeight: '700', marginBottom: SPACING.xs },
    modeToggle: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.xs },
    modeBtn: { flex: 1, borderRadius: RADIUS.sm, borderWidth: 1, paddingVertical: SPACING.sm, alignItems: 'center' },
    modeBtnText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
    label: { fontSize: 13, marginTop: SPACING.xs },
    chips: { flexGrow: 0, marginBottom: SPACING.xs },
    chip: {
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      marginRight: SPACING.xs,
    },
    chipText: { fontSize: 13, fontWeight: '500' },
    input: {
      borderWidth: 1,
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
      fontSize: 14,
      marginTop: SPACING.xs,
    },
    submitBtn: { borderRadius: RADIUS.sm, padding: SPACING.sm, alignItems: 'center', marginTop: SPACING.sm },
    submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    noData: { fontSize: 13, marginBottom: SPACING.xs },
    list: { padding: SPACING.md, gap: SPACING.sm },
    card: {
      borderRadius: RADIUS.md,
      borderLeftWidth: 4,
      padding: SPACING.md,
      ...SHADOWS.sm,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    drillBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
    drillBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    surahName: { fontSize: 16, fontWeight: '600' },
    meta: { fontSize: 13, marginTop: 2 },
    statusBadge: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
    statusText: { fontSize: 12, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      paddingVertical: SPACING.xs,
    },
    actionText: { fontSize: 13, fontWeight: '500' },
    emptyContainer: { flex: 1 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingTop: SPACING.xl * 2 },
    emptyTitle: { fontSize: 18, fontWeight: '600' },
    emptyDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: SPACING.xl },
    errorBox: { margin: SPACING.md, alignItems: 'center' },
    errorText: { fontSize: 14 },
  });
}
