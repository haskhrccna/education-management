import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHalaqa } from '@/src/hooks/useHalaqa';
import { useWebRTC } from '@/src/hooks/useWebRTC';
import { useSocket } from '@/src/hooks/useSocket';
import { useAuthStore } from '@/src/auth/store';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, RADIUS, SPACING } from '@/constants/theme';
import { AppCard, AppText } from '@/src/components/design';

export default function HalaqaRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const roomId = String(params.id ?? '');
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const user = useAuthStore((s) => s.user);
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const socket = useSocket();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!socket) {
      setIsConnected(false);
      return;
    }
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setIsConnected(socket.connected);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);
  const { rooms, isLoading } = useHalaqa();
  const webRTC = useWebRTC(socket, roomId, user?.id ?? '');

  const room = rooms.find((r) => r.id === roomId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
        <AppText variant="headlineSmall" color="#FFFFFF" style={{ flex: 1, textAlign: 'center' }}>
          {room?.title ?? t('halaqa')}
        </AppText>
        <TouchableOpacity accessibilityRole="button" onPress={webRTC.toggleMute} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name={webRTC.isMuted ? 'mic-off-outline' : 'mic-outline'} size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {!isConnected && <ActivityIndicator color={COLORS.primary} />}
        <AppCard colors={COLORS} style={{ marginBottom: SPACING.md }}>
          <View style={styles.row}>
            <Ionicons name="radio-outline" size={20} color={webRTC.isConnected ? COLORS.success : COLORS.warning} />
            <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.sm }}>
              {webRTC.isConnected ? t('connected') : t('connecting')}
            </AppText>
          </View>
          <AppText variant="bodySmall" color={COLORS.textSecondary} style={{ marginTop: SPACING.xs }}>
            {t('participants')}: {webRTC.remoteParticipants.length + 1}
          </AppText>
        </AppCard>

        <AppText variant="titleMedium" color={COLORS.textPrimary} style={{ marginBottom: SPACING.md }}>
          {t('participants')}
        </AppText>

        {<AppCard colors={COLORS} style={{ marginBottom: SPACING.sm }}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: COLORS.primaryMuted }]}>
              <AppText variant="bodyMedium" color={COLORS.primary}>{t('you')}</AppText>
            </View>
            <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.md }}>
              {user?.firstName} {user?.lastName} {webRTC.isMuted ? `(${t('muted')})` : ''}
            </AppText>
          </View>
        </AppCard>}

        {webRTC.remoteParticipants.map((id) => (
          <AppCard key={id} colors={COLORS} style={{ marginBottom: SPACING.sm }}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: COLORS.surfaceAlt }]}>
                <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} />
              </View>
              <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.md }}>
                {t('participant')} {id.slice(-4)}
              </AppText>
            </View>
          </AppCard>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.leaveBtn, { backgroundColor: COLORS.error }]}
        onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <AppText variant="bodyMedium" color="#FFFFFF">{t('leaveRoom')}</AppText>
      </TouchableOpacity>
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
  content: { flex: 1, padding: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtn: {
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
});
