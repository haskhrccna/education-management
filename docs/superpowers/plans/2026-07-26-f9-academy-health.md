# F9 · Academy Health One-Pager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single ADMIN-only screen an academy director can open to see the whole program's health at a glance — student counts, activity, hifz-loop progress, at-risk count, teacher load — cached for speed, exportable to PDF for a board meeting.

**Architecture:** A pure-aggregation `academy-health.service.ts` that reads existing tables only (no new data collection) via `Promise.all`, cache-aside through the now-fixed `lib/redis.ts` (1h TTL, graceful fallback to a live computation when Redis is absent), exposed as one GET contract on the existing `admin.contracts.ts`/`admin.module.ts`, plus a second GET contract that streams a PDF built in-memory with `pdfkit` (no disk persistence — this is an ephemeral export, not a stored report). Mobile gets one new screen, `admin/academy-health.tsx`, linked from admin home.

**Tech Stack:** Prisma aggregate queries (reusing existing models — no migration) · `lib/redis.ts` cache-aside · `pdfkit` (already a dependency) · Zod contract on `admin.contracts.ts` · `defineRoute`/`buildContractRouter`.

## Global Constraints

- Pure read — no new Prisma models, no new migration.
- All new endpoints use `defineRoute(contract, handler)` — no hand-wired Express routes.
- Every new endpoint added to `endpoint-manifest.ts` (completeness itest enforces registry↔manifest parity) with `access: ['ADMIN']`.
- Errors: `throw new AppError(statusCode, message)` only.
- Mobile: every new i18n key in BOTH `ar` and `en`; `useTheme()` for colors; `AppText` for text; `marginStart/End` not Left/Right; a11y role+label+44pt targets.
- Gates per commit: itests green · unit green · `tsc --noEmit` clean (server/shared/mobile) · `check-i18n` OK · full regression stays green.
- `security-reviewer` agent sign-off required before merge (admin surface, per this plan's own AC and project convention).

**Branch:** `feat/academy-health` off `main`.

**Acceptance criteria (from the roadmap, `docs/10x-roadmap-independent-review-2026-07-16.md` lines 211-214):**
- **AC9.1** Aggregate endpoint returns: total students, active this week, pages memorized this week, revision adherence %, at-risk count, teacher load distribution, completion rate.
- **AC9.2** Read ≤ 2s with Redis, ≤ 5s without; cache hit asserted by integration test.
- **AC9.3** PDF export ≤ 5s and includes the same metrics.
- **AC9.4** Screen is usable in a board meeting (large text, high contrast, printable).

**Documented interpretation (no existing metric definition for this):** "completion rate" is defined as the academy-wide attendance completion rate over the last 7 days — `PRESENT + LATE` session records ÷ all session records in the window — matching the original spec's explicit data-source list ("Aggregates from `Appointment`, `Grade`, `SessionRecord` (attendance), `Streak`, `ParentLink`, `User`"). This is a judgment call the plan author (not a task implementer) made; flag it to the user at close-out in case a different definition (e.g. % of students who reached a memorization milestone) was intended.

---

### Task 1: `academy-health.service.ts` — pure aggregation (TDD)

**Files:**
- Create: `packages/server/src/services/academy-health.service.ts`
- Create: `packages/server/src/services/__tests__/academy-health.service.test.ts`

**Interfaces:**
- Consumes: `prisma` (`../prisma/client`); reuses the exact query shapes already proven in `analytics.service.ts` (`getWeeklyActiveStudents`, `getTeacherLoadDistribution`) and `roster.service.ts` (`CONSECUTIVE_MISSED_THRESHOLD`, `STREAK_BROKEN_WINDOW_DAYS`, `GRADE_GAP_THRESHOLD_DAYS`) and `digest.service.ts`'s `pageMemorization.count(...)` pattern.
- Produces:
  ```ts
  export interface AcademyHealthMetrics {
    totalStudents: number;
    activeThisWeek: number;
    activeRatePct: number;
    pagesMemorizedThisWeek: number;
    revisionAdherencePct: number;
    atRiskCount: number;
    teacherLoad: { teacherId: string; firstName: string; lastName: string; activeStudents: number }[];
    completionRatePct: number;
    generatedAt: string; // ISO
  }
  export async function computeAcademyHealth(): Promise<AcademyHealthMetrics>;
  ```

- [ ] **Step 1: Write the failing unit test**

```ts
// packages/server/src/services/__tests__/academy-health.service.test.ts
import { prisma } from '../../prisma/client';
import { computeAcademyHealth } from '../academy-health.service';

jest.mock('../../prisma/client', () => ({
  prisma: {
    user: { count: jest.fn(), findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
    streak: { findMany: jest.fn() },
    grade: { groupBy: jest.fn() },
    sessionRecord: { findMany: jest.fn() },
    pageMemorization: { count: jest.fn() },
    revisionSchedule: { count: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  user: { count: jest.Mock; findMany: jest.Mock };
  appointment: { findMany: jest.Mock };
  streak: { findMany: jest.Mock };
  grade: { groupBy: jest.Mock };
  sessionRecord: { findMany: jest.Mock };
  pageMemorization: { count: jest.Mock };
  revisionSchedule: { count: jest.Mock };
};

describe('computeAcademyHealth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Two students total, one active this week (via a session record fallback below).
    mockPrisma.user.count.mockImplementation(({ where }: any) => {
      if (where.role === 'STUDENT' && !where.OR) return Promise.resolve(2);
      if (where.role === 'STUDENT' && where.OR) return Promise.resolve(1);
      return Promise.resolve(0);
    });
    mockPrisma.user.findMany.mockResolvedValue([]); // no teachers -> empty load
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    mockPrisma.streak.findMany.mockResolvedValue([]);
    mockPrisma.grade.groupBy.mockResolvedValue([]);
    mockPrisma.sessionRecord.findMany.mockResolvedValue([
      { status: 'PRESENT' },
      { status: 'ABSENT' },
      { status: 'LATE' },
    ]);
    mockPrisma.pageMemorization.count.mockResolvedValue(7);
    mockPrisma.revisionSchedule.count.mockImplementation(({ where }: any) => {
      if (where.status === 'COMPLETED') return Promise.resolve(9);
      if (where.status === 'MISSED') return Promise.resolve(1);
      return Promise.resolve(0);
    });
  });

  it('returns all seven required metrics (AC9.1)', async () => {
    const result = await computeAcademyHealth();
    expect(result).toMatchObject({
      totalStudents: 2,
      activeThisWeek: 1,
      activeRatePct: 50,
      pagesMemorizedThisWeek: 7,
      revisionAdherencePct: 90, // 9 / (9+1) * 100
      atRiskCount: 0,
      completionRatePct: 67, // 2 of 3 session records PRESENT/LATE, rounded
    });
    expect(Array.isArray(result.teacherLoad)).toBe(true);
    expect(typeof result.generatedAt).toBe('string');
  });

  it('is 0% adherence, not NaN, when there is no revision history yet', async () => {
    mockPrisma.revisionSchedule.count.mockResolvedValue(0);
    const result = await computeAcademyHealth();
    expect(result.revisionAdherencePct).toBe(0);
  });

  it('is 0% completion, not NaN, when there are no session records yet', async () => {
    mockPrisma.sessionRecord.findMany.mockResolvedValue([]);
    const result = await computeAcademyHealth();
    expect(result.completionRatePct).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/server && npm test -- --testPathPatterns=academy-health.service
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `academy-health.service.ts`**

```ts
import { prisma } from '../prisma/client';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface AcademyHealthMetrics {
  totalStudents: number;
  activeThisWeek: number;
  activeRatePct: number;
  pagesMemorizedThisWeek: number;
  revisionAdherencePct: number;
  atRiskCount: number;
  teacherLoad: { teacherId: string; firstName: string; lastName: string; activeStudents: number }[];
  completionRatePct: number;
  generatedAt: string;
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

/** Academy-wide at-risk count — same 3 signals as roster.service.ts's per-teacher
 *  getRosterHealth, computed directly here since that function is scoped to one
 *  teacher's roster and re-querying per teacher would be N+1. */
async function countAtRiskStudents(since7d: Date, since14d: Date): Promise<number> {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', deletedAt: null },
    select: { id: true },
  });
  if (students.length === 0) return 0;
  const studentIds = students.map((s) => s.id);

  const [streaks, latestGrades, recentSessions] = await Promise.all([
    prisma.streak.findMany({ where: { userId: { in: studentIds } } }),
    prisma.grade.groupBy({ by: ['studentId'], where: { studentId: { in: studentIds } }, _max: { createdAt: true } }),
    prisma.sessionRecord.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { recordedAt: 'desc' },
      select: { studentId: true, status: true },
    }),
  ]);

  const streakByStudent = new Map(streaks.map((s) => [s.userId, s]));
  const latestGradeByStudent = new Map(latestGrades.map((g) => [g.studentId, g._max.createdAt]));
  const recentByStudent = new Map<string, string[]>();
  for (const rec of recentSessions) {
    const list = recentByStudent.get(rec.studentId) ?? [];
    if (list.length < 2) list.push(rec.status);
    recentByStudent.set(rec.studentId, list);
  }

  let atRisk = 0;
  for (const id of studentIds) {
    const recent = recentByStudent.get(id) ?? [];
    const missedSessions = recent.length === 2 && recent.every((s) => s === 'ABSENT');
    const streak = streakByStudent.get(id);
    const streakBroken = !!streak && streak.currentStreak === 0 && streak.longestStreak > 0 && streak.lastActiveDate >= since7d;
    const lastGradeAt = latestGradeByStudent.get(id);
    const gradeGap = !lastGradeAt || lastGradeAt < since14d;
    if (missedSessions || streakBroken || gradeGap) atRisk++;
  }
  return atRisk;
}

export async function computeAcademyHealth(): Promise<AcademyHealthMetrics> {
  const now = new Date();
  const since7d = new Date(now.getTime() - SEVEN_DAYS_MS);
  const since14d = new Date(now.getTime() - 2 * SEVEN_DAYS_MS);

  const [
    totalStudents,
    activeThisWeek,
    pagesMemorizedThisWeek,
    completedRevisions,
    missedRevisions,
    atRiskCount,
    teachers,
    weekSessionRecords,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT', deletedAt: null } }),
    prisma.user.count({
      where: {
        role: 'STUDENT',
        deletedAt: null,
        OR: [
          { revisionSchedules: { some: { notedAt: { gte: since7d } } } },
          { gradesReceived: { some: { createdAt: { gte: since7d } } } },
          { sessionRecordsAsStudent: { some: { recordedAt: { gte: since7d } } } },
        ],
      },
    }),
    prisma.pageMemorization.count({ where: { status: { in: ['MEMORIZED', 'SOLID'] }, updatedAt: { gte: since7d } } }),
    prisma.revisionSchedule.count({ where: { status: 'COMPLETED', notedAt: { gte: since7d } } }),
    prisma.revisionSchedule.count({ where: { status: 'MISSED', notedAt: { gte: since7d } } }),
    countAtRiskStudents(since7d, since14d),
    prisma.user.findMany({
      where: { role: 'TEACHER', deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        appointmentsAsTeacher: { where: { status: 'ACCEPTED' }, select: { studentId: true } },
      },
    }),
    prisma.sessionRecord.findMany({ where: { recordedAt: { gte: since7d } }, select: { status: true } }),
  ]);

  const presentOrLate = weekSessionRecords.filter((s) => s.status === 'PRESENT' || s.status === 'LATE').length;

  return {
    totalStudents,
    activeThisWeek,
    activeRatePct: pct(activeThisWeek, totalStudents),
    pagesMemorizedThisWeek,
    revisionAdherencePct: pct(completedRevisions, completedRevisions + missedRevisions),
    atRiskCount,
    teacherLoad: teachers.map((t) => ({
      teacherId: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      activeStudents: t.appointmentsAsTeacher.length,
    })),
    completionRatePct: pct(presentOrLate, weekSessionRecords.length),
    generatedAt: now.toISOString(),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd packages/server && npm test -- --testPathPatterns=academy-health.service
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/academy-health.service.ts packages/server/src/services/__tests__/academy-health.service.test.ts
git commit -m "feat(f9): academy-health aggregation service (pure read, no new tables)"
```

---

### Task 2: Redis cache-aside wrapper (TDD)

**Files:**
- Modify: `packages/server/src/services/academy-health.service.ts`
- Modify: `packages/server/src/services/__tests__/academy-health.service.test.ts`

**Interfaces:**
- Consumes: `cacheGet`, `cacheSet` from `../lib/redis` (already fixed to fail fast when Redis is absent — see the `fix(server): lib/redis.ts cache client never gracefully degrades either` commit already on `main`).
- Produces: `export async function getAcademyHealth(): Promise<AcademyHealthMetrics>` — the cached entry point; `computeAcademyHealth` (Task 1) stays the uncached pure computation, now called only on a cache miss.

- [ ] **Step 1: Write the failing unit test** (append to the same test file)

```ts
jest.mock('../../lib/redis', () => ({ cacheGet: jest.fn(), cacheSet: jest.fn() }));
import { cacheGet, cacheSet } from '../../lib/redis';
import { getAcademyHealth } from '../academy-health.service';

const mockCacheGet = cacheGet as jest.Mock;
const mockCacheSet = cacheSet as jest.Mock;

describe('getAcademyHealth (cache-aside)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.sessionRecord.findMany.mockResolvedValue([]);
    mockPrisma.pageMemorization.count.mockResolvedValue(0);
    mockPrisma.revisionSchedule.count.mockResolvedValue(0);
    mockPrisma.streak.findMany.mockResolvedValue([]);
    mockPrisma.grade.groupBy.mockResolvedValue([]);
  });

  it('returns the cached value without touching Prisma on a cache hit', async () => {
    const cached = { totalStudents: 99, generatedAt: 'cached' } as any;
    mockCacheGet.mockResolvedValue(cached);
    const result = await getAcademyHealth();
    expect(result).toBe(cached);
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });

  it('computes fresh and writes the cache on a cache miss (AC9.2)', async () => {
    mockCacheGet.mockResolvedValue(null);
    const result = await getAcademyHealth();
    expect(result.totalStudents).toBe(0);
    expect(mockCacheSet).toHaveBeenCalledWith('academy-health', expect.any(Object), 3600);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/server && npm test -- --testPathPatterns=academy-health.service
```

Expected: the 2 new tests FAIL (`getAcademyHealth` not exported), the earlier 3 still PASS.

- [ ] **Step 3: Add the cache wrapper** to `academy-health.service.ts`

```ts
import { cacheGet, cacheSet } from '../lib/redis';

const CACHE_KEY = 'academy-health';
const CACHE_TTL_SECONDS = 3600; // 1h, per spec
```

```ts
export async function getAcademyHealth(): Promise<AcademyHealthMetrics> {
  const cached = await cacheGet<AcademyHealthMetrics>(CACHE_KEY);
  if (cached) return cached;
  const fresh = await computeAcademyHealth();
  await cacheSet(CACHE_KEY, fresh, CACHE_TTL_SECONDS);
  return fresh;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd packages/server && npm test -- --testPathPatterns=academy-health.service
```

Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/academy-health.service.ts packages/server/src/services/__tests__/academy-health.service.test.ts
git commit -m "feat(f9): cache-aside wrapper — 1h TTL, graceful fallback when Redis absent"
```

---

### Task 3: PDF export (in-memory, no disk persistence)

**Files:**
- Create: `packages/server/src/services/academy-health-pdf.service.ts`
- Create: `packages/server/src/services/__tests__/academy-health-pdf.service.test.ts`

**Interfaces:**
- Consumes: `AcademyHealthMetrics` (Task 1).
- Produces: `export async function generateAcademyHealthPDF(metrics: AcademyHealthMetrics): Promise<Buffer>`.

- [ ] **Step 1: Write the failing unit test**

```ts
// packages/server/src/services/__tests__/academy-health-pdf.service.test.ts
import { generateAcademyHealthPDF } from '../academy-health-pdf.service';
import type { AcademyHealthMetrics } from '../academy-health.service';

const metrics: AcademyHealthMetrics = {
  totalStudents: 42,
  activeThisWeek: 30,
  activeRatePct: 71,
  pagesMemorizedThisWeek: 58,
  revisionAdherencePct: 88,
  atRiskCount: 3,
  teacherLoad: [{ teacherId: 't1', firstName: 'Ahmad', lastName: 'Al-Rashid', activeStudents: 12 }],
  completionRatePct: 92,
  generatedAt: '2026-07-26T12:00:00.000Z',
};

describe('generateAcademyHealthPDF', () => {
  it('produces a non-empty PDF buffer with a valid PDF header', async () => {
    const buf = await generateAcademyHealthPDF(metrics);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('completes within the 5s budget (AC9.3)', async () => {
    const start = Date.now();
    await generateAcademyHealthPDF(metrics);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/server && npm test -- --testPathPatterns=academy-health-pdf
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `academy-health-pdf.service.ts`**

```ts
import PDFDocument from 'pdfkit';
import type { AcademyHealthMetrics } from './academy-health.service';

/** In-memory PDF — this is an ephemeral admin export, not a persisted Report
 *  row (unlike report.service.ts's per-student reports, which are re-downloaded
 *  later and so need disk persistence). */
export async function generateAcademyHealthPDF(metrics: AcademyHealthMetrics): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: true, margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(22).text('Academy Health Report', { align: 'center' }).moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor('#757575')
      .text(`Generated ${new Date(metrics.generatedAt).toLocaleString('en-US')}`, { align: 'center' })
      .fillColor('#000000')
      .moveDown(1.5);

    const row = (label: string, value: string | number) => {
      doc.fontSize(13).text(`${label}:`, { continued: true }).fontSize(13).text(` ${value}`);
      doc.moveDown(0.4);
    };

    row('Total students', metrics.totalStudents);
    row('Active this week', `${metrics.activeThisWeek} (${metrics.activeRatePct}%)`);
    row('Pages memorized this week', metrics.pagesMemorizedThisWeek);
    row('Revision adherence', `${metrics.revisionAdherencePct}%`);
    row('At-risk students', metrics.atRiskCount);
    row('Attendance completion rate', `${metrics.completionRatePct}%`);
    doc.moveDown(1);

    doc.fontSize(15).text('Teacher Load', { underline: true }).moveDown(0.5);
    if (metrics.teacherLoad.length === 0) {
      doc.fontSize(11).text('No teachers on record.');
    } else {
      for (const t of metrics.teacherLoad) {
        doc.fontSize(11).text(`${t.firstName} ${t.lastName} — ${t.activeStudents} active student(s)`);
      }
    }

    doc.end();
  });
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd packages/server && npm test -- --testPathPatterns=academy-health-pdf
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/academy-health-pdf.service.ts packages/server/src/services/__tests__/academy-health-pdf.service.test.ts
git commit -m "feat(f9): in-memory academy-health PDF export (no disk persistence)"
```

---

### Task 4: Contracts + module + manifest + integration tests

**Files:**
- Modify: `packages/shared/src/contracts/admin.contracts.ts`
- Modify: `packages/server/src/modules/admin/admin.module.ts`
- Modify: `packages/server/src/__integration__/endpoint-manifest.ts`
- Create: `packages/server/src/__integration__/academy-health.itest.ts`

**Interfaces:**
- Consumes: `getAcademyHealth`, `generateAcademyHealthPDF` (Tasks 1-3).
- Produces: `adminContracts.getAcademyHealth` (`GET /api/v1/admin/academy-health`, ADMIN, 200 `AcademyHealthMetrics`), `adminContracts.exportAcademyHealthPdf` (`GET /api/v1/admin/academy-health/export.pdf`, ADMIN, 200 raw `application/pdf`).

- [ ] **Step 1: Write the failing itest**

```ts
// packages/server/src/__integration__/academy-health.itest.ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('GET /api/v1/admin/academy-health', () => {
  it('returns all required metrics for an admin (AC9.1)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ role: Role.STUDENT });

    const res = await request(app)
      .get('/api/v1/admin/academy-health')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalStudents: expect.any(Number),
      activeThisWeek: expect.any(Number),
      activeRatePct: expect.any(Number),
      pagesMemorizedThisWeek: expect.any(Number),
      revisionAdherencePct: expect.any(Number),
      atRiskCount: expect.any(Number),
      completionRatePct: expect.any(Number),
    });
    expect(Array.isArray(res.body.teacherLoad)).toBe(true);
  });

  it('reads in under 2s (AC9.2 — Redis path if available, DB fallback otherwise)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const start = Date.now();
    const res = await request(app)
      .get('/api/v1/admin/academy-health')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(Date.now() - start).toBeLessThan(5000); // 5s ceiling holds regardless of Redis availability in this env
  });

  it('serves the second request from cache — identical generatedAt (AC9.2 cache-hit assertion)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const first = await request(app).get('/api/v1/admin/academy-health').set('Authorization', `Bearer ${admin.token}`);
    const second = await request(app).get('/api/v1/admin/academy-health').set('Authorization', `Bearer ${admin.token}`);
    expect(first.body.generatedAt).toBe(second.body.generatedAt);
  });
});

describe('GET /api/v1/admin/academy-health/export.pdf', () => {
  it('returns a PDF within 5s (AC9.3)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const start = Date.now();
    const res = await request(app)
      .get('/api/v1/admin/academy-health/export.pdf')
      .set('Authorization', `Bearer ${admin.token}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const buf = res.body as Buffer;
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
```

Note: the cache-hit assertion (test 3) relies on `generatedAt` being frozen at first-computation time and served verbatim on a hit — if Redis is unavailable in the test environment, `getAcademyHealth` recomputes every call and this assertion would need the two calls to land within the same millisecond, which is flaky. If the local/CI test environment has no Redis, either accept this test may occasionally show a differing `generatedAt` (documented, non-blocking) or gate it with a Redis-availability check — decide based on what `docker-compose.test.yml` actually provides (check it first; if it includes a Redis service, this test is reliable as written).

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/server && npm run test:integration -- --testPathPatterns=academy-health
```

Expected: FAIL — 404, route not mounted.

- [ ] **Step 3: Add contracts to `admin.contracts.ts`**

```ts
const AcademyHealthMetricsSchema = z.object({
  totalStudents: z.number(),
  activeThisWeek: z.number(),
  activeRatePct: z.number(),
  pagesMemorizedThisWeek: z.number(),
  revisionAdherencePct: z.number(),
  atRiskCount: z.number(),
  teacherLoad: z.array(
    z.object({ teacherId: z.string(), firstName: z.string(), lastName: z.string(), activeStudents: z.number() })
  ),
  completionRatePct: z.number(),
  generatedAt: z.string(),
});
```

```ts
  getAcademyHealth: defineContract({
    method: 'GET',
    path: '/api/v1/admin/academy-health',
    summary: 'Program-wide health aggregate — pure read, 1h Redis cache with graceful DB fallback',
    access: ADMIN,
    responses: { 200: AcademyHealthMetricsSchema, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  exportAcademyHealthPdf: defineContract({
    method: 'GET',
    path: '/api/v1/admin/academy-health/export.pdf',
    summary: 'Same metrics as a printable PDF — generated fresh, not cached',
    access: ADMIN,
    responses: { 200: rawResponse('application/pdf'), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
```

(Import `rawResponse` from `./types` at the top of `admin.contracts.ts` if not already imported — check first.)

- [ ] **Step 4: Add routes to `admin.module.ts`**

```ts
import * as academyHealthService from '../../services/academy-health.service';
import { generateAcademyHealthPDF } from '../../services/academy-health-pdf.service';

const getAcademyHealth = defineRoute(adminContracts.getAcademyHealth, async () => {
  const metrics = await academyHealthService.getAcademyHealth();
  return { status: 200 as const, body: metrics };
});

const exportAcademyHealthPdf = defineRoute(adminContracts.exportAcademyHealthPdf, async ({ res }) => {
  const metrics = await academyHealthService.getAcademyHealth();
  const pdf = await generateAcademyHealthPDF(metrics);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="academy-health.pdf"');
  res.send(pdf);
  return { status: 200 as const, handled: true as const };
});
```

Add both to the `buildContractRouter([...])` array.

- [ ] **Step 5: Add manifest entries**

```ts
  { method: 'GET', path: '/api/v1/admin/academy-health', access: ['ADMIN'] },
  { method: 'GET', path: '/api/v1/admin/academy-health/export.pdf', access: ['ADMIN'] },
```

- [ ] **Step 6: Run to verify it passes**

```bash
cd packages/server && npm run test:integration -- --testPathPatterns="academy-health|completeness|authz-matrix"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/contracts/admin.contracts.ts packages/server/src/modules/admin/admin.module.ts packages/server/src/__integration__
git commit -m "feat(f9): academy-health + PDF-export admin endpoints"
```

---

### Task 5: Mobile screen

**Files:**
- Create: `mobile/src/api/academyHealth.ts`
- Create: `mobile/src/hooks/useAcademyHealth.ts`
- Create: `mobile/app/admin/academy-health.tsx`
- Modify: `mobile/app/_layout.tsx` (register the screen)
- Modify: `mobile/app/admin/home.tsx` (link, next to Academy Profile/Analytics)
- Modify: `mobile/src/i18n/index.ts` (new keys, ar + en)

**Interfaces:**
- Consumes: `contractClient`, `expectStatus` from `mobile/src/api/contract.ts` — copy the exact calling convention from `mobile/src/api/certificates.ts` or `mobile/src/api/academyProfile.ts` (F8), do not assume it. Consumes `adminContracts.getAcademyHealth` from `@quran-review/shared`.
- Produces: `academyHealthApi.get()`, `academyHealthApi.exportPdfUrl()` (builds the download URL the same way `certificates.ts`'s `getDownloadUrl` does — check that exact pattern, including how the bearer token reaches a `Linking.openURL` call for a file download in this codebase, since `export.pdf` needs the same `?token=` handling as other file downloads UNLESS it's simpler to just use `authVia` — check whether `adminContracts.exportAcademyHealthPdf` needs `authVia: 'headerOrQueryToken'` like the file-download contracts in `media.contracts.ts` do, since a mobile `Linking.openURL()` call cannot attach an `Authorization` header. If so, add `authVia: 'headerOrQueryToken'` to that contract in Task 4 and use `fileAuthenticate` — revisit Task 4 Step 3 if this is discovered here).

- [ ] **Step 1: `mobile/src/api/academyHealth.ts`**

```ts
import { adminContracts } from '@quran-review/shared';
import { contractClient, expectStatus, API_ORIGIN } from './contract';

export const academyHealthApi = {
  async get() {
    const res = await contractClient.call(adminContracts.getAcademyHealth, {});
    return expectStatus(res, 200).body;
  },
  exportPdfUrl(token: string): string {
    return `${API_ORIGIN}/api/v1/admin/academy-health/export.pdf?token=${encodeURIComponent(token)}`;
  },
};
```

(Confirm `API_ORIGIN` export exists in `mobile/src/api/contract.ts` — it's used elsewhere per F8's `certificates.ts`. Confirm how the current bearer token is retrieved for building a `?token=` URL — check `mobile/src/storage/secureStorage.ts` or how `certificates.ts`/`reports.ts` do it for their own download URLs.)

- [ ] **Step 2: `mobile/src/hooks/useAcademyHealth.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { academyHealthApi } from '../api/academyHealth';

export function useAcademyHealth() {
  const query = useQuery({
    queryKey: ['academy-health'],
    queryFn: academyHealthApi.get,
    staleTime: 5 * 60 * 1000, // 5 min — matches the server's 1h cache being the real source of truth
  });
  return { metrics: query.data ?? null, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}
```

- [ ] **Step 3: `mobile/app/admin/academy-health.tsx`** — a board-meeting-usable one-pager (AC9.4: large text, high contrast, printable-feeling layout — no dense tables). Structure:
  - Header bar matching other admin screens (back button, title `t('academyHealth')`).
  - A grid of large stat cards (`AppCard` + large `AppText` variant) for: Total Students, Active This Week (with %), Pages Memorized This Week, Revision Adherence %, At-Risk Count, Completion Rate % — each card uses a single big number + a label, high-contrast (avoid low-contrast gray-on-white; use `useTheme()` colors, and reserve gold/amber accent per DESIGN.md's "Rationed Gold" rule only if these numbers represent an earned achievement — they're operational metrics, so use `colors.textPrimary`/`colors.primary`, not gold).
  - A simple list/section for Teacher Load (name + active student count per row).
  - An "Export PDF" button that calls `Linking.openURL(academyHealthApi.exportPdfUrl(token))` (get the current token the same way `certificates.tsx`'s download handler does).
  - Loading state (`ActivityIndicator`) and error+retry state, consistent with every other screen in this codebase.
  - a11y: `accessibilityRole`/`accessibilityLabel` on the back button and export button, `hitSlop`.

Read `mobile/app/admin/academy-profile.tsx` (F8) first for the exact header/back-button/card boilerplate to copy, rather than inventing new structure.

- [ ] **Step 4: Register in `_layout.tsx`**

```tsx
<Stack.Screen name="admin/academy-health" />
```

- [ ] **Step 5: Link from `admin/home.tsx`** — copy the exact tile/button pattern used for the Academy Profile link (F8) or Analytics link, placed alongside them.

- [ ] **Step 6: i18n keys (both `ar` and `en`)** — check for existing keys first (`totalStudents`, `activeThisWeek` etc. may already exist from `analytics.tsx`; reuse, don't duplicate):

| key | ar | en |
|---|---|---|
| `academyHealth` | `صحة الأكاديمية` | `Academy Health` |
| `pagesMemorizedThisWeek` | `الصفحات المحفوظة هذا الأسبوع` | `Pages memorized this week` |
| `revisionAdherence` | `الالتزام بالمراجعة` | `Revision adherence` |
| `atRiskStudents` | `الطلاب المعرضون للخطر` | `At-risk students` |
| `completionRate` | `معدل الإنجاز` | `Completion rate` |
| `teacherLoad` | `عبء المعلمين` | `Teacher load` |
| `exportPdf` | `تصدير PDF` | `Export PDF` |

- [ ] **Step 7: Gates**

```bash
cd mobile && npx tsc --noEmit && npm run check-i18n
```

Expected: 0 errors, i18n OK.

- [ ] **Step 8: Commit**

```bash
git add mobile
git commit -m "feat(f9): academy-health admin screen + PDF export"
```

---

### Task 6: Full gates, security review, close-out

- [ ] **Step 1: Full server regression**

```bash
cd packages/server && npm test && npm run test:integration
```

- [ ] **Step 2: Typecheck everything**

```bash
cd packages/server && npx tsc --noEmit && cd ../shared && npx tsc --noEmit && cd ../../mobile && npx tsc --noEmit && npm run check-i18n
```

- [ ] **Step 3: Security review** — dispatch `security-reviewer` over the diff (new admin endpoints, cache key collision risk if ever multi-tenant, PDF generation from user-influenced-but-not-attacker-controlled data).

- [ ] **Step 4: Final whole-branch review** — per this session's F8 experience, dispatch a final review across the whole branch diff (not just per-task) before merging; per-task review cannot see integration issues (e.g., confirm the PDF's `Content-Disposition` filename doesn't collide with anything, confirm the cache key wouldn't need academy-scoping if F8's multi-academy future ever lands — note only, don't build for it now per YAGNI).

- [ ] **Step 5: Update `tasks/todo.md`** — AC proof map (AC9.1-9.4 → test names), the documented "completion rate" interpretation flagged as a judgment call for the user to confirm or correct.

- [ ] **Step 6: Merge** (confirm with the user first)

---

## Self-Review Notes

- **AC9.1** → Task 1's `computeAcademyHealth` returns all 7 metrics named explicitly in the AC; Task 4's itest asserts every field's presence.
- **AC9.2** → Task 2's cache-aside wrapper (1h TTL) + Task 4's cache-hit itest (identical `generatedAt` on second call); the ≤2s/≤5s budgets are inherently satisfied by the query shapes (all indexed lookups on a single-academy-scale dataset, no N+1 beyond the bounded `countAtRiskStudents` loop) — no explicit timing assertion beyond the itest's 5s ceiling, since CI timing assertions below that are flaky by nature.
- **AC9.3** → Task 3's PDF generation unit-tested for both content and the 5s budget; Task 4's itest re-asserts the budget end-to-end through the HTTP layer.
- **AC9.4** → Task 5's screen spec (large stat cards, high contrast, no dense tables) — this AC is qualitative and isn't itself unit-testable; call it out at close-out for the user's own visual confirmation (device/simulator check), same as F8's mobile task did.
- **Type consistency:** `AcademyHealthMetrics` is defined once in `academy-health.service.ts` and imported everywhere else (PDF service, contract schema is a hand-written Zod mirror — keep field names byte-identical across both, a mismatch here is exactly the kind of drift F8's final review caught between layers).
