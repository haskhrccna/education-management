# Plan — Implement the full 10× Roadmap

**Scope:** all 11 roadmap features (F1–F11) plus follow-up capabilities A1–A8, staged for incremental delivery.  
**Date:** 2026-07-16  
**Total estimated effort:** ~15 working days across three horizons (F1–F4 first, then F5–F7, then F8–F11).  
**Branching model:** one feature branch per milestone, merged only when green.  
**Gates for every branch:** server tests green, mobile `tsc --noEmit` + `check-i18n` clean, authz matrix covers new endpoints, `security-reviewer` signs off where noted.

---

## 0. Principles inherited from CLAUDE.md

- API flow: `shared/contracts` → `server/modules` → `server/services` → Prisma.
- Mobile flow: `shared/contracts` → `mobile/src/api/contract.ts` → `mobile/src/api/<domain>.ts` → `mobile/src/hooks/use<Domain>.ts` → screen.
- Validation via Zod in `@quran-review/shared` for JSON routes; multipart upload keeps multer-before-validate ordering.
- Errors: throw `AppError` in services; never throw raw errors.
- Authz: every new endpoint is added to the integration-test authz matrix.
- i18n: every new string in both `ar` and `en`.
- Migrations: only via `npx prisma migrate dev` (never `db push`); `migrate reset` must work on a fresh DB.
- No completion without proof (tests, logs, or diffs).

---

## 1. Pre-work: fixes that unblock everything

### 1.1 `surahs` baseline migration (F4a)

**Why:** `20260627042638_add_ayahs_and_mushaf_pages/migration.sql` does `ALTER TABLE "surahs"`, but `20260429215538_init/migration.sql` never creates it. A fresh `prisma migrate reset` fails.

**Change:**
- Create a **baseline** migration that runs before all others. In Prisma this is typically the earliest migration. Because the existing earliest migration already ran in production, we repair the ledger by editing the earliest `migration.sql` to add:
  ```sql
  CREATE TABLE IF NOT EXISTS "surahs" (
    id SERIAL NOT NULL,
    number INTEGER NOT NULL,
    nameAr TEXT NOT NULL,
    nameEn TEXT NOT NULL,
    ayahCount INTEGER NOT NULL,
    juz INTEGER NOT NULL,
    pages INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "surahs_pkey" PRIMARY KEY (id),
    CONSTRAINT "surahs_number_key" UNIQUE (number)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "surahs_number_key" ON "surahs"(number);
  CREATE INDEX IF NOT EXISTS "surahs_juz_idx" ON "surahs"(juz);
  CREATE INDEX IF NOT EXISTS "surahs_number_idx" ON "surahs"(number);
  ```
  plus the seed insert of all 114 surahs (move seed logic from `seed.ts` or keep it in `seed.ts` and make the migration idempotent).
- Add a CI job that runs `npx prisma migrate reset --force` against an empty Postgres container.
- Update `CLAUDE.md` and `docs/DEPLOYMENT.md` to remove any mention of `db push`.

**Acceptance criteria:**
- **AC-F4a-1** `npx prisma migrate reset --force` succeeds on a fresh DB with no manual steps.
- **AC-F4a-2** `npx prisma db seed` still populates test users and ayahs.
- **AC-F4a-3** CI fails if `migrate reset` fails.

---

### 1.2 Mushaf asset pipeline (F4b)

**Why:** `mushaf-pages/` is git-ignored and only exists on the developer machine.

**Change:**
- Document `scripts/extract_mushaf_pages.py` in `docs/DEPLOYMENT.md` with required source PDF and checksum verification.
- Add startup check in `packages/server/src/config/index.ts` (or a new `lib/mushaf-assets.ts`): if `NODE_ENV=production` and `mushaf-pages/` is empty or missing `1.webp`/`604.webp`, throw and refuse to start unless `MUSHAF_ASSETS_OPTIONAL=true`.
- Add a smoke integration test that asserts `GET /mushaf-pages/1.webp` and `/604.webp` return 200 with correct `content-type`.
- Optional: add a `scripts/download-mushaf-pages.sh` that fetches a checksummed archive from object storage (decide at plan time; the script alone is sufficient for AC).

**Acceptance criteria:**
- **AC-F4b-1** A new developer can run one documented command and populate `mushaf-pages/`.
- **AC-F4b-2** Server starts in dev with missing images (warning) but fails in production unless explicitly overridden.
- **AC-F4b-3** Smoke test covers first and last page.

---

## 2. Horizon 1 — The Hifz Engine

### 2.1 F1 · Page-level memorization on the real Mushaf

**Goal:** Replace the orphaned per-ayah counter with page-level tracking driven from the reader.

#### Schema changes

```prisma
enum PageMemorizationStatus {
  NOT_STARTED
  LEARNING
  MEMORIZED
  SOLID
}

model PageMemorization {
  id            String                  @id @default(cuid())
  userId        String
  page          Int
  status        PageMemorizationStatus  @default(NOT_STARTED)
  lastReviewedAt DateTime?
  createdAt     DateTime                @default(now())
  updatedAt     DateTime                @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, page])
  @@index([userId, page])
  @@index([userId, status])
  @@map("page_memorizations")
}
```

Migration: add the model and index. No data backfill required — it starts empty.

#### Server changes

1. **Shared contracts** — extend `mushaf.contracts.ts`:
   - `getMyPages`: `GET /api/v1/mushaf/my-pages` → returns `{ page, status, lastReviewedAt }[]` for all 604 pages (pre-filled with `NOT_STARTED` if row missing).
   - `setPageStatus`: `POST /api/v1/mushaf/my-pages/:page/status` → body `{ status: 'LEARNING'|'MEMORIZED'|'SOLID'|'NOT_STARTED' }`.

2. **Service** — new `page-memorization.service.ts`:
   - `getMyPages(userId)` — upsert all 604 rows on first call (idempotent), then return them. Use a single `findMany` + in-memory fill for missing pages.
   - `setPageStatus(userId, page, status)` — upsert row. If caller is `TEACHER`, assert `assertTeacherCanAccessStudent`. If caller is `STUDENT`, ensure `userId === callerId`. ADMIN allowed for support.
   - `getProgressSummary(userId)` — returns `{ memorizedPages, totalPages: 604, percent, byJuz: { juz, memorized, total }[] }`.

3. **Module** — extend `mushaf.module.ts` with the two new routes.

4. **Authz matrix** — add `GET /mushaf/my-pages` and `POST /mushaf/my-pages/:page/status` for STUDENT/TEACHER/ADMIN with cross-student 403 cases.

#### Mobile changes

1. **API client** — extend `mobile/src/api/mushaf.ts`:
   - `getMyPages()`
   - `setPageStatus(page, status)`
   - `getProgressSummary()`

2. **Hook** — new `mobile/src/hooks/usePageMemorization.ts`:
   - Query key `['my-pages']`.
   - `setPageStatus` mutation with optimistic update and `setQueryData`.

3. **Screen** — update `mobile/app/student/mushaf.tsx`:
   - Fetch `my-pages` once.
   - Render a small status chip in the toolbar and a floating action to set `LEARNING`/`MEMORIZED`.
   - Use `OptimisticUpdate` so the chip changes immediately.

4. **Progress surfaces**:
   - `mobile/app/student/home.tsx` — replace surah-based headline percent with pages-memorized percent.
   - `mobile/app/student/memorization.tsx` — add per-juz breakdown.
   - `mobile/app/teacher/student-detail.tsx` — show pages-memorized.
   - `mobile/app/parent/home.tsx` — show child's pages-memorized.

5. **i18n** — add keys: `pageMemorized`, `pageLearning`, `pageSolid`, `pagesMemorized`, `of604Pages`, `markLearning`, `markMemorized`, etc.

#### Tests

- Unit tests for `getProgressSummary` (edge cases: empty, all memorized, partial juz).
- Integration tests for authz (student writes own, teacher writes assigned, 403 otherwise).
- Mobile: unit test for `usePageMemorization` optimistic update.

**Acceptance criteria:**
- **AC1.1** ≤ 2 taps to mark a page from the reader; chip persists on revisit and after restart.
- **AC1.2** `GET /mushaf/my-pages` returns 604 rows in ≤ 300ms.
- **AC1.3** Pages-memorized percent is consistent across student/teacher/parent views.
- **AC1.4** Cross-student writes return 403; authz matrix covers it.
- **AC1.5** `prisma migrate reset` still succeeds after the migration.
- **AC1.6** Marking `MEMORIZED` sets `lastReviewedAt`.

---

### 2.2 F2 · Recite from the page

**Goal:** Anchor every recording to a Quran page.

#### Schema changes

```prisma
model Recording {
  ...existing fields...
  page          Int?      // Mushaf page number (1–604)
  surahId       Int?      // Optional context
  ayahId        Int?      // Optional context
}
```

Migration: add nullable columns.

#### Server changes

1. **Shared validators** — extend `CreateRecordingSchema` (or add optional fields) to accept `page`, `surahId`, `ayahId`.

2. **Service** — update `recording.service.ts::uploadRecording`:
   - Accept optional `page`, `surahId`, `ayahId` from body.
   - Validate page is 1–604 if provided.
   - Enforce the assigned-teacher relationship guard (already exists).
   - If `page` is provided, the student must have that page as `LEARNING`/`MEMORIZED`/`SOLID`? Decide at implementation: for the onboarding flow we may allow any page, but for the loop we want at least `LEARNING`. **Decision:** allow any page ≥ 1; a recording is the act that can transition `LEARNING` later.

3. **Service** — update `recording.service.ts::reviewRecording`:
   - Return page/surah/ayah context in the recording object.

4. **Module** — `recordings.module.ts` already has multer-before-validate; the body fields pass through. No module change needed beyond ensuring the new fields reach the service.

5. **Weak-ayah flag from review** — new route in `weak-ayahs.module.ts`:
   - `POST /api/v1/weak-ayahs/flag-from-recording` → body `{ recordingId, ayahId }`; asserts the caller is the student's assigned teacher; calls `weak-ayah.service.ts::flagWeakAyah`.

#### Mobile changes

1. **Reader recording entry point** — update `mobile/app/student/mushaf.tsx`:
   - Add a mic FAB that pre-fills `page` (and primary `surahId` from the page's ayahs) and opens the existing recorder overlay/screen.
   - Reuse `recordingsApi.uploadRecording` FormData path.

2. **Recording upload** — update `mobile/src/api/recordings.ts::upload` helper to accept optional `page`, `surahId`, `ayahId` appended to FormData.

3. **Teacher review screen** — update `mobile/app/teacher/recordings.tsx`:
   - If `recording.page` exists, render the page image beside the audio player.
   - Add a weak-ayah flag action for page-tagged recordings.

4. **Recording list** — add page/surah tag chips; tap opens reader at that page.

5. **i18n** — `recordFromPage`, `pageTag`, `flagWeakAyah`, `recordingContext`, etc.

#### Tests

- Integration tests for upload with page, validation for invalid page, relationship guard still enforced.
- Existing media-flow tests stay green with untagged legacy recordings.
- Mobile: test that page-tagged recording shows page image in review.

**Acceptance criteria:**
- **AC2.1** ≤ 2 taps to start recording from a page.
- **AC2.2** Page image shown beside audio in teacher review; untagged recordings unchanged.
- **AC2.3** Weak ayah flaggable from review screen in ≤ 2 taps.
- **AC2.4** Recording list rows show page/surah tag and deep-link to reader.
- **AC2.5** Upload still enforces relationship guard; existing tests green.

---

### 2.3 F3 · Self-running revision queue (Sabaq · Sabqi · Manzil)

**Goal:** Compute the daily revision queue automatically from memorized pages and weak-ayah flags.

#### Data model

Use existing `RevisionSchedule` plus the new `PageMemorization`. Add a `source` column to `RevisionSchedule` to distinguish algorithmic vs. teacher-created rows.

```prisma
enum RevisionSource {
  TEACHER
  ALGORITHM
}

model RevisionSchedule {
  ...existing fields...
  source    RevisionSource @default(TEACHER)
  page      Int?           // For algorithmic page-level revisions
}
```

#### Server changes

1. **Pure function** — new `revision-queue.service.ts`:
   - `buildRevisionQueue(userId, date, options?)` over:
     - `PageMemorization` rows with status `MEMORIZED`/`SOLID`.
     - Recency bands: `SABAq` = memorized ≤ 7 days ago; `SABQI` = 8–30 days; `MANZIL` = > 30 days or `SOLID`.
     - Active `WeakAyahFlag` on a page boosts that page one band.
     - Teacher-created `RevisionSchedule` rows appear first.
   - Deterministic sort: overdue manzil first, then sabqi, then sabaq; within a band by `lastReviewedAt` ascending.
   - Unit-test every rule.

2. **Service methods** — extend `revision.service.ts`:
   - `getDailyQueue(userId, userRole, date?)` — returns `RevisionSchedule[]` (algorithmic rows materialized on read if Redis is absent; from cache if present).
   - `markPageReviewed(userId, page)` — upsert `PageMemorization.lastReviewedAt`; archive today's algorithmic revision for that page.
   - `seedAlgorithmicRevisions(userId)` — nightly job materializes the next N days of queues.

3. **BullMQ job** — add `revisionQueue` and `revisionWorker` in `lib/queue.ts`:
   - Daily 04:00 precompute; graceful no-op if Redis absent.

4. **Contracts** — extend `learningContracts`:
   - `getDailyQueue`: `GET /api/v1/revisions/daily-queue`.
   - `markPageReviewed`: `POST /api/v1/revisions/mark-page-reviewed` → body `{ page }`.

5. **Notification integration** — in `notification.service.ts`:
   - New event `REVISION_DUE` fires when the daily queue is generated and the queue is non-empty.

#### Mobile changes

1. **API + hook** — extend `revisionsApi` and `useRevisions`:
   - `getDailyQueue()` / query key `['daily-queue']`.
   - `markPageReviewed(page)` with optimistic update.

2. **Student home** — add "Today's revision" card showing the top 3 pages with deep-links.

3. **Student revisions screen** — add a "Daily Queue" tab.

4. **Teacher roster + parent home** — show revision adherence (pages reviewed / pages queued this week).

5. **i18n** — `todaysRevision`, `sabaq`, `sabqi`, `manzil`, `revisionAdherence`, `markReviewed`, etc.

#### Tests

- Unit tests for `buildRevisionQueue` covering all bands, weak-ayah boost, teacher overrides, determinism.
- Integration tests for Redis and no-Redis paths.
- Mobile: test optimistic removal from today's queue after `markReviewed`.

**Acceptance criteria:**
- **AC3.1** Non-empty deterministic daily queue for any student with ≥ 1 memorized page.
- **AC3.2** Correct order: overdue manzil → sabqi → sabaq; weak pages boosted.
- **AC3.3** Optimistic update on mark-reviewed removes page from today's queue.
- **AC3.4** Teacher-created rows always appear first and are never dropped.
- **AC3.5** Both Redis and no-Redis paths tested and ≤ 100ms cached read.
- **AC3.6** Parent and teacher see revision adherence from same data.

---

## 3. Horizon 2 — Activation & Teacher Leverage

### 3.1 F5 · Role onboarding wizards

**Goal:** New user reaches first meaningful action in ≤ 90 seconds.

#### Schema changes

```prisma
model User {
  ...existing fields...
  onboardingCompletedAt DateTime?
}
```

Migration: add nullable column.

#### Server changes

1. **Contract** — extend `account.contracts.ts`:
   - `completeOnboarding`: `POST /api/v1/account/complete-onboarding` → body `{ step: string, payload: Json }`; marks `onboardingCompletedAt`.

2. **Service** — `account.service.ts`:
   - `completeOnboarding(userId, role, payload)` — idempotent; for student, send greeting message to assigned teacher via existing message service.

#### Mobile changes

1. **New screens** — create `mobile/app/onboarding/` route group with role-specific flows:
   - `student.tsx`: 3 steps — welcome → assigned teacher (or request teacher) → record first page via F2.
   - `teacher.tsx`: 3 steps — welcome → first halaqa or first appointment → review one recording.
   - `parent.tsx`: 2 steps — welcome → request child link.
   - `admin.tsx`: 2 steps — welcome → approve first pending user.

2. **Auth gate** — update `app/_layout.tsx` to redirect un-onboarded users to `/onboarding` after login/registration.

3. **i18n** — full wizard copy in ar+en.

#### Tests

- Integration test: student completes onboarding → message sent, page recording created, revision card visible.
- Mobile: spot-check that wizard redirect works and analytics event fires.

**Acceptance criteria:**
- **AC5.1** Student wizard reuses assigned-teacher derivation from existing appointments screen.
- **AC5.2** Completion leaves student with greeting sent, ≥ 1 page recording, and revision card visible.
- **AC5.3** ≤ 3 steps per role; lands on first-action screen.
- **AC5.4** Onboarding status read-only after completion; analytics event fires.
- **AC5.5** RTL-first, reduced-motion, `check-i18n` clean.

---

### 3.2 F6 · Teacher cockpit rethink

**Goal:** Teacher home becomes a single prioritized "what needs my attention now" list.

#### Server changes

1. **Roster endpoint** — extend `roster.service.ts`:
   - Add `getTeacherCockpit(userId)` returning: pending recordings, due revisions, at-risk students, today's appointments, unread messages.
   - Add `POST /memorization/progress/batch` or return progress inline with roster to avoid N+1 fetches.

2. **Contract** — extend `roster.contracts.ts` with `getTeacherCockpit`.

#### Mobile changes

1. **Teacher home redesign** — rewrite `mobile/app/teacher/home.tsx`:
   - Single prioritized list grouped by urgency.
   - Top actions: review recording, grade student, mark attendance, message student.
   - Inline at-risk chips and page-based progress.

2. **Quick grade** — from `teacher/recordings.tsx` or `teacher/student-detail.tsx`, open a compact grade sheet (≤ 3 taps).

3. **i18n** — `cockpitTitle`, `reviewNow`, `gradeNow`, `attendanceNow`, etc.

#### Tests

- Integration test for `getTeacherCockpit` authz and data shape.
- Mobile `impeccable critique` pass.

**Acceptance criteria:**
- **AC6.1** Single prioritized list on teacher home.
- **AC6.2** Page-anchored review screen (F2).
- **AC6.3** Grade reachable in ≤ 3 taps.
- **AC6.4** At-risk reasons visible without drill-down.
- **AC6.5** No N+1 progress fetches (batched/inline endpoint).
- **AC6.6** Passes `impeccable critique`, `tsc`, `check-i18n`.

---

### 3.3 F7 · Streak-risk nudges + digest surfacing

**Goal:** Use existing digest/notification infra to prevent drop-off.

#### Server changes

1. **Nudge job** — add to `lib/queue.ts`:
   - `streakRiskQueue` running daily at 22:00 local time minus 2h (configurable).
   - Worker checks `Streak.lastActiveDate`; if today is day N of a streak and no activity, fire one `PUSH` notification via `notifyUser` with event `STREAK_AT_RISK`.
   - Guard: max one push per day per user; respect notification prefs.

2. **Digest extension** — update `digest.service.ts::buildWeeklyDigest`:
   - Add `pagesMemorizedThisWeek` from `PageMemorization` deltas.
   - Add `revisionAdherencePct` from F3 queue completion.

#### Mobile changes

1. **Notification handling** — `mobile/src/hooks/useNotifications.ts` recognizes `STREAK_AT_RISK` and `REVISION_DUE` and routes to the right screen.

2. **i18n** — `streakAtRiskTitle`, `streakAtRiskBody`, `revisionDueTitle`, etc.

#### Tests

- Unit test for nudge window logic (no duplicate sends, opt-out respected).
- Integration test for digest extended fields.

**Acceptance criteria:**
- **AC7.1** Max one streak-risk push per day; opt-out respected.
- **AC7.2** Digest includes pages-this-week and revision adherence.
- **AC7.3** Digest idempotency preserved.

---

## 4. Horizon 3 — Acquisition & Academy-Readiness

### 4.1 F8 · Public landing + certificate share image

**Goal:** Make the verify page shareable and acquisition-friendly.

#### Server changes

1. **Schema** — new `AcademyProfile` model:
   ```prisma
   model AcademyProfile {
     id          String @id @default(cuid())
     name        String
     logoUrl     String?
     primaryColor String?
     description String?
     website     String?
     whatsapp    String?
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
   }
   ```

2. **Module** — new `public.module.ts`:
   - `GET /public` → academy profile.
   - `GET /public/certificates/:token/share.png` → generate 1200×630 PNG with achievement + academy branding; 404 if token revoked.
   - Extend verify page HTML with academy branding.

3. **Share link** — update certificate/ijazah generation to produce the public verify URL (already done in 3.3; ensure it points to the branded page).

#### Mobile changes

1. **New route group** — `mobile/app/public/` for the branded verify view (rendered in WebView or as a read-only screen).
2. **Share sheet** — update share action to use WhatsApp-first copy + share image URL.

#### Tests

- Integration test: share image generation, 404 on revoke, size ≤ 200KB.
- Mobile: share sheet uses correct URL.

**Acceptance criteria:**
- **AC8.1** WhatsApp-first share copy.
- **AC8.2** 1200×630 PNG ≤ 200KB.
- **AC8.3** Revoked token → 404 immediately.
- **AC8.4** No extra PII beyond verify page.
- **AC8.5** Public landing renders without auth.

---

### 4.2 F9 · Academy Health one-pager

**Goal:** Single-screen program overview for directors.

#### Server changes

1. **Service** — new `academy-health.service.ts`:
   - Aggregate: total students, active this week, pages memorized this week, revision adherence %, at-risk count, teacher load, completion rate.
   - Cache in Redis with TTL 1h; fallback to DB with ≤ 5s.

2. **Contract** — extend `admin.contracts.ts`:
   - `GET /api/v1/admin/academy-health`.

3. **PDF export** — extend `report.service.ts` to generate academy-health PDF.

#### Mobile changes

1. **Screen** — update `mobile/app/admin/analytics.tsx` or add `mobile/app/admin/academy-health.tsx`:
   - One-pager with large numbers, charts, and PDF export button.

#### Tests

- Integration test: cache hit, ≤ 2s Redis / ≤ 5s no-Redis, PDF ≤ 5s.

**Acceptance criteria:**
- **AC9.1** Aggregate covers all required metrics.
- **AC9.2** Performance and cache assertions.
- **AC9.3** PDF export ≤ 5s.
- **AC9.4** Board-meeting usable.

---

### 4.3 F10 · Admin + Parent + Shared UX rethink

**Goal:** Finish the UX brainstorm gates for remaining screens.

#### Mobile changes

1. **Admin home** — `mobile/app/admin/home.tsx`:
   - Top actions: approve users, broadcast, academy health.

2. **Parent home** — `mobile/app/parent/home.tsx`:
   - Child-summary cards with progress %, streak, next appointment.
   - Quick actions: message teacher, view child's Mushaf page, opt into micro-goal reminders.

3. **Shared** — notifications deep-link to conversation/appointment/grade.

#### Tests

- Mobile `impeccable critique` pass for each screen.

**Acceptance criteria:**
- **AC10.1–AC10.5** as documented in the roadmap file.

---

### 4.4 F11 · Offline resilience for the hifz loop

**Goal:** The daily loop works in weak/no connectivity.

#### Mobile changes

1. **Selective Mushaf cache** — new action in `mobile/app/student/mushaf.tsx`:
   - "Download my Mushaf" prefetches memorized + queued pages using `expo-image` cache with a progress bar.

2. **Mutation persistence** — ensure `setPageStatus` and `markPageReviewed` mutations are persisted by TanStack Query.
   - Add `shouldDehydrateMutation` and resume paused mutations on reconnect.
   - Show "pending sync" badge.

3. **Recording upload queue** — new local queue in `mobile/src/lib/offline-uploads.ts`:
   - Persist failed uploads to MMKV.
   - Retry on reconnect with bounded backoff.
   - User-visible retry/delete from recordings screen.

4. **Read-only screens** — ensure home, grades, and cached Mushaf pages render last-known data offline instead of infinite spinners.

#### Tests

- Mobile manual/device spot-check in airplane mode.
- Unit tests for offline upload queue retry logic.

**Acceptance criteria:**
- **AC11.1–AC11.4** as documented.

---

## 5. Follow-up capabilities (A1–A8)

Not part of the 15-day plan; tracked for re-entry.

| ID | Capability | Re-entry gate |
|----|------------|---------------|
| A1 | Product analytics / event log | Add `Event` model + `trackEvent()`; instrument onboarding + loop events in F5/F6. |
| A2 | Batch teacher actions | After F6; batch mark attendance + grade for halaqa session. |
| A3 | Tajweed / recitation AI scoring | After F2 + signed DPA/budget. |
| A4 | Web admin cockpit | First academy pilot requests it. |
| A5 | Multi-tenancy | ≥ 2 academies signed, after H3. |
| A6 | Teacher voice-note feedback | Add `teacherAudioNoteUrl` to `Recording` after F2. |
| A7 | Parent-led micro-goal reminders | Add `StudentGoal` model after F10. |
| A8 | Teacher pre-session prep sheet | Auto-generate one-pager before each session after F6. |

---

## 6. Sequencing & branch plan

| Branch | Contains | Depends on | Est. days |
|---|---|---|---|
| `fix/migration-baseline` | F4a | — | 0.5 |
| `fix/mushaf-asset-pipeline` | F4b | — | 0.5 |
| `feat/page-memorization` | F1 | F4a | 2 |
| `feat/recite-from-page` | F2 | F1 | 1.5 |
| `feat/revision-queue` | F3 | F1, F2 | 2 |
| `feat/onboarding-wizards` | F5 | F2 | 2 |
| `feat/teacher-cockpit` | F6 | F1, F2, F3 | 2 |
| `feat/streak-risk-nudges` | F7 | F3 | 1 |
| `feat/public-share-image` | F8 | — | 1 |
| `feat/academy-health` | F9 | F1, F3 | 0.5 |
| `feat/admin-parent-ux` | F10 | F1, F3 | 1 |
| `feat/offline-resilience` | F11 | F1, F2, F3 | 1 |

**Critical path:** F4a → F1 → F2 → F3 → F6 → F9.

---

## 7. Definition of done

1. A student's daily loop works end-to-end: revision queue → Mushaf page → record → teacher reviews with page → progress/streak update, with zero manual scheduling.
2. `pagesMemorized/604` is the single progress number across all roles and academy health.
3. New users reach first meaningful action in ≤ 90 seconds.
4. Academy director can pitch from one screen + one share image.
5. Fresh clone + empty DB reaches a running system with one-command steps.
6. All existing test suites green; every new endpoint in authz matrix; `security-reviewer` signs off on F5, F8, F9, F11.
7. Mobile test coverage started: unit tests for new hooks; mobile `tsc` and `check-i18n` in CI.
