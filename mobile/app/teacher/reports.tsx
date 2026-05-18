import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { appointmentsApi, reportsApi, Report } from '@/src/api';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';
import { BottomNav } from '@/src/components/BottomNav';

interface TeacherStudent {
  id: string;
  firstName: string;
  lastName: string;
}

function parsePeriod(summary: string): { period: string | null; notes: string } {
  const match = summary.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (match) return { period: match[1].trim(), notes: match[2].trim() };
  return { period: null, notes: summary };
}

export default function TeacherReportsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [reports, setReports] = useState<Report[]>([]);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [period, setPeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [reportsRes, apptsRes] = await Promise.all([reportsApi.getReports(), appointmentsApi.getMine()]);
      setReports(reportsRes);
      const accepted = apptsRes
        .filter((a) => a.status === 'ACCEPTED' && a.student)
        .map((a) => ({
          id: a.student!.id,
          firstName: a.student!.firstName,
          lastName: a.student!.lastName,
        }));
      const unique = accepted.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
      setStudents(unique);
      if (!selectedStudentId && unique.length > 0) {
        setSelectedStudentId(unique[0].id);
      }
    } catch (err: any) {
      setError(err?.message ?? t('loadFailed'));
    }
  }, [selectedStudentId, t]);

  useEffect(() => {
    setIsLoading(true);
    fetchAll().finally(() => setIsLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAll();
    setIsRefreshing(false);
  }, [fetchAll]);

  const studentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    students.forEach((s) => {
      map[s.id] = `${s.firstName} ${s.lastName}`.trim();
    });
    reports.forEach((r) => {
      if (!map[r.studentId] && r.student) {
        map[r.studentId] = `${r.student.firstName} ${r.student.lastName}`.trim();
      }
    });
    return map;
  }, [students, reports]);

  const canSubmit = !!selectedStudentId && period.trim().length > 0 && notes.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const created = await reportsApi.createReport({
        studentId: selectedStudentId,
        period: period.trim(),
        notes: notes.trim(),
      });
      setReports((prev) => [created, ...prev]);
      setPeriod('');
      setNotes('');
      setShowForm(false);
      Alert.alert(t('reportCreated'));
    } catch (err: any) {
      Alert.alert(t('failedToCreateReport'), err?.response?.data?.message ?? err?.message ?? '');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (reportId: string) => {
    setDownloadingId(reportId);
    try {
      await reportsApi.downloadReport(reportId);
    } catch (err: any) {
      Alert.alert(t('failedToDownloadReport'), err?.response?.data?.message ?? err?.message ?? '');
    } finally {
      setDownloadingId(null);
    }
  };

  const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
            style={styles.backText}
          />
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('reports')}</Text>
          <TouchableOpacity style={styles.headerAction} onPress={() => setShowForm((v) => !v)} activeOpacity={0.85}>
            <Text style={styles.headerActionText}>{showForm ? t('cancel') : `+ ${t('createReport')}`}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          {reports.length} {t('reports')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {showForm && (
          <View style={[styles.formCard, { backgroundColor: COLORS.surface }]}>
            <Text style={[styles.formTitle, { color: COLORS.textPrimary }]}>{t('createReport')}</Text>

            <Text style={[styles.label, { color: COLORS.textSecondary }]}>{t('studentLabel')}</Text>
            {students.length === 0 ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: SPACING.xs }}>
                {t('noAcceptedStudents')}
              </Text>
            ) : (
              <View style={styles.chipRow}>
                {students.map((s) => {
                  const active = selectedStudentId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.chip,
                        { borderColor: COLORS.primary },
                        active && { backgroundColor: COLORS.primary },
                      ]}
                      onPress={() => setSelectedStudentId(s.id)}
                    >
                      <Text style={[styles.chipText, { color: active ? '#fff' : COLORS.textPrimary }]}>
                        {s.firstName} {s.lastName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={[styles.label, { color: COLORS.textSecondary }]}>{t('reportPeriod')}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: COLORS.background,
                  color: COLORS.textPrimary,
                  borderColor: COLORS.primaryMuted,
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
              ]}
              placeholder={t('reportPeriodPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={period}
              onChangeText={setPeriod}
              maxLength={80}
            />

            <Text style={[styles.label, { color: COLORS.textSecondary }]}>{t('reportNotes')}</Text>
            <TextInput
              style={[
                styles.input,
                styles.notesInput,
                {
                  backgroundColor: COLORS.background,
                  color: COLORS.textPrimary,
                  borderColor: COLORS.primaryMuted,
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
              ]}
              placeholder={t('reportNotesPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={1900}
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: canSubmit ? COLORS.primary : COLORS.textMuted }]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('submit')}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: COLORS.error, marginBottom: SPACING.md }}>{error}</Text>
            <TouchableOpacity onPress={onRefresh}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40, marginBottom: SPACING.md }}>📑</Text>
            <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>{t('noReports')}</Text>
            <Text style={[styles.emptyDesc, { color: COLORS.textSecondary }]}>{t('noReportsDesc')}</Text>
          </View>
        ) : (
          reports.map((r) => {
            const { period: p, notes: n } = parsePeriod(r.summary);
            const studentName = studentNameById[r.studentId] ?? '—';
            const dateStr = new Date(r.generatedAt).toLocaleDateString(dateLocale, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            return (
              <View key={r.id} style={[styles.card, { backgroundColor: COLORS.surface }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.studentName, { color: COLORS.textPrimary }]}>{studentName}</Text>
                    {p && (
                      <View style={[styles.periodBadge, { backgroundColor: COLORS.primaryMuted }]}>
                        <Text style={[styles.periodText, { color: COLORS.primary }]}>{p}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.dateText, { color: COLORS.textSecondary }]}>{dateStr}</Text>
                </View>
                {n.length > 0 && (
                  <Text
                    style={[
                      styles.notesPreview,
                      {
                        color: COLORS.textSecondary,
                        textAlign: isRTL ? 'right' : 'left',
                        writingDirection: isRTL ? 'rtl' : 'ltr',
                      },
                    ]}
                    numberOfLines={3}
                  >
                    {n}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.downloadBtn, { borderColor: COLORS.primary }]}
                  onPress={() => handleDownload(r.id)}
                  disabled={downloadingId === r.id}
                  activeOpacity={0.85}
                >
                  {downloadingId === r.id ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <Text style={[styles.downloadText, { color: COLORS.primary }]}>⤓ {t('downloadReport')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
      <BottomNav role="teacher" active="reports" />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    header: {
      padding: SPACING.xl,
      paddingTop: SPACING.lg,
      borderBottomLeftRadius: RADIUS['2xl'],
      borderBottomRightRadius: RADIUS['2xl'],
      ...SHADOWS.lg,
    },
    backText: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: SPACING.sm },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 22, fontWeight: '800', color: '#fff' },
    headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: SPACING.xs },
    headerAction: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.md,
    },
    headerActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    scroll: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: SPACING['3xl'] },
    formCard: {
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      ...SHADOWS.md,
      gap: SPACING.xs,
      marginBottom: SPACING.md,
    },
    formTitle: { fontSize: 16, fontWeight: '800', marginBottom: SPACING.sm },
    label: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: SPACING.md,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
    chip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
    },
    chipText: { fontSize: 13, fontWeight: '600' },
    input: {
      borderWidth: 1,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      fontSize: 15,
      marginTop: SPACING.xs,
    },
    notesInput: { minHeight: 90, textAlignVertical: 'top' },
    submitBtn: {
      marginTop: SPACING.lg,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      alignItems: 'center',
      ...SHADOWS.sm,
    },
    submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    card: {
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      ...SHADOWS.sm,
      gap: SPACING.sm,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
    studentName: { fontSize: 16, fontWeight: '700', marginBottom: SPACING.xs },
    periodBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: RADIUS.sm,
    },
    periodText: { fontSize: 11, fontWeight: '700' },
    dateText: { fontSize: 12 },
    notesPreview: { fontSize: 13, lineHeight: 19 },
    downloadBtn: {
      borderWidth: 1.5,
      borderRadius: RADIUS.lg,
      padding: SPACING.sm,
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    downloadText: { fontWeight: '700', fontSize: 14 },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING['3xl'],
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.xs },
    emptyDesc: { fontSize: 14, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  });
