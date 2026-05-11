import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore, ThemeColor, FontSize } from '@/src/settings/store';
import { getColors, FONT_SCALE, SPACING_SCALE } from '@/constants/theme';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const settings = useSettingsStore();
  const COLORS = getColors(settings.theme, settings.darkMode);
  const fontScale = FONT_SCALE[settings.fontSize];
  const spacingScale = settings.compactView ? SPACING_SCALE.compact : SPACING_SCALE.normal;

  const themes: { key: ThemeColor; label: string }[] = [
    { key: 'green', label: i18n.language === 'ar' ? 'أخضر' : 'Green' },
    { key: 'blue', label: i18n.language === 'ar' ? 'أزرق' : 'Blue' },
    { key: 'purple', label: i18n.language === 'ar' ? 'بنفسجي' : 'Purple' },
    { key: 'dark', label: i18n.language === 'ar' ? 'داكن' : 'Dark' },
  ];

  const fontSizes: { key: FontSize; label: string }[] = [
    { key: 'small', label: i18n.language === 'ar' ? 'صغير' : 'Small' },
    { key: 'medium', label: i18n.language === 'ar' ? 'متوسط' : 'Medium' },
    { key: 'large', label: i18n.language === 'ar' ? 'كبير' : 'Large' },
  ];

  const getThemeColor = (key: ThemeColor) => {
    switch (key) {
      case 'green':
        return '#047857';
      case 'blue':
        return '#2563eb';
      case 'purple':
        return '#7c3aed';
      case 'dark':
        return '#1c1917';
    }
  };

  const dynamicStyles = createStyles(COLORS, fontScale, spacingScale);

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={dynamicStyles.backBtn}>
            <Text style={dynamicStyles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={[dynamicStyles.headerTitle, { fontSize: 18 * fontScale }]}>
            {i18n.language === 'ar' ? 'إعدادات المشرف' : 'Admin Settings'}
          </Text>
          <View style={dynamicStyles.backBtn} />
        </View>
      </View>

      <ScrollView
        style={dynamicStyles.content}
        contentContainerStyle={dynamicStyles.list}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme Selection */}
        <Animated.View entering={FadeInUp.duration(400)} style={dynamicStyles.sectionCard}>
          <Text style={[dynamicStyles.sectionTitle, { fontSize: 16 * fontScale }]}>
            {i18n.language === 'ar' ? '🎨 المظهر والألوان' : '🎨 Theme & Colors'}
          </Text>
          <Text style={[dynamicStyles.sectionDesc, { fontSize: 13 * fontScale }]}>
            {i18n.language === 'ar' ? 'اختر لون التطبيق المفضل' : 'Choose your preferred app color'}
          </Text>
          <View style={dynamicStyles.themeGrid}>
            {themes.map((theme) => (
              <TouchableOpacity
                key={theme.key}
                style={[
                  dynamicStyles.themeOption,
                  settings.theme === theme.key && { borderColor: COLORS.primary, borderWidth: 2 },
                ]}
                onPress={() => settings.setTheme(theme.key)}
              >
                <View style={[dynamicStyles.themeColor, { backgroundColor: getThemeColor(theme.key) }]} />
                <Text
                  style={[
                    dynamicStyles.themeLabel,
                    settings.theme === theme.key && { color: COLORS.primary, fontWeight: '700' },
                  ]}
                >
                  {theme.label}
                </Text>
                {settings.theme === theme.key && (
                  <View style={[dynamicStyles.themeCheck, { backgroundColor: COLORS.primary }]}>
                    <Text style={dynamicStyles.themeCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Font Size */}
        <Animated.View entering={FadeInUp.duration(400).delay(100)} style={dynamicStyles.sectionCard}>
          <Text style={[dynamicStyles.sectionTitle, { fontSize: 16 * fontScale }]}>
            {i18n.language === 'ar' ? '🔤 حجم الخط' : '🔤 Font Size'}
          </Text>
          <View style={dynamicStyles.fontSizeRow}>
            {fontSizes.map((fs) => (
              <TouchableOpacity
                key={fs.key}
                style={[
                  dynamicStyles.fontSizeOption,
                  settings.fontSize === fs.key && { borderColor: COLORS.primary, borderWidth: 2 },
                ]}
                onPress={() => settings.setFontSize(fs.key)}
              >
                <Text
                  style={[
                    dynamicStyles.fontSizeSample,
                    { fontSize: 16 * FONT_SCALE[fs.key] },
                    settings.fontSize === fs.key && { color: COLORS.primary },
                  ]}
                >
                  أب
                </Text>
                <Text
                  style={[
                    dynamicStyles.fontSizeLabel,
                    settings.fontSize === fs.key && { color: COLORS.primary, fontWeight: '700' },
                  ]}
                >
                  {fs.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Toggle Options */}
        <Animated.View entering={FadeInUp.duration(400).delay(200)} style={dynamicStyles.sectionCard}>
          <Text style={[dynamicStyles.sectionTitle, { fontSize: 16 * fontScale }]}>
            {i18n.language === 'ar' ? 'الخيارات العامة' : 'General Options'}
          </Text>

          <View style={dynamicStyles.toggleItem}>
            <View style={dynamicStyles.toggleInfo}>
              <Text style={[dynamicStyles.toggleLabel, { fontSize: 15 * fontScale }]}>
                {i18n.language === 'ar' ? 'الوضع الليلي' : 'Dark Mode'}
              </Text>
              <Text style={[dynamicStyles.toggleDesc, { fontSize: 12 * fontScale }]}>
                {i18n.language === 'ar' ? 'تفعيل المظهر الداكن' : 'Enable dark theme'}
              </Text>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={(v) => settings.setDarkMode(v)}
              trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
              thumbColor={settings.darkMode ? '#fff' : '#fff'}
            />
          </View>

          <View style={dynamicStyles.toggleItem}>
            <View style={dynamicStyles.toggleInfo}>
              <Text style={[dynamicStyles.toggleLabel, { fontSize: 15 * fontScale }]}>
                {i18n.language === 'ar' ? 'الإشعارات' : 'Notifications'}
              </Text>
              <Text style={[dynamicStyles.toggleDesc, { fontSize: 12 * fontScale }]}>
                {i18n.language === 'ar' ? 'تلقي إشعارات النظام' : 'Receive system notifications'}
              </Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(v) => settings.setNotifications(v)}
              trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
              thumbColor={settings.notifications ? '#fff' : '#fff'}
            />
          </View>

          <View style={dynamicStyles.toggleItem}>
            <View style={dynamicStyles.toggleInfo}>
              <Text style={[dynamicStyles.toggleLabel, { fontSize: 15 * fontScale }]}>
                {i18n.language === 'ar' ? 'عرض مضغوط' : 'Compact View'}
              </Text>
              <Text style={[dynamicStyles.toggleDesc, { fontSize: 12 * fontScale }]}>
                {i18n.language === 'ar' ? 'تقليل المسافات في القوائم' : 'Reduce spacing in lists'}
              </Text>
            </View>
            <Switch
              value={settings.compactView}
              onValueChange={(v) => settings.setCompactView(v)}
              trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
              thumbColor={settings.compactView ? '#fff' : '#fff'}
            />
          </View>
        </Animated.View>

        {/* Language */}
        <Animated.View entering={FadeInUp.duration(400).delay(300)} style={dynamicStyles.sectionCard}>
          <Text style={[dynamicStyles.sectionTitle, { fontSize: 16 * fontScale }]}>
            {i18n.language === 'ar' ? '🌐 اللغة' : '🌐 Language'}
          </Text>
          <View style={dynamicStyles.langRow}>
            <TouchableOpacity
              style={[dynamicStyles.langBtn, i18n.language === 'ar' && { borderColor: COLORS.primary, borderWidth: 2 }]}
              onPress={() => i18n.changeLanguage('ar')}
            >
              <Text
                style={[dynamicStyles.langText, i18n.language === 'ar' && { color: COLORS.primary, fontWeight: '700' }]}
              >
                العربية
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.langBtn, i18n.language === 'en' && { borderColor: COLORS.primary, borderWidth: 2 }]}
              onPress={() => i18n.changeLanguage('en')}
            >
              <Text
                style={[dynamicStyles.langText, i18n.language === 'en' && { color: COLORS.primary, fontWeight: '700' }]}
              >
                English
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Save Button */}
        <Animated.View entering={FadeInUp.duration(400).delay(400)}>
          <TouchableOpacity
            style={[dynamicStyles.saveBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => router.back()}
          >
            <Text style={dynamicStyles.saveBtnText}>{i18n.language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(COLORS: any, fontScale: number, spacingScale: number) {
  const s = (val: number) => val * spacingScale;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: s(20),
      paddingTop: s(16),
      paddingBottom: s(16),
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 9999,
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
      fontWeight: '800',
      color: '#fff',
    },
    content: {
      flex: 1,
      paddingHorizontal: s(20),
    },
    list: {
      gap: s(12),
      paddingVertical: s(16),
      paddingBottom: s(40),
    },
    sectionCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 24,
      padding: s(24),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 3,
    },
    sectionTitle: {
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 4,
      textAlign: 'right',
    },
    sectionDesc: {
      color: COLORS.textSecondary,
      marginBottom: s(16),
      textAlign: 'right',
    },
    themeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: s(12),
    },
    themeOption: {
      width: '47%',
      backgroundColor: COLORS.background,
      borderRadius: 16,
      padding: s(16),
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    themeColor: {
      width: 40,
      height: 40,
      borderRadius: 9999,
      marginBottom: s(8),
    },
    themeLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    themeCheck: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 9999,
      justifyContent: 'center',
      alignItems: 'center',
    },
    themeCheckText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    fontSizeRow: {
      flexDirection: 'row',
      gap: s(12),
    },
    fontSizeOption: {
      flex: 1,
      backgroundColor: COLORS.background,
      borderRadius: 16,
      padding: s(16),
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    fontSizeSample: {
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    fontSizeLabel: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    toggleItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: s(12),
      borderBottomWidth: 1,
      borderBottomColor: COLORS.darkMode ? '#334155' : '#f1f5f9',
    },
    toggleInfo: {
      flex: 1,
      alignItems: 'flex-end',
    },
    toggleLabel: {
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    toggleDesc: {
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    langRow: {
      flexDirection: 'row',
      gap: s(12),
    },
    langBtn: {
      flex: 1,
      backgroundColor: COLORS.background,
      borderRadius: 16,
      padding: s(16),
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    langText: {
      fontSize: 15,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    saveBtn: {
      borderRadius: 16,
      padding: s(16),
      alignItems: 'center',
      marginTop: s(12),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 3,
    },
    saveBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
