import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { apiClient } from '@/src/api';
import { useAuthStore } from '@/src/auth/store';
import { useMessages } from '@/src/hooks/useMessages';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';
import { useThemeSettings } from '@/src/settings/store';
import { useNotifications } from '@/src/hooks/useNotifications';
import { AppCard, Avatar, IconButton, MetricTile, SectionHeader, StatusPill } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { BottomNav } from '@/src/components/BottomNav';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

type FilterType = 'PENDING' | 'TEACHER' | 'STUDENT' | 'all';

function fullName(user: Pick<User, 'firstName' | 'lastName'>): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '?';
}

function getFilteredUsers(users: User[], filter: FilterType): User[] {
  if (filter === 'all') return users;
  if (filter === 'PENDING') return users.filter((user) => user.status === 'PENDING');
  return users.filter((user) => user.role === filter);
}

function roleLabel(role: string, isAr: boolean): string {
  if (role === 'STUDENT') return isAr ? 'طالب' : 'Student';
  if (role === 'TEACHER') return isAr ? 'معلم' : 'Teacher';
  if (role === 'ADMIN') return isAr ? 'مشرف' : 'Admin';
  return role;
}

function statusLabel(status: string, isAr: boolean): string {
  if (status === 'ACTIVE') return isAr ? 'نشط' : 'Active';
  if (status === 'PENDING') return isAr ? 'معلق' : 'Pending';
  if (status === 'SUSPENDED') return isAr ? 'موقوف' : 'Suspended';
  if (status === 'INACTIVE') return isAr ? 'غير نشط' : 'Inactive';
  return status;
}

export default function AdminHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const logout = useAuthStore((s) => s.logout);
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const styles = createStyles(COLORS);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { unreadCount, fetchMessages } = useMessages();
  const { requests: changeRequests, fetchRequests } = useTeacherChange();

  const pendingChangeCount = changeRequests.filter((request: any) => request.status === 'PENDING').length;
  const users = useMemo(() => getFilteredUsers(allUsers, activeFilter), [allUsers, activeFilter]);
  const stats = useMemo(
    () => ({
      students: allUsers.filter((user) => user.role === 'STUDENT').length,
      teachers: allUsers.filter((user) => user.role === 'TEACHER').length,
      pending: allUsers.filter((user) => user.status === 'PENDING').length,
    }),
    [allUsers]
  );

  const loadUsers = useCallback(async () => {
    setFetchError(null);
    setIsLoading(true);
    try {
      const res = await apiClient.get('/admin/users');
      setAllUsers(res.data?.data?.data ?? []);
    } catch (err: any) {
      console.error('Failed to load users:', err.message);
      setFetchError(t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const refreshAll = useCallback(() => {
    loadUsers();
    fetchMessages();
    fetchRequests();
  }, [loadUsers, fetchMessages, fetchRequests]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const approveStudent = async (id: string) => {
    try {
      await apiClient.put(`/admin/users/${id}/approve`);
      setAllUsers((current) => current.map((user) => (user.id === id ? { ...user, status: 'ACTIVE' } : user)));
    } catch (err: any) {
      setFetchError(err?.message ?? t('loadFailed'));
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: 'PENDING', label: isAr ? 'المعلقة' : 'Pending' },
    { id: 'TEACHER', label: isAr ? 'المعلمون' : 'Teachers' },
    { id: 'STUDENT', label: isAr ? 'الطلاب' : 'Students' },
    { id: 'all', label: isAr ? 'الكل' : 'All' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshAll} tintColor={COLORS.primary} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTitle}>{isAr ? 'الموافقات' : 'Approvals'}</Text>
              <Text style={styles.heroSubtitle}>
                {isAr ? 'المستخدمون المعلقون وتغييرات المعلمين' : 'Pending users and teacher changes'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <View>
                <TouchableOpacity onPress={() => router.push('/notifications')} style={{ marginEnd: SPACING.md }}>
                  <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <IconButton
                  colors={COLORS}
                  icon="chatbubble-outline"
                  tone="ghost"
                  accessibilityLabel={isAr ? 'الرسائل' : 'Messages'}
                  onPress={() => router.push('/messages')}
                />
                {unreadCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                ) : null}
              </View>
              <IconButton
                colors={COLORS}
                icon="settings-outline"
                tone="ghost"
                accessibilityLabel={isAr ? 'الإعدادات' : 'Settings'}
                onPress={() => router.push('/admin/settings')}
              />
              <IconButton
                colors={COLORS}
                icon="log-out-outline"
                tone="ghost"
                accessibilityLabel={isAr ? 'تسجيل الخروج' : 'Log out'}
                onPress={handleLogout}
              />
            </View>
          </View>

          <View style={styles.filterRow}>
            {filters.map((filter) => {
              const active = activeFilter === filter.id;
              return (
                <TouchableOpacity
                  key={filter.id}
                  activeOpacity={0.85}
                  onPress={() => setActiveFilter(filter.id)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricTile colors={COLORS} value={stats.students} label={isAr ? 'طلاب' : 'Students'} />
          <MetricTile colors={COLORS} value={stats.teachers} label={isAr ? 'معلمون' : 'Teachers'} tone="gold" />
          <MetricTile colors={COLORS} value={stats.pending} label={isAr ? 'معلق' : 'Pending'} tone="warning" />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.actionBanner}
            onPress={() => router.push('/admin/change-requests')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.warning} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>
                {pendingChangeCount}{' '}
                {isAr
                  ? pendingChangeCount === 1
                    ? 'طلب تغيير معلم'
                    : 'طلبات تغيير معلم'
                  : pendingChangeCount === 1
                    ? 'teacher change request'
                    : 'teacher change requests'}
              </Text>
              <Text style={styles.actionMeta}>{isAr ? 'راجع التعيينات' : 'Review assignments'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.warning} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.broadcastButton}
            onPress={() => router.push('/admin/broadcast')}
          >
            <Ionicons name="megaphone-outline" size={20} color={COLORS.textOnPrimary} />
            <Text style={styles.broadcastText}>{isAr ? 'إشعار عام' : 'Broadcast'}</Text>
          </TouchableOpacity>
        </View>

        {fetchError && !isLoading ? (
          <TouchableOpacity activeOpacity={0.85} onPress={refreshAll} style={styles.errorBanner}>
            <Text style={styles.errorText}>{fetchError}</Text>
          </TouchableOpacity>
        ) : null}

        <SectionHeader title={isAr ? 'قائمة الموافقات' : 'Approval queue'} colors={COLORS} />
        {isLoading ? (
          <View style={styles.listStack}>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </View>
        ) : users.length > 0 ? (
          <View style={styles.listStack}>
            {users.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/admin/user-detail?id=${item.id}`)}
              >
                <AppCard colors={COLORS} style={styles.userCard}>
                  <Avatar colors={COLORS} label={fullName(item)} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{fullName(item)}</Text>
                    <Text style={styles.userEmail} numberOfLines={1}>
                      {item.email}
                    </Text>
                    <View style={styles.pillRow}>
                      <StatusPill
                        colors={COLORS}
                        label={roleLabel(item.role, isAr)}
                        status={item.role === 'TEACHER' ? 'warning' : 'info'}
                      />
                      <StatusPill
                        colors={COLORS}
                        label={statusLabel(item.status, isAr)}
                        status={
                          item.status === 'ACTIVE' ? 'success' : item.status === 'PENDING' ? 'warning' : 'neutral'
                        }
                      />
                    </View>
                  </View>
                  {item.status === 'PENDING' && item.role === 'STUDENT' ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={isAr ? 'قبول الطالب' : 'Approve student'}
                      activeOpacity={0.85}
                      onPress={(event) => {
                        event.stopPropagation();
                        approveStudent(item.id);
                      }}
                      style={styles.approveButton}
                    >
                      <Ionicons name="checkmark-outline" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  )}
                </AppCard>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <AppCard colors={COLORS}>
            <Text style={styles.emptyText}>{isAr ? 'لا توجد عناصر لهذا الفلتر' : 'No items for this filter'}</Text>
          </AppCard>
        )}
      </ScrollView>
      <BottomNav role="admin" active="home" />
    </View>
  );
}

const createStyles = (COLORS: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING['3xl'],
      gap: SPACING.lg,
    },
    hero: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS['2xl'],
      padding: SPACING.xl,
      gap: SPACING.lg,
      ...SHADOWS.md,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
    heroTitle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 30,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: 4,
      maxWidth: 190,
    },
    headerActions: {
      flexDirection: 'row',
      gap: SPACING.xs,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: COLORS.error,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    filterChip: {
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    filterChipActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    filterText: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 11,
      fontWeight: '800',
    },
    filterTextActive: {
      color: '#FFFFFF',
    },
    metricsRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    actionRow: {
      gap: SPACING.md,
    },
    actionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: COLORS.warningLight,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.warning,
      padding: SPACING.lg,
    },
    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.goldMuted,
    },
    actionInfo: {
      flex: 1,
    },
    actionTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    actionMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
    },
    broadcastButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    broadcastText: {
      color: COLORS.textOnPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    errorBanner: {
      backgroundColor: COLORS.errorLight,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.error,
      padding: SPACING.md,
    },
    errorText: {
      color: COLORS.error,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    listStack: {
      gap: SPACING.md,
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    userEmail: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
      marginTop: SPACING.sm,
    },
    approveButton: {
      width: 58,
      height: 34,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
