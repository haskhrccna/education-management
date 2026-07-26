import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { AppCard, AppText } from '@/src/components/design';
import { useAcademyProfile } from '@/src/hooks/useAcademyProfile';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

export default function AcademyProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);
  const { profile, isLoading, save } = useAcademyProfile();

  const [displayName, setDisplayName] = useState('');
  const [programName, setProgramName] = useState('');
  const [publicBio, setPublicBio] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [active, setActive] = useState(true);

  // Populate the form once the existing profile loads (stays at defaults pre-first-save, 404).
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? '');
      setProgramName(profile.programName ?? '');
      setPublicBio(profile.publicBio ?? '');
      setContactEmail(profile.contactEmail ?? '');
      setActive(profile.active ?? true);
    }
  }, [profile]);

  const handleSave = () => {
    save.mutate(
      {
        displayName: displayName.trim(),
        programName: programName.trim(),
        publicBio: publicBio.trim() || null,
        contactEmail: contactEmail.trim() || null,
        active,
      },
      {
        onSuccess: () => Alert.alert('', t('saved')),
        onError: () => Alert.alert('', t('error')),
      }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('goBack')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <AppText variant="titleLarge" color={COLORS.textPrimary} style={styles.headerTitle}>
          {t('academyProfile')}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppCard colors={COLORS}>
            <AppText variant="labelLarge" color={COLORS.textSecondary} style={styles.label}>
              {t('academyDisplayName')}
            </AppText>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('academyDisplayName')}
              placeholderTextColor={COLORS.textMuted}
              editable={!save.isPending}
              accessibilityLabel={t('academyDisplayName')}
            />
          </AppCard>

          <AppCard colors={COLORS} style={styles.card}>
            <AppText variant="labelLarge" color={COLORS.textSecondary} style={styles.label}>
              {t('academyProgramName')}
            </AppText>
            <TextInput
              style={styles.input}
              value={programName}
              onChangeText={setProgramName}
              placeholder={t('academyProgramName')}
              placeholderTextColor={COLORS.textMuted}
              editable={!save.isPending}
              accessibilityLabel={t('academyProgramName')}
            />
          </AppCard>

          <AppCard colors={COLORS} style={styles.card}>
            <AppText variant="labelLarge" color={COLORS.textSecondary} style={styles.label}>
              {t('academyPublicBio')}
            </AppText>
            <TextInput
              style={styles.textarea}
              value={publicBio}
              onChangeText={setPublicBio}
              placeholder={t('academyPublicBio')}
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!save.isPending}
              accessibilityLabel={t('academyPublicBio')}
            />
          </AppCard>

          <AppCard colors={COLORS} style={styles.card}>
            <AppText variant="labelLarge" color={COLORS.textSecondary} style={styles.label}>
              {t('academyContactEmail')}
            </AppText>
            <TextInput
              style={styles.input}
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder={t('academyContactEmail')}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!save.isPending}
              accessibilityLabel={t('academyContactEmail')}
            />
          </AppCard>

          <AppCard colors={COLORS} style={[styles.card, styles.switchRow]}>
            <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ flex: 1 }}>
              {t('academyActive')}
            </AppText>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
              thumbColor="#fff"
              disabled={save.isPending}
              accessibilityLabel={t('academyActive')}
            />
          </AppCard>

          <TouchableOpacity
            style={[styles.saveBtn, save.isPending && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={save.isPending}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('save')}
          >
            {save.isPending ? (
              <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
            ) : (
              <AppText variant="titleMedium" color={COLORS.textOnPrimary}>
                {t('save')}
              </AppText>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
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
    headerTitle: {
      flex: 1,
    },
    headerSpacer: {
      width: 32,
    },
    body: {
      padding: SPACING.lg,
      paddingBottom: SPACING['2xl'],
    },
    card: {
      marginTop: SPACING.md,
    },
    label: {
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      fontSize: 15,
      color: COLORS.textPrimary,
      padding: 0,
      minHeight: 24,
    },
    textarea: {
      minHeight: 100,
      fontSize: 15,
      color: COLORS.textPrimary,
      lineHeight: 22,
      padding: 0,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    saveBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.lg,
      ...SHADOWS.md,
    },
    saveBtnDisabled: {
      opacity: 0.6,
    },
  });
}
