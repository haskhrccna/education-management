import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';
import { appointmentsApi, Appointment } from '@/src/api';
import { useAuthStore } from '@/src/auth/store';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function StudentAppointmentsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user } = useAuthStore();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [duration, setDuration] = useState('30');
  const [submitting, setSubmitting] = useState(false);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const data = await appointmentsApi.getMine();
      setAppointments(data);
    } catch (err: any) {
      Alert.alert(t('error'), err.message || t('fetchError'));
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    if (!teacherId.trim()) {
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
        teacherId: teacherId.trim(),
        requestedDate: dateStr.trim(),
        requestedTime: timeStr.trim(),
        durationMinutes: parseInt(duration, 10) || 30,
      });
      Alert.alert(t('success'), t('appointmentRequested'));
      setShowForm(false);
      setTeacherId('');
      setDateStr('');
      setTimeStr('');
      await fetchAppointments();
    } catch (err: any) {
      Alert.alert(t('error'), err.message || t('requestFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const pending = appointments.filter((a) => a.status === 'PENDING');
  const decided = appointments.filter((a) => a.status !== 'PENDING');

  const renderAppointment = (item: Appointment) => {
    const statusKey = item.status?.toUpperCase?.() ?? '';
    const statusColor = statusKey === 'ACCEPTED' ? '#22c55e' : statusKey === 'REJECTED' ? '#ef4444' : '#f59e0b';
    const statusLabel =
      statusKey === 'ACCEPTED' ? t('approved') : statusKey === 'REJECTED' ? t('rejected') : t('awaitingApproval');
    const dateText = item.requestedDate
      ? new Date(item.requestedDate).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.teacherName}>
            {item.teacher?.firstName} {item.teacher?.lastName}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusColor }]}>
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {dateText} · {item.requestedTime ?? ''} · {item.durationMinutes ?? 0} {t('minutes')}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.topBar, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={[styles.backText, { color: '#fff' }]}>{isRTL ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: '#fff' }]}>{t('myAppointments')}</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Animated.View entering={FadeInUp.delay(100)}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.primaryButtonText}>{showForm ? t('cancel') : t('requestSession')}</Text>
          </TouchableOpacity>
        </Animated.View>

        {showForm && (
          <Animated.View entering={FadeInUp.delay(200)} style={styles.formCard}>
            <Text style={styles.label}>{t('teacherId')}</Text>
            <TextInput
              style={styles.input}
              value={teacherId}
              onChangeText={setTeacherId}
              placeholder={t('enterTeacherId')}
              placeholderTextColor={COLORS.textSecondary}
            />
            <Text style={styles.label}>{t('date')}</Text>
            <TextInput
              style={styles.input}
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textSecondary}
            />
            <Text style={styles.label}>{t('time')}</Text>
            <TextInput
              style={styles.input}
              value={timeStr}
              onChangeText={setTimeStr}
              placeholder="HH:MM"
              placeholderTextColor={COLORS.textSecondary}
            />
            <Text style={styles.label}>{t('durationMinutes')}</Text>
            <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" />
            <TouchableOpacity
              style={[styles.primaryButton, submitting && styles.disabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.primaryButtonText}>{submitting ? t('submitting') : t('submitRequest')}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {isLoading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {pending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('pendingAppointments')}</Text>
                {pending.map(renderAppointment)}
              </View>
            )}
            {decided.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('history')}</Text>
                {decided.map(renderAppointment)}
              </View>
            )}
            {appointments.length === 0 && !isLoading && <Text style={styles.empty}>{t('noAppointments')}</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { padding: SPACING.md, paddingBottom: SPACING.xl },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomLeftRadius: RADIUS.lg,
      borderBottomRightRadius: RADIUS.lg,
    },
    backText: { fontSize: 20, fontWeight: '700' },
    topTitle: { fontSize: 18, fontWeight: '700' },
    primaryButton: {
      backgroundColor: COLORS.primary,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    primaryButtonText: { color: '#fff', fontWeight: '600' },
    disabled: { opacity: 0.6 },
    formCard: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      ...SHADOWS.md,
    },
    label: { color: COLORS.text, fontWeight: '600', marginBottom: SPACING.xs },
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      color: COLORS.text,
      marginBottom: SPACING.sm,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      ...SHADOWS.sm,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    teacherName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: RADIUS.full },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    meta: { color: COLORS.textSecondary, marginTop: 4 },
    notes: { color: COLORS.textSecondary, marginTop: 4, fontStyle: 'italic' },
    section: { marginTop: SPACING.md },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
    empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 40 },
  });
