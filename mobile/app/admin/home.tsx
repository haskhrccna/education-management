import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import { apiClient } from '@/src/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

export default function AdminHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({ students: 0, teachers: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'stats'>('users');

  React.useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/admin/users');
      setUsers(res.data);
      const students = res.data.filter((u: User) => u.role === 'STUDENT').length;
      const teachers = res.data.filter((u: User) => u.role === 'TEACHER').length;
      const pending = res.data.filter((u: User) => u.status === 'PENDING').length;
      setStats({ students, teachers, pending });
    } catch (err: any) {
      console.error('Failed to load users:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const approveStudent = async (id: string) => {
    try {
      await apiClient.put(`/admin/users/${id}/approve`);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'ACTIVE' } : u)));
      setStats((s) => ({ ...s, pending: Math.max(0, s.pending - 1) }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {i18n.language === 'ar' ? 'لوحة التحكم' : 'Admin Dashboard'}
        </Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>{t('logout')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.students}</Text>
          <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'الطلاب' : 'Students'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.teachers}</Text>
          <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'المعلمون' : 'Teachers'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'معلقة' : 'Pending'}</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            {i18n.language === 'ar' ? 'المستخدمون' : 'Users'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
            {i18n.language === 'ar' ? 'الإحصائيات' : 'Stats'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.list}>
        {isLoading ? (
          <Text style={styles.empty}>{t('loading')}</Text>
        ) : activeTab === 'users' ? (
          users.length === 0 ? (
            <Text style={styles.empty}>{i18n.language === 'ar' ? 'لا يوجد مستخدمون' : 'No users'}</Text>
          ) : (
            users.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.firstName} {u.lastName}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <View style={styles.userMeta}>
                    <Text style={[styles.roleBadge, u.role === 'ADMIN' && styles.adminBadge]}>{u.role}</Text>
                    <Text style={[styles.statusBadge, u.status === 'ACTIVE' && styles.activeBadge]}>{u.status}</Text>
                  </View>
                </View>
                {u.status === 'PENDING' && u.role === 'STUDENT' && (
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveStudent(u.id)}>
                    <Text style={styles.approveText}>
                      {i18n.language === 'ar' ? 'قبول' : 'Approve'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )
        ) : (
          <View style={styles.actionCard}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/admin/teachers/new')}>
              <Text style={styles.actionBtnText}>
                {i18n.language === 'ar' ? 'إضافة معلم' : 'Add Teacher'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn]} onPress={() => router.push('/admin/broadcast')}>
              <Text style={[styles.actionBtnText, styles.secondaryText]}>
                {i18n.language === 'ar' ? 'رسالة جماعية' : 'Broadcast'}
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
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#2563eb' },
  statLabel: { fontSize: 13, color: '#64748b', marginTop: 4 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  content: { flex: 1, paddingHorizontal: 20 },
  list: { gap: 12, paddingBottom: 40 },
  userCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  userEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  userMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  roleBadge: { fontSize: 11, fontWeight: '600', color: '#475569', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  adminBadge: { color: '#7c3aed', backgroundColor: '#f3e8ff' },
  statusBadge: { fontSize: 11, fontWeight: '600', color: '#92400e', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  activeBadge: { color: '#166534', backgroundColor: '#dcfce7' },
  approveBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  approveText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 40, fontSize: 16 },
  actionCard: { gap: 12 },
  actionBtn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#2563eb' },
  secondaryText: { color: '#2563eb' },
});
