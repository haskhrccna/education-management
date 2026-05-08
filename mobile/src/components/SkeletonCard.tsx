import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';

interface Props {
  lines?: number;
}

export function SkeletonCard({ lines = 2 }: Props) {
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { backgroundColor: COLORS.surface, opacity }]}>
      <View style={[styles.linePrimary, { backgroundColor: COLORS.surfaceAlt }]} />
      {lines >= 2 && <View style={[styles.lineSecondary, { backgroundColor: COLORS.surfaceAlt }]} />}
      {lines >= 3 && <View style={[styles.lineTertiary, { backgroundColor: COLORS.surfaceAlt }]} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm },
  linePrimary: { height: 14, borderRadius: RADIUS.sm, width: '65%' },
  lineSecondary: { height: 12, borderRadius: RADIUS.sm, width: '45%' },
  lineTertiary: { height: 10, borderRadius: RADIUS.sm, width: '30%' },
});
