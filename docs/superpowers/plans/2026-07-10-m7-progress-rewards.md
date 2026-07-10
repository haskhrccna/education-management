# M7 Progress & Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (session precedent: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the 11 remaining progress-&-rewards endpoints — gamification (2), certificates listing (1), analytics (1), parents (6) — onto contract routing with behavior pinned first, then delete the legacy routes/controllers/mock tests.

**Architecture:** Same strangler pattern as M2–M6. Three new modules (gamification, analytics, parents) plus one route added to the **existing** certificates module — `/api/v1/certificates` is currently dual-mounted (legacy router for GET / + contract module for PATCH /:id/regenerate-link); after M7 it collapses to a single contract mount. None of these prefixes has a legacy `/api/*` mirror, so no CONTRACT_MIRRORS changes. All responses are `{success: true, data}` envelopes — no DSL work.

**Tech Stack:** Express 5 · Zod v4 contracts (`@quran-review/shared`) · Prisma 6 · Jest 30 integration harness (real Postgres 5433).

## Context

Spec §5 M7 = "Progress & rewards — gamification, certificates, analytics, parents". Feature work (roadmap Stages 1–4) already contract-routed the *newer* halves of these domains (parent-links, ijazahs, milestones, roster, certificates regenerate-link); M7 retires the four original legacy routers. After M7, only halaqa (M8) and docs/metrics/verify (M13) remain legacy.

Parents note: `/api/v1/parent-links/*` (digest-preference, consent) is a separate, already-swapped module — M7 touches only the legacy `/api/v1/parents` prefix.

## Global Constraints (spec + session rules)

- Error bodies byte-identical to M0 pins; error envelopes carry `meta.requestId` — pin with `toMatchObject`.
- "Fix the handler/contract, never the pin."
- Paths/methods/access unchanged — `endpoint-manifest.ts:132-145` entries stay untouched; none of the four prefixes is in `LEGACY_PREFIXES`.
- Zod v4 `z.looseObject` rows; service return types must be type-aliases/Prisma types, not interfaces (M6 lesson: interfaces lack the implicit index signature looseObject needs).
- Jest 30 `--testPathPatterns`; integration via `jest.integration.config.js` `--runInBand`; docker `server-db-test-1` up; shared supertest agent in new suites.
- Known intermittent phantom-response flake (~1–3/1000 requests, server log shows no matching request) — rerun before investigating.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; `--no-verify` blocked. Branch `feat/rebuild-m7` off `main`.

## Legacy behavior inventory (what gets pinned)

| Endpoint | Access (manifest) | Response |
|---|---|---|
| GET /api/v1/gamification/me | authenticated | 200 `{success:true, data:{streak, badges}}`; streak defaults `{userId, currentStreak:0, longestStreak:0, lastActiveDate:null}` when absent |
| GET /api/v1/gamification/leaderboard | authenticated | 200 `{success:true, data:[...]}`; `?scope=teacher:<id>` filters to that teacher's ACCEPTED students (`[]` if none); `?limit=` parsed with NaN→20 fallback |
| GET /api/v1/certificates | authenticated | 200 `successResponse(certs)` with `student` include, `issuedAt desc`; STUDENT ⇒ own; ADMIN ⇒ all or `?studentId=` filter; TEACHER/PARENT ⇒ 403 `Only students and admins can access certificates` |
| GET /api/v1/analytics | ADMIN | 200 `successResponse({surahMissRates, teacherLoad, weeklyActiveStudents})` |
| POST /api/v1/parents/links | PARENT | 201 `{success:true, data:<link>}`; manual validation (no validate()): 400 `studentId is required`; service: 404 `Student not found`, 400 `Link target must be a student account`, 409 `A link already exists for this parent/student pair (status: <STATUS>)` |
| GET /api/v1/parents/links | PARENT, ADMIN | 200 `{success:true, data:[...]}`; parents see own (student include), admins see all (parent+student includes) |
| GET /api/v1/parents/children | PARENT | 200 `{success:true, data:[{linkId, linkedAt, digestOptOut, guardianConsentStatus, student}]}` (APPROVED links only) |
| GET /api/v1/parents/student-search | PARENT | 200 `{success:true, data:{id, firstName, lastName, email}}`; `?email=` — missing/unknown ⇒ 404 `Student not found` |
| GET /api/v1/parents/children/:studentId/dashboard | PARENT | 200 `{success:true, data:{student, memorization, grades, attendance, upcomingAppointments, pendingRevisions}}`; unlinked ⇒ 403 `No approved link to this student` |
| PATCH /api/v1/parents/links/:id/decision | ADMIN | 200 `{success:true, data:<link>}`; manual 400 `action must be APPROVE or DENY`; 404 `Link request not found`; APPROVE idempotent; DENY-after-APPROVE ⇒ 409 `Cannot deny an approved link — admin must revoke separately` |

## File Structure

**Create**
- `packages/server/src/__integration__/progress-flows.itest.ts` — behavior pins (green against legacy first)
- `packages/shared/src/contracts/progress.contracts.ts` — `progressContracts` (9: gamification 2 + analytics 1 + parents 6)
- `packages/server/src/modules/gamification/gamification.module.ts`
- `packages/server/src/modules/analytics/analytics.module.ts`
- `packages/server/src/modules/parents/parents.module.ts`
- `packages/server/src/services/certificate.service.ts` — `listCertificates(callerId, callerRole, studentIdFilter?)` extracted from `certificate.controller.ts`

**Modify**
- `packages/shared/src/contracts/certificates.contracts.ts` — add `listCertificates` contract to the existing `certificatesContracts`
- `packages/shared/src/contracts/registry.ts`, `packages/shared/src/index.ts` — register `progressContracts` (certificates grows automatically via `Object.values`)
- `packages/server/src/modules/certificates/certificates.module.ts` — add the listCertificates route
- `packages/server/src/__tests__/contract-schemas.test.ts` — registry count 88→98
- `packages/server/src/app.ts` — 4 mounts swapped; certificates dual-mount collapses to one
- `tasks/todo.md` — mark M7 done, point at M8

**Delete (Task 3, after suites green)**
- `packages/server/src/routes/{gamification,certificate,analytics,parent}.routes.ts`
- `packages/server/src/controllers/{gamification,certificate,analytics,parent}.controller.ts`
- `packages/server/src/controllers/__tests__/{gamification,parent}.controller.test.ts` (the only two that exist)
- Keep: `services/{gamification,analytics,parent}.service.ts` and their tests.

---

### Task 0: Branch + plan doc

- [ ] `git checkout -b feat/rebuild-m7` (from `main`)
- [ ] Commit this plan: `docs(m7): progress & rewards implementation plan`

### Task 1: Pin legacy behavior (progress-flows.itest.ts)

**Files:** Create `packages/server/src/__integration__/progress-flows.itest.ts`
**Interfaces:** Consumes `createUser`/`TestUser` from `./factory`, `truncateAll`/`disconnect` from `./db`, `prisma` for seeding (appointments, certificates, parent links, streaks); module-level `const agent = request.agent(app)`.

- [ ] **Step 1: Write the pins.**

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const agent = request.agent(app);
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

async function linkAccepted(student: TestUser, teacher: TestUser) {
  await prisma.appointment.create({
    data: { studentId: student.id, teacherId: teacher.id, requestedDate: new Date(), requestedTime: '10:00', status: 'ACCEPTED' },
  });
}

describe('gamification', () => {
  it('GET /me → {success,data:{streak,badges}} with zero-streak default', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await agent.get('/api/v1/gamification/me').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.streak).toMatchObject({ userId: student.id, currentStreak: 0, longestStreak: 0 });
    expect(res.body.data.badges).toEqual([]);
  });

  it('GET /leaderboard: default scope lists streak holders; teacher scope filters; empty teacher ⇒ []', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    await prisma.streak.create({ data: { userId: student.id, currentStreak: 3, longestStreak: 5, lastActiveDate: new Date() } });
    await prisma.streak.create({ data: { userId: other.id, currentStreak: 1, longestStreak: 1, lastActiveDate: new Date() } });

    const all = await agent.get('/api/v1/gamification/leaderboard').set('Authorization', `Bearer ${student.token}`);
    expect(all.status).toBe(200);
    expect(all.body.success).toBe(true);
    expect(all.body.data.length).toBeGreaterThanOrEqual(2);

    const scoped = await agent
      .get(`/api/v1/gamification/leaderboard?scope=teacher:${teacher.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(scoped.status).toBe(200);
    expect(scoped.body.data).toHaveLength(1);

    const empty = await agent
      .get(`/api/v1/gamification/leaderboard?scope=teacher:${FAKE_ID}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(empty.body.data).toEqual([]);
  });
});

describe('certificates listing', () => {
  it('student sees own; admin sees all + ?studentId filter; teacher → 403 pinned message', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/certificates/a.pdf' } });
    await prisma.certificate.create({ data: { studentId: other.id, pdfUrl: '/certificates/b.pdf' } });

    const own = await agent.get('/api/v1/certificates').set('Authorization', `Bearer ${student.token}`);
    expect(own.status).toBe(200);
    expect(own.body.success).toBe(true);
    expect(own.body.data).toHaveLength(1);
    expect(own.body.data[0].student).toMatchObject({ id: student.id });

    const all = await agent.get('/api/v1/certificates').set('Authorization', `Bearer ${admin.token}`);
    expect(all.body.data).toHaveLength(2);

    const filtered = await agent
      .get(`/api/v1/certificates?studentId=${other.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(filtered.body.data).toHaveLength(1);

    const denied = await agent.get('/api/v1/certificates').set('Authorization', `Bearer ${teacher.token}`);
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ success: false, error: 'Only students and admins can access certificates' });
  });
});

describe('analytics', () => {
  it('admin → successResponse({surahMissRates, teacherLoad, weeklyActiveStudents})', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await agent.get('/api/v1/analytics').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.surahMissRates)).toBe(true);
    expect(Array.isArray(res.body.data.teacherLoad)).toBe(true);
    expect(res.body.data.weeklyActiveStudents).toBeDefined();
  });
});

describe('parents', () => {
  it('POST /links: 201 PENDING link; missing studentId → 400 pinned; duplicate → 409 with status text', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });

    const missing = await agent.post('/api/v1/parents/links').set('Authorization', `Bearer ${parent.token}`).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ success: false, error: 'studentId is required' });

    const created = await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: student.id, reason: 'my child' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ parentId: parent.id, studentId: student.id, status: 'PENDING' });

    const dup = await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: student.id });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('A link already exists for this parent/student pair (status: PENDING)');

    const notStudent = await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: (await createUser({ role: Role.TEACHER })).id });
    expect(notStudent.status).toBe(400);
    expect(notStudent.body.error).toBe('Link target must be a student account');
  });

  it('decision flow: bad action 400; APPROVE 200 (idempotent); children + dashboard unlock; DENY-after-APPROVE 409', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const created = await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: student.id });
    const linkId = created.body.data.id;

    const bad = await agent
      .patch(`/api/v1/parents/links/${linkId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'MAYBE' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('action must be APPROVE or DENY');

    const approve = await agent
      .patch(`/api/v1/parents/links/${linkId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('APPROVED');

    const again = await agent
      .patch(`/api/v1/parents/links/${linkId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });
    expect(again.status).toBe(200); // idempotent (pinned)

    const children = await agent.get('/api/v1/parents/children').set('Authorization', `Bearer ${parent.token}`);
    expect(children.body.data).toHaveLength(1);
    expect(children.body.data[0]).toMatchObject({ linkId, student: { id: student.id } });

    const dash = await agent
      .get(`/api/v1/parents/children/${student.id}/dashboard`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(dash.status).toBe(200);
    expect(dash.body.data.student).toMatchObject({ id: student.id });
    expect(dash.body.data).toHaveProperty('memorization');
    expect(dash.body.data).toHaveProperty('upcomingAppointments');

    const deny = await agent
      .patch(`/api/v1/parents/links/${linkId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'DENY' });
    expect(deny.status).toBe(409);
    expect(deny.body.error).toBe('Cannot deny an approved link — admin must revoke separately');
  });

  it('dashboard without approved link → 403; GET /links role scoping; student-search 200/404', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const otherParent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: student.id });

    const noLink = await agent
      .get(`/api/v1/parents/children/${student.id}/dashboard`)
      .set('Authorization', `Bearer ${otherParent.token}`);
    expect(noLink.status).toBe(403);
    expect(noLink.body.error).toBe('No approved link to this student');

    const mine = await agent.get('/api/v1/parents/links').set('Authorization', `Bearer ${otherParent.token}`);
    expect(mine.body.data).toEqual([]);
    const adminAll = await agent.get('/api/v1/parents/links').set('Authorization', `Bearer ${admin.token}`);
    expect(adminAll.body.data).toHaveLength(1);
    expect(adminAll.body.data[0].parent).toMatchObject({ id: parent.id });

    const found = await agent
      .get(`/api/v1/parents/student-search?email=${encodeURIComponent(student.email)}`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(found.status).toBe(200);
    expect(found.body.data).toMatchObject({ id: student.id, email: student.email });

    const missing = await agent
      .get('/api/v1/parents/student-search?email=nobody@example.com')
      .set('Authorization', `Bearer ${parent.token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('Student not found');
  });
});
```

If a seeded field name is wrong (e.g. Streak model columns), fix the SEED to match `prisma/schema.prisma` — never weaken an assertion that observed legacy behavior contradicts.
- [ ] **Step 2:** `cd packages/server && npx jest -c jest.integration.config.js --runInBand --testPathPatterns=progress-flows` → green against legacy.
- [ ] **Step 3: Commit** `test(m7): pin gamification/certificates/analytics/parents behavior before swap`

### Task 2: Contracts — progress.contracts.ts + certificates addition

**Files:** Create `packages/shared/src/contracts/progress.contracts.ts`; modify `certificates.contracts.ts`, `registry.ts`, `index.ts`, `packages/server/src/__tests__/contract-schemas.test.ts`
**Interfaces (produces):** `progressContracts.{gamificationMe,leaderboard,adminAnalytics,requestParentLink,listParentLinks,parentChildren,parentStudentSearch,childDashboard,decideParentLink}` and `certificatesContracts.listCertificates` — consumed by Task 3.

- [ ] **Step 1: progress.contracts.ts** — all `{success:true,data}` envelopes; rows loose:

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';

const Ok = <T extends z.ZodType>(data: T) => z.looseObject({ success: z.literal(true), data });

const StreakRow = z.looseObject({
  userId: z.string(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastActiveDate: DateOut.nullable(),
});

const ParentLinkRow = z.looseObject({
  id: z.string(),
  parentId: z.string(),
  studentId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED']),
  reason: z.string().nullable(),
});

const MiniStudent = z.looseObject({ id: z.string(), firstName: z.string(), lastName: z.string(), email: z.string() });

export const progressContracts = {
  gamificationMe: defineContract({
    method: 'GET',
    path: '/api/v1/gamification/me',
    summary: 'Own streak (zero-default) + earned badges',
    access: 'authenticated',
    responses: {
      200: Ok(z.looseObject({ streak: StreakRow, badges: z.array(z.looseObject({ code: z.string() })) })),
      401: ErrorEnvelope,
    },
  }),
  leaderboard: defineContract({
    method: 'GET',
    path: '/api/v1/gamification/leaderboard',
    summary: "Streak leaderboard; ?scope=teacher:<id> filters to that teacher's ACCEPTED students; ?limit NaN→20",
    access: 'authenticated',
    responses: { 200: Ok(z.array(z.looseObject({ userId: z.string() }))), 401: ErrorEnvelope },
  }),
  adminAnalytics: defineContract({
    method: 'GET',
    path: '/api/v1/analytics',
    summary: 'Admin dashboard aggregates',
    access: [UserRole.ADMIN],
    responses: {
      200: Ok(
        z.looseObject({
          surahMissRates: z.array(z.unknown()),
          teacherLoad: z.array(z.unknown()),
          weeklyActiveStudents: z.unknown(),
        })
      ),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  requestParentLink: defineContract({
    method: 'POST',
    path: '/api/v1/parents/links',
    summary: 'Parent requests a PENDING link. Manual body validation (no validate()) — pinned messages',
    access: [UserRole.PARENT],
    responses: {
      201: Ok(ParentLinkRow),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  listParentLinks: defineContract({
    method: 'GET',
    path: '/api/v1/parents/links',
    summary: 'Parents: own links (student include). Admins: all (parent+student includes)',
    access: [UserRole.PARENT, UserRole.ADMIN],
    responses: { 200: Ok(z.array(ParentLinkRow)), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  parentChildren: defineContract({
    method: 'GET',
    path: '/api/v1/parents/children',
    summary: 'APPROVED children: {linkId, linkedAt, digestOptOut, guardianConsentStatus, student}',
    access: [UserRole.PARENT],
    responses: {
      200: Ok(z.array(z.looseObject({ linkId: z.string(), student: MiniStudent }))),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  parentStudentSearch: defineContract({
    method: 'GET',
    path: '/api/v1/parents/student-search',
    summary: '?email= exact match on ACTIVE students; missing/unknown ⇒ 404 Student not found',
    access: [UserRole.PARENT],
    responses: { 200: Ok(MiniStudent), 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  childDashboard: defineContract({
    method: 'GET',
    path: '/api/v1/parents/children/:studentId/dashboard',
    summary: 'Read-only child dashboard; requires APPROVED link (403 otherwise)',
    access: [UserRole.PARENT],
    responses: {
      200: Ok(
        z.looseObject({
          student: MiniStudent,
          memorization: z.array(z.unknown()),
          grades: z.array(z.unknown()),
          attendance: z.array(z.unknown()),
          upcomingAppointments: z.array(z.unknown()),
          pendingRevisions: z.array(z.unknown()),
        })
      ),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  decideParentLink: defineContract({
    method: 'PATCH',
    path: '/api/v1/parents/links/:id/decision',
    summary: 'APPROVE (idempotent, fires consent init + notification) or DENY; manual action validation — pinned',
    access: [UserRole.ADMIN],
    responses: {
      200: Ok(ParentLinkRow),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
};
```

- [ ] **Step 2: certificates.contracts.ts** — add to the existing `certificatesContracts` object (reuse that file's existing style; import `DateOut` if absent):

```ts
listCertificates: defineContract({
  method: 'GET',
  path: '/api/v1/certificates',
  summary: 'STUDENT ⇒ own; ADMIN ⇒ all or ?studentId=; others 403 (pinned message)',
  access: 'authenticated',
  responses: {
    200: z.looseObject({
      success: z.literal(true),
      data: z.array(
        z.looseObject({
          id: z.string(),
          studentId: z.string(),
          pdfUrl: z.string(),
          issuedAt: DateOut,
          student: z.looseObject({ id: z.string(), firstName: z.string(), lastName: z.string() }),
        })
      ),
    }),
    401: ErrorEnvelope,
    403: ErrorEnvelope,
  },
}),
```

- [ ] **Step 3:** `registry.ts`: import + spread `progressContracts`. `index.ts`: `export * from './contracts/progress.contracts';`. `contract-schemas.test.ts`: count 88→98.
- [ ] **Step 4:** `npx jest --testPathPatterns=contract-schemas` and `npx jest -c jest.integration.config.js --runInBand --testPathPatterns='registry-parity|completeness'` → green.
- [ ] **Step 5: Commit** `feat(m7): progress & rewards contracts`

### Task 3: Swap modules + delete legacy

**Files:** Create `modules/gamification/gamification.module.ts`, `modules/analytics/analytics.module.ts`, `modules/parents/parents.module.ts`, `services/certificate.service.ts`; modify `modules/certificates/certificates.module.ts`, `app.ts`; delete legacy files
**Interfaces:** Consumes Task 2 contracts + untouched services. Produces `gamificationRouter`, `analyticsRouter`, `parentsRouter` and extends `certificatesRouter`. New: `certificateService.listCertificates(callerId: string, callerRole: string | undefined, studentIdFilter?: string)`.

- [ ] **Step 1: gamification.module.ts**

```ts
import { progressContracts } from '@quran-review/shared';
import * as gamificationService from '../../services/gamification.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const me = defineRoute(progressContracts.gamificationMe, async ({ userId }) => {
  const data = await gamificationService.getMyGamification(userId!);
  return { status: 200 as const, body: { success: true as const, data } };
});

const leaderboard = defineRoute(progressContracts.leaderboard, async ({ query }) => {
  const scope = typeof query.scope === 'string' ? query.scope : undefined;
  const limit = typeof query.limit === 'string' ? parseInt(query.limit, 10) : 20;
  const data = await gamificationService.getLeaderboard(scope, isNaN(limit) ? 20 : limit);
  return { status: 200 as const, body: { success: true as const, data } };
});

export const gamificationRouter = buildContractRouter([me, leaderboard], { mountPrefix: '/api/v1/gamification' });
```

- [ ] **Step 2: analytics.module.ts**

```ts
import { progressContracts } from '@quran-review/shared';
import * as analyticsService from '../../services/analytics.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const adminAnalytics = defineRoute(progressContracts.adminAnalytics, async () => {
  const [surahMissRates, teacherLoad, weeklyActiveStudents] = await Promise.all([
    analyticsService.getSurahMissRates(),
    analyticsService.getTeacherLoadDistribution(),
    analyticsService.getWeeklyActiveStudents(),
  ]);
  return {
    status: 200 as const,
    body: { success: true as const, data: { surahMissRates, teacherLoad, weeklyActiveStudents } },
  };
});

export const analyticsRouter = buildContractRouter([adminAnalytics], { mountPrefix: '/api/v1/analytics' });
```

- [ ] **Step 3: parents.module.ts** — handlers mirror `parent.controller.ts` (manual validations preserved verbatim; redundant 401 guards dropped):

```ts
import { progressContracts } from '@quran-review/shared';
import * as parentService from '../../services/parent.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const roleOf = (userRole?: string): 'PARENT' | 'ADMIN' => (userRole === 'ADMIN' ? 'ADMIN' : 'PARENT');

const requestLink = defineRoute(progressContracts.requestParentLink, async ({ userId, req }) => {
  const { studentId, reason } = (req.body ?? {}) as { studentId?: unknown; reason?: unknown };
  if (!studentId || typeof studentId !== 'string') throw new AppError(400, 'studentId is required');
  const link = await parentService.requestLink(
    userId!,
    studentId,
    typeof reason === 'string' && reason.length > 0 ? reason : undefined
  );
  return { status: 201 as const, body: { success: true as const, data: link } };
});

const listLinks = defineRoute(progressContracts.listParentLinks, async ({ userId, userRole }) => {
  const links = await parentService.listLinks(userId!, roleOf(userRole));
  return { status: 200 as const, body: { success: true as const, data: links } };
});

const children = defineRoute(progressContracts.parentChildren, async ({ userId }) => {
  const data = await parentService.getChildren(userId!);
  return { status: 200 as const, body: { success: true as const, data } };
});

const studentSearch = defineRoute(progressContracts.parentStudentSearch, async ({ query }) => {
  const email = String(query.email || '');
  const student = await parentService.findStudentByEmail(email);
  return { status: 200 as const, body: { success: true as const, data: student } };
});

const childDashboard = defineRoute(progressContracts.childDashboard, async ({ userId, params }) => {
  const dashboard = await parentService.getChildDashboard(userId!, String(params.studentId));
  return { status: 200 as const, body: { success: true as const, data: dashboard } };
});

const decideLink = defineRoute(progressContracts.decideParentLink, async ({ userId, params, req }) => {
  const { action, note } = (req.body ?? {}) as { action?: unknown; note?: unknown };
  if (action !== 'APPROVE' && action !== 'DENY') throw new AppError(400, 'action must be APPROVE or DENY');
  const id = String(params.id);
  const updated =
    action === 'APPROVE'
      ? await parentService.approveLink(id, userId!)
      : await parentService.denyLink(id, userId!, typeof note === 'string' ? note : undefined);
  return { status: 200 as const, body: { success: true as const, data: updated } };
});

export const parentsRouter = buildContractRouter(
  [requestLink, listLinks, children, studentSearch, childDashboard, decideLink],
  { mountPrefix: '/api/v1/parents' }
);
```

- [ ] **Step 4: certificate.service.ts + certificates.module.ts addition**

```ts
// services/certificate.service.ts — moved verbatim from certificate.controller.ts
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export const listCertificates = async (callerId: string, callerRole: string | undefined, studentIdFilter?: string) => {
  let studentId: string | undefined;
  if (callerRole === 'STUDENT') {
    studentId = callerId;
  } else if (callerRole === 'ADMIN') {
    studentId = studentIdFilter;
  } else {
    throw new AppError(403, 'Only students and admins can access certificates');
  }
  return prisma.certificate.findMany({
    where: studentId ? { studentId } : {},
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { issuedAt: 'desc' },
  });
};
```

In `certificates.module.ts` add and register:

```ts
const listCertificates = defineRoute(certificatesContracts.listCertificates, async ({ userId, userRole, query }) => {
  const filter = typeof query.studentId === 'string' ? query.studentId : undefined;
  const certs = await certificateService.listCertificates(userId!, userRole, filter);
  return { status: 200 as const, body: { success: true as const, data: certs } };
});
// router array: [listCertificates, regenerateLink]
```

- [ ] **Step 5: app.ts.** Remove `gamificationRoutes`/`analyticsRoutes`/`certificateRoutes`/`parentRoutes` imports; add the three new module imports. Mounts (stacks preserved; certificates collapses to ONE mount):
```ts
app.use('/api/v1/parents', authenticate, standardLimiter, parentsRouter);
app.use('/api/v1/gamification', authenticate, standardLimiter, gamificationRouter);
app.use('/api/v1/analytics', authenticate, standardLimiter, analyticsRouter);
app.use('/api/v1/certificates', authenticate, standardLimiter, certificatesRouter);
```
- [ ] **Step 6:** Delete `routes/{gamification,certificate,analytics,parent}.routes.ts`, `controllers/{gamification,certificate,analytics,parent}.controller.ts`, `controllers/__tests__/{gamification,parent}.controller.test.ts`. Grep first: `grep -rn "gamification.controller\|parent.controller\|analytics.controller\|certificate.controller" src --include='*.ts'` — port any straggler references.
- [ ] **Step 7: Full gate.** `npx jest -c jest.integration.config.js --runInBand` + `npx jest` + `npx tsc --noEmit` (server + shared) → all green. Watch for the M6 interface-vs-looseObject trap if tsc complains about service return types.
- [ ] **Step 8: Commit** `feat(m7): gamification + certificates + analytics + parents on contract routing; legacy deleted`

### Task 4: Close out M7

- [ ] **Step 1:** `tasks/todo.md`: `[x] M7 progress & rewards (2026-07-10) — 11 endpoints swapped (gamification 2, certificates listing 1 folded into the existing module, analytics 1, parents 6); certificates dual-mount collapsed; legacy routes/controllers/mock tests deleted (<final counts>). Plan: docs/superpowers/plans/2026-07-10-m7-progress-rewards.md.` Next: `[ ] M8 halaqa realtime — socket rooms, WebRTC signaling, presence (+ halaqa HTTP routes). Next: superpowers:writing-plans for M8.`
- [ ] **Step 2:** Final gate re-run; paste counts.
- [ ] **Step 3: Commit** `docs(m7): mark M7 complete`
- [ ] **Step 4:** superpowers:finishing-a-development-branch — merge `feat/rebuild-m7` into `main` locally per M0–M6 pattern; do not push unless asked.

## Verification

- Task 1's pins green against legacy first, untouched through Task 3.
- `authz-matrix`/`envelope`/`registry-parity`/`completeness` unmodified; parents' per-role gates are matrix-covered, the pinned certificate 403 message is flow-covered.
- Certificates regression: `PATCH /:id/regenerate-link` itests (verification.itest.ts) must stay green after the dual-mount collapse — proves the module merge didn't break the existing route.

## Self-review notes

- Spec's four M7 items each have a task; the already-swapped adjacent domains (parent-links, ijazahs, milestones, roster) are explicitly out of scope.
- requestLink/decideLink manual validations stay in handlers with exact pinned messages — no `request.body` schemas added (would change 400 formats).
- `certificate.service.ts` is new but content moves verbatim from the controller — same precedent as M5's `file.service.ts`.
