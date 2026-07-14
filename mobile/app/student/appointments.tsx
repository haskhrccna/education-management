import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { appointmentsApi, Appointment } from '@/src/api';
import { useAuthStore } from '@/src/auth/store';
import { useRecurringSlots } from '@/src/hooks/useRecurringSlots';
import { AppCard, Avatar, EmptyState, IconButton, SectionHeader, StatusPill } from '@/src/components/design';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

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

const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayName(dayOfWeek: number, isAr: boolean): string {
  return (isAr ? DAY_NAMES_AR : DAY_NAMES_EN)[dayOfWeek] ?? '';
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

// Selectable dates for the picker: today plus the next `count` days, as
// local `YYYY-MM-DD` values (local components avoid the UTC day-shift that
// toISOString() introduces).
function buildDateOptions(count = 120): string[] {
  const out: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push(value);
  }
  return out;
}

// Selectable start times across the day as `HH:MM` (24-hour), in fixed steps.
function buildTimeOptions(stepMinutes = 30): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return out;
}

export default function StudentAppointmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);
  const { user } = useAuthStore();
  const { slots: recurringSlots, createSlot, cancelSlot } = useRecurringSlots();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [duration, setDuration] = useState('30');
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const dateOptions = useMemo(() => buildDateOptions(120), []);
  const timeOptions = useMemo(() => buildTimeOptions(30), []);

  // A student has exactly one assigned teacher and books only with them. Prefer
  // the profile's assignedTeacher, falling back to the teacher on an ACCEPTED
  // appointment (same derivation as the student home screen). Changing teacher
  // goes through the admin request flow (the teacher-change screen).
  const assignedTeacher =
    user?.assignedTeacher ?? appointments.find((a) => a.status?.toUpperCase() === 'ACCEPTED')?.teacher ?? null;

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

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    const teacherId = assignedTeacher?.id;
    if (!teacherId) {
      Alert.alert(t('error'), isAr ? 'ليس لديك معلم معيّن بعد.' : 'You do not have an assigned teacher yet.');
      return;
    }
    if (!dateStr.trim() || !timeStr.trim()) {
      Alert.alert(t('error'), t('dateTimeRequired'));
      return;
    }

    setSubmitting(true);
    try {
      if (makeRecurring) {
        const dayOfWeek = new Date(`${dateStr.trim()}T00:00:00`).getDay();
        const result = await createSlot(teacherId, dayOfWeek, timeStr.trim(), parseInt(duration, 10) || 30);
        if (!result) {
          Alert.alert(t('error'), t('requestFailed'));
          return;
        }
      } else {
        await appointmentsApi.create({
          teacherId,
          requestedDate: dateStr.trim(),
          requestedTime: timeStr.trim(),
          durationMinutes: parseInt(duration, 10) || 30,
        });
      }
      setShowForm(false);
      setDateStr('');
      setTimeStr('');
      setDuration('30');
      setMakeRecurring(false);
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

            <Text style={styles.label}>{isAr ? 'معلمك' : 'Your teacher'}</Text>
            {assignedTeacher ? (
              <View style={styles.assignedTeacherRow}>
                <Avatar colors={COLORS} label={fullName(assignedTeacher)} size={36} />
                <Text style={styles.assignedTeacherName} numberOfLines={1}>
                  {fullName(assignedTeacher)}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/student/teacher-change')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.changeTeacherLink}>{isAr ? 'طلب تغيير' : 'Request change'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.requestTeacherBox}
                onPress={() => router.push('/student/teacher-change')}
              >
                <Ionicons name="person-add-outline" size={20} color={COLORS.primary} />
                <Text style={styles.requestTeacherText}>
                  {isAr
                    ? 'ليس لديك معلم معيّن بعد. اطلب تعيين معلم من الإدارة.'
                    : 'You have no assigned teacher yet. Request one from the admin.'}
                </Text>
                <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.primary} />
              </TouchableOpacity>
            )}

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.label}>{t('date')}</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.input, styles.selectBox]}
                  onPress={() => setShowDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('date')}
                >
                  <Text style={[styles.selectText, !dateStr && styles.selectPlaceholder]} numberOfLines={1}>
                    {dateStr ? formatDate(dateStr, i18n.language) : isAr ? 'اختر التاريخ' : 'Select date'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.label}>{t('time')}</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.input, styles.selectBox]}
                  onPress={() => setShowTimePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('time')}
                >
                  <Text style={[styles.selectText, !timeStr && styles.selectPlaceholder]} numberOfLines={1}>
                    {timeStr ? timeStr : isAr ? 'اختر الوقت' : 'Select time'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
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
              style={styles.recurringToggle}
              onPress={() => setMakeRecurring((current) => !current)}
            >
              <Ionicons
                name={makeRecurring ? 'checkbox' : 'square-outline'}
                size={20}
                color={makeRecurring ? COLORS.primary : COLORS.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {isAr ? 'اجعله موعداً أسبوعياً ثابتاً' : 'Make this a standing weekly slot'}
                </Text>
                <Text style={styles.rowMeta}>
                  {isAr
                    ? 'سيتكرر هذا الموعد كل أسبوع في نفس اليوم والوقت.'
                    : 'Repeats every week on the same day and time.'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.submitButton, (submitting || !assignedTeacher) && styles.disabled]}
              onPress={handleSubmit}
              disabled={submitting || !assignedTeacher}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>{t('submitRequest')}</Text>
              )}
            </TouchableOpacity>
          </AppCard>
        ) : null}

        {recurringSlots.length > 0 ? (
          <>
            <SectionHeader title={isAr ? 'المواعيد الأسبوعية الثابتة' : 'Standing weekly slots'} colors={COLORS} />
            <View style={styles.listStack}>
              {recurringSlots.map((slot) => (
                <AppCard key={slot.id} colors={COLORS} style={styles.appointmentCard}>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.rowTitle}>{dayName(slot.dayOfWeek, isAr)}</Text>
                    <Text style={styles.rowMeta}>
                      {slot.time} - {slot.durationMinutes} {t('minutes')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        isAr ? 'إلغاء الموعد الأسبوعي' : 'Cancel weekly slot',
                        isAr
                          ? 'لن يتم إنشاء مواعيد جديدة من هذا الموعد الثابت. الجلسات الحالية تبقى كما هي.'
                          : 'No new sessions will be generated from this slot. Already-booked sessions stay as they are.',
                        [
                          { text: t('cancel'), style: 'cancel' },
                          { text: isAr ? 'نعم، إلغاء' : 'Yes, cancel', onPress: () => cancelSlot(slot.id) },
                        ]
                      )
                    }
                  >
                    <Ionicons name="close-circle-outline" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                </AppCard>
              ))}
            </View>
          </>
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

      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isAr ? 'اختر التاريخ' : 'Select date'}</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t('close')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={dateOptions}
              keyExtractor={(value) => value}
              style={styles.dateList}
              initialNumToRender={14}
              renderItem={({ item }) => {
                const selected = item === dateStr;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setDateStr(item);
                      setShowDatePicker(false);
                    }}
                    style={[
                      styles.dateRow,
                      { flexDirection: isAr ? 'row-reverse' : 'row' },
                      selected && styles.dateRowActive,
                    ]}
                  >
                    <Text style={[styles.dateRowText, selected && styles.dateRowTextActive]}>
                      {formatDate(item, i18n.language)}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTimePicker(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isAr ? 'اختر الوقت' : 'Select time'}</Text>
              <TouchableOpacity
                onPress={() => setShowTimePicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t('close')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={timeOptions}
              keyExtractor={(value) => value}
              style={styles.dateList}
              initialNumToRender={16}
              renderItem={({ item }) => {
                const selected = item === timeStr;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setTimeStr(item);
                      setShowTimePicker(false);
                    }}
                    style={[
                      styles.dateRow,
                      { flexDirection: isAr ? 'row-reverse' : 'row' },
                      selected && styles.dateRowActive,
                    ]}
                  >
                    <Text style={[styles.dateRowText, selected && styles.dateRowTextActive]}>{item}</Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <BottomNav role="student" active="sessions" />
    </View>
  );
}

const createStyles = (COLORS: ThemeColors) =>
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
    assignedTeacherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.primaryMuted,
      borderWidth: 1,
      borderColor: COLORS.primary,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    assignedTeacherName: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    changeTeacherLink: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    requestTeacherBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderStyle: 'dashed',
      backgroundColor: COLORS.darkMode ? COLORS.surfaceAlt : '#F2F5F1',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
    },
    requestTeacherText: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
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
    selectBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    selectText: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    selectPlaceholder: {
      color: COLORS.textMuted,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: COLORS.surface,
      borderTopLeftRadius: RADIUS['2xl'],
      borderTopRightRadius: RADIUS['2xl'],
      paddingBottom: SPACING.xl,
      maxHeight: '72%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.divider,
    },
    modalTitle: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    dateList: {
      paddingHorizontal: SPACING.lg,
    },
    dateRow: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      marginTop: SPACING.xs,
    },
    dateRowActive: {
      backgroundColor: COLORS.primaryMuted,
    },
    dateRowText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    dateRowTextActive: {
      color: COLORS.primary,
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
    recurringToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.xs,
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
