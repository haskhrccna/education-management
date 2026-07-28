import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { apiClient } from '@/src/api';
import { parentsApi } from '@/src/api/parents';
import { useAuthStore } from '@/src/auth/store';
import { useMessages } from '@/src/hooks/useMessages';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';
import { useNotifications } from '@/src/hooks/useNotifications';
import { IconButton, MetricTile, SectionHeader } from '@/src/components/design';
import { AppText } from '@/src/components/AppText';
import { BottomNav } from '@/src/components/BottomNav';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

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
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const isRTL = useIsRTL();
  const logout = useAuthStore((s) => s.logout);
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { unreadCount, fetchMessages } = useMessages();
  const { requests: changeRequests, fetchRequests } = useTeacherChange();

  const pendingChangeCount = changeRequests.filter((request: any) => request.status === 'PENDING').length;
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
      // paginatedResponse shape is { data: User[], meta } — res.data IS that
      // envelope, so the rows are res.data.data (one level, not two).
      setAllUsers(res.data?.data ?? []);
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

  const [pendingLinkCount, setPendingLinkCount] = useState(0);
  useEffect(() => {
    // listLinks has no server-side status filter, so PENDING is counted here.
    parentsApi
      .listLinks()
      .then((all) => setPendingLinkCount(all.filter((l) => l.status === 'PENDING').length))
      .catch(() => setPendingLinkCount(0));
  }, []);

  const totalPending = stats.pending + pendingChangeCount + pendingLinkCount;

  const academyCards: { route: string; icon: keyof typeof Ionicons.glyphMap; title: string }[] = [
    { route: '/admin/academy-health', icon: 'stats-chart-outline', title: t('academyHealth') },
    { route: '/admin/academy-profile', icon: 'business-outline', title: t('academyProfile') },
    { route: '/admin/milestones', icon: 'trophy-outline', title: isAr ? 'الإنجازات' : 'Milestones' },
    { route: '/admin/broadcast', icon: 'megaphone-outline', title: isAr ? 'إشعار عام' : 'Broadcast' },
    { route: '/admin/audit-logs', icon: 'document-text-outline', title: t('auditLog') },
  ];

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

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
                icon="shield-checkmark-outline"
                tone="ghost"
                accessibilityLabel={isAr ? 'الحساب والخصوصية' : 'Account & Privacy'}
                onPress={() => router.push('/account')}
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
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          style={styles.approvalsSummary}
          onPress={() => router.push('/admin/change-requests')}
        >
          <View style={styles.approvalsIcon}>
            <Ionicons name="checkmark-done-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="titleMedium" style={{ color: COLORS.textPrimary }}>
              {t('approvalsPendingCount', { count: totalPending })}
            </AppText>
            <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
              {t('approvalsReview')}
            </AppText>
          </View>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.metricsRow}>
          <MetricTile colors={COLORS} value={stats.students} label={isAr ? 'طلاب' : 'Students'} />
          {/* Teachers was tone="gold". Gold marks earned achievement only, and a
              headcount is not one — DESIGN.md Rationed Gold Rule. */}
          <MetricTile colors={COLORS} value={stats.teachers} label={isAr ? 'معلمون' : 'Teachers'} tone="info" />
          <MetricTile colors={COLORS} value={stats.pending} label={isAr ? 'معلق' : 'Pending'} tone="warning" />
        </View>

        <SectionHeader title={t('academySection')} colors={COLORS} />
        <View style={styles.academyGrid}>
          {academyCards.map((card) => (
            <TouchableOpacity
              key={card.route}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={styles.academyCard}
              onPress={() => router.push(card.route as never)}
            >
              <Ionicons name={card.icon} size={22} color={COLORS.primary} />
              <AppText variant="titleMedium" style={{ color: COLORS.textPrimary }} numberOfLines={1}>
                {card.title}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        {fetchError && !isLoading ? (
          <TouchableOpacity activeOpacity={0.85} onPress={refreshAll} style={styles.errorBanner}>
            <Text style={styles.errorText}>{fetchError}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      <BottomNav role="admin" active="home" />
    </View>
  );
}

const createStyles = (COLORS: ThemeColors) =>
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
    metricsRow: {
      flexDirection: 'row',
      gap: SPACING.md,
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
    approvalsSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      minHeight: 44,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
      marginBottom: SPACING.md,
    },
    approvalsIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryMuted,
    },
    academyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    academyCard: {
      flexGrow: 1,
      flexBasis: '47%',
      minHeight: 88,
      justifyContent: 'center',
      gap: SPACING.xs,
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
  });
