import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import { useAppointments } from '@/src/hooks/useAppointments';

export default function TeacherHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'appointments' | 'grades' | 'recordings'>('appointments');

  const { appointments, isLoading, fetchAppointments } = useAppointments();

  React.useEffect(() => {
    fetchAppointments();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {i18n.language === 'ar' ? 'مرحباً' : 'Welcome'} {user?.firstName || ''}
        </Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>{t('logout')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'appointments' && styles.tabActive]}
          onPress={() => setActiveTab('appointments')}
        >
          <Text style={[styles.tabText, activeTab === 'appointments' && styles.tabTextActive]}>
            {i18n.language === 'ar' ? 'المواعيد' : 'Appointments'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'grades' && styles.tabActive]}
          onPress={() => setActiveTab('grades')}
        >
          <Text style={[styles.tabText, activeTab === 'grades' && styles.tabTextActive]}>
            {i18n.language === 'ar' ? 'الدرجات' : 'Grades'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.list}>
        {isLoading ? (
          <Text style={styles.empty}>{t('loading')}</Text>
        ) : activeTab === 'appointments' ? (
          appointments.length === 0 ? (
            <Text style={styles.empty}>{i18n.language === 'ar' ? 'لا توجد مواعيد بعد' : 'No appointments yet'}</Text>
          ) : (
            appointments.map((a: any) => (
              <View key={a.id} style={styles.card}>
                <Text style={styles.cardTitle}>{a.student?.firstName} {a.student?.lastName}</Text>
                <Text style={styles.cardDetail}>📅 {new Date(a.requestedDate).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}</Text>
                <Text style={styles.cardDetail}>🕐 {a.requestedTime}</Text>
                <Text style={[styles.statusBadge, a.status === 'ACCEPTED' && styles.accepted]}>
                  {a.status === 'REQUESTED' ? (i18n.language === 'ar' ? 'قيد الانتظار' : 'Pending') :
                   a.status === 'ACCEPTED' ? (i18n.language === 'ar' ? 'مقبول' : 'Accepted') :
                   a.status === 'REJECTED' ? (i18n.language === 'ar' ? 'مرفوض' : 'Rejected') : a.status}
                </Text>
              </View>
            ))
          )
        ) : (
          <View style={styles.actionCard}>
            <TouchableOpacity style={styles.gradeBtn} onPress={() => router.push('/teacher/grades')}>
              <Text style={styles.gradeBtnText}>
                {i18n.language === 'ar' ? 'إضافة درجة جديدة' : '+ Add Grade'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gradeBtn, styles.secondaryBtn]} onPress={() => router.push('/teacher/reports')}>
              <Text style={[styles.gradeBtnText, styles.secondaryText]}>
                {i18n.language === 'ar' ? 'إنشاء تقرير' : 'Generate Report'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  logout: { color: '#dc2626', fontWeight: '600' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  content: { flex: 1, paddingHorizontal: 20 },
  list: { gap: 12, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#1e293b' },
  cardDetail: { fontSize: 14, color: '#64748b' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fef3c7', fontSize: 13, color: '#92400e' },
  accepted: { backgroundColor: '#dcfce7', color: '#166534' },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 40, fontSize: 16 },
  actionCard: { gap: 12 },
  gradeBtn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  gradeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#2563eb' },
  secondaryText: { color: '#2563eb' },
});
