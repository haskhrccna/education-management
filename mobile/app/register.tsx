import { StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/constants/theme';

export default function RegisterPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleRegister = async () => {
    setError(null);
    if (!firstName || !lastName || !email || !password) {
      setError(t('fillAllFields'));
      return;
    }
    try {
      await register({ email: email.trim(), password, role: 'student', firstName, lastName });
      router.replace('/pending-approval');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Animated.View entering={FadeInUp.duration(500)} style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.quranIcon}>📖</Text>
            </View>
            <Text style={styles.title}>{t('register')}</Text>
            <Text style={styles.subtitle}>{t('appName')}</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.duration(500).delay(150)} style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>{t('firstName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="محمد"
                  placeholderTextColor={COLORS.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                  textAlign="right"
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>{t('lastName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="الأحمد"
                  placeholderTextColor={COLORS.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                  textAlign="right"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('email')}</Text>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textAlign="right"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('password')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textAlign="right"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {isLoading ? t('loading') : t('register')}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.footer}>
            <Text style={styles.footerText}>{t('haveAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/')} activeOpacity={0.7}>
              <Text style={styles.linkText}>{t('signIn')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING['2xl'],
    paddingVertical: SPACING['2xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS['2xl'],
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  quranIcon: { fontSize: 40 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  form: { gap: SPACING.lg },
  row: { flexDirection: 'row', gap: SPACING.md },
  errorBox: {
    backgroundColor: COLORS.errorLight,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderRightWidth: 3,
    borderRightColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
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
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING['2xl'],
    gap: SPACING.xs,
  },
  footerText: { color: COLORS.textSecondary, fontSize: 15 },
  linkText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
});
