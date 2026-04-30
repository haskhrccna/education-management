import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
     <SafeAreaView style={styles.container} edges={['top']}>
       <View style={styles.content}>
         <Text style={styles.icon}>📨</Text>
         <Text style={styles.title}>{t('pendingApproval')}</Text>
         <Text style={styles.description}>{t('pendingDesc')}</Text>
         <TouchableOpacity style={styles.button} onPress={() => router.push('/')}>
           <Text style={styles.buttonText}>{t('backToLogin')}</Text>
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
  description: { fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 24 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
