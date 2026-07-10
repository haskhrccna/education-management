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
import { appointmentsApi, memorizationApi } from '@/src/api';
import { Ijazah, IjazahScope } from '@/src/api/ijazahs';
import { useIjazahs } from '@/src/hooks/useIjazahs';
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function TeacherIjazahsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const { ijazahs, isLoading, error, refetch, issue } = useIjazahs();

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [surahs, setSurahs] = useState<SurahOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [scope, setScope] = useState<IjazahScope>('SURAH');
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [juzNumberStr, setJuzNumberStr] = useState('');
  const [chainRef, setChainRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      /* non-fatal — form will show empty pickers */
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  const handleIssue = async () => {
    if (!selectedStudentId) {
      Alert.alert(t('error'), isAr ? 'اختر طالباً' : 'Choose a student');
      return;
    }
    if (scope === 'SURAH' && !selectedSurahId) {
      Alert.alert(t('error'), isAr ? 'اختر سورة' : 'Choose a surah');
      return;
    }
    const juzNumber = scope === 'JUZ' ? parseInt(juzNumberStr, 10) : undefined;
    if (scope === 'JUZ' && (!juzNumber || juzNumber < 1 || juzNumber > 30)) {
      Alert.alert(t('error'), isAr ? 'رقم الجزء يجب أن يكون بين 1 و30' : 'Juz number must be between 1 and 30');
      return;
    }

    setSubmitting(true);
    try {
      await issue(selectedStudentId, scope, {
        surahId: scope === 'SURAH' ? selectedSurahId! : undefined,
        juzNumber,
        teacherChainRef: chainRef.trim() || undefined,
      });
      Alert.alert(t('success'), isAr ? 'تم إصدار الإجازة' : 'Ijazah issued');
      setShowForm(false);
      setChainRef('');
      setJuzNumberStr('');
    } catch (err: any) {
      Alert.alert(
        t('error'),
        err?.response?.data?.error ?? err?.message ?? (isAr ? 'فشل إصدار الإجازة' : 'Failed to issue ijazah')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: Ijazah }) => {
    const studentName = item.student ? `${item.student.firstName} ${item.student.lastName}` : '';
    const scopeLabel =
      item.scope === 'FULL_QURAN'
        ? isAr
          ? 'القرآن كاملاً'
          : 'Full Quran'
        : item.scope === 'JUZ'
          ? `${isAr ? 'الجزء' : 'Juz'} ${item.juzNumber}`
          : isAr
            ? item.surah?.nameAr
            : item.surah?.nameEn;

    return (
      <View style={[styles.card, { backgroundColor: COLORS.surface, borderLeftColor: COLORS.gold }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: COLORS.textPrimary }]}>{scopeLabel}</Text>
          <Text style={[styles.cardMeta, { color: COLORS.textSecondary }]}>{studentName}</Text>
          <Text style={[styles.cardMeta, { color: COLORS.textSecondary }]}>
            {formatDate(item.issuedAt, i18n.language)}
          </Text>
        </View>
        <Ionicons name="ribbon" size={22} color={COLORS.gold} />
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>{isAr ? 'الإجازات' : 'Ijazahs'}</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setShowForm((v) => !v)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {showForm && (
        <ScrollView style={[styles.form, { backgroundColor: COLORS.surface }]}>
          <Text style={[styles.label, { color: COLORS.textSecondary }]}>{t('studentLabel')}</Text>
          {loadingMeta ? (
            <ActivityIndicator color={COLORS.primary} />
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

          <Text style={[styles.label, { color: COLORS.textSecondary }]}>{isAr ? 'النطاق' : 'Scope'}</Text>
          <View style={styles.chipsWrap}>
            {(['SURAH', 'JUZ', 'FULL_QURAN'] as IjazahScope[]).map((s) => {
              const active = scope === s;
              const label =
                s === 'SURAH'
                  ? isAr
                    ? 'سورة'
                    : 'Surah'
                  : s === 'JUZ'
                    ? isAr
                      ? 'جزء'
                      : 'Juz'
                    : isAr
                      ? 'القرآن كاملاً'
                      : 'Full Quran';
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? COLORS.primary : COLORS.background, borderColor: COLORS.primary },
                  ]}
                  onPress={() => setScope(s)}
                >
                  <Text style={[styles.chipText, { color: active ? '#fff' : COLORS.primary }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {scope === 'SURAH' ? (
            <>
              <Text style={[styles.label, { color: COLORS.textSecondary }]}>{isAr ? 'السورة' : 'Surah'}</Text>
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
            </>
          ) : scope === 'JUZ' ? (
            <>
              <Text style={[styles.label, { color: COLORS.textSecondary }]}>
                {isAr ? 'رقم الجزء (1-30)' : 'Juz number (1-30)'}
              </Text>
              <TextInput
                style={[styles.input, { color: COLORS.textPrimary, borderColor: COLORS.borderSubtle }]}
                keyboardType="number-pad"
                value={juzNumberStr}
                onChangeText={setJuzNumberStr}
              />
            </>
          ) : null}

          <Text style={[styles.label, { color: COLORS.textSecondary }]}>
            {isAr ? 'السند (اختياري)' : 'Chain reference (optional)'}
          </Text>
          <TextInput
            style={[styles.input, { color: COLORS.textPrimary, borderColor: COLORS.borderSubtle }]}
            placeholder={isAr ? 'مثال: الشيخ فلان، أجيز عام 2010' : 'e.g. Sheikh So-and-so, certified 2010'}
            placeholderTextColor={COLORS.textSecondary}
            value={chainRef}
            onChangeText={setChainRef}
          />

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: COLORS.primary, opacity: submitting ? 0.6 : 1 }]}
            onPress={handleIssue}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{isAr ? 'إصدار الإجازة' : 'Issue ijazah'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {isLoading && !ijazahs.length ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl * 2 }} color={COLORS.primary} />
      ) : error ? (
        <TouchableOpacity style={styles.errorBox} onPress={() => refetch()}>
          <Text style={[styles.errorText, { color: COLORS.error }]}>{t('loadFailed')}</Text>
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
            <View style={styles.emptyWrap}>
              <Ionicons name="ribbon-outline" size={48} color={COLORS.textSecondary} />
              <Text style={[styles.cardMeta, { color: COLORS.textSecondary }]}>
                {isAr ? 'لم تُصدر أي إجازة بعد' : 'No ijazahs issued yet'}
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
    form: { margin: SPACING.md, borderRadius: RADIUS.md, padding: SPACING.md, maxHeight: 500, ...SHADOWS.sm },
    label: { fontSize: 13, marginTop: SPACING.sm, marginBottom: 4 },
    chips: { flexGrow: 0, marginBottom: SPACING.xs },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.xs },
    chip: {
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      marginRight: SPACING.xs,
    },
    chipText: { fontSize: 13, fontWeight: '500' },
    input: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: 14 },
    submitBtn: {
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
      alignItems: 'center',
      marginTop: SPACING.md,
      marginBottom: SPACING.md,
    },
    submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    list: { padding: SPACING.md, gap: SPACING.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: RADIUS.md,
      borderLeftWidth: 4,
      padding: SPACING.md,
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    cardMeta: { fontSize: 12, marginTop: 2 },
    emptyContainer: { flex: 1 },
    emptyWrap: { flex: 1, alignItems: 'center', gap: SPACING.sm, justifyContent: 'center' },
    errorBox: { margin: SPACING.md, alignItems: 'center' },
    errorText: { fontSize: 14 },
  });
}
