import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/constants/theme';

type ThemeOption = 'green' | 'blue' | 'purple' | 'dark';
type FontSizeOption = 'small' | 'medium' | 'large';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>('green');
  const [selectedFontSize, setSelectedFontSize] = useState<FontSizeOption>('medium');
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [compactView, setCompactView] = useState(false);

  const themes: { key: ThemeOption; label: string; color: string }[] = [
    { key: 'green', label: i18n.language === 'ar' ? 'أخضر' : 'Green', color: '#047857' },
    { key: 'blue', label: i18n.language === 'ar' ? 'أزرق' : 'Blue', color: '#2563eb' },
    { key: 'purple', label: i18n.language === 'ar' ? 'بنفسجي' : 'Purple', color: '#7c3aed' },
    { key: 'dark', label: i18n.language === 'ar' ? 'داكن' : 'Dark', color: '#1c1917' },
  ];

  const fontSizes: { key: FontSizeOption; label: string; size: number }[] = [
    { key: 'small', label: i18n.language === 'ar' ? 'صغير' : 'Small', size: 14 },
    { key: 'medium', label: i18n.language === 'ar' ? 'متوسط' : 'Medium', size: 16 },
    { key: 'large', label: i18n.language === 'ar' ? 'كبير' : 'Large', size: 18 },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {i18n.language === 'ar' ? 'إعدادات المشرف' : 'Admin Settings'}
          </Text>
          <View style={styles.backBtn} />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {/* Theme Selection */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {i18n.language === 'ar' ? '🎨 المظهر والألوان' : '🎨 Theme & Colors'}
          </Text>
          <Text style={styles.sectionDesc}>
            {i18n.language === 'ar' ? 'اختر لون التطبيق المفضل' : 'Choose your preferred app color'}
          </Text>
          <View style={styles.themeGrid}>
            {themes.map((theme) => (
              <TouchableOpacity
                key={theme.key}
                style={[
                  styles.themeOption,
                  selectedTheme === theme.key && styles.themeOptionActive,
                ]}
                onPress={() => setSelectedTheme(theme.key)}
              >
                <View style={[styles.themeColor, { backgroundColor: theme.color }]} />
                <Text style={[
                  styles.themeLabel,
                  selectedTheme === theme.key && styles.themeLabelActive,
                ]}>
                  {theme.label}
                </Text>
                {selectedTheme === theme.key && (
                  <View style={styles.themeCheck}>
                    <Text style={styles.themeCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Font Size */}
        <Animated.View entering={FadeInUp.duration(400).delay(100)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {i18n.language === 'ar' ? '🔤 حجم الخط' : '🔤 Font Size'}
          </Text>
          <View style={styles.fontSizeRow}>
            {fontSizes.map((fs) => (
              <TouchableOpacity
                key={fs.key}
                style={[
                  styles.fontSizeOption,
                  selectedFontSize === fs.key && styles.fontSizeOptionActive,
                ]}
                onPress={() => setSelectedFontSize(fs.key)}
              >
                <Text style={[
                  styles.fontSizeSample,
                  { fontSize: fs.size },
                  selectedFontSize === fs.key && styles.fontSizeSampleActive,
                ]}>
                  أب
                </Text>
                <Text style={[
                  styles.fontSizeLabel,
                  selectedFontSize === fs.key && styles.fontSizeLabelActive,
                ]}>
                  {fs.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Toggle Options */}
        <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {i18n.language === 'ar' ? '⚙️ الخيارات العامة' : '⚙️ General Options'}
          </Text>

          <View style={styles.toggleItem}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>
                {i18n.language === 'ar' ? 'الوضع الليلي' : 'Dark Mode'}
              </Text>
              <Text style={styles.toggleDesc}>
                {i18n.language === 'ar' ? 'تفعيل المظهر الداكن' : 'Enable dark theme'}
              </Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
              thumbColor={darkMode ? '#fff' : '#fff'}
            />
          </View>

          <View style={styles.toggleItem}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>
                {i18n.language === 'ar' ? 'الإشعارات' : 'Notifications'}
              </Text>
              <Text style={styles.toggleDesc}>
                {i18n.language === 'ar' ? 'تلقي إشعارات النظام' : 'Receive system notifications'}
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
              thumbColor={notifications ? '#fff' : '#fff'}
            />
          </View>

          <View style={styles.toggleItem}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>
                {i18n.language === 'ar' ? 'عرض مضغوط' : 'Compact View'}
              </Text>
              <Text style={styles.toggleDesc}>
                {i18n.language === 'ar' ? 'تقليل المسافات في القوائم' : 'Reduce spacing in lists'}
              </Text>
            </View>
            <Switch
              value={compactView}
              onValueChange={setCompactView}
              trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
              thumbColor={compactView ? '#fff' : '#fff'}
            />
          </View>
        </Animated.View>

        {/* Language */}
        <Animated.View entering={FadeInUp.duration(400).delay(300)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {i18n.language === 'ar' ? '🌐 اللغة' : '🌐 Language'}
          </Text>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langBtn, i18n.language === 'ar' && styles.langBtnActive]}
              onPress={() => i18n.changeLanguage('ar')}
            >
              <Text style={[styles.langText, i18n.language === 'ar' && styles.langTextActive]}>العربية</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, i18n.language === 'en' && styles.langBtnActive]}
              onPress={() => i18n.changeLanguage('en')}
            >
              <Text style={[styles.langText, i18n.language === 'en' && styles.langTextActive]}>English</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Save Button */}
        <Animated.View entering={FadeInUp.duration(400).delay(400)}>
          <TouchableOpacity style={styles.saveBtn} onPress={() => router.back()}>
            <Text style={styles.saveBtnText}>
              {i18n.language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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

  // Content
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  list: {
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING['4xl'],
  },

  // Section Card
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    ...SHADOWS.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    textAlign: 'right',
  },
  sectionDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'right',
  },

  // Theme Grid
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  themeOption: {
    width: '47%',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionActive: {
    borderColor: COLORS.primary,
  },
  themeColor: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  themeLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  themeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeCheckText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Font Size
  fontSizeRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  fontSizeOption: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fontSizeOptionActive: {
    borderColor: COLORS.primary,
  },
  fontSizeSample: {
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  fontSizeSampleActive: {
    color: COLORS.primary,
  },
  fontSizeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  fontSizeLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Toggle
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  toggleInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  toggleDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Language
  langRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  langBtn: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  langBtnActive: {
    borderColor: COLORS.primary,
  },
  langText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  langTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Save
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOWS.md,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
