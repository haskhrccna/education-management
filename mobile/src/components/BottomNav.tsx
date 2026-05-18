import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

type Role = 'student' | 'teacher' | 'admin';

interface Tab {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  labelAr: string;
  labelEn: string;
  route: string;
}

const STUDENT_TABS: Tab[] = [
  {
    id: 'home',
    icon: 'home-outline',
    iconActive: 'home',
    labelAr: 'الرئيسية',
    labelEn: 'Home',
    route: '/student/home',
  },
  {
    id: 'sessions',
    icon: 'calendar-outline',
    iconActive: 'calendar',
    labelAr: 'المواعيد',
    labelEn: 'Sessions',
    route: '/student/appointments',
  },
  {
    id: 'recordings',
    icon: 'mic-outline',
    iconActive: 'mic',
    labelAr: 'تسجيلاتي',
    labelEn: 'Recordings',
    route: '/student/recordings',
  },
  {
    id: 'grades',
    icon: 'bar-chart-outline',
    iconActive: 'bar-chart',
    labelAr: 'درجاتي',
    labelEn: 'Grades',
    route: '/student/grades',
  },
  {
    id: 'profile',
    icon: 'person-outline',
    iconActive: 'person',
    labelAr: 'حسابي',
    labelEn: 'Profile',
    route: '/student/teacher-change',
  },
];

const TEACHER_TABS: Tab[] = [
  {
    id: 'home',
    icon: 'home-outline',
    iconActive: 'home',
    labelAr: 'الرئيسية',
    labelEn: 'Home',
    route: '/teacher/home',
  },
  {
    id: 'sessions',
    icon: 'calendar-outline',
    iconActive: 'calendar',
    labelAr: 'المواعيد',
    labelEn: 'Sessions',
    route: '/teacher/appointments',
  },
  {
    id: 'reviews',
    icon: 'mic-outline',
    iconActive: 'mic',
    labelAr: 'التسجيلات',
    labelEn: 'Reviews',
    route: '/teacher/recordings',
  },
  {
    id: 'reports',
    icon: 'document-text-outline',
    iconActive: 'document-text',
    labelAr: 'التقارير',
    labelEn: 'Reports',
    route: '/teacher/reports',
  },
  {
    id: 'profile',
    icon: 'settings-outline',
    iconActive: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    route: '/admin/settings',
  },
];

const ADMIN_TABS: Tab[] = [
  { id: 'home', icon: 'home-outline', iconActive: 'home', labelAr: 'الرئيسية', labelEn: 'Home', route: '/admin/home' },
  {
    id: 'broadcast',
    icon: 'megaphone-outline',
    iconActive: 'megaphone',
    labelAr: 'إشعارات',
    labelEn: 'Broadcast',
    route: '/admin/broadcast',
  },
  {
    id: 'requests',
    icon: 'people-outline',
    iconActive: 'people',
    labelAr: 'الطلبات',
    labelEn: 'Requests',
    route: '/admin/change-requests',
  },
  {
    id: 'messages',
    icon: 'chatbubble-outline',
    iconActive: 'chatbubble',
    labelAr: 'الرسائل',
    labelEn: 'Messages',
    route: '/messages',
  },
  {
    id: 'settings',
    icon: 'settings-outline',
    iconActive: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    route: '/admin/settings',
  },
];

interface BottomNavProps {
  role: Role;
  active: string;
}

export function BottomNav({ role, active }: BottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);

  const tabs = role === 'student' ? STUDENT_TABS : role === 'teacher' ? TEACHER_TABS : ADMIN_TABS;
  const styles = navStyles(COLORS);

  return (
    <View style={[styles.safeArea, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.82}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={21}
                  color={isActive ? COLORS.textOnPrimary : COLORS.textSecondary}
                />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
                {isAr ? tab.labelAr : tab.labelEn}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const navStyles = (COLORS: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: COLORS.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.darkMode ? COLORS.divider : '#E3E9E2',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
    },
    container: {
      backgroundColor: COLORS.darkMode ? COLORS.surfaceAlt : '#FFFFFF',
      borderRadius: RADIUS['2xl'],
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.darkMode ? COLORS.divider : '#E7ECE6',
      borderTopWidth: 1,
      borderTopColor: COLORS.darkMode ? COLORS.divider : '#E7ECE6',
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: SPACING.xs,
      paddingVertical: SPACING.xs,
      ...SHADOWS.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
      paddingVertical: SPACING.xs,
    },
    tabActive: {},
    iconWrap: {
      width: 34,
      height: 30,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapActive: {
      backgroundColor: COLORS.primary,
    },
    label: {
      fontSize: 10,
      color: COLORS.textSecondary,
      fontWeight: '700',
      maxWidth: 64,
      textAlign: 'center',
    },
    labelActive: {
      color: COLORS.primary,
    },
  });
