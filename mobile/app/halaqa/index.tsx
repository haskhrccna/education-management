import React, { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHalaqa } from '@/src/hooks/useHalaqa';
import { useAuthStore } from '@/src/auth/store';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, RADIUS, SPACING } from '@/constants/theme';
import { AppCard, AppText, EmptyState, SectionHeader } from '@/src/components/design';
import { BottomNav } from '@/src/components/BottomNav';

type AppRole = 'student' | 'teacher' | 'admin' | 'parent' | undefined;

function useRole(): AppRole {
  const user = useAuthStore((s) => s.user);
  const role = user?.role?.toLowerCase();
  if (role === 'student' || role === 'teacher' || role === 'admin' || role === 'parent') return role;
  return undefined;
}

function statusTone(status: string): 'warning' | 'success' | 'error' | 'neutral' {
  const s = status.toUpperCase();
  if (s === 'WAITING') return 'warning';
  if (s === 'LIVE') return 'success';
  if (s === 'ENDED') return 'error';
  return 'neutral';
}

export default function HalaqaListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const role = useRole();
  const user = useAuthStore((s) => s.user);
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { rooms, isLoading, error, fetchRooms, createRoom, startRoom, endRoom } = useHalaqa();
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = role === 'teacher' || role === 'admin';

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const room = await createRoom(newTitle.trim());
      setNewTitle('');
      router.push(`/halaqa/room?id=${room.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
        <AppText variant="headlineSmall" color="#FFFFFF">{t('halaqaRooms')}</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => fetchRooms()} />}
      >
        {canCreate && (
          <AppCard colors={COLORS}>
            <AppText variant="labelLarge" color={COLORS.textPrimary}>{t('createRoom')}</AppText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: COLORS.surface,
                  borderColor: COLORS.borderSubtle,
                  color: COLORS.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
              ]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={t('roomTitlePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
            />
            <TouchableOpacity
              style={[styles.submit, { backgroundColor: COLORS.primary, opacity: newTitle.trim() ? 1 : 0.5 }]}
              onPress={handleCreate}
              disabled={!newTitle.trim() || creating}
            >
              {creating ? <ActivityIndicator color="#FFFFFF" /> : <AppText variant="bodyMedium" color="#FFFFFF">{t('createRoom')}</AppText>}
            </TouchableOpacity>
          </AppCard>
        )}

        {error ? (
          <View style={styles.center}>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>{error}</AppText>
            <TouchableOpacity onPress={() => fetchRooms()} style={{ marginTop: SPACING.md }}>
              <AppText variant="bodyMedium" color={COLORS.primary}>{t('retry')}</AppText>
            </TouchableOpacity>
          </View>
        ) : rooms.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState colors={COLORS} icon="videocam-outline" title={t('noHalaqaRooms')} description="" />
          </View>
        ) : (
          rooms.map((room) => {
            const isOwner = user?.id === room.teacherId;
            const status = statusTone(room.status);
            return (
              <TouchableOpacity key={room.id} onPress={() => router.push(`/halaqa/room?id=${room.id}`)}>
                <AppCard colors={COLORS} style={{ marginBottom: SPACING.sm }}>
                  <View style={styles.row}>
                    <View style={[styles.statusDot, { backgroundColor: status === 'neutral' ? COLORS.textMuted : COLORS[status] }]} />
                    <AppText variant="titleMedium" color={COLORS.textPrimary} style={{ flex: 1, marginStart: SPACING.sm }}>
                      {room.title}
                    </AppText>
                  </View>
                  <AppText variant="bodySmall" color={COLORS.textSecondary}>
                    {room.teacher.firstName} {room.teacher.lastName} · {t(room.status.toLowerCase())} ·{' '}
                    {room._count?.participants ?? 0} {t('participants')}
                  </AppText>
                  <View style={styles.actions}>
                    {isOwner && room.status === 'WAITING' && (
                      <TouchableOpacity onPress={() => startRoom(room.id)} style={[styles.action, { backgroundColor: COLORS.success }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <AppText variant="bodySmall" color="#FFFFFF">{t('startRoom')}</AppText>
                      </TouchableOpacity>
                    )}
                    {isOwner && room.status === 'LIVE' && (
                      <TouchableOpacity onPress={() => endRoom(room.id)} style={[styles.action, { backgroundColor: COLORS.error }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <AppText variant="bodySmall" color="#FFFFFF">{t('endRoom')}</AppText>
                      </TouchableOpacity>
                    )}
                    {room.status === 'LIVE' && (
                      <View style={[styles.pill, { backgroundColor: COLORS.successLight }]}>
                        <AppText variant="bodySmall" color={COLORS.success}>{t('liveNow')}</AppText>
                      </View>
                    )}
                  </View>
                </AppCard>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {role && <BottomNav role={role} active="halaqa" />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  body: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    fontSize: 14,
    marginTop: SPACING.sm,
  },
  submit: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  action: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.md },
  pill: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full },
});
