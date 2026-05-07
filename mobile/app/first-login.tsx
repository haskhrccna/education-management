import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

export default function FirstLoginPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const user = useAuthStore((s) => s.user);
  const changePassword = useAuthStore((s) => s.changePassword);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  const handleChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('fillAllFields'));
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('passwordsDoNotMatch'));
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert(t('passwordChanged'));
      const role = user?.role ?? 'student';
      router.replace(`/${role}/home`);
    } catch {
      Alert.alert(t('passwordChangeFailed'));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.duration(500)} style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔐</Text>
            </View>
            <Text style={styles.title}>{t('changePasswordFirst')}</Text>
            <Text style={styles.subtitle}>{t('changePasswordFirstDesc')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(500).delay(150)} style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('currentPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                textAlign="right"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('newPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                textAlign="right"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('confirmNewPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                returnKeyType="send"
                onSubmitEditing={handleChange}
                textAlign="right"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleChange}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{isLoading ? t('loading') : t('updatePassword')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    keyboardView: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: SPACING['2xl'],
      paddingVertical: SPACING['3xl'],
    },
    header: {
      alignItems: 'center',
      marginBottom: SPACING['2xl'],
    },
    iconContainer: {
      width: 72,
      height: 72,
      borderRadius: RADIUS['2xl'],
      backgroundColor: COLORS.goldMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    icon: { fontSize: 36 },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: COLORS.primaryDark,
      marginBottom: SPACING.xs,
    },
    subtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    form: { gap: SPACING.lg },
    inputContainer: { gap: SPACING.xs },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textSecondary,
      textAlign: 'right',
    },
    input: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      fontSize: 16,
      color: COLORS.textPrimary,
      borderWidth: 1,
      borderColor: '#e7e5e4',
      textAlign: 'right',
    },
    button: {
      backgroundColor: COLORS.gold,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
      marginTop: SPACING.sm,
      ...SHADOWS.md,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: {
      color: COLORS.textOnGold,
      fontSize: 17,
      fontWeight: '700',
    },
  });
