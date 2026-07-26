import React from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/src/api/public';
import { AppCard, AppText, EmptyState } from '@/src/components/design';
import { useTheme } from '@/src/hooks/useTheme';
import { SPACING } from '@/constants/theme';

export default function PublicAcademyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-academy', slug],
    queryFn: () => publicApi.getAcademyProfile(String(slug)),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl }} color={COLORS.primary} />
      ) : error || !data ? (
        <EmptyState colors={COLORS} icon="school-outline" title={t('academyNotFound')} description="" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          <AppCard colors={COLORS}>
            <AppText variant="headlineMedium">{data.displayName}</AppText>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>
              {data.programName}
            </AppText>
            {data.publicBio ? (
              <AppText variant="bodyMedium" style={{ marginTop: SPACING.md }}>
                {data.publicBio}
              </AppText>
            ) : null}
            {data.contactEmail ? (
              <AppText variant="bodySmall" color={COLORS.textSecondary} style={{ marginTop: SPACING.md }}>
                {data.contactEmail}
              </AppText>
            ) : null}
          </AppCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
