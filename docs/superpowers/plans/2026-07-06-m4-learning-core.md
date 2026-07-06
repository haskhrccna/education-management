# M4 — Learning Core (Grades + Surahs + Memorization + Revisions + Mushaf) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the 10 learning-core endpoints (3 grades, 1 surahs, 2 memorization, 4 revisions — plus the grades `/api/grades` mirror) onto contract routing with behavior pinned first (including the SM-2 seeding and next-card side effects in the DB), and **resurrect the mushaf API**: the mobile reader calls `/api/v1/mushaf/*` but `app.ts` imports `mushafRoutes` without ever mounting it — M4 mounts it as a contract module (3 new endpoints), fixing a real production bug.

**Architecture:** Same strangler shape as M2/M3: pin → contracts → modules (`modules/grades`, `modules/surahs`, `modules/memorization`, `modules/revisions`, `modules/mushaf`) reusing all services untouched → swap mounts → retire legacy routes/controllers + their mock unit tests. The mushaf mount is a deliberate surface addition (contracts + manifest + authz matrix rows land together, like M2b's audit-logs).

**Tech Stack:** Express 5 · Prisma 6 (itest Postgres on port **5433** — NEVER 5432) · Zod v4 · supertest · Jest (`--testPathPatterns`, always from `packages/server/`).

## Global Constraints

- **Byte-identical behavior** for the 10 legacy endpoints. The ONLY surface additions are the 3 mushaf endpoints (Task 5).
- Both suites + typecheck green at every commit, from `packages/server/`: `npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit`.
- Branch `feat/rebuild-m4` off `main`. Commits end `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Zod v4 only; shared keeps zod as its only dep. Roles UPPERCASE server-side.
- Services (`grade`, `memorization`, `revision`, `mushaf` services) NOT modified; their unit tests survive. Only routes/controllers retire.
- Legacy quirks to pin, not fix: (a) `PUT /memorization/:surahId` hand-validation — exact 400 messages `Invalid surahId` / `studentId is required` / `memorizedAyahs must be a number`; (b) `GET /revisions?surahId=abc` → hand-built `{success:false,error:'Invalid surahId'}` with NO `meta` (controller bypasses errorHandler) — pin with `toEqual`; (c) revision controller throws plain `Error` (not AppError) for missing POST fields → **500 'Internal server error'**; (d) `PUT /revisions/:id` authorize list omits ADMIN → admin gets 403 despite the service supporting ADMIN.
- Grades responses are RAW prisma echoes with `surah` include; `POST /grades` audits `CREATE_GRADE` (port gains `userAgent`, invisible to HTTP pins).
- `truncateAll` wipes ALL tables incl. `Surah`/`ayahs` — every test seeds its own surah/ayah rows via prisma.
- Surah fixture: `{ number: 114, nameAr: 'الناس', nameEn: 'An-Nas', ayahCount: 6, juz: 30 }` (id auto-increments; use the returned id). Ayah fixture: `{ surahId, number: 1, page: 604, juz: 30 }`.
- Factory: `createUser({role, status?, email?, password?}) → {id, email, role, token}`. Teacher-student links: direct `prisma.appointment.create({data:{studentId, teacherId, requestedDate: new Date(), requestedTime: '10:00', status: 'ACCEPTED'}})`.
- Access mapping (manifest-verified): GET grades `authenticated`; POST grades `['TEACHER']`; GET grades/student/:id `['TEACHER','ADMIN']`; GET surahs `authenticated`; GET memorization `authenticated`; PUT memorization/:surahId `['TEACHER']`; GET revisions `authenticated`; POST revisions `['TEACHER']`; PUT revisions/:id `['STUDENT','TEACHER']`; DELETE revisions/:id `['STUDENT','TEACHER','ADMIN']`. New mushaf endpoints: all `authenticated` (legacy mushaf.routes used bare `authenticate`).

## File Structure

```
packages/shared/src/contracts/
  learning.contracts.ts     ← NEW: 10 contracts (grades, surahs, memorization, revisions)
  mushaf.contracts.ts       ← NEW (Task 5): 3 contracts
  registry.ts               ← MODIFY twice: 35 → 45 (Task 2), 45 → 48 (Task 5)
packages/shared/src/index.ts ← MODIFY: export both contract files
packages/server/src/
  modules/grades/grades.module.ts             ← NEW: 3 routes
  modules/surahs/surahs.module.ts             ← NEW: 1 route
  modules/memorization/memorization.module.ts ← NEW: 2 routes
  modules/revisions/revisions.module.ts       ← NEW: 4 routes
  modules/mushaf/mushaf.module.ts             ← NEW (Task 5): 3 routes
  app.ts                    ← MODIFY: swap 5 mounts + ADD /api/v1/mushaf mount + drop dead mushafRoutes import
  __integration__/
    learning-flows.itest.ts ← NEW: behavior pins incl. SM-2 side effects
    mushaf-flows.itest.ts   ← NEW (Task 5)
    endpoint-manifest.ts    ← MODIFY (Task 5): +3 mushaf entries
    route-inventory.ts      ← MODIFY (Task 3): CONTRACT_MIRRORS += grades
  __tests__/contract-schemas.test.ts ← MODIFY: 35 → 45 → 48
  routes/{memorization,grade,revision,mushaf}.routes.ts ← DELETE (Task 6)
  controllers/{memorization,grade,revision,mushaf}.controller.ts ← DELETE (Task 6)
  controllers/__tests__/{grade,memorization,revision}.controller.test.ts ← DELETE (Task 6)
tasks/todo.md ← MODIFY (Task 6): M4 done, M5 next
```

Surviving unit tests: `grade.service.test.ts`, `memorization.service{,.extended}.test.ts`, `revision.service.test.ts`, `mushaf.service.test.ts`.

---

### Task 1: Pin learning-core behavior — `learning-flows.itest.ts` green against LEGACY code

**Files:**
- Create: `packages/server/src/__integration__/learning-flows.itest.ts`

- [ ] **Step 1: Create branch**

```bash
cd /Users/haskhr/Documents/opencode && git checkout -b feat/rebuild-m4 main
```

- [ ] **Step 2: Write the pins**

`packages/server/src/__integration__/learning-flows.itest.ts`:

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

async function seedSurah(ayahCount = 6) {
  return prisma.surah.create({
    data: { number: 114, nameAr: 'الناس', nameEn: 'An-Nas', ayahCount, juz: 30 },
  });
}

async function linkAccepted(student: TestUser, teacher: TestUser) {
  await prisma.appointment.create({
    data: { studentId: student.id, teacherId: teacher.id, requestedDate: new Date(), requestedTime: '10:00', status: 'ACCEPTED' },
  });
}

describe('grades', () => {
  it('POST 201: raw grade echo with surah + student includes; audit fires', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const surah = await seedSurah();

    const res = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: surah.id, grade: '95', type: 'ORAL', notes: 'excellent tajweed' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ studentId: student.id, teacherId: teacher.id, grade: '95', type: 'ORAL' });
    expect(res.body.surah).toMatchObject({ nameEn: 'An-Nas' });
    expect(res.body.student).toMatchObject({ email: student.email });
    expect(res.body.success).toBeUndefined();
  });

  it('POST: 404 unknown student; 400 non-student target; 400 unknown surah; 403 no accepted appointment', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const otherTeacher = await createUser({ role: Role.TEACHER, email: 'other-t@example.com' });
    const student = await createUser({ role: Role.STUDENT });
    const surah = await seedSurah();

    const ghost = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: '00000000-0000-4000-8000-000000000000', surahId: surah.id, grade: 'A', type: 'ORAL' });
    expect(ghost.status).toBe(404);
    expect(ghost.body.error).toBe('Student not found');

    const notStudent = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: otherTeacher.id, surahId: surah.id, grade: 'A', type: 'ORAL' });
    expect(notStudent.status).toBe(400);
    expect(notStudent.body.error).toBe('Target user is not a student');

    const noLink = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: surah.id, grade: 'A', type: 'ORAL' });
    expect(noLink.status).toBe(403);
    expect(noLink.body.error).toBe('No accepted appointment with this student');

    await linkAccepted(student, teacher);
    const badSurah = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: 9999, grade: 'A', type: 'ORAL' });
    expect(badSurah.status).toBe(400);
    expect(badSurah.body.error).toBe('Surah not found');
  });

  it('GET /grades: student sees own (raw array); GET /grades/student/:id gated by relationship, admin free', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const outsider = await createUser({ role: Role.TEACHER, email: 'outsider@example.com' });
    const admin = await createUser({ role: Role.ADMIN });
    await linkAccepted(student, teacher);
    const surah = await seedSurah();
    await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: surah.id, grade: '90', type: 'QUIZ' });

    const own = await request(app).get('/api/v1/grades').set('Authorization', `Bearer ${student.token}`);
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].surah).toMatchObject({ nameEn: 'An-Nas' });

    const byOutsider = await request(app)
      .get(`/api/v1/grades/student/${student.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(byOutsider.status).toBe(403);

    const byAdmin = await request(app)
      .get(`/api/v1/grades/student/${student.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body).toHaveLength(1);
  });

  it('legacy mirror GET /api/grades behaves identically', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/grades').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('surahs', () => {
  it('GET /surahs: raw array ordered by number', async () => {
    await seedSurah();
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/v1/surahs').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ number: 114, nameEn: 'An-Nas', ayahCount: 6, juz: 30 });
  });
});

describe('memorization', () => {
  it('GET: student reads own; teacher/admin need ?studentId (400 without)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });

    const own = await request(app).get('/api/v1/memorization').set('Authorization', `Bearer ${student.token}`);
    expect(own.status).toBe(200);
    expect(own.body).toEqual([]);

    const bare = await request(app).get('/api/v1/memorization').set('Authorization', `Bearer ${teacher.token}`);
    expect(bare.status).toBe(400);
    expect(bare.body.error).toBe('studentId query param is required');
  });

  it('PUT /:surahId hand-validation quirks: Invalid surahId / studentId is required / memorizedAyahs must be a number', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });

    const nan = await request(app)
      .put('/api/v1/memorization/abc')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 3 });
    expect(nan.status).toBe(400);
    expect(nan.body.error).toBe('Invalid surahId');

    const noStudent = await request(app)
      .put('/api/v1/memorization/1')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ memorizedAyahs: 3 });
    expect(noStudent.status).toBe(400);
    expect(noStudent.body.error).toBe('studentId is required');

    const badAyahs = await request(app)
      .put('/api/v1/memorization/1')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 'three' });
    expect(badAyahs.status).toBe(400);
    expect(badAyahs.body.error).toBe('memorizedAyahs must be a number');
  });

  it('PUT transition into COMPLETE seeds exactly one PENDING SM-2 revision (idempotent on re-recite)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const surah = await seedSurah(6);

    const complete = await request(app)
      .put(`/api/v1/memorization/${surah.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 6 });
    expect(complete.status).toBe(200);
    expect(complete.body).toMatchObject({ status: 'COMPLETE', memorizedAyahs: 6 });
    expect(complete.body.surah).toMatchObject({ nameEn: 'An-Nas' });

    const seeded = await prisma.revisionSchedule.findMany({
      where: { userId: student.id, surahId: surah.id, status: 'PENDING' },
    });
    expect(seeded).toHaveLength(1);

    // Re-recite while already COMPLETE: no duplicate PENDING revision.
    await request(app)
      .put(`/api/v1/memorization/${surah.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 6 });
    const after = await prisma.revisionSchedule.count({
      where: { userId: student.id, surahId: surah.id, status: 'PENDING' },
    });
    expect(after).toBe(1);
  });
});

describe('revisions', () => {
  it("GET ?surahId=abc → hand-built envelope WITHOUT meta (pinned with toEqual)", async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .get('/api/v1/revisions?surahId=abc')
      .set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Invalid surahId' });
  });

  it("POST with missing studentId → 500 'Internal server error' (plain Error, pinned quirk)", async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .post('/api/v1/revisions')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ surahId: 1, scheduledFor: '2027-01-15' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('POST 201 raw revision with surah include; teacher without link → 403', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const surah = await seedSurah();

    const res = await request(app)
      .post('/api/v1/revisions')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: surah.id, scheduledFor: '2027-01-15T00:00:00.000Z' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userId: student.id, surahId: surah.id, status: 'PENDING' });
    expect(res.body.surah).toMatchObject({ nameEn: 'An-Nas' });

    const outsider = await createUser({ role: Role.TEACHER, email: 'outsider@example.com' });
    const denied = await request(app)
      .post('/api/v1/revisions')
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ studentId: student.id, surahId: surah.id, scheduledFor: '2027-01-15T00:00:00.000Z' });
    expect(denied.status).toBe(403);
  });

  it('PUT marks COMPLETED and SM-2 schedules the NEXT pending card (repetitions+1); admin blocked by authorize (pinned quirk)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    await linkAccepted(student, teacher);
    const surah = await seedSurah();
    const card = await prisma.revisionSchedule.create({
      data: { userId: student.id, surahId: surah.id, scheduledFor: new Date(), status: 'PENDING' },
    });

    const adminTry = await request(app)
      .put(`/api/v1/revisions/${card.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'COMPLETED' });
    expect(adminTry.status).toBe(403);
    expect(adminTry.body.error).toBe('Insufficient permissions');

    const done = await request(app)
      .put(`/api/v1/revisions/${card.id}`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ status: 'COMPLETED' });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ status: 'COMPLETED' });
    expect(done.body.notedAt).toBeTruthy();

    // SM-2 side effect: a NEW pending card exists with repetitions=1, interval=1.
    const next = await prisma.revisionSchedule.findFirst({
      where: { userId: student.id, surahId: surah.id, status: 'PENDING' },
    });
    expect(next).not.toBeNull();
    expect(next!.repetitions).toBe(1);
    expect(next!.interval).toBe(1);
    expect(next!.id).not.toBe(card.id);
  });

  it('DELETE: student own-only; COMPLETED cards are 409-protected', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT, email: 'other-s@example.com' });
    const surah = await seedSurah();
    const card = await prisma.revisionSchedule.create({
      data: { userId: student.id, surahId: surah.id, scheduledFor: new Date(), status: 'PENDING' },
    });

    const notOwn = await request(app)
      .delete(`/api/v1/revisions/${card.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(notOwn.status).toBe(403);
    expect(notOwn.body.error).toBe('You can only delete your own revisions');

    const ok = await request(app)
      .delete(`/api/v1/revisions/${card.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ success: true });

    const completed = await prisma.revisionSchedule.create({
      data: { userId: student.id, surahId: surah.id, scheduledFor: new Date(), status: 'COMPLETED' },
    });
    const blocked = await request(app)
      .delete(`/api/v1/revisions/${completed.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('Cannot delete a completed revision');
  });
});
```

- [ ] **Step 3: Run against legacy code — green BEFORE any rebuild**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=learning-flows
```
Expected: PASS (~12 tests). Failing pin = wrong guess → fix the pin.

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/__integration__/learning-flows.itest.ts && git commit -m "test(m4): pin learning-core behavior — grades, surahs, memorization SM-2 seed, revisions SM-2 next-card

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Learning contracts in shared (10 endpoints)

**Files:**
- Create: `packages/shared/src/contracts/learning.contracts.ts`
- Modify: `packages/shared/src/contracts/registry.ts`, `packages/shared/src/index.ts`
- Modify: `packages/server/src/__tests__/contract-schemas.test.ts` (35 → 45)

**Interfaces:**
- Produces: `learningContracts.{listGrades, createGrade, studentGrades, listSurahs, getMemorization, updateMemorization, listRevisions, createRevision, markRevision, deleteRevision}` (10 contracts).

- [ ] **Step 1: Write `packages/shared/src/contracts/learning.contracts.ts`**

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';
import { CreateGradeSchema } from '../validators/common';

const SurahRow = z.looseObject({
  id: z.number(),
  number: z.number(),
  nameAr: z.string(),
  nameEn: z.string(),
  ayahCount: z.number(),
  juz: z.number(),
});

const GradeRow = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  teacherId: z.string(),
  surahId: z.number().nullable(),
  grade: z.string(),
  type: z.enum(['QUIZ', 'ASSIGNMENT', 'EXAM', 'ORAL', 'PARTICIPATION']),
  createdAt: DateOut,
});

const MemorizationRow = z.looseObject({
  userId: z.string(),
  surahId: z.number(),
  memorizedAyahs: z.number(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE']),
});

const RevisionRow = z.looseObject({
  id: z.string(),
  userId: z.string(),
  surahId: z.number(),
  scheduledFor: DateOut,
  status: z.enum(['PENDING', 'COMPLETED', 'MISSED']),
  interval: z.number(),
  easeFactor: z.number(),
  repetitions: z.number(),
});

export const learningContracts = {
  listGrades: defineContract({
    method: 'GET',
    path: '/api/v1/grades',
    summary: 'Own grades (student) — RAW array with surah include',
    access: 'authenticated',
    responses: { 200: z.array(GradeRow), 401: ErrorEnvelope },
  }),
  createGrade: defineContract({
    method: 'POST',
    path: '/api/v1/grades',
    summary: 'Teacher grades a linked student; audits CREATE_GRADE',
    access: [UserRole.TEACHER],
    request: { body: CreateGradeSchema },
    responses: { 201: GradeRow, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  studentGrades: defineContract({
    method: 'GET',
    path: '/api/v1/grades/student/:id',
    summary: 'Grades of one student — teacher needs the ACCEPTED-appointment link, admin is free',
    access: [UserRole.TEACHER, UserRole.ADMIN],
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: z.array(GradeRow), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  listSurahs: defineContract({
    method: 'GET',
    path: '/api/v1/surahs',
    summary: 'All 114 surahs ordered by number (RAW array)',
    access: 'authenticated',
    responses: { 200: z.array(SurahRow), 401: ErrorEnvelope },
  }),
  getMemorization: defineContract({
    method: 'GET',
    path: '/api/v1/memorization',
    summary: 'Memorization progress; student=self, teacher/admin need ?studentId',
    access: 'authenticated',
    request: { query: z.object({ studentId: z.string().optional() }) },
    responses: { 200: z.array(MemorizationRow), 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  updateMemorization: defineContract({
    method: 'PUT',
    path: '/api/v1/memorization/:surahId',
    summary:
      'Teacher upserts progress; transition into COMPLETE seeds the first SM-2 revision (NO Zod body — legacy hand-validation pinned)',
    access: [UserRole.TEACHER],
    request: { params: z.object({ surahId: z.string() }) },
    responses: {
      200: MemorizationRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  listRevisions: defineContract({
    method: 'GET',
    path: '/api/v1/revisions',
    summary: 'Revision schedule; ?surahId filter (invalid → bare {success:false} 400 without meta — pinned quirk)',
    access: 'authenticated',
    request: { query: z.object({ surahId: z.string().optional() }) },
    responses: { 200: z.array(RevisionRow), 400: ErrorEnvelope, 401: ErrorEnvelope },
  }),
  createRevision: defineContract({
    method: 'POST',
    path: '/api/v1/revisions',
    summary: 'Teacher schedules a revision (NO Zod body — plain-Error 500 quirk pinned)',
    access: [UserRole.TEACHER],
    responses: {
      201: RevisionRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      500: ErrorEnvelope,
    },
  }),
  markRevision: defineContract({
    method: 'PUT',
    path: '/api/v1/revisions/:id',
    summary:
      'Close a card (COMPLETED/MISSED); SM-2 schedules the next PENDING card. ADMIN is 403 (legacy authorize quirk)',
    access: [UserRole.STUDENT, UserRole.TEACHER],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: RevisionRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      500: ErrorEnvelope,
    },
  }),
  deleteRevision: defineContract({
    method: 'DELETE',
    path: '/api/v1/revisions/:id',
    summary: 'Delete a card (never COMPLETED ones); students own-only',
    access: [UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ success: z.literal(true) }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
};
```

- [ ] **Step 2: Register + export + bump**

`registry.ts`: import + `...Object.values(learningContracts),` after the scheduling spread.
`index.ts`: `export * from './contracts/learning.contracts';`.
`contract-schemas.test.ts`: `35` → `45` (title + `toHaveLength`).

- [ ] **Step 3: Gates**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns="registry-parity|completeness"
npx jest --testPathPatterns=contract-schemas && npx tsc --noEmit
```
Expected: parity 46 tests PASS; completeness PASS; unit + tsc clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/shared/src/contracts/learning.contracts.ts education_management/packages/shared/src/contracts/registry.ts education_management/packages/shared/src/index.ts education_management/packages/server/src/__tests__/contract-schemas.test.ts && git commit -m "feat(m4): learning contracts (10 endpoints) — registry at 45

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Grades + surahs + memorization modules + swap mounts

**Files:**
- Create: `packages/server/src/modules/grades/grades.module.ts`, `packages/server/src/modules/surahs/surahs.module.ts`, `packages/server/src/modules/memorization/memorization.module.ts`
- Modify: `packages/server/src/app.ts` (4 mounts: grades v1+mirror, surahs, memorization)
- Modify: `packages/server/src/__integration__/route-inventory.ts` (CONTRACT_MIRRORS += grades)

- [ ] **Step 1: Mirror map** — add `'/api/v1/grades': '/api/grades',` to CONTRACT_MIRRORS.

- [ ] **Step 2: Write `packages/server/src/modules/grades/grades.module.ts`**

```ts
import { learningContracts } from '@quran-review/shared';
import * as gradeService from '../../services/grade.service';
import { auditLog } from '../../lib/audit';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listGrades = defineRoute(learningContracts.listGrades, async ({ userId }) => {
  const grades = await gradeService.getMyGrades(userId!);
  return { status: 200 as const, body: grades };
});

const createGrade = defineRoute(learningContracts.createGrade, async ({ body, userId, req }) => {
  const created = await gradeService.createGrade(
    userId!,
    body.studentId,
    body.surahId,
    body.grade,
    body.type as 'QUIZ' | 'ASSIGNMENT' | 'EXAM' | 'ORAL' | 'PARTICIPATION',
    body.notes,
  );
  await auditLog({
    userId: userId!,
    action: 'CREATE_GRADE',
    resourceType: 'GRADE',
    resourceId: created.id,
    details: { studentId: body.studentId, surahId: body.surahId, type: body.type },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 201 as const, body: created };
});

const studentGrades = defineRoute(learningContracts.studentGrades, async ({ params, userId, userRole }) => {
  const grades = await gradeService.getStudentGrades(userId!, userRole!, String(params.id));
  return { status: 200 as const, body: grades };
});

export const gradesRouter = buildContractRouter([listGrades, createGrade, studentGrades], {
  mountPrefix: '/api/v1/grades',
});
```

- [ ] **Step 3: Write `packages/server/src/modules/surahs/surahs.module.ts`**

```ts
import { learningContracts } from '@quran-review/shared';
import * as memorizationService from '../../services/memorization.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listSurahs = defineRoute(learningContracts.listSurahs, async () => {
  const surahs = await memorizationService.getSurahs();
  return { status: 200 as const, body: surahs };
});

export const surahsRouter = buildContractRouter([listSurahs], { mountPrefix: '/api/v1/surahs' });
```

- [ ] **Step 4: Write `packages/server/src/modules/memorization/memorization.module.ts`**

```ts
import { learningContracts } from '@quran-review/shared';
import * as memorizationService from '../../services/memorization.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const getMemorization = defineRoute(learningContracts.getMemorization, async ({ query, userId, userRole }) => {
  const studentId = query.studentId as string | undefined;
  const progress = await memorizationService.getProgress(userId!, userRole!, studentId);
  return { status: 200 as const, body: progress };
});

const updateMemorization = defineRoute(learningContracts.updateMemorization, async ({ params, userId, req }) => {
  // Legacy parity: hand-validation, exact messages pinned by learning-flows.
  const surahId = parseInt(String(params.surahId), 10);
  if (isNaN(surahId)) throw new AppError(400, 'Invalid surahId');
  const { studentId, memorizedAyahs, status } = (req.body ?? {}) as {
    studentId?: string;
    memorizedAyahs?: unknown;
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  };
  if (!studentId) throw new AppError(400, 'studentId is required');
  if (typeof memorizedAyahs !== 'number') throw new AppError(400, 'memorizedAyahs must be a number');
  const result = await memorizationService.updateProgress(userId!, surahId, studentId, memorizedAyahs, status);
  return { status: 200 as const, body: result };
});

export const memorizationRouter = buildContractRouter([getMemorization, updateMemorization], {
  mountPrefix: '/api/v1/memorization',
});
```

- [ ] **Step 5: Swap the mounts in `app.ts`**

- `app.use('/api/v1/grades', authenticate, standardLimiter, gradeRoutes);` → `gradesRouter`
- `app.use('/api/grades', authenticate, standardLimiter, gradeRoutes);` → `gradesRouter`
- `app.use('/api/v1/surahs', authenticate, standardLimiter, surahRouter);` → `surahsRouter`
- `app.use('/api/v1/memorization', authenticate, standardLimiter, memorizationRouter);` → the new module's `memorizationRouter` (same variable name — the import swap is what changes the target)
- Remove `import gradeRoutes from './routes/grade.routes';` and `import { surahRouter, memorizationRouter } from './routes/memorization.routes';`
- Add the three module imports.

- [ ] **Step 6: Full gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/modules/grades/grades.module.ts education_management/packages/server/src/modules/surahs/surahs.module.ts education_management/packages/server/src/modules/memorization/memorization.module.ts education_management/packages/server/src/app.ts education_management/packages/server/src/__integration__/route-inventory.ts && git commit -m "feat(m4): swap grades (v1 + mirror), surahs, memorization to contract-driven routing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Revisions module + swap mount

**Files:**
- Create: `packages/server/src/modules/revisions/revisions.module.ts`
- Modify: `packages/server/src/app.ts` (1 mount)

- [ ] **Step 1: Write `packages/server/src/modules/revisions/revisions.module.ts`**

```ts
import { learningContracts } from '@quran-review/shared';
import * as revisionService from '../../services/revision.service';
import type { RevisionStatus } from '../../services/revision.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listRevisions = defineRoute(learningContracts.listRevisions, async ({ query, userId, userRole }) => {
  const surahId = query.surahId ? parseInt(String(query.surahId), 10) : undefined;
  if (surahId !== undefined && isNaN(surahId)) {
    // Legacy parity: hand-built envelope WITHOUT meta. Returning the body here
    // (rather than calling res.json directly) keeps the contract-router the
    // single writer of the response — no double-send.
    return { status: 400 as const, body: { success: false as const, error: 'Invalid surahId' } };
  }
  const revisions = await revisionService.getRevisions(userId!, userRole as 'STUDENT' | 'TEACHER', surahId);
  return { status: 200 as const, body: revisions };
});

const createRevision = defineRoute(learningContracts.createRevision, async ({ userId, req }) => {
  const { studentId, surahId, scheduledFor } = (req.body ?? {}) as {
    studentId?: string;
    surahId?: unknown;
    scheduledFor?: string;
  };
  // Legacy parity: plain Error throws → 500 via errorHandler (pinned quirk).
  if (!studentId) throw new Error('studentId is required');
  if (!surahId || typeof surahId !== 'number') throw new Error('surahId is required');
  if (!scheduledFor) throw new Error('scheduledFor is required');
  const revision = await revisionService.createRevision(userId!, studentId, surahId, new Date(scheduledFor));
  return { status: 201 as const, body: revision };
});

const markRevision = defineRoute(learningContracts.markRevision, async ({ params, userId, userRole, req }) => {
  const status = (req.body ?? {}).status as RevisionStatus;
  if (!status) throw new Error('status is required');
  const revision = await revisionService.updateRevision(
    String(params.id),
    userId!,
    userRole as 'STUDENT' | 'TEACHER' | 'ADMIN',
    status,
  );
  return { status: 200 as const, body: revision };
});

const deleteRevision = defineRoute(learningContracts.deleteRevision, async ({ params, userId, userRole }) => {
  const result = await revisionService.deleteRevision(
    String(params.id),
    userId!,
    userRole as 'STUDENT' | 'TEACHER' | 'ADMIN',
  );
  return { status: 200 as const, body: result as { success: true } };
});

export const revisionsRouter = buildContractRouter([listRevisions, createRevision, markRevision, deleteRevision], {
  mountPrefix: '/api/v1/revisions',
});
```

> The `listRevisions` 400 body `{success:false, error:'Invalid surahId'}` satisfies `ErrorEnvelope` (whose `meta` field is optional) — no `res` access needed, byte-identical to the legacy hand-built response.

- [ ] **Step 2: Swap the mount in `app.ts`**

`app.use('/api/v1/revisions', authenticate, standardLimiter, revisionRoutes);` → `revisionsRouter`; remove `import revisionRoutes from './routes/revision.routes';`, add the module import.

- [ ] **Step 3: Full gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/modules/revisions/revisions.module.ts education_management/packages/server/src/app.ts && git commit -m "feat(m4): swap revisions to contract-driven routing (SM-2 pins green)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Resurrect the mushaf API (mount-or-delete → MOUNT)

**Rationale (recorded in todo.md at M1):** `app.ts` imports `mushafRoutes` but never mounts it, and the module used to crash on load until b31709d fixed its imports. The mobile reader (`mobile/src/api/mushaf.ts`) actively calls `GET /mushaf/surahs/:id`, `GET /mushaf/pages/:page`, `POST /mushaf/log-memorization` against base `/api/v1` — the feature 404s in production today. Mounting fixes a real bug; deleting would orphan a shipped mobile screen.

**Files:**
- Create: `packages/shared/src/contracts/mushaf.contracts.ts`
- Create: `packages/server/src/modules/mushaf/mushaf.module.ts`
- Modify: `packages/shared/src/contracts/registry.ts` (45 → 48), `packages/shared/src/index.ts`
- Modify: `packages/server/src/app.ts` (ADD `/api/v1/mushaf` mount; DELETE the dead `import mushafRoutes` line)
- Modify: `packages/server/src/__integration__/endpoint-manifest.ts` (+3 entries in v1; NOT in LEGACY_PREFIXES)
- Modify: `packages/server/src/__tests__/contract-schemas.test.ts` (45 → 48)
- Test: `packages/server/src/__integration__/mushaf-flows.itest.ts`

- [ ] **Step 1: Write the failing itest**

`packages/server/src/__integration__/mushaf-flows.itest.ts`:

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

async function seedSurahWithAyahs() {
  const surah = await prisma.surah.create({
    data: { number: 114, nameAr: 'الناس', nameEn: 'An-Nas', ayahCount: 2, juz: 30 },
  });
  await prisma.ayah.createMany({
    data: [
      { surahId: surah.id, number: 1, page: 604, juz: 30, text: 'قل أعوذ برب الناس' },
      { surahId: surah.id, number: 2, page: 604, juz: 30, text: 'ملك الناس' },
    ],
  });
  return surah;
}

describe('mushaf API (mounted for the first time — mobile reader depends on it)', () => {
  it('GET /surahs/:id → envelope {success,data} with ordered ayahs; 404 unknown; 400 NaN', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const surah = await seedSurahWithAyahs();

    const res = await request(app).get(`/api/v1/mushaf/surahs/${surah.id}`).set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ayahs).toHaveLength(2);
    expect(res.body.data.ayahs[0].number).toBe(1);

    const missing = await request(app).get('/api/v1/mushaf/surahs/999').set('Authorization', `Bearer ${u.token}`);
    expect(missing.status).toBe(404);

    const nan = await request(app).get('/api/v1/mushaf/surahs/abc').set('Authorization', `Bearer ${u.token}`);
    expect(nan.status).toBe(400);
    expect(nan.body.error).toBe('Invalid surah id');
  });

  it('GET /pages/:page → {success,data:{page,juz,ayahs}}; 404 empty page', async () => {
    const u = await createUser({ role: Role.STUDENT });
    await seedSurahWithAyahs();

    const res = await request(app).get('/api/v1/mushaf/pages/604').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 604, juz: 30 });
    expect(res.body.data.ayahs).toHaveLength(2);

    const empty = await request(app).get('/api/v1/mushaf/pages/12').set('Authorization', `Bearer ${u.token}`);
    expect(empty.status).toBe(404);
    expect(empty.body.error).toBe('Page not found');
  });

  it('POST /log-memorization increments/decrements own ayah progress', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const surah = await seedSurahWithAyahs();

    const up = await request(app)
      .post('/api/v1/mushaf/log-memorization')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ surahId: surah.id, ayahNumber: 1, memorized: true });
    expect(up.status).toBe(200);
    expect(up.body.data).toEqual({ memorizedAyahs: 1, status: 'IN_PROGRESS' });

    const down = await request(app)
      .post('/api/v1/mushaf/log-memorization')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ surahId: surah.id, ayahNumber: 1, memorized: false });
    expect(down.body.data).toEqual({ memorizedAyahs: 0, status: 'NOT_STARTED' });

    const badAyah = await request(app)
      .post('/api/v1/mushaf/log-memorization')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ surahId: surah.id, ayahNumber: 99, memorized: true });
    expect(badAyah.status).toBe(404);
    expect(badAyah.body.error).toBe('Ayah not found');
  });

  it('anon → 401 on all three', async () => {
    expect((await request(app).get('/api/v1/mushaf/surahs/1')).status).toBe(401);
    expect((await request(app).get('/api/v1/mushaf/pages/1')).status).toBe(401);
    expect((await request(app).post('/api/v1/mushaf/log-memorization').send({})).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails** (404s — routes not mounted)

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=mushaf-flows
```

- [ ] **Step 3: Find the real Zod schema export name, then write `packages/shared/src/contracts/mushaf.contracts.ts`**

```bash
grep -n "export const" /Users/haskhr/Documents/opencode/education_management/packages/shared/src/validators/mushaf.ts
```

Use whatever name that prints (the legacy route imported `logAyahMemorizationSchema`, lowercase `l`). Then:

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope } from './types';
import { logAyahMemorizationSchema } from '../validators/mushaf';

const AyahRow = z.looseObject({ number: z.number(), surahId: z.number(), page: z.number(), juz: z.number() });

export const mushafContracts = {
  surahAyahs: defineContract({
    method: 'GET',
    path: '/api/v1/mushaf/surahs/:id',
    summary: 'One surah with its ayahs ordered by number ({success,data} envelope)',
    access: 'authenticated',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: z.looseObject({ id: z.number(), ayahs: z.array(AyahRow) }) }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  page: defineContract({
    method: 'GET',
    path: '/api/v1/mushaf/pages/:page',
    summary: 'One mushaf page: {page, juz, ayahs}',
    access: 'authenticated',
    request: { params: z.object({ page: z.string() }) },
    responses: {
      200: z.object({
        success: z.literal(true),
        data: z.object({ page: z.number(), juz: z.number(), ayahs: z.array(AyahRow) }),
      }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  logMemorization: defineContract({
    method: 'POST',
    path: '/api/v1/mushaf/log-memorization',
    summary: 'Self-service ayah-level memorization log (increments/decrements own progress)',
    access: 'authenticated',
    request: { body: logAyahMemorizationSchema },
    responses: {
      200: z.object({
        success: z.literal(true),
        data: z.object({ memorizedAyahs: z.number(), status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE']) }),
      }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
```

If the grep prints a different export name (e.g. `LogAyahMemorizationSchema`), use that name in the import instead — do not guess.

- [ ] **Step 4: Write `packages/server/src/modules/mushaf/mushaf.module.ts`**

```ts
import { mushafContracts } from '@quran-review/shared';
import * as mushafService from '../../services/mushaf.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const surahAyahs = defineRoute(mushafContracts.surahAyahs, async ({ params }) => {
  const surahId = parseInt(String(params.id), 10);
  if (isNaN(surahId)) throw new AppError(400, 'Invalid surah id');
  const data = await mushafService.getSurahWithAyahs(surahId);
  return { status: 200 as const, body: { success: true as const, data } };
});

const page = defineRoute(mushafContracts.page, async ({ params }) => {
  const pageNum = parseInt(String(params.page), 10);
  if (isNaN(pageNum)) throw new AppError(400, 'Invalid page number');
  const data = await mushafService.getPage(pageNum);
  return { status: 200 as const, body: { success: true as const, data } };
});

const logMemorization = defineRoute(mushafContracts.logMemorization, async ({ body, userId }) => {
  const data = await mushafService.logAyahMemorization(userId!, body.surahId, body.ayahNumber, body.memorized);
  return { status: 200 as const, body: { success: true as const, data } };
});

export const mushafRouter = buildContractRouter([surahAyahs, page, logMemorization], {
  mountPrefix: '/api/v1/mushaf',
});
```

- [ ] **Step 5: Register + manifest + mounts**

- `registry.ts`: import + spread `mushafContracts` (registry 45 → 48). `index.ts`: export line.
- `endpoint-manifest.ts` (v1 block, near surahs/memorization):

```ts
  { method: 'GET', path: '/api/v1/mushaf/surahs/:id', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/mushaf/pages/:page', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/mushaf/log-memorization', access: 'authenticated' },
```

- `app.ts`: delete the dead `import mushafRoutes from './routes/mushaf.routes';` line; add `import { mushafRouter } from './modules/mushaf/mushaf.module';` and mount after memorization: `app.use('/api/v1/mushaf', authenticate, standardLimiter, mushafRouter);`
- `contract-schemas.test.ts`: `45` → `48`.

- [ ] **Step 6: Run mushaf itest + full gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=mushaf-flows
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/shared/src/contracts/mushaf.contracts.ts education_management/packages/shared/src/contracts/registry.ts education_management/packages/shared/src/index.ts education_management/packages/server/src/modules/mushaf/mushaf.module.ts education_management/packages/server/src/app.ts education_management/packages/server/src/__integration__/endpoint-manifest.ts education_management/packages/server/src/__integration__/mushaf-flows.itest.ts education_management/packages/server/src/__tests__/contract-schemas.test.ts && git commit -m "feat(m4): mount the mushaf API — mobile reader endpoints finally live (was dead code)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Retire legacy learning code + wrap up

**Files:**
- Delete: `packages/server/src/routes/{memorization,grade,revision,mushaf}.routes.ts`, `packages/server/src/controllers/{memorization,grade,revision,mushaf}.controller.ts`, `packages/server/src/controllers/__tests__/{grade,memorization,revision}.controller.test.ts`
- Modify: `tasks/todo.md`

- [ ] **Step 1: Prove dead**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
grep -rn "memorization\.controller\|grade\.controller\|revision\.controller\|mushaf\.controller\|routes/memorization\.routes\|routes/grade\.routes\|routes/revision\.routes\|routes/mushaf\.routes" src --include="*.ts" | grep -v "^src/routes/" | grep -v "^src/controllers/"
```
Expected: NO output. If any unit test `require()`s one of these controllers directly (M3 hit this with `security.test.ts`), port that assertion to call the underlying service function instead, exactly as done in M3 Task 5 — do not leave a controller alive just to satisfy one test.

- [ ] **Step 2: Delete** (from `/Users/haskhr/Documents/opencode`)

```bash
git rm education_management/packages/server/src/routes/memorization.routes.ts education_management/packages/server/src/routes/grade.routes.ts education_management/packages/server/src/routes/revision.routes.ts education_management/packages/server/src/routes/mushaf.routes.ts education_management/packages/server/src/controllers/memorization.controller.ts education_management/packages/server/src/controllers/grade.controller.ts education_management/packages/server/src/controllers/revision.controller.ts education_management/packages/server/src/controllers/mushaf.controller.ts education_management/packages/server/src/controllers/__tests__/grade.controller.test.ts education_management/packages/server/src/controllers/__tests__/memorization.controller.test.ts education_management/packages/server/src/controllers/__tests__/revision.controller.test.ts
```

- [ ] **Step 3: Full final gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```

- [ ] **Step 4: Mark M4 done in `tasks/todo.md`** — replace the M4 line with:

```markdown
- [x] M4 learning core (date of completion) — 10 endpoints (grades/surahs/memorization/revisions) swapped to contract routing with SM-2 side effects pinned in DB; mushaf API RESURRECTED (3 endpoints mounted at /api/v1/mushaf — mobile reader was 404ing in production); legacy routes/controllers/mock tests deleted. Plan: `docs/superpowers/plans/2026-07-06-m4-learning-core.md`.
- [ ] M5 media & documents — recordings, reports, files (`?token=` auth pinned), exports. Next: `superpowers:writing-plans` for M5.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add -A education_management/packages/server/src education_management/tasks/todo.md && git commit -m "refactor(m4): retire legacy learning routes/controllers — M4 complete

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of scope for M4 (deliberate)

- `GET /api/v1/exports/grades` — M5 owns exports.
- Gamification/certificate side-effect internals (recordActivity, evaluateMilestones, certificate PDF) — best-effort paths, untouched; their modules swap in M7.
- Fixing the pinned quirks (plain-Error 500s, admin-403 on markRevision, hand-built envelope without meta) — recorded as candidates for a deliberate behavior-change pass after the strangler completes (M13), when pins can be renegotiated on purpose rather than accidentally.
- Mushaf mobile screen/UX changes — M10.
