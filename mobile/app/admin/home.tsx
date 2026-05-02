import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import { apiClient } from '@/src/api';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/constants/theme';

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
  const [activeTab, setActiveTab] = useState<'users' | 'overview'>('users');

  React.useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/admin/users');
      const usersData = res.data?.data?.data || [];
      setUsers(usersData);
      const students = usersData.filter((u: User) => u.role === 'STUDENT').length;
      const teachers = usersData.filter((u: User) => u.role === 'TEACHER').length;
      const pending = usersData.filter((u: User) => u.status === 'PENDING').length;
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{t('adminHomeTitle')}</Text>
            <Text style={styles.subGreeting}>
              {i18n.language === 'ar' ? 'مرحباً، ' : 'Welcome, '}{user?.firstName || ''}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statStudents]}>
            <Text style={styles.statValue}>{stats.students}</Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'الطلاب' : 'Students'}</Text>
          </View>
          <View style={[styles.statCard, styles.statTeachers]}>
            <Text style={styles.statValue}>{stats.teachers}</Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'المعلمون' : 'Teachers'}</Text>
          </View>
          <View style={[styles.statCard, styles.statPending]}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'معلقة' : 'Pending'}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            {t('users')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
            {t('overview')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text style={styles.empty}>{t('loading')}</Text>
        ) : activeTab === 'users' ? (
          <UsersTab users={users} approveStudent={approveStudent} />
        ) : (
          <OverviewTab />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function UsersTab({ users, approveStudent }: { users: User[], approveStudent: (id: string) => void }) {
  const { t, i18n } = useTranslation();

  if (users.length === 0) {
    return (
      <Animated.View entering={FadeInUp.duration(400)} style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyTitle}>{t('noUsersYet')}</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {users.map((u, index) => (
        <Animated.View
          key={u.id}
          entering={FadeInUp.duration(400).delay(index * 50)}
          style={styles.userCard}
        >
          <View style={styles.userRow}>
            <View style={styles.userAvatar}>
              <Text style={styles.avatarText}>{u.firstName[0]}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{u.firstName} {u.lastName}</Text>
              <Text style={styles.userEmail}>{u.email}</Text>
              <View style={styles.userMeta}>
                <View style={[styles.roleBadge, u.role === 'ADMIN' && styles.adminBadge]}>
                  <Text style={[styles.roleText, u.role === 'ADMIN' && styles.adminText]}>{u.role}</Text>
                </View>
                <View style={[styles.statusBadge, u.status === 'ACTIVE' && styles.activeBadge]}>
                  <Text style={[styles.statusBadgeText, u.status === 'ACTIVE' && styles.activeBadgeText]}>{u.status}</Text>
                </View>
              </View>
            </View>
            {u.status === 'PENDING' && u.role === 'STUDENT' && (
              <TouchableOpacity style={styles.approveBtn} onPress={() => approveStudent(u.id)}>
                <Text style={styles.approveText}>✓</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function OverviewTab() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const overviewStats = [
    { icon: '📖', value: '604', label: i18n.language === 'ar' ? 'صفحة القرآن' : 'Quran Pages' },
    { icon: '🎯', value: '30', label: i18n.language === 'ar' ? 'جزء' : 'Juz' },
    { icon: '✨', value: '114', label: i18n.language === 'ar' ? 'سورة' : 'Surahs' },
    { icon: '👥', value: '24', label: i18n.language === 'ar' ? 'مستخدم نشط' : 'Active Users' },
  ];

  return (
    <View style={styles.tabContent}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.overviewGrid}>
        {overviewStats.map((stat, index) => (
          <Animated.View
            key={stat.label}
            entering={FadeInUp.duration(400).delay(index * 100)}
            style={styles.overviewCard}
          >
            <Text style={styles.overviewIcon}>{stat.icon}</Text>
            <Text style={styles.overviewValue}>{stat.value}</Text>
            <Text style={styles.overviewLabel}>{stat.label}</Text>
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(400)} style={styles.actionSection}>
        <TouchableOpacity
          style={styles.broadcastBtn}
          onPress={() => router.push('/admin/broadcast')}
          activeOpacity={0.8}
        >
          <Text style={styles.broadcastIcon}>📢</Text>
          <Text style={styles.broadcastText}>{t('sendBroadcast')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING['2xl'],
    borderBottomLeftRadius: RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
    ...SHADOWS.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: SPACING.xs,
  },
  subGreeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  logoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statStudents: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.info,
  },
  statTeachers: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.gold,
  },
  statPending: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.warning,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.goldLight,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  list: {
    gap: SPACING.md,
    paddingBottom: SPACING['4xl'],
  },
  tabContent: {
    gap: SPACING.md,
  },

  // Empty
  empty: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING['3xl'],
    fontSize: 16,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['3xl'],
    alignItems: 'center',
    ...SHADOWS.md,
    marginTop: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // User cards
  userCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  userMeta: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  roleBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: '#f1f5f9',
  },
  adminBadge: {
    backgroundColor: '#f3e8ff',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  adminText: {
    color: '#7c3aed',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.warningLight,
  },
  activeBadge: {
    backgroundColor: COLORS.successLight,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.warning,
  },
  activeBadgeText: {
    color: COLORS.success,
  },
  approveBtn: {
    backgroundColor: COLORS.success,
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  approveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Overview grid
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  overviewCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  overviewIcon: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  overviewLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Action section
  actionSection: {
    marginTop: SPACING.lg,
  },
  broadcastBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    ...SHADOWS.md,
    borderWidth: 2,
    borderColor: COLORS.primaryMuted,
  },
  broadcastIcon: {
    fontSize: 28,
  },
  broadcastText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
});
