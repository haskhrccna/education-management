import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { messagesApi } from '@/src/api/messages';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

type TargetRole = 'ALL' | 'STUDENT' | 'TEACHER';

export default function BroadcastScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  const [target, setTarget] = useState<TargetRole>('ALL');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      const targetRole = target === 'ALL' ? undefined : (target as 'STUDENT' | 'TEACHER');
      await messagesApi.broadcast(content.trim(), targetRole);
      Alert.alert('', t('broadcastSent'), [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const chips: { key: TargetRole; label: string }[] = [
    { key: 'ALL', label: t('allUsers') },
    { key: 'STUDENT', label: t('studentsOnly') },
    { key: 'TEACHER', label: t('teachersOnly') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('broadcastMessage')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Recipient selector */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('broadcastRecipients')}</Text>
          <View style={styles.chipsRow}>
            {chips.map((chip) => {
              const isActive = target === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setTarget(chip.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{chip.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Message textarea */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('messageLabel')}</Text>
          <TextInput
            style={styles.textarea}
            placeholder={t('typeMessage')}
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            value={content}
            onChangeText={setContent}
            editable={!sending}
          />
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendBtn, (!content.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!content.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
          ) : (
            <Text style={styles.sendBtnText}>{t('sendBroadcast')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      <BottomNav role="admin" active="broadcast" />
    </SafeAreaView>
  );
}

function createStyles(COLORS: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.surfaceAlt,
      ...SHADOWS.sm,
    },
    backBtn: {
      padding: SPACING.xs,
      marginRight: SPACING.sm,
    },
    backArrow: {
      fontSize: 22,
      color: COLORS.primary,
      fontWeight: '600',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    headerSpacer: {
      width: 32,
    },
    body: {
      padding: SPACING.lg,
      gap: SPACING.lg,
    },
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      ...SHADOWS.md,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginBottom: SPACING.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    chip: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
      borderColor: COLORS.textMuted,
      backgroundColor: COLORS.background,
    },
    chipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    chipText: {
      fontSize: 14,
      fontWeight: '500',
      color: COLORS.textSecondary,
    },
    chipTextActive: {
      color: COLORS.textOnPrimary,
      fontWeight: '600',
    },
    textarea: {
      minHeight: 140,
      fontSize: 15,
      color: COLORS.textPrimary,
      lineHeight: 22,
      padding: 0,
    },
    sendBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.md,
    },
    sendBtnDisabled: {
      opacity: 0.45,
    },
    sendBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textOnPrimary,
    },
  });
}
