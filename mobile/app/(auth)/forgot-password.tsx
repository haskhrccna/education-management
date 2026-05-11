import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { apiClient } from '@/src/api/client';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },
    backBtn: { marginRight: SPACING.sm, padding: 4 },
    backIcon: { marginVertical: 2 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    body: { padding: SPACING.md, gap: SPACING.md },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
    input: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      color: COLORS.textPrimary,
      fontSize: 15,
      borderWidth: 1,
      borderColor: '#e5e7eb',
    },
    btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    errorText: { color: '#ef4444', fontSize: 13 },
    successCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md },
    successRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    successTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={22} color={COLORS.primary} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('forgotPassword')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {submitted ? (
          <View style={styles.successCard}>
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.success} />
              <Text style={styles.successTitle}>{t('resetLinkSent')}</Text>
            </View>
          </View>
        ) : (
          <>
            <View>
              <Text style={styles.label}>{t('enterYourEmail')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[styles.btn, { opacity: email.trim() && !isLoading ? 1 : 0.5 }]}
              onPress={handleSubmit}
              disabled={!email.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{t('forgotPassword')}</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
