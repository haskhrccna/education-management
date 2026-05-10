# Bundle E: UX Polish — Design Spec
**Date:** 2026-05-08
**Scope:** Mobile only. Three UX gaps affecting teacher and admin home screens.

---

## Goal

Replace the raw text "loading" string with skeleton placeholder cards, add pull-to-refresh to the two home screens that lack it, and surface API errors to the user instead of silently logging them to console.

---

## Current State (confirmed by code audit)

| Screen | Loading UI | Pull-to-Refresh | Error UI |
|--------|-----------|-----------------|----------|
| Student home | ActivityIndicator ✓ | RefreshControl ✓ | console.error only |
| Student grades | ActivityIndicator ✓ | RefreshControl ✓ | console.error only |
| Teacher home | `t('loading')` text | ✗ | console.error only |
| Admin home | `t('loading')` text | ✗ | console.error only |

---

## Fix 1 — Shared SkeletonCard Component

**File:** `mobile/src/components/SkeletonCard.tsx` (new)

A reusable shimmer placeholder card. Uses React Native's built-in `Animated` API:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';

interface Props {
  lines?: number; // default 2
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

---

## Fix 2 — Teacher Home: Skeleton + Pull-to-Refresh + Error State

**File:** `mobile/app/teacher/home.tsx`

### Loading state
Replace the `t('loading')` text with skeleton cards:
```tsx
{isLoading ? (
  <>
    <SkeletonCard lines={2} />
    <SkeletonCard lines={2} />
    <SkeletonCard lines={2} />
  </>
) : /* existing list */}
```

Import `SkeletonCard` from `@/src/components/SkeletonCard`.

### Pull-to-Refresh
Add `RefreshControl` to the `ScrollView`:
```tsx
<ScrollView
  refreshControl={
    <RefreshControl refreshing={isLoading} onRefresh={fetchAppointments} />
  }
>
```
Import `RefreshControl` from `react-native`. Read the file to confirm the exact fetch function name.

### Error state
Add `fetchError` state and show an inline banner:
```tsx
const [fetchError, setFetchError] = useState<string | null>(null);
// In catch: setFetchError(t('loadFailed'));
// Clear at start of fetch: setFetchError(null);

{fetchError && !isLoading && (
  <TouchableOpacity onPress={fetchAppointments} style={styles.errorBanner}>
    <Text style={styles.errorText}>{fetchError}</Text>
  </TouchableOpacity>
)}
```
Style `errorBanner`: `backgroundColor: COLORS.errorLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm`
Style `errorText`: `color: COLORS.error, fontSize: 13, textAlign: 'center'`

---

## Fix 3 — Admin Home: Skeleton + Pull-to-Refresh + Error State

**File:** `mobile/app/admin/home.tsx`

Same pattern as Fix 2:
- Replace `t('loading')` with `<SkeletonCard lines={3} />` × 3 (admin cards show name + role + status = 3 lines)
- Add `RefreshControl` to the `ScrollView` — `onRefresh` calls the existing fetch function (read the file to confirm its name)
- Add `fetchError` state + inline retry banner, same styling as teacher home

---

## Fix 4 — i18n Key

**File:** `mobile/src/i18n/index.ts`

Add to both `arTranslations` and `enTranslations`:

| Key | Arabic | English |
|-----|--------|---------|
| `loadFailed` | `فشل التحميل. اضغط للمحاولة مجدداً` | `Failed to load. Tap to retry.` |

---

## Files Changed

| File | Action |
|------|--------|
| `mobile/src/components/SkeletonCard.tsx` | **New** — shared shimmer card |
| `mobile/app/teacher/home.tsx` | Skeleton + RefreshControl + error state |
| `mobile/app/admin/home.tsx` | Skeleton + RefreshControl + error state |
| `mobile/src/i18n/index.ts` | Add `loadFailed` key |

---

## Out of Scope

- Student home and grades (already have ActivityIndicator + RefreshControl)
- Bottom tab bar (separate architectural work)
- Offline/cache support

---

## Testing

1. Teacher home slow network → 3 shimmer cards pulse while loading
2. Teacher home network error → `loadFailed` banner; tapping retries fetch
3. Pull down on teacher home → list refreshes
4. Admin home — same 3 verifications
5. Dark mode → skeleton uses `surfaceAlt` (visible against `surface` background)
