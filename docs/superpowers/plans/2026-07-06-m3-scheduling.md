# M3 — Scheduling (Appointments + Attendance + Teacher-Change) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the 8 scheduling endpoints (4 appointments incl. attendance-record, 1 attendance list, 3 teacher-change) onto contract routing with behavior pinned first — including the 3 teacher-change approval side effects verified in the DB — then delete the legacy routes/controllers and their mock unit tests.

**Architecture:** Same strangler shape as M2a/M2b: (1) pin current behavior black-box (the teacher-change approval side effects are the spec's flagship behavioral scenario), (2) declare 8 contracts, (3) port handlers into three modules (`modules/appointments`, `modules/attendance`, `modules/teacher-change`) reusing the three services untouched, (4) swap mounts (`/api/v1/appointments` + its `/api/appointments` mirror; `/api/v1/attendance` and `/api/v1/teacher-changes` have no mirrors), (5) retire legacy files.

**Tech Stack:** Express 5 · Prisma 6 (itest Postgres on port **5433** — NEVER 5432) · Zod v4 · supertest · Jest (`--testPathPatterns`, always run from `packages/server/`) · contract-router with `pre` middleware.

## Global Constraints

- **Byte-identical behavior** for all 8 endpoints; no surface additions in M3.
- Both suites + typecheck green at every commit, from `packages/server/`: `npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit`.
- Branch `feat/rebuild-m3` off `main`. Commits end `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Zod v4 only; shared keeps zod as its only dep. Roles UPPERCASE server-side.
- Services (`appointment.service.ts`, `attendance.service.ts`, `teacherChange.service.ts`) are NOT modified; their unit tests stay. Only routes/controllers retire.
- Mixed envelope reality to pin, not fix: appointments + teacher-changes return RAW prisma echoes; attendance endpoints return `{success:true, data}` envelopes.
- `POST /appointments/:id/attendance` has NO Zod body validation in legacy (controller hand-validates `status`) — the contract declares no `request.body`; the handler ports the hand-validation verbatim so the 400 message stays `status must be one of PRESENT, ABSENT, LATE, EXCUSED`.
- Access mapping (manifest-verified): GET appointments `authenticated`; POST appointments `['STUDENT']`; PUT appointments/:id `['TEACHER','ADMIN']`; POST :id/attendance `['TEACHER']`; GET attendance `authenticated`; POST teacher-changes `['STUDENT']`; GET teacher-changes `['ADMIN','TEACHER','STUDENT']`; PATCH teacher-changes/:id `['ADMIN']`.
- Body fixture formats: `requestedDate` `YYYY-MM-DD`, `requestedTime` `HH:MM` (Zod regex).
- Factory: `createUser({role, status?, email?, password?}) → {id, email, role, token}`. Appointments are created through the API (black-box) or `prisma.appointment.create` when a specific state is needed.

## File Structure

```
packages/shared/src/contracts/
  scheduling.contracts.ts   ← NEW: 8 contracts (appointments, attendance, teacher-change)
  registry.ts               ← MODIFY: spread schedulingContracts (27 → 35)
packages/shared/src/index.ts ← MODIFY: export scheduling.contracts
packages/server/src/
  modules/appointments/appointments.module.ts   ← NEW: 4 routes (incl. record-attendance)
  modules/attendance/attendance.module.ts       ← NEW: 1 route
  modules/teacher-change/teacher-change.module.ts ← NEW: 3 routes
  app.ts                    ← MODIFY: swap 4 mounts (v1×3 + /api/appointments mirror)
  __integration__/
    scheduling-flows.itest.ts ← NEW: behavior pins incl. 3 approval side effects in DB
    route-inventory.ts        ← MODIFY: CONTRACT_MIRRORS += appointments
  __tests__/contract-schemas.test.ts ← MODIFY: 27 → 35
  routes/appointment.routes.ts / attendance.routes.ts / teacherChange.routes.ts ← DELETE (Task 5)
  controllers/appointment.controller.ts / attendance.controller.ts / teacherChange.controller.ts ← DELETE (Task 5)
  controllers/__tests__/{appointment,attendance,teacherChange}.controller.test.ts ← DELETE (Task 5)
tasks/todo.md ← MODIFY (Task 5): M3 done, M4 next
```

Service unit tests that SURVIVE: `appointment.service.test.ts`, `attendance.service.test.ts`, `teacherChange.service.test.ts`, `teacherChange.service.extended.test.ts`.

---

### Task 1: Pin scheduling behavior — `scheduling-flows.itest.ts` green against LEGACY code

**Files:**
- Create: `packages/server/src/__integration__/scheduling-flows.itest.ts`

**Interfaces:**
- Consumes: `createUser`, `truncateAll`/`disconnect`, real `app`, `prisma` (side-effect verification).
- Produces: pins Tasks 3–5 keep green — especially the 3 teacher-change approval side effects.

- [ ] **Step 1: Create branch**

```bash
cd /Users/haskhr/Documents/opencode && git checkout -b feat/rebuild-m3 main
```

- [ ] **Step 2: Write the pins**

`packages/server/src/__integration__/scheduling-flows.itest.ts`:

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

/** Book via API: student requests, teacher accepts. Returns the appointment id. */
async function bookAccepted(student: TestUser, teacher: TestUser, date = '2027-01-15', time = '10:00') {
  const created = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ teacherId: teacher.id, requestedDate: date, requestedTime: time });
  expect(created.status).toBe(201);
  const accepted = await request(app)
    .put(`/api/v1/appointments/${created.body.id}`)
    .set('Authorization', `Bearer ${teacher.token}`)
    .send({ action: 'ACCEPTED' });
  expect(accepted.status).toBe(200);
  return created.body.id as string;
}

describe('POST /api/v1/appointments', () => {
  it('201: raw appointment echo, REQUESTED, duration defaults to 60', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:00' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      studentId: student.id,
      teacherId: teacher.id,
      requestedTime: '10:00',
      durationMinutes: 60,
      status: 'REQUESTED',
    });
    expect(res.body.success).toBeUndefined(); // raw echo
  });

  it('400 when target is not a teacher', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT, email: 'other@example.com' });
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: other.id, requestedDate: '2027-01-15', requestedTime: '10:00' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid teacher');
  });

  it('409 on duplicate slot and on overlapping teacher slot', async () => {
    const s1 = await createUser({ role: Role.STUDENT });
    const s2 = await createUser({ role: Role.STUDENT, email: 's2@example.com' });
    const teacher = await createUser({ role: Role.TEACHER });
    const first = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${s1.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:00' });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${s1.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:00' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('You already have a pending or accepted appointment at this time');

    const overlap = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${s2.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:30' });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error).toBe('Teacher already has an appointment overlapping this time');
  });
});

describe('GET /api/v1/appointments', () => {
  it('student sees own with teacher relation; teacher sees own with student relation (raw arrays)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await bookAccepted(student, teacher);

    const mine = await request(app).get('/api/v1/appointments').set('Authorization', `Bearer ${student.token}`);
    expect(mine.status).toBe(200);
    expect(Array.isArray(mine.body)).toBe(true);
    expect(mine.body[0].teacher).toMatchObject({ id: teacher.id });

    const theirs = await request(app).get('/api/v1/appointments').set('Authorization', `Bearer ${teacher.token}`);
    expect(theirs.body[0].student).toMatchObject({ id: student.id });
  });
});

describe('PUT /api/v1/appointments/:id', () => {
  it("403 'You can only manage your own appointments' for another teacher; admin may manage any", async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const stranger = await createUser({ role: Role.TEACHER, email: 'stranger@example.com' });
    const admin = await createUser({ role: Role.ADMIN });
    const created = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:00' });

    const denied = await request(app)
      .put(`/api/v1/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ action: 'ACCEPTED' });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('You can only manage your own appointments');

    const byAdmin = await request(app)
      .put(`/api/v1/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'REJECTED', amendedNote: 'slot closed' });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body).toMatchObject({ status: 'REJECTED', amendedNote: 'slot closed' });
    expect(byAdmin.body.rejectedAt).toBeTruthy();
  });

  it('404 for unknown appointment', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .put('/api/v1/appointments/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'ACCEPTED' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Appointment not found');
  });
});

describe('POST /api/v1/appointments/:id/attendance', () => {
  it('201 envelope {success,data}; appointment flips to COMPLETED; second record → 409', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const apptId = await bookAccepted(student, teacher);

    const res = await request(app)
      .post(`/api/v1/appointments/${apptId}/attendance`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: 'PRESENT', notes: 'on time' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ appointmentId: apptId, studentId: student.id, status: 'PRESENT' });

    const row = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(row!.status).toBe('COMPLETED');

    const again = await request(app)
      .post(`/api/v1/appointments/${apptId}/attendance`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: 'LATE' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('Attendance has already been recorded for this appointment');
  });

  it('400 with the exact hand-rolled status message (no Zod on this route)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const apptId = await bookAccepted(student, teacher);
    const res = await request(app)
      .post(`/api/v1/appointments/${apptId}/attendance`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: 'SLEEPING' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('status must be one of PRESENT, ABSENT, LATE, EXCUSED');
  });
});

describe('GET /api/v1/attendance', () => {
  it('student reads own without studentId (envelope); non-student without studentId → 400', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const apptId = await bookAccepted(student, teacher);
    await request(app)
      .post(`/api/v1/appointments/${apptId}/attendance`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: 'PRESENT' });

    const own = await request(app).get('/api/v1/attendance').set('Authorization', `Bearer ${student.token}`);
    expect(own.status).toBe(200);
    expect(own.body.success).toBe(true);
    expect(own.body.data).toHaveLength(1);
    expect(own.body.data[0]).toMatchObject({ status: 'PRESENT' });
    expect(own.body.data[0].appointment).toHaveProperty('requestedDate');

    const admin = await createUser({ role: Role.ADMIN });
    const bare = await request(app).get('/api/v1/attendance').set('Authorization', `Bearer ${admin.token}`);
    expect(bare.status).toBe(400);
    expect(bare.body.error).toBe('studentId is required (or call without it as a student to fetch your own)');
  });

  it("teacher without an ACCEPTED appointment with the student → 403 'No accepted appointment with this student'", async () => {
    const student = await createUser({ role: Role.STUDENT });
    const outsider = await createUser({ role: Role.TEACHER, email: 'outsider@example.com' });
    const res = await request(app)
      .get(`/api/v1/attendance?studentId=${student.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('No accepted appointment with this student');
  });
});

describe('teacher-change lifecycle', () => {
  it('POST: 201 raw request with currentTeacher from the ACCEPTED appointment; duplicate PENDING → 409', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await bookAccepted(student, teacher);

    const res = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Need a different schedule fit' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ studentId: student.id, status: 'PENDING' });
    expect(res.body.currentTeacher).toMatchObject({ id: teacher.id });

    const dup = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Changed my mind about the reason' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('You already have a pending request');
  });

  it('GET: student sees own; current teacher sees PENDING against them; admin sees all + ?status filter', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    await bookAccepted(student, teacher);
    await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Need a different schedule fit' });

    const asStudent = await request(app).get('/api/v1/teacher-changes').set('Authorization', `Bearer ${student.token}`);
    expect(asStudent.body).toHaveLength(1);
    expect(asStudent.body[0].currentTeacher).toMatchObject({ id: teacher.id });

    const asTeacher = await request(app).get('/api/v1/teacher-changes').set('Authorization', `Bearer ${teacher.token}`);
    expect(asTeacher.body).toHaveLength(1);
    expect(asTeacher.body[0].student).toMatchObject({ id: student.id });

    const asAdmin = await request(app)
      .get('/api/v1/teacher-changes?status=PENDING')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(asAdmin.body).toHaveLength(1);
  });

  it('APPROVE with newTeacherId: ALL THREE side effects verified in the DB', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const oldTeacher = await createUser({ role: Role.TEACHER, email: 'old-t@example.com' });
    const newTeacher = await createUser({ role: Role.TEACHER, email: 'new-t@example.com' });
    const admin = await createUser({ role: Role.ADMIN });
    const apptId = await bookAccepted(student, oldTeacher);

    const reqRes = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Need a different schedule fit' });

    const decided = await request(app)
      .patch(`/api/v1/teacher-changes/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE', newTeacherId: newTeacher.id, adminNote: 'ok' });
    expect(decided.status).toBe(200);
    expect(decided.body).toMatchObject({ status: 'APPROVED', adminNote: 'ok' });

    // Side effect 1: canonical assignment on the student row
    const studentRow = await prisma.user.findUnique({ where: { id: student.id } });
    expect(studentRow!.assignedTeacherId).toBe(newTeacher.id);

    // Side effect 2: existing ACCEPTED/REQUESTED appointments reassigned
    const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(appt!.teacherId).toBe(newTeacher.id);

    // Side effect 3 (branch not taken here): an ACCEPTED appointment already
    // existed, so NO synthetic appointment was created.
    const count = await prisma.appointment.count({ where: { studentId: student.id } });
    expect(count).toBe(1);
  });

  it('APPROVE for a student with NO accepted appointment creates the synthetic ACCEPTED link (side effect 3)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const newTeacher = await createUser({ role: Role.TEACHER, email: 'new-t2@example.com' });
    const admin = await createUser({ role: Role.ADMIN });

    const reqRes = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'I have no teacher assigned yet' });

    const decided = await request(app)
      .patch(`/api/v1/teacher-changes/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE', newTeacherId: newTeacher.id });
    expect(decided.status).toBe(200);

    const synthetic = await prisma.appointment.findFirst({
      where: { studentId: student.id, teacherId: newTeacher.id, status: 'ACCEPTED' },
    });
    expect(synthetic).not.toBeNull();
    expect(synthetic!.requestedTime).toBe('00:00');
    expect(synthetic!.approvedAt).not.toBeNull();
  });

  it('DENY has no side effects; deciding twice → 409', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    await bookAccepted(student, teacher);
    const reqRes = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Need a different schedule fit' });

    const denied = await request(app)
      .patch(`/api/v1/teacher-changes/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'DENY', adminNote: 'insufficient reason' });
    expect(denied.status).toBe(200);
    expect(denied.body.status).toBe('DENIED');

    const studentRow = await prisma.user.findUnique({ where: { id: student.id } });
    expect(studentRow!.assignedTeacherId).toBeNull();

    const again = await request(app)
      .patch(`/api/v1/teacher-changes/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'DENY' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('Request already decided');
  });
});

describe('legacy mirror /api/appointments', () => {
  it('GET /api/appointments behaves identically', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/appointments').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

> `TestUser` must be exported from `factory.ts` — it already is (M0). If a pin fails against legacy code, the pin mis-guessed current behavior: fix the pin, never the code. Two known risk spots: (a) `assignedTeacherId` may start as `undefined` vs `null` — use `toBeNull()` only if the column default is NULL (it is); (b) attendance `notifyUser` writes a notification row — harmless to the assertions above.

- [ ] **Step 3: Run against legacy code — must be green BEFORE any rebuild**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=scheduling-flows
```
Expected: PASS (~14 tests).

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/__integration__/scheduling-flows.itest.ts && git commit -m "test(m3): pin scheduling behavior — appointments, attendance, teacher-change side effects

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Scheduling contracts in shared (8 endpoints)

**Files:**
- Create: `packages/shared/src/contracts/scheduling.contracts.ts`
- Modify: `packages/shared/src/contracts/registry.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/server/src/__tests__/contract-schemas.test.ts` (27 → 35)

**Interfaces:**
- Consumes: `defineContract`, `ErrorEnvelope`, `DateOut`; `UserRole`; `CreateAppointmentSchema`, `ManageAppointmentSchema` (validators/common); `SubmitTeacherChangeSchema`, `DecideTeacherChangeSchema` (validators/teacherChange).
- Produces: `schedulingContracts.{listAppointments, createAppointment, manageAppointment, recordAttendance, listAttendance, submitTeacherChange, listTeacherChanges, decideTeacherChange}` — Tasks 3–4 mount these.

- [ ] **Step 1: Write `packages/shared/src/contracts/scheduling.contracts.ts`**

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';
import { CreateAppointmentSchema, ManageAppointmentSchema } from '../validators/common';
import { SubmitTeacherChangeSchema, DecideTeacherChangeSchema } from '../validators/teacherChange';

/** Raw prisma appointment echo — deep-pinned by scheduling-flows.itest.ts; loose for forward-compat. */
const Appointment = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  teacherId: z.string(),
  requestedDate: DateOut,
  requestedTime: z.string(),
  durationMinutes: z.number(),
  status: z.enum(['REQUESTED', 'ACCEPTED', 'AMENDED', 'REJECTED', 'COMPLETED', 'CANCELLED']),
});

const TeacherChangeRequest = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED']),
});

const SessionRecord = z.looseObject({
  id: z.string(),
  appointmentId: z.string(),
  studentId: z.string(),
  teacherId: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  recordedAt: DateOut,
});

export const schedulingContracts = {
  listAppointments: defineContract({
    method: 'GET',
    path: '/api/v1/appointments',
    summary: 'Own appointments — student sees teacher relation, teacher/admin sees student relation (RAW array)',
    access: 'authenticated',
    responses: { 200: z.array(Appointment), 401: ErrorEnvelope },
  }),
  createAppointment: defineContract({
    method: 'POST',
    path: '/api/v1/appointments',
    summary: 'Student books a slot; duplicate/overlap → 409 (Serializable transaction)',
    access: [UserRole.STUDENT],
    request: { body: CreateAppointmentSchema },
    responses: { 201: Appointment, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 409: ErrorEnvelope },
  }),
  manageAppointment: defineContract({
    method: 'PUT',
    path: '/api/v1/appointments/:id',
    summary: 'Teacher (own) or admin (any) ACCEPTED/AMENDED/REJECTED',
    access: [UserRole.TEACHER, UserRole.ADMIN],
    request: { params: z.object({ id: z.string() }), body: ManageAppointmentSchema },
    responses: { 200: Appointment, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  recordAttendance: defineContract({
    method: 'POST',
    path: '/api/v1/appointments/:id/attendance',
    summary:
      'Teacher records attendance; NO Zod body (legacy hand-validation, exact 400 message pinned); {success,data} envelope',
    access: [UserRole.TEACHER],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      201: z.object({ success: z.literal(true), data: SessionRecord }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  listAttendance: defineContract({
    method: 'GET',
    path: '/api/v1/attendance',
    summary: 'Attendance history; student defaults to self, others must pass ?studentId=; {success,data} envelope',
    access: 'authenticated',
    request: { query: z.object({ studentId: z.string().optional() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: z.array(SessionRecord) }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  submitTeacherChange: defineContract({
    method: 'POST',
    path: '/api/v1/teacher-changes',
    summary: 'Student requests a teacher change; one PENDING at a time',
    access: [UserRole.STUDENT],
    request: { body: SubmitTeacherChangeSchema },
    responses: {
      201: TeacherChangeRequest,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  listTeacherChanges: defineContract({
    method: 'GET',
    path: '/api/v1/teacher-changes',
    summary: 'Role-shaped list: student=own, teacher=PENDING against them, admin=all (+ ?status=)',
    access: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT],
    request: { query: z.object({ status: z.string().optional() }) },
    responses: { 200: z.array(TeacherChangeRequest), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  decideTeacherChange: defineContract({
    method: 'PATCH',
    path: '/api/v1/teacher-changes/:id',
    summary: 'Admin APPROVE (3 side effects: assignedTeacherId, migrate appts, synthetic ACCEPTED) or DENY',
    access: [UserRole.ADMIN],
    request: { params: z.object({ id: z.string() }), body: DecideTeacherChangeSchema },
    responses: {
      200: TeacherChangeRequest,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
};
```

- [ ] **Step 2: Register + export + bump assertion**

`registry.ts`: `import { schedulingContracts } from './scheduling.contracts';` + `...Object.values(schedulingContracts),` after the admin spread.
`index.ts`: `export * from './contracts/scheduling.contracts';` in the contracts block.
`contract-schemas.test.ts`: `27` → `35` (title + `toHaveLength`).

- [ ] **Step 3: Gates**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns="registry-parity|completeness"
npx jest --testPathPatterns=contract-schemas && npx tsc --noEmit
```
Expected: parity 36 tests (35 + uniqueness) PASS; completeness PASS; unit + tsc clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/shared/src/contracts/scheduling.contracts.ts education_management/packages/shared/src/contracts/registry.ts education_management/packages/shared/src/index.ts education_management/packages/server/src/__tests__/contract-schemas.test.ts && git commit -m "feat(m3): scheduling contracts (8 endpoints) — registry at 35

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Appointments module + swap both mounts

**Files:**
- Create: `packages/server/src/modules/appointments/appointments.module.ts`
- Modify: `packages/server/src/app.ts` (`/api/v1/appointments` mount + `/api/appointments` mirror)
- Modify: `packages/server/src/__integration__/route-inventory.ts`

**Interfaces:**
- Consumes: `schedulingContracts` (Task 2); `defineRoute`/`buildContractRouter`; `appointmentService.{createAppointment(studentId, teacherId, requestedDate, requestedTime, durationMinutes), getMyAppointments(userId, role), manageAppointment(id, userId, userRole, action, amendedNote?)}`; `attendanceService.recordAttendance(appointmentId, teacherId, status, notes?)` + `AttendanceStatusInput`; `AppError`.
- Produces: `appointmentsRouter` mounted at `/api/v1/appointments` and `/api/appointments`.

- [ ] **Step 1: Extend the mirror map** — in `route-inventory.ts`:

```ts
  const CONTRACT_MIRRORS: Record<string, string> = {
    '/api/v1/auth': '/api/auth',
    '/api/v1/users': '/api/users',
    '/api/v1/admin': '/api/admin',
    '/api/v1/appointments': '/api/appointments',
  };
```

- [ ] **Step 2: Write `packages/server/src/modules/appointments/appointments.module.ts`**

```ts
import { schedulingContracts } from '@quran-review/shared';
import * as appointmentService from '../../services/appointment.service';
import * as attendanceService from '../../services/attendance.service';
import type { AttendanceStatusInput } from '../../services/attendance.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const ALLOWED: AttendanceStatusInput[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const listAppointments = defineRoute(schedulingContracts.listAppointments, async ({ userId, userRole }) => {
  const role = userRole as 'STUDENT' | 'TEACHER' | 'ADMIN';
  const appointments = await appointmentService.getMyAppointments(userId!, role);
  return { status: 200 as const, body: appointments };
});

const createAppointment = defineRoute(schedulingContracts.createAppointment, async ({ body, userId }) => {
  const appointment = await appointmentService.createAppointment(
    userId!,
    body.teacherId,
    String(body.requestedDate),
    String(body.requestedTime),
    body.durationMinutes || 60,
  );
  return { status: 201 as const, body: appointment };
});

const manageAppointment = defineRoute(
  schedulingContracts.manageAppointment,
  async ({ params, body, userId, userRole }) => {
    const appointment = await appointmentService.manageAppointment(
      String(params.id),
      userId!,
      String(userRole),
      body.action,
      body.amendedNote,
    );
    return { status: 200 as const, body: appointment };
  },
);

const recordAttendance = defineRoute(schedulingContracts.recordAttendance, async ({ params, userId, req }) => {
  // Legacy parity: no Zod on this route — hand-validate exactly like the old controller.
  const { status, notes } = (req.body ?? {}) as { status?: AttendanceStatusInput; notes?: unknown };
  if (!status || !ALLOWED.includes(status)) {
    throw new AppError(400, `status must be one of ${ALLOWED.join(', ')}`);
  }
  const record = await attendanceService.recordAttendance(
    String(params.id),
    userId!,
    status,
    typeof notes === 'string' && notes.length > 0 ? notes : undefined,
  );
  return { status: 201 as const, body: { success: true as const, data: record } };
});

export const appointmentsRouter = buildContractRouter(
  [listAppointments, createAppointment, manageAppointment, recordAttendance],
  { mountPrefix: '/api/v1/appointments' },
);
```

- [ ] **Step 3: Swap the mounts in `app.ts`**

Replace `app.use('/api/v1/appointments', authenticate, standardLimiter, appointmentRoutes);`
with `app.use('/api/v1/appointments', authenticate, standardLimiter, appointmentsRouter);`
Replace `app.use('/api/appointments', authenticate, standardLimiter, appointmentRoutes);`
with `app.use('/api/appointments', authenticate, standardLimiter, appointmentsRouter);`
Remove `import appointmentRoutes from './routes/appointment.routes';`, add `import { appointmentsRouter } from './modules/appointments/appointments.module';`.

- [ ] **Step 4: Full gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```
Expected: all green. `body.action` (enum) is assignable to the service's `action: string` — no cast needed.

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/modules/appointments/appointments.module.ts education_management/packages/server/src/app.ts education_management/packages/server/src/__integration__/route-inventory.ts && git commit -m "feat(m3): swap appointments (v1 + legacy mirror) to contract-driven routing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Attendance + teacher-change modules + swap mounts

**Files:**
- Create: `packages/server/src/modules/attendance/attendance.module.ts`
- Create: `packages/server/src/modules/teacher-change/teacher-change.module.ts`
- Modify: `packages/server/src/app.ts` (2 mounts, no mirrors exist for these)

**Interfaces:**
- Consumes: `schedulingContracts`; `attendanceService.getStudentAttendance(callerId, callerRole, studentId)`; `teacherChangeService.{submitTeacherChangeRequest(studentId, reason), getTeacherChangeRequests(userId, userRole, statusFilter?), decideTeacherChangeRequest(id, action, adminId?, callerRole?, adminNote?, newTeacherId?)}`; `AppError`.
- Produces: `attendanceRouter` at `/api/v1/attendance`; `teacherChangeRouter` at `/api/v1/teacher-changes`.

- [ ] **Step 1: Write `packages/server/src/modules/attendance/attendance.module.ts`**

```ts
import { schedulingContracts } from '@quran-review/shared';
import * as attendanceService from '../../services/attendance.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listAttendance = defineRoute(schedulingContracts.listAttendance, async ({ query, userId, userRole }) => {
  const callerRole = userRole as 'STUDENT' | 'TEACHER' | 'ADMIN';
  const studentId =
    (typeof query.studentId === 'string' && query.studentId) || (callerRole === 'STUDENT' ? userId! : null);
  if (!studentId) {
    throw new AppError(400, 'studentId is required (or call without it as a student to fetch your own)');
  }
  const records = await attendanceService.getStudentAttendance(userId!, callerRole, studentId);
  return { status: 200 as const, body: { success: true as const, data: records } };
});

export const attendanceRouter = buildContractRouter([listAttendance], { mountPrefix: '/api/v1/attendance' });
```

> The contract path IS the mount prefix, so the router-relative sub becomes `'/'` (contract-router already handles the empty-slice case).

- [ ] **Step 2: Write `packages/server/src/modules/teacher-change/teacher-change.module.ts`**

```ts
import { schedulingContracts } from '@quran-review/shared';
import * as teacherChangeService from '../../services/teacherChange.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const submitTeacherChange = defineRoute(schedulingContracts.submitTeacherChange, async ({ body, userId }) => {
  const result = await teacherChangeService.submitTeacherChangeRequest(userId!, body.reason);
  return { status: 201 as const, body: result };
});

const listTeacherChanges = defineRoute(schedulingContracts.listTeacherChanges, async ({ query, userId, userRole }) => {
  const statusFilter = typeof query.status === 'string' ? query.status : undefined;
  const result = await teacherChangeService.getTeacherChangeRequests(userId!, userRole!, statusFilter);
  return { status: 200 as const, body: result };
});

const decideTeacherChange = defineRoute(
  schedulingContracts.decideTeacherChange,
  async ({ params, body, userId, userRole }) => {
    const result = await teacherChangeService.decideTeacherChangeRequest(
      String(params.id),
      body.action,
      userId,
      userRole,
      body.adminNote,
      body.newTeacherId,
    );
    return { status: 200 as const, body: result };
  },
);

export const teacherChangeRouter = buildContractRouter(
  [submitTeacherChange, listTeacherChanges, decideTeacherChange],
  { mountPrefix: '/api/v1/teacher-changes' },
);
```

- [ ] **Step 3: Swap the mounts in `app.ts`**

Replace `app.use('/api/v1/teacher-changes', authenticate, standardLimiter, teacherChangeRoutes);`
with `app.use('/api/v1/teacher-changes', authenticate, standardLimiter, teacherChangeRouter);`
Replace `app.use('/api/v1/attendance', authenticate, standardLimiter, attendanceRoutes);`
with `app.use('/api/v1/attendance', authenticate, standardLimiter, attendanceRouter);`
Remove `import teacherChangeRoutes from './routes/teacherChange.routes';` and `import attendanceRoutes from './routes/attendance.routes';`; add the two module imports.

- [ ] **Step 4: Full gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```
Expected: all green — scheduling-flows (incl. all 3 side-effect pins) is the swap detector.

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/modules/attendance/attendance.module.ts education_management/packages/server/src/modules/teacher-change/teacher-change.module.ts education_management/packages/server/src/app.ts && git commit -m "feat(m3): swap attendance + teacher-change to contract-driven routing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Retire legacy scheduling code + wrap up

**Files:**
- Delete: `packages/server/src/routes/{appointment,attendance,teacherChange}.routes.ts`, `packages/server/src/controllers/{appointment,attendance,teacherChange}.controller.ts`, `packages/server/src/controllers/__tests__/{appointment,attendance,teacherChange}.controller.test.ts`
- Modify: `tasks/todo.md`

- [ ] **Step 1: Prove the files are dead**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
grep -rn "appointment\.controller\|attendance\.controller\|teacherChange\.controller\|routes/appointment\.routes\|routes/attendance\.routes\|routes/teacherChange\.routes" src --include="*.ts" | grep -v "__tests__" | grep -v "^src/routes/\|^src/controllers/"
```
Expected: NO output beyond the deleted files' own internal references (route files importing their controllers). Service imports elsewhere are fine — services stay.

- [ ] **Step 2: Delete**

```bash
cd /Users/haskhr/Documents/opencode
git rm education_management/packages/server/src/routes/appointment.routes.ts education_management/packages/server/src/routes/attendance.routes.ts education_management/packages/server/src/routes/teacherChange.routes.ts education_management/packages/server/src/controllers/appointment.controller.ts education_management/packages/server/src/controllers/attendance.controller.ts education_management/packages/server/src/controllers/teacherChange.controller.ts education_management/packages/server/src/controllers/__tests__/appointment.controller.test.ts education_management/packages/server/src/controllers/__tests__/attendance.controller.test.ts education_management/packages/server/src/controllers/__tests__/teacherChange.controller.test.ts
```

- [ ] **Step 3: Full final gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```
Expected: integration all green; unit green minus the 3 deleted controller suites; tsc clean; completeness green via registry + mirror map.

- [ ] **Step 4: Mark M3 done in `tasks/todo.md`** — replace the M3 line with:

```markdown
- [x] M3 scheduling (date of completion) — 8 endpoints (appointments + attendance + teacher-change) swapped to contract routing; 3 teacher-change approval side effects pinned in DB; legacy routes/controllers/mock tests deleted. Plan: `docs/superpowers/plans/2026-07-06-m3-scheduling.md`.
- [ ] M4 learning core — memorization, SM-2 revisions, mushaf/surah (incl. the dead-mushaf mount-or-delete decision), grades. Next: `superpowers:writing-plans` for M4.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add -A education_management/packages/server/src education_management/tasks/todo.md && git commit -m "refactor(m3): retire legacy scheduling routes/controllers — M3 complete

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of scope for M3 (deliberate)

- The mushaf dead-code decision and memorization/grades — M4 (learning core).
- `GET /api/v1/exports/appointments` — M5 (media & documents) owns exports.
- Appointment-slot UX/product rethink — per-cluster mini-brainstorms in M10/M11.
- Serializable-transaction perf tuning on booking — perf budgets land later (spec §3.5).
