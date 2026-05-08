import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';

export default function TeacherChangeScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { requests, isLoading, fetchRequests, submitRequest } = useTeacherChange();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { fetchRequests(); }, []);

  const pendingRequest = requests.find((r: any) => r.status === 'PENDING');
  const decidedRequest = requests.find((r: any) => r.status === 'APPROVED' || r.status === 'DENIED');

  const handleSubmit = async () => {
    if (reason.trim().length < 10) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitRequest(reason.trim());
      Alert.alert(t('requestSubmitted'), '', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    backBtn: { marginRight: SPACING.sm, padding: 4 },
    backText: { fontSize: 20, color: COLORS.primary },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    body: { padding: SPACING.md, gap: SPACING.md },
    statusCard: {
      backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
      padding: SPACING.md,
    },
    statusTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
    statusDesc: { fontSize: 14, color: COLORS.textSecondary },
    adminNote: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: SPACING.xs },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
    textInput: {
      backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
      padding: SPACING.sm, color: COLORS.textPrimary, fontSize: 15,
      minHeight: 120, textAlignVertical: 'top',
      borderWidth: 1, borderColor: '#e5e7eb',
    },
    charCount: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4 },
    submitBtn: {
      backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
      padding: SPACING.sm, alignItems: 'center',
    },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    errorText: { color: '#ef4444', fontSize: 13 },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('requestTeacherChange')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : pendingRequest ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>⏳ {t('pendingRequest')}</Text>
            <Text style={styles.statusDesc}>{pendingRequest.reason}</Text>
          </View>
        ) : decidedRequest ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>
              {decidedRequest.status === 'APPROVED'
                ? `✅ ${t('requestApproved')}`
                : `❌ ${t('requestDenied')}`}
            </Text>
            <Text style={styles.statusDesc}>{decidedRequest.reason}</Text>
            {decidedRequest.adminNote && (
              <Text style={styles.adminNote}>{decidedRequest.adminNote}</Text>
            )}
          </View>
        ) : (
          <>
            <View>
              <Text style={styles.label}>{t('changeReason')}</Text>
              <TextInput
                style={styles.textInput}
                value={reason}
                onChangeText={setReason}
                placeholder={t('changeReasonPlaceholder')}
                placeholderTextColor={COLORS.textSecondary}
                multiline
              />
              <Text style={styles.charCount}>{reason.trim().length}/500</Text>
            </View>
            {submitError && <Text style={styles.errorText}>{submitError}</Text>}
            <TouchableOpacity
              style={[styles.submitBtn, { opacity: reason.trim().length >= 10 && !isSubmitting ? 1 : 0.5 }]}
              onPress={handleSubmit}
              disabled={reason.trim().length < 10 || isSubmitting}
            >
              {isSubmitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{t('requestTeacherChange')}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
