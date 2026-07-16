# H1 Hifz Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (session precedent: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Note: `2026-07-16-10x-roadmap-implementation.md` in this directory is an untracked high-level sketch of the full F1–F11 roadmap. This plan is the executable H1 slice; where the two diverge on F4a (it edits the init migration in place — which breaks Prisma checksums on applied DBs), **this plan wins** (backdated repair migration + `migrate resolve`).

**Goal:** Ship Horizon H1 of `docs/superpowers/specs/2026-07-16-10x-roadmap.md` — F4 deploy unblockers, F1 page-level memorization on the image Mushaf, F2 recite-from-the-page, F3 self-running Sabaq/Sabqi/Manzil revision queue — with all AC1.1–AC4.5 satisfied.

**Architecture:** Same contract-first pattern as every prior milestone: additive Prisma migrations → shared Zod contracts (registry 106 → 110) → `defineRoute` handlers delegating to services → endpoint-manifest entries (authz-matrix picks them up automatically) → mobile api client + hook + screen (ar+en i18n). F3's scheduler is a pure function (`buildRevisionQueue`) so the pedagogy is unit-testable with zero I/O; Redis is cache-aside, never required.

**Tech Stack:** Express 5 · Prisma 6 + PostgreSQL · Zod v4 contracts (`@quran-review/shared`) · Jest 30 (unit + integration on Postgres 5433, `server-db-test-1` container) · Expo SDK 54 / expo-router / expo-av / expo-image · TanStack Query.

## Global Constraints

- Branch: `feat/h1-hifz-engine` off `main`. One commit per task minimum.
- Migrations via `prisma migrate dev --name <x>` — **never** `db push` (AC4.2 removes the last excuse).
- Error bodies stay pinned: role 403 `{success:false,error:'Insufficient permissions'}`, missing auth 401 `{success:false,error:'Authentication required'}`.
- Every new endpoint: contract in `packages/shared/src/contracts/` + entry in `src/__integration__/endpoint-manifest.ts` (authz-matrix + completeness iterate it) + registry count bump in `src/__tests__/contract-schemas.test.ts` (106 → 108 after Task 3, → 110 after Task 8).
- Zod v4: `z.looseObject` for row shapes; style precedent `learning.contracts.ts` / `mushaf.contracts.ts`.
- Mobile gates: `cd mobile && npx tsc --noEmit` clean, `node scripts/check-i18n.js` clean (every string in **both** `ar` and `en`), `useTheme()` colors, `accessibilityRole`/`accessibilityLabel`/`hitSlop` on touchables.
- Integration runs: `cd packages/server && npx jest -c jest.integration.config.js --runInBand [--testPathPatterns=<x>]`. Unit: `npx jest`.
- Never compare roles lowercase server-side. Quran text is never hand-typed (F2 touches audio + page numbers only).

## Verified codebase facts (read before coding)

- `prisma/migrations/` has 26 entries; **none creates `"surahs"`** but `20260627042638_add_ayahs_and_mushaf_pages` runs `ALTER TABLE "surahs"` → fresh `migrate deploy`/`reset` dies there. Local dev DB was built with `db push` (workaround, 2026-07-13).
- `.github/workflows/ci.yml` (line ~49) already runs `prisma migrate deploy` against fresh Postgres — but the workflow lives under `education_management/.github/`, and the **git root is the parent `opencode/` repo**, so GitHub Actions never executes it. Task 1 fixes the ledger + strengthens the workflow; making Actions live (copying to repo root) is a user decision surfaced at close-out.
- Contract registry: exactly **106** (`contract-schemas.test.ts:12`).
- `Recording` model (schema line 251) has no page/surah fields. Upload handler: `src/modules/recordings/recordings.module.ts` (multer → `recordingService.uploadRecording(userId, fileName, size, type, tempPath)` at `recording.service.ts:21`).
- `mushafContracts` = `surahAyahs`, `page`, `logMemorization` (envelope style `{success:true,data}`); module at `src/modules/mushaf/mushaf.module.ts`.
- Reader `mobile/app/student/mushaf.tsx`: paged FlatList over `PAGES` 1..604, `IMAGE_ORIGIN`/`pageUri(page)` helpers at top, `currentPage` state, toolbar at bottom, zoom modal.
- Teacher review screen `mobile/app/teacher/recordings.tsx`: `const { recordings, loading, error, refresh, review } = useRecordings()` (line 65), `openReview(rec, approved)` (line 185) opens a notes modal, submit at line 194.
- `weakAyahsContracts.flag`: POST `/api/v1/weak-ayahs` body `{studentId, ayahId}`, TEACHER-only. Mobile client for it may not exist — Task 7 greps and creates if missing.
- `RevisionSchedule` (line 378): `{userId, surahId, ayahId?, scheduledFor, status PENDING|…, interval, easeFactor, repetitions}` — teacher-created rows are the F3 overrides.
- Mushaf static mount in `app.ts` after the health router: `express.static(path.join(__dirname,'..','mushaf-pages'))` — Task 2 makes the dir env-configurable.
- Test factory `src/__integration__/factory.ts` `createUser({role, status?, email?, password?, assignedTeacherId?})`; `truncateAll`/`disconnect` from `./db`.
- Seeded dev logins: `ali@quran-review.com`/`Student1234!` (assigned to Ahmad), `teacher@quran-review.com`/`Teacher1234!`.

## File structure (created ▸ / modified ▸▸)

```
packages/server/
  prisma/migrations/20260627042630_add_surahs_table/migration.sql        ▸ Task 1
  prisma/migrations/<ts>_add_page_memorization/migration.sql             ▸ Task 3 (generated)
  prisma/migrations/<ts>_add_recording_page/migration.sql                ▸ Task 6 (generated)
  scripts/verify-migrations.sh                                           ▸ Task 1
  src/lib/mushaf-assets.ts                                               ▸ Task 2
  src/services/page-memorization.service.ts                              ▸ Task 3
  src/services/revision-queue.service.ts                                 ▸ Task 8
  src/services/__tests__/page-memorization.service.test.ts               ▸ Task 3
  src/services/__tests__/revision-queue.service.test.ts                  ▸ Task 8
  src/__integration__/hifz-engine.itest.ts                               ▸ Task 3 (+6, +8 extend)
  src/__integration__/setup-mushaf-assets.ts                             ▸ Task 2
  src/modules/mushaf/mushaf.module.ts                                    ▸▸ Tasks 3, 8
  src/modules/recordings/recordings.module.ts                            ▸▸ Task 6
  src/services/recording.service.ts                                      ▸▸ Task 6
  src/app.ts (static dir env) · src/server.ts (fail-loud check)          ▸▸ Task 2
  src/config/index.ts (mushafPagesDir, allowMissingMushafPages)          ▸▸ Task 2
  src/__integration__/endpoint-manifest.ts                               ▸▸ Tasks 3, 8
  src/__tests__/contract-schemas.test.ts (count bumps)                   ▸▸ Tasks 3, 8
  src/__tests__/mushaf-assets.test.ts                                    ▸ Task 2
  prisma/schema.prisma                                                   ▸▸ Tasks 3, 6
packages/shared/src/
  contracts/mushaf.contracts.ts (myPages, setPageStatus, revisionQueue, pageReviewed) ▸▸ Tasks 3, 8
  contracts/media.contracts.ts (RecordingRow.page)                       ▸▸ Task 6
  validators/mushaf.ts (PageStatusEnum, setPageStatusSchema)             ▸▸ Task 3
  validators/common.ts (CreateRecordingSchema.page)                      ▸▸ Task 6
mobile/
  src/lib/mushafAssets.ts (shared IMAGE_ORIGIN/pageUri)                  ▸ Task 4
  src/api/mushafPages.ts + src/hooks/useMushafPages.ts                   ▸ Task 4
  src/api/revisionQueue.ts + src/hooks/useRevisionQueue.ts               ▸ Task 9
  src/api/weakAyahs.ts (create only if missing)                          ▸ Task 7
  app/student/mushaf.tsx (chips, mic, ?page= deep link)                  ▸▸ Tasks 4, 7, 9
  app/student/home.tsx (pages progress + revision card)                  ▸▸ Tasks 5, 9
  app/teacher/student-detail.tsx (pages + adherence)                     ▸▸ Tasks 5, 9
  app/parent/home.tsx (child pages count + adherence)                    ▸▸ Tasks 5, 9
  app/teacher/recordings.tsx (page image + weak-ayah flag)               ▸▸ Task 7
  app/student/recordings.tsx (page tag row → deep link)                  ▸▸ Task 7
  src/api/recordings.ts (page fields)                                    ▸▸ Task 7
  src/i18n/index.ts (all new keys, ar+en)                                ▸▸ Tasks 4,5,7,9
.github/workflows/ci.yml (drift check)                                  ▸▸ Task 1
docs/DEPLOYMENT.md (mushaf assets + migrations section)                  ▸▸ Task 2
tasks/todo.md                                                            ▸▸ Task 10
```

---

### Task 0: Branch + plan doc

- [ ] **Step 1:** `cd /Users/haskhr/Documents/opencode && git checkout -b feat/h1-hifz-engine` (repo root is the parent `opencode/`; all paths below are relative to `education_management/`).
- [ ] **Step 2:** Commit this plan file: `git add education_management/docs/superpowers/plans/2026-07-16-h1-hifz-engine.md && git commit -m "docs(h1): hifz engine implementation plan"`.

---

### Task 1: F4a — migration baseline repair (AC4.1, AC4.2)

**Files:** Create `packages/server/prisma/migrations/20260627042630_add_surahs_table/migration.sql`, `packages/server/scripts/verify-migrations.sh`; Modify `.github/workflows/ci.yml`, `CLAUDE.md`, `tasks/todo.md` server-notes line.
**Interfaces:** Produces a ledger that builds the full schema from empty; `verify-migrations.sh` is the proof harness Tasks 3/6 re-run after their migrations.

- [ ] **Step 1: Write the repair migration.** Timestamp `20260627042630` sorts immediately **before** the failing `20260627042638_add_ayahs_and_mushaf_pages`, so a fresh DB creates `surahs` first; on already-applied DBs it's a no-op (`IF NOT EXISTS` everywhere). Columns = the Surah model **minus** `pages` (added by the 042638 migration):

```sql
-- Repair: the surahs table was originally created via `prisma db push` and
-- never captured in a migration, so every later migration that references
-- "surahs" failed on a fresh database. Backdated to sort before
-- 20260627042638_add_ayahs_and_mushaf_pages (the first dependent). Idempotent.
CREATE TABLE IF NOT EXISTS "surahs" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "ayahCount" INTEGER NOT NULL,
    "juz" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "surahs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "surahs_number_key" ON "surahs"("number");
```

- [ ] **Step 2: Write the verification harness** `packages/server/scripts/verify-migrations.sh` (`chmod +x`):

```bash
#!/usr/bin/env bash
# Proves the migration ledger builds the FULL schema from an empty database
# and matches schema.prisma exactly. Uses a throwaway postgres container.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${VERIFY_PG_PORT:-5440}"
NAME=migrate-verify-$$
docker run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=verify -p "$PORT":5432 \
  --health-cmd 'pg_isready -U postgres' --health-interval 1s postgres:17-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$NAME")" = healthy ] && break
  [ "$i" = 60 ] && { echo "postgres never became healthy"; exit 1; }
  sleep 1 2>/dev/null || python3 -c 'import time; time.sleep(1)'
done
export DATABASE_URL="postgresql://postgres:verify@localhost:$PORT/verify?schema=public"
npx prisma migrate deploy
# Ledger ↔ schema.prisma parity: exits 2 on drift.
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --exit-code
echo "✅ migrations build the full schema from empty and match schema.prisma"
```

- [ ] **Step 3: Run it — expect possible extra drift.** `cd packages/server && ./scripts/verify-migrations.sh`. If `migrate deploy` passes but the diff step exits 2, the printed diff is **other** db-push drift never captured; append the printed DDL (converted to `IF NOT EXISTS` form) to the Step-1 migration and re-run until green. Do not touch schema.prisma.
- [ ] **Step 4: Reconcile the two live DBs.** Dev (5432) and itest (5433) already contain all tables, so mark the repair applied instead of running it: `npx prisma migrate resolve --applied 20260627042630_add_surahs_table` with `DATABASE_URL` pointed at each in turn (dev URL from `.env`; itest URL from `jest.integration.config.js`). Then `npx prisma migrate deploy` on each → "No pending migrations".
- [ ] **Step 5: CI + docs.** In `.github/workflows/ci.yml`, after the existing `Prisma migrate` step add:

```yaml
      - name: Migration ledger drift check
        run: npm exec --workspace=@quran-review/server -- prisma migrate diff --from-schema-datasource packages/server/prisma/schema.prisma --to-schema-datamodel packages/server/prisma/schema.prisma --exit-code
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/education_test?schema=public
```

In `CLAUDE.md` Commands section, replace the migrations line with `npx prisma migrate dev            # run migrations (never use db push)`. In `tasks/todo.md` server-notes, replace the "Migration ledger repaired…" note with "Ledger baseline repaired (20260627042630); verify with scripts/verify-migrations.sh".
- [ ] **Step 6: Full proof + commit.** Re-run `./scripts/verify-migrations.sh` (green), `npx jest -c jest.integration.config.js --runInBand --testPathPatterns=health` (itest DB still fine). Commit: `fix(db): baseline surahs migration — fresh migrate deploy works (F4a)`.

---

### Task 2: F4b — mushaf asset pipeline (AC4.3–AC4.5)

**Files:** Create `packages/server/src/lib/mushaf-assets.ts`, `src/__tests__/mushaf-assets.test.ts`, `src/__integration__/setup-mushaf-assets.ts`; Modify `src/app.ts`, `src/server.ts`, `src/config/index.ts`, `jest.integration.config.js` (setupFiles), `docs/DEPLOYMENT.md`; extend `src/__integration__/mushaf-flows.itest.ts`.
**Interfaces:** Produces `getMushafPagesDir(): string`, `verifyMushafAssets(dir): { present: number; missing: number[] }`, `TOTAL_MUSHAF_PAGES = 604`; `config.mushafPagesDir`, `config.allowMissingMushafPages`.

- [ ] **Step 1: Failing unit test** `src/__tests__/mushaf-assets.test.ts`:

```ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import { verifyMushafAssets } from '../lib/mushaf-assets';

describe('verifyMushafAssets', () => {
  it('reports missing pages and counts present ones', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mushaf-'));
    fs.writeFileSync(path.join(dir, '1.webp'), 'x');
    fs.writeFileSync(path.join(dir, '604.webp'), 'x');
    const r = verifyMushafAssets(dir);
    expect(r.present).toBe(2);
    expect(r.missing).toHaveLength(602);
    expect(r.missing[0]).toBe(2);
  });
  it('handles a nonexistent dir as all-missing', () => {
    const r = verifyMushafAssets('/nonexistent-h1-dir');
    expect(r.present).toBe(0);
    expect(r.missing).toHaveLength(604);
  });
});
```

Run `npx jest --testPathPatterns=mushaf-assets` → FAIL (module not found).
- [ ] **Step 2: Implement** `src/lib/mushaf-assets.ts`:

```ts
import fs from 'fs';
import path from 'path';
import { config } from '../config';

export const TOTAL_MUSHAF_PAGES = 604;

/** Where the 604 page WebPs live. Env-overridable so tests/deploys can relocate it. */
export function getMushafPagesDir(): string {
  return config.mushafPagesDir;
}

export function verifyMushafAssets(dir: string): { present: number; missing: number[] } {
  const missing: number[] = [];
  let present = 0;
  for (let p = 1; p <= TOTAL_MUSHAF_PAGES; p++) {
    if (fs.existsSync(path.join(dir, `${p}.webp`))) present++;
    else missing.push(p);
  }
  return { present, missing };
}
```

In `src/config/index.ts` add (following the existing config style; import `path` if absent):

```ts
  mushafPagesDir: process.env.MUSHAF_PAGES_DIR || path.join(__dirname, '..', '..', 'mushaf-pages'),
  allowMissingMushafPages: process.env.ALLOW_MISSING_MUSHAF_PAGES === '1',
```

In `src/app.ts` replace the hard-coded static path with `express.static(getMushafPagesDir(), { immutable: true, maxAge: '365d', index: false })` (import from `./lib/mushaf-assets`).
- [ ] **Step 3: Fail-loud startup (AC4.4).** In `src/server.ts`, before `listen`:

```ts
import { verifyMushafAssets, getMushafPagesDir, TOTAL_MUSHAF_PAGES } from './lib/mushaf-assets';
// Mushaf pages are core content: refuse to serve a production API that would
// 404 the Quran. Override consciously with ALLOW_MISSING_MUSHAF_PAGES=1.
const assets = verifyMushafAssets(getMushafPagesDir());
if (assets.present < TOTAL_MUSHAF_PAGES) {
  const msg = `mushaf-pages incomplete: ${assets.present}/${TOTAL_MUSHAF_PAGES} present (first missing: ${assets.missing[0]})`;
  if (config.env === 'production' && !config.allowMissingMushafPages) {
    logger.error(msg + ' — refusing to start. Populate with scripts/extract_mushaf_pages.py or set ALLOW_MISSING_MUSHAF_PAGES=1.');
    process.exit(1);
  }
  logger.warn(msg);
}
```

- [ ] **Step 4: Smoke itest (AC4.5).** Create `src/__integration__/setup-mushaf-assets.ts` — makes a tmp dir, writes stub `1.webp`/`604.webp`, sets `process.env.MUSHAF_PAGES_DIR` — and add it **first** in `jest.integration.config.js` `setupFiles` (it must run before `app.ts` reads config). Then extend `mushaf-flows.itest.ts`:

```ts
describe('mushaf page images (static)', () => {
  it('serves 1.webp and 604.webp from MUSHAF_PAGES_DIR with long cache; 404 out of range', async () => {
    const res1 = await request(app).get('/mushaf-pages/1.webp');
    const res604 = await request(app).get('/mushaf-pages/604.webp');
    expect(res1.status).toBe(200);
    expect(res604.status).toBe(200);
    expect(res1.headers['cache-control']).toContain('immutable');
    expect((await request(app).get('/mushaf-pages/605.webp')).status).toBe(404);
  });
});
```

- [ ] **Step 5: Docs.** Append to `docs/DEPLOYMENT.md`: "Mushaf page images" — populate via `python3 packages/server/scripts/extract_mushaf_pages.py /path/to/standard2-quran.pdf` (deps `pip install pymupdf pillow`) or restore an archived copy; env `MUSHAF_PAGES_DIR`, `ALLOW_MISSING_MUSHAF_PAGES`. And "Database migrations" — fresh envs run `npx prisma migrate deploy` (never `db push`), verified by `scripts/verify-migrations.sh`.
- [ ] **Step 6: Verify + commit.** `npx jest --testPathPatterns=mushaf-assets` PASS; `npx jest -c jest.integration.config.js --runInBand --testPathPatterns=mushaf-flows` PASS; `npx tsc --noEmit` clean. Commit: `feat(server): mushaf asset verification + fail-loud startup (F4b)`.

---

### Task 3: F1 server — PageMemorization model, contracts, routes (AC1.2, AC1.4, AC1.5, AC1.6)

**Files:** Modify `prisma/schema.prisma`, `packages/shared/src/validators/mushaf.ts`, `packages/shared/src/contracts/mushaf.contracts.ts`, `src/modules/mushaf/mushaf.module.ts`, `src/__integration__/endpoint-manifest.ts`, `src/__tests__/contract-schemas.test.ts`; Create `src/services/page-memorization.service.ts`, `src/services/__tests__/page-memorization.service.test.ts`, `src/__integration__/hifz-engine.itest.ts`.
**Interfaces (produces):**
- `PageMemorizationStatus` enum `NOT_STARTED|LEARNING|MEMORIZED|SOLID` (Prisma + zod `PageStatusEnum`).
- `pageMemorizationService.getPages(requesterId: string, requesterRole: 'STUDENT'|'TEACHER'|'ADMIN'|'PARENT', studentId?: string)` → `Promise<{page:number,status:string,lastReviewedAt:Date|null}[]>`; throws `AppError(403,'Not allowed to view this student')`.
- `pageMemorizationService.setPageStatus(actorId, actorRole, page, status, studentId?)` — self-write or assigned-teacher/admin write; `AppError(400,'Invalid page number')` outside 1..604.
- `pageMemorizationService.assertCanViewStudent(requesterId, requesterRole, studentId)` — exported; Task 8 reuses it.
- Contracts `mushafContracts.myPages` (GET `/api/v1/mushaf/my-pages`), `mushafContracts.setPageStatus` (PUT `/api/v1/mushaf/pages/:page/status`).

- [ ] **Step 1: Schema + migration.** In `prisma/schema.prisma` add (plus `pageMemorizations PageMemorization[] @relation("UserPageMemorizations")` on `model User`):

```prisma
enum PageMemorizationStatus {
  NOT_STARTED
  LEARNING
  MEMORIZED
  SOLID
}

// Hifz progress on the canonical unit — the 604-page Madani mushaf page.
model PageMemorization {
  id             String                 @id @default(uuid())
  userId         String
  page           Int
  status         PageMemorizationStatus @default(LEARNING)
  lastReviewedAt DateTime?
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt

  user User @relation("UserPageMemorizations", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, page])
  @@index([userId])
  @@map("page_memorizations")
}
```

Run `npx prisma migrate dev --name add_page_memorization` (ledger healthy after Task 1). Then `./scripts/verify-migrations.sh` → green (AC1.5). Apply to itest DB: `DATABASE_URL=<5433 url> npx prisma migrate deploy`.
- [ ] **Step 2: Shared validator + contracts.** `packages/shared/src/validators/mushaf.ts` add:

```ts
export const PageStatusEnum = z.enum(['NOT_STARTED', 'LEARNING', 'MEMORIZED', 'SOLID']);
export const setPageStatusSchema = z.object({
  status: PageStatusEnum,
  studentId: z.string().uuid().optional(), // assigned teacher writing for their student
});
```

`mushaf.contracts.ts` add to `mushafContracts` (import `setPageStatusSchema, PageStatusEnum` from the validator, `DateOut` from `./types`):

```ts
const PageMemorizationRow = z.looseObject({
  page: z.number(),
  status: PageStatusEnum,
  lastReviewedAt: DateOut.nullable(),
});

myPages: defineContract({
  method: 'GET',
  path: '/api/v1/mushaf/my-pages',
  summary: 'All page-memorization statuses in one call (own; ?studentId= for assigned teacher / linked parent / admin)',
  access: 'authenticated',
  request: { query: z.object({ studentId: z.string().uuid().optional() }) },
  responses: {
    200: z.object({ success: z.literal(true), data: z.array(PageMemorizationRow) }),
    401: ErrorEnvelope, 403: ErrorEnvelope,
  },
}),
setPageStatus: defineContract({
  method: 'PUT',
  path: '/api/v1/mushaf/pages/:page/status',
  summary: 'Mark a mushaf page NOT_STARTED/LEARNING/MEMORIZED/SOLID (self, or assigned teacher via studentId)',
  access: 'authenticated',
  request: { params: z.object({ page: z.string() }), body: setPageStatusSchema },
  responses: {
    200: z.object({ success: z.literal(true), data: PageMemorizationRow }),
    400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope,
  },
}),
```

(If `defineContract` typing rejects `query`, follow the existing pattern in `learningContracts.getMemorization`, which already carries a query schema.)
- [ ] **Step 3: Failing unit tests** `src/services/__tests__/page-memorization.service.test.ts` — mock prisma via `jest-mock-extended` exactly like `appointment.service.test.ts`. Cases: self write ok; teacher write for assigned student ok; teacher write for non-assigned → 403; parent view with APPROVED link ok; parent view without → 403; page 0 and 605 → `Invalid page number`; MEMORIZED stamps `lastReviewedAt` in both create and update branches (AC1.6):

```ts
it('stamps lastReviewedAt when marking MEMORIZED', async () => {
  mockedPrisma.pageMemorization.upsert.mockResolvedValue({ page: 3, status: 'MEMORIZED', lastReviewedAt: new Date() } as any);
  await setPageStatus('u1', 'STUDENT', 3, 'MEMORIZED');
  const arg = mockedPrisma.pageMemorization.upsert.mock.calls[0][0];
  expect(arg.create.lastReviewedAt).toBeInstanceOf(Date);
  expect(arg.update.lastReviewedAt).toBeInstanceOf(Date);
});
```

Run → FAIL (module missing).
- [ ] **Step 4: Implement the service** `src/services/page-memorization.service.ts`:

```ts
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

const TOTAL_PAGES = 604;
type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'PARENT';

/** View guard: self, admin, the student's assigned teacher, or an APPROVED-linked parent. */
export async function assertCanViewStudent(requesterId: string, requesterRole: Role, studentId: string) {
  if (requesterId === studentId || requesterRole === 'ADMIN') return;
  if (requesterRole === 'TEACHER') {
    const s = await prisma.user.findUnique({ where: { id: studentId }, select: { assignedTeacherId: true } });
    if (s?.assignedTeacherId === requesterId) return;
  }
  if (requesterRole === 'PARENT') {
    const link = await prisma.parentLink.findFirst({ where: { parentId: requesterId, studentId, status: 'APPROVED' } });
    if (link) return;
  }
  throw new AppError(403, 'Not allowed to view this student');
}

export async function getPages(requesterId: string, requesterRole: Role, studentId?: string) {
  const target = studentId ?? requesterId;
  await assertCanViewStudent(requesterId, requesterRole, target);
  return prisma.pageMemorization.findMany({
    where: { userId: target },
    orderBy: { page: 'asc' },
    select: { page: true, status: true, lastReviewedAt: true },
  });
}

export async function setPageStatus(
  actorId: string, actorRole: Role, page: number,
  status: 'NOT_STARTED' | 'LEARNING' | 'MEMORIZED' | 'SOLID', studentId?: string
) {
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) throw new AppError(400, 'Invalid page number');
  const target = studentId ?? actorId;
  if (target !== actorId) {
    // Write path is tighter than view: only the assigned teacher (or admin).
    if (actorRole === 'TEACHER') {
      const s = await prisma.user.findUnique({ where: { id: target }, select: { assignedTeacherId: true } });
      if (s?.assignedTeacherId !== actorId) throw new AppError(403, 'Not allowed to update this student');
    } else if (actorRole !== 'ADMIN') {
      throw new AppError(403, 'Not allowed to update this student');
    }
  }
  const reviewedStamp = status === 'MEMORIZED' || status === 'SOLID' ? new Date() : undefined;
  return prisma.pageMemorization.upsert({
    where: { userId_page: { userId: target, page } },
    create: { userId: target, page, status, lastReviewedAt: reviewedStamp ?? null },
    update: { status, ...(reviewedStamp ? { lastReviewedAt: reviewedStamp } : {}) },
    select: { page: true, status: true, lastReviewedAt: true },
  });
}
```

Unit tests PASS.
- [ ] **Step 5: Routes.** In `mushaf.module.ts` add two `defineRoute`s and register them in the `buildContractRouter` array:

```ts
const myPages = defineRoute(mushafContracts.myPages, async ({ query, userId, userRole }) => {
  const data = await pageMemorizationService.getPages(userId!, userRole as never, (query as { studentId?: string })?.studentId);
  return { status: 200 as const, body: { success: true as const, data } };
});

const setPageStatus = defineRoute(mushafContracts.setPageStatus, async ({ params, body, userId, userRole }) => {
  const page = parseInt(String(params.page), 10);
  const data = await pageMemorizationService.setPageStatus(userId!, userRole as never, page, body.status, body.studentId);
  return { status: 200 as const, body: { success: true as const, data } };
});
```

- [ ] **Step 6: Manifest + registry count.** `endpoint-manifest.ts` after the mushaf block: `{ method: 'GET', path: '/api/v1/mushaf/my-pages', access: 'authenticated' }`, `{ method: 'PUT', path: '/api/v1/mushaf/pages/:page/status', access: 'authenticated' }`. `contract-schemas.test.ts:12` → `toHaveLength(108)`.
- [ ] **Step 7: Integration tests** — create `src/__integration__/hifz-engine.itest.ts`:

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('F1 page memorization', () => {
  it('student marks a page and reads it back in one call (AC1.1/AC1.2 server half)', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const put = await request(app).put('/api/v1/mushaf/pages/3/status')
      .set('Authorization', `Bearer ${s.token}`).send({ status: 'MEMORIZED' });
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({ page: 3, status: 'MEMORIZED' });
    expect(put.body.data.lastReviewedAt).toBeTruthy(); // AC1.6

    const list = await request(app).get('/api/v1/mushaf/my-pages').set('Authorization', `Bearer ${s.token}`);
    expect(list.body.data).toHaveLength(1);
  });

  it('cross-student write → 403; assigned teacher write → 200 (AC1.4)', async () => {
    const t = await createUser({ role: Role.TEACHER });
    const s = await createUser({ role: Role.STUDENT, assignedTeacherId: t.id });
    const other = await createUser({ role: Role.STUDENT, email: 'other@x.com' });

    const evil = await request(app).put('/api/v1/mushaf/pages/1/status')
      .set('Authorization', `Bearer ${other.token}`).send({ status: 'MEMORIZED', studentId: s.id });
    expect(evil.status).toBe(403);

    const ok = await request(app).put('/api/v1/mushaf/pages/1/status')
      .set('Authorization', `Bearer ${t.token}`).send({ status: 'LEARNING', studentId: s.id });
    expect(ok.status).toBe(200);
  });

  it('page 605 → 400 Invalid page number', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app).put('/api/v1/mushaf/pages/605/status')
      .set('Authorization', `Bearer ${s.token}`).send({ status: 'LEARNING' });
    expect(res.status).toBe(400);
  });
});
```

Run `--testPathPatterns='hifz-engine|authz-matrix|completeness|registry-parity|contract-schemas'` → green.
- [ ] **Step 8: Commit** `feat(h1): F1 server — page-level memorization model + endpoints`.

---

### Task 4: F1 mobile — reader status chips (AC1.1, AC1.2 client half)

**Files:** Create `mobile/src/lib/mushafAssets.ts`, `mobile/src/api/mushafPages.ts`, `mobile/src/hooks/useMushafPages.ts`; Modify `mobile/app/student/mushaf.tsx`, `mobile/src/i18n/index.ts`.
**Interfaces (produces):** `mushafPageUri(page:number):string` + `IMAGE_ORIGIN` (single source; Task 7 reuses for teacher review); `useMushafPages()` → `{ statuses: Map<number, PageStatus>, setStatus(page,status): Promise<void>, isLoading }` with optimistic updates; `derivePageProgress(rows)` (added in Task 5).

- [ ] **Step 1: Extract the image-origin helper** into `mobile/src/lib/mushafAssets.ts` (move `getImageOrigin`/`pageUri` verbatim from `mushaf.tsx`, export as `IMAGE_ORIGIN` and `mushafPageUri`); update `mushaf.tsx` to import them and delete the local copies.
- [ ] **Step 2: API client** `mobile/src/api/mushafPages.ts` (contract-client style like `src/api/mushaf.ts`):

```ts
import { mushafContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export type PageStatus = 'NOT_STARTED' | 'LEARNING' | 'MEMORIZED' | 'SOLID';
export interface PageMemorizationRow { page: number; status: PageStatus; lastReviewedAt: string | null }

export const mushafPagesApi = {
  getMyPages: async (studentId?: string): Promise<PageMemorizationRow[]> => {
    const res = expectStatus(
      await contractClient.call(mushafContracts.myPages, {
        query: (studentId ? { studentId } : {}) as never,
      }),
      200
    );
    return (res.body as unknown as { data: PageMemorizationRow[] }).data;
  },
  setPageStatus: async (page: number, status: PageStatus): Promise<PageMemorizationRow> => {
    const res = expectStatus(
      await contractClient.call(mushafContracts.setPageStatus, {
        params: { page: String(page) } as never,
        body: { status } as never,
      }),
      200
    );
    return (res.body as unknown as { data: PageMemorizationRow }).data;
  },
};
```

- [ ] **Step 3: Hook** `mobile/src/hooks/useMushafPages.ts` — TanStack Query, key `['mushafPages']`, `queryFn: () => mushafPagesApi.getMyPages()`; expose `statuses` as a memoized `Map(page → status)`; `setStatus` mutation with optimistic `setQueryData` (upsert the row, rollback on error, invalidate on settle).
- [ ] **Step 4: Reader chip.** In `mushaf.tsx`, in the toolbar center block under the page/juz labels, render a status chip for `currentPage`; tap opens a 4-option modal (visual precedent: the date-picker modal in `appointments.tsx`):

```tsx
const { statuses, setStatus } = useMushafPages();
const currentStatus = statuses.get(currentPage) ?? 'NOT_STARTED';
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel={t('pageStatus')}
  onPress={() => setStatusPickerOpen(true)}
  style={[styles.statusChip, { borderColor: statusColor }]}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
>
  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
  <AppText variant="labelLarge" color={statusColor}>{statusLabel}</AppText>
</TouchableOpacity>
```

Status→color: NOT_STARTED `COLORS.textSecondary`, LEARNING `COLORS.primary`, MEMORIZED/SOLID the theme's amber/gold token from `constants/theme.ts` (grep for `amber|gold|accent`; use the existing token — **Rationed Gold: gold marks earned achievement only**, and the text label always accompanies the dot per Status-Is-Not-Only-Color). Choosing a status calls `setStatus(currentPage, s)` (2 taps total = AC1.1) and closes the modal.
- [ ] **Step 5: i18n** — both `ar` and `en`: `pageStatus` (حالة الصفحة/Page status), `statusNotStarted` (لم تبدأ/Not started), `statusLearning` (قيد الحفظ/Learning), `statusMemorized` (محفوظة/Memorized), `statusSolid` (متقنة/Solid).
- [ ] **Step 6: Verify + commit.** `npx tsc --noEmit`, `node scripts/check-i18n.js`, simulator smoke (mark page 1 → chip persists after reload = AC1.1). Commit `feat(h1): F1 mobile — page status chips on the mushaf reader`.

---

### Task 5: F1 — progress surfaces (AC1.3)

**Files:** Modify `mobile/src/hooks/useMushafPages.ts` (add `derivePageProgress`), `mobile/app/student/home.tsx`, `mobile/app/teacher/student-detail.tsx`, `mobile/app/parent/home.tsx`, `mobile/src/i18n/index.ts`.
**Interfaces:** Consumes `useMushafPages` / `mushafPagesApi.getMyPages(studentId)`.

- [ ] **Step 1: Shared derivation** in `useMushafPages.ts`:

```ts
export function derivePageProgress(rows: PageMemorizationRow[]) {
  const memorized = rows.filter((r) => r.status === 'MEMORIZED' || r.status === 'SOLID').length;
  return { memorized, total: 604, pct: Math.round((memorized / 604) * 100) };
}
```

The **only** place the headline number is computed (one source of truth).
- [ ] **Step 2: Student home.** In `home.tsx` progress section (SectionHeader ~line 383), headline becomes `«{memorized} / 604 {t('pagesMemorized')} ({pct}%)»` from `useMushafPages()`; the surah list beneath stays.
- [ ] **Step 3: Teacher student-detail.** Fetch `mushafPagesApi.getMyPages(studentId)` (`useQuery` keyed `['mushafPages', studentId]`) and render the same `derivePageProgress` line in the header card.
- [ ] **Step 4: Parent home.** Per linked child card, same line (fetch per childId; on 403 hide the line silently — link may be pending).
- [ ] **Step 5: i18n** `pagesMemorized` (صفحة محفوظة/pages memorized). Gates + simulator smoke: mark pages as ali → identical number on student home, teacher student-detail, parent card. Commit `feat(h1): F1 — pages-memorized as the shared progress number`.

---

### Task 6: F2 server — page-anchored recordings (AC2.1 server half, AC2.2, AC2.5)

**Files:** Modify `prisma/schema.prisma`, `packages/shared/src/validators/common.ts`, `packages/shared/src/contracts/media.contracts.ts`, `src/modules/recordings/recordings.module.ts`, `src/services/recording.service.ts`; extend `src/__integration__/hifz-engine.itest.ts`.
**Interfaces (produces):** `Recording.page Int?`, `Recording.surahId Int?` (plain nullable columns — no FK, a page tag must survive surah reseeds); upload accepts multipart fields `page`, `surahId`.

- [ ] **Step 1: Schema.** `model Recording` add `page Int?`, `surahId Int?`, `@@index([studentId, page])`. `npx prisma migrate dev --name add_recording_page`; `./scripts/verify-migrations.sh` green; `migrate deploy` to itest DB.
- [ ] **Step 2: Validator + contract.** `CreateRecordingSchema` add `page: z.coerce.number().int().min(1).max(604).optional(), surahId: z.coerce.number().int().min(1).max(114).optional()` (`z.coerce` because multer delivers strings; validate() runs after multer — pinned ordering). `media.contracts.ts` `RecordingRow` add `page: z.number().nullable().optional(), surahId: z.number().nullable().optional()`.
- [ ] **Step 3: Service + handler.** `uploadRecording` gains trailing `page?: number, surahId?: number` written into `prisma.recording.create` data; the module handler passes `body.page`/`body.surahId`.
- [ ] **Step 4: Itests** (extend `hifz-engine.itest.ts`):

```ts
describe('F2 page-anchored recordings', () => {
  it('upload carries page + surahId and echoes them (AC2.1 server half)', async () => {
    const t = await createUser({ role: Role.TEACHER });
    const s = await createUser({ role: Role.STUDENT, assignedTeacherId: t.id });
    const res = await request(app).post('/api/v1/recordings')
      .set('Authorization', `Bearer ${s.token}`)
      .field('fileName', 'p3.m4a').field('fileSizeBytes', '4')
      .field('contentType', 'audio/x-m4a').field('page', '3').field('surahId', '1')
      .attach('file', Buffer.from('abcd'), { filename: 'p3.m4a', contentType: 'audio/x-m4a' });
    expect(res.status).toBe(201);
    expect(res.body.page).toBe(3);
    expect(res.body.surahId).toBe(1);
  });
  it('legacy upload without page still works — nullable, zero regression (AC2.2)', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app).post('/api/v1/recordings')
      .set('Authorization', `Bearer ${s.token}`)
      .field('fileName', 'x.m4a').field('fileSizeBytes', '1').field('contentType', 'audio/x-m4a')
      .attach('file', Buffer.from('a'), { filename: 'x.m4a', contentType: 'audio/x-m4a' });
    expect(res.status).toBe(201);
    expect(res.body.page).toBeNull();
  });
  it('page 700 → 400 validation error', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app).post('/api/v1/recordings')
      .set('Authorization', `Bearer ${s.token}`)
      .field('fileName', 'x.m4a').field('fileSizeBytes', '1').field('contentType', 'audio/x-m4a')
      .field('page', '700')
      .attach('file', Buffer.from('a'), { filename: 'x.m4a', contentType: 'audio/x-m4a' });
    expect(res.status).toBe(400);
  });
});
```

`--testPathPatterns='hifz-engine|media-flows'` → media-flows stays green **untouched** (AC2.5).
- [ ] **Step 5: Commit** `feat(h1): F2 server — recordings carry mushaf page + surah`.

---

### Task 7: F2 mobile — record from the page, review with the page (AC2.1–AC2.4)

**Files:** Modify `mobile/app/student/mushaf.tsx`, `mobile/app/teacher/recordings.tsx`, `mobile/src/api/recordings.ts`, `mobile/app/student/recordings.tsx`, `mobile/src/i18n/index.ts`; Create `mobile/src/api/weakAyahs.ts` **only if** `grep -rln "weakAyah" mobile/src/api/` is empty.
**Interfaces:** Consumes `mushafPageUri` (Task 4), `recordingsApi.upload`, `weakAyahsContracts.flag`, `mushafApi.getPage` (ayah list for the flag picker). Depends on Task 9 Step 1's `?page=` deep link — if executing in order, land that step early (it is self-contained).

- [ ] **Step 1: Recording types.** `mobile/src/api/recordings.ts` — `Recording` gains `page?: number | null; surahId?: number | null;`; the `upload(fileUri, fileName, fileSize, contentType)` helper gains optional trailing `page?: number` appended to FormData: `if (page) formData.append('page', String(page));`.
- [ ] **Step 2: Mic on the reader.** In `mushaf.tsx` toolbar add a mic button (beside the Task-4 status chip). Tap → modal with record/stop/submit using `expo-av` `Audio.Recording` — **lift the prepare/start/stop/getURI + permission sequence verbatim from `app/student/recordings.tsx`** (grep `Audio.Recording` there; no second recording code path, AC2.1). On submit: `recordingsApi.upload(uri, `page-${currentPage}.m4a`, size, 'audio/x-m4a', currentPage)` → success toast (`t('recordingSaved')`) + close. Recording starts in ≤ 2 taps (mic → record).
- [ ] **Step 3: Teacher review shows the page (AC2.2).** In `teacher/recordings.tsx`: rows with `rec.page` get a `{t('pageNumber')} {rec.page}` tag chip; in the review modal (openReview ~line 185), when `reviewing?.page`:

```tsx
{reviewing?.page ? (
  <Image
    source={{ uri: mushafPageUri(reviewing.page) }}
    style={{ width: '100%', aspectRatio: 750 / 1072, borderRadius: RADIUS.md }}
    contentFit="contain"
    cachePolicy="disk"
  />
) : null}
```

(import `Image` from `expo-image`, `mushafPageUri` from `@/src/lib/mushafAssets`). Untagged recordings render exactly as today.
- [ ] **Step 4: Weak-ayah flag (AC2.3).** Same review modal, when `reviewing?.page`: a `t('flagWeakAyah')` button → `mushafApi.getPage(reviewing.page)` → list of that page's ayahs (`{surah.nameAr} — {t('ayah')} {number}`) → tap → `weakAyahsApi.flag(reviewing.studentId, ayah.id)` → `t('weakAyahFlagged')` toast. Create `mobile/src/api/weakAyahs.ts` if missing:

```ts
import { weakAyahsContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';
export const weakAyahsApi = {
  flag: async (studentId: string, ayahId: number): Promise<void> => {
    expectStatus(await contractClient.call(weakAyahsContracts.flag, { body: { studentId, ayahId } as never }), 201);
  },
};
```

(Note: the page endpoint's `AyahRow` must expose `id` — check `mushaf.contracts.ts`; if `id` is absent from the loose object it still passes through at runtime, but add `id: z.number()` to `AyahRow` for type safety.)
- [ ] **Step 5: Tag → reader deep link (AC2.4).** Student + teacher recording rows: tapping the page tag → `router.push({ pathname: '/student/mushaf', params: { page: String(rec.page) } })`.
- [ ] **Step 6: i18n** — `recordThisPage` (سجّل هذه الصفحة/Record this page), `recordingSaved` (تم حفظ التسجيل/Recording saved), `flagWeakAyah` (تحديد آية ضعيفة/Flag weak ayah), `weakAyahFlagged` (تم تحديد الآية/Ayah flagged), `startRecording` (تسجيل/Record), `stopRecording` (إيقاف/Stop). Gates + simulator smoke (record from page 1 as ali; review as teacher@ shows the blue page image). Commit `feat(h1): F2 mobile — recite from the page, review with the page`.

---

### Task 8: F3 server — Sabaq/Sabqi/Manzil queue (AC3.1–AC3.5)

**Files:** Create `src/services/revision-queue.service.ts`, `src/services/__tests__/revision-queue.service.test.ts`; Modify `packages/shared/src/contracts/mushaf.contracts.ts` (+`revisionQueue`, +`pageReviewed`), `src/services/page-memorization.service.ts` (+`markPageReviewed`), `src/modules/mushaf/mushaf.module.ts`, `endpoint-manifest.ts`, `contract-schemas.test.ts` (→110); extend `hifz-engine.itest.ts`.
**Interfaces (produces):**
- `export type RevisionBand = 'OVERRIDE' | 'MANZIL' | 'SABQI' | 'SABAQ'`
- `export interface RevisionQueueItem { page: number | null; surahId: number | null; band: RevisionBand; overdueDays: number }`
- `buildRevisionQueue(input: { today: Date; pages: { page: number; status: string; lastReviewedAt: Date | null; updatedAt: Date }[]; weakPages: Set<number>; overrides: { surahId: number; scheduledFor: Date }[] }): RevisionQueueItem[]` — **pure, no I/O, no RNG** (AC3.1).
- `getRevisionQueue(requesterId, requesterRole, studentId?)` → `{ items: RevisionQueueItem[]; reviewedThisWeek: number }` — guard via `assertCanViewStudent` (Task 3), Redis cache-aside.
- Contracts: `mushafContracts.revisionQueue` (GET `/api/v1/mushaf/revision-queue`), `mushafContracts.pageReviewed` (POST `/api/v1/mushaf/pages/:page/reviewed`).

**Banding constants** (config constants in the service file — pedagogy, not schema): memorization age = days since the row's `updatedAt`; `< 7d → SABAQ, interval 1` · `7–30d → SABQI, interval 3` · `> 30d → MANZIL, interval 7`. Page in `weakPages` ⇒ interval of the next-tighter band (MANZIL→3, SABQI→1, SABAQ stays 1). Due when `daysSince(lastReviewedAt ?? updatedAt) >= interval`; `overdueDays = daysSince − interval`. Ordering: OVERRIDE (scheduledFor ≤ today) first, then MANZIL, SABQI, SABAQ; within band `overdueDays` desc, ties page asc. Only MEMORIZED/SOLID pages queue.

- [ ] **Step 1: Failing unit tests** — table-driven over the pure function: (a) MEMORIZED yesterday, never reviewed → SABAQ due; (b) 10-day-old page reviewed 2 days ago → not due; reviewed 3 days ago → SABQI due; (c) 40-day-old page reviewed 8 days ago → MANZIL, `overdueDays: 1`; (d) same page in `weakPages` → due at 3 days (boost, AC3.2); (e) override `{surahId: 2, scheduledFor: yesterday}` sorts first and is never dropped (AC3.4); (f) determinism: same input twice → `toEqual`, plus one exact-array assertion on a fixed fixture (AC3.1); (g) LEARNING/NOT_STARTED pages never queue. Run → FAIL.
- [ ] **Step 2: Implement the pure function** per the constants → tests PASS.
- [ ] **Step 3: Wrapper + cache.** `getRevisionQueue` loads: `pageMemorization.findMany({ where: { userId: target, status: { in: ['MEMORIZED', 'SOLID'] } } })`; weak pages via `weakAyahFlag.findMany({ where: { studentId: target, status: 'ACTIVE' }, include: { ayah: { select: { page: true } } } })` → `Set(f.ayah.page)`; overrides via `revisionSchedule.findMany({ where: { userId: target, status: 'PENDING', scheduledFor: { lte: endOfToday } }, select: { surahId: true, scheduledFor: true } })`; `reviewedThisWeek = pageMemorization.count({ where: { userId: target, lastReviewedAt: { gte: sevenDaysAgo } } })`. Cache-aside: grep `src/lib/queue.ts` for its redis client; if reusable, add/export `getRedis(): … | null` there following its own graceful-null convention; key `revq:${userId}:${yyyy-mm-dd}`, TTL 3600s; `del` the key inside `setPageStatus` and `markPageReviewed`. Redis absent → straight compute (AC3.5 — this is the itest path; the cache branch gets a unit test with a mocked client). *Conscious deviation from the spec's "nightly precompute": cache-aside with write-invalidation meets the same ≤100ms cached-read AC with less machinery — documented at close-out.*
- [ ] **Step 4: `markPageReviewed`** in `page-memorization.service.ts`: page-range 400 guard; `findUnique` on `{userId_page}` → 404 `AppError(404, 'Page not tracked')` if absent; update `lastReviewedAt: new Date()`; return `{page, lastReviewedAt}`.
- [ ] **Step 5: Contracts + routes + manifest.**

```ts
revisionQueue: defineContract({
  method: 'GET',
  path: '/api/v1/mushaf/revision-queue',
  summary: "Today's Sabaq/Sabqi/Manzil revision queue (own; ?studentId= for assigned teacher / linked parent / admin)",
  access: 'authenticated',
  request: { query: z.object({ studentId: z.string().uuid().optional() }) },
  responses: {
    200: z.object({
      success: z.literal(true),
      data: z.object({
        items: z.array(z.looseObject({
          page: z.number().nullable(), surahId: z.number().nullable(),
          band: z.enum(['OVERRIDE', 'MANZIL', 'SABQI', 'SABAQ']), overdueDays: z.number(),
        })),
        reviewedThisWeek: z.number(), // adherence numerator (AC3.6)
      }),
    }),
    401: ErrorEnvelope, 403: ErrorEnvelope,
  },
}),
pageReviewed: defineContract({
  method: 'POST',
  path: '/api/v1/mushaf/pages/:page/reviewed',
  summary: "Stamp a revision pass on a page (updates lastReviewedAt, drops it from today's queue)",
  access: 'authenticated',
  request: { params: z.object({ page: z.string() }) },
  responses: {
    200: z.object({ success: z.literal(true), data: z.looseObject({ page: z.number(), lastReviewedAt: DateOut }) }),
    400: ErrorEnvelope, 401: ErrorEnvelope, 404: ErrorEnvelope,
  },
}),
```

Routes in `mushaf.module.ts` mirror Task 3 Step 5's pattern. Manifest: both `access: 'authenticated'`. Registry → **110**.
- [ ] **Step 6: Itests** (extend `hifz-engine.itest.ts`): create student, `PUT pages/3/status MEMORIZED`, backdate via `prisma.pageMemorization.update({ data: { lastReviewedAt: <2 days ago>, updatedAt: <2 days ago> } })` (note: prisma refuses direct `updatedAt` writes through the typed client — use `prisma.$executeRaw` UPDATE for the backdate); GET queue → contains page 3 SABAQ; `POST pages/3/reviewed` → 200; GET queue again → empty (AC3.3 server half); teacher-created `revisionSchedule` row (via prisma create) appears first as OVERRIDE (AC3.4); all with Redis absent (AC3.5 compute path). Full itest suite → green.
- [ ] **Step 7: Commit** `feat(h1): F3 server — self-running revision queue (sabaq/sabqi/manzil)`.

---

### Task 9: F3 mobile — Today's revision card + reader deep link (AC3.3, AC3.6)

**Files:** Create `mobile/src/api/revisionQueue.ts`, `mobile/src/hooks/useRevisionQueue.ts`; Modify `mobile/app/student/mushaf.tsx` (`?page=`), `mobile/app/student/home.tsx`, `mobile/app/teacher/student-detail.tsx`, `mobile/app/parent/home.tsx`, `mobile/src/i18n/index.ts`.

- [ ] **Step 1: Reader `?page=` deep link.** In `mushaf.tsx`: `const { page: pageParam } = useLocalSearchParams<{ page?: string }>();` and seed `currentPage` with `useState(() => { const p = parseInt(String(pageParam ?? '1'), 10); return Number.isFinite(p) && p >= 1 && p <= TOTAL_PAGES ? p : 1; })` (the existing `initialIndex` memo already feeds `initialScrollIndex`). Import `useLocalSearchParams` from `expo-router`.
- [ ] **Step 2: API + hook.** `revisionQueueApi.getQueue(studentId?)` → `{items, reviewedThisWeek}` via `mushafContracts.revisionQueue`; `revisionQueueApi.markReviewed(page)` via `mushafContracts.pageReviewed`. `useRevisionQueue()` — key `['revisionQueue']`, `markReviewed` mutation with **optimistic removal** from `items` (AC3.3, no refetch) + invalidate `['mushafPages']` on settle.
- [ ] **Step 3: Home card.** In `student/home.tsx` directly under the next-session/hero block: `t('todaysRevision')` `AppCard` — top 5 items as rows (`{t('pageNumber')} {item.page}` + band chip `t('bandSabaq')` etc.); row tap → `router.push({pathname:'/student/mushaf', params:{page:String(item.page)}})`; trailing ✓ (`accessibilityLabel={t('markReviewed')}`) → `markReviewed(item.page)`. Empty queue → single quiet line `t('revisionAllDone')` (no gold — nothing newly earned).
- [ ] **Step 4: Adherence surfaces (AC3.6).** `teacher/student-detail.tsx` + `parent/home.tsx` child card: `{t('revisionAdherence')}: {reviewedThisWeek} {t('reviewedThisWeek')} · {items.length} {t('dueToday')}` from `getQueue(studentId)` (403-tolerant like Task 5).
- [ ] **Step 5: i18n** — `todaysRevision` (مراجعة اليوم/Today's revision), `bandSabaq` (سَبَق/New), `bandSabqi` (سَبْقي/Recent), `bandManzil` (مَنزِل/Long-term), `bandOverride` (من المعلم/From teacher), `revisionAllDone` (أتممت مراجعة اليوم/All caught up for today), `revisionAdherence` (التزام المراجعة/Revision adherence), `reviewedThisWeek` (مراجعات هذا الأسبوع/reviewed this week), `dueToday` (مستحقة اليوم/due today), `markReviewed` (تمت المراجعة/Reviewed).
- [ ] **Step 6: Gates + smoke** (mark 2 pages as ali, backdate one via psql, see the card, tap into the page, mark reviewed → card shrinks without refetch). Commit `feat(h1): F3 mobile — today's revision card + deep links`.

---

### Task 10: Close-out

- [ ] **Step 1: Full gates.** `cd packages/server && npx jest && npx jest -c jest.integration.config.js --runInBand && npx tsc --noEmit`; `cd ../shared && npx tsc --noEmit`; `cd ../../mobile && npx tsc --noEmit && node scripts/check-i18n.js`; `packages/server/scripts/verify-migrations.sh`. Record final counts.
- [ ] **Step 2: AC sweep.** Walk AC1.1–AC4.5 in the roadmap spec; annotate each with its proving test/screen in `tasks/todo.md` under `[x] H1 Hifz Engine`. Document the two conscious deviations: (a) F3 nightly precompute → cache-aside with write-invalidation; (b) AC4.1's "CI on every PR" limited by the workflow living under `education_management/.github/` while the git root is `opencode/` — ask the user whether to copy the workflow to the repo root.
- [ ] **Step 3: security-reviewer** agent pass over the new endpoints (my-pages / page-status / revision-queue `?studentId=` authorization surface) — findings fixed or accepted in writing.
- [ ] **Step 4:** Use superpowers:finishing-a-development-branch — expected per session precedent: merge `feat/h1-hifz-engine` into `main` + push (standing authorization for main).

## Self-review notes

- **Spec coverage:** F4a→Task 1, F4b→Task 2, F1→Tasks 3–5, F2→Tasks 6–7, F3→Tasks 8–9; every AC number appears in a task step or test. AC2.3's flags feed F3 via the weak-page boost (Task 8 Step 3).
- **Ordering:** Tasks 1–2 unblock 3 (healthy ledger) and 7 (asset URI reuse). Task 7 Step 5 consumes Task 9 Step 1's deep link — flagged in both places; Task 9 Step 1 is self-contained and safe to land early.
- **Type consistency:** `PageStatus`/`PageMemorizationStatus`/`PageStatusEnum` identical string unions across Prisma, zod, mobile; `RevisionQueueItem` identical in contract and service; `assertCanViewStudent` defined Task 3, reused Task 8; `mushafPageUri` defined Task 4, reused Task 7.
- **Known unknowns with fallback instructions at point of use:** `defineContract` query support (precedent: `learningContracts.getMemorization`), redis client exposure in `lib/queue.ts`, `AyahRow.id` presence, prisma `updatedAt` backdating (use `$executeRaw`).
