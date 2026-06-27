import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useParent } from '@/src/hooks/useParent';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, RADIUS, SPACING } from '@/constants/theme';
import { AppCard, AppText } from '@/src/components/design';

export default function ParentLinkRequestScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { searchStudent, requestLink } = useParent();

  const handleSearch = async () => {
    if (!email.trim()) return;
    setIsSearching(true);
    try {
      const student = await searchStudent(email.trim());
      if (!student) {
        Alert.alert(t('studentNotFound'), t('studentNotFoundDesc'));
        return;
      }
      handleRequest(student.id);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRequest = async (studentId: string) => {
    setIsSubmitting(true);
    try {
      await requestLink(studentId, reason.trim() || undefined);
      Alert.alert(t('linkRequested'), t('linkPending'), [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert(t('error'), err?.message ?? t('failedToSubmitRequest'));
    } finally {
      setIsSubmitting(false);
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
        <AppText variant="headlineSmall" color="#FFFFFF">{t('requestChildLink')}</AppText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <AppCard colors={COLORS}>
          <AppText variant="bodyMedium" color={COLORS.textSecondary} style={{ marginBottom: SPACING.md }}>
            {t('linkRequestInstructions')}
          </AppText>

          <AppText variant="labelLarge" color={COLORS.textPrimary} style={{ marginBottom: SPACING.xs }}>
            {t('childEmail')}
          </AppText>
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
            value={email}
            onChangeText={setEmail}
            placeholder={t('childEmailPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <AppText variant="labelLarge" color={COLORS.textPrimary} style={{ marginTop: SPACING.md, marginBottom: SPACING.xs }}>
            {t('requestReason')}
          </AppText>
          <TextInput
            style={[
              styles.input,
              styles.textarea,
              {
                backgroundColor: COLORS.surface,
                borderColor: COLORS.borderSubtle,
                color: COLORS.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
            value={reason}
            onChangeText={setReason}
            placeholder={t('reasonPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            multiline
          />

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: COLORS.primary, opacity: email.trim() ? 1 : 0.5 }]}
            onPress={handleSearch}
            disabled={!email.trim() || isSearching || isSubmitting}
          >
            {isSearching || isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <AppText variant="bodyMedium" color="#FFFFFF">{t('searchStudent')}</AppText>
            )}
          </TouchableOpacity>
        </AppCard>
      </View>
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
  body: { padding: SPACING.md },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    fontSize: 14,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  submit: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
});
