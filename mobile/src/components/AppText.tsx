import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useSettingsScales } from '@/src/components/SettingsContext';
import { TYPOGRAPHY } from '@/constants/theme';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useTheme } from '@/src/hooks/useTheme';
export type AppTextVariant = keyof typeof TYPOGRAPHY;

interface AppTextProps {
  children: React.ReactNode;
  variant?: AppTextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  accessibilityLabel?: string;
  allowFontScaling?: boolean;
}

export function AppText({
  children,
  variant = 'bodyMedium',
  color,
  style,
  numberOfLines,
  ellipsizeMode,
  accessibilityLabel,
  allowFontScaling = true,
}: AppTextProps) {
  const { fontScale } = useSettingsScales();
  const rtl = useIsRTL();
  const { colors: colors } = useTheme();
  const base = TYPOGRAPHY[variant];

  return (
    <Text
      style={[
        {
          ...base,
          color: color ?? colors.textPrimary,
          fontSize: Math.round(base.fontSize * fontScale),
          lineHeight: Math.round((base.lineHeight ?? base.fontSize * 1.4) * fontScale),
          writingDirection: rtl ? 'rtl' : 'ltr',
          textAlign: rtl ? 'right' : 'left',
        },
        style,
      ]}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      accessibilityLabel={accessibilityLabel}
      allowFontScaling={allowFontScaling}
    >
      {children}
    </Text>
  );
}
