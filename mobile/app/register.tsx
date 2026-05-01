import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
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
      setError('يرجى ملء جميع الحقول / Please fill all fields');
      return;
    }
    try {
      await register(email.trim(), password, 'student', firstName, lastName);
      router.replace('/pending-approval');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logoText}>📚</Text>
        <Text style={styles.title}>{t('register')}</Text>
      </View>
      <View style={styles.form}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <TextInput style={styles.input} placeholder={t('firstName')} value={firstName} onChangeText={setFirstName} />
        <TextInput style={styles.input} placeholder={t('lastName')} value={lastName} onChangeText={setLastName} />
        <TextInput style={styles.input} placeholder={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder={t('password')} value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleRegister} disabled={isLoading} activeOpacity={0.7}>
          <Text style={styles.buttonText}>{isLoading ? t('loading') : t('register')}</Text>
        </TouchableOpacity>
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('haveAccount')} </Text>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Text style={styles.linkText}>{t('signIn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  logoText: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
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
