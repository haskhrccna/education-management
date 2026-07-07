import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCertificates } from '@/src/hooks/useCertificates';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useThemeSettings } from '@/src/settings/store';
import { getColors, RADIUS, SPACING } from '@/constants/theme';
import { AppCard, AppText, EmptyState, SectionHeader } from '@/src/components/design';

export default function CertificatesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const { certificates, isLoading, error, fetchCertificates, getDownloadUrl, getVerifyUrl, regenerateLink } =
    useCertificates();

  const handleOpen = async (certId: string) => {
    const url = await getDownloadUrl(certId);
    Linking.openURL(url);
  };

  // Shares the public, no-login verification page — never the PDF download
  // URL, which carries a live auth token and would leak it to whoever
  // receives the share.
  const handleShare = async (verificationToken: string) => {
    const url = getVerifyUrl(verificationToken);
    try {
      await Share.share({ url, message: url });
    } catch {
      Linking.openURL(url);
    }
  };

  const handleRegenerateLink = (certId: string) => {
    Alert.alert(t('regenerateLinkTitle'), t('regenerateLinkBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('regenerateLink'),
        style: 'destructive',
        onPress: () => regenerateLink(certId).catch(() => Alert.alert(t('error'))),
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
        <AppText variant="headlineSmall" color="#FFFFFF">
          {t('certificates')}
        </AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchCertificates} />}
      >
        {error ? (
          <View style={styles.center}>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>
              {error}
            </AppText>
            <TouchableOpacity accessibilityRole="button" onPress={fetchCertificates} style={{ marginTop: SPACING.md }}>
              <AppText variant="bodyMedium" color={COLORS.primary}>
                {t('retry')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : certificates.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState colors={COLORS} icon="document-text-outline" title={t('noCertificates')} description="" />
          </View>
        ) : (
          <>
            <SectionHeader colors={COLORS} title={t('certificates')} />
            {certificates.map((cert) => (
              <AppCard key={cert.id} colors={COLORS} style={{ marginBottom: SPACING.sm }}>
                <View style={styles.row}>
                  <Ionicons name="document-text-outline" size={28} color={COLORS.primary} />
                  <View style={{ flex: 1, marginStart: SPACING.md }}>
                    <AppText variant="bodyMedium" color={COLORS.textPrimary}>
                      {t('certificate')}
                    </AppText>
                    <AppText variant="bodySmall" color={COLORS.textMuted}>
                      {t('certificateIssuedAt')} {new Date(cert.issuedAt).toLocaleDateString()}
                    </AppText>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => handleOpen(cert.id)}
                    style={[styles.btn, { backgroundColor: COLORS.primary }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppText variant="bodySmall" color="#FFFFFF">
                      {t('downloadCertificate')}
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => handleShare(cert.verificationToken)}
                    style={[
                      styles.btn,
                      { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle, borderWidth: 1 },
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppText variant="bodySmall" color={COLORS.textPrimary}>
                      {t('shareCertificate')}
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => handleRegenerateLink(cert.id)}
                    style={[styles.iconBtn, { borderColor: COLORS.borderSubtle }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              </AppCard>
            ))}
          </>
        )}
      </ScrollView>
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
  body: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  btn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
  iconBtn: {
    width: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
