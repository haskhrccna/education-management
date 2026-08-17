import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { apiClient } from '@/src/api';
import { AppText } from '@/src/components/AppText';
import { AppCard, Avatar, EmptyState, StatusPill } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { BottomNav } from '@/src/components/BottomNav';
import { useAuditLogs } from '@/src/hooks/useAuditLogs';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

interface ActorOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function AuditLogsScreen() {
  const { t } = useTranslation();
  // Non-string decisions only (icon direction, Intl locale) — matches the
  // house convention in academy-health.tsx. Deliberately not a local isAr
  // ternary variable: scripts/check-i18n.js ratchets those, and this value
  // never feeds a displayed string, so it would only add false-positive
  // debt to that gate.
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);
  const { rows, totalPages, isLoading, error, filters, setFilters, page, setPage, refresh } = useAuditLogs();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AC5.2 requires filtering by actor. useAuditLogs already plumbs `userId`
  // end-to-end (server, client, hook) — this is the missing UI control.
  // Admins pick a name/email rather than typing a raw user id.
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [actorQuery, setActorQuery] = useState('');
  const [selectedActor, setSelectedActor] = useState<ActorOption | null>(null);
  useEffect(() => {
    // Envelope is { data, meta }; res.data IS that envelope — one level, not two.
    apiClient
      .get('/admin/users?limit=100')
      .then((res) => setActors(res.data?.data ?? []))
      .catch(() => setActors([]));
  }, []);
  const actorMatches = useMemo(() => {
    const q = actorQuery.trim().toLowerCase();
    if (!q || selectedActor) return [];
    return actors
      .filter((a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [actors, actorQuery, selectedActor]);
  const pickActor = (a: ActorOption) => {
    setSelectedActor(a);
    setActorQuery('');
    setFilters({ ...filters, userId: a.id });
  };
  const clearActor = () => {
    setSelectedActor(null);
    setFilters({ ...filters, userId: undefined });
  };

  // Date filters live in the queryKey (useAuditLogs), so every setFilters call
  // fires a request. Committing every keystroke sent invalid partial dates to
  // the server (400 flash) or, worse, well-formed-but-wrong dates like
  // "2026-07-" -> 2026-06-30 that silently queried the wrong window. Raw text
  // is kept locally so typing never feels blocked; filters only receive a
  // value once it's empty (clearing) or a complete YYYY-MM-DD date.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const [dateFromText, setDateFromText] = useState('');
  const [dateToText, setDateToText] = useState('');
  const onDateFromChange = (v: string) => {
    setDateFromText(v);
    if (v === '' || DATE_RE.test(v)) setFilters({ ...filters, dateFrom: v || undefined });
  };
  const onDateToChange = (v: string) => {
    setDateToText(v);
    if (v === '' || DATE_RE.test(v)) setFilters({ ...filters, dateTo: v || undefined });
  };

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  const actorName = (row: (typeof rows)[number]) =>
    row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : t('auditLogUnknownActor');

  return (
    <SafeAreaView style={s.screen} edges={['top']} testID="admin-audit-logs.screen">
      <View style={s.appBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID="admin-audit-logs.back"
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.appBarText}>
          <AppText variant="titleLarge" style={{ color: COLORS.textPrimary }}>
            {t('auditLog')}
          </AppText>
          <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
            {t('auditLogSubtitle')}
          </AppText>
        </View>
      </View>

      <View style={s.filterCard}>
        {selectedActor ? (
          <View style={s.selectedActor}>
            <Avatar colors={COLORS} label={`${selectedActor.firstName} ${selectedActor.lastName}`} size={32} />
            <AppText variant="bodyMedium" style={{ color: COLORS.textPrimary, flex: 1 }} numberOfLines={1}>
              {`${selectedActor.firstName} ${selectedActor.lastName}`.trim()}
            </AppText>
            <TouchableOpacity
              onPress={clearActor}
              accessibilityRole="button"
              accessibilityLabel={t('auditLogClearFilters')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="admin-audit-logs.actor-clear"
            >
              <Ionicons name="close-circle" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <TextInput
              style={s.input}
              value={actorQuery}
              onChangeText={setActorQuery}
              placeholder={t('auditLogFilterActor')}
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              testID="admin-audit-logs.actor-input"
            />
            {actorMatches.length > 0 ? (
              <View style={s.actorDropdown}>
                {actorMatches.map((a, index) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => pickActor(a)}
                    accessibilityRole="button"
                    style={s.actorRow}
                    testID={`admin-audit-logs.actor-option.${index}`}
                  >
                    <Avatar colors={COLORS} label={`${a.firstName} ${a.lastName}`} size={28} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyMedium" style={{ color: COLORS.textPrimary }} numberOfLines={1}>
                        {`${a.firstName} ${a.lastName}`.trim()}
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }} numberOfLines={1}>
                        {a.email}
                      </AppText>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        )}
        <TextInput
          style={s.input}
          value={filters.action ?? ''}
          onChangeText={(v) => setFilters({ ...filters, action: v || undefined })}
          placeholder={t('auditLogFilterAction')}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
          testID="admin-audit-logs.filter-action"
        />
        <TextInput
          style={s.input}
          value={filters.resourceType ?? ''}
          onChangeText={(v) => setFilters({ ...filters, resourceType: v || undefined })}
          placeholder={t('auditLogFilterEntity')}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
          testID="admin-audit-logs.filter-entity"
        />
        <View style={s.dateRow}>
          <TextInput
            style={[s.input, s.dateInput]}
            value={dateFromText}
            onChangeText={onDateFromChange}
            placeholder={`${t('auditLogFilterFrom')} (YYYY-MM-DD)`}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            testID="admin-audit-logs.filter-date-from"
          />
          <TextInput
            style={[s.input, s.dateInput]}
            value={dateToText}
            onChangeText={onDateToChange}
            placeholder={`${t('auditLogFilterTo')} (YYYY-MM-DD)`}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            testID="admin-audit-logs.filter-date-to"
          />
        </View>
        {hasFilters ? (
          <TouchableOpacity
            onPress={() => {
              setSelectedActor(null);
              setDateFromText('');
              setDateToText('');
              setFilters({});
            }}
            accessibilityRole="button"
            style={s.clearBtn}
            testID="admin-audit-logs.clear-filters"
          >
            <AppText variant="labelLarge" style={{ color: COLORS.primary }}>
              {t('auditLogClearFilters')}
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={COLORS.primary} />}
      >
        {error ? (
          <TouchableOpacity
            onPress={refresh}
            style={s.errorBanner}
            accessibilityRole="button"
            testID="admin-audit-logs.retry"
          >
            <AppText variant="bodyMedium" style={{ color: COLORS.error, textAlign: 'center' }}>
              {t('auditLogLoadFailed')}
            </AppText>
          </TouchableOpacity>
        ) : null}

        {isLoading ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </>
        ) : rows.length === 0 ? (
          <View testID="admin-audit-logs.empty">
            <EmptyState colors={COLORS} icon="document-text-outline" title={t('auditLogEmpty')} />
          </View>
        ) : (
          rows.map((row, index) => {
            const expanded = expandedId === row.id;
            return (
              <TouchableOpacity
                key={row.id}
                activeOpacity={0.85}
                onPress={() => setExpandedId(expanded ? null : row.id)}
                accessibilityRole="button"
                testID={`admin-audit-logs.row.${index}`}
              >
                <AppCard colors={COLORS} style={s.row}>
                  <View style={s.rowTop}>
                    <AppText variant="titleMedium" style={{ color: COLORS.textPrimary, flex: 1 }} numberOfLines={1}>
                      {actorName(row)}
                    </AppText>
                    <StatusPill colors={COLORS} label={row.action} status="info" />
                  </View>
                  <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                    {row.resourceType}
                    {row.resourceId ? ` · ${row.resourceId}` : ''}
                  </AppText>
                  <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                    {new Date(row.createdAt).toLocaleString(isRTL ? 'ar' : 'en')}
                  </AppText>

                  {expanded ? (
                    <View style={s.detail}>
                      <AppText variant="labelLarge" style={{ color: COLORS.textSecondary }}>
                        {t('auditLogIpAddress')}
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: COLORS.textPrimary }}>
                        {row.ipAddress ?? '—'}
                      </AppText>
                      <AppText variant="labelLarge" style={{ color: COLORS.textSecondary }}>
                        {t('auditLogUserAgent')}
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: COLORS.textPrimary }}>
                        {row.userAgent ?? '—'}
                      </AppText>
                      <AppText variant="labelLarge" style={{ color: COLORS.textSecondary }}>
                        {t('auditLogDetails')}
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: COLORS.textPrimary }}>
                        {row.details ? JSON.stringify(row.details, null, 2) : '—'}
                      </AppText>
                    </View>
                  ) : null}
                </AppCard>
              </TouchableOpacity>
            );
          })
        )}

        {totalPages > 1 ? (
          <View style={s.pager}>
            <TouchableOpacity
              disabled={page <= 1}
              onPress={() => setPage(page - 1)}
              style={[s.pagerBtn, page <= 1 && s.pagerBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('auditLogPrev')}
              testID="admin-audit-logs.prev"
            >
              <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                {t('auditLogPrev')}
              </AppText>
            </TouchableOpacity>
            <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
              {t('auditLogPageOf', { page, total: totalPages })}
            </AppText>
            <TouchableOpacity
              disabled={page >= totalPages}
              onPress={() => setPage(page + 1)}
              style={[s.pagerBtn, page >= totalPages && s.pagerBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('auditLogNext')}
              testID="admin-audit-logs.next"
            >
              <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                {t('auditLogNext')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
      <BottomNav role="admin" active="none" />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    appBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
    appBarText: { flex: 1 },
    filterCard: {
      backgroundColor: COLORS.surface,
      marginHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
    input: {
      backgroundColor: COLORS.background,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      minHeight: 44,
      color: COLORS.textPrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
    selectedActor: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      minHeight: 44,
      backgroundColor: COLORS.primaryMuted,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
    },
    actorDropdown: {
      marginTop: SPACING.xs,
      borderRadius: RADIUS.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
      overflow: 'hidden',
    },
    actorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      minHeight: 44,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.borderSubtle,
      backgroundColor: COLORS.surface,
    },
    dateRow: { flexDirection: 'row', gap: SPACING.sm },
    dateInput: { flex: 1 },
    clearBtn: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
    row: { gap: 4 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    detail: {
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.borderSubtle,
      gap: 2,
    },
    errorBanner: {
      backgroundColor: COLORS.errorLight,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.md,
      gap: SPACING.sm,
    },
    pagerBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.md,
      minHeight: 44,
      paddingHorizontal: SPACING.md,
      justifyContent: 'center',
    },
    pagerBtnDisabled: { opacity: 0.4 },
  });
