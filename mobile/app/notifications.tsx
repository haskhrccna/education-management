import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/src/hooks/useNotifications';
import { useAuthStore } from '@/src/auth/store';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { AppCard, AppText, EmptyState, IconButton } from '@/src/components/design';
import { Notification } from '@/src/api/notifications';
import { useTheme } from '@/src/hooks/useTheme';

type AppRole = 'student' | 'teacher' | 'admin' | 'parent' | undefined;

function useRole(): AppRole {
  const user = useAuthStore((s) => s.user);
  const role = user?.role?.toLowerCase();
  if (role === 'student' || role === 'teacher' || role === 'admin' || role === 'parent') return role;
  return undefined;
}

function notificationTone(type: string): 'success' | 'warning' | 'error' | 'primary' | 'neutral' {
  switch (type) {
    case 'new_grade':
    case 'badge_earned':
    case 'parent_link_approved':
      return 'success';
    case 'appointment_update':
      return 'warning';
    case 'teacher_change_decision':
      return type.includes('DENIED') ? 'error' : 'primary';
    case 'new_message':
      return 'primary';
    default:
      return 'neutral';
  }
}

function notificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'new_grade':
      return 'school-outline';
    case 'appointment_update':
      return 'calendar-outline';
    case 'teacher_change_decision':
      return 'git-pull-request-outline';
    case 'new_message':
      return 'chatbubble-outline';
    case 'badge_earned':
      return 'trophy-outline';
    case 'parent_link_approved':
      return 'people-outline';
    default:
      return 'notifications-outline';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const role = useRole();
  const { colors: COLORS } = useTheme();
  const { notifications, unreadCount, isLoading, error, hasNext, fetchNotifications, markRead, markAllRead } =
    useNotifications();

  const handlePress = async (item: Notification) => {
    if (!item.readAt) {
      await markRead(item.id);
    }
    const route = (() => {
      switch (item.type) {
        case 'new_grade':
          return role === 'student' ? '/student/grades' : role === 'teacher' ? '/teacher/grade-form' : undefined;
        case 'appointment_update':
          return role ? `/${role}/appointments` : undefined;
        case 'teacher_change_decision':
          return '/student/teacher-change';
        case 'new_message':
          return '/messages';
        case 'badge_earned':
          return role === 'student' ? '/student/home' : undefined;
        case 'parent_link_approved':
          return role === 'parent' ? '/parent/home' : '/student/home';
        default:
          return undefined;
      }
    })();
    if (route) router.push(route as any);
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.readAt;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handlePress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.body}`}
      >
        <AppCard colors={COLORS} style={{ opacity: isUnread ? 1 : 0.72 }}>
          <View style={styles.row}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor:
                    notificationTone(item.type) === 'success'
                      ? COLORS.successLight
                      : notificationTone(item.type) === 'warning'
                        ? COLORS.warningLight
                        : notificationTone(item.type) === 'error'
                          ? COLORS.errorLight
                          : COLORS.primaryMuted,
                },
              ]}
            >
              <Ionicons
                name={notificationIcon(item.type)}
                size={18}
                color={
                  notificationTone(item.type) === 'success'
                    ? COLORS.success
                    : notificationTone(item.type) === 'warning'
                      ? COLORS.warning
                      : notificationTone(item.type) === 'error'
                        ? COLORS.error
                        : COLORS.primary
                }
              />
            </View>
            <View style={styles.content}>
              <AppText
                variant="titleSmall"
                color={COLORS.textPrimary}
                style={{ textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}
              >
                {item.title}
              </AppText>
              <AppText
                variant="bodySmall"
                color={COLORS.textSecondary}
                style={{
                  marginTop: 2,
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
              >
                {item.body}
              </AppText>
              <AppText
                variant="bodySmall"
                color={COLORS.textMuted}
                style={{ marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}
              >
                {new Date(item.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </AppText>
            </View>
            {isUnread && <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />}
          </View>
        </AppCard>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward-outline' : 'arrow-back-outline'}
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
        <AppText variant="headlineSmall" color="#FFFFFF">
          {t('notifications')}
        </AppText>
        {unreadCount > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={markAllRead}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText variant="bodySmall" color="rgba(255,255,255,0.9)">
              {t('markAllRead')}
            </AppText>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {error ? (
        <View style={styles.center}>
          <AppText variant="bodyMedium" color={COLORS.textSecondary}>
            {error}
          </AppText>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => fetchNotifications(1)}
            style={{ marginTop: SPACING.md }}
          >
            <AppText variant="bodyMedium" color={COLORS.primary}>
              {t('retry')}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && notifications.length === 0}
              onRefresh={() => fetchNotifications(1)}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.empty}>
                <EmptyState
                  colors={COLORS}
                  icon="notifications-off-outline"
                  title={t('noNotifications')}
                  description={t('noNotificationsDesc')}
                />
              </View>
            ) : (
              <ActivityIndicator color={COLORS.primary} />
            )
          }
          onEndReached={() => {
            if (hasNext && !isLoading) fetchNotifications(2);
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasNext ? <ActivityIndicator style={{ margin: SPACING.md }} color={COLORS.primary} /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  list: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: SPACING.md,
  },
  content: { flex: 1 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginStart: SPACING.sm,
    marginTop: SPACING.sm,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  empty: { paddingVertical: SPACING['2xl'] },
});
