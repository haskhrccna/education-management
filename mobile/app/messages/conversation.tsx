import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useConversation } from '@/src/hooks/useConversation';
import { useAuthStore } from '@/src/auth/store';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';

const BORDER_LIGHT = '#e5e7eb';
const BORDER_DARK = '#334155';

export default function ConversationScreen() {
  const { partnerId, partnerName } = useLocalSearchParams<{
    partnerId: string;
    partnerName: string;
  }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);

  const { thread, isLoading, error, fetchThread, sendMessage } = useConversation(partnerId ?? '');

  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // Scroll to bottom whenever thread changes
  useEffect(() => {
    if (thread.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
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
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const borderColor = darkMode ? BORDER_DARK : BORDER_LIGHT;

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === user?.id;
    const time = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View
        style={[
          styles.bubbleWrapper,
          isMe ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? COLORS.primary : COLORS.surface,
              borderRadius: RADIUS.md,
            },
            isMe ? styles.bubbleRight : styles.bubbleLeft,
            !isMe && { borderWidth: 1, borderColor },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isMe ? COLORS.textOnPrimary : COLORS.textPrimary },
            ]}
          >
            {item.content}
          </Text>
        </View>
        {time ? (
          <Text style={[styles.timestamp, { color: COLORS.textSecondary }]}>{time}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: COLORS.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: COLORS.surface, borderBottomColor: borderColor },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: COLORS.primary }]}>{'‹ Back'}</Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: COLORS.textPrimary }]}
          numberOfLines={1}
        >
          {partnerName ?? 'Conversation'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Body */}
      {isLoading && thread.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : error && thread.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: COLORS.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: COLORS.primary }]}
            onPress={fetchThread}
          >
            <Text style={[styles.retryText, { color: COLORS.textOnPrimary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={thread}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          { backgroundColor: COLORS.surface, borderTopColor: borderColor },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: darkMode ? COLORS.surfaceAlt : COLORS.background,
              color: COLORS.textPrimary,
              borderColor,
              borderRadius: RADIUS.md,
            },
          ]}
          placeholder="Type a message…"
          placeholderTextColor={COLORS.textSecondary}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor:
                draft.trim().length === 0 || isSending
                  ? COLORS.textSecondary
                  : COLORS.primary,
              borderRadius: RADIUS.md,
            },
          ]}
          onPress={handleSend}
          disabled={draft.trim().length === 0 || isSending}
          accessibilityLabel="Send message"
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendIcon}>{'›'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingRight: SPACING.sm,
    minWidth: 60,
  },
  backText: {
    fontSize: 18,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    minWidth: 60,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  errorText: {
    fontSize: 14,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bubbleWrapper: {
    marginBottom: SPACING.sm,
  },
  bubbleWrapperLeft: {
    alignItems: 'flex-start',
  },
  bubbleWrapperRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  bubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  timestamp: {
    fontSize: 11,
    marginTop: SPACING.xs,
    marginHorizontal: SPACING.xs,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
});
