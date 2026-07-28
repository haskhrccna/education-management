import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { apiClient } from '@/src/api';
import { parentsApi, type ParentLink } from '@/src/api/parents';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';
import { AppText } from '@/src/components/AppText';
import { AppCard, Avatar, EmptyState, StatusPill } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { BottomNav } from '@/src/components/BottomNav';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

type ApprovalKind = 'TEACHER_CHANGE' | 'PARENT_LINK' | 'STUDENT_ACCOUNT';
type FilterKey = 'ALL' | ApprovalKind;

interface PendingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

interface ApprovalRow {
  id: string;
  kind: ApprovalKind;
  title: string;
  subtitle: string;
  /** Teacher-change and parent-link only — the free-text reason given. */
  reason?: string;
}

export default function ApprovalsScreen() {
  const { t } = useTranslation();
  // Non-string decisions only (icon direction) — matches the house
  // convention in audit-logs.tsx. Deliberately not a local isAr ternary
  // variable: scripts/check-i18n.js ratchets those, and this value never
  // feeds a displayed string, so it would only add false-positive debt to
  // that gate.
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);

  const { requests, isLoading: loadingChanges, fetchRequests, decideRequest, fetchTeachers } = useTeacherChange();
  const [links, setLinks] = useState<ParentLink[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingRest, setLoadingRest] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);

  const loadRest = useCallback(async () => {
    setLoadingRest(true);
    try {
      // listLinks returns every link for an admin — the service applies no
      // status filter — so PENDING is selected here.
      const [allLinks, usersRes] = await Promise.all([parentsApi.listLinks(), apiClient.get('/admin/users')]);
      setLinks(allLinks.filter((l) => l.status === 'PENDING'));
      // Envelope is { data, meta }; res.data IS that envelope.
      const rows: PendingUser[] = usersRes.data?.data ?? [];
      setPendingUsers(rows.filter((u) => u.status === 'PENDING' && u.role === 'STUDENT'));
    } finally {
      setLoadingRest(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    loadRest();
  }, [loadRest]);

  const isLoading = loadingChanges || loadingRest;

  const rows: ApprovalRow[] = useMemo(() => {
    const changeRows: ApprovalRow[] = requests
      .filter((r: any) => r.status === 'PENDING')
      .map((r: any) => ({
        id: r.id,
        kind: 'TEACHER_CHANGE' as const,
        title: `${r.student?.firstName ?? ''} ${r.student?.lastName ?? ''}`.trim(),
        subtitle: `${r.currentTeacher?.firstName ?? ''} ${r.currentTeacher?.lastName ?? ''}`.trim(),
        reason: r.reason ?? undefined,
      }));
    const linkRows: ApprovalRow[] = links.map((l) => ({
      id: l.id,
      kind: 'PARENT_LINK' as const,
      title: `${l.parent?.firstName ?? ''} ${l.parent?.lastName ?? ''}`.trim() || l.parentId,
      subtitle: `${t('approvalsParentLinkSub')} ${`${l.student?.firstName ?? ''} ${l.student?.lastName ?? ''}`.trim()}`,
      reason: l.reason ?? undefined,
    }));
    const userRows: ApprovalRow[] = pendingUsers.map((u) => ({
      id: u.id,
      kind: 'STUDENT_ACCOUNT' as const,
      title: `${u.firstName} ${u.lastName}`.trim(),
      subtitle: t('approvalsStudentAccountSub'),
    }));
    const all = [...changeRows, ...linkRows, ...userRows];
    return filter === 'ALL' ? all : all.filter((r) => r.kind === filter);
  }, [requests, links, pendingUsers, filter, t]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchRequests(), loadRest()]);
  }, [fetchRequests, loadRest]);

  const finish = async () => {
    setExpandedId(null);
    setAdminNote('');
    await refreshAll();
  };

  const decideTeacherChange = async (id: string, action: 'APPROVE' | 'DENY', newTeacherId?: string) => {
    setDeciding(true);
    try {
      await decideRequest(id, action, adminNote.trim() || undefined, newTeacherId);
      await finish();
    } catch {
      Alert.alert(t('error'), t('approvalsDecideFailed'));
    } finally {
      setDeciding(false);
    }
  };

  const decideParentLink = async (id: string, action: 'APPROVE' | 'DENY') => {
    setDeciding(true);
    try {
      await parentsApi.decideLink(id, action, adminNote.trim() || undefined);
      await finish();
    } catch {
      Alert.alert(t('error'), t('approvalsDecideFailed'));
    } finally {
      setDeciding(false);
    }
  };

  const approveStudentAccount = async (id: string) => {
    setDeciding(true);
    try {
      await apiClient.put(`/admin/users/${id}/approve`);
      await finish();
    } catch {
      Alert.alert(t('error'), t('approvalsDecideFailed'));
    } finally {
      setDeciding(false);
    }
  };

  const openTeacherPicker = async (requestId: string) => {
    setTargetRequestId(requestId);
    if (teachers.length === 0) setTeachers(await fetchTeachers());
    setShowTeacherModal(true);
  };

  const filters: { key: FilterKey; labelKey: string }[] = [
    { key: 'ALL', labelKey: 'approvalsFilterAll' },
    { key: 'TEACHER_CHANGE', labelKey: 'approvalsFilterTeacherChange' },
    { key: 'PARENT_LINK', labelKey: 'approvalsFilterParentLink' },
    { key: 'STUDENT_ACCOUNT', labelKey: 'approvalsFilterStudentAccount' },
  ];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.appBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <AppText variant="titleLarge" style={{ color: COLORS.textPrimary, flex: 1 }}>
          {t('approvalsTitle')}
        </AppText>
      </View>

      <View style={s.chips}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            accessibilityRole="button"
            style={[s.chip, filter === f.key && s.chipActive]}
          >
            <AppText
              variant="labelLarge"
              style={{ color: filter === f.key ? COLORS.textOnPrimary : COLORS.textPrimary }}
            >
              {t(f.labelKey)}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshAll} tintColor={COLORS.primary} />}
      >
        {isLoading ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </>
        ) : rows.length === 0 ? (
          <EmptyState colors={COLORS} icon="checkmark-circle-outline" title={t('approvalsEmpty')} />
        ) : (
          rows.map((row) => {
            const expanded = expandedId === `${row.kind}:${row.id}`;
            return (
              <TouchableOpacity
                key={`${row.kind}:${row.id}`}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={() => {
                  setExpandedId(expanded ? null : `${row.kind}:${row.id}`);
                  setAdminNote('');
                }}
              >
                <AppCard colors={COLORS} style={s.card}>
                  <View style={s.cardTop}>
                    <Avatar colors={COLORS} label={row.title} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="titleMedium" style={{ color: COLORS.textPrimary }}>
                        {row.title}
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }} numberOfLines={2}>
                        {row.subtitle}
                      </AppText>
                    </View>
                    <StatusPill
                      colors={COLORS}
                      label={t(
                        row.kind === 'TEACHER_CHANGE'
                          ? 'approvalsFilterTeacherChange'
                          : row.kind === 'PARENT_LINK'
                            ? 'approvalsFilterParentLink'
                            : 'approvalsFilterStudentAccount'
                      )}
                      status={row.kind === 'TEACHER_CHANGE' ? 'warning' : 'info'}
                    />
                  </View>

                  {expanded ? (
                    <View style={s.expanded}>
                      {row.reason ? (
                        <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                          {row.reason}
                        </AppText>
                      ) : null}
                      {row.kind !== 'STUDENT_ACCOUNT' ? (
                        <>
                          <AppText variant="labelLarge" style={{ color: COLORS.textSecondary }}>
                            {t('approvalsNoteLabel')}
                          </AppText>
                          <TextInput
                            style={s.noteInput}
                            value={adminNote}
                            onChangeText={setAdminNote}
                            placeholder={t('approvalsNotePlaceholder')}
                            placeholderTextColor={COLORS.textSecondary}
                            multiline
                          />
                        </>
                      ) : null}

                      {row.kind === 'TEACHER_CHANGE' ? (
                        // Approving a teacher change REQUIRES choosing the new
                        // teacher — it reassigns appointments. Never a bare Approve.
                        <View style={s.btnRow}>
                          <TouchableOpacity
                            style={[s.btn, s.primaryBtn, { flex: 2 }, deciding && s.btnDisabled]}
                            disabled={deciding}
                            accessibilityRole="button"
                            onPress={() => openTeacherPicker(row.id)}
                          >
                            <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                              {t('approvalsAssignTeacher')}
                            </AppText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.btn, s.denyBtn, deciding && s.btnDisabled]}
                            disabled={deciding}
                            accessibilityRole="button"
                            onPress={() => decideTeacherChange(row.id, 'DENY')}
                          >
                            <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                              {t('approvalsDeny')}
                            </AppText>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={s.btnRow}>
                          <TouchableOpacity
                            style={[s.btn, s.approveBtn, deciding && s.btnDisabled]}
                            disabled={deciding}
                            accessibilityRole="button"
                            onPress={() =>
                              row.kind === 'PARENT_LINK'
                                ? decideParentLink(row.id, 'APPROVE')
                                : approveStudentAccount(row.id)
                            }
                          >
                            <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                              {t('approvalsApprove')}
                            </AppText>
                          </TouchableOpacity>
                          {row.kind === 'PARENT_LINK' ? (
                            <TouchableOpacity
                              style={[s.btn, s.denyBtn, deciding && s.btnDisabled]}
                              disabled={deciding}
                              accessibilityRole="button"
                              onPress={() => decideParentLink(row.id, 'DENY')}
                            >
                              <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                                {t('approvalsDeny')}
                              </AppText>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      )}
                    </View>
                  ) : null}
                </AppCard>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showTeacherModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeacherModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <AppText variant="titleMedium" style={{ flex: 1, color: COLORS.textPrimary }}>
                {t('approvalsAssignTeacher')}
              </AppText>
              <TouchableOpacity onPress={() => setShowTeacherModal(false)} accessibilityRole="button">
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {teachers.map((tc) => (
                <TouchableOpacity
                  key={tc.id}
                  style={s.teacherRow}
                  accessibilityRole="button"
                  onPress={() => {
                    setShowTeacherModal(false);
                    if (targetRequestId) decideTeacherChange(targetRequestId, 'APPROVE', tc.id);
                  }}
                >
                  <Avatar colors={COLORS} label={`${tc.firstName} ${tc.lastName}`} size={38} />
                  <AppText variant="bodyMedium" style={{ color: COLORS.textPrimary }}>
                    {`${tc.firstName} ${tc.lastName}`}
                  </AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav role="admin" active="requests" />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    appBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, paddingHorizontal: SPACING.md },
    chip: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
      borderRadius: 99,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
    card: { gap: SPACING.sm },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    expanded: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.borderSubtle,
      paddingTop: SPACING.sm,
      gap: SPACING.sm,
    },
    noteInput: {
      backgroundColor: COLORS.background,
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
      minHeight: 64,
      textAlignVertical: 'top',
      color: COLORS.textPrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
    btnRow: { flexDirection: 'row', gap: SPACING.sm },
    btn: { flex: 1, minHeight: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    btnDisabled: { opacity: 0.5 },
    primaryBtn: { backgroundColor: COLORS.primary },
    approveBtn: { backgroundColor: COLORS.success },
    denyBtn: { backgroundColor: COLORS.error },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: COLORS.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '75%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.borderSubtle,
    },
    teacherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      minHeight: 44,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.borderSubtle,
    },
  });
