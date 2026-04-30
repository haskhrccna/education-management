import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';

export default function FirstLoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const changePassword = useAuthStore((s) => s.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert(t('fillAllFields'));
      return;
    }
    if (newPassword.length < 8) {
      alert(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      alert(t('passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      alert(t('passwordChanged'));
      const role = user?.role || 'student';
      router.replace(`/${role}/home`);
    } catch (err: any) {
      alert(err.message || t('passwordChangeFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.icon}>🔑</Text>
        <Text style={styles.title}>{t('changePasswordFirst')}</Text>
        <Text style={styles.description}>{t('changePasswordFirstDesc')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('currentPassword')}
          secureTextEntry
          onChangeText={setCurrentPassword}
        />
        <TextInput
          style={styles.input}
          placeholder={t('newPassword')}
          secureTextEntry
          onChangeText={setNewPassword}
        />
        <TextInput
          style={styles.input}
          placeholder={t('confirmNewPassword')}
          secureTextEntry
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? t('loading') : t('updatePassword')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, alignItems: 'center', padding: 24, gap: 16, justifyContent: 'center' },
  icon: { fontSize: 64 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  description: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  input: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  button: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, width: '100%', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
