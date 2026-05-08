# Bundle A: Critical Bug Fixes + Code Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 live bugs across teacher home, student home, admin home, and student grades — all mobile-only, zero backend changes.

**Architecture:** Each task targets a single file. Order matters: i18n keys go first (Tasks 1–2 add the translation strings that Tasks 3–6 consume). The teacher reports stub (Task 2) is a new file that auto-registers as an Expo Router route. All other tasks are surgical edits to existing files.

**Tech Stack:** Expo Router · React Native · react-i18next · Zustand · TypeScript

---

## File Map

| File | Task(s) |
|------|---------|
| `mobile/src/i18n/index.ts` | Task 1 — add 10 new keys |
| `mobile/app/teacher/reports.tsx` | Task 2 — new stub screen |
| `mobile/app/teacher/home.tsx` | Task 3 — dark mode + stats + student card |
| `mobile/app/student/home.tsx` | Task 4 — revision schedule empty state |
| `mobile/app/admin/home.tsx` | Task 5 — filter badge + role/status localization |
| `mobile/app/student/grades.tsx` | Task 6 — date locale |

---

## Task 1: Add i18n Translation Keys

**Files:**
- Modify: `mobile/src/i18n/index.ts`

> Context: The i18n file has two flat record objects — `arTranslations` and `enTranslations`. Both must stay in sync. Add the new keys just before each object's closing `};`. These strings are consumed by Tasks 2–6.

- [ ] **Step 1: Add Arabic translations**

Open `mobile/src/i18n/index.ts`. Find the end of the `arTranslations` object (just before its closing `};`). Add:

```typescript
  // Roles & Status
  roleStudent: 'طالب',
  roleTeacher: 'معلم',
  roleAdmin: 'مشرف',
  statusActive: 'نشط',
  statusPending: 'معلق',
  statusInactive: 'غير نشط',
  // Reports & Misc
  progressReports: 'تقارير التقدم',
  comingSoon: 'قريباً',
  sinceDate: 'منذ',
  noRevisionsAssigned: 'لم يُعيّن لك معلمك أي مراجعات بعد',
```

- [ ] **Step 2: Add English translations**

In `enTranslations` (just before its closing `};`), add:

```typescript
  // Roles & Status
  roleStudent: 'Student',
  roleTeacher: 'Teacher',
  roleAdmin: 'Admin',
  statusActive: 'Active',
  statusPending: 'Pending',
  statusInactive: 'Inactive',
  // Reports & Misc
  progressReports: 'Progress Reports',
  comingSoon: 'Coming Soon',
  sinceDate: 'Since',
  noRevisionsAssigned: "Your teacher hasn't assigned any revisions yet.",
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit
```

Expected: no output (zero errors). If you see `Object literal may only specify known properties`, check for a typo in a key name.

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode/education_management && \
git add mobile/src/i18n/index.ts && \
git commit -m "feat(i18n): add role, status, and misc translation keys"
```

---

## Task 2: Create Teacher Reports Stub Screen

**Files:**
- Create: `mobile/app/teacher/reports.tsx`

> Context: The teacher Assignments tab has a "Progress Report" button that calls `router.push('/teacher/reports')`. That route doesn't exist, causing a crash. Creating this file is enough — Expo Router auto-registers it as `/teacher/reports`. No changes to `teacher/home.tsx` are needed.

- [ ] **Step 1: Create the stub screen**

Create `mobile/app/teacher/reports.tsx`:

```typescript
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getColors, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

export default function TeacherReportsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('progressReports')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.icon}>📊</Text>
        <Text style={[styles.bodyTitle, { color: COLORS.textPrimary }]}>
          {t('progressReports')}
        </Text>
        <Text style={[styles.bodySub, { color: COLORS.textSecondary }]}>
          {t('comingSoon')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: SPACING.xl,
    paddingTop: SPACING.lg,
    borderBottomLeftRadius: RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
    marginBottom: SPACING.md,
    ...SHADOWS.lg,
  },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: SPACING.sm },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['3xl'] },
  icon: { fontSize: 56, marginBottom: SPACING.xl },
  bodyTitle: { fontSize: 22, fontWeight: '800', marginBottom: SPACING.sm, textAlign: 'center' },
  bodySub: { fontSize: 15, textAlign: 'center' },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Manual test**

Start Expo if not running: `cd mobile && npm start`. Open iOS simulator (device ID: `F0A48EA8-BDFB-4400-B643-FF179927BC50`). Login as `teacher@education.com` / `Teacher1234!`. Tap **التعيينات** (Assignments) tab → tap **تقرير التقدم** (Progress Report). Expected: navigates to a screen showing "📊 تقارير التقدم" title and "قريباً" subtitle with a back arrow that returns to teacher home.

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode/education_management && \
git add mobile/app/teacher/reports.tsx && \
git commit -m "feat(teacher): add progress reports stub screen"
```

---

## Task 3: Fix Teacher Home — Dark Mode, Stats, Student Card

**Files:**
- Modify: `mobile/app/teacher/home.tsx`

> Context: Three bugs in the same file fixed together. (1) `COLORS` is a static module-level import — dark mode never applies. (2) Stats show hardcoded `12` and `85%`. (3) Student cards show a hardcoded "Surah Al-Baqarah 45%" progress bar. The `appointments` array is already loaded from `useAppointments()` — no new API calls needed.

- [ ] **Step 1: Fix the theme import**

In `mobile/app/teacher/home.tsx`, find line 9:

```typescript
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
```

Replace with:

```typescript
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';
```

- [ ] **Step 2: Add dynamic COLORS inside the component**

Inside `TeacherHomeScreen()`, after the existing hook calls (`useRouter`, `useTranslation`, `useAuthStore`, `useAppointments`), add:

```typescript
const { theme, darkMode } = useSettingsStore();
const COLORS = getColors(theme, darkMode);
```

> Important: if the file has a module-level `const styles = StyleSheet.create({...})`, you must wrap it in a function `const createStyles = (COLORS: any) => StyleSheet.create({...})` and call `const styles = createStyles(COLORS)` inside the component — matching the pattern in `student/home.tsx`. If `createStyles` already exists, just add the `const styles = createStyles(COLORS)` call.

- [ ] **Step 3: Fix the stats row**

Find the `{/* Quick stats */}` block. It currently has three `statCard` views with `appointments.length`, `12`, and `85%`. Replace the entire block:

```tsx
{/* Quick stats */}
<View style={styles.statsRow}>
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{appointments.length}</Text>
    <Text style={styles.statLabel}>{t('myStudents')}</Text>
  </View>
  <View style={styles.statCard}>
    <Text style={styles.statValue}>
      {appointments.filter((a: any) => a.status === 'ACCEPTED').length}
    </Text>
    <Text style={styles.statLabel}>{t('activeStudents')}</Text>
  </View>
  <View style={styles.statCard}>
    <Text style={styles.statValue}>
      {appointments.filter((a: any) => a.status === 'REQUESTED').length}
    </Text>
    <Text style={styles.statLabel}>{t('awaitingApproval')}</Text>
  </View>
</View>
```

- [ ] **Step 4: Remove hardcoded student progress bar**

Inside `MyStudentsTab`, find and delete the entire `<View style={styles.studentProgress}>` block:

```tsx
<View style={styles.studentProgress}>
  <View style={styles.progressRow}>
    <Text style={styles.progressLabel}>{i18n.language === 'ar' ? 'سورة البقرة' : 'Surah Al-Baqarah'}</Text>
    <Text style={styles.progressValue}>45%</Text>
  </View>
  <View style={styles.progressBarContainer}>
    <View style={[styles.progressBar, { width: '45%' }]} />
  </View>
</View>
```

Then update the `<View style={styles.studentMeta}>` that follows to prefix the date with `sinceDate`:

```tsx
<View style={styles.studentMeta}>
  <Text style={styles.metaText}>
    📅 {t('sinceDate')}: {new Date(a.requestedDate).toLocaleDateString(
      i18n.language === 'ar' ? 'ar-SA' : 'en-US'
    )}
  </Text>
  <Text style={styles.metaText}>🕐 {a.requestedTime}</Text>
</View>
```

> `MyStudentsTab` already has `const { t, i18n } = useTranslation()` — both `t` and `i18n` are available.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit
```

Expected: no output. Common errors:
- `Cannot find name 'COLORS'` → the `const COLORS = getColors(...)` line is missing inside the component
- `Property 'createStyles' does not exist` → wrap the StyleSheet in `createStyles` as described in Step 2

- [ ] **Step 6: Manual test**

Login as `teacher@education.com`. Check:
- Toggle app theme (via admin settings or device settings) → teacher home updates correctly
- Stats row shows real numbers (not `12` / `85%`)
- Student cards show "📅 منذ: [date]" — no progress bar

- [ ] **Step 7: Commit**

```bash
cd /Users/haskhr/Documents/opencode/education_management && \
git add mobile/app/teacher/home.tsx && \
git commit -m "fix(teacher): dark mode, real stats, remove hardcoded student progress bar"
```

---

## Task 4: Fix Student Home — Revision Schedule Empty State

**Files:**
- Modify: `mobile/app/student/home.tsx`

> Context: `RevisionScheduleTab` is defined inside `student/home.tsx`. It calls `const { i18n } = useTranslation()` — `t` is not destructured. We add `t`, then replace the empty-state description with `t('noRevisionsAssigned')`.

- [ ] **Step 1: Add `t` to RevisionScheduleTab's useTranslation**

Inside `mobile/app/student/home.tsx`, find `RevisionScheduleTab`. It contains:

```typescript
const { i18n } = useTranslation();
```

Change to:

```typescript
const { t, i18n } = useTranslation();
```

- [ ] **Step 2: Replace the empty state description**

Inside `RevisionScheduleTab`, find the empty state block (`revisions.length === 0`). It contains a `Text` with `styles.emptyDesc` that has either a raw string or an `i18n.language` ternary. Replace that Text element with:

```tsx
<Text style={styles.emptyDesc}>{t('noRevisionsAssigned')}</Text>
```

Leave the emptyIcon and emptyTitle Text elements unchanged.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode/education_management && \
git add mobile/app/student/home.tsx && \
git commit -m "fix(student): accurate revision schedule empty state message"
```

---

## Task 5: Fix Admin Home — Filter Badge + Role/Status Localization

**Files:**
- Modify: `mobile/app/admin/home.tsx`

> Context: Two bugs in the same file. (1) The filter badge uses a nested ternary with no case for `PENDING_AND_TEACHER` (the new default filter added last session) — badge shows blank. (2) User cards render raw DB enums. Both the main component and `UsersList` sub-component already have `const { t, i18n } = useTranslation()`.

- [ ] **Step 1: Add FILTER_LABELS lookup in AdminHomeScreen**

Inside `AdminHomeScreen`, just before the `return` statement, add:

```typescript
const FILTER_LABELS: Record<FilterType, string> = {
  all:                 '',
  STUDENT:             i18n.language === 'ar' ? 'عرض الطلاب'              : 'Showing Students',
  TEACHER:             i18n.language === 'ar' ? 'عرض المعلمين'            : 'Showing Teachers',
  PENDING:             i18n.language === 'ar' ? 'عرض المعلقة'             : 'Showing Pending',
  PENDING_AND_TEACHER: i18n.language === 'ar' ? 'عرض المعلقة والمعلمين'  : 'Showing Pending & Teachers',
};
```

- [ ] **Step 2: Replace the nested ternary in the filter badge**

Find the filter badge block (`{activeFilter !== 'all' && ...}`). Inside it there is a `<Text style={styles.filterText}>` element with a deeply nested ternary. Replace just the content of that Text:

```tsx
<Text style={styles.filterText}>{FILTER_LABELS[activeFilter]}</Text>
```

- [ ] **Step 3: Add role/status lookups in UsersList**

Inside the `UsersList` function (which has `const { t, i18n } = useTranslation()`), add before its `return`:

```typescript
const ROLE_LABELS: Record<string, string> = {
  STUDENT: t('roleStudent'),
  TEACHER: t('roleTeacher'),
  ADMIN:   t('roleAdmin'),
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE:   t('statusActive'),
  PENDING:  t('statusPending'),
  INACTIVE: t('statusInactive'),
};
```

- [ ] **Step 4: Replace raw enum text in badge elements**

Find the role badge `Text` element:

```tsx
<Text style={[styles.roleText, u.role === 'ADMIN' && styles.adminText]}>{u.role}</Text>
```

Replace `{u.role}` with `{ROLE_LABELS[u.role] ?? u.role}`.

Find the status badge `Text` element:

```tsx
<Text style={[styles.statusBadgeText, u.status === 'ACTIVE' && styles.activeBadgeText]}>
  {u.status}
</Text>
```

Replace `{u.status}` with `{STATUS_LABELS[u.status] ?? u.status}`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit
```

Expected: no output. If you get `Type '"PENDING_AND_TEACHER"' is not assignable` on FILTER_LABELS, verify that `FilterType` in `admin/home.tsx` includes `'PENDING_AND_TEACHER'` (it was added in the previous session).

- [ ] **Step 6: Manual test**

Login as `admin@education.com` / `Admin1234!`. Verify:
- Default filter badge shows "عرض المعلقة والمعلمين"
- User cards show "طالب" / "معلم" for roles, "نشط" / "معلق" for status
- Tapping Students stat card → badge changes to "عرض الطلاب"
- Tapping the ✕ on the badge → badge disappears (filter resets to 'all')

- [ ] **Step 7: Commit**

```bash
cd /Users/haskhr/Documents/opencode/education_management && \
git add mobile/app/admin/home.tsx && \
git commit -m "fix(admin): filter badge label for all states, localize role and status badges"
```

---

## Task 6: Fix Student Grades — Date Locale

**Files:**
- Modify: `mobile/app/student/grades.tsx`

> Context: The `renderGrade` render function calls `toLocaleDateString('en-US', ...)` with the locale hardcoded. The component already has `const { t } = useTranslation()` — we extend the destructure to include `i18n` and use `i18n.language` to pick the locale dynamically.

- [ ] **Step 1: Add `i18n` to useTranslation destructure**

In `mobile/app/student/grades.tsx`, inside `StudentGradesScreen`, find:

```typescript
const { t } = useTranslation();
```

Change to:

```typescript
const { t, i18n } = useTranslation();
```

- [ ] **Step 2: Fix the date locale**

Inside `renderGrade`, find:

```typescript
{new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
```

Replace with:

```typescript
{new Date(item.createdAt).toLocaleDateString(
  i18n.language === 'ar' ? 'ar-SA' : 'en-US',
  { month: 'short', day: 'numeric', year: 'numeric' }
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Manual test**

Login as `student@education.com`. Tap **درجاتي** (My Grades). Verify grade card dates show in Arabic format (e.g., "٧ مايو ٢٠٢٦").

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode/education_management && \
git add mobile/app/student/grades.tsx && \
git commit -m "fix(student): use Arabic locale for grade dates in Arabic mode"
```

---

## Final Verification

- [ ] **Full TypeScript check across the project**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit
```

Expected: no output.

- [ ] **Manual regression sweep**

| Account | Credentials | What to verify |
|---------|-------------|----------------|
| `teacher@education.com` | `Teacher1234!` | Dark mode toggle works · Stats show real counts · No "45%" bar on student cards · Progress Report → stub screen |
| `student@education.com` | `Student1234!` | Schedule tab: "لم يُعيّن لك معلمك أي مراجعات بعد" · Grades dates in Arabic |
| `admin@education.com` | `Admin1234!` | Default filter badge: "عرض المعلقة والمعلمين" · User cards show Arabic role/status |
