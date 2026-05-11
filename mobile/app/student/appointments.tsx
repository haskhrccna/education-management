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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { appointmentsApi, Appointment } from '@/src/api';
import { useAuthStore } from '@/src/auth/store';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';
import { AppCard, Avatar, EmptyState, IconButton, SectionHeader, StatusPill } from '@/src/components/design';
import { useSettingsStore } from '@/src/settings/store';

interface TeacherOption {
  id: string;
  firstName: string;
  lastName: string;
}

function fullName(person?: { firstName?: string; lastName?: string } | null): string {
  return `${person?.firstName ?? ''} ${person?.lastName ?? ''}`.trim() || '?';
}

function statusTone(status?: string): 'success' | 'warning' | 'error' | 'neutral' {
  const normalized = status?.toUpperCase();
  if (normalized === 'ACCEPTED') return 'success';
  if (normalized === 'REJECTED') return 'error';
  if (normalized === 'PENDING' || normalized === 'REQUESTED') return 'warning';
  return 'neutral';
}

function statusLabel(status: string | undefined, isAr: boolean): string {
  const normalized = status?.toUpperCase();
  if (normalized === 'ACCEPTED') return isAr ? 'مقبول' : 'Accepted';
  if (normalized === 'REJECTED') return isAr ? 'مرفوض' : 'Rejected';
  if (normalized === 'PENDING' || normalized === 'REQUESTED') return isAr ? 'بانتظار' : 'Pending';
  return status ?? '';
}

function formatDate(dateStr: string | undefined, lang: string): string {
  if (!dateStr) return '';
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

export default function StudentAppointmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);
  const { user } = useAuthStore();
  const { fetchTeachers } = useTeacherChange();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(user?.assignedTeacher?.id ?? '');
  const [manualTeacherId, setManualTeacherId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [duration, setDuration] = useState('30');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, TeacherOption>();
    teachers.forEach((teacher) => map.set(teacher.id, teacher));
    if (user?.assignedTeacher?.id) {
      map.set(user.assignedTeacher.id, {
        id: user.assignedTeacher.id,
        firstName: user.assignedTeacher.firstName,
        lastName: user.assignedTeacher.lastName,
      });
    }
    return Array.from(map.values());
  }, [teachers, user?.assignedTeacher]);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      setAppointments(await appointmentsApi.getMine());
    } catch (err: any) {
      Alert.alert(t('error'), err.message || t('fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const loadTeachers = useCallback(async () => {
    try {
      const data = await fetchTeachers();
      if (Array.isArray(data)) setTeachers(data);
    } catch {
      setTeachers([]);
    }
  }, [fetchTeachers]);

  useEffect(() => {
    fetchAppointments();
    loadTeachers();
  }, [fetchAppointments, loadTeachers]);

  useEffect(() => {
    if (!selectedTeacherId && teacherOptions[0]?.id) {
      setSelectedTeacherId(teacherOptions[0].id);
    }
  }, [teacherOptions, selectedTeacherId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAppointments(), loadTeachers()]);
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    const teacherId = selectedTeacherId || manualTeacherId.trim();
    if (!teacherId) {
      Alert.alert(t('error'), t('teacherIdRequired'));
      return;
    }
    if (!dateStr.trim() || !timeStr.trim()) {
      Alert.alert(t('error'), t('dateTimeRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await appointmentsApi.create({
        teacherId,
        requestedDate: dateStr.trim(),
        requestedTime: timeStr.trim(),
        durationMinutes: parseInt(duration, 10) || 30,
      });
      setShowForm(false);
      setDateStr('');
      setTimeStr('');
      setDuration('30');
      setManualTeacherId('');
      await fetchAppointments();
    } catch (err: any) {
      Alert.alert(t('error'), err.message || t('requestFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const pending = appointments.filter((appointment) => {
    const status = appointment.status?.toUpperCase();
    return status === 'PENDING' || status === 'REQUESTED';
  });
  const decided = appointments.filter((appointment) => {
    const status = appointment.status?.toUpperCase();
    return status !== 'PENDING' && status !== 'REQUESTED';
  });

  const renderAppointment = (item: Appointment) => {
    const teacherName = fullName(item.teacher);
    return (
      <AppCard key={item.id} colors={COLORS} style={styles.appointmentCard}>
        <Avatar colors={COLORS} label={teacherName} size={42} />
        <View style={styles.appointmentInfo}>
          <Text style={styles.rowTitle}>{teacherName}</Text>
          <Text style={styles.rowMeta}>
            {formatDate(item.requestedDate, i18n.language)} - {item.requestedTime ?? ''} - {item.durationMinutes ?? 30}{' '}
            {t('minutes')}
          </Text>
        </View>
        <StatusPill colors={COLORS} label={statusLabel(item.status, isAr)} status={statusTone(item.status)} />
      </AppCard>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <IconButton
            colors={COLORS}
            icon={isAr ? 'arrow-forward-outline' : 'arrow-back-outline'}
            accessibilityLabel={isAr ? 'رجوع' : 'Back'}
            onPress={() => router.back()}
          />
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>{isAr ? 'جلسات المراجعة' : 'Review sessions'}</Text>
            <Text style={styles.title}>{t('myAppointments')}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="calendar-outline" size={28} color={COLORS.textOnPrimary} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{isAr ? 'احجز موعدك القادم' : 'Book your next session'}</Text>
            <Text style={styles.heroSubtitle}>
              {isAr
                ? 'اختر المعلم والوقت بوضوح قبل إرسال الطلب.'
                : 'Choose the teacher, time, and duration before sending.'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primaryButton, showForm && styles.secondaryButton]}
          onPress={() => setShowForm((current) => !current)}
        >
          <Ionicons
            name={showForm ? 'close-outline' : 'add-outline'}
            size={20}
            color={showForm ? COLORS.primary : '#FFFFFF'}
          />
          <Text style={[styles.primaryButtonText, showForm && styles.secondaryButtonText]}>
            {showForm ? t('cancel') : t('requestSession')}
          </Text>
        </TouchableOpacity>

        {showForm ? (
          <AppCard colors={COLORS} style={styles.formCard}>
            <SectionHeader title={isAr ? 'تفاصيل الجلسة' : 'Session details'} colors={COLORS} />

            <Text style={styles.label}>{t('selectTeacher')}</Text>
            {teacherOptions.length > 0 ? (
              <View style={styles.teacherGrid}>
                {teacherOptions.map((teacher) => {
                  const selected = selectedTeacherId === teacher.id;
                  const name = fullName(teacher);
                  return (
                    <TouchableOpacity
                      key={teacher.id}
                      activeOpacity={0.85}
                      onPress={() => setSelectedTeacherId(teacher.id)}
                      style={[styles.teacherChip, selected && styles.teacherChipActive]}
                    >
                      <Avatar colors={COLORS} label={name} size={32} />
                      <Text
                        style={[styles.teacherChipText, selected && styles.teacherChipTextActive]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={manualTeacherId}
                onChangeText={setManualTeacherId}
                placeholder={t('enterTeacherId')}
                placeholderTextColor={COLORS.textMuted}
                textAlign={isAr ? 'right' : 'left'}
              />
            )}

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.label}>{t('date')}</Text>
                <TextInput
                  style={styles.input}
                  value={dateStr}
                  onChangeText={setDateStr}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                  textAlign="center"
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.label}>{t('time')}</Text>
                <TextInput
                  style={styles.input}
                  value={timeStr}
                  onChangeText={setTimeStr}
                  placeholder="HH:MM"
                  placeholderTextColor={COLORS.textMuted}
                  textAlign="center"
                />
              </View>
            </View>

            <Text style={styles.label}>{t('durationMinutes')}</Text>
            <View style={styles.durationRow}>
              {['30', '45', '60'].map((value) => {
                const selected = duration === value;
                return (
                  <TouchableOpacity
                    key={value}
                    activeOpacity={0.85}
                    onPress={() => setDuration(value)}
                    style={[styles.durationChip, selected && styles.durationChipActive]}
                  >
                    <Text style={[styles.durationText, selected && styles.durationTextActive]}>
                      {value} {t('minutes')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.submitButton, submitting && styles.disabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>{t('submitRequest')}</Text>
              )}
            </TouchableOpacity>
          </AppCard>
        ) : null}

        {isLoading && !refreshing ? (
          <ActivityIndicator color={COLORS.primary} style={styles.loader} />
        ) : (
          <>
            <SectionHeader title={t('pendingAppointments')} colors={COLORS} />
            {pending.length > 0 ? (
              <View style={styles.listStack}>{pending.map(renderAppointment)}</View>
            ) : (
              <AppCard colors={COLORS}>
                <EmptyState
                  colors={COLORS}
                  icon="time-outline"
                  title={isAr ? 'لا توجد مواعيد معلقة' : 'No pending sessions'}
                  description={isAr ? 'أي طلب جديد سيظهر هنا.' : 'New requests will appear here.'}
                />
              </AppCard>
            )}

            <SectionHeader title={t('history')} colors={COLORS} />
            {decided.length > 0 ? (
              <View style={styles.listStack}>{decided.map(renderAppointment)}</View>
            ) : (
              <AppCard colors={COLORS}>
                <Text style={styles.emptyLine}>{t('noAppointments')}</Text>
              </AppCard>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING['3xl'],
      gap: SPACING.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    headerText: {
      flex: 1,
    },
    eyebrow: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 2,
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 25,
      fontWeight: '800',
      lineHeight: 31,
    },
    hero: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS['2xl'],
      padding: SPACING.xl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      ...SHADOWS.md,
    },
    heroIcon: {
      width: 54,
      height: 54,
      borderRadius: RADIUS.lg,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroText: {
      flex: 1,
    },
    heroTitle: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 25,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: 4,
    },
    primaryButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
    secondaryButton: {
      backgroundColor: COLORS.primaryMuted,
    },
    secondaryButtonText: {
      color: COLORS.primary,
    },
    formCard: {
      gap: SPACING.md,
    },
    label: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    teacherGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    teacherChip: {
      width: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.darkMode ? COLORS.surfaceAlt : '#F2F5F1',
      padding: SPACING.sm,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    teacherChipActive: {
      backgroundColor: COLORS.primaryMuted,
      borderColor: COLORS.primary,
    },
    teacherChipText: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    teacherChipTextActive: {
      color: COLORS.primary,
    },
    inputRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    inputHalf: {
      flex: 1,
      gap: SPACING.xs,
    },
    input: {
      minHeight: 48,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.darkMode ? COLORS.divider : '#DDE5DC',
      backgroundColor: COLORS.darkMode ? COLORS.surfaceAlt : '#F8FAF7',
      color: COLORS.textPrimary,
      paddingHorizontal: SPACING.md,
      fontSize: 14,
      fontWeight: '700',
    },
    durationRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    durationChip: {
      flex: 1,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      backgroundColor: COLORS.darkMode ? COLORS.surfaceAlt : '#F2F5F1',
    },
    durationChipActive: {
      backgroundColor: COLORS.primary,
    },
    durationText: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    durationTextActive: {
      color: COLORS.textOnPrimary,
    },
    submitButton: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.md,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.xs,
    },
    submitText: {
      color: COLORS.textOnPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    disabled: {
      opacity: 0.6,
    },
    loader: {
      marginTop: SPACING.xl,
    },
    listStack: {
      gap: SPACING.md,
    },
    appointmentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    appointmentInfo: {
      flex: 1,
    },
    rowTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    rowMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
    },
    emptyLine: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
