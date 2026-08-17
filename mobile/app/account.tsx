import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuthStore } from '@/src/auth/store';
import { accountApi } from '@/src/api/account';
import { getBiometricStatus, isBiometricPreferenceEnabled } from '@/src/auth/biometric';
import { AppCard, AppText, IconButton } from '@/src/components/design';
import { useTheme } from '@/src/hooks/useTheme';

export default function AccountPrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n, t } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const isBiometricEnabled = useAuthStore((s) => s.isBiometricEnabled);
  const biometricLabel = useAuthStore((s) => s.biometricLabel);
  const refreshBiometricStatus = useAuthStore((s) => s.refreshBiometricStatus);
  const enableBiometricLogin = useAuthStore((s) => s.enableBiometricLogin);
  const disableBiometricLogin = useAuthStore((s) => s.disableBiometricLogin);
  const isStudent = user?.role === 'student';

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricReason, setBiometricReason] = useState<string | null>(null);
  const [biometricSettingOn, setBiometricSettingOn] = useState(false);

  useEffect(() => {
    const syncBiometricSetting = async () => {
      const [status, preferenceEnabled] = await Promise.all([
        getBiometricStatus(isAr),
        isBiometricPreferenceEnabled(),
        refreshBiometricStatus(isAr),
      ]);
      setBiometricAvailable(status.available);
      setBiometricReason(status.reason ?? null);
      setBiometricSettingOn(preferenceEnabled && status.available && status.hasStoredSession);
    };
    syncBiometricSetting().catch(() => {
      setBiometricAvailable(false);
      setBiometricSettingOn(false);
      setBiometricReason(t('biometricUnavailable'));
    });
  }, [isAr, refreshBiometricStatus, t]);

  const handleBiometricToggle = async (enabled: boolean) => {
    setBiometricBusy(true);
    try {
      if (enabled) {
        await enableBiometricLogin(isAr);
        setBiometricSettingOn(true);
        Alert.alert(t('success'), t('biometricEnabled'));
      } else {
        await disableBiometricLogin();
        setBiometricSettingOn(false);
        Alert.alert(t('success'), t('biometricDisabled'));
      }
    } catch (err: any) {
      Alert.alert(t('error'), err?.message ?? t('biometricUnavailable'));
    } finally {
      setBiometricBusy(false);
    }
  };

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
    <View style={[styles.screen, { backgroundColor: COLORS.background }]} testID="account.screen">
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <IconButton
          colors={COLORS}
          icon={isAr ? 'chevron-forward' : 'chevron-back'}
          accessibilityLabel={isAr ? 'رجوع' : 'Back'}
          onPress={() => router.back()}
          testID="account.back"
        />
        <AppText variant="titleLarge" color={COLORS.textPrimary}>
          {isAr ? 'الحساب والخصوصية' : 'Account & Privacy'}
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {isStudent && (
          <AppCard colors={COLORS} style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.primary} />
              <AppText variant="titleMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.sm }}>
                {isAr ? 'طلب تغيير المعلم' : 'Request a teacher change'}
              </AppText>
            </View>
            <AppText variant="bodySmall" color={COLORS.textSecondary} style={{ marginTop: SPACING.xs }}>
              {isAr
                ? 'أرسل طلباً إلى الإدارة لتغيير معلمك مع ذكر السبب. يتم تعيين المعلم الجديد بعد موافقة الإدارة.'
                : 'Send a request to the admin to change your teacher, stating your reason. A new teacher is assigned after admin approval.'}
            </AppText>
            <TouchableOpacity
              style={[styles.action, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push('/student/teacher-change')}
            >
              <AppText variant="bodyMedium" color="#FFFFFF">
                {isAr ? 'طلب تغيير المعلم' : 'Request teacher change'}
              </AppText>
            </TouchableOpacity>
          </AppCard>
        )}

        <AppCard colors={COLORS} style={styles.card}>
          <View style={styles.switchRow}>
            <View style={[styles.row, { flex: 1 }]}>
              <Ionicons name="finger-print-outline" size={22} color={COLORS.primary} />
              <View style={{ flex: 1, marginStart: SPACING.sm }}>
                <AppText variant="titleMedium" color={COLORS.textPrimary}>
                  {t('biometricLogin')}
                </AppText>
                <AppText variant="bodySmall" color={COLORS.textSecondary} style={{ marginTop: SPACING.xs }}>
                  {t('biometricLoginDesc', { method: biometricLabel ?? t('biometrics') })}
                </AppText>
                <AppText
                  variant="bodySmall"
                  color={biometricAvailable ? COLORS.primary : COLORS.textMuted}
                  style={{ marginTop: SPACING.xs }}
                >
                  {biometricAvailable
                    ? t('biometricSettingStatus', { status: biometricSettingOn ? t('on') : t('off') })
                    : biometricReason}
                </AppText>
              </View>
            </View>
            <Switch
              value={isBiometricEnabled || biometricSettingOn}
              onValueChange={handleBiometricToggle}
              disabled={biometricBusy || !biometricAvailable}
              trackColor={{ false: COLORS.borderSubtle, true: COLORS.primary }}
              thumbColor="#FFFFFF"
              testID="account.biometric-toggle"
            />
          </View>
        </AppCard>

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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  action: { borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
});
