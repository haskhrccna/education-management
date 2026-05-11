import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { getColors, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

type Colors = ReturnType<typeof getColors>;
type IconName = keyof typeof Ionicons.glyphMap;

interface CardProps {
  children: React.ReactNode;
  colors: Colors;
  style?: StyleProp<ViewStyle>;
}

export function AppCard({ children, colors, style }: CardProps) {
  return <View style={[uiStyles(colors).card, style]}>{children}</View>;
}

interface IconButtonProps {
  colors: Colors;
  icon: IconName;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel: string;
  tone?: 'primary' | 'ghost' | 'surface' | 'danger' | 'warning';
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  colors,
  icon,
  onPress,
  accessibilityLabel,
  tone = 'surface',
  size = 40,
  disabled,
  style,
}: IconButtonProps) {
  const background =
    tone === 'primary'
      ? colors.primary
      : tone === 'danger'
        ? colors.errorLight
        : tone === 'warning'
          ? colors.warningLight
          : tone === 'ghost'
            ? 'rgba(255,255,255,0.16)'
            : colors.surface;
  const color =
    tone === 'primary'
      ? colors.textOnPrimary
      : tone === 'danger'
        ? colors.error
        : tone === 'warning'
          ? colors.warning
          : tone === 'ghost'
            ? colors.textOnPrimary
            : colors.primary;

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.82}
      disabled={disabled}
      onPress={onPress}
      style={[
        uiStyles(colors).iconButton,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.52)} color={color} />
    </TouchableOpacity>
  );
}

interface AvatarProps {
  colors: Colors;
  label: string;
  size?: number;
  tone?: string;
}

export function Avatar({ colors, label, size = 42, tone }: AvatarProps) {
  const initials = getInitials(label);
  const color = tone ?? avatarColor(label, colors);
  return (
    <View
      style={[
        uiStyles(colors).avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}18` },
      ]}
    >
      <Text style={[uiStyles(colors).avatarText, { color, fontSize: Math.max(11, Math.round(size * 0.31)) }]}>
        {initials}
      </Text>
    </View>
  );
}

interface MetricTileProps {
  colors: Colors;
  value: string | number;
  label: string;
  tone?: 'primary' | 'gold' | 'info' | 'warning' | 'success';
  style?: StyleProp<ViewStyle>;
}

export function MetricTile({ colors, value, label, tone = 'primary', style }: MetricTileProps) {
  const accent =
    tone === 'gold'
      ? colors.gold
      : tone === 'info'
        ? colors.info
        : tone === 'warning'
          ? colors.warning
          : tone === 'success'
            ? colors.success
            : colors.primary;
  const bg =
    tone === 'gold'
      ? colors.goldMuted
      : tone === 'info'
        ? colors.infoLight
        : tone === 'warning'
          ? colors.warningLight
          : tone === 'success'
            ? colors.successLight
            : colors.surface;
  return (
    <View style={[uiStyles(colors).metricTile, { backgroundColor: bg }, style]}>
      <Text style={[uiStyles(colors).metricValue, { color: accent }]}>{value}</Text>
      <Text style={uiStyles(colors).metricLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  colors: Colors;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, actionLabel, onActionPress, colors, style }: SectionHeaderProps) {
  return (
    <View style={[uiStyles(colors).sectionHeader, style]}>
      <Text style={uiStyles(colors).sectionTitle}>{title}</Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity onPress={onActionPress} activeOpacity={0.8}>
          <Text style={uiStyles(colors).sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface StatusPillProps {
  colors: Colors;
  label: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function StatusPill({ colors, label, status = 'neutral', style, textStyle }: StatusPillProps) {
  const bg =
    status === 'success'
      ? colors.successLight
      : status === 'warning'
        ? colors.warningLight
        : status === 'error'
          ? colors.errorLight
          : status === 'info'
            ? colors.infoLight
            : colors.primaryMuted;
  const color =
    status === 'success'
      ? colors.success
      : status === 'warning'
        ? colors.warning
        : status === 'error'
          ? colors.error
          : status === 'info'
            ? colors.info
            : colors.primary;
  return (
    <View style={[uiStyles(colors).statusPill, { backgroundColor: bg }, style]}>
      <Text style={[uiStyles(colors).statusText, { color }, textStyle]}>{label}</Text>
    </View>
  );
}

interface ProgressBarProps {
  colors: Colors;
  percent: number;
  tone?: 'primary' | 'gold' | 'info' | 'warning' | 'success';
  height?: number;
}

export function ProgressBar({ colors, percent, tone = 'primary', height = 6 }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const fill =
    tone === 'gold'
      ? colors.gold
      : tone === 'info'
        ? colors.info
        : tone === 'warning'
          ? colors.warning
          : tone === 'success'
            ? colors.success
            : colors.primary;
  return (
    <View style={[uiStyles(colors).progressTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${clamped}%`, height, borderRadius: height / 2, backgroundColor: fill }} />
    </View>
  );
}

interface EmptyStateProps {
  colors: Colors;
  icon: IconName;
  title: string;
  description?: string;
}

export function EmptyState({ colors, icon, title, description }: EmptyStateProps) {
  return (
    <View style={uiStyles(colors).emptyState}>
      <View style={uiStyles(colors).emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={uiStyles(colors).emptyTitle}>{title}</Text>
      {description ? <Text style={uiStyles(colors).emptyDesc}>{description}</Text> : null}
    </View>
  );
}

export function avatarColor(label: string, colors: Colors): string {
  const palette = [colors.primary, colors.info, colors.warning, colors.error, '#7B1FA2', '#00897B'];
  const seed = [...(label || '?')].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const uiStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.darkMode ? colors.divider : '#E7ECE6',
      padding: SPACING.lg,
      ...SHADOWS.sm,
    },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontWeight: '800',
    },
    metricTile: {
      flex: 1,
      minHeight: 70,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      justifyContent: 'center',
    },
    metricValue: {
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 28,
    },
    metricLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 3,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.xs,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    sectionAction: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    statusPill: {
      alignSelf: 'flex-start',
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '800',
    },
    progressTrack: {
      backgroundColor: colors.darkMode ? colors.surfaceAlt : '#E3E9E2',
      overflow: 'hidden',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING['2xl'],
      paddingHorizontal: SPACING.lg,
    },
    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryMuted,
      marginBottom: SPACING.md,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      textAlign: 'center',
    },
    emptyDesc: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
  });
