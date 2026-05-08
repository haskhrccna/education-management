import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appointmentsApi, gradesApi } from '@/src/api';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

const GRADE_TYPES = ['QUIZ', 'ASSIGNMENT', 'EXAM', 'ORAL', 'PARTICIPATION'] as const;
type GradeType = (typeof GRADE_TYPES)[number];

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}

export default function GradeFormScreen() {
  const router = useRouter();
  const { studentId: prefillId } = useLocalSearchParams<{ studentId?: string }>();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(prefillId ?? '');
  const [subject, setSubject] = useState('');
  const [score, setScore] = useState('');
  const [type, setType] = useState<GradeType>('ORAL');
  const [notes, setNotes] = useState('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    appointmentsApi
      .getMine()
      .then((appts) => {
        const accepted = appts
          .filter((a) => a.status === 'ACCEPTED' && a.student)
          .map((a) => ({
            id: a.student!.id,
            firstName: a.student!.firstName,
            lastName: a.student!.lastName,
          }));
        const unique = accepted.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
        setStudents(unique);
        if (!prefillId && unique.length > 0) {
          setSelectedStudentId(unique[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingStudents(false));
  }, []);

  const canSubmit = !!selectedStudentId && subject.trim().length > 0 && score.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await gradesApi.create({
        studentId: selectedStudentId,
        subject: subject.trim(),
        grade: score.trim(),
        type,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Grade submitted', 'The grade has been recorded.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to submit grade');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Grade</Text>
          <Text style={styles.subtitle}>Assess a student's recitation</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Student picker */}
          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Student</Text>
          {isLoadingStudents ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : students.length === 0 ? (
            <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>No accepted students yet</Text>
          ) : (
            <View style={styles.chipRow}>
              {students.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.chip,
                    { borderColor: COLORS.primary },
                    selectedStudentId === s.id && { backgroundColor: COLORS.primary },
                  ]}
                  onPress={() => setSelectedStudentId(s.id)}
                >
                  <Text style={[styles.chipText, { color: selectedStudentId === s.id ? '#fff' : COLORS.textPrimary }]}>
                    {s.firstName} {s.lastName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Subject */}
          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Subject</Text>
          <TextInput
            style={[styles.input, { backgroundColor: COLORS.surface, color: COLORS.textPrimary }]}
            placeholder="e.g. Al-Baqarah ayahs 1–50"
            placeholderTextColor={COLORS.textMuted}
            value={subject}
            onChangeText={setSubject}
          />

          {/* Score */}
          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Score</Text>
          <TextInput
            style={[styles.input, { backgroundColor: COLORS.surface, color: COLORS.textPrimary }]}
            placeholder="e.g. 87"
            placeholderTextColor={COLORS.textMuted}
            value={score}
            onChangeText={setScore}
            keyboardType="numeric"
          />

          {/* Type */}
          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Type</Text>
          <View style={styles.chipRow}>
            {GRADE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.chip,
                  { borderColor: COLORS.primary },
                  type === t && { backgroundColor: COLORS.primary },
                ]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.chipText, { color: type === t ? '#fff' : COLORS.textPrimary }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: COLORS.surface, color: COLORS.textPrimary }]}
            placeholder="Any observations..."
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: canSubmit ? COLORS.primary : (COLORS.textMuted ?? '#9ca3af'),
              },
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Grade</Text>}
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: COLORS.surface }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.cancelText, { color: COLORS.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  header: {
    padding: SPACING.xl,
    paddingTop: SPACING.lg,
    borderBottomLeftRadius: RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
    ...SHADOWS.lg,
    marginBottom: SPACING.xl,
  },
  backText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  form: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    fontSize: 15,
    marginTop: SPACING.xs,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: SPACING.xl,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
