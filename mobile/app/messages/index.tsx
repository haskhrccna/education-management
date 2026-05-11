import React, { useEffect, useMemo } from 'react';
import { SafeAreaView, FlatList, TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { Ionicons } from '@expo/vector-icons';
import { getColors, SPACING } from '@/constants/theme';
import { useMessages } from '@/src/hooks/useMessages';
import { useAuthStore } from '@/src/auth/store';

interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerInitial: string;
  lastMessageContent: string;
  hasUnread: boolean;
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { messages, isLoading, fetchMessages } = useMessages();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchMessages();
  }, []);

  // Group flat messages into conversations by partner
  const conversations = useMemo<Conversation[]>(() => {
    if (!user) return [];

    const byPartner = new Map<string, Conversation>();

    // Iterate oldest-first so that the last set wins as the latest message
    [...messages].reverse().forEach((msg: any) => {
      const isOutgoing = msg.senderId === user.id;
      const partner = isOutgoing ? msg.receiver : msg.sender;
      if (!partner) return;

      const partnerId: string = partner.id;
      const partnerName = `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim();
      const partnerInitial = partner.firstName?.[0]?.toUpperCase() ?? '?';
      const hasUnread = !msg.readAt && msg.receiverId === user.id;

      byPartner.set(partnerId, {
        partnerId,
        partnerName,
        partnerInitial,
        lastMessageContent: msg.content ?? '',
        hasUnread,
      });
    });

    // Reverse back so newest conversation appears first
    return Array.from(byPartner.values()).reverse();
  }, [messages, user]);

  const borderColor = darkMode ? '#334155' : '#e7e5e4';

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    backBtn: { marginRight: SPACING.sm, padding: 4 },
    backText: { fontSize: 20, color: COLORS.primary },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.sm,
    },
    avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    preview: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: COLORS.primary,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: SPACING.xs,
    },
    emptyDesc: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: 'center',
    },
  });

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        router.push({
          pathname: '/messages/conversation',
          params: { partnerId: item.partnerId, partnerName: item.partnerName },
        })
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.partnerInitial}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.partnerName}</Text>
        <Text style={styles.preview} numberOfLines={1}>
          {item.lastMessageContent}
        </Text>
      </View>
      {item.hasUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('messages')}</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>{t('noConversations')}</Text>
          <Text style={styles.emptyDesc}>{t('noConversationsDesc')}</Text>
        </View>
      ) : (
        <FlatList data={conversations} keyExtractor={(item) => item.partnerId} renderItem={renderItem} />
      )}
    </SafeAreaView>
  );
}
