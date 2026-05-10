# Bundle E: UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain-text loading indicators with animated skeleton cards, add pull-to-refresh, and surface API errors to users on teacher and admin home screens.

**Architecture:** New shared `SkeletonCard` component using React Native's `Animated` API; modifications to two existing screens.

**Tech Stack:** React Native, Expo Router, react-i18next, React Native `Animated` API.

---

## Task 1: SkeletonCard component + i18n key

**Files:**
- Create: `mobile/src/components/SkeletonCard.tsx`
- Modify: `mobile/src/i18n/index.ts`

- [ ] **Step 1: Create `mobile/src/components/SkeletonCard.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';

interface Props {
  lines?: number;
}

export function SkeletonCard({ lines = 2 }: Props) {
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { backgroundColor: COLORS.surface, opacity }]}>
      <View style={[styles.linePrimary, { backgroundColor: COLORS.surfaceAlt }]} />
      {lines >= 2 && <View style={[styles.lineSecondary, { backgroundColor: COLORS.surfaceAlt }]} />}
      {lines >= 3 && <View style={[styles.lineTertiary, { backgroundColor: COLORS.surfaceAlt }]} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm },
  linePrimary: { height: 14, borderRadius: RADIUS.sm, width: '65%' },
  lineSecondary: { height: 12, borderRadius: RADIUS.sm, width: '45%' },
  lineTertiary: { height: 10, borderRadius: RADIUS.sm, width: '30%' },
});
```

- [ ] **Step 2: Add `loadFailed` i18n key**

Read `mobile/src/i18n/index.ts`. Find `arTranslations` and add:
```
loadFailed: 'فشل التحميل. اضغط للمحاولة مجدداً',
```
Find `enTranslations` and add:
```
loadFailed: 'Failed to load. Tap to retry.',
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/SkeletonCard.tsx mobile/src/i18n/index.ts
git commit -m "feat(ux): add SkeletonCard component and loadFailed i18n key"
```

---

## Task 2: Teacher home — skeleton + pull-to-refresh + error state

**Files:**
- Modify: `mobile/app/teacher/home.tsx`

**Current state (confirmed by code read):**
- Line 1: `import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'` — no `RefreshControl`
- Line 52: `const { appointments, isLoading, fetchAppointments } = useAppointments();`
- Lines 82–107: `Promise.all(...)` chain; `.catch` at line 101 calls `console.error` only; `isMounted` guard in place
- Lines 182–195: `{isLoading ? <Text style={styles.empty}>{t('loading')}</Text> : ...}` inside a `ScrollView`
- No `RefreshControl` anywhere in the file

- [ ] **Step 1: Read the full file**

Read `mobile/app/teacher/home.tsx` in full before making any edits.

- [ ] **Step 2: Add `RefreshControl` to react-native import**

Change the line:
```tsx
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
```
to:
```tsx
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
```

- [ ] **Step 3: Add SkeletonCard import**

Add after the existing import block:
```tsx
import { SkeletonCard } from '@/src/components/SkeletonCard';
```

- [ ] **Step 4: Add `fetchError` state**

After the existing `useState` declarations in the component body, add:
```tsx
const [fetchError, setFetchError] = useState<string | null>(null);
```

- [ ] **Step 5: Clear error at start of fetch, set on failure**

In the `useEffect` that runs the `Promise.all` (depends on `[appointments, i18n.language]`), add `setFetchError(null);` before the `Promise.all(...)` call.

In the `.catch` block, change:
```tsx
console.error('Failed to load teacher dashboard summaries:', err.message);
if (isMounted) {
  setProgressByStudent({});
  setGradeCount(null);
}
```
to:
```tsx
console.error('Failed to load teacher dashboard summaries:', err.message);
if (isMounted) {
  setProgressByStudent({});
  setGradeCount(null);
  setFetchError(t('loadFailed'));
}
```

- [ ] **Step 6: Replace loading text with skeleton cards**

Find the JSX block:
```tsx
{isLoading ? (
  <Text style={styles.empty}>{t('loading')}</Text>
```
Replace with:
```tsx
{isLoading ? (
  <>
    <SkeletonCard lines={2} />
    <SkeletonCard lines={2} />
    <SkeletonCard lines={2} />
  </>
```
Leave the `) : ...` (the else branch) unchanged.

- [ ] **Step 7: Add error banner**

Directly above the `{isLoading ? ...}` block, insert:
```tsx
{fetchError && !isLoading && (
  <TouchableOpacity onPress={fetchAppointments} style={styles.errorBanner}>
    <Text style={styles.errorText}>{fetchError}</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 8: Add error styles**

In the `createStyles` function (or wherever the styles object is defined), add:
```tsx
errorBanner: {
  backgroundColor: COLORS.errorLight,
  borderRadius: RADIUS.md,
  padding: SPACING.md,
  marginBottom: SPACING.sm,
},
errorText: {
  color: COLORS.error,
  fontSize: 13,
  textAlign: 'center',
},
```

- [ ] **Step 9: Add RefreshControl to the ScrollView**

Find the `<ScrollView` that wraps the student list (the one that contains the `{isLoading ? ...}` block). Add the `refreshControl` prop:
```tsx
<ScrollView
  refreshControl={
    <RefreshControl refreshing={isLoading} onRefresh={fetchAppointments} />
  }
  {/* keep all existing props */}
>
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

Fix any errors before committing.

- [ ] **Step 11: Commit**

```bash
git add mobile/app/teacher/home.tsx
git commit -m "feat(ux): teacher home skeleton loading, pull-to-refresh, error state"
```

---

## Task 3: Admin home — skeleton + pull-to-refresh + error state

**Files:**
- Modify: `mobile/app/admin/home.tsx`

**Current state (confirmed by code read):**
- Line 1: `import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'` — no `RefreshControl`
- Lines 46–62: `loadUsers` useCallback — `setIsLoading(true)`, try/catch/finally; catch at line 57–59 calls `console.error` only
- Line 64–67: `useEffect` calls `loadUsers()`
- Lines 191–196: `{isLoading ? <Text style={styles.empty}>{t('loading')}</Text> : ...}` inside a `ScrollView`
- No `RefreshControl` anywhere in the file

- [ ] **Step 1: Read the full file**

Read `mobile/app/admin/home.tsx` in full before making any edits.

- [ ] **Step 2: Add `RefreshControl` to react-native import**

Add `RefreshControl` to the existing react-native import destructure.

- [ ] **Step 3: Add SkeletonCard import**

Add after the existing import block:
```tsx
import { SkeletonCard } from '@/src/components/SkeletonCard';
```

- [ ] **Step 4: Add `fetchError` state**

After the existing `useState` declarations, add:
```tsx
const [fetchError, setFetchError] = useState<string | null>(null);
```

- [ ] **Step 5: Clear error at start of `loadUsers`, set on failure**

Inside `loadUsers`, at the very top before `setIsLoading(true)`, add:
```tsx
setFetchError(null);
```

In the catch block, change:
```tsx
console.error('Failed to load users:', err.message);
```
to:
```tsx
console.error('Failed to load users:', err.message);
setFetchError(t('loadFailed'));
```

- [ ] **Step 6: Replace loading text with skeleton cards**

Find:
```tsx
{isLoading ? (
  <Text style={styles.empty}>{t('loading')}</Text>
```
Replace with:
```tsx
{isLoading ? (
  <>
    <SkeletonCard lines={3} />
    <SkeletonCard lines={3} />
    <SkeletonCard lines={3} />
  </>
```
(3 lines because admin user cards show name + role + status.)

- [ ] **Step 7: Add error banner**

Directly above the `{isLoading ? ...}` block:
```tsx
{fetchError && !isLoading && (
  <TouchableOpacity onPress={loadUsers} style={styles.errorBanner}>
    <Text style={styles.errorText}>{fetchError}</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 8: Add error styles**

In `createStyles`, add:
```tsx
errorBanner: {
  backgroundColor: COLORS.errorLight,
  borderRadius: RADIUS.md,
  padding: SPACING.md,
  marginBottom: SPACING.sm,
},
errorText: {
  color: COLORS.error,
  fontSize: 13,
  textAlign: 'center',
},
```

- [ ] **Step 9: Add RefreshControl to the ScrollView**

Find the `<ScrollView` wrapping the user list. Add:
```tsx
<ScrollView
  refreshControl={
    <RefreshControl refreshing={isLoading} onRefresh={loadUsers} />
  }
  {/* keep all existing props */}
>
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

Fix any errors.

- [ ] **Step 11: Commit**

```bash
git add mobile/app/admin/home.tsx
git commit -m "feat(ux): admin home skeleton loading, pull-to-refresh, error state"
```

---

## Self-Review Checklist

- [ ] `SkeletonCard` pulses — opacity 1→0.3→1 in a loop via `Animated.loop`
- [ ] Teacher home: 3 skeleton cards while `isLoading`, not text
- [ ] Admin home: 3 skeleton cards (3 lines each) while `isLoading`
- [ ] Teacher home `ScrollView` has `RefreshControl` wired to `fetchAppointments`
- [ ] Admin home `ScrollView` has `RefreshControl` wired to `loadUsers`
- [ ] Network error on teacher home → `loadFailed` banner; tap retries
- [ ] Network error on admin home → `loadFailed` banner; tap retries
- [ ] Dark mode: `surfaceAlt` lines visible against `surface` background
- [ ] TypeScript compiles clean after all tasks
