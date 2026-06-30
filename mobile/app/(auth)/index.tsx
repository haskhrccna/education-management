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
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useThemeSettings } from '@/src/settings/store';

export default function LoginPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  const handleLogin = async () => {
    setError(null);
    try {
      const user = await login(email.trim(), password);
      const role = user.role?.toLowerCase();
      const allowedRoles = ['admin', 'teacher', 'student'];
      if (!allowedRoles.includes(role)) {
        Alert.alert(t('error'), t('unsupportedRole') ?? 'Unsupported role. Contact admin.');
        return;
      }
      router.replace(`/${role}/home`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Decorative top pattern */}
          <View style={styles.topDecoration}>
            <View style={styles.patternLine} />
            <View style={styles.patternDiamond} />
            <View style={styles.patternLine} />
          </View>

          {/* Logo & Title */}
          <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="book-outline" size={72} color={COLORS.primary} />
              <View style={styles.iconGlow} />
            </View>
            <Text style={styles.title}>{t('appName')}</Text>
            <Text style={styles.tagline}>{i18n.language === 'ar' ? 'مرحباً بعودتك' : 'Welcome back'}</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.duration(600).delay(250)} style={styles.form}>
            {error && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('email')}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="example@email.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  textAlign={i18n.language === 'ar' ? 'right' : 'left'}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('password')}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="send"
                  onSubmitEditing={handleLogin}
                  textAlign={i18n.language === 'ar' ? 'right' : 'left'}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>{isLoading ? t('loading') : t('login')}</Text>
                {!isLoading && <Ionicons name="arrow-forward-outline" size={19} color={COLORS.goldLight} />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: SPACING.sm, alignItems: 'center' }}
              onPress={() => router.push('/forgot-password')}
            >
              <Text style={{ fontSize: 13, color: COLORS.primary }}>{t('forgotPassword')}</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeInUp.duration(600).delay(400)} style={styles.footer}>
            <Text style={styles.footerText}>{t('noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.7}>
              <Text style={styles.linkText}>{t('signUp')}</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Bottom decoration */}
          <View style={styles.bottomDecoration}>
            <View style={styles.patternLineSmall} />
            <View style={styles.patternDot} />
            <View style={styles.patternLineSmall} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: SPACING['2xl'],
      paddingVertical: SPACING['3xl'],
    },
    topDecoration: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.xl,
      gap: SPACING.sm,
    },
    patternLine: {
      width: 40,
      height: 2,
      backgroundColor: COLORS.gold,
      opacity: 0.4,
    },
    patternDiamond: {
      width: 8,
      height: 8,
      backgroundColor: COLORS.gold,
      transform: [{ rotate: '45deg' }],
      opacity: 0.5,
    },
    bottomDecoration: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING['2xl'],
      gap: SPACING.sm,
    },
    patternLineSmall: {
      width: 24,
      height: 1,
      backgroundColor: COLORS.primary,
      opacity: 0.3,
    },
    patternDot: {
      width: 4,
      height: 4,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.primary,
      opacity: 0.3,
    },
    header: {
      alignItems: 'center',
      marginBottom: SPACING['3xl'],
    },
    iconContainer: {
      position: 'relative',
      marginBottom: SPACING.lg,
    },
    quranIcon: {
      fontSize: 72,
      zIndex: 2,
    },
    iconGlow: {
      position: 'absolute',
      top: -8,
      left: -8,
      right: -8,
      bottom: -8,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.primaryMuted,
      opacity: 0.4,
      zIndex: 1,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: COLORS.primaryDark,
      letterSpacing: -0.5,
      marginBottom: SPACING.xs,
    },
    tagline: {
      fontSize: 15,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    form: {
      gap: SPACING.lg,
    },
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
    inputContainer: {
      gap: SPACING.xs,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: COLORS.textPrimary,
      marginBottom: SPACING.xs,
    },
    inputWrap: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: COLORS.divider,
    },
    inputIcon: {
      marginStart: SPACING.md,
    },
    input: {
      flex: 1,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      fontSize: 14,
      color: COLORS.textPrimary,
    },
    button: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
      marginTop: SPACING.sm,
      ...SHADOWS.md,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    buttonText: {
      color: COLORS.textOnPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    buttonIcon: {
      color: COLORS.goldLight,
      fontSize: 18,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: SPACING['2xl'],
      gap: SPACING.xs,
    },
    footerText: {
      color: COLORS.textSecondary,
      fontSize: 15,
    },
    linkText: {
      color: COLORS.primary,
      fontWeight: '700',
      fontSize: 15,
    },
  });
