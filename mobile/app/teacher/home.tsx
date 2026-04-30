import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

export default function TeacherHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
   // Data would be loaded via useEffect + axios in production
  return (
     <SafeAreaView style={styles.container} edges={['top']}>
       <View style={styles.header}>
         <Text style={styles.title}>{t('teacherHomeTitle', { name: 'الأستاذ' })}</Text>
       </View>

       <ScrollView style={styles.content}>
         <Text style={styles.sectionTitle}>
           {i18n.language === 'ar' ? 'مواعيدك القادمة' : 'Your Upcoming Appointments'}
         </Text>
         <Text style={styles.empty}>
           {i18n.language === 'ar' ? 'لا توجد مواعيد بعد' : 'No appointments yet'}
         </Text>

         <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
           {i18n.language === 'ar' ? 'تسجيل الدرجات' : 'Grade Entry'}
         </Text>
         <TouchableOpacity style={styles.gradeBtn} onPress={() => router.push('/teacher/grades')}>
           <Text style={styles.gradeBtnText}>
             {i18n.language === 'ar' ? 'إضافة درجة جديدة' : '+ Add Grade'}
           </Text>
         </TouchableOpacity>
       </ScrollView>

       <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/')}>
         <Text style={styles.logoutText}>{t('logout')}</Text>
       </TouchableOpacity>
     </SafeAreaView>
   );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  content: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#475569', marginBottom: 8 },
  empty: { color: '#94a3b8', textAlign: 'center', paddingVertical: 20 },
  gradeBtn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  gradeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutBtn: { margin: 20, padding: 16, alignItems: 'center', borderRadius: 12, backgroundColor: '#fee2e2' },
  logoutText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
});
