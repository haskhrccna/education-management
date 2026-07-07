import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useIsOnline } from '../hooks/useIsOnline';
import { AppText } from './design';

/**
 * Global, always-mounted-at-root indicator. Cached data still renders while
 * offline (the persisted query cache handles that) — this exists purely so
 * a user isn't left wondering why an action silently didn't go through.
 */
export function OfflineBanner() {
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  if (isOnline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 6 }]} pointerEvents="none">
      <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
      <AppText variant="bodySmall" color="#FFFFFF" style={{ marginStart: 6 }}>
        {isAr ? 'أنت غير متصل — تُعرض البيانات المحفوظة' : "You're offline — showing saved data"}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#616161',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
  },
});
