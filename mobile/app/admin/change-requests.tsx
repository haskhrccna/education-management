import React, { useEffect, useState } from 'react';
import {
  FlatList,
  TouchableOpacity,
  Text,
  View,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeSettings } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';
import { BottomNav } from '@/src/components/BottomNav';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'DENIED';

const AVATAR_PALETTE = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#E91E63', '#00BCD4'];
function avatarColor(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}
function initials(first?: string, last?: string) {
  return `${(first?.[0] ?? '').toUpperCase()}${(last?.[0] ?? '').toUpperCase()}`;
}

export default function ChangeRequestsScreen() {
  const { theme, darkMode } = useThemeSettings();
  const COLORS = getColors(theme, darkMode);
  const { requests, isLoading, fetchRequests, decideRequest, fetchTeachers } = useTeacherChange();
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const pendingCount = requests.filter((r: any) => r.status === 'PENDING').length;
  const filtered = filter === 'ALL' ? requests : requests.filter((r: any) => r.status === filter);

  const handleDecide = async (id: string, action: 'APPROVE' | 'DENY', newTeacherId?: string) => {
    setDeciding(true);
    try {
      await decideRequest(id, action, adminNote.trim() || undefined, newTeacherId);
      setExpandedId(null);
      setAdminNote('');
    } catch {
      Alert.alert('خطأ', 'فشل معالجة الطلب');
    } finally {
      setDeciding(false);
    }
  };

  const openTeacherPicker = async (requestId: string) => {
    setTargetRequestId(requestId);
    if (teachers.length === 0) {
      const list = await fetchTeachers();
      setTeachers(list);
    }
    setShowTeacherModal(true);
  };

  const assignTeacher = (teacher: { id: string; firstName: string; lastName: string }) => {
    setShowTeacherModal(false);
    if (targetRequestId) {
      handleDecide(targetRequestId, 'APPROVE', teacher.id);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'PENDING') return '#f59e0b';
    if (status === 'APPROVED') return COLORS.primary;
    return '#ef4444';
  };

  const statusLabel = (status: string) => {
    if (status === 'PENDING') return 'معلق';
    if (status === 'APPROVED') return 'موافق';
    return 'مرفوض';
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'PENDING', label: `معلق (${pendingCount})` },
    { key: 'APPROVED', label: 'موافق' },
    { key: 'DENIED', label: 'مرفوض' },
    { key: 'ALL', label: 'الكل' },
  ];

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    appBar: {
      backgroundColor: COLORS.primary,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.sm,
      gap: SPACING.sm,
    },
    appBarTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
    badge: {
      backgroundColor: '#f59e0b',
      borderRadius: 99,
      minWidth: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    chips: { flexDirection: 'row', gap: SPACING.xs, padding: SPACING.sm, flexWrap: 'wrap' },
    chip: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 5,
      borderRadius: 99,
      borderWidth: 1.5,
      borderColor: COLORS.border ?? '#e5e7eb',
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 12, color: COLORS.textPrimary },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    list: { paddingBottom: SPACING.xl },
    card: {
      backgroundColor: COLORS.surface,
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.sm,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, gap: SPACING.sm },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    cardSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    cardReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    expanded: {
      padding: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: COLORS.borderSubtle,
      gap: SPACING.sm,
    },
    noteLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
    noteInput: {
      backgroundColor: COLORS.background,
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
      color: COLORS.textPrimary,
      fontSize: 14,
      minHeight: 64,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: COLORS.border ?? '#e5e7eb',
    },
    btnRow: { flexDirection: 'row', gap: SPACING.sm },
    btn: { flex: 1, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    assignBtn: {
      flex: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
    },
    approveBtn: { backgroundColor: '#10b981' },
    denyBtn: { backgroundColor: COLORS.error },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
    emptyText: { fontSize: 15, color: COLORS.textSecondary },
    // Teacher picker modal
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
      borderBottomWidth: 1,
      borderBottomColor: COLORS.borderSubtle,
    },
    modalTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
    teacherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      gap: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border ?? '#f0f0f0',
    },
    teacherName: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>طلبات تغيير المعلم</Text>
        {pendingCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {/* Filter chips */}
      <View style={s.chips}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.chip, filter === f.key && s.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={COLORS.primary} size="large" />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.textSecondary} />
          <Text style={s.emptyText}>لا توجد طلبات</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => {
            const isExpanded = expandedId === item.id;
            const name = `${item.student?.firstName ?? ''} ${item.student?.lastName ?? ''}`.trim();
            const teacherName = `${item.currentTeacher?.firstName ?? ''} ${item.currentTeacher?.lastName ?? ''}`.trim();
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => {
                  setExpandedId(isExpanded ? null : item.id);
                  setAdminNote('');
                }}
                activeOpacity={0.85}
              >
                <View style={s.cardHeader}>
                  <View style={[s.avatar, { backgroundColor: avatarColor(name) }]}>
                    <Text style={s.avatarText}>{initials(item.student?.firstName, item.student?.lastName)}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.cardName}>{name}</Text>
                    <Text style={s.cardSub}>المعلم الحالي: {teacherName}</Text>
                    <Text style={s.cardReason} numberOfLines={isExpanded ? undefined : 2}>
                      {item.reason}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={s.statusText}>{statusLabel(item.status)}</Text>
                  </View>
                </View>

                {isExpanded && item.status === 'PENDING' && (
                  <View style={s.expanded}>
                    <Text style={s.noteLabel}>ملاحظة الإدارة (اختياري)</Text>
                    <TextInput
                      style={s.noteInput}
                      value={adminNote}
                      onChangeText={setAdminNote}
                      placeholder="اكتب ملاحظة..."
                      placeholderTextColor={COLORS.textSecondary}
                      multiline
                      textAlign="right"
                    />
                    <View style={s.btnRow}>
                      <TouchableOpacity
                        style={[s.assignBtn, { flex: 2, opacity: deciding ? 0.5 : 1 }]}
                        onPress={() => openTeacherPicker(item.id)}
                        disabled={deciding}
                      >
                        <Ionicons name="person-add-outline" size={16} color="#fff" />
                        <Text style={[s.btnText, { marginStart: 4 }]}>تعيين معلم</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btn, s.denyBtn, { opacity: deciding ? 0.5 : 1 }]}
                        onPress={() => handleDecide(item.id, 'DENY')}
                        disabled={deciding}
                      >
                        <Text style={s.btnText}>رفض</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {isExpanded && item.status !== 'PENDING' && item.adminNote && (
                  <View style={s.expanded}>
                    <Text style={s.noteLabel}>ملاحظة الإدارة:</Text>
                    <Text style={{ color: COLORS.textPrimary }}>{item.adminNote}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Teacher picker bottom sheet */}
      <Modal
        visible={showTeacherModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeacherModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>اختر المعلم</Text>
              <TouchableOpacity onPress={() => setShowTeacherModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {teachers.map((t) => {
                const tName = `${t.firstName} ${t.lastName}`;
                return (
                  <TouchableOpacity key={t.id} style={s.teacherRow} onPress={() => assignTeacher(t)}>
                    <View
                      style={[
                        s.avatar,
                        { width: 38, height: 38, borderRadius: 19, backgroundColor: avatarColor(tName) },
                      ]}
                    >
                      <Text style={s.avatarText}>{initials(t.firstName, t.lastName)}</Text>
                    </View>
                    <Text style={s.teacherName}>{tName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav role="admin" active="requests" />
    </SafeAreaView>
  );
}
