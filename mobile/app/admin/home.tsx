import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import { useAuthStore } from '@/src/auth/store';
import { apiClient } from '@/src/api';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';
import { useMessages } from '@/src/hooks/useMessages';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

type FilterType = 'all' | 'STUDENT' | 'TEACHER' | 'PENDING' | 'PENDING_AND_TEACHER';

function getFilteredUsers(users: User[], filter: FilterType): User[] {
  if (filter === 'all') return users;
  if (filter === 'PENDING') return users.filter((u) => u.status === 'PENDING');
  if (filter === 'PENDING_AND_TEACHER') return users.filter((u) => u.status === 'PENDING' || u.role === 'TEACHER');
  return users.filter((u) => u.role === filter);
}

export default function AdminHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({ students: 0, teachers: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('PENDING_AND_TEACHER');
  const { unreadCount, fetchMessages: fetchUnreadCount } = useMessages();

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/admin/users');
      const usersData = res.data?.data?.data || [];
      setAllUsers(usersData);
      setUsers(getFilteredUsers(usersData, 'PENDING_AND_TEACHER'));
      const students = usersData.filter((u: User) => u.role === 'STUDENT').length;
      const teachers = usersData.filter((u: User) => u.role === 'TEACHER').length;
      const pending = usersData.filter((u: User) => u.status === 'PENDING').length;
      setStats({ students, teachers, pending });
    } catch (err: any) {
      console.error('Failed to load users:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUsers();
    fetchUnreadCount();
  }, [loadUsers]);

  const applyFilter = (filter: FilterType) => {
    setActiveFilter(filter);
    setUsers(getFilteredUsers(allUsers, filter));
  };

  const approveStudent = async (id: string) => {
    try {
      await apiClient.put(`/admin/users/${id}/approve`);
      const updated = allUsers.map((u) => (u.id === id ? { ...u, status: 'ACTIVE' } : u));
      setAllUsers(updated);
      setUsers(getFilteredUsers(updated, activeFilter));
      const pending = updated.filter((u) => u.status === 'PENDING').length;
      setStats((s) => ({ ...s, pending }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const navigateToUserDetail = (userId: string) => {
    router.push(`/admin/user-detail?id=${userId}`);
  };

  const navigateToSettings = () => {
    router.push('/admin/settings');
  };

  const filterLabel =
    activeFilter === 'all'
      ? ''
      : {
          STUDENT: i18n.language === 'ar' ? 'عرض الطلاب' : 'Showing Students',
          TEACHER: i18n.language === 'ar' ? 'عرض المعلمين' : 'Showing Teachers',
          PENDING: i18n.language === 'ar' ? 'عرض المعلقة' : 'Showing Pending',
          PENDING_AND_TEACHER: i18n.language === 'ar' ? 'عرض المعلّقين والمعلمين' : 'Showing Pending and Teachers',
        }[activeFilter];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{t('adminHomeTitle')}</Text>
            <Text style={styles.subGreeting}>
              {i18n.language === 'ar' ? 'مرحباً، ' : 'Welcome, '}
              {user?.firstName || ''}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.msgIconWrap}>
              <TouchableOpacity style={styles.msgIconBtn} onPress={() => router.push('/messages')}>
                <Text style={styles.msgIconText}>💬</Text>
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.msgBadge}>
                  <Text style={styles.msgBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.msgIconBtn} onPress={() => router.push('/admin/broadcast')}>
              <Text style={styles.msgIconText}>📢</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={navigateToSettings} style={styles.iconBtn}>
              <Text style={styles.iconText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>{t('logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row - Clickable Filters */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, styles.statStudents, activeFilter === 'STUDENT' && styles.statActive]}
            onPress={() => applyFilter(activeFilter === 'STUDENT' ? 'all' : 'STUDENT')}
            activeOpacity={0.8}
          >
            <Text style={styles.statValue}>{stats.students}</Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'الطلاب' : 'Students'}</Text>
            {activeFilter === 'STUDENT' && <View style={styles.statIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, styles.statTeachers, activeFilter === 'TEACHER' && styles.statActive]}
            onPress={() => applyFilter(activeFilter === 'TEACHER' ? 'all' : 'TEACHER')}
            activeOpacity={0.8}
          >
            <Text style={styles.statValue}>{stats.teachers}</Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'المعلمون' : 'Teachers'}</Text>
            {activeFilter === 'TEACHER' && <View style={styles.statIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, styles.statPending, activeFilter === 'PENDING' && styles.statActive]}
            onPress={() => applyFilter(activeFilter === 'PENDING' ? 'all' : 'PENDING')}
            activeOpacity={0.8}
          >
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>{i18n.language === 'ar' ? 'معلقة' : 'Pending'}</Text>
            {activeFilter === 'PENDING' && <View style={styles.statIndicator} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Badge */}
      {activeFilter !== 'all' && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterText}>{filterLabel}</Text>
          <TouchableOpacity onPress={() => applyFilter('all')}>
            <Text style={styles.filterClear}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Users List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text style={styles.empty}>{t('loading')}</Text>
        ) : (
          <UsersList users={users} onUserPress={navigateToUserDetail} onApprove={approveStudent} styles={styles} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function UsersList({
  users,
  onUserPress,
  onApprove,
  styles,
}: {
  users: User[];
  onUserPress: (id: string) => void;
  onApprove: (id: string) => void;
  styles: any;
}) {
  const { t, i18n } = useTranslation();
  const roleLabels: Record<string, string> = {
    STUDENT: i18n.language === 'ar' ? 'طالب' : 'Student',
    TEACHER: i18n.language === 'ar' ? 'معلم' : 'Teacher',
    ADMIN: i18n.language === 'ar' ? 'مشرف' : 'Admin',
  };
  const statusLabels: Record<string, string> = {
    ACTIVE: i18n.language === 'ar' ? 'نشط' : 'Active',
    PENDING: i18n.language === 'ar' ? 'معلق' : 'Pending',
    INACTIVE: i18n.language === 'ar' ? 'غير نشط' : 'Inactive',
    SUSPENDED: i18n.language === 'ar' ? 'موقوف' : 'Suspended',
  };

  if (users.length === 0) {
    return (
      <Animated.View entering={FadeInUp.duration(400)} style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyTitle}>{t('noUsersYet')}</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.usersContainer}>
      {users.map((u, index) => (
        <TouchableOpacity key={u.id} onPress={() => onUserPress(u.id)} activeOpacity={0.8}>
          <Animated.View entering={FadeInUp.duration(400).delay(index * 50)} style={styles.userCard}>
            <View style={styles.userRow}>
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>{u.firstName[0]}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {u.firstName} {u.lastName}
                </Text>
                <Text style={styles.userEmail}>{u.email}</Text>
                <View style={styles.userMeta}>
                  <View style={[styles.roleBadge, u.role === 'ADMIN' && styles.adminBadge]}>
                    <Text style={[styles.roleText, u.role === 'ADMIN' && styles.adminText]}>
                      {roleLabels[u.role] ?? u.role}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, u.status === 'ACTIVE' && styles.activeBadge]}>
                    <Text style={[styles.statusBadgeText, u.status === 'ACTIVE' && styles.activeBadgeText]}>
                      {statusLabels[u.status] ?? u.status}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.userActions}>
                {u.status === 'PENDING' && u.role === 'STUDENT' && (
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      onApprove(u.id);
                    }}
                  >
                    <Text style={styles.approveText}>✓</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.chevron}>›</Text>
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
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
    headerActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconText: {
      fontSize: 16,
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
    msgIconWrap: { position: 'relative', marginRight: 6 },
    msgIconBtn: {
      width: 32, height: 32, backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    },
    msgIconText: { fontSize: 16 },
    msgBadge: {
      position: 'absolute', top: -4, right: -4,
      minWidth: 16, height: 16, borderRadius: 8,
      backgroundColor: '#ef4444',
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    },
    msgBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

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
      position: 'relative',
      overflow: 'hidden',
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
    statActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
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
    statIndicator: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: '#fff',
    },

    // Filter Badge
    filterBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: COLORS.primaryMuted,
      marginHorizontal: SPACING.xl,
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
    },
    filterText: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.primaryDark,
    },
    filterClear: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.primary,
      padding: SPACING.xs,
    },

    // Content
    content: {
      flex: 1,
      paddingHorizontal: SPACING.xl,
    },
    list: {
      paddingVertical: SPACING.lg,
      paddingBottom: SPACING['4xl'],
    },
    usersContainer: {
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
    userActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
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
      width: 32,
      height: 32,
      borderRadius: RADIUS.full,
      justifyContent: 'center',
      alignItems: 'center',
      ...SHADOWS.sm,
    },
    approveText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    chevron: {
      fontSize: 20,
      color: COLORS.textMuted,
      fontWeight: '700',
    },
  });
