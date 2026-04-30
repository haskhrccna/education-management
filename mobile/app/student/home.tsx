import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE = __DEV__
  ? 'http://localhost:4000/api'
  : 'https://api.education-app.com/api';

export default function StudentHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'appointments' | 'grades'>('appointments');
  const [appointments, setAppointments] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('auth_token');
        if (!token) return;
        const api = axios.create({ baseURL: API_BASE });
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        const [appts, gradesRes] = await Promise.all([
          api.get('/appointments'),
          api.get('/grades'),
        ]);
        setAppointments(appts.data);
        setGrades(gradesRes.data);
      } catch {
        /* auth error */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('studentHomeTitle', { name: 'الطالب' })}</Text>
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
        {loading ? (
          <Text style={styles.placeholder}>{t('loading')}</Text>
        ) : activeTab === 'appointments' ? (
          appointments.length === 0 ? (
            <Text style={styles.empty}>{i18n.language === 'ar' ? 'لا توجد مواعيد بعد' : 'No appointments yet'}</Text>
          ) : (
            appointments.map((a: any) => (
              <View key={a.id} style={styles.card}>
                <Text style={styles.cardTitle}>{i18n.language === 'ar' ? 'موعد جديد' : 'New Appointment'}</Text>
                <Text style={styles.cardDetail}>📅 {new Date(a.requestedDate).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}</Text>
                <Text style={styles.cardDetail}>🕐 {a.requestedTime}</Text>
                <Text style={[styles.statusBadge, a.status === 'ACCEPTED' && styles.accepted]}>
                  {a.status === 'REQUESTED' ? (i18n.language === 'ar' ? 'قيد الانتظار' : 'Pending') :
                   a.status === 'ACCEPTED' ? (i18n.language === 'ar' ? 'مقبول' : 'Accepted') :
                   a.status === 'REJECTED' ? (i18n.language === 'ar' ? 'مرفوض' : 'Rejected') : ''}
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
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
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
  placeholder: { color: '#94a3b8', textAlign: 'center', marginTop: 40 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fef3c7', fontSize: 13, color: '#92400e' },
  accepted: { backgroundColor: '#dcfce7', color: '#166534' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300' },
});
