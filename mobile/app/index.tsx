import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleLogin = async () => {
    setError(null);
    try {
      const user = await login(email.trim(), password);
      router.replace(`/${user.role}/home`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.logoText}>📚</Text>
        <Text style={styles.title}>التعليم الإلكتروني</Text>
        <Text style={styles.subtitle}>Electronic Education</Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder={t('email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="send"
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>
            {isLoading ? t('loading') : t('login')}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('noAccount')} </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.linkText}>{t('signUp')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  logoText: { fontSize: 56 },
  title: { fontSize: 28, fontWeight: '700', color: '#1e293b', fontFamily: 'System' },
  subtitle: { fontSize: 14, color: '#94a3b8' },
  form: { padding: 24, gap: 16 },
  errorBox: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 8 },
  errorText: { color: '#dc2626', fontSize: 14 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  button: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 },
  footerText: { color: '#64748b' },
  linkText: { color: '#2563eb', fontWeight: '600' },
});
