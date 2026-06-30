import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { useSettingsScales } from './SettingsContext';
import { GestureResponderEvent, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { getColors, RADIUS, SHADOWS, SPACING, TYPOGRAPHY, FONT_SCALE } from '@/constants/theme';

export { AppText } from './AppText';

export type Colors = ReturnType<typeof getColors>;
type IconName = keyof typeof Ionicons.glyphMap;

interface CardProps {
  children: React.ReactNode;
  colors: Colors;
  style?: StyleProp<ViewStyle>;
}

export function AppCard({ children, colors, style }: CardProps) {
  const { spacingScale } = useSettingsScales();
  return <View style={[uiStyles(colors, spacingScale).card, style]}>{children}</View>;
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
  size = 44,
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
        uiStyles(colors, 1).iconButton,
        {
          width: Math.max(44, size),
          height: Math.max(44, size),
          borderRadius: size / 2,
          backgroundColor: background,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} />
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
  const { fontScale } = useSettingsScales();
  const initials = getInitials(label);
  const color = tone ?? avatarColor(label, colors);
  return (
    <View
      style={[
        uiStyles(colors, 1).avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}18` },
      ]}
    >
      <AppText variant="labelLarge" style={{ color, fontSize: Math.max(11, Math.round(size * 0.31 * fontScale)) }}>
        {initials}
      </AppText>
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
  const { spacingScale } = useSettingsScales();
  // Tone drives the surface tint only. The value is rendered in ink so it always
  // clears WCAG AA — accent-on-same-hue-tint (e.g. amber on #FFF8E1) measured as
  // low as 1.5:1, making the number all but invisible in light themes.
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
    <View style={[uiStyles(colors, spacingScale).metricTile, { backgroundColor: bg }, style]}>
      <AppText
        variant="headlineMedium"
        style={[uiStyles(colors, spacingScale).metricValue, { color: colors.textPrimary }]}
      >
        {value}
      </AppText>
      <AppText variant="bodySmall" style={uiStyles(colors, spacingScale).metricLabel} numberOfLines={1}>
        {label}
      </AppText>
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
    <View style={[uiStyles(colors, 1).sectionHeader, style]}>
      <AppText variant="titleLarge" style={uiStyles(colors, 1).sectionTitle}>
        {title}
      </AppText>
      {actionLabel && onActionPress ? (
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <AppText variant="labelLarge" style={uiStyles(colors, 1).sectionAction}>
            {actionLabel}
          </AppText>
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
}

export function StatusPill({ colors, label, status = 'neutral', style }: StatusPillProps) {
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
    <View style={[uiStyles(colors, 1).statusPill, { backgroundColor: bg }, style]}>
      <AppText variant="labelLarge" style={uiStyles(colors, 1).statusText}>
        {label}
      </AppText>
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
    <View style={[uiStyles(colors, 1).progressTrack, { height, borderRadius: height / 2 }]}>
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
  const { spacingScale } = useSettingsScales();
  return (
    <View style={uiStyles(colors, spacingScale).emptyState}>
      <View style={uiStyles(colors, spacingScale).emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <AppText variant="titleMedium" style={uiStyles(colors, spacingScale).emptyTitle}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="bodyMedium" style={uiStyles(colors, spacingScale).emptyDesc}>
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

interface SegmentedControlProps {
  colors: Colors;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl({ colors, options, value, onChange, style }: SegmentedControlProps) {
  return (
    <View style={[uiStyles(colors, 1).segmentRow, style]}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            activeOpacity={0.82}
            onPress={() => onChange(opt.value)}
            style={[
              uiStyles(colors, 1).segmentChip,
              { backgroundColor: selected ? colors.primary : colors.surface, borderColor: colors.borderSubtle },
            ]}
          >
            <AppText variant="labelLarge" color={selected ? colors.textOnPrimary : colors.textPrimary}>
              {opt.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
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

const uiStyles = (colors: Colors, spacingScale: number) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle ?? colors.divider,
      padding: Math.round(SPACING.lg * spacingScale),
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
    metricTile: {
      flex: 1,
      minHeight: 70,
      borderRadius: RADIUS.md,
      paddingHorizontal: Math.round(SPACING.md * spacingScale),
      paddingVertical: Math.round(SPACING.md * spacingScale),
      justifyContent: 'center',
    },
    metricValue: {
      lineHeight: 28,
    },
    metricLabel: {
      color: colors.textSecondary,
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
    },
    sectionAction: {
      color: colors.primary,
    },
    statusPill: {
      alignSelf: 'flex-start',
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
    },
    statusText: {
      fontSize: TYPOGRAPHY.labelLarge.fontSize,
      fontWeight: '800',
    },
    progressTrack: {
      backgroundColor: colors.borderSubtle,
      overflow: 'hidden',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING['2xl'] * spacingScale,
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
      textAlign: 'center',
    },
    emptyDesc: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    segmentChip: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.full,
      borderWidth: 1,
    },
  });
