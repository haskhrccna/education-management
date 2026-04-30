import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import { useAppointments } from '@/src/hooks/useAppointments';
import { useGrades } from '@/src/hooks/useGrades';

export default function StudentHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'appointments' | 'grades'>('appointments');

  const { appointments, isLoading: apptLoading, fetchAppointments } = useAppointments();
  const { grades, isLoading: gradesLoading, fetchGrades } = useGrades();

  React.useEffect(() => {
    fetchAppointments();
    fetchGrades();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const isLoading = apptLoading || gradesLoading;

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
                <Text style={styles.cardTitle}>{a.teacher?.firstName} {a.teacher?.lastName}</Text>
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
          grades.length === 0 ? (
            <Text style={styles.empty}>{i18n.language === 'ar' ? 'لا توجد درجات بعد' : 'No grades yet'}</Text>
          ) : (
            grades.map((g: any) => (
              <View key={g.id} style={styles.card}>
                <Text style={styles.cardTitle}>{g.subject}</Text>
                <Text style={styles.gradeValue}>{g.grade}</Text>
                <Text style={styles.cardDetail}>{g.type}</Text>
                {g.notes ? <Text style={styles.cardDetail}>{g.notes}</Text> : null}
              </View>
            ))
          )
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/student/appointments/new')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  list: { gap: 12, paddingBottom: 80 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#1e293b' },
  cardDetail: { fontSize: 14, color: '#64748b' },
  gradeValue: { fontSize: 32, fontWeight: '700', color: '#2563eb' },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 40, fontSize: 16 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fef3c7', fontSize: 13, color: '#92400e' },
  accepted: { backgroundColor: '#dcfce7', color: '#166534' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300' },
});
