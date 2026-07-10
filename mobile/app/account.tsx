import React, { useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuthStore } from '@/src/auth/store';
import { accountApi } from '@/src/api/account';
import { AppCard, AppText, IconButton } from '@/src/components/design';
import { useTheme } from '@/src/hooks/useTheme';

export default function AccountPrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await accountApi.exportMyData();
      const json = JSON.stringify(data, null, 2);
      await Share.share({ message: json, title: isAr ? 'بياناتي' : 'My data' });
    } catch (err: any) {
      Alert.alert(
        isAr ? 'خطأ' : 'Error',
        err?.response?.data?.error ?? err?.message ?? (isAr ? 'فشل تصدير البيانات' : 'Failed to export data')
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      isAr ? 'حذف الحساب نهائياً؟' : 'Permanently delete your account?',
      isAr
        ? 'سيتم إخفاء معلوماتك الشخصية ولن تتمكن من تسجيل الدخول مرة أخرى. لا يمكن التراجع عن هذا الإجراء.'
        : "Your personal information will be anonymized and you won't be able to sign in again. This cannot be undone.",
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAr ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await accountApi.deleteMyAccount();
              await logout();
            } catch (err: any) {
              setDeleting(false);
              Alert.alert(
                isAr ? 'خطأ' : 'Error',
                err?.response?.data?.error ?? err?.message ?? (isAr ? 'فشل حذف الحساب' : 'Failed to delete account')
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <IconButton
          colors={COLORS}
          icon={isAr ? 'chevron-forward' : 'chevron-back'}
          accessibilityLabel={isAr ? 'رجوع' : 'Back'}
          onPress={() => router.back()}
        />
        <AppText variant="titleLarge" color={COLORS.textPrimary}>
          {isAr ? 'الحساب والخصوصية' : 'Account & Privacy'}
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <AppCard colors={COLORS} style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="download-outline" size={22} color={COLORS.primary} />
            <AppText variant="titleMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.sm }}>
              {isAr ? 'تصدير بياناتي' : 'Export my data'}
            </AppText>
          </View>
          <AppText variant="bodySmall" color={COLORS.textSecondary} style={{ marginTop: SPACING.xs }}>
            {isAr
              ? 'احصل على نسخة من كل ما يحتفظ به التطبيق عنك: المواعيد، الدرجات، التسجيلات، والمزيد.'
              : 'Get a copy of everything the app holds about you: appointments, grades, recordings, and more.'}
          </AppText>
          <TouchableOpacity
            style={[styles.action, { backgroundColor: COLORS.primary, opacity: exporting ? 0.6 : 1 }]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <AppText variant="bodyMedium" color="#FFFFFF">
                {isAr ? 'تصدير' : 'Export'}
              </AppText>
            )}
          </TouchableOpacity>
        </AppCard>

        <AppCard colors={COLORS} style={[styles.card, { borderColor: COLORS.error, borderWidth: 1 }]}>
          <View style={styles.row}>
            <Ionicons name="trash-outline" size={22} color={COLORS.error} />
            <AppText variant="titleMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.sm }}>
              {isAr ? 'حذف الحساب' : 'Delete account'}
            </AppText>
          </View>
          <AppText variant="bodySmall" color={COLORS.textSecondary} style={{ marginTop: SPACING.xs }}>
            {isAr
              ? 'إجراء دائم لا يمكن التراجع عنه. سيتم إخفاء اسمك وبريدك الإلكتروني.'
              : 'A permanent, irreversible action. Your name and email will be anonymized.'}
          </AppText>
          <TouchableOpacity
            style={[styles.action, { backgroundColor: COLORS.error, opacity: deleting ? 0.6 : 1 }]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <AppText variant="bodyMedium" color="#FFFFFF">
                {isAr ? 'حذف الحساب نهائياً' : 'Permanently delete account'}
              </AppText>
            )}
          </TouchableOpacity>
        </AppCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  body: { padding: SPACING.lg, gap: SPACING.md },
  card: { gap: SPACING.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  action: { borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
});
