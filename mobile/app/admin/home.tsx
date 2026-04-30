import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminHomeScreen() {
  const { t } = useTranslation();
  return (
     <SafeAreaView style={styles.container}>
       <Text style={styles.title}>{t('adminHomeTitle')}</Text>
       <Text style={styles.placeholder}>لوحة التحكم - قريباً</Text>
     </SafeAreaView>
   );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#1e293b' },
  placeholder: { fontSize: 18, color: '#94a3b8', marginTop: 16 },
});
