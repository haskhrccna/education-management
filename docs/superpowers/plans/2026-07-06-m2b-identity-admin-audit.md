# M2b — Identity Part 2 (Admin + Audit Log) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the 12 `/api/v1/admin/*` endpoints (plus their `/api/admin/*` legacy mirrors) onto contract routing with behavior pinned first, then ship the audit-log improvement: a `GET /api/v1/admin/audit-logs` viewer endpoint (the trail is currently write-only) and `userAgent` capture on every audit entry.

**Architecture:** Same strangler shape as M2a: (1) pin current admin behavior with black-box itests against the legacy code, (2) declare 12 admin contracts, (3) port handlers into `src/modules/admin/admin.module.ts` reusing `admin.service.ts` untouched, mount at `/api/v1/admin` + `/api/admin`, (4) add the audit-logs viewer as a 13th contract + manifest entry (a deliberate, tested surface addition), (5) delete `admin.controller.ts`, `admin.routes.ts`, and the mock-based `admin.controller.test.ts`.

**Tech Stack:** Express 5 · Prisma 6 (itest Postgres on port **5433** — NEVER 5432) · Zod v4 · supertest · Jest (`--testPathPatterns`, run from `packages/server/`) · `pre` middleware support in contract-router (M2a Task 4)

## Global Constraints

- **Byte-identical behavior** for the 12 existing endpoints; the only surface change is the NEW `GET /api/v1/admin/audit-logs` (+ auto-mirrored `/api/admin/audit-logs`), added to manifest + registry + contracts in the same task so completeness/parity/authz gates stay green.
- All admin endpoints: `access: [UserRole.ADMIN]` — pinned 403 body for non-admins: `{"success":false,"error":"Insufficient permissions"}`.
- Responses are RAW service echoes (no `{success,data}` envelope): pinned by M0 envelope tests and the Task 1 pins. Never “fix” a shape to look nicer.
- Both suites + typecheck green at every commit, run from `packages/server/`: `npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit`.
- Branch `feat/rebuild-m2b` off `main`. Commits end `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Zod v4 only; shared keeps zod as its only dep. Roles UPPERCASE server-side.
- `admin.service.ts` is NOT modified (its unit tests `admin.service.test.ts` / `admin.service.extended.test.ts` keep passing untouched). Known service quirks to pin, not fix: `PUT users/:id` accepts `role:'PARENT'` through the Zod schema but the service 400s `Invalid role`; `GET progress/teachers?teacherId=<unknown>` returns a literal `null` body.
- Rate limiters skip under NODE_ENV=test; preserve legacy ordering anyway (`paginate`/`broadcastLimiter` as `pre`, before body validation).
- Factory: `createUser({role, status?, email?, password?}) → {id, email, role, token}`.

## File Structure

```
packages/shared/src/contracts/
  admin.contracts.ts        ← NEW: 13 contracts (12 legacy-pinned + auditLogs viewer)
  registry.ts               ← MODIFY: spread adminContracts
packages/shared/src/index.ts ← MODIFY: export admin.contracts
packages/server/src/
  modules/admin/admin.module.ts ← NEW: 13 handlers (ports controller logic; audit calls gain userAgent)
  app.ts                    ← MODIFY: swap /api/v1/admin + /api/admin mounts
  __integration__/
    admin-flows.itest.ts    ← NEW: behavior pins, green on legacy FIRST
    audit-log.itest.ts      ← NEW (Task 4): viewer endpoint + userAgent capture
    route-inventory.ts      ← MODIFY: add '/api/v1/admin': '/api/admin' to CONTRACT_MIRRORS
    endpoint-manifest.ts    ← MODIFY (Task 4 only): add GET /api/v1/admin/audit-logs
  controllers/admin.controller.ts               ← DELETE (Task 5)
  routes/admin.routes.ts                        ← DELETE (Task 5)
  controllers/__tests__/admin.controller.test.ts ← DELETE (Task 5)
tasks/todo.md               ← MODIFY (Task 5): M2b done, M3 next
```

---

### Task 1: Pin admin behavior — `admin-flows.itest.ts` green against LEGACY code

**Files:**
- Create: `packages/server/src/__integration__/admin-flows.itest.ts`

**Interfaces:**
- Consumes: `createUser` factory, `truncateAll`/`disconnect`, real `app`, `prisma` (to verify soft-delete side effects).
- Produces: the pins Tasks 3–5 must keep green.

- [ ] **Step 1: Create branch**

```bash
cd /Users/haskhr/Documents/opencode && git checkout -b feat/rebuild-m2b main
```

- [ ] **Step 2: Write the pins**

`packages/server/src/__integration__/admin-flows.itest.ts`:

```ts
import request from 'supertest';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const PW = 'Str0ngPass!x';

describe('GET /api/v1/admin/users', () => {
  it('200: paginatedResponse envelope {data, meta} with role filter', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ role: Role.TEACHER, email: 't1@example.com' });
    await createUser({ role: Role.STUDENT, email: 's1@example.com' });

    const res = await request(app)
      .get('/api/v1/admin/users?role=teacher')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ email: 't1@example.com', role: 'TEACHER' });
    expect(res.body.data[0]).toHaveProperty('createdAt');
  });
});

describe('POST /api/v1/admin/teachers', () => {
  it('201: raw teacher echo, ACTIVE from birth', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'newt@example.com', password: PW, firstName: 'New', lastName: 'Teacher' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'newt@example.com', role: 'TEACHER', status: 'ACTIVE' });
    expect(res.body.success).toBeUndefined(); // raw echo, no envelope
  });

  it('409 on duplicate email', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const t = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: t.email, password: PW, firstName: 'Dup', lastName: 'Dup' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });
});

describe('PUT /api/v1/admin/users/:id/approve', () => {
  it('200: PENDING student → ACTIVE (raw user echo)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    const res = await request(app)
      .put(`/api/v1/admin/users/${s.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: s.id, status: 'ACTIVE' });
  });

  it('400 when target is not a student', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const t = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .put(`/api/v1/admin/users/${t.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('User is not a student');
  });

  it('404 for unknown id', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .put('/api/v1/admin/users/00000000-0000-4000-8000-000000000000/approve')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Student not found');
  });
});

describe('PUT /api/v1/admin/users/:id/deactivate', () => {
  it('200: user → BANNED', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .put(`/api/v1/admin/users/${s.id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: s.id, status: 'BANNED' });
  });
});

describe('GET /api/v1/admin/users/:id', () => {
  it('200: {user, analytics} composite; deviceToken NEVER leaks', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    await prisma.user.update({ where: { id: s.id }, data: { deviceToken: 'secret-push-token' } });

    const res = await request(app)
      .get(`/api/v1/admin/users/${s.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: s.id, role: 'STUDENT' });
    expect(res.body.user.deviceToken).toBeUndefined();
    expect(res.body.analytics).toMatchObject({ totalAppointments: 0, totalGrades: 0, averageGrade: 0 });
    expect(res.body.analytics).toHaveProperty('memberSince');
  });

  it('404 for unknown id', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .get('/api/v1/admin/users/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/admin/users/:id', () => {
  it('200: partial update, raw echo with createdAt', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .put(`/api/v1/admin/users/${s.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ firstName: 'Zaid' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: s.id, firstName: 'Zaid' });
    expect(res.body).toHaveProperty('createdAt');
  });

  it('409 when email already in use', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const a = await createUser({ role: Role.STUDENT, email: 'a@example.com' });
    const b = await createUser({ role: Role.STUDENT, email: 'b@example.com' });
    const res = await request(app)
      .put(`/api/v1/admin/users/${b.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: a.email });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });

  it("400 'Invalid role' for PARENT — schema allows it, service rejects it (pinned quirk)", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .put(`/api/v1/admin/users/${s.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'PARENT' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid role');
  });
});

describe('DELETE /api/v1/admin/users/:id (soft delete)', () => {
  it('200 {id, deleted:true}; row anonymized, login dead', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, password: PW });
    const res = await request(app)
      .delete(`/api/v1/admin/users/${s.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: s.id, deleted: true });

    const row = await prisma.user.findUnique({ where: { id: s.id } });
    expect(row!.email).toBe(`deleted-${s.id}@deleted.local`);
    expect(row!.firstName).toBe('Deleted User');
    expect(row!.deletedAt).not.toBeNull();

    const login = await request(app).post('/api/v1/auth/login').send({ email: s.email, password: PW });
    expect(login.status).toBe(401); // original email no longer exists on the row
  });
});

describe('GET /api/v1/admin/progress/*', () => {
  it('teachers: computed rows {id,email,name,acceptedAppointments,gradesGiven,averageGrade}', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ role: Role.TEACHER, email: 'prog-t@example.com' });
    const res = await request(app)
      .get('/api/v1/admin/progress/teachers')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      email: 'prog-t@example.com',
      acceptedAppointments: 0,
      gradesGiven: 0,
      averageGrade: 0,
    });
    expect(res.body[0].name).toContain(' ');
  });

  it('teachers?teacherId=<unknown> → literal null body (pinned quirk)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .get('/api/v1/admin/progress/teachers?teacherId=00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('students: computed rows {gradesReceived, acceptedAppointments, averageGrade}', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ role: Role.STUDENT, email: 'prog-s@example.com' });
    const res = await request(app)
      .get('/api/v1/admin/progress/students')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ email: 'prog-s@example.com', gradesReceived: 0, acceptedAppointments: 0 });
  });
});

describe('POST /api/v1/admin/broadcast', () => {
  it('200: sync fallback shape {sent, recipients, message} (queue is null in test)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/admin/broadcast')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ message: 'Assembly at 5pm' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sent: true, message: 'Assembly at 5pm' });
    expect(typeof res.body.recipients).toBe('number');
  });
});

describe('POST /api/v1/admin/bulk/*', () => {
  it('bulk/approve: per-id results incl. "Already active" and "Student not found"', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const pending = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    const active = await createUser({ role: Role.STUDENT });
    const ghost = '00000000-0000-4000-8000-000000000000';
    const res = await request(app)
      .post('/api/v1/admin/bulk/approve')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ studentIds: [pending.id, active.id, ghost] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: pending.id, success: true },
      { id: active.id, success: false, reason: 'Already active' },
      { id: ghost, success: false, reason: 'Student not found' },
    ]);
  });

  it('bulk/deactivate: per-id results', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    const ghost = '00000000-0000-4000-8000-000000000000';
    const res = await request(app)
      .post('/api/v1/admin/bulk/deactivate')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ userIds: [s.id, ghost] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: s.id, success: true },
      { id: ghost, success: false, reason: 'User not found' },
    ]);
  });
});

describe('legacy mirror /api/admin', () => {
  it('GET /api/admin/users behaves identically', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
  });
});
```

- [ ] **Step 3: Run against legacy code — must be green BEFORE any rebuild**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=admin-flows
```
Expected: PASS (~17 tests). Failing pin = wrong guess about current behavior → fix the pin (error bodies may carry `meta.requestId`; use `toMatchObject`, as already written above).

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/__integration__/admin-flows.itest.ts && git commit -m "test(m2b): pin admin behavior — users CRUD, approval, bulk ops, progress, broadcast

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Admin contracts in shared (12 endpoints)

**Files:**
- Create: `packages/shared/src/contracts/admin.contracts.ts`
- Modify: `packages/shared/src/contracts/registry.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/server/src/__tests__/contract-schemas.test.ts` (14 → 26)

**Interfaces:**
- Consumes: `defineContract`, `ErrorEnvelope`, `DateOut` (types.ts); `UserRole` enum; `CreateTeacherSchema`, `BroadcastMessageSchema`, `UpdateUserSchema`, `BulkApproveSchema`, `BulkDeactivateSchema` (validators/common).
- Produces: `adminContracts.{listUsers, createTeacher, approveStudent, deactivateUser, getUserById, updateUser, deleteUser, teacherProgress, studentProgress, broadcast, bulkApprove, bulkDeactivate}` and exported `PaginationMeta` — Task 3 mounts these; Task 4 adds `auditLogs`.

- [ ] **Step 1: Write `packages/shared/src/contracts/admin.contracts.ts`**

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';
import {
  CreateTeacherSchema,
  BroadcastMessageSchema,
  UpdateUserSchema,
  BulkApproveSchema,
  BulkDeactivateSchema,
} from '../validators/common';

const ADMIN = [UserRole.ADMIN];

const RoleEnum = z.enum(['STUDENT', 'TEACHER', 'ADMIN', 'PARENT']);
const StatusEnum = z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'BANNED']);

/** Raw prisma echo used by list/update (7 fields, with createdAt). */
const AdminUserRow = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: RoleEnum,
  status: StatusEnum,
  createdAt: DateOut,
});

/** Raw prisma echo used by createTeacher/approve/deactivate (6 fields, no createdAt). */
const AdminUserCard = AdminUserRow.omit({ createdAt: true });

export const PaginationMeta = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

const BulkResult = z.array(z.object({ id: z.string(), success: z.boolean(), reason: z.string().optional() }));

/** Detail endpoints echo deep prisma composites — loose: pins live in admin-flows.itest.ts. */
const UserDetail = z.object({ user: z.looseObject({ id: z.string() }), analytics: z.looseObject({}) });

const TeacherProgressRow = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  acceptedAppointments: z.number(),
  gradesGiven: z.number(),
  averageGrade: z.number(),
});

const StudentProgressRow = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  gradesReceived: z.number(),
  acceptedAppointments: z.number(),
  averageGrade: z.number(),
});

const BroadcastResult = z.union([
  z.object({ sent: z.literal(true), queued: z.literal(true), message: z.string() }),
  z.object({ sent: z.literal(true), recipients: z.number(), message: z.string() }),
]);

export const adminContracts = {
  listUsers: defineContract({
    method: 'GET',
    path: '/api/v1/admin/users',
    summary: 'Paginated user list, optional ?role= filter — {data, meta} (no success envelope)',
    access: ADMIN,
    request: {
      query: z.object({ role: z.string().optional(), page: z.string().optional(), limit: z.string().optional() }),
    },
    responses: {
      200: z.object({ data: z.array(AdminUserRow), meta: PaginationMeta }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  createTeacher: defineContract({
    method: 'POST',
    path: '/api/v1/admin/teachers',
    summary: 'Create an ACTIVE teacher account',
    access: ADMIN,
    request: { body: CreateTeacherSchema },
    responses: { 201: AdminUserCard, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 409: ErrorEnvelope },
  }),
  approveStudent: defineContract({
    method: 'PUT',
    path: '/api/v1/admin/users/:id/approve',
    summary: 'Approve a PENDING student → ACTIVE (sends approval email)',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: AdminUserCard, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  deactivateUser: defineContract({
    method: 'PUT',
    path: '/api/v1/admin/users/:id/deactivate',
    summary: 'Ban any user',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: AdminUserCard, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  getUserById: defineContract({
    method: 'GET',
    path: '/api/v1/admin/users/:id',
    summary: 'User detail composite {user, analytics}; deviceToken is never selected',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: UserDetail, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  updateUser: defineContract({
    method: 'PUT',
    path: '/api/v1/admin/users/:id',
    summary: 'Partial user update (service rejects role PARENT with 400 — pinned quirk)',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }), body: UpdateUserSchema },
    responses: {
      200: AdminUserRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  deleteUser: defineContract({
    method: 'DELETE',
    path: '/api/v1/admin/users/:id',
    summary: 'Soft-delete: anonymize PII, keep row for referential/audit integrity',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ id: z.string(), deleted: z.literal(true) }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  teacherProgress: defineContract({
    method: 'GET',
    path: '/api/v1/admin/progress/teachers',
    summary: 'Teacher KPI rows; ?teacherId= returns a raw prisma detail (null if unknown — pinned quirk)',
    access: ADMIN,
    request: { query: z.object({ teacherId: z.string().optional() }) },
    responses: {
      200: z.union([z.array(TeacherProgressRow), z.looseObject({ id: z.string() }), z.null()]),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  studentProgress: defineContract({
    method: 'GET',
    path: '/api/v1/admin/progress/students',
    summary: 'Student KPI rows; ?studentId= returns a raw prisma detail (null if unknown)',
    access: ADMIN,
    request: { query: z.object({ studentId: z.string().optional() }) },
    responses: {
      200: z.union([z.array(StudentProgressRow), z.looseObject({ id: z.string() }), z.null()]),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  broadcast: defineContract({
    method: 'POST',
    path: '/api/v1/admin/broadcast',
    summary: 'Broadcast to all users or one role; queued via Redis or sync fallback',
    access: ADMIN,
    request: { body: BroadcastMessageSchema },
    responses: { 200: BroadcastResult, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  bulkApprove: defineContract({
    method: 'POST',
    path: '/api/v1/admin/bulk/approve',
    summary: 'Approve up to 100 students; per-id result rows',
    access: ADMIN,
    request: { body: BulkApproveSchema },
    responses: { 200: BulkResult, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  bulkDeactivate: defineContract({
    method: 'POST',
    path: '/api/v1/admin/bulk/deactivate',
    summary: 'Ban up to 100 users; per-id result rows',
    access: ADMIN,
    request: { body: BulkDeactivateSchema },
    responses: { 200: BulkResult, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
};
```

- [ ] **Step 2: Register + export**

`registry.ts`: add `import { adminContracts } from './admin.contracts';` and `...Object.values(adminContracts),` after the users spread.
`index.ts`: add `export * from './contracts/admin.contracts';` in the contracts block.

- [ ] **Step 3: Update the registry-size unit assertion**

`packages/server/src/__tests__/contract-schemas.test.ts`: change `14` → `26` (both the `it()` title and the `toHaveLength`).

- [ ] **Step 4: Gates**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns="registry-parity|completeness"
npx jest --testPathPatterns=contract-schemas && npx tsc --noEmit
```
Expected: parity 27 tests (26 contracts + uniqueness) PASS — manifest access for all 12 is `['ADMIN']`; completeness PASS (dedup absorbs registry∪source-parse overlap); unit + tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/shared/src/contracts/admin.contracts.ts education_management/packages/shared/src/contracts/registry.ts education_management/packages/shared/src/index.ts education_management/packages/server/src/__tests__/contract-schemas.test.ts && git commit -m "feat(m2b): admin contracts (12 endpoints) — registry at 26

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Admin module + swap both mounts

**Files:**
- Create: `packages/server/src/modules/admin/admin.module.ts`
- Modify: `packages/server/src/app.ts` (mounts `/api/v1/admin` ~line 89 and `/api/admin` ~line 113)
- Modify: `packages/server/src/__integration__/route-inventory.ts` (CONTRACT_MIRRORS)

**Interfaces:**
- Consumes: `adminContracts` (Task 2); `defineRoute(contract, handler, {pre})` + `buildContractRouter`; `adminService.*` (unchanged signatures); `auditLog` (`lib/audit`); `paginate`/`paginatedResponse`/`PaginatedRequest` (`middleware/pagination.middleware`); `broadcastLimiter`.
- Produces: `adminRouter` mounted at both prefixes. Improvement folded in: every `auditLog` call now also passes `userAgent: req.get('user-agent')` (DB-only change, invisible to HTTP pins; asserted in Task 4's itest).

- [ ] **Step 1: Add the admin mirror to route discovery**

In `route-inventory.ts`, extend the map:

```ts
  const CONTRACT_MIRRORS: Record<string, string> = {
    '/api/v1/auth': '/api/auth',
    '/api/v1/users': '/api/users',
    '/api/v1/admin': '/api/admin',
  };
```

- [ ] **Step 2: Write `packages/server/src/modules/admin/admin.module.ts`**

```ts
import { adminContracts } from '@quran-review/shared';
import * as adminService from '../../services/admin.service';
import { auditLog } from '../../lib/audit';
import { paginate, paginatedResponse, PaginatedRequest } from '../../middleware/pagination.middleware';
import { broadcastLimiter } from '../../middleware/rate-limit.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listUsers = defineRoute(
  adminContracts.listUsers,
  async ({ query, req }) => {
    const roleFilter = query.role as string | undefined;
    const { page = 1, limit = 20, skip = 0 } = (req as PaginatedRequest).pagination || {};
    const { users, total } = await adminService.listUsersPaginated(roleFilter, skip, limit);
    return { status: 200 as const, body: paginatedResponse(users, total, page, limit) };
  },
  { pre: [paginate(20, 100)] },
);

const createTeacher = defineRoute(adminContracts.createTeacher, async ({ body, userId, req }) => {
  const teacher = await adminService.createTeacher(body.email, body.password, body.firstName, body.lastName);
  await auditLog({
    userId: userId!,
    action: 'CREATE_TEACHER',
    resourceType: 'USER',
    resourceId: teacher.id,
    details: { email: body.email },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 201 as const, body: teacher };
});

const approveStudent = defineRoute(adminContracts.approveStudent, async ({ params, userId, req }) => {
  const user = await adminService.approveStudent(String(params.id));
  await auditLog({
    userId: userId!,
    action: 'APPROVE_STUDENT',
    resourceType: 'USER',
    resourceId: String(params.id),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: user };
});

const deactivateUser = defineRoute(adminContracts.deactivateUser, async ({ params, userId, req }) => {
  const user = await adminService.deactivateUser(String(params.id));
  await auditLog({
    userId: userId!,
    action: 'DEACTIVATE_USER',
    resourceType: 'USER',
    resourceId: String(params.id),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: user };
});

const getUserById = defineRoute(adminContracts.getUserById, async ({ params }) => {
  const result = await adminService.getUserById(String(params.id));
  return { status: 200 as const, body: result };
});

const updateUser = defineRoute(adminContracts.updateUser, async ({ params, body, userId, req }) => {
  const user = await adminService.updateUser(String(params.id), body);
  await auditLog({
    userId: userId!,
    action: 'UPDATE_USER',
    resourceType: 'USER',
    resourceId: String(params.id),
    details: body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: user };
});

const deleteUser = defineRoute(adminContracts.deleteUser, async ({ params, userId, req }) => {
  const result = await adminService.deleteUser(String(params.id));
  await auditLog({
    userId: userId!,
    action: 'DELETE_USER',
    resourceType: 'USER',
    resourceId: String(params.id),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: result as { id: string; deleted: true } };
});

const teacherProgress = defineRoute(adminContracts.teacherProgress, async ({ query }) => {
  const progress = await adminService.getTeacherProgress(query.teacherId as string | undefined);
  return { status: 200 as const, body: progress };
});

const studentProgress = defineRoute(adminContracts.studentProgress, async ({ query }) => {
  const progress = await adminService.getStudentProgress(query.studentId as string | undefined);
  return { status: 200 as const, body: progress };
});

const broadcast = defineRoute(
  adminContracts.broadcast,
  async ({ body, userId, req }) => {
    const result = await adminService.broadcastMessage(body.message, body.targetRole);
    await auditLog({
      userId: userId!,
      action: 'BROADCAST',
      resourceType: 'MESSAGE',
      details: { targetRole: body.targetRole, messageLength: body.message.length },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return { status: 200 as const, body: result };
  },
  { pre: [broadcastLimiter] },
);

const bulkApprove = defineRoute(adminContracts.bulkApprove, async ({ body, userId, req }) => {
  const results = await adminService.bulkApproveStudents(body.studentIds);
  await auditLog({
    userId: userId!,
    action: 'BULK_APPROVE',
    resourceType: 'USER',
    details: { count: body.studentIds.length },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: results };
});

const bulkDeactivate = defineRoute(adminContracts.bulkDeactivate, async ({ body, userId, req }) => {
  const results = await adminService.bulkDeactivateUsers(body.userIds);
  await auditLog({
    userId: userId!,
    action: 'BULK_DEACTIVATE',
    resourceType: 'USER',
    details: { count: body.userIds.length },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: results };
});

export const adminRouter = buildContractRouter(
  [
    listUsers,
    createTeacher,
    approveStudent,
    deactivateUser,
    getUserById,
    updateUser,
    deleteUser,
    teacherProgress,
    studentProgress,
    broadcast,
    bulkApprove,
    bulkDeactivate,
  ],
  { mountPrefix: '/api/v1/admin' },
);
```

> Type note: the `progress` handlers return the service's union (rows array | prisma detail | null); the 200 schema is a matching union, so `body: progress` should typecheck. If Prisma's deep select types clash with `looseObject` input, cast via the contract's own type: `body: progress as z.infer<(typeof adminContracts.teacherProgress.responses)[200]>` (add `import { z } from 'zod'`).
> Route order: `/users/:id/approve` and `/users/:id/deactivate` are registered BEFORE `/users/:id` (array order above) so Express matches the specific paths first. Keep that order.

- [ ] **Step 3: Swap the mounts in `app.ts`**

Replace: `app.use('/api/v1/admin', authenticate, adminLimiter, adminRoutes);`
with: `app.use('/api/v1/admin', authenticate, adminLimiter, adminRouter);`
Replace: `app.use('/api/admin', authenticate, adminLimiter, adminRoutes);`
with: `app.use('/api/admin', authenticate, adminLimiter, adminRouter);`
Remove `import adminRoutes from './routes/admin.routes';`, add `import { adminRouter } from './modules/admin/admin.module';` next to the other module imports.

- [ ] **Step 4: Full gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```
Expected: all integration (~709) + all unit pass (`admin.controller.test.ts` still passes — file exists until Task 5), tsc clean. admin-flows + authz matrix (both mounts) are the swap detectors. A 500 on a detail/progress route in test env = response-schema violation — loosen only that schema member to match the pinned body.

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/modules/admin/admin.module.ts education_management/packages/server/src/app.ts education_management/packages/server/src/__integration__/route-inventory.ts && git commit -m "feat(m2b): swap admin (v1 + legacy mirror) to contract-driven routing, audit gains userAgent

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Audit-log viewer — `GET /api/v1/admin/audit-logs` (the improvement)

**Files:**
- Modify: `packages/shared/src/contracts/admin.contracts.ts` (add `auditLogs` contract)
- Modify: `packages/server/src/modules/admin/admin.module.ts` (add route)
- Modify: `packages/server/src/__integration__/endpoint-manifest.ts` (1 new v1 entry; mirror auto-generated)
- Modify: `packages/server/src/__tests__/contract-schemas.test.ts` (26 → 27)
- Test: `packages/server/src/__integration__/audit-log.itest.ts`

**Interfaces:**
- Consumes: `prisma.auditLog` (model: id, userId?, action, resourceType, resourceId?, details Json?, ipAddress?, userAgent?, createdAt; relation `user`), `paginate`/`paginatedResponse` (already imported in the module), `PaginationMeta` (exported from admin.contracts in Task 2).
- Produces: `adminContracts.auditLogs`; admins can finally READ the compliance trail (write-only until now).

- [ ] **Step 1: Write the failing itest**

`packages/server/src/__integration__/audit-log.itest.ts`:

```ts
import request from 'supertest';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('GET /api/v1/admin/audit-logs', () => {
  it('returns audited admin actions newest-first with actor, filterable by action', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });

    await request(app)
      .put(`/api/v1/admin/users/${s.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .set('User-Agent', 'itest-agent/1.0');

    const res = await request(app)
      .get('/api/v1/admin/audit-logs?action=APPROVE_STUDENT')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    const entry = res.body.data[0];
    expect(entry).toMatchObject({
      action: 'APPROVE_STUDENT',
      resourceType: 'USER',
      resourceId: s.id,
      userId: admin.id,
      userAgent: 'itest-agent/1.0',
    });
    expect(entry.user).toMatchObject({ id: admin.id });
    expect(entry).toHaveProperty('createdAt');
  });

  it('supports userId filter and pagination meta', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const other = await createUser({ role: Role.ADMIN, email: 'admin2@example.com' });
    const s = await createUser({ role: Role.STUDENT });

    await request(app).put(`/api/v1/admin/users/${s.id}/deactivate`).set('Authorization', `Bearer ${admin.token}`);

    const mine = await request(app)
      .get(`/api/v1/admin/audit-logs?userId=${admin.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.meta).toMatchObject({ page: 1, total: 1 });
    expect(mine.body.data[0].action).toBe('DEACTIVATE_USER');

    const none = await request(app)
      .get(`/api/v1/admin/audit-logs?userId=${other.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(none.body.meta.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=audit-log
```
Expected: FAIL — 404 (route does not exist yet).

- [ ] **Step 3: Add the contract** — in `admin.contracts.ts`, before the closing `};` of `adminContracts`:

```ts
  auditLogs: defineContract({
    method: 'GET',
    path: '/api/v1/admin/audit-logs',
    summary: 'Paginated audit trail (newest first); filters: ?userId=, ?action=',
    access: ADMIN,
    request: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        userId: z.string().optional(),
        action: z.string().optional(),
      }),
    },
    responses: {
      200: z.object({
        data: z.array(
          z.object({
            id: z.string(),
            userId: z.string().nullable(),
            action: z.string(),
            resourceType: z.string(),
            resourceId: z.string().nullable(),
            details: z.unknown(),
            ipAddress: z.string().nullable(),
            userAgent: z.string().nullable(),
            createdAt: DateOut,
            user: z
              .object({ id: z.string(), firstName: z.string(), lastName: z.string(), email: z.string() })
              .nullable(),
          }),
        ),
        meta: PaginationMeta,
      }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
```

- [ ] **Step 4: Add the route** — in `admin.module.ts`:

```ts
const auditLogs = defineRoute(
  adminContracts.auditLogs,
  async ({ query, req }) => {
    const { page = 1, limit = 20, skip = 0 } = (req as PaginatedRequest).pagination || {};
    const where = {
      ...(query.userId ? { userId: String(query.userId) } : {}),
      ...(query.action ? { action: String(query.action) } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { status: 200 as const, body: paginatedResponse(rows, total, page, limit) };
  },
  { pre: [paginate(20, 100)] },
);
```

Add `import { prisma } from '../../prisma/client';` at the top and `auditLogs` to the `buildContractRouter` array (its path has no params; order is not sensitive).

- [ ] **Step 5: Add the manifest entry** — in `endpoint-manifest.ts`, inside the admin block of `v1`:

```ts
  { method: 'GET', path: '/api/v1/admin/audit-logs', access: ['ADMIN'] },
```

(The `/api/admin/audit-logs` mirror is auto-generated by LEGACY_PREFIXES; discovery mirrors it via CONTRACT_MIRRORS; the authz matrix picks both up automatically.)

- [ ] **Step 6: Bump registry-size assertion** — `contract-schemas.test.ts`: `26` → `27` (title + `toHaveLength`).

- [ ] **Step 7: Run the new itest, then the full gate**

```bash
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=audit-log
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```
Expected: audit-log 2 tests PASS; full integration (~713 incl. new authz-matrix rows for both audit-logs mounts), unit, tsc all green.

- [ ] **Step 8: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/shared/src/contracts/admin.contracts.ts education_management/packages/server/src/modules/admin/admin.module.ts education_management/packages/server/src/__integration__/endpoint-manifest.ts education_management/packages/server/src/__integration__/audit-log.itest.ts education_management/packages/server/src/__tests__/contract-schemas.test.ts && git commit -m "feat(m2b): audit-log viewer endpoint — the trail is finally readable (+ userAgent asserted)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Retire legacy admin code + wrap up

**Files:**
- Delete: `packages/server/src/controllers/admin.controller.ts`, `packages/server/src/routes/admin.routes.ts`, `packages/server/src/controllers/__tests__/admin.controller.test.ts`
- Modify: `tasks/todo.md`

- [ ] **Step 1: Prove the files are dead**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
grep -rn "admin\.controller\|routes/admin\.routes" src --include="*.ts" | grep -v "__tests__" | grep -v "src/controllers/admin.controller.ts:" | grep -v "src/routes/admin.routes.ts:"
```
Expected: NO output beyond the two files' own internal references. (`admin.service` imports elsewhere stay — the service survives with its unit tests.)

- [ ] **Step 2: Delete**

```bash
cd /Users/haskhr/Documents/opencode
git rm education_management/packages/server/src/controllers/admin.controller.ts education_management/packages/server/src/routes/admin.routes.ts education_management/packages/server/src/controllers/__tests__/admin.controller.test.ts
```

- [ ] **Step 3: Full final gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```
Expected: integration all green (~713); unit green minus the deleted controller suite; tsc clean; completeness green (admin endpoints now come from registry + mirror map).

- [ ] **Step 4: Mark M2b done in `tasks/todo.md`**

Replace the M2b line with:

```markdown
- [x] M2b identity: admin + audit log (date of completion) — 12 admin endpoints swapped to contract routing (v1 + legacy mirrors) with behavior pinned first; NEW GET /admin/audit-logs viewer + userAgent capture; legacy admin controller/routes/mock tests deleted. Plan: `docs/superpowers/plans/2026-07-06-m2b-identity-admin-audit.md`. M2 COMPLETE.
- [ ] M3 scheduling — appointments, attendance, teacher-change (3 approval side effects pinned: reassign assignedTeacherId, migrate ACCEPTED/REQUESTED appointments, create ACCEPTED appointment if none). Next: `superpowers:writing-plans` for M3.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add -A education_management/packages/server/src education_management/tasks/todo.md && git commit -m "refactor(m2b): retire legacy admin controller/routes — M2 identity milestone complete

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of scope for M2b (deliberate)

- Splitting the 399-line `admin.service.ts` god object — noted for a later refactor pass; the swap keeps it as-is so its 2 unit suites stay untouched.
- Soft-delete redesign, role model changes, admin UI — M12 handles admin screens.
- Audit-log retention/rotation policy — revisit at M13 hardening.
- `progress` endpoints' N+1s (loads all grades to count them) — perf budgets land per-module in later milestones; pinned behavior first.
