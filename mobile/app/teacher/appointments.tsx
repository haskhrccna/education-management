import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { Ionicons } from '@expo/vector-icons';
import { appointmentsApi, Appointment } from '@/src/api';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

function statusStyle(status: string, COLORS: any) {
  const s = status.toUpperCase();
  if (s === 'ACCEPTED') return { bg: COLORS.successLight, fg: COLORS.success };
  if (s === 'REJECTED') return { bg: COLORS.errorLight, fg: COLORS.error };
  return { bg: COLORS.warningLight, fg: COLORS.warning };
}

function statusLabel(status: string, t: (k: string) => string): string {
  const s = status.toUpperCase();
  if (s === 'ACCEPTED') return t('approved');
  if (s === 'REJECTED') return t('rejected');
  return t('awaitingApproval');
}

function isPending(status: string): boolean {
  const s = status.toUpperCase();
  return s !== 'ACCEPTED' && s !== 'REJECTED';
}

export default function TeacherAppointmentsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setError(null);
    try {
      const data = await appointmentsApi.getMine();
      setAppointments(data);
    } catch (err: any) {
      setError(err?.message ?? t('loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    setIsLoading(true);
    fetchAppointments().finally(() => setIsLoading(false));
  }, [fetchAppointments]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAppointments();
    setIsRefreshing(false);
  }, [fetchAppointments]);

  const handleAction = async (id: string, action: 'ACCEPTED' | 'REJECTED') => {
    setActingId(id);
    try {
      const updated = await appointmentsApi.manage(id, action);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
      Alert.alert(action === 'ACCEPTED' ? t('appointmentAccepted') : t('appointmentRejected'));
    } catch (err: any) {
      Alert.alert(t('failedToManageAppointment'), err?.response?.data?.message ?? err?.message ?? '');
    } finally {
      setActingId(null);
    }
  };

  const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

  const pending = appointments.filter((a) => isPending(a.status));
  const decided = appointments.filter((a) => !isPending(a.status));

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
        <Text style={styles.title}>{t('appointments')}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{pending.length}</Text>
            <Text style={styles.statLbl}>{t('pendingAppointments')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{appointments.length}</Text>
            <Text style={styles.statLbl}>{t('appointments')}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: COLORS.error, marginBottom: SPACING.md }}>{error}</Text>
            <TouchableOpacity onPress={onRefresh}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : appointments.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40, marginBottom: SPACING.md }}>📆</Text>
            <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>{t('noAppointments')}</Text>
            <Text style={[styles.emptyDesc, { color: COLORS.textSecondary }]}>{t('noAppointmentsDesc')}</Text>
          </View>
        ) : (
          <>
            {pending.length > 0 && (
              <Text style={[styles.sectionTitle, { color: COLORS.primaryDark }]}>
                {t('pendingAppointments')} · {pending.length}
              </Text>
            )}
            {pending.map((a) => (
              <AppointmentCard
                key={a.id}
                appt={a}
                COLORS={COLORS}
                styles={styles}
                dateLocale={dateLocale}
                t={t}
                isActing={actingId === a.id}
                onAccept={() => handleAction(a.id, 'ACCEPTED')}
                onReject={() => handleAction(a.id, 'REJECTED')}
                showActions
              />
            ))}

            {decided.length > 0 && (
              <Text style={[styles.sectionTitle, { color: COLORS.primaryDark, marginTop: SPACING.lg }]}>
                {i18n.language === 'ar' ? 'السجل' : 'History'} · {decided.length}
              </Text>
            )}
            {decided.map((a) => (
              <AppointmentCard
                key={a.id}
                appt={a}
                COLORS={COLORS}
                styles={styles}
                dateLocale={dateLocale}
                t={t}
                isActing={false}
                onAccept={() => {}}
                onReject={() => {}}
                showActions={false}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface CardProps {
  appt: Appointment;
  COLORS: any;
  styles: any;
  dateLocale: string;
  t: (k: string) => string;
  isActing: boolean;
  onAccept: () => void;
  onReject: () => void;
  showActions: boolean;
}

function AppointmentCard({
  appt,
  COLORS,
  styles,
  dateLocale,
  t,
  isActing,
  onAccept,
  onReject,
  showActions,
}: CardProps) {
  const colors = statusStyle(appt.status, COLORS);
  const dateStr = new Date(appt.requestedDate).toLocaleDateString(dateLocale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const studentName = appt.student ? `${appt.student.firstName} ${appt.student.lastName}`.trim() : '—';
  return (
    <View style={[styles.card, { backgroundColor: COLORS.surface }]}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: COLORS.primaryMuted }]}>
          <Text style={[styles.avatarText, { color: COLORS.primary }]}>
            {appt.student?.firstName?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.studentName, { color: COLORS.textPrimary }]}>{studentName}</Text>
          <Text style={[styles.metaText, { color: COLORS.textSecondary }]}>
            {dateStr} · {appt.requestedTime}
          </Text>
          <Text style={[styles.metaText, { color: COLORS.textSecondary }]}>{appt.durationMinutes} min</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusText, { color: colors.fg }]}>{statusLabel(appt.status, t)}</Text>
        </View>
      </View>
      {showActions && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, { borderColor: COLORS.error }]}
            onPress={onReject}
            disabled={isActing}
            activeOpacity={0.85}
          >
            {isActing ? (
              <ActivityIndicator color={COLORS.error} />
            ) : (
              <Text style={[styles.rejectText, { color: COLORS.error }]}>{t('rejectAppointment')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn, { backgroundColor: COLORS.primary }]}
            onPress={onAccept}
            disabled={isActing}
            activeOpacity={0.85}
          >
            {isActing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.acceptText}>{t('acceptAppointment')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
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
      gap: SPACING.md,
    },
    backText: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: SPACING.sm },
    title: { fontSize: 22, fontWeight: '800', color: '#fff' },
    statsRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
    stat: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      alignItems: 'center',
    },
    statVal: { fontSize: 20, fontWeight: '800', color: '#fff' },
    statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    scroll: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: SPACING['3xl'] },
    sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    card: { borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOWS.sm, gap: SPACING.md },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 16, fontWeight: '800' },
    studentName: { fontSize: 16, fontWeight: '700', marginBottom: SPACING.xs },
    metaText: { fontSize: 13, marginTop: 2 },
    statusBadge: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 5,
      borderRadius: RADIUS.full,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    actionsRow: { flexDirection: 'row', gap: SPACING.sm },
    actionBtn: {
      flex: 1,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptBtn: { ...SHADOWS.sm },
    rejectBtn: { borderWidth: 1.5, backgroundColor: 'transparent' },
    acceptText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    rejectText: { fontWeight: '700', fontSize: 14 },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING['3xl'] },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.xs },
    emptyDesc: { fontSize: 14, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  });
