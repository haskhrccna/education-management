import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getColors, SPACING } from '@/constants/theme';
import { useAuthStore } from '@/src/auth/store';
import { AppCard, Avatar, EmptyState, IconButton } from '@/src/components/design';
import { useMessages } from '@/src/hooks/useMessages';
import { useSettingsStore } from '@/src/settings/store';

interface Conversation {
  partnerId: string;
  partnerName: string;
  lastMessageContent: string;
  hasUnread: boolean;
  isOutgoing: boolean;
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);
  const { messages, isLoading, fetchMessages } = useMessages();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const conversations = useMemo<Conversation[]>(() => {
    if (!user) return [];

    const byPartner = new Map<string, Conversation>();
    [...messages].reverse().forEach((msg: any) => {
      const isOutgoing = msg.senderId === user.id;
      const partner = isOutgoing ? msg.receiver : msg.sender;
      if (!partner?.id) return;

      const partnerName = `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim() || '?';
      byPartner.set(partner.id, {
        partnerId: partner.id,
        partnerName,
        lastMessageContent: msg.content ?? '',
        hasUnread: !msg.readAt && msg.receiverId === user.id,
        isOutgoing,
      });
    });

    return Array.from(byPartner.values()).reverse();
  }, [messages, user]);

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        router.push({
          pathname: '/messages/conversation',
          params: { partnerId: item.partnerId, partnerName: item.partnerName },
        })
      }
    >
      <AppCard colors={COLORS} style={styles.conversationCard}>
        <Avatar colors={COLORS} label={item.partnerName} size={48} />
        <View style={styles.conversationInfo}>
          <View style={styles.conversationTop}>
            <Text style={styles.name} numberOfLines={1}>
              {item.partnerName}
            </Text>
            {item.hasUnread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={[styles.preview, item.hasUnread && styles.previewUnread]} numberOfLines={1}>
            {item.isOutgoing ? (isAr ? 'أنت: ' : 'You: ') : ''}
            {item.lastMessageContent}
          </Text>
        </View>
        <IconButton
          colors={COLORS}
          icon={isAr ? 'chevron-back-outline' : 'chevron-forward-outline'}
          accessibilityLabel={isAr ? 'فتح المحادثة' : 'Open conversation'}
          size={34}
          onPress={() =>
            router.push({
              pathname: '/messages/conversation',
              params: { partnerId: item.partnerId, partnerName: item.partnerName },
            })
          }
        />
      </AppCard>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + SPACING.lg }]}>
      <View style={styles.header}>
        <IconButton
          colors={COLORS}
          icon={isAr ? 'arrow-forward-outline' : 'arrow-back-outline'}
          accessibilityLabel={isAr ? 'رجوع' : 'Back'}
          onPress={() => router.back()}
        />
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{isAr ? 'المحادثات' : 'Conversations'}</Text>
          <Text style={styles.title}>{t('messages')}</Text>
        </View>
      </View>

      {isLoading && conversations.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <AppCard colors={COLORS} style={styles.emptyCard}>
          <EmptyState
            colors={COLORS}
            icon="chatbubble-outline"
            title={t('noConversations')}
            description={t('noConversationsDesc')}
          />
        </AppCard>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.partnerId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchMessages} tintColor={COLORS.primary} />
          }
        />
      )}
    </View>
  );
}

const createStyles = (COLORS: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: COLORS.background,
      paddingHorizontal: SPACING.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
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
    list: {
      gap: SPACING.md,
      paddingBottom: SPACING['3xl'],
    },
    conversationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    conversationInfo: {
      flex: 1,
    },
    conversationTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
    name: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    preview: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
    previewUnread: {
      color: COLORS.textPrimary,
      fontWeight: '800',
    },
    unreadDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: COLORS.primary,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCard: {
      marginTop: SPACING['2xl'],
    },
  });
