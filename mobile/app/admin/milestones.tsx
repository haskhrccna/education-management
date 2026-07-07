import React, { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useThemeSettings } from '@/src/settings/store';
import { milestonesApi, MilestoneDefinition, MilestoneTriggerType } from '@/src/api/milestones';
import { BottomNav } from '@/src/components/BottomNav';

const TRIGGER_TYPES: MilestoneTriggerType[] = [
  'SURAH_COUNT',
  'REVISION_COUNT',
  'STREAK_LENGTH',
  'PLAN_COMPLETION',
  'IJAZAH_ISSUED',
  'HALAQA_ATTENDANCE_COUNT',
];

function triggerLabel(trigger: MilestoneTriggerType): string {
  const labels: Record<MilestoneTriggerType, string> = {
    SURAH_COUNT: 'Surah count',
    REVISION_COUNT: 'Revision count',
    STREAK_LENGTH: 'Streak length',
    PLAN_COMPLETION: 'Plan completion',
    IJAZAH_ISSUED: 'Ijazah issued',
    HALAQA_ATTENDANCE_COUNT: 'Halaqa attendance',
  };
  return labels[trigger];
}

export default function AdminMilestonesScreen() {
  const router = useRouter();
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  const [milestones, setMilestones] = useState<MilestoneDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconKey, setIconKey] = useState('star');
  const [triggerType, setTriggerType] = useState<MilestoneTriggerType>('SURAH_COUNT');
  const [threshold, setThreshold] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const fetchMilestones = useCallback(async () => {
    setIsLoading(true);
    try {
      setMilestones(await milestonesApi.list());
    } catch {
      /* leave list empty on failure */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const handleCreate = async () => {
    const thresholdNum = parseInt(threshold, 10);
    if (!name.trim() || !description.trim() || !iconKey.trim() || !thresholdNum || thresholdNum <= 0) {
      Alert.alert('Error', 'Fill in every field with a positive threshold');
      return;
    }
    setSubmitting(true);
    try {
      await milestonesApi.create(name.trim(), description.trim(), iconKey.trim(), triggerType, thresholdNum);
      Alert.alert('', 'Milestone created — it applies to every user on their next activity, no deploy needed.');
      setShowForm(false);
      setName('');
      setDescription('');
      setThreshold('1');
      await fetchMilestones();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? err?.message ?? 'Failed to create milestone');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Milestone catalog</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setShowForm((v) => !v)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {showForm && (
        <ScrollView style={[styles.form, { backgroundColor: COLORS.surface }]}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={[styles.input, { color: COLORS.textPrimary, borderColor: COLORS.borderSubtle }]}
            placeholder="e.g. Halaqa Regular"
            placeholderTextColor={COLORS.textSecondary}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, { color: COLORS.textPrimary, borderColor: COLORS.borderSubtle }]}
            placeholder="Shown to the student when earned"
            placeholderTextColor={COLORS.textSecondary}
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>Icon key</Text>
          <TextInput
            style={[styles.input, { color: COLORS.textPrimary, borderColor: COLORS.borderSubtle }]}
            placeholder="star"
            placeholderTextColor={COLORS.textSecondary}
            value={iconKey}
            onChangeText={setIconKey}
          />

          <Text style={styles.label}>Trigger</Text>
          <View style={styles.chipsWrap}>
            {TRIGGER_TYPES.map((trig) => {
              const active = triggerType === trig;
              return (
                <TouchableOpacity
                  key={trig}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? COLORS.primary : COLORS.background, borderColor: COLORS.primary },
                  ]}
                  onPress={() => setTriggerType(trig)}
                >
                  <Text style={[styles.chipText, { color: active ? '#fff' : COLORS.primary }]}>
                    {triggerLabel(trig)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Threshold</Text>
          <TextInput
            style={[styles.input, { color: COLORS.textPrimary, borderColor: COLORS.borderSubtle }]}
            keyboardType="number-pad"
            value={threshold}
            onChangeText={setThreshold}
          />

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: COLORS.primary, opacity: submitting ? 0.6 : 1 }]}
            onPress={handleCreate}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create milestone</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl * 2 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={milestones}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchMilestones} tintColor={COLORS.primary} />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: COLORS.surface }]}>
              <Text style={[styles.cardTitle, { color: COLORS.textPrimary }]}>{item.badge.name}</Text>
              <Text style={[styles.cardMeta, { color: COLORS.textSecondary }]}>{item.badge.description}</Text>
              <Text style={[styles.cardMeta, { color: COLORS.textSecondary }]}>
                {triggerLabel(item.triggerType)} ≥ {item.threshold}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="trophy-outline" size={40} color={COLORS.textSecondary} />
              <Text style={[styles.cardMeta, { color: COLORS.textSecondary }]}>No custom milestones yet</Text>
            </View>
          }
        />
      )}

      <BottomNav role="admin" active="home" />
    </SafeAreaView>
  );
}

function createStyles(COLORS: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.surface,
      ...SHADOWS.sm,
    },
    backBtn: { padding: SPACING.xs },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginStart: SPACING.sm },
    addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    form: { margin: SPACING.md, borderRadius: RADIUS.md, padding: SPACING.md, maxHeight: 480, ...SHADOWS.sm },
    label: { fontSize: 13, color: COLORS.textSecondary, marginTop: SPACING.sm, marginBottom: 4 },
    input: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: 14 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
    chip: { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
    chipText: { fontSize: 12, fontWeight: '600' },
    submitBtn: {
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
      alignItems: 'center',
      marginTop: SPACING.md,
      marginBottom: SPACING.md,
    },
    submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    list: { padding: SPACING.md, gap: SPACING.sm },
    card: { borderRadius: RADIUS.md, padding: SPACING.md, gap: 4, ...SHADOWS.sm },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    cardMeta: { fontSize: 12 },
    emptyWrap: { alignItems: 'center', gap: SPACING.sm, paddingTop: SPACING.xl * 2 },
  });
}
