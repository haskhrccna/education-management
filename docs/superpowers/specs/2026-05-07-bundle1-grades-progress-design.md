# Bundle 1: Grades & Progress — Design Spec
**Date:** 2026-05-07
**Approach:** Full Academic Loop (Option B)

## Overview

Connect the app's academic core: teachers assign grades, students view them, and the student home Surahs tab shows real memorization data instead of hardcoded mocks. The `Surah`, `MemorizationProgress`, and `RevisionSchedule` models already exist in the DB schema — this bundle adds the missing API routes and mobile screens to surface them.

## What Gets Built

| Layer | Item | Status |
|-------|------|--------|
| Backend | `GET /api/v1/surahs` | New |
| Backend | `GET /api/v1/memorization` | New |
| Backend | `PUT /api/v1/memorization/:surahId` | New |
| Mobile API | `mobile/src/api/memorization.ts` | New |
| Mobile Hook | `mobile/src/hooks/useMemorization.ts` | New |
| Mobile Screen | `mobile/app/teacher/grade-form.tsx` | New |
| Mobile Screen | `mobile/app/student/grades.tsx` | New |
| Mobile Screen | `mobile/app/teacher/student-detail.tsx` | New |
| Mobile Update | `mobile/app/student/home.tsx` (Surahs + Progress tabs) | Updated |
| Mobile Update | `mobile/app/teacher/home.tsx` (student tap + grade button) | Updated |

## Backend Design

### New Routes — `memorization.routes.ts`

```
GET  /api/v1/surahs                 — any authenticated user: list all 114 surahs
GET  /api/v1/memorization           — student: own progress; teacher/admin: ?studentId=uuid
PUT  /api/v1/memorization/:surahId  — teacher only: update a student's memorized ayah count
```

### `GET /surahs`
- Auth: `authenticate` (any role)
- Returns all rows from `Surah` ordered by `number` asc
- Response: `{ id, number, nameAr, nameEn, ayahCount, juz }[]`

### `GET /memorization`
- Auth: `authenticate`
- STUDENT caller: returns own `MemorizationProgress` joined with `Surah`
- TEACHER / ADMIN caller: requires `?studentId=uuid`; returns that student's progress
- Surahs with no progress row are omitted from the response — client merges with full surah list to fill gaps with `{ memorizedAyahs: 0, status: 'NOT_STARTED' }`
- Response: `{ surahId, memorizedAyahs, status, lastRecitedAt, surah: { number, nameAr, nameEn, ayahCount, juz } }[]`

### `PUT /memorization/:surahId`
- Auth: `authenticate` + `authorize(TEACHER)`
- Body: `{ studentId: uuid, memorizedAyahs: number, status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' }`
- Validates teacher has at least one ACCEPTED appointment with the student (403 otherwise)
- If `memorizedAyahs >= surah.ayahCount` and `status` not provided, auto-sets `status = 'COMPLETE'`
- Upserts `MemorizationProgress` for `[userId=studentId, surahId]`
- Response: updated `MemorizationProgress` with surah join

### New files
- `packages/server/src/controllers/memorization.controller.ts`
- `packages/server/src/services/memorization.service.ts`
- `packages/server/src/routes/memorization.routes.ts`
- Registered in `app.ts`: `app.use('/api/v1/surahs', surahRouter)` and `app.use('/api/v1/memorization', memorizationRouter)`

## Mobile Design

### New: `mobile/src/api/memorization.ts`

Types:
```typescript
interface MemorizationEntry {
  surahId: number;
  memorizedAyahs: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  lastRecitedAt?: string;
  surah: { number: number; nameAr: string; nameEn: string; ayahCount: number; juz: number };
}
interface Surah {
  id: number; number: number; nameAr: string; nameEn: string; ayahCount: number; juz: number;
}
```

Methods:
- `getMine()` → `GET /memorization`
- `getStudentProgress(studentId)` → `GET /memorization?studentId=xxx`
- `updateProgress(surahId, studentId, memorizedAyahs, status?)` → `PUT /memorization/:surahId`
- `getSurahs()` → `GET /surahs`

Re-exported from `mobile/src/api/index.ts`.

### New: `mobile/src/hooks/useMemorization.ts`
- State: `progress: MemorizationEntry[]`, `isLoading`, `error`
- `fetchProgress()` calls `memorizationApi.getMine()`

### New: `mobile/app/teacher/grade-form.tsx`

Entry points:
- Teacher home → Assignments tab → "Add Review Task" button (fixes the currently broken `/teacher/grades` route)
- Teacher student-detail → "Add Grade for [name]" button (passes `?studentId=uuid` query param to pre-fill student picker)

Fields:
| Field | Input | Source |
|-------|-------|--------|
| Student | Picker | `appointmentsApi.getMine()` filtered to `status === 'ACCEPTED'`, pre-filled if `studentId` param present |
| Subject | TextInput (free text) | e.g. "Al-Baqarah ayahs 1–50" |
| Score | TextInput (numeric) | stored as string in Grade model |
| Type | Picker | QUIZ / ASSIGNMENT / EXAM / ORAL / PARTICIPATION |
| Notes | Multiline TextInput (optional) | |

Behaviour:
- Submit button disabled until student, subject, score, and type are all filled
- On submit: `gradesApi.create({ studentId, subject, grade: score, type, notes })`
- On success: success alert, `router.back()`
- On error: inline error message

### New: `mobile/app/student/grades.tsx`

Accessed via "My Grades" button added to student home header row (next to logout).

Data: `useGrades` hook (already exists) → `GET /grades`

Layout:
- Stats row: avg score (mean of numeric-parseable grade values), total grade count
- Chronological list of grade cards:
  - Colour-coded left border by type (ORAL=blue, QUIZ=green, EXAM=red, ASSIGNMENT=amber, PARTICIPATION=purple)
  - Type badge, subject text, score (right-aligned), date, teacher name
- Empty state when no grades
- Pull-to-refresh

### New: `mobile/app/teacher/student-detail.tsx`

Navigated to from teacher home My Students tab: `router.push('/teacher/student-detail?id=' + student.id)`

Route param: `id` (student userId)

Data fetched in parallel on mount:
- `gradesApi.getStudentGrades(id)` → `GET /grades/student/:id`
- `memorizationApi.getStudentProgress(id)` → `GET /memorization?studentId=id`

Layout:
- Header: student full name, status badge, join date
- Stats row: avg grade (numeric grades), grade count, overall memorization % (memorizedAyahs / totalAyahs across all surahs)
- "Recent Grades" section: same card style as student grades screen (latest 5)
- "Add Grade for [firstName]" primary button → `router.push('/teacher/grade-form?studentId=' + id)`

### Updated: `mobile/app/student/home.tsx`

Surahs tab:
- Remove `SURAH_DATA` and `REVISION_SCHEDULE` constants
- Add `useMemorization` hook; call `fetchProgress()` on mount
- Map `MemorizationEntry[]` → existing `Surah[]` shape the tab already renders
- Show `ActivityIndicator` while loading; show empty-state card if no entries

Progress tab:
- Derive `completedSurahs`, `totalMemorized`, `totalAyahsAll`, `currentJuz` from real hook data instead of mock constants
- Weekly streak stays hardcoded (out of scope — no streak tracking model)

Header stats row:
- Derive from real data

Add "My Grades" `TouchableOpacity` in header next to logout → `router.push('/student/grades')`

### Updated: `mobile/app/teacher/home.tsx`

My Students tab:
- Wrap each student card in `TouchableOpacity` → `router.push('/teacher/student-detail?id=' + a.student.id)`

Assignments tab:
- "Add Review Task" button → `router.push('/teacher/grade-form')` (was `/teacher/grades`, which doesn't exist)

## Navigation Summary

```
/teacher/grade-form              — new (Expo Router auto-registers)
/teacher/student-detail          — new
/student/grades                  — new
```

No changes to `_layout.tsx` required.

## Error Handling

- Backend errors use existing `AppError` → error middleware → `{ success: false, error: message }`
- `PUT /memorization/:surahId`: 403 if teacher has no ACCEPTED appointment with student
- Mobile hooks expose `error` string; screens show inline error + retry button on failure
- Grade form: client-side field validation disables submit; server-side `CreateGradeSchema` is the authoritative guard

## Testing

Backend unit tests (new files):
- `memorization.controller.test.ts`: list surahs, get own progress (student), get student progress (teacher), update progress, 403 on missing appointment
- `memorization.service.test.ts`: upsert logic, auto-complete status, ayahCount boundary

Mobile: manual happy-path on iOS simulator using seed data (`admin@education.com` / `Admin1234!`, `teacher@education.com`, `student@education.com`).
