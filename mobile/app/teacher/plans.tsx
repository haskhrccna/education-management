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
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useThemeSettings } from '@/src/settings/store';
import { CurriculumPlan, appointmentsApi, memorizationApi } from '@/src/api';
import { useCurriculumPlans } from '@/src/hooks/useCurriculumPlans';
import { BottomNav } from '@/src/components/BottomNav';

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
interface StagedItem {
  surahId: number;
  surahLabel: string;
  targetDate: string;
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

function paceLabel(pace: CurriculumPlan['pace'], isAr: boolean): string {
  if (pace === 'BEHIND') return isAr ? 'متأخر' : 'Behind';
  if (pace === 'AHEAD') return isAr ? 'متقدم' : 'Ahead';
  return isAr ? 'في الموعد' : 'On pace';
}

export default function TeacherPlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const { plans, isLoading, error, refetch, createPlan } = useCurriculumPlans();

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [surahs, setSurahs] = useState<SurahOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [planName, setPlanName] = useState('');
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
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
  }, [fetchMeta]);

  const addStagedItem = () => {
    if (!selectedSurahId || !targetDate) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      Alert.alert(t('error'), t('invalidDate'));
      return;
    }
    if (stagedItems.some((i) => i.surahId === selectedSurahId)) {
      Alert.alert(t('error'), isAr ? 'هذه السورة مضافة بالفعل' : 'That surah is already in the plan');
      return;
    }
    const surah = surahs.find((s) => s.id === selectedSurahId);
    setStagedItems((prev) => [
      ...prev,
      {
        surahId: selectedSurahId,
        surahLabel: surah ? (isAr ? surah.nameAr : surah.nameEn) : String(selectedSurahId),
        targetDate,
      },
    ]);
    setTargetDate('');
  };

  const removeStagedItem = (surahId: number) => {
    setStagedItems((prev) => prev.filter((i) => i.surahId !== surahId));
  };

  const handleSubmit = async () => {
    if (!selectedStudentId || !planName.trim() || stagedItems.length === 0) {
      Alert.alert(t('error'), isAr ? 'أضف اسم الخطة وسورة واحدة على الأقل' : 'Add a plan name and at least one surah');
      return;
    }
    setIsSubmitting(true);
    try {
      await createPlan(
        selectedStudentId,
        planName.trim(),
        stagedItems.map((i) => ({ surahId: i.surahId, targetDate: `${i.targetDate}T00:00:00.000Z` }))
      );
      Alert.alert(t('success'), isAr ? 'تم إنشاء الخطة' : 'Plan created');
      setShowForm(false);
      setPlanName('');
      setStagedItems([]);
    } catch (err: any) {
      Alert.alert(t('error'), err?.response?.data?.error ?? err?.message ?? t('failedToAddRevision'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const PACE_COLORS: Record<CurriculumPlan['pace'], string> = {
    ON_PACE: COLORS.success,
    BEHIND: COLORS.error,
    AHEAD: COLORS.primary,
  };

  const renderPlan = ({ item }: { item: CurriculumPlan }) => {
    const paceColor = PACE_COLORS[item.pace];
    const student = students.find((s) => s.id === item.studentId);
    return (
      <View style={[styles.card, { backgroundColor: COLORS.surface, borderLeftColor: paceColor }]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.planName, { color: COLORS.text }]}>{item.name}</Text>
            {student ? (
              <Text style={[styles.meta, { color: COLORS.textSecondary }]}>
                {student.firstName} {student.lastName}
              </Text>
            ) : null}
          </View>
          <View style={[styles.paceBadge, { backgroundColor: paceColor + '22' }]}>
            <Ionicons
              name={
                item.pace === 'BEHIND'
                  ? 'alert-circle-outline'
                  : item.pace === 'AHEAD'
                    ? 'rocket-outline'
                    : 'checkmark-circle-outline'
              }
              size={13}
              color={paceColor}
            />
            <Text style={[styles.paceText, { color: paceColor }]}>{paceLabel(item.pace, isAr)}</Text>
          </View>
        </View>
        {item.items.map((planItem) => (
          <View key={planItem.id} style={styles.itemRow}>
            <Text style={[styles.itemName, { color: COLORS.text }]}>
              {isAr ? planItem.surah?.nameAr : planItem.surah?.nameEn}
            </Text>
            <Text style={[styles.itemDate, { color: COLORS.textSecondary }]}>
              {formatDate(planItem.targetDate, i18n.language)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>{isAr ? 'خطط الحفظ' : 'Curriculum plans'}</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setShowForm((v) => !v)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {showForm && (
        <ScrollView style={[styles.form, { backgroundColor: COLORS.surface }]}>
          <Text style={[styles.formTitle, { color: COLORS.text }]}>{isAr ? 'خطة جديدة' : 'New plan'}</Text>

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

          <Text style={[styles.label, { color: COLORS.textSecondary }]}>{isAr ? 'اسم الخطة' : 'Plan name'}</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: COLORS.background, color: COLORS.text, borderColor: COLORS.borderSubtle },
            ]}
            placeholder={isAr ? 'مثال: جزء عم في 12 أسبوعاً' : 'e.g. Juz Amma in 12 weeks'}
            placeholderTextColor={COLORS.textSecondary}
            value={planName}
            onChangeText={setPlanName}
          />

          <Text style={[styles.label, { color: COLORS.textSecondary, marginTop: SPACING.md }]}>
            {isAr ? 'إضافة سورة' : 'Add a surah'}
          </Text>
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
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                { flex: 1, backgroundColor: COLORS.background, color: COLORS.text, borderColor: COLORS.borderSubtle },
              ]}
              placeholder="2024-09-15"
              placeholderTextColor={COLORS.textSecondary}
              value={targetDate}
              onChangeText={setTargetDate}
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity style={[styles.smallAddBtn, { backgroundColor: COLORS.primary }]} onPress={addStagedItem}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {stagedItems.length > 0 && (
            <View style={styles.stagedList}>
              {stagedItems.map((item) => (
                <View key={item.surahId} style={[styles.stagedRow, { borderColor: COLORS.borderSubtle }]}>
                  <Text style={[styles.stagedText, { color: COLORS.text }]}>
                    {item.surahLabel} · {item.targetDate}
                  </Text>
                  <TouchableOpacity onPress={() => removeStagedItem(item.surahId)}>
                    <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: COLORS.primary, opacity: isSubmitting ? 0.6 : 1 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? t('submitting') : isAr ? 'إنشاء الخطة' : 'Create plan'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {isLoading && !plans.length ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl * 2 }} color={COLORS.primary} />
      ) : error ? (
        <TouchableOpacity style={styles.errorBox} onPress={() => refetch()}>
          <Text style={[styles.errorText, { color: COLORS.error }]}>{t('loadFailed')}</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={renderPlan}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 80 },
            plans.length === 0 && styles.emptyContainer,
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="map-outline" size={48} color={COLORS.textSecondary} />
              <Text style={[styles.emptyTitle, { color: COLORS.text }]}>{isAr ? 'لا توجد خطط' : 'No plans yet'}</Text>
              <Text style={[styles.emptyDesc, { color: COLORS.textSecondary }]}>
                {isAr ? 'اضغط + لإنشاء خطة' : 'Tap + to create one'}
              </Text>
            </View>
          }
        />
      )}

      <BottomNav role="teacher" active="home" />
    </View>
  );
}

function createStyles(COLORS: ReturnType<typeof getColors>) {
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
    form: { margin: SPACING.md, borderRadius: RADIUS.md, padding: SPACING.md, maxHeight: 480, ...SHADOWS.sm },
    formTitle: { fontSize: 16, fontWeight: '700', marginBottom: SPACING.xs },
    label: { fontSize: 13, marginTop: SPACING.xs, marginBottom: 4 },
    chips: { flexGrow: 0, marginBottom: SPACING.xs },
    chip: {
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      marginRight: SPACING.xs,
    },
    chipText: { fontSize: 13, fontWeight: '500' },
    input: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: 14 },
    inputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', marginTop: SPACING.xs },
    smallAddBtn: { width: 40, height: 40, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
    stagedList: { marginTop: SPACING.sm, gap: SPACING.xs },
    stagedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    stagedText: { fontSize: 13, fontWeight: '600' },
    submitBtn: {
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
      alignItems: 'center',
      marginTop: SPACING.md,
      marginBottom: SPACING.md,
    },
    submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    list: { padding: SPACING.md, gap: SPACING.sm },
    card: { borderRadius: RADIUS.md, borderLeftWidth: 4, padding: SPACING.md, gap: SPACING.xs, ...SHADOWS.sm },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
    planName: { fontSize: 16, fontWeight: '700' },
    meta: { fontSize: 12, marginTop: 2 },
    paceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
    },
    paceText: { fontSize: 11, fontWeight: '700' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    itemName: { fontSize: 13, fontWeight: '600' },
    itemDate: { fontSize: 12 },
    emptyContainer: { flex: 1 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingTop: SPACING.xl * 2 },
    emptyTitle: { fontSize: 18, fontWeight: '600' },
    emptyDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: SPACING.xl },
    errorBox: { margin: SPACING.md, alignItems: 'center' },
    errorText: { fontSize: 14 },
  });
}
