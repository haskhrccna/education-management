import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getColors, RADIUS, SPACING } from '@/constants/theme';
import { useAuthStore } from '@/src/auth/store';
import { useConversation } from '@/src/hooks/useConversation';
import { useRequiredParam } from '@/src/hooks/useRequiredParam';
import { useThemeSettings } from '@/src/settings/store';
import { Avatar, IconButton } from '@/src/components/design';

function formatTime(dateStr: string | undefined, lang: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function ConversationScreen() {
  const partnerId = useRequiredParam('partnerId');
  const { partnerName } = useLocalSearchParams<{ partnerName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { user } = useAuthStore();
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);
  const { thread, isLoading, error, fetchThread, sendMessage } = useConversation(partnerId ?? '');

  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  useEffect(() => {
    if (thread.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 80);
    }
  }, [thread]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || isSending) return;

    setDraft('');
    setIsSending(true);
    try {
      await sendMessage(content);
    } catch {
      setDraft(content);
      Alert.alert(
        t('error'),
        isAr ? 'تعذر إرسال الرسالة. حاول مرة أخرى.' : 'Failed to send message. Please try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === user?.id;
    const time = formatTime(item.createdAt, i18n.language);

    return (
      <View style={[styles.messageWrap, isMe ? styles.messageWrapRight : styles.messageWrapLeft]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextOther]}>{item.content}</Text>
        </View>
        {time ? <Text style={styles.timestamp}>{time}</Text> : null}
      </View>
    );
  };

  if (!partnerId) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.errorText}>{isAr ? 'المحادثة غير موجودة' : 'Conversation not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
          <Text style={styles.retryText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = partnerName ?? (isAr ? 'محادثة' : 'Conversation');

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <IconButton
          colors={COLORS}
          icon={isAr ? 'arrow-forward-outline' : 'arrow-back-outline'}
          accessibilityLabel={isAr ? 'رجوع' : 'Back'}
          onPress={() => router.back()}
        />
        <Avatar colors={COLORS} label={displayName} size={44} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.headerSubtitle}>{isAr ? 'عادة يرد قريباً' : 'Usually replies soon'}</Text>
        </View>
      </View>

      {isLoading && thread.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : error && thread.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchThread}>
            <Text style={styles.retryText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={thread}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { textAlign: isAr ? 'right' : 'left', writingDirection: isAr ? 'rtl' : 'ltr' }]}
            placeholder={t('typeMessage')}
            placeholderTextColor={COLORS.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isAr ? 'إرسال الرسالة' : 'Send message'}
            activeOpacity={0.85}
            style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
            disabled={!draft.trim() || isSending}
            onPress={handleSend}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name={isAr ? 'arrow-back-outline' : 'arrow-forward-outline'} size={22} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: COLORS.surface,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.darkMode ? COLORS.divider : '#E2E8E1',
    },
    headerInfo: {
      flex: 1,
    },
    headerTitle: {
      color: COLORS.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    headerSubtitle: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    errorText: {
      color: COLORS.error,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
    retryButton: {
      marginTop: SPACING.md,
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    retryText: {
      color: COLORS.textOnPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    listContent: {
      flexGrow: 1,
      justifyContent: 'flex-end',
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    messageWrap: {
      maxWidth: '86%',
    },
    messageWrapLeft: {
      alignSelf: 'flex-start',
      alignItems: 'flex-start',
    },
    messageWrapRight: {
      alignSelf: 'flex-end',
      alignItems: 'flex-end',
    },
    bubble: {
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    bubbleMe: {
      backgroundColor: COLORS.primary,
      borderBottomRightRadius: 6,
    },
    bubbleOther: {
      backgroundColor: COLORS.surface,
      borderBottomLeftRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.darkMode ? COLORS.divider : '#E2E8E1',
    },
    bubbleText: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
    },
    bubbleTextMe: {
      color: COLORS.textOnPrimary,
    },
    bubbleTextOther: {
      color: COLORS.textPrimary,
    },
    timestamp: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
      marginHorizontal: SPACING.xs,
    },
    inputBar: {
      backgroundColor: COLORS.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.darkMode ? COLORS.divider : '#E2E8E1',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: SPACING.sm,
      backgroundColor: COLORS.darkMode ? COLORS.surfaceAlt : '#F1F4F1',
      borderRadius: RADIUS['2xl'],
      padding: SPACING.xs,
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 118,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    sendButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: COLORS.textMuted,
    },
  });
