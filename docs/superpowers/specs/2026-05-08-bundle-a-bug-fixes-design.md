# Bundle A: Critical Bug Fixes + Code Integrity — Design Spec
**Date:** 2026-05-08
**Scope:** Mobile-only. Zero backend changes. Eight live bugs fixed.

---

## Goal

Fix all identified correctness bugs before layering new features on top of broken foundations. Every fix is surgical — no refactoring, no new features.

---

## Files Changed

| File | Action |
|------|--------|
| `mobile/app/teacher/home.tsx` | Fix dark mode, stats row, student card, report button |
| `mobile/app/student/home.tsx` | Fix revision schedule empty state strings |
| `mobile/app/admin/home.tsx` | Fix filter badge + localize role/status badges |
| `mobile/app/student/grades.tsx` | Fix date locale |
| `mobile/app/teacher/reports.tsx` | **New** — stub screen replacing crashing route |
| `mobile/src/i18n/index.ts` | Add 11 new translation keys |

---

## Fix 1 — Teacher Home: Dark Mode Broken

**File:** `mobile/app/teacher/home.tsx`

**Problem:** Line 9 imports `COLORS` statically: `import { COLORS, SHADOWS, RADIUS, SPACING } from '@/constants/theme'`. Dark mode and theme changes have zero effect on the teacher screen.

**Fix:**
- Change import to `import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme'`
- Add `import { useSettingsStore } from '@/src/settings/store'`
- Add `const { theme, darkMode } = useSettingsStore()` inside the component
- Add `const COLORS = getColors(theme, darkMode)` after the store call
- All existing `COLORS.xxx` references continue to work unchanged

---

## Fix 2 — Teacher Home: Stats Row Hardcoded Numbers

**File:** `mobile/app/teacher/home.tsx`

**Problem:** Stats row shows hardcoded `12` (assignments) and `85%` (completion). These are mock values that never update.

**Fix:** Replace three stats with real data derived from the already-loaded `appointments` array:
- Stat 1: `appointments.length` — label `t('myStudents')`
- Stat 2: `appointments.filter(a => a.status === 'ACCEPTED').length` — label `t('activeStudents')`
- Stat 3: `appointments.filter(a => a.status === 'REQUESTED').length` — label `t('awaitingApproval')`

No extra API call needed — `appointments` is already fetched on mount.

---

## Fix 3 — Teacher Home: Student Card Hardcoded Progress

**File:** `mobile/app/teacher/home.tsx`

**Problem:** Lines 149–157 render a hardcoded "Surah Al-Baqarah — 45%" progress bar inside each student card. This is mock data that never changes.

**Fix:** Remove the `studentProgress` View section entirely. Replace with one metadata line:
```tsx
<Text style={styles.metaText}>
  📅 {t('sinceDate')}: {new Date(a.requestedDate).toLocaleDateString(
    i18n.language === 'ar' ? 'ar-SA' : 'en-US'
  )}
</Text>
```
Real per-student memorization % requires one API call per student (N+1 problem) — addressed in Bundle D when teacher opens a student's detail screen.

---

## Fix 4 — Teacher Home: Progress Report Button Crash

**File:** `mobile/app/teacher/home.tsx`

**Problem:** Assignments tab has a "Progress Report" button navigating to `/teacher/reports`. That route does not exist — results in a crash or blank screen.

**Fix:** No change to the button. Once `mobile/app/teacher/reports.tsx` (Fix 8) is created, Expo Router auto-registers the route and the button works.

---

## Fix 5 — Student Home: Revision Schedule Empty State

**File:** `mobile/app/student/home.tsx`

**Problem:** `RevisionScheduleTab` shows generic "No revisions yet" when empty, which reads as broken rather than unassigned.

**Fix:**
1. In `RevisionScheduleTab`, change `const { i18n } = useTranslation()` → `const { t, i18n } = useTranslation()`
2. Replace the `emptyDesc` Text content with `{t('noRevisionsAssigned')}`

New i18n values:
- Arabic: `لم يُعيّن لك معلمك أي مراجعات بعد`
- English: `Your teacher hasn't assigned any revisions yet.`

---

## Fix 6 — Admin Home: Filter Badge Missing Label

**File:** `mobile/app/admin/home.tsx`

**Problem:** Default filter is `PENDING_AND_TEACHER` but the filter badge conditional has no case for it — renders blank.

**Fix:** Replace the nested ternary chain with a lookup object:
```typescript
const FILTER_LABELS: Record<FilterType, string> = {
  all:                 '',
  STUDENT:             i18n.language === 'ar' ? 'عرض الطلاب'              : 'Showing Students',
  TEACHER:             i18n.language === 'ar' ? 'عرض المعلمين'            : 'Showing Teachers',
  PENDING:             i18n.language === 'ar' ? 'عرض المعلقة'             : 'Showing Pending',
  PENDING_AND_TEACHER: i18n.language === 'ar' ? 'عرض المعلقة والمعلمين'  : 'Showing Pending & Teachers',
};
```
Use `FILTER_LABELS[activeFilter]` in the badge `Text` element.

---

## Fix 7 — Admin Home: Role/Status Badges Show Raw Enum

**File:** `mobile/app/admin/home.tsx`

**Problem:** User cards display raw DB enum values: "STUDENT", "TEACHER", "ADMIN", "ACTIVE", "PENDING", "INACTIVE".

**Fix:** Replace raw string values in badge `Text` elements with `t()` calls:

| Raw value | i18n key |
|-----------|----------|
| `'STUDENT'` | `t('roleStudent')` |
| `'TEACHER'` | `t('roleTeacher')` |
| `'ADMIN'` | `t('roleAdmin')` |
| `'ACTIVE'` | `t('statusActive')` |
| `'PENDING'` | `t('statusPending')` |
| `'INACTIVE'` | `t('statusInactive')` |

---

## Fix 8 — Student Grades: Date Locale Hardcoded en-US

**File:** `mobile/app/student/grades.tsx`

**Problem:** Line 73 calls `toLocaleDateString('en-US', ...)` regardless of app language — Arabic users see English dates.

**Fix:**
```typescript
// Add i18n to the useTranslation destructure (already has t)
const { t, i18n } = useTranslation();

// Line 73 — replace 'en-US' with:
i18n.language === 'ar' ? 'ar-SA' : 'en-US'
```

---

## New File — Teacher Reports Stub

**File:** `mobile/app/teacher/reports.tsx`

Minimal stub so `/teacher/reports` resolves cleanly. No data fetching, no state.

Layout:
- `SafeAreaView` with `COLORS.background`
- Header row: back arrow (`router.back()`) + title `t('progressReports')`
- Centered body: `📊` icon (fontSize 48), title `t('progressReports')`, subtitle `t('comingSoon')`
- Styled to match other secondary screens (same header pattern as `student/grades.tsx`)

---

## i18n Changes

**File:** `mobile/src/i18n/index.ts`

Add to both `arTranslations` and `enTranslations`:

```
noRevisionsAssigned   ar: 'لم يُعيّن لك معلمك أي مراجعات بعد'   en: "Your teacher hasn't assigned any revisions yet."
roleStudent           ar: 'طالب'           en: 'Student'
roleTeacher           ar: 'معلم'           en: 'Teacher'
roleAdmin             ar: 'مشرف'           en: 'Admin'
statusActive          ar: 'نشط'            en: 'Active'
statusPending         ar: 'معلق'           en: 'Pending'
statusInactive        ar: 'غير نشط'        en: 'Inactive'
progressReports       ar: 'تقارير التقدم'  en: 'Progress Reports'
comingSoon            ar: 'قريباً'          en: 'Coming Soon'
sinceDate             ar: 'منذ'            en: 'Since'
```

---

## Error Handling

No new error paths. All fixes are string replacements or derived-data calculations — no new async operations.

---

## Testing

Manual happy-path on iOS simulator with seed accounts:

1. **`teacher@education.com`** — dark mode toggle works; stats show real appointment counts; student cards show date not "Surah Al-Baqarah 45%"; Assignments tab → Progress Report → stub screen appears
2. **`student@education.com`** — Schedule tab empty state reads "Your teacher hasn't assigned any revisions yet."; Grades screen dates show in Arabic format
3. **`admin@education.com`** — filter badge shows "عرض المعلقة والمعلمين" by default; user cards show "طالب" / "نشط" etc.

No backend tests required — zero backend changes.
