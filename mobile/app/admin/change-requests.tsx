import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, FlatList, TouchableOpacity, Text, View,
  TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'DENIED';

export default function ChangeRequestsScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { requests, isLoading, fetchRequests, decideRequest } = useTeacherChange();
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [deciding, setDeciding] = useState(false);

  useEffect(() => { fetchRequests(); }, []);

  const filtered = filter === 'ALL' ? requests : requests.filter((r: any) => r.status === filter);

  const handleDecide = async (id: string, action: 'APPROVE' | 'DENY') => {
    setDeciding(true);
    try {
      await decideRequest(id, action, adminNote.trim() || undefined);
      setExpandedId(null);
      setAdminNote('');
    } catch {
      Alert.alert('Error', 'Failed to process request');
    } finally {
      setDeciding(false);
    }
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'DENIED', label: 'Denied' },
  ];

  const statusColor = (status: string) => {
    if (status === 'PENDING') return '#f59e0b';
    if (status === 'APPROVED') return '#10b981';
    return '#ef4444';
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    backBtn: { marginRight: SPACING.sm, padding: 4 },
    backText: { fontSize: 20, color: COLORS.primary },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    chips: { flexDirection: 'row', gap: SPACING.xs, padding: SPACING.sm, flexWrap: 'wrap' },
    chip: { paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: 99, borderWidth: 1.5, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 12, color: COLORS.textPrimary },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    row: { backgroundColor: COLORS.surface, marginHorizontal: SPACING.sm, marginBottom: SPACING.xs, borderRadius: RADIUS.md, overflow: 'hidden' },
    rowHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.sm, gap: SPACING.sm },
    rowInfo: { flex: 1 },
    rowName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    rowSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    rowReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    expanded: { padding: SPACING.sm, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
    noteInput: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.sm, color: COLORS.textPrimary, fontSize: 14, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: '#e5e7eb', marginBottom: SPACING.sm },
    btnRow: { flexDirection: 'row', gap: SPACING.sm },
    approveBtn: { flex: 1, backgroundColor: '#10b981', borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center' },
    denyBtn: { flex: 1, backgroundColor: '#ef4444', borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
    emptyTitle: { fontSize: 16, color: COLORS.textSecondary },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('teacherChangeRequests')}</Text>
      </View>
      <View style={styles.chips}>
        {statusFilters.map((f) => (
          <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}><Text style={styles.emptyTitle}>{t('noChangeRequests')}</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isExpanded = expandedId === item.id;
            return (
              <TouchableOpacity style={styles.row} onPress={() => { setExpandedId(isExpanded ? null : item.id); setAdminNote(''); }} activeOpacity={0.8}>
                <View style={styles.rowHeader}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{item.student?.firstName} {item.student?.lastName}</Text>
                    <Text style={styles.rowSub}>→ {item.currentTeacher?.firstName} {item.currentTeacher?.lastName}</Text>
                    <Text style={styles.rowReason} numberOfLines={isExpanded ? undefined : 1}>{item.reason}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                {isExpanded && item.status === 'PENDING' && (
                  <View style={styles.expanded}>
                    <TextInput style={styles.noteInput} value={adminNote} onChangeText={setAdminNote} placeholder="Admin note (optional)" placeholderTextColor={COLORS.textSecondary} multiline />
                    <View style={styles.btnRow}>
                      <TouchableOpacity style={[styles.approveBtn, { opacity: deciding ? 0.5 : 1 }]} onPress={() => handleDecide(item.id, 'APPROVE')} disabled={deciding}>
                        <Text style={styles.btnText}>✓ Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.denyBtn, { opacity: deciding ? 0.5 : 1 }]} onPress={() => handleDecide(item.id, 'DENY')} disabled={deciding}>
                        <Text style={styles.btnText}>✗ Deny</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
