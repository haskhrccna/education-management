# UI Design Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 critical/high UI issues found in the design audit: Cairo font, settings wiring, forceRTL reload, color token consolidation, and i18n/a11y sweep.

**Architecture:** Build an `<AppText>` primitive that bakes in Cairo, TYPOGRAPHY tokens, and RTL direction — then wire it through the design system. Add a SettingsContext for font/spacing scale. Fix forceRTL at startup. Add semantic grade/border tokens to theme. Sweep the three dashboard screens' inline i18n ternaries into proper `t()` calls and patch touch targets.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Zustand, i18next, expo-font, I18nManager

## Global Constraints

- Arabic RTL is the primary language; every `Text` that renders user-facing strings must have correct `writingDirection` and `textAlign` based on locale — use `useIsRTL()` from `mobile/src/i18n/useIsRTL.ts`.
- Font family: `FONTS.arabic = 'Cairo'` (already loaded via `useFonts` in `_layout.tsx`).
- Token source of truth: `mobile/constants/theme.ts` — no new hardcoded hex values.
- TYPOGRAPHY scale (from `theme.ts`): headlineLarge 28, headlineMedium 24, headlineSmall 20, titleLarge 18, titleMedium 16, titleSmall 14, bodyLarge 16, bodyMedium 14, bodySmall 12, labelLarge 14.
- `FONT_SCALE`: small 0.85, medium 1.0, large 1.15 — exported from `mobile/constants/theme.ts`.
- `SPACING_SCALE`: normal 1.0, compact 0.7 — exported from `mobile/constants/theme.ts`.
- Minimum touch target: 44×44 px — all interactive elements must meet this.
- i18n: every user-facing string must use `t('key')` from i18next; both `ar` and `en` keys required in `mobile/src/i18n/index.ts`.
- No new npm dependencies.
- TypeScript must compile clean: `cd mobile && npx tsc --noEmit`.
- Repo root server tests must stay green: `npm run test:server`.

---

### Task 1: AppText primitive + Cairo font wiring

**Files:**
- Create: `mobile/src/components/AppText.tsx`
- Modify: `mobile/constants/theme.ts` lines 188–199 — add `fontFamily: 'Cairo'` to every TYPOGRAPHY entry
- Modify: `mobile/src/components/design.tsx` — import AppText, replace bare `Text` in Avatar, MetricTile, SectionHeader, StatusPill, EmptyState

**Interfaces:**
- Produces `AppText` with props:
  ```ts
  interface AppTextProps {
    variant?: keyof typeof TYPOGRAPHY; // default 'bodyMedium'
    color?: string;
    style?: StyleProp<TextStyle>;
    children?: React.ReactNode;
    numberOfLines?: number;
    accessibilityLabel?: string;
  }
  ```

- [ ] **Step 1: Add fontFamily to TYPOGRAPHY in theme.ts**

  Replace lines 188–199 of `mobile/constants/theme.ts`:
  ```ts
  export const TYPOGRAPHY = {
    headlineLarge: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36, fontFamily: 'Cairo' },
    headlineMedium: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32, fontFamily: 'Cairo' },
    headlineSmall: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28, fontFamily: 'Cairo' },
    titleLarge:    { fontSize: 18, fontWeight: '600' as const, lineHeight: 26, fontFamily: 'Cairo' },
    titleMedium:   { fontSize: 16, fontWeight: '500' as const, lineHeight: 24, fontFamily: 'Cairo' },
    titleSmall:    { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, fontFamily: 'Cairo' },
    bodyLarge:     { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, fontFamily: 'Cairo' },
    bodyMedium:    { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, fontFamily: 'Cairo' },
    bodySmall:     { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, fontFamily: 'Cairo' },
    labelLarge:    { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, fontFamily: 'Cairo' },
  };
  ```

- [ ] **Step 2: Create mobile/src/components/AppText.tsx**

  ```tsx
  import React from 'react';
  import { StyleProp, Text, TextStyle } from 'react-native';
  import { TYPOGRAPHY } from '@/constants/theme';
  import { useIsRTL } from '@/src/i18n/useIsRTL';

  type TypographyVariant = keyof typeof TYPOGRAPHY;

  interface AppTextProps {
    variant?: TypographyVariant;
    color?: string;
    style?: StyleProp<TextStyle>;
    children?: React.ReactNode;
    numberOfLines?: number;
    accessibilityLabel?: string;
  }

  export function AppText({
    variant = 'bodyMedium',
    color,
    style,
    children,
    numberOfLines,
    accessibilityLabel,
  }: AppTextProps) {
    const isRTL = useIsRTL();
    const baseStyle = TYPOGRAPHY[variant];
    return (
      <Text
        numberOfLines={numberOfLines}
        accessibilityLabel={accessibilityLabel}
        style={[
          baseStyle,
          { writingDirection: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left' },
          color ? { color } : undefined,
          style,
        ]}
      >
        {children}
      </Text>
    );
  }
  ```

- [ ] **Step 3: Replace Text with AppText in design.tsx**

  In `mobile/src/components/design.tsx`:
  1. Add `import { AppText } from './AppText';` near the top.
  2. In `Avatar` — replace the `<Text style={[uiStyles(colors).avatarText, ...]}>` with:
     ```tsx
     <AppText variant="bodySmall" style={[uiStyles(colors).avatarText, { color, fontSize: Math.max(11, Math.round(size * 0.31)) }]}>
       {initials}
     </AppText>
     ```
  3. In `MetricTile` — replace the two `<Text>` nodes:
     ```tsx
     <AppText variant="headlineMedium" style={[uiStyles(colors).metricValue, { color: accent }]}>{value}</AppText>
     <AppText variant="bodySmall" style={uiStyles(colors).metricLabel} numberOfLines={1}>{label}</AppText>
     ```
  4. In `SectionHeader` — replace text nodes:
     ```tsx
     <AppText variant="titleMedium" style={uiStyles(colors).sectionTitle}>{title}</AppText>
     // and:
     <AppText variant="labelLarge" style={uiStyles(colors).sectionAction}>{actionLabel}</AppText>
     ```
  5. In `StatusPill`:
     ```tsx
     <AppText variant="bodySmall" style={[uiStyles(colors).statusText, { color }, textStyle]}>{label}</AppText>
     ```
  6. In `EmptyState`:
     ```tsx
     <AppText variant="titleSmall" style={uiStyles(colors).emptyTitle}>{title}</AppText>
     {description ? <AppText variant="bodySmall" style={uiStyles(colors).emptyDesc}>{description}</AppText> : null}
     ```
  7. Remove `Text` from the react-native import if nothing else in the file uses it directly (check).

- [ ] **Step 4: TypeScript check**

  ```bash
  cd mobile && npx tsc --noEmit 2>&1 | head -40
  ```
  Expected: 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  git add mobile/constants/theme.ts mobile/src/components/AppText.tsx mobile/src/components/design.tsx
  git commit -m "feat(mobile): AppText primitive — Cairo font + RTL writingDirection wired through design system"
  ```

---

### Task 2: forceRTL startup-only fix

**Files:**
- Modify: `mobile/app/_layout.tsx` lines 25–28

**Interfaces:**
- Consumes: `I18nManager` from react-native, `language` from `useSettingsStore`
- Produces: direction set once at startup; changes trigger a reload

- [ ] **Step 1: Check if expo-updates is installed**

  ```bash
  grep '"expo-updates"' mobile/package.json
  ```

- [ ] **Step 2: Replace the forceRTL useEffect in _layout.tsx**

  If `expo-updates` is present:
  ```tsx
  import * as Updates from 'expo-updates';
  // ...
  useEffect(() => {
    const shouldBeRTL = language === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
      Updates.reloadAsync();
    }
  }, [language]);
  ```

  If `expo-updates` is absent:
  ```tsx
  useEffect(() => {
    const shouldBeRTL = language === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
      const { DevSettings } = require('react-native');
      DevSettings?.reload?.();
    }
  }, [language]);
  ```

- [ ] **Step 3: TypeScript check**

  ```bash
  cd mobile && npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add mobile/app/_layout.tsx
  git commit -m "fix(mobile): forceRTL — guard with isRTL diff check and trigger reload so layout takes effect"
  ```

---

### Task 3: fontSize / compactView settings wiring

**Files:**
- Create: `mobile/src/components/SettingsContext.tsx`
- Modify: `mobile/app/_layout.tsx` — wrap tree with SettingsProvider
- Modify: `mobile/src/components/AppText.tsx` — multiply fontSize by fontScale
- Modify: `mobile/src/components/design.tsx` — pass spacingScale into uiStyles, apply to AppCard, MetricTile, EmptyState

**Interfaces:**
- Consumes Task 1's `AppText`, `useSettingsStore` (fontSize, compactView), `FONT_SCALE`, `SPACING_SCALE` from `mobile/constants/theme.ts`
- Produces:
  ```ts
  // SettingsContext.tsx:
  export function SettingsProvider({ children }: { children: React.ReactNode }): JSX.Element
  export function useSettingsScales(): { fontScale: number; spacingScale: number }
  ```

- [ ] **Step 1: Create mobile/src/components/SettingsContext.tsx**

  ```tsx
  import React, { createContext, useContext } from 'react';
  import { useSettingsStore } from '@/src/settings/store';
  import { FONT_SCALE, SPACING_SCALE } from '@/constants/theme';

  interface SettingsScales { fontScale: number; spacingScale: number; }
  const SettingsScalesContext = createContext<SettingsScales>({ fontScale: 1.0, spacingScale: 1.0 });

  export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const { fontSize, compactView } = useSettingsStore();
    return (
      <SettingsScalesContext.Provider value={{
        fontScale: FONT_SCALE[fontSize] ?? 1.0,
        spacingScale: SPACING_SCALE[compactView ? 'compact' : 'normal'],
      }}>
        {children}
      </SettingsScalesContext.Provider>
    );
  }

  export function useSettingsScales(): SettingsScales {
    return useContext(SettingsScalesContext);
  }
  ```

- [ ] **Step 2: Wrap app in SettingsProvider in _layout.tsx**

  Add import and wrap the returned JSX:
  ```tsx
  import { SettingsProvider } from '@/src/components/SettingsContext';
  // In the return:
  return (
    <SettingsProvider>
      <ThemeProvider value={darkMode ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* existing screens */}
        </Stack>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
      </ThemeProvider>
    </SettingsProvider>
  );
  ```

- [ ] **Step 3: Apply fontScale in AppText.tsx**

  ```tsx
  import { useSettingsScales } from './SettingsContext';
  // inside AppText:
  const { fontScale } = useSettingsScales();
  const baseStyle = TYPOGRAPHY[variant];
  // in style array replace TYPOGRAPHY[variant] with:
  { ...baseStyle, fontSize: Math.round(baseStyle.fontSize * fontScale) },
  ```

- [ ] **Step 4: Apply spacingScale in design.tsx**

  Convert `uiStyles` signature to `(colors: Colors, spacingScale = 1.0)` and scale the padding/margin values. Add `const { spacingScale } = useSettingsScales();` inside `AppCard`, `MetricTile`, and `EmptyState`, then pass it: `uiStyles(colors, spacingScale)`.

  Specific paddings to scale (multiply by spacingScale):
  - `card.padding`: `SPACING.lg` → `Math.round(SPACING.lg * spacingScale)`
  - `metricTile.paddingHorizontal` and `paddingVertical`: `SPACING.md`
  - `emptyState.paddingVertical`: `SPACING['2xl']`; `paddingHorizontal`: `SPACING.lg`

- [ ] **Step 5: TypeScript check**

  ```bash
  cd mobile && npx tsc --noEmit 2>&1 | head -40
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add mobile/src/components/SettingsContext.tsx mobile/app/_layout.tsx mobile/src/components/AppText.tsx mobile/src/components/design.tsx
  git commit -m "feat(mobile): wire fontSize + compactView settings through SettingsContext, AppText, design system"
  ```

---

### Task 4: Color token consolidation

**Files:**
- Modify: `mobile/constants/theme.ts` — add grade-type tokens + `borderSubtle`
- Modify: `mobile/app/student/grades.tsx` — replace TYPE_COLORS
- Modify: `mobile/app/admin/user-detail.tsx` — replace hardcoded hexes
- Modify: `mobile/app/student/teacher-change.tsx` — replace hardcoded hexes
- Modify: `mobile/app/admin/settings.tsx` — fix theme-swatch colors
- Modify: `mobile/src/components/design.tsx` — `borderSubtle` in card border
- Modify: `mobile/src/components/BottomNav.tsx` — `borderSubtle` in nav border

**Interfaces:**
- Produces new keys in `getColors()` return type:
  ```ts
  gradeOral: string; gradeQuiz: string; gradeExam: string;
  gradeAssignment: string; gradeParticipation: string; borderSubtle: string;
  ```

- [ ] **Step 1: Add tokens to both branches of getColors() in theme.ts**

  In the `isDark` return block add:
  ```ts
  gradeOral: '#60a5fa', gradeQuiz: '#4ade80', gradeExam: '#f87171',
  gradeAssignment: '#fbbf24', gradeParticipation: '#a78bfa',
  borderSubtle: '#2C2C2C',
  ```
  In the light return block add:
  ```ts
  gradeOral: '#3b82f6', gradeQuiz: '#22c55e', gradeExam: '#ef4444',
  gradeAssignment: '#f59e0b', gradeParticipation: '#8b5cf6',
  borderSubtle: '#E7ECE6',
  ```

- [ ] **Step 2: Update student/grades.tsx**

  Read the file to find exact local TYPE_COLORS usage, then replace with:
  ```ts
  const TYPE_COLOR_MAP = (colors: ReturnType<typeof getColors>) => ({
    ORAL: colors.gradeOral, QUIZ: colors.gradeQuiz, EXAM: colors.gradeExam,
    ASSIGNMENT: colors.gradeAssignment, PARTICIPATION: colors.gradeParticipation,
  });
  ```
  Replace `TYPE_COLORS[type]` usages with `(TYPE_COLOR_MAP(colors)[type] ?? colors.primary)`.

- [ ] **Step 3: Update admin/user-detail.tsx, student/teacher-change.tsx**

  Grep for hardcoded hexes in each file and replace:
  - `#f1f5f9` → `colors.surfaceAlt`
  - `#f3e8ff` → `colors.primaryMuted`
  - `#475569` → `colors.textSecondary`
  - `#e2e8f0`, `#e5e7eb`, `#E7ECE6`, `#E2E8E1` → `colors.borderSubtle`
  - `#ef4444` (standalone red) → `colors.error`

- [ ] **Step 4: Fix theme-swatch in admin/settings.tsx**

  Find `getThemeColor` helper or inline hex. Replace swatch colors with palette primaries:
  `green: '#1B5E20'`, `blue: '#1565C0'`, `purple: '#6A1B9A'`, `dark: '#0f172a'`.

- [ ] **Step 5: Replace border literals in design.tsx and BottomNav.tsx**

  In `design.tsx` uiStyles card: `borderColor: colors.darkMode ? colors.divider : '#E7ECE6'` → `borderColor: colors.borderSubtle`
  In `BottomNav.tsx`: replace all `'#E2E8E1'`/`'#E7ECE6'` border strings with `colors.borderSubtle`.

- [ ] **Step 6: TypeScript check**

  ```bash
  cd mobile && npx tsc --noEmit 2>&1 | head -40
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add mobile/constants/theme.ts mobile/app/student/grades.tsx mobile/app/admin/user-detail.tsx mobile/app/student/teacher-change.tsx mobile/app/admin/settings.tsx mobile/src/components/design.tsx mobile/src/components/BottomNav.tsx
  git commit -m "feat(mobile): color consolidation — grade tokens, borderSubtle, eliminate hardcoded hexes"
  ```

---

### Task 5: i18n dashboard sweep + a11y / touch target pass

**Files:**
- Modify: `mobile/src/i18n/index.ts` — add missing dashboard keys to both ar and en
- Modify: `mobile/app/teacher/home.tsx` — replace isAr ternaries with t()
- Modify: `mobile/app/student/home.tsx` — replace isAr ternaries with t()
- Modify: `mobile/app/admin/home.tsx` — replace isAr ternaries with t()
- Modify: `mobile/src/components/design.tsx` — IconButton default 44, hitSlop on SectionHeader action
- Modify: `mobile/src/components/BottomNav.tsx` — min 44px tab height, accessibilityLabel + Role on tabs

**Interfaces:**
- Consumes: `useTranslation` from react-i18next (already imported in dashboard screens)
- Produces: `t('key')` replaces all `isAr ? 'ar' : 'en'` string ternaries in the three dashboards

- [ ] **Step 1: Grep actual inline ternary strings in all three screens**

  ```bash
  grep -n "isAr ?" mobile/app/teacher/home.tsx mobile/app/student/home.tsx mobile/app/admin/home.tsx | head -80
  ```
  List every unique `'arabic string'` and `'english string'` pair, assign camelCase key names.

- [ ] **Step 2: Add all new keys to i18n/index.ts (both ar and en)**

  For every ternary pair found in Step 1, add:
  ```ts
  // arTranslations:
  theKey: 'النص العربي',
  // enTranslations:
  theKey: 'English text',
  ```
  Do not add keys that already exist.

- [ ] **Step 3: Replace ternaries in the three screens with t() calls**

  Pattern:
  ```tsx
  // Before:
  {isAr ? 'النص العربي' : 'English text'}
  // After:
  {t('theKey')}
  ```
  Ensure `const { t } = useTranslation();` is present in each file (add if missing).

- [ ] **Step 4: IconButton default size 44 in design.tsx**

  ```tsx
  export function IconButton({
    ...
    size = 44,  // was 40
    ...
  ```

- [ ] **Step 5: hitSlop on SectionHeader action in design.tsx**

  ```tsx
  <TouchableOpacity
    onPress={onActionPress}
    activeOpacity={0.8}
    hitSlop={{ top: 12, bottom: 12, left: 12, right: 0 }}
  >
  ```

- [ ] **Step 6: BottomNav — 44px min height + accessibility**

  Find the tab `TouchableOpacity` and its style. Add `minHeight: 44` and `justifyContent: 'center'` to the tab container style. Add `accessibilityRole="tab"` and `accessibilityLabel={label}` (or equivalent label string) to each tab's `TouchableOpacity`.

- [ ] **Step 7: TypeScript check**

  ```bash
  cd mobile && npx tsc --noEmit 2>&1 | head -40
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add mobile/src/i18n/index.ts mobile/app/teacher/home.tsx mobile/app/student/home.tsx mobile/app/admin/home.tsx mobile/src/components/design.tsx mobile/src/components/BottomNav.tsx
  git commit -m "feat(mobile): i18n sweep + a11y — dashboard t() keys, 44px targets, hitSlop, BottomNav tabs"
  ```
