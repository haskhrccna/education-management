import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRequiredParam } from '@/src/hooks/useRequiredParam';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/src/api';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/src/hooks/useTheme';
export default function UserDetailScreen() {
  const router = useRouter();
  const id = useRequiredParam('id');
  const { t, i18n } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);
  const [user, setUser] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', status: '', role: '' });

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/admin/users/${id}`);
      const data = res.data?.data;
      setUser(data.user);
      setAnalytics(data.analytics);
      setFormData({
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        status: data.user.status,
        role: data.user.role,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!id) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.textSecondary }}>{t('notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: COLORS.primary }}>{t('goBack')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.put(`/admin/users/${id}`, formData);
      setIsEditing(false);
      fetchUser();
      Alert.alert('Success', 'User updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      i18n.language === 'ar' ? 'حذف المستخدم' : 'Delete User',
      i18n.language === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('submit'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/admin/users/${id}`);
              Alert.alert('Success', 'User deleted');
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) return null;

  const isStudent = user.role === 'STUDENT';
  const isTeacher = user.role === 'TEACHER';
  const joinDate = new Date(user.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing
              ? i18n.language === 'ar'
                ? 'تعديل المستخدم'
                : 'Edit User'
              : user.firstName + ' ' + user.lastName}
          </Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editBtn}>
            <Ionicons name={isEditing ? 'close-outline' : 'create-outline'} size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.firstName[0]}</Text>
          </View>
          {isEditing ? (
            <View style={styles.editForm}>
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>{t('firstName')}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.firstName}
                    onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                    textAlign="right"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>{t('lastName')}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.lastName}
                    onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                    textAlign="right"
                  />
                </View>
              </View>
              <View style={styles.inputFull}>
                <Text style={styles.inputLabel}>{t('email')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  textAlign="right"
                  keyboardType="email-address"
                />
              </View>
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>{i18n.language === 'ar' ? 'الحالة' : 'Status'}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.status}
                    onChangeText={(text) => setFormData({ ...formData, status: text })}
                    textAlign="right"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>{i18n.language === 'ar' ? 'الدور' : 'Role'}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.role}
                    onChangeText={(text) => setFormData({ ...formData, role: text })}
                    textAlign="right"
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                <Text style={styles.saveBtnText}>{isSaving ? t('loading') : t('submit')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user.firstName} {user.lastName}
              </Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
              <View style={styles.profileMeta}>
                <View style={[styles.roleBadge, user.role === 'ADMIN' && styles.adminBadge]}>
                  <Text style={[styles.roleText, user.role === 'ADMIN' && styles.adminText]}>{user.role}</Text>
                </View>
                <View style={[styles.statusBadge, user.status === 'ACTIVE' && styles.activeBadge]}>
                  <Text style={[styles.statusText, user.status === 'ACTIVE' && styles.activeText]}>{user.status}</Text>
                </View>
              </View>
              {/* Joining Date */}
              <View style={styles.joinDateRow}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.joinDateLabel}>{i18n.language === 'ar' ? 'تاريخ الانضمام:' : 'Join Date:'}</Text>
                <Text style={styles.joinDateValue}>{joinDate}</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Student's Teachers */}
        {isStudent && analytics?.teachers && analytics.teachers.length > 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(100)} style={styles.relationsCard}>
            <Text style={styles.relationsTitle}>{i18n.language === 'ar' ? 'المعلمون' : 'Teachers'}</Text>
            {analytics.teachers.map((teacher: any) => (
              <View key={teacher.id} style={styles.relationItem}>
                <View style={styles.relationAvatar}>
                  <Text style={styles.relationAvatarText}>{teacher.firstName[0]}</Text>
                </View>
                <View style={styles.relationInfo}>
                  <Text style={styles.relationName}>
                    {teacher.firstName} {teacher.lastName}
                  </Text>
                  <Text style={styles.relationEmail}>{teacher.email}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Teacher's Students */}
        {isTeacher && analytics?.students && analytics.students.length > 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(100)} style={styles.relationsCard}>
            <Text style={styles.relationsTitle}>{i18n.language === 'ar' ? 'الطلاب' : 'Students'}</Text>
            {analytics.students.map((student: any) => (
              <View key={student.id} style={styles.relationItem}>
                <View style={styles.relationAvatar}>
                  <Text style={styles.relationAvatarText}>{student.firstName[0]}</Text>
                </View>
                <View style={styles.relationInfo}>
                  <Text style={styles.relationName}>
                    {student.firstName} {student.lastName}
                  </Text>
                  <Text style={styles.relationEmail}>{student.email}</Text>
                  <Text style={styles.relationDate}>
                    {i18n.language === 'ar' ? 'انضم:' : 'Joined:'}{' '}
                    {new Date(student.joinedAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
                  </Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Analytics */}
        {(isStudent || isTeacher) && analytics && (
          <Animated.View entering={FadeInUp.duration(400).delay(150)} style={styles.analyticsCard}>
            <Text style={styles.analyticsTitle}>
              {i18n.language === 'ar' ? 'التحليلات والإحصائيات' : 'Analytics & Statistics'}
            </Text>
            <View style={styles.analyticsGrid}>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>{analytics.totalAppointments}</Text>
                <Text style={styles.analyticsLabel}>{i18n.language === 'ar' ? 'المواعيد' : 'Appointments'}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>{analytics.acceptedAppointments}</Text>
                <Text style={styles.analyticsLabel}>{i18n.language === 'ar' ? 'مقبولة' : 'Accepted'}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>{analytics.totalGrades}</Text>
                <Text style={styles.analyticsLabel}>{i18n.language === 'ar' ? 'الدرجات' : 'Grades'}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>{analytics.averageGrade.toFixed(1)}</Text>
                <Text style={styles.analyticsLabel}>{i18n.language === 'ar' ? 'المتوسط' : 'Average'}</Text>
              </View>
            </View>
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsRowItem}>
                <Text style={styles.analyticsRowLabel}>{i18n.language === 'ar' ? 'الرسائل' : 'Messages'}</Text>
                <Text style={styles.analyticsRowValue}>{analytics.totalMessages}</Text>
              </View>
              <View style={styles.analyticsRowItem}>
                <Text style={styles.analyticsRowLabel}>{i18n.language === 'ar' ? 'آخر نشاط' : 'Last Active'}</Text>
                <Text style={styles.analyticsRowValue}>
                  {new Date(analytics.lastActive).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Activity Summary */}
        {(isStudent || isTeacher) && (
          <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.activityCard}>
            <Text style={styles.activityTitle}>{i18n.language === 'ar' ? 'ملخص النشاط' : 'Activity Summary'}</Text>
            <View style={styles.activityItem}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              <View style={styles.activityContent}>
                <Text style={styles.activityLabel}>{i18n.language === 'ar' ? 'آخر موعد' : 'Last Appointment'}</Text>
                <Text style={styles.activityValue}>
                  {analytics?.acceptedAppointments > 0
                    ? i18n.language === 'ar'
                      ? 'موجود'
                      : 'Available'
                    : i18n.language === 'ar'
                      ? 'لا يوجد'
                      : 'None'}
                </Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="bar-chart-outline" size={20} color={COLORS.primary} />
              <View style={styles.activityContent}>
                <Text style={styles.activityLabel}>
                  {i18n.language === 'ar' ? 'مستوى الأداء' : 'Performance Level'}
                </Text>
                <Text style={styles.activityValue}>
                  {analytics?.averageGrade > 80
                    ? i18n.language === 'ar'
                      ? 'ممتاز'
                      : 'Excellent'
                    : analytics?.averageGrade > 60
                      ? i18n.language === 'ar'
                        ? 'جيد'
                        : 'Good'
                      : i18n.language === 'ar'
                        ? 'يحتاج تحسين'
                        : 'Needs Improvement'}
                </Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={[styles.activityGlyph, { backgroundColor: COLORS.warningLight }]}>
                <Ionicons name="flame-outline" size={20} color={COLORS.warning} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityLabel}>{i18n.language === 'ar' ? 'معدل التفاعل' : 'Engagement Rate'}</Text>
                <Text style={styles.activityValue}>
                  {analytics?.totalMessages > 10
                    ? i18n.language === 'ar'
                      ? 'عالي'
                      : 'High'
                    : i18n.language === 'ar'
                      ? 'متوسط'
                      : 'Medium'}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Delete Button */}
        {!isEditing && (
          <Animated.View entering={FadeInUp.duration(400).delay(250)}>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              <Text style={styles.deleteText}>{i18n.language === 'ar' ? 'حذف المستخدم' : 'Delete User'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Header
    header: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.lg,
      borderBottomLeftRadius: RADIUS['2xl'],
      borderBottomRightRadius: RADIUS['2xl'],
      ...SHADOWS.lg,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    backText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#fff',
    },
    editBtn: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    editText: {
      color: '#fff',
      fontSize: 16,
    },

    // Content
    content: {
      flex: 1,
      paddingHorizontal: SPACING.xl,
    },
    list: {
      gap: SPACING.md,
      paddingVertical: SPACING.lg,
      paddingBottom: SPACING['3xl'],
    },

    // Profile Card
    profileCard: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS['2xl'],
      padding: SPACING['2xl'],
      alignItems: 'center',
      ...SHADOWS.md,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    avatarText: {
      fontSize: 28,
      fontWeight: '800',
      color: COLORS.primary,
    },
    profileInfo: {
      alignItems: 'center',
    },
    profileName: {
      fontSize: 22,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: SPACING.xs,
    },
    profileEmail: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginBottom: SPACING.md,
    },
    profileMeta: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    roleBadge: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.surfaceAlt,
    },
    adminBadge: {
      backgroundColor: COLORS.primaryMuted,
    },
    roleText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    adminText: {
      color: COLORS.primary,
    },
    statusBadge: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.warningLight,
    },
    activeBadge: {
      backgroundColor: COLORS.successLight,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.warning,
    },
    activeText: {
      color: COLORS.success,
    },
    joinDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginTop: SPACING.sm,
      backgroundColor: COLORS.background,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.md,
    },
    joinDateIcon: {
      fontSize: 14,
    },
    joinDateLabel: {
      fontSize: 13,
      color: COLORS.textSecondary,
    },
    joinDateValue: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.primary,
    },

    // Edit Form
    editForm: {
      width: '100%',
      gap: SPACING.md,
    },
    inputRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    inputHalf: {
      flex: 1,
    },
    inputFull: {
      width: '100%',
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginBottom: SPACING.xs,
      textAlign: 'right',
    },
    input: {
      backgroundColor: COLORS.background,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      fontSize: 15,
      color: COLORS.textPrimary,
      borderWidth: 1,
      borderColor: '#e7e5e4',
      textAlign: 'right',
    },
    saveBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
      marginTop: SPACING.sm,
      ...SHADOWS.md,
    },
    saveBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },

    // Relations Card (Teachers/Students)
    relationsCard: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS['2xl'],
      padding: SPACING['2xl'],
      ...SHADOWS.md,
    },
    relationsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: SPACING.lg,
      textAlign: 'right',
    },
    relationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
    },
    relationAvatar: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    relationAvatarText: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.primary,
    },
    relationInfo: {
      flex: 1,
    },
    relationName: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    relationEmail: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    relationDate: {
      fontSize: 12,
      color: COLORS.primary,
      fontWeight: '600',
      marginTop: 2,
    },

    // Analytics
    analyticsCard: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS['2xl'],
      padding: SPACING['2xl'],
      ...SHADOWS.md,
    },
    analyticsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: SPACING.lg,
      textAlign: 'right',
    },
    analyticsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.md,
    },
    analyticsItem: {
      width: '47%',
      backgroundColor: COLORS.background,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
    },
    analyticsValue: {
      fontSize: 24,
      fontWeight: '800',
      color: COLORS.primary,
      marginBottom: SPACING.xs,
    },
    analyticsLabel: {
      fontSize: 12,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    analyticsRow: {
      flexDirection: 'row',
      marginTop: SPACING.lg,
      paddingTop: SPACING.lg,
      borderTopWidth: 1,
      borderTopColor: '#e7e5e4',
      gap: SPACING.md,
    },
    analyticsRowItem: {
      flex: 1,
      alignItems: 'center',
    },
    analyticsRowLabel: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginBottom: SPACING.xs,
    },
    analyticsRowValue: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },

    // Activity
    activityCard: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS['2xl'],
      padding: SPACING['2xl'],
      ...SHADOWS.md,
    },
    activityTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: SPACING.lg,
      textAlign: 'right',
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
    },
    activityGlyph: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityIcon: {
      fontSize: 24,
    },
    activityContent: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    activityLabel: {
      fontSize: 14,
      color: COLORS.textSecondary,
    },
    activityValue: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.primary,
    },

    // Delete
    deleteBtn: {
      flexDirection: 'row',
      gap: SPACING.sm,
      backgroundColor: COLORS.errorLight,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.md,
      borderWidth: 1,
      borderColor: COLORS.error,
    },
    deleteText: {
      color: COLORS.error,
      fontSize: 16,
      fontWeight: '700',
    },
  });
