# F10b Parent UX Rethink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `parent/home.tsx` from a child-selector-plus-single-detail-panel into a stack of self-contained per-child cards (today's session, last grade, streak, consent/digest toggles, and three working action chips: View report, View recordings, Send message), per AC5.3.

**Architecture:** The spec claimed "no server changes." That claim does not survive contact with the code: `childDashboard` doesn't expose a child's assigned teacher (needed for "Send message") or streak (needed for the gold metric); no parent-scoped read path exists for reports or recordings (needed for the other two action chips); and even where a parent could theoretically discover a recording/report id, the file-download authorization check has no PARENT branch at all — it would 403. Three small, additive server changes come first. Then the mobile API layer widens to match, `useParent()` is restructured from a single-selected-dashboard model to a per-child dashboard map (every card needs its own header data simultaneously, not just the one the user tapped), then the screen itself, then the two new lightweight viewer screens the action chips route to.

**Tech Stack:** Express 5 + Zod contracts + Prisma (server); Expo SDK 54 / React Native / expo-router, `expo-av` (recording playback via system browser, not in-app), i18next (mobile); Jest + supertest (server integration tests).

## Global Constraints

- **Role case:** DB/JWT/`authorize()` use UPPERCASE (`PARENT`, `ADMIN`, `TEACHER`, `STUDENT`). Never compare roles with lowercase strings in server code.
- **Errors:** throw `new AppError(statusCode, message)` — never raw errors. The centralised `errorHandler` in `app.ts` handles all errors.
- **The one Phase-3 invariant:** a parent may read a child's data only when there is an `APPROVED` `ParentLink` row between them. `assertParentHasApprovedLink(parentId, studentId)` in `packages/server/src/services/parent.service.ts` is the single guard for this — reuse it, don't reimplement it.
- **i18n:** every new key must exist in **both** `arTranslations` and `enTranslations` in `mobile/src/i18n/index.ts`. Arabic is the primary language.
- **New user-facing strings must go through `t('key')`.** `mobile/scripts/check-i18n.js` ratchets inline `isAr ? 'ar' : 'en'` ternaries at `TERNARY_BASELINE = 245` (current value — verify with `grep -n "TERNARY_BASELINE" mobile/scripts/check-i18n.js` before Task 4, it may have moved) and fails if the count rises.
- **DESIGN.md — Rationed Gold:** gold marks earned achievement only. The per-child streak is the one legitimate `tone="gold"` element in this cluster; nothing else on the card (session, grades, attendance, action chips) uses it.
- **DESIGN.md — Status-Is-Not-Only-Color:** status must pair colour with an icon *or* a label.
- **DESIGN.md — one primary action per screen:** the three action chips must not render as three equally-weighted filled primary buttons competing with each other. Text-action or tonal-icon style, not solid-fill triplets.
- **Tap targets:** ≥44pt, with `hitSlop` where the visual target is smaller.
- **Typography:** use `AppText` variants — no raw `<Text>` with hard-coded `fontSize`.

## Known-Correct Facts (verified against the running system — do not re-derive)

| Fact | Evidence |
|---|---|
| `useParent()` holds exactly ONE `dashboard: ChildDashboard \| null`, populated by `selectChild(studentId)`. It is used only by `parent/home.tsx` and `parent/link-request.tsx` (the latter uses only `searchStudent`/`requestLink`) | `mobile/src/hooks/useParent.ts`; `grep -rln "useParent\b" app src` |
| ⇒ restructuring `dashboard`/`selectChild` to a multi-child map is safe — nothing else depends on the single-dashboard shape | follows from the above |
| `assertParentHasApprovedLink` exists but is **not exported** (module-private `async function` in `parent.service.ts`) | `packages/server/src/services/parent.service.ts:212` |
| `getChildDashboard`'s `student` select is `{id, firstName, lastName, email, status, createdAt}` — **no `assignedTeacherId`, no streak anywhere in the response** | `parent.service.ts:151-203` |
| `assignedTeacherId` (nullable) + `assignedTeacher` relation already exist on the `User` model — this is the schema's own authoritative "child's teacher" concept, the same one CLAUDE.md's Teacher-Student Relationship Guard and Teacher Change Approval sections operate on | `schema.prisma:125,132` |
| The `childDashboard` contract's response fields (`memorization`/`grades`/`attendance`/`upcomingAppointments`/`pendingRevisions`) are all typed `z.array(z.unknown())` at the contract layer — real typing lives client-side in `mobile/src/api/parents.ts`'s `ChildDashboard` interface. Only `student: MiniStudent` is strictly typed | `packages/shared/src/contracts/progress.contracts.ts:98-118` |
| `Streak` is keyed by `userId` (any user, including students) but the only read path (`gamificationMe`, `GET /api/v1/gamification/me`) is strictly self-scoped — no endpoint lets anyone read another user's streak, parent-linked or not | `schema.prisma:585-595`; `packages/shared/src/contracts/progress.contracts.ts:25-34`; `packages/server/src/services/gamification.service.ts:164-176` |
| `mediaContracts.listReports` has **no `request.query` schema at all** and `access: [TEACHER, ADMIN, STUDENT]` — no PARENT, and the server handler ignores any client-supplied `studentId` regardless (`reportService.listMyReports(userId, userRole)` scopes strictly to the caller's own id/authored reports) | `packages/shared/src/contracts/media.contracts.ts:82-88`; `packages/server/src/modules/reports/reports.module.ts:10`; `packages/server/src/services/report.service.ts:132-135` |
| `mediaContracts.listRecordings` is `access: 'authenticated'`, but `recording.service.ts`'s `listRecordings(userId, userRole)` has no PARENT branch — a parent calling it falls into the `else` clause and gets `where: { studentId: userId }`, i.e. queries for recordings owned by the *parent's own id*, which never match anything. Not a security hole (returns nothing), but the endpoint cannot serve a parent's actual need | `packages/server/src/services/recording.service.ts:90-101` |
| **The file-download authorization gap is the one the original spec entirely missed.** `resolveRecordingDownload`/`resolveReportDownload` in `file.service.ts` check `isOwner \|\| isAdmin \|\| isTeacher` — **no PARENT branch at all**. Even a mobile screen that correctly lists a child's reports/recordings would 403 the instant the parent tried to open one | `packages/server/src/services/file.service.ts:19-59` |
| `downloadRecordingFile`/`downloadReportFile` contracts already use `authVia: 'headerOrQueryToken'` (the `?token=` fallback `WebBrowser.openBrowserAsync` needs, since it cannot attach an `Authorization` header) — this plumbing is already correct, only the authorization check inside the resolver needs a PARENT branch | `packages/shared/src/contracts/media.contracts.ts:90-115` |
| `reportsApi.downloadReport(id)` already does the exact `WebBrowser.openBrowserAsync(`${API_ORIGIN}/api/v1/files/reports/${id}?token=...`)` pattern this plan reuses for recordings — `recordingsApi` has no equivalent method yet | `mobile/src/api/reports.ts` |
| Test-fixture pattern for an APPROVED parent link, confirmed working: `createUser({role: Role.PARENT})` + `createUser({role: Role.STUDENT})`, `prisma.parentLink.create({data:{parentId,studentId}})`, then `PATCH /api/v1/parents/links/:id/decision` with `{action:'APPROVE'}` as an admin (or `prisma.parentLink.update` directly) | `packages/server/src/__integration__/guardian-consent.itest.ts:12-33` |
| `createUser` factory already accepts `assignedTeacherId` directly — no separate update call needed in tests | `packages/server/src/__integration__/factory.ts:21-27` |
| `arTranslations` currently closes at line 496, `enTranslations` at line 981 in `mobile/src/i18n/index.ts` — **re-verify with `grep -n "^};" mobile/src/i18n/index.ts` before Task 4**, F10a's merge may have shifted these | measured 2026-07-29, will drift |
| `design.tsx` re-exports `AppText` from `./AppText` — importing everything from `@/src/components/design` (the pattern `parent/home.tsx` already uses) is equivalent to the two-import style admin screens use | `mobile/src/components/design.tsx:3,9` |
| `student/reports.tsx` and `teacher/recordings.tsx` exist but use an **older pattern** (raw `<Text>`, hard-coded styles, no `AppText`) and, for recordings, ~700 lines of grading/annotation UI this feature does not need. New screens in this plan follow the *current* design system (`AppText`/`design.tsx`), not these two files' style | `mobile/app/student/reports.tsx`; `mobile/app/teacher/recordings.tsx` |

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/contracts/progress.contracts.ts` | **Modify** — widen `childDashboard`'s `student` field with an optional `assignedTeacher`, add `streak`; add two new contracts, `parentChildReports` and `parentChildRecordings` |
| `packages/server/src/services/parent.service.ts` | **Modify** — export `assertParentHasApprovedLink`; extend `getChildDashboard`'s student select + add a parallel streak fetch; add `getChildReports`, `getChildRecordings` |
| `packages/server/src/modules/parents/parents.module.ts` | **Modify** — mount the two new routes |
| `packages/server/src/services/file.service.ts` | **Modify** — add a PARENT branch (via `assertParentHasApprovedLink`) to `resolveRecordingDownload` and `resolveReportDownload` |
| `packages/server/src/__integration__/progress-flows.itest.ts` | **Modify** — cover `assignedTeacher`/`streak` on `childDashboard` |
| `packages/server/src/__integration__/parent-media.itest.ts` | **New** — covers the two new list endpoints and the parent-download-authorization fix |
| `mobile/src/api/parents.ts` | **Modify** — widen `ChildDashboard`; add `getChildReports`, `getChildRecordings` |
| `mobile/src/api/recordings.ts` | **Modify** — add `downloadRecording(id)`, mirroring `reportsApi.downloadReport` |
| `mobile/src/hooks/useParent.ts` | **Modify** — replace single `dashboard`/`selectChild` with a `dashboards: Record<string, ChildDashboard>` map, fetched in parallel for every linked child |
| `mobile/src/i18n/index.ts` | **Modify** — new keys, both languages |
| `mobile/app/parent/home.tsx` | **Modify** — full restructure to stacked per-child cards |
| `mobile/app/parent/child-reports.tsx` | **New** — reports list for one child, routed from the "View report" chip |
| `mobile/app/parent/child-recordings.tsx` | **New** — recordings list for one child, routed from the "View recordings" chip |
| `mobile/app/parent/link-request.tsx` | **Modify** — visual polish only, per spec |

---

### Task 1: Server — widen `childDashboard` with `assignedTeacher` and `streak`

**Files:**
- Modify: `packages/server/src/services/parent.service.ts:151-219`
- Modify: `packages/shared/src/contracts/progress.contracts.ts:98-118`
- Test: `packages/server/src/__integration__/progress-flows.itest.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `GET /api/v1/parents/children/:studentId/dashboard` response gains `student.assignedTeacher: {id, firstName, lastName} | null` and a top-level `streak: {currentStreak: number, longestStreak: number}` (zero-defaulted, never null, matching `gamification.service.ts`'s own fallback convention).

- [ ] **Step 1: Write the failing tests**

Append to `packages/server/src/__integration__/progress-flows.itest.ts` (find its `describe('GET /api/v1/parents/children/:studentId/dashboard'`-style block, or add a new one if the file organizes differently — check first):

```ts
describe('GET /api/v1/parents/children/:studentId/dashboard — assignedTeacher and streak', () => {
  it('includes the assigned teacher when one is set', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT, assignedTeacherId: teacher.id });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/dashboard`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.student.assignedTeacher).toMatchObject({ id: teacher.id });
  });

  it('returns assignedTeacher: null when the student has no assigned teacher', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/dashboard`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.body.data.student.assignedTeacher).toBeNull();
  });

  it('returns a zero-defaulted streak when the student has never had one recorded', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/dashboard`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.body.data.streak).toMatchObject({ currentStreak: 0, longestStreak: 0 });
  });

  it('returns the real streak when one exists', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    await prisma.streak.create({
      data: { userId: student.id, currentStreak: 5, longestStreak: 12, lastActiveDate: new Date() },
    });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/dashboard`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.body.data.streak).toMatchObject({ currentStreak: 5, longestStreak: 12 });
  });
});
```

Ensure `prisma` is imported in the test file (`import { prisma } from '../prisma/client';`) — check first, `progress-flows.itest.ts` likely already imports it for other tests in the same file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/server && npx jest -c jest.integration.config.js --runInBand --testPathPatterns=progress-flows`
Expected: the four new tests FAIL — `assignedTeacher` and `streak` are `undefined` on the response.

- [ ] **Step 3: Export the guard and extend the contract schema**

In `packages/server/src/services/parent.service.ts`, change the guard's declaration from a private function to an exported one:

```ts
export async function assertParentHasApprovedLink(parentId: string, studentId: string) {
```

(Same body, just add `export`.)

In `packages/shared/src/contracts/progress.contracts.ts`, replace the `childDashboard` contract's `responses[200]` body. Add a locally-scoped extended student schema right above the `childDashboard` contract definition — do **not** modify the shared `MiniStudent` const itself, since it's reused by `parentStudentSearch` and (via `ChildSummary`) `parentChildren`:

```ts
const MiniStudentWithTeacher = MiniStudent.extend({
  assignedTeacher: z.looseObject({ id: z.string(), firstName: z.string(), lastName: z.string() }).nullable(),
});
```

Then update the `childDashboard` contract:

```ts
  childDashboard: defineContract({
    method: 'GET',
    path: '/api/v1/parents/children/:studentId/dashboard',
    summary: 'Read-only child dashboard; requires APPROVED link (403 otherwise)',
    access: [UserRole.PARENT],
    responses: {
      200: Ok(
        z.looseObject({
          student: MiniStudentWithTeacher,
          memorization: z.array(z.unknown()),
          grades: z.array(z.unknown()),
          attendance: z.array(z.unknown()),
          upcomingAppointments: z.array(z.unknown()),
          pendingRevisions: z.array(z.unknown()),
          streak: z.unknown(),
        })
      ),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
```

- [ ] **Step 4: Extend `getChildDashboard`**

In `packages/server/src/services/parent.service.ts`, replace the body of `getChildDashboard`:

```ts
export const getChildDashboard = async (parentId: string, studentId: string) => {
  await assertParentHasApprovedLink(parentId, studentId);

  const [student, memorization, grades, attendance, upcomingAppointments, pendingRevisions, streak] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          createdAt: true,
          assignedTeacher: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.memorizationProgress.findMany({
        where: { userId: studentId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { surah: { select: { number: true, nameAr: true, nameEn: true, juz: true } } },
      }),
      prisma.grade.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { teacher: { select: { firstName: true, lastName: true } } },
      }),
      prisma.sessionRecord.findMany({
        where: { studentId },
        orderBy: { recordedAt: 'desc' },
        take: 5,
        include: {
          appointment: { select: { requestedDate: true, requestedTime: true } },
        },
      }),
      prisma.appointment.findMany({
        where: { studentId, status: { in: ['REQUESTED', 'ACCEPTED'] } },
        orderBy: { requestedDate: 'asc' },
        take: 5,
        include: { teacher: { select: { firstName: true, lastName: true } } },
      }),
      prisma.revisionSchedule.findMany({
        where: { userId: studentId, status: 'PENDING' },
        orderBy: { scheduledFor: 'asc' },
        take: 5,
        include: { surah: { select: { number: true, nameAr: true, nameEn: true } } },
      }),
      // Zero-defaulted, matching gamification.service.ts's own convention — a
      // student who has never logged activity has no Streak row at all.
      prisma.streak.findUnique({ where: { userId: studentId } }),
    ]);

  if (!student) throw new AppError(404, 'Student not found');

  return {
    student,
    memorization,
    grades,
    attendance,
    upcomingAppointments,
    pendingRevisions,
    streak: streak ?? { userId: studentId, currentStreak: 0, longestStreak: 0, lastActiveDate: null },
  };
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/server && npx jest -c jest.integration.config.js --runInBand --testPathPatterns=progress-flows`
Expected: PASS — all four new tests plus every pre-existing test in the file.

- [ ] **Step 6: Verify nothing else regressed**

Run: `cd packages/server && npm test` (unit suite) and `npx jest -c jest.integration.config.js --runInBand` (full integration suite, from `packages/server`)
Expected: both green, no new failures.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/services/parent.service.ts packages/shared/src/contracts/progress.contracts.ts packages/server/src/__integration__/progress-flows.itest.ts
git commit -m "feat(parents): expose assignedTeacher and streak on the child dashboard

AC5.3's per-child card needs the child's teacher (for the Send message
action chip) and current streak (the card's one legitimate gold element).
Neither existed on childDashboard's response. assignedTeacherId is the
schema's own authoritative 'child's teacher' concept — the same one the
Teacher-Student Relationship Guard and Teacher Change Approval flows use —
so this reads it directly rather than deriving it from appointment history.

Streak has no other parent-facing read path; gamificationMe is strictly
self-scoped. Zero-defaults exactly like gamification.service.ts's own
getMyGamification does for a student with no Streak row yet."
```

---

### Task 2: Server — parent-scoped reports/recordings lists, and fix the file-download authorization gap

**Files:**
- Modify: `packages/shared/src/contracts/progress.contracts.ts`
- Modify: `packages/server/src/services/parent.service.ts`
- Modify: `packages/server/src/modules/parents/parents.module.ts`
- Modify: `packages/server/src/services/file.service.ts:19-59`
- Test: `packages/server/src/__integration__/parent-media.itest.ts` (new)

**Interfaces:**
- Consumes: `assertParentHasApprovedLink` (exported in Task 1).
- Produces:
  - `GET /api/v1/parents/children/:studentId/reports` → `{ success: true, data: ReportSummary[] }`, PARENT-only.
  - `GET /api/v1/parents/children/:studentId/recordings` → `{ success: true, data: RecordingSummary[] }`, PARENT-only.
  - `resolveRecordingDownload`/`resolveReportDownload` now authorize a PARENT with an APPROVED link to the recording's/report's `studentId`, in addition to owner/admin/teacher.

- [ ] **Step 1: Write the failing tests**

Create `packages/server/src/__integration__/parent-media.itest.ts`:

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

async function approvedLink(parentId: string, studentId: string, adminToken: string) {
  const link = await prisma.parentLink.create({ data: { parentId, studentId } });
  await request(app)
    .patch(`/api/v1/parents/links/${link.id}/decision`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'APPROVE' });
}

describe('GET /api/v1/parents/children/:studentId/reports', () => {
  it("lists the child's reports for an approved-link parent", async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    await approvedLink(parent.id, student.id, admin.token);
    await prisma.report.create({
      data: { teacherId: teacher.id, studentId: student.id, pdfUrl: 'reports/x.pdf', summary: 'Q1' },
    });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/reports`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ studentId: student.id, summary: 'Q1' });
  });

  it('403s a parent with no approved link to this student', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/reports`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app).get(`/api/v1/parents/children/${student.id}/reports`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/parents/children/:studentId/recordings', () => {
  it("lists the child's recordings for an approved-link parent", async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    await approvedLink(parent.id, student.id, admin.token);
    await prisma.recording.create({
      data: {
        studentId: student.id,
        url: 'uploads/x.m4a',
        fileName: 'x.m4a',
        fileSizeBytes: 1024,
        contentType: 'audio/m4a',
      },
    });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/recordings`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ studentId: student.id, fileName: 'x.m4a' });
  });

  it('403s a parent with no approved link to this student', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/recordings`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.status).toBe(403);
  });
});

describe('file downloads — parent authorization', () => {
  it('lets an approved-link parent download a report file (via ?token=, matching WebBrowser.openBrowserAsync)', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    await approvedLink(parent.id, student.id, admin.token);
    const report = await prisma.report.create({
      data: { teacherId: teacher.id, studentId: student.id, pdfUrl: 'reports/does-not-exist.pdf', summary: 'x' },
    });

    const res = await request(app).get(`/api/v1/files/reports/${report.id}?token=${parent.token}`);
    // The fixture file genuinely doesn't exist on disk, so this asserts we get
    // PAST authorization (404 "File not found") rather than 403 "Permission
    // denied" — the two are distinguishable and this is the one that matters.
    expect(res.status).toBe(404);
    expect(res.body.error).not.toMatch(/permission/i);
  });

  it('403s a parent with no approved link from downloading a report file', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const report = await prisma.report.create({
      data: { teacherId: teacher.id, studentId: student.id, pdfUrl: 'reports/does-not-exist.pdf', summary: 'x' },
    });

    const res = await request(app).get(`/api/v1/files/reports/${report.id}?token=${parent.token}`);
    expect(res.status).toBe(403);
  });

  it('lets an approved-link parent past authorization for a recording file', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    await approvedLink(parent.id, student.id, admin.token);
    const recording = await prisma.recording.create({
      data: {
        studentId: student.id,
        url: 'uploads/does-not-exist.m4a',
        fileName: 'does-not-exist.m4a',
        fileSizeBytes: 1,
        contentType: 'audio/m4a',
      },
    });

    const res = await request(app).get(`/api/v1/files/recordings/${recording.id}?token=${parent.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).not.toMatch(/permission/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/server && npx jest -c jest.integration.config.js --runInBand --testPathPatterns=parent-media`
Expected: the two list-endpoint groups 404 (route doesn't exist yet); the "lets an approved-link parent" download tests return 403 "Permission denied", not 404.

- [ ] **Step 3: Add the two new contracts**

In `packages/shared/src/contracts/progress.contracts.ts`, add local row schemas and two contracts, placed after `childDashboard`:

```ts
const ParentChildReportRow = z.looseObject({
  id: z.string(),
  teacherId: z.string(),
  studentId: z.string(),
  pdfUrl: z.string(),
  summary: z.string(),
  generatedAt: DateOut,
});

const ParentChildRecordingRow = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  url: z.string(),
  fileName: z.string(),
  fileSizeBytes: z.number(),
  contentType: z.string(),
  approvedAt: DateOut.nullable(),
  rejectedAt: DateOut.nullable(),
  createdAt: DateOut,
});
```

(`DateOut` is already imported at the top of this file — used by `childDashboard`'s sibling contracts. Verify with `grep -n "DateOut" packages/shared/src/contracts/progress.contracts.ts` before writing; if absent, add it to the existing `import { z } from 'zod';` block's neighboring import line, matching how `media.contracts.ts` imports it: `import { defineContract, ErrorEnvelope, DateOut } from './types';`.)

```ts
  parentChildReports: defineContract({
    method: 'GET',
    path: '/api/v1/parents/children/:studentId/reports',
    summary: "A child's reports, newest first. Requires an APPROVED ParentLink (403 otherwise).",
    access: [UserRole.PARENT],
    responses: {
      200: Ok(z.array(ParentChildReportRow)),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  parentChildRecordings: defineContract({
    method: 'GET',
    path: '/api/v1/parents/children/:studentId/recordings',
    summary: "A child's recordings, newest first. Requires an APPROVED ParentLink (403 otherwise).",
    access: [UserRole.PARENT],
    responses: {
      200: Ok(z.array(ParentChildRecordingRow)),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
```

- [ ] **Step 4: Add the service functions**

In `packages/server/src/services/parent.service.ts`, add after `getChildDashboard`:

```ts
export const getChildReports = async (parentId: string, studentId: string) => {
  await assertParentHasApprovedLink(parentId, studentId);
  return prisma.report.findMany({ where: { studentId }, orderBy: { generatedAt: 'desc' } });
};

export const getChildRecordings = async (parentId: string, studentId: string) => {
  await assertParentHasApprovedLink(parentId, studentId);
  return prisma.recording.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } });
};
```

- [ ] **Step 5: Mount the routes**

In `packages/server/src/modules/parents/parents.module.ts`, add after `childDashboard`:

```ts
const childReports = defineRoute(progressContracts.parentChildReports, async ({ userId, params }) => {
  const reports = await parentService.getChildReports(userId!, String(params.studentId));
  return { status: 200 as const, body: { success: true as const, data: reports } };
});

const childRecordings = defineRoute(progressContracts.parentChildRecordings, async ({ userId, params }) => {
  const recordings = await parentService.getChildRecordings(userId!, String(params.studentId));
  return { status: 200 as const, body: { success: true as const, data: recordings } };
});
```

And add both to the `buildContractRouter` array:

```ts
export const parentsRouter = buildContractRouter(
  [requestLink, listLinks, children, studentSearch, childDashboard, childReports, childRecordings, decideLink],
  { mountPrefix: '/api/v1/parents' }
);
```

- [ ] **Step 6: Fix the file-download authorization gap**

In `packages/server/src/services/file.service.ts`, add the import:

```ts
import { assertParentHasApprovedLink } from './parent.service';
```

Replace `resolveRecordingDownload`'s authorization block:

```ts
  const isOwner = recording.studentId === userId;
  const isAdmin = userRole === 'ADMIN';
  const isTeacher = userRole === 'TEACHER';
  const isParent = userRole === 'PARENT';
  if (isParent) {
    await assertParentHasApprovedLink(userId, recording.studentId); // throws 403 if not linked
  } else if (!isOwner && !isAdmin && !isTeacher) {
    throw new AppError(403, 'Permission denied');
  }
  if (isTeacher) await assertTeacherStudentRelationship(userId, recording.studentId);
```

Replace `resolveReportDownload`'s authorization block identically, substituting `report.studentId` for `recording.studentId`:

```ts
  const isOwner = report.studentId === userId;
  const isAdmin = userRole === 'ADMIN';
  const isTeacher = userRole === 'TEACHER';
  const isParent = userRole === 'PARENT';
  if (isParent) {
    await assertParentHasApprovedLink(userId, report.studentId); // throws 403 if not linked
  } else if (!isOwner && !isAdmin && !isTeacher) {
    throw new AppError(403, 'Permission denied');
  }
  if (isTeacher) await assertTeacherStudentRelationship(userId, report.studentId);
```

Do **not** touch `resolveCertificateDownload` — its own comment pins it as "owner or admin only — teachers have no download path," and certificates are out of this plan's scope.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd packages/server && npx jest -c jest.integration.config.js --runInBand --testPathPatterns=parent-media`
Expected: PASS, all 7 tests.

- [ ] **Step 8: Verify nothing else regressed**

Run: `cd packages/server && npm test` and `npx jest -c jest.integration.config.js --runInBand` (from `packages/server`)
Expected: both green. Pay particular attention to any existing recording/report download test (owner/admin/teacher paths) — the authorization block was restructured from a flat `if` to an `if/else if`, so re-verify those three roles still pass exactly as before.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/contracts/progress.contracts.ts packages/server/src/services/parent.service.ts packages/server/src/modules/parents/parents.module.ts packages/server/src/services/file.service.ts packages/server/src/__integration__/parent-media.itest.ts
git commit -m "feat(parents): parent-scoped reports/recordings lists + fix file-download auth

AC5.3's View report / View recordings action chips need two things neither
of which existed: a parent-scoped list read (mediaContracts.listReports has
no PARENT access and no studentId filter that actually does anything;
listRecordings similarly has no PARENT branch and would silently return
nothing), and — the gap the original spec entirely missed — a way to
actually open the file once found. resolveRecordingDownload and
resolveReportDownload in file.service.ts checked owner/admin/teacher only;
a parent with a fully APPROVED link would 403 trying to open a file whose
existence they could see. Both fixed via the same assertParentHasApprovedLink
guard childDashboard already established as this feature's one invariant."
```

---

### Task 3: Mobile — API client widening + `useParent()` restructured to a per-child dashboard map

**Files:**
- Modify: `mobile/src/api/parents.ts`
- Modify: `mobile/src/api/recordings.ts`
- Modify: `mobile/src/hooks/useParent.ts`

**Interfaces:**
- Consumes: the three server endpoints from Tasks 1-2.
- Produces:
  - `ChildDashboard` interface gains `student.assignedTeacher: {id,firstName,lastName} | null` and `streak: {currentStreak: number, longestStreak: number}`.
  - `parentsApi.getChildReports(studentId): Promise<ParentChildReport[]>`, `parentsApi.getChildRecordings(studentId): Promise<ParentChildRecording[]>`.
  - `recordingsApi.downloadRecording(id): Promise<void>` — opens the file in the system browser, mirroring `reportsApi.downloadReport`.
  - `useParent()` returns `dashboards: Record<string, ChildDashboard>` and `dashboardsLoading: boolean` instead of `dashboard`/`selectChild`. **`selectChild` is removed** — every card's data is present as soon as `children` loads, nothing is fetched on tap.

- [ ] **Step 1: Widen `ChildDashboard` and add the two new API methods**

In `mobile/src/api/parents.ts`, update the `ChildDashboard` interface — add to `student` and add a top-level `streak`:

```ts
export interface ChildDashboard {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    createdAt: string;
    assignedTeacher: { id: string; firstName: string; lastName: string } | null;
  };
  memorization: Array<{
    id: string;
    surah: { number: number; nameAr: string; nameEn: string };
    status: string;
    memorizedAyahs: number;
  }>;
  grades: Array<{
    id: string;
    grade: string;
    type: string;
    createdAt: string;
    surah?: { nameAr: string; nameEn: string };
  }>;
  attendance: Array<{ id: string; status: string; recordedAt: string }>;
  upcomingAppointments: Array<{
    id: string;
    requestedDate: string;
    requestedTime: string;
    teacher: { firstName: string; lastName: string };
  }>;
  pendingRevisions: Array<{
    id: string;
    scheduledFor: string;
    status: string;
    surah?: { nameAr: string; nameEn: string };
  }>;
  streak: { currentStreak: number; longestStreak: number };
}

export interface ParentChildReport {
  id: string;
  teacherId: string;
  studentId: string;
  pdfUrl: string;
  summary: string;
  generatedAt: string;
}

export interface ParentChildRecording {
  id: string;
  studentId: string;
  url: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
}
```

Add to the `parentsApi` object, after `getChildDashboard`:

```ts
  getChildReports: async (studentId: string): Promise<ParentChildReport[]> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.parentChildReports, { params: { studentId } }),
      200
    );
    return (res.body as unknown as { data: ParentChildReport[] }).data;
  },
  getChildRecordings: async (studentId: string): Promise<ParentChildRecording[]> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.parentChildRecordings, { params: { studentId } }),
      200
    );
    return (res.body as unknown as { data: ParentChildRecording[] }).data;
  },
```

- [ ] **Step 2: Add the recording download method**

In `mobile/src/api/recordings.ts`, add (mirroring `reportsApi.downloadReport` exactly — check its imports first, `WebBrowser`/`API_ORIGIN`/`secureStorage` may not all be imported into this file yet):

```ts
import * as WebBrowser from 'expo-web-browser';
import { API_ORIGIN } from './contract';
import { secureStorage } from '../storage/secureStorage';
```

(Add only whichever of these three are not already imported — check the top of the file first.)

```ts
  // HOLDOUT: browser download — the audio file opens in the system browser
  // with the pinned ?token= auth; no JSON transport involved. Mirrors
  // reportsApi.downloadReport exactly.
  downloadRecording: async (id: string): Promise<void> => {
    const token = (await secureStorage.getItem('auth_token')) ?? '';
    const url = `${API_ORIGIN}/api/v1/files/recordings/${id}?token=${encodeURIComponent(token)}`;
    await WebBrowser.openBrowserAsync(url);
  },
```

- [ ] **Step 3: Restructure `useParent()` to a per-child dashboard map**

Replace `mobile/src/hooks/useParent.ts` in full:

```ts
import { useCallback, useEffect, useState } from 'react';
import { parentsApi, ParentLink, ChildSummary, ChildDashboard, StudentSearchResult } from '../api/parents';

export type { GuardianConsentStatus } from '../api/parents';

export function useParent() {
  const [links, setLinks] = useState<ParentLink[]>([]);
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [dashboards, setDashboards] = useState<Record<string, ChildDashboard>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const data = await parentsApi.listLinks();
      setLinks(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load links');
    }
  }, []);

  // Every card needs its own header data (today's session, last grade,
  // streak) visible without a tap, so every linked child's dashboard is
  // fetched in parallel up front — not lazily per-selection as before.
  const fetchDashboards = useCallback(async (childList: ChildSummary[]) => {
    if (childList.length === 0) {
      setDashboards({});
      return;
    }
    setDashboardsLoading(true);
    try {
      const results = await Promise.allSettled(
        childList.map((c) => parentsApi.getChildDashboard(c.student.id))
      );
      const next: Record<string, ChildDashboard> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[childList[i].student.id] = r.value;
      });
      setDashboards(next);
    } finally {
      setDashboardsLoading(false);
    }
  }, []);

  const fetchChildren = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await parentsApi.listChildren();
      setChildren(data);
      await fetchDashboards(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load children');
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboards]);

  const requestLink = useCallback(async (studentId: string, reason?: string) => {
    const link = await parentsApi.requestLink(studentId, reason);
    setLinks((prev) => [link, ...prev]);
    return link;
  }, []);

  const searchStudent = useCallback(async (email: string): Promise<StudentSearchResult | null> => {
    try {
      return await parentsApi.searchStudent(email);
    } catch {
      return null;
    }
  }, []);

  const toggleDigest = useCallback(async (linkId: string, digestOptOut: boolean) => {
    // Optimistic — the toggle should feel instant; roll back on failure.
    setChildren((prev) => prev.map((c) => (c.linkId === linkId ? { ...c, digestOptOut } : c)));
    try {
      await parentsApi.setDigestPreference(linkId, digestOptOut);
    } catch (err: any) {
      setChildren((prev) => prev.map((c) => (c.linkId === linkId ? { ...c, digestOptOut: !digestOptOut } : c)));
      setError(err?.message ?? 'Failed to update digest preference');
    }
  }, []);

  const decideConsent = useCallback(async (linkId: string, granted: boolean) => {
    const result = await parentsApi.decideConsent(linkId, granted);
    setChildren((prev) =>
      prev.map((c) => (c.linkId === linkId ? { ...c, guardianConsentStatus: result.guardianConsentStatus } : c))
    );
    return result;
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  return {
    links,
    children,
    dashboards,
    dashboardsLoading,
    isLoading,
    error,
    fetchLinks,
    fetchChildren,
    requestLink,
    searchStudent,
    toggleDigest,
    decideConsent,
  };
}
```

Note what's deliberately gone: `dashboard` (singular) and `selectChild` are both removed — every consumer must now read `dashboards[studentId]`. `Promise.allSettled` (not `Promise.all`) is used so that one child's dashboard failing to load (e.g. a link that's since been revoked server-side) doesn't blank out every other card.

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: this will show errors in `parent/home.tsx` and `parent/link-request.tsx` — expected, they're rewritten in Tasks 5 and 8. Confirm the errors are **only** in those two files (both already scheduled for rewrite) and that `mobile/src/api/*.ts` and `mobile/src/hooks/useParent.ts` themselves are clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/api/parents.ts mobile/src/api/recordings.ts mobile/src/hooks/useParent.ts
git commit -m "feat(parents): mobile client + useParent restructured for per-child cards

useParent() held exactly one selected child's dashboard. The stacked-card
design needs every linked child's dashboard simultaneously — each card's
collapsed header shows today's session and last grade without a tap — so
dashboards is now a map, fetched in parallel via Promise.allSettled (one
child's fetch failing must not blank every other card).

parent/home.tsx and parent/link-request.tsx now fail to typecheck against
this — expected, both are rewritten in the next tasks."
```

---

### Task 4: Mobile — i18n keys

**Files:**
- Modify: `mobile/src/i18n/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the translation keys Tasks 5-7 use.

- [ ] **Step 1: Locate the current insertion points**

Run: `grep -n "^};" mobile/src/i18n/index.ts`
The first hit closes `arTranslations`, the second closes `enTranslations`. Use the actual line numbers reported — do not assume the plan's estimate (496/981) still holds.

- [ ] **Step 2: Add the Arabic keys**

Insert immediately before the `};` that closes `arTranslations`:

```ts
  // ── F10b: parent per-child cards ──
  parentNoSessionToday: 'لا توجد جلسة اليوم',
  parentLastGrade: 'آخر درجة',
  parentCurrentStreak: 'التتابع الحالي',
  parentStreakDays: 'يوم',
  parentViewReport: 'عرض التقرير',
  parentViewRecordings: 'عرض التسجيلات',
  parentSendMessage: 'إرسال رسالة',
  parentNoTeacherYet: 'لم يُعيَّن معلم بعد',
  parentMoreDetails: 'المزيد من التفاصيل',
  parentLessDetails: 'إخفاء التفاصيل',
  parentNoChildrenYet: 'لا يوجد أبناء مرتبطون بعد',
  parentReportsTitle: 'التقارير',
  parentNoReportsYet: 'لا توجد تقارير بعد',
  parentDownloadReport: 'تنزيل',
  parentRecordingsTitle: 'التسجيلات',
  parentNoRecordingsYet: 'لا توجد تسجيلات بعد',
  parentPlayRecording: 'تشغيل',
  parentRecordingApproved: 'مقبول',
  parentRecordingRejected: 'مرفوض',
  parentRecordingPending: 'قيد المراجعة',
```

- [ ] **Step 3: Add the English keys**

Insert immediately before the `};` that closes `enTranslations`:

```ts
  // ── F10b: parent per-child cards ──
  parentNoSessionToday: 'No session today',
  parentLastGrade: 'Last grade',
  parentCurrentStreak: 'Current streak',
  parentStreakDays: 'days',
  parentViewReport: 'View report',
  parentViewRecordings: 'View recordings',
  parentSendMessage: 'Send message',
  parentNoTeacherYet: 'No teacher assigned yet',
  parentMoreDetails: 'More details',
  parentLessDetails: 'Hide details',
  parentNoChildrenYet: 'No linked children yet',
  parentReportsTitle: 'Reports',
  parentNoReportsYet: 'No reports yet',
  parentDownloadReport: 'Download',
  parentRecordingsTitle: 'Recordings',
  parentNoRecordingsYet: 'No recordings yet',
  parentPlayRecording: 'Play',
  parentRecordingApproved: 'Approved',
  parentRecordingRejected: 'Rejected',
  parentRecordingPending: 'Pending review',
```

- [ ] **Step 4: Run the i18n gate**

Run: `npm run check-i18n --workspace=mobile`
Expected: `check-i18n: OK`. Note the reported inline-ternary count — this task adds no ternaries, so it must be unchanged from whatever `grep -n "TERNARY_BASELINE" mobile/scripts/check-i18n.js` shows before this step.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/i18n/index.ts
git commit -m "feat(i18n): F10b parent-cluster keys (ar + en)"
```

---

### Task 5: Mobile — `parent/home.tsx` restructure to stacked per-child cards

**Files:**
- Modify: `mobile/app/parent/home.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useParent()`'s new shape (Task 3): `children`, `dashboards`, `dashboardsLoading`, `isLoading`, `error`, `fetchChildren`, `toggleDigest`, `decideConsent`. i18n keys from Task 4.
- Produces: the finished screen. No other task consumes this file.

**Reminder — DESIGN.md constraints repeated from Global Constraints, since this is the task that must honor them:** streak is the only gold element on a card; action chips are text/tonal style, never three solid-fill buttons; status pairs colour with an icon or label; ≥44pt tap targets.

- [ ] **Step 1: Write the new file**

Replace `mobile/app/parent/home.tsx` in full:

```tsx
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useParent } from '@/src/hooks/useParent';
import type { ChildSummary, ChildDashboard } from '@/src/api/parents';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { RADIUS, SPACING } from '@/constants/theme';
import { AppCard, AppText, Avatar, EmptyState, MetricTile, SectionHeader, StatusPill } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

function fullName(p?: { firstName?: string; lastName?: string }): string {
  return `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || '?';
}

function statusTone(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  const s = status.toUpperCase();
  if (s === 'ACTIVE' || s === 'APPROVED') return 'success';
  if (s === 'PENDING') return 'warning';
  if (s === 'DENIED' || s === 'SUSPENDED') return 'error';
  return 'neutral';
}

function todaysAppointment(dashboard: ChildDashboard) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return dashboard.upcomingAppointments.find((a) => a.requestedDate === today);
}

interface ChildCardProps {
  child: ChildSummary;
  dashboard: ChildDashboard | undefined;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleDigest: (linkId: string, digestOptOut: boolean) => void;
  onDecideConsent: (linkId: string, granted: boolean) => void;
}

function ChildCard({ child, dashboard, expanded, onToggleExpanded, onToggleDigest, onDecideConsent }: ChildCardProps) {
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const lang = i18n.language;
  const { colors: COLORS } = useTheme();
  const router = useRouter();
  const s = createStyles(COLORS);

  const student = dashboard?.student ?? child.student;
  const todaySession = dashboard ? todaysAppointment(dashboard) : undefined;
  const lastGrade = dashboard?.grades[0];
  const streak = dashboard?.streak;
  const teacher = dashboard?.student.assignedTeacher;

  return (
    <AppCard colors={COLORS} style={s.card}>
      <View style={s.headerRow}>
        <Avatar colors={COLORS} label={fullName(student)} />
        <View style={{ flex: 1 }}>
          <AppText variant="titleMedium" color={COLORS.textPrimary}>
            {fullName(student)}
          </AppText>
          <StatusPill colors={COLORS} label={student.status} status={statusTone(student.status)} />
        </View>
      </View>

      <View style={s.factRow}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
        <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.xs }}>
          {todaySession
            ? new Date(`${todaySession.requestedDate}T${todaySession.requestedTime}`).toLocaleString(
                lang === 'ar' ? 'ar-SA' : 'en-US'
              )
            : t('parentNoSessionToday')}
        </AppText>
      </View>

      {lastGrade ? (
        <View style={s.factRow}>
          <Ionicons name="ribbon-outline" size={16} color={COLORS.textSecondary} />
          <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.xs, flex: 1 }}>
            {t('parentLastGrade')}: {lastGrade.type} — {lastGrade.grade}
          </AppText>
        </View>
      ) : null}

      {streak ? (
        <MetricTile
          colors={COLORS}
          value={streak.currentStreak}
          label={`${t('parentCurrentStreak')} (${t('parentStreakDays')})`}
          tone="gold"
          style={{ marginTop: SPACING.sm, alignSelf: 'flex-start' }}
        />
      ) : null}

      <View style={[s.digestRow, { borderTopColor: COLORS.borderSubtle }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium" color={COLORS.textPrimary}>
            {t('weeklyDigest')}
          </AppText>
        </View>
        <Switch
          value={!child.digestOptOut}
          onValueChange={(on) => onToggleDigest(child.linkId, !on)}
          trackColor={{ false: '#e7e5e4', true: COLORS.primary }}
          thumbColor="#fff"
        />
      </View>

      {child.guardianConsentStatus ? (
        <View style={[s.consentBox, { borderColor: child.guardianConsentStatus === 'GRANTED' ? COLORS.success : COLORS.warning }]}>
          <View style={s.factRow}>
            <Ionicons
              name="mic-outline"
              size={18}
              color={child.guardianConsentStatus === 'GRANTED' ? COLORS.success : COLORS.warning}
            />
            <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginStart: SPACING.xs }}>
              {t('recordingConsent')}
            </AppText>
          </View>
          {child.guardianConsentStatus === 'GRANTED' ? (
            <TouchableOpacity onPress={() => onDecideConsent(child.linkId, false)} style={{ marginTop: SPACING.xs }}>
              <AppText variant="bodySmall" color={COLORS.error}>
                {t('withdrawConsent')}
              </AppText>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
              <TouchableOpacity
                onPress={() => onDecideConsent(child.linkId, true)}
                style={[s.consentBtn, { backgroundColor: COLORS.success }]}
              >
                <AppText variant="bodySmall" color="#FFFFFF">
                  {t('grantConsent')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDecideConsent(child.linkId, false)}
                style={[s.consentBtn, { backgroundColor: COLORS.error }]}
              >
                <AppText variant="bodySmall" color="#FFFFFF">
                  {t('declineConsent')}
                </AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      <View style={s.chipRow}>
        <TouchableOpacity
          accessibilityRole="button"
          style={s.chip}
          onPress={() =>
            router.push({
              pathname: '/parent/child-reports',
              params: { studentId: student.id, studentName: fullName(student) },
            })
          }
        >
          <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
          <AppText variant="labelLarge" color={COLORS.primary} style={{ marginStart: 4 }}>
            {t('parentViewReport')}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={s.chip}
          onPress={() =>
            router.push({
              pathname: '/parent/child-recordings',
              params: { studentId: student.id, studentName: fullName(student) },
            })
          }
        >
          <Ionicons name="mic-outline" size={16} color={COLORS.primary} />
          <AppText variant="labelLarge" color={COLORS.primary} style={{ marginStart: 4 }}>
            {t('parentViewRecordings')}
          </AppText>
        </TouchableOpacity>
        {teacher ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={s.chip}
            onPress={() =>
              router.push({
                pathname: '/messages/conversation',
                params: { partnerId: teacher.id, partnerName: fullName(teacher) },
              })
            }
          >
            <Ionicons name="chatbubble-outline" size={16} color={COLORS.primary} />
            <AppText variant="labelLarge" color={COLORS.primary} style={{ marginStart: 4 }}>
              {t('parentSendMessage')}
            </AppText>
          </TouchableOpacity>
        ) : (
          <AppText variant="labelLarge" color={COLORS.textMuted} style={s.chip}>
            {t('parentNoTeacherYet')}
          </AppText>
        )}
      </View>

      <TouchableOpacity accessibilityRole="button" onPress={onToggleExpanded} style={s.expandToggle}>
        <AppText variant="labelLarge" color={COLORS.primary}>
          {expanded ? t('parentLessDetails') : t('parentMoreDetails')}
        </AppText>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
      </TouchableOpacity>

      {expanded && dashboard ? (
        <View style={s.expandedSection}>
          <SectionHeader colors={COLORS} title={t('childProgress')} />
          <View style={s.metrics}>
            <MetricTile
              colors={COLORS}
              value={dashboard.memorization.length}
              label={t('surahsInProgress')}
              tone="primary"
            />
            <MetricTile
              colors={COLORS}
              value={dashboard.attendance.filter((a) => a.status.toUpperCase() === 'PRESENT').length}
              label={t('present')}
              tone="success"
            />
            <MetricTile
              colors={COLORS}
              value={dashboard.attendance.filter((a) => a.status.toUpperCase() === 'ABSENT').length}
              label={t('absent')}
              tone="warning"
            />
          </View>

          {dashboard.grades.length > 0 ? (
            <>
              <SectionHeader colors={COLORS} title={t('childGrades')} />
              {dashboard.grades.slice(0, 3).map((grade) => (
                <View key={grade.id} style={s.factRow}>
                  <AppText variant="bodySmall" color={COLORS.textPrimary} style={{ flex: 1 }}>
                    {grade.type} — {grade.surah ? (isRTL ? grade.surah.nameAr : grade.surah.nameEn) : t('overallRecital')}
                  </AppText>
                  <AppText variant="labelLarge" color={COLORS.primary}>
                    {grade.grade}
                  </AppText>
                </View>
              ))}
            </>
          ) : null}

          {dashboard.upcomingAppointments.length > 0 ? (
            <>
              <SectionHeader colors={COLORS} title={t('childAppointments')} />
              {dashboard.upcomingAppointments.map((appt) => (
                <View key={appt.id} style={s.factRow}>
                  <AppText variant="bodySmall" color={COLORS.textPrimary}>
                    {new Date(`${appt.requestedDate}T${appt.requestedTime}`).toLocaleString(
                      lang === 'ar' ? 'ar-SA' : 'en-US'
                    )}{' '}
                    — {fullName(appt.teacher)}
                  </AppText>
                </View>
              ))}
            </>
          ) : null}

          {dashboard.pendingRevisions.length > 0 ? (
            <>
              <SectionHeader colors={COLORS} title={t('childRevisions')} />
              {dashboard.pendingRevisions.map((rev) => (
                <View key={rev.id} style={s.factRow}>
                  <AppText variant="bodySmall" color={COLORS.textPrimary}>
                    {rev.surah ? (isRTL ? rev.surah.nameAr : rev.surah.nameEn) : t('revision')}
                  </AppText>
                </View>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}

export default function ParentHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);
  const { children, dashboards, isLoading, dashboardsLoading, error, fetchChildren, toggleDigest, decideConsent } =
    useParent();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[s.header, { backgroundColor: COLORS.primary }]}>
        <AppText variant="headlineSmall" color="#FFFFFF">
          {t('parentDashboard')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push('/parent/link-request')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="add-circle-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchChildren} />}
      >
        {error ? (
          <View style={s.center}>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>
              {error}
            </AppText>
            <TouchableOpacity accessibilityRole="button" onPress={fetchChildren} style={{ marginTop: SPACING.md }}>
              <AppText variant="bodyMedium" color={COLORS.primary}>
                {t('retry')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : children.length === 0 && !isLoading ? (
          <View style={s.empty}>
            <EmptyState
              colors={COLORS}
              icon="people-outline"
              title={t('parentNoChildrenYet')}
              description={t('noChildrenYetDesc')}
            />
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push('/parent/link-request')}
            >
              <AppText variant="bodyMedium" color="#FFFFFF">
                {t('requestChildLink')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : isLoading || dashboardsLoading ? (
          <>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </>
        ) : (
          children.map((child) => (
            <ChildCard
              key={child.linkId}
              child={child}
              dashboard={dashboards[child.student.id]}
              expanded={expandedId === child.student.id}
              onToggleExpanded={() => setExpandedId((cur) => (cur === child.student.id ? null : child.student.id))}
              onToggleDigest={toggleDigest}
              onDecideConsent={decideConsent}
            />
          ))
        )}
      </ScrollView>

      <SectionHeader colors={COLORS} title={t('achievements')} />
      <View style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md, paddingHorizontal: SPACING.md }}>
        <TouchableOpacity
          style={[s.shortcutTile, { backgroundColor: COLORS.surface }]}
          onPress={() => router.push('/student/gamification')}
        >
          <Ionicons name="trophy-outline" size={28} color={COLORS.primary} />
          <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginTop: SPACING.xs }}>
            {t('gamification')}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.shortcutTile, { backgroundColor: COLORS.surface }]}
          onPress={() => router.push('/student/certificates')}
        >
          <Ionicons name="document-text-outline" size={28} color={COLORS.success} />
          <AppText variant="bodyMedium" color={COLORS.textPrimary} style={{ marginTop: SPACING.xs }}>
            {t('certificates')}
          </AppText>
        </TouchableOpacity>
      </View>
      <BottomNav role="parent" active="home" />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
      borderBottomLeftRadius: RADIUS.lg,
      borderBottomRightRadius: RADIUS.lg,
    },
    body: { padding: SPACING.md, paddingBottom: SPACING['2xl'], gap: SPACING.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
    actionBtn: {
      marginTop: SPACING.lg,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    card: { gap: SPACING.xs },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    factRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs },
    digestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    consentBox: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      marginTop: SPACING.sm,
    },
    consentBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center', minHeight: 44 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      paddingHorizontal: SPACING.sm,
    },
    expandToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: 44,
      marginTop: SPACING.xs,
    },
    expandedSection: {
      marginTop: SPACING.xs,
      paddingTop: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.borderSubtle,
      gap: SPACING.xs,
    },
    metrics: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
    shortcutTile: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
    },
  });
```

- [ ] **Step 2: Confirm the `weeklyDigest`/`recordingConsent`/`grantConsent`/`declineConsent` keys exist**

The prior version of this file hard-coded these four strings inline (`isAr ? 'ملخص أسبوعي بالبريد' : 'Weekly email digest'`, etc. — check the git history at `mobile/app/parent/home.tsx` before this task's commit if you need the exact prior Arabic text). Run:
```
grep -n "^  weeklyDigest:\|^  recordingConsent:\|^  grantConsent:\|^  declineConsent:" mobile/src/i18n/index.ts
```
Expected: 8 hits (4 keys × 2 languages). If any are missing, add them now using the prior inline Arabic text as the source of truth (do not invent new wording) — Arabic: `weeklyDigest: 'ملخص أسبوعي بالبريد'`, `recordingConsent: 'الموافقة على تسجيل التلاوة'`, `grantConsent: 'موافق'`, `declineConsent: 'رفض'`; English: `weeklyDigest: 'Weekly email digest'`, `recordingConsent: 'Consent to record recitations'`, `grantConsent: 'Grant consent'`, `declineConsent: 'Decline'`.

- [ ] **Step 3: Typecheck, lint, i18n gate**

Run: `cd mobile && npx tsc --noEmit && npm run lint && npm run check-i18n`
Expected: `tsc` exit 0 (for this file — `parent/link-request.tsx` may still show errors until Task 8). Lint clean. `check-i18n: OK`, ternary count unchanged from Task 4 (this task adds none — verify: every string in the file above goes through `t()`; `isRTL`/`lang` are used only for non-string decisions).

- [ ] **Step 4: Verify on device**

With Metro and the API running, log in as a parent (or approve a `PARENT`-role test link to `ali@quran-review.com` / `fatima@quran-review.com` via the admin Approvals screen), and confirm: each linked child renders as its own card; today's-session/last-grade/streak show correctly; the digest and consent toggles still work per-child (toggle one child's digest, confirm the sibling card's toggle is unaffected); "View report"/"View recordings" chips are present; "Send message" is present only for a child with an assigned teacher and absent (replaced by the "no teacher" text) otherwise; expanding a card reveals the detail section without a network request (already-loaded data).

- [ ] **Step 5: Commit**

```bash
git add mobile/app/parent/home.tsx
git commit -m "feat(parent): stacked per-child cards replace the selector+single-panel (AC5.3)

Each linked child now gets a self-contained card: today's session (or an
explicit 'No session today', never a blank), last grade, current streak
(the one gold element per DESIGN.md's Rationed Gold Rule), the M4.1
guardian-consent toggle and digest toggle inline, and the three action
chips AC5.3 requires. Progress detail — memorization/attendance/grades/
appointments/revisions — moves inside an expandable section per card
instead of always-rendering below a single selected child, which is what
makes this the child's summary rather than a navigation menu.

Send message resolves the child's teacher from assignedTeacher, added to
childDashboard in this branch — it does not exist for every student, so
the chip is hidden (replaced by 'No teacher assigned yet') when it's null."
```

---

### Task 6: Mobile — `parent/child-reports.tsx`

**Files:**
- Create: `mobile/app/parent/child-reports.tsx`

**Interfaces:**
- Consumes: `parentsApi.getChildReports(studentId)` (Task 3), `reportsApi.downloadReport(id)` (pre-existing, unchanged), i18n keys (Task 4).
- Produces: route `/parent/child-reports?studentId=&studentName=`, linked from Task 5's "View report" chip.

- [ ] **Step 1: Write the screen**

Create `mobile/app/parent/child-reports.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { parentsApi, type ParentChildReport } from '@/src/api/parents';
import { reportsApi } from '@/src/api';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { AppCard, AppText, EmptyState } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

export default function ChildReportsScreen() {
  const { studentId, studentName } = useLocalSearchParams<{ studentId: string; studentName?: string }>();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);

  const [reports, setReports] = useState<ParentChildReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setError(null);
    try {
      setReports(await parentsApi.getChildReports(studentId));
    } catch (err: any) {
      setError(err?.message ?? t('loadFailed'));
    }
  }, [studentId, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      await reportsApi.downloadReport(id);
    } catch (err: any) {
      Alert.alert(t('error'), err?.message ?? '');
    } finally {
      setDownloadingId(null);
    }
  };

  const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.appBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText variant="titleLarge" style={{ color: COLORS.textPrimary }}>
            {t('parentReportsTitle')}
          </AppText>
          {studentName ? (
            <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
              {studentName}
            </AppText>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={COLORS.primary} />}
      >
        {error ? (
          <TouchableOpacity onPress={load} style={s.errorBanner} accessibilityRole="button">
            <AppText variant="bodyMedium" style={{ color: COLORS.error, textAlign: 'center' }}>
              {error}
            </AppText>
          </TouchableOpacity>
        ) : null}

        {isLoading ? (
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </>
        ) : reports.length === 0 ? (
          <EmptyState colors={COLORS} icon="document-text-outline" title={t('parentNoReportsYet')} />
        ) : (
          reports.map((r) => (
            <AppCard key={r.id} colors={COLORS} style={s.card}>
              <AppText variant="bodyMedium" style={{ color: COLORS.textPrimary }} numberOfLines={3}>
                {r.summary}
              </AppText>
              <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                {new Date(r.generatedAt).toLocaleDateString(dateLocale)}
              </AppText>
              <TouchableOpacity
                accessibilityRole="button"
                style={[s.downloadBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => handleDownload(r.id)}
                disabled={downloadingId === r.id}
              >
                <AppText variant="labelLarge" style={{ color: '#FFFFFF' }}>
                  {t('parentDownloadReport')}
                </AppText>
              </TouchableOpacity>
            </AppCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    appBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
    list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
    card: { gap: 4 },
    downloadBtn: {
      minHeight: 44,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.sm,
    },
    errorBanner: {
      backgroundColor: COLORS.errorLight,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
  });
```

- [ ] **Step 2: Confirm `reportsApi` is exported from the barrel**

Run: `grep -n "export { reportsApi }" mobile/src/api/index.ts`
Expected: one hit (it already is, per the existing `student/reports.tsx`'s own import). If absent, add `export { reportsApi } from './reports';` alongside the other exports.

- [ ] **Step 3: Typecheck, lint, i18n gate**

Run: `cd mobile && npx tsc --noEmit && npm run lint && npm run check-i18n`
Expected: all clean, ternary count unchanged.

- [ ] **Step 4: Verify on device**

Navigate from a parent home card's "View report" chip; confirm the list loads, the empty state shows for a child with no reports, and tapping "Download" opens the system browser (it will 404/hit an auth error on a fixture PDF that doesn't exist on disk in dev — that's expected; the point is reaching the browser-open call, not the PDF's existence).

- [ ] **Step 5: Commit**

```bash
git add mobile/app/parent/child-reports.tsx
git commit -m "feat(parent): child reports viewer, routed from the View report chip (AC5.3)"
```

---

### Task 7: Mobile — `parent/child-recordings.tsx`

**Files:**
- Create: `mobile/app/parent/child-recordings.tsx`

**Interfaces:**
- Consumes: `parentsApi.getChildRecordings(studentId)`, `recordingsApi.downloadRecording(id)` (both Task 3), i18n keys (Task 4).
- Produces: route `/parent/child-recordings?studentId=&studentName=`, linked from Task 5's "View recordings" chip.

**Deliberate scope decision, not a shortcut:** this screen opens a recording in the system browser (same `?token=` pattern as reports), not an in-app audio player. `teacher/recordings.tsx`'s in-app player exists because a teacher is *grading* — this screen is a parent *viewing*, where DESIGN.md's "one screen, one job" argues against importing ~150 lines of `expo-av` playback-state machinery for a read-only viewer.

- [ ] **Step 1: Write the screen**

Create `mobile/app/parent/child-recordings.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { parentsApi, type ParentChildRecording } from '@/src/api/parents';
import { recordingsApi } from '@/src/api';
import { useIsRTL } from '@/src/i18n/useIsRTL';
import { AppCard, AppText, EmptyState, StatusPill } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

function recordingTone(r: ParentChildRecording): 'success' | 'error' | 'warning' {
  if (r.approvedAt) return 'success';
  if (r.rejectedAt) return 'error';
  return 'warning';
}

function recordingLabelKey(r: ParentChildRecording): string {
  if (r.approvedAt) return 'parentRecordingApproved';
  if (r.rejectedAt) return 'parentRecordingRejected';
  return 'parentRecordingPending';
}

export default function ChildRecordingsScreen() {
  const { studentId, studentName } = useLocalSearchParams<{ studentId: string; studentName?: string }>();
  const { t, i18n } = useTranslation();
  const isRTL = useIsRTL();
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);

  const [recordings, setRecordings] = useState<ParentChildRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setError(null);
    try {
      setRecordings(await parentsApi.getChildRecordings(studentId));
    } catch (err: any) {
      setError(err?.message ?? t('loadFailed'));
    }
  }, [studentId, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const handlePlay = async (id: string) => {
    setOpeningId(id);
    try {
      await recordingsApi.downloadRecording(id);
    } catch (err: any) {
      Alert.alert(t('error'), err?.message ?? '');
    } finally {
      setOpeningId(null);
    }
  };

  const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.appBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText variant="titleLarge" style={{ color: COLORS.textPrimary }}>
            {t('parentRecordingsTitle')}
          </AppText>
          {studentName ? (
            <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
              {studentName}
            </AppText>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={COLORS.primary} />}
      >
        {error ? (
          <TouchableOpacity onPress={load} style={s.errorBanner} accessibilityRole="button">
            <AppText variant="bodyMedium" style={{ color: COLORS.error, textAlign: 'center' }}>
              {error}
            </AppText>
          </TouchableOpacity>
        ) : null}

        {isLoading ? (
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </>
        ) : recordings.length === 0 ? (
          <EmptyState colors={COLORS} icon="mic-outline" title={t('parentNoRecordingsYet')} />
        ) : (
          recordings.map((r) => (
            <AppCard key={r.id} colors={COLORS} style={s.card}>
              <View style={s.rowBetween}>
                <AppText variant="bodyMedium" style={{ color: COLORS.textPrimary, flex: 1 }} numberOfLines={1}>
                  {r.fileName}
                </AppText>
                <StatusPill colors={COLORS} label={t(recordingLabelKey(r))} status={recordingTone(r)} />
              </View>
              <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                {new Date(r.createdAt).toLocaleDateString(dateLocale)}
              </AppText>
              <TouchableOpacity
                accessibilityRole="button"
                style={[s.playBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => handlePlay(r.id)}
                disabled={openingId === r.id}
              >
                <Ionicons name="play" size={16} color="#FFFFFF" />
                <AppText variant="labelLarge" style={{ color: '#FFFFFF', marginStart: 4 }}>
                  {t('parentPlayRecording')}
                </AppText>
              </TouchableOpacity>
            </AppCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    appBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
    list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
    card: { gap: 4 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    playBtn: {
      flexDirection: 'row',
      minHeight: 44,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.sm,
    },
    errorBanner: {
      backgroundColor: COLORS.errorLight,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
  });
```

- [ ] **Step 2: Confirm `recordingsApi` is exported from the barrel**

Run: `grep -n "export { recordingsApi }" mobile/src/api/index.ts`
Expected: one hit. Add it if missing, matching the `reportsApi` export line's style.

- [ ] **Step 3: Typecheck, lint, i18n gate**

Run: `cd mobile && npx tsc --noEmit && npm run lint && npm run check-i18n`
Expected: all clean, ternary count unchanged.

- [ ] **Step 4: Verify on device**

Navigate from a parent home card's "View recordings" chip; confirm the list loads with correct status pills (approved/rejected/pending), the empty state shows for a child with none, and tapping "Play" opens the system browser.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/parent/child-recordings.tsx
git commit -m "feat(parent): child recordings viewer, routed from the View recordings chip (AC5.3)

Opens the recording in the system browser via the same ?token= pattern
reports already use, rather than an in-app player — this is a read-only
viewer, not the review/grading tool teacher/recordings.tsx is, so it does
not need that screen's ~150 lines of expo-av playback state."
```

---

### Task 8: Mobile — `link-request.tsx` visual polish, plus full gates and close-out

**Files:**
- Modify: `mobile/app/parent/link-request.tsx`

**Interfaces:**
- Consumes: `useParent()`'s `searchStudent`/`requestLink` — **unchanged by Task 3**, this file's only dependency on the hook survives the restructure untouched.
- Produces: nothing further downstream — last task.

- [ ] **Step 1: Read the current file and audit against DESIGN.md**

Read `mobile/app/parent/link-request.tsx` in full. Per the spec, this is "visual polish only — no structural change": it already does one job (search for a student by email, submit a link request). Apply the same DESIGN.md pass as every other F10 screen: `AppText` variants (no raw `<Text>` with hard-coded `fontSize`), hairline-border cards, ≥44pt tap targets with `hitSlop` on small icon buttons, status/feedback messages pair colour with an icon or label, no gold on anything (nothing here is earned achievement).

Do not restructure the screen's flow (search → confirm → submit) or touch `useParent()`'s `searchStudent`/`requestLink` calls — only visual/typography/spacing/accessibility changes.

- [ ] **Step 2: Apply the changes**

(The implementer fills this in against the file's actual current content — read first, then match whatever violations are actually present against the checklist in Step 1. Do not invent changes the audit didn't find.)

- [ ] **Step 3: Typecheck, lint, i18n gate**

Run: `cd mobile && npx tsc --noEmit && npm run lint && npm run check-i18n`
Expected: all clean. If any new user-facing string was introduced by the polish pass, it must go through `t()` with keys in both languages — the ternary baseline must not rise.

- [ ] **Step 4: Verify on device**

Confirm the search → request-link flow still works end to end, unchanged in behavior, only visually updated.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/parent/link-request.tsx
git commit -m "style(parent): link-request visual polish per DESIGN.md — no structural change"
```

- [ ] **Step 6: Run every gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management
npm run test:server
cd packages/server && npx jest -c jest.integration.config.js --runInBand
cd ../../mobile && npx tsc --noEmit && npm run lint && npm run check-i18n
```

Expected: server unit + integration suites green (no regressions from Tasks 1-2's file.service.ts and parent.service.ts changes); mobile typecheck clean; lint clean; `check-i18n: OK`.

- [ ] **Step 7: Record the close-out**

Append an F10b entry to `tasks/todo.md`, in the same style as the F8/F9/F10a entries, mapping AC5.3 to its proof:

- **AC5.3** (parent home is the child's summary, one card per linked child with today's session/last grade/streak/action chips, M4.1 consent inline) — Task 5's stacked cards; Tasks 6-7's two new viewer screens make "View report"/"View recordings" actually functional (they were previously unimplementable — no parent-scoped read path existed at all); "Send message" resolves the child's teacher via `assignedTeacher`, added to `childDashboard` in Task 1.
- **AC5.5** (screens pass the mobile gates) — Step 6.

Note explicitly what this work found beyond the spec's stated scope: the spec claimed "no server changes," but three real gaps existed — `childDashboard` exposed neither a child's teacher nor their streak; no parent-scoped list endpoint existed for reports or recordings; and even a parent who could see a recording/report's existence would 403 trying to download it, since the file-download authorization check had no PARENT branch at all. All three are closed in Tasks 1-2.

---

## Self-Review

**Spec coverage.** Every AC5.3 element maps to a task: header/status → Task 5's `ChildCard`; today's session → `todaysAppointment()` in Task 5, sourced from data Task 1 already provides (no new fetch); last grade → `dashboard.grades[0]`, existing data; streak → new in Task 1, rendered in Task 5; consent/digest toggles → relocated unchanged into the card in Task 5; the three action chips → Task 5 renders them, Tasks 2/3 make "View report"/"View recordings" actually work (previously impossible — no read path existed), Task 1 makes "Send message" resolvable (previously no teacher-id source existed on this response at all); expandable progress detail → Task 5's `expanded` section, using already-loaded data, no per-expand fetch; zero-children empty state → Task 5, reusing the existing `EmptyState` pattern; `link-request.tsx` visual polish → Task 8.

**Where this plan diverges from the spec, and why.** The spec's own "Files Changed" table said `mobile/src/api/*` needs only a "possible small addition" and its "Scope" line says "No server changes." Neither survived a code audit: `getChildDashboard` had no teacher or streak field at all (not "possibly" missing — definitively absent); `listReports`/`listRecordings` have no parent access path whatsoever, and the client's existing `studentId` param on `reportsApi.getReports` is provably a no-op today (the server handler never reads `query` at all); and the file-download authorization gap — the one thing that would make "View report" 403 on the very first tap even with everything else fixed — is not mentioned anywhere in the spec, because the spec's Known-Correct-Facts investigation stopped at the list endpoints and never traced the actual download path. Tasks 1-2 close all three, server-side, before any mobile work depends on them.

**Placeholder scan.** No TBD/TODO. Every code step carries complete code. Task 8 is deliberately open-ended in its Step 2 ("read first, then match whatever violations are actually present") because the spec itself only said "visual polish only" without listing concrete violations — writing fabricated specific changes against a file summarized rather than fully quoted here would risk inventing fixes for problems that may not exist; the checklist in Step 1 is the complete, concrete instruction, matching how the file must actually be judged once read.

**Type consistency.** `ChildDashboard` widened once, in Task 3, and consumed identically by Task 5 (`dashboard.student.assignedTeacher`, `dashboard.streak`) — no renaming across tasks. `ParentChildReport`/`ParentChildRecording` defined once in Task 3, consumed unchanged by Tasks 6/7. `useParent()`'s new return shape (`dashboards`, `dashboardsLoading`, no `dashboard`/`selectChild`) is defined in Task 3 and every field Task 5 reads from it (`children`, `dashboards`, `isLoading`, `dashboardsLoading`, `error`, `fetchChildren`, `toggleDigest`, `decideConsent`) matches exactly — `selectChild` is not referenced anywhere post-Task-3, confirmed by the fact that `link-request.tsx` (the only other consumer) never used it.

**Ordering check.** Task 1 (dashboard widening) and Task 2 (list endpoints + download-auth fix) are independent of each other server-side but both must land before Task 3 (mobile client), which both Task 5 (home) and Tasks 6-7 (viewer screens) depend on. Task 4 (i18n) precedes every screen task. Task 8 is last because it is the only task with no downstream dependents and, per the spec, carries the least risk.
