# NEW CAPABILITIES ROADMAP — 10x product value (proposed 2026-07-06)

Roadmap artifact: https://claude.ai/code/artifact/e98e733e-d68b-420b-9313-368fa167f7f0 (16 features, 5 phases/stages).
Executing stage by stage, same TDD/branch/commit discipline as the REBUILD track below. Each stage gets its own
feature branch off `main`, merged when its features are green.

## Stage 1 — Close the loop (Q1)

- [ ] 1.1 Recitation Accuracy Scoring — BLOCKED on a vendor/model decision (which ASR/tajweed engine, cost,
      privacy review for children's voice data). Architecture (job queue trigger, score model, teacher-queue
      sort) can be built with a pluggable `RecitationScorer` interface + stub now; real model swap-in is a
      follow-up once the decision is made. Will surface this choice explicitly when reached.
- [ ] 1.2 Shadow-Reading in the Mushaf Viewer — in progress. Confirmed zero backend change needed:
      `mushaf.service.ts`'s `getSurahWithAyahs`/`getPage` already `include` the full `Ayah` row (no narrowing
      `select`), so `audioUrl` is already in the JSON today; `AyahDTO` in shared types already has
      `audioUrl?: string`. Pure mobile UI work, reusing the exact `expo-av` playback pattern from
      `teacher/recordings.tsx` (`Audio.Sound.createAsync` + `soundRef` + `playingId`). Also fixes:
      `mushaf.tsx`'s `/* TODO log memorization */` placeholder (the hook's `logAyah` already exists, unused)
      and three untranslated i18n keys used in that screen (`mushaf`, `ayah`, `pageNumber` — currently render
      as raw keys, not translated text).
- [ ] 1.3 Weekly Parent Digest — not started. Needs a scheduled job (BullMQ, existing graceful no-op pattern)
      + digest query over existing models (SessionRecord, Streak, Grade, Appointment) + delivery via existing
      `notification.service.ts` channels. New: a per-child opt-out flag.
- [ ] 1.4 Teacher Roster Health Dashboard — not started. New contract-driven endpoint aggregating a teacher's
      own roster (reuses the existing accepted-appointment access policy) into at-risk flags; today teacher
      analytics is admin-only and per-student only.

---

# REBUILD 10x — full-codebase strangler rewrite (SPEC APPROVED 2026-07-04)

Spec: `docs/superpowers/specs/2026-07-04-rebuild-10x-design.md`.
Decisions (all user-confirmed): goal = everything (quality+UX+scale) · strategy = strangler in-place · stack = same platform, 10x architecture.
14 milestones M0–M13: characterization-test harness → contract layer → module-by-module server swap → mobile clusters → legacy retirement.
Baseline evidence: 379/379 server unit tests pass (2026-07-05). 127 manifest endpoints (80 v1/top-level + 47 legacy mirrors), 21 models, 37 screens measured.

- [x] M0 characterization harness (2026-07-05) — integration DB + supertest + factory + 127-endpoint × 5-identity authz matrix (647 itests green in ~4s) + envelope pinning + CI `integration` job. Plan: `docs/superpowers/plans/2026-07-04-m0-characterization-harness.md`. Pinned surprise: `GET /users/profile` returns a raw object, not the success envelope.
- [x] M1 contract layer (2026-07-06) — contract DSL + 9 contracts (health + auth) + defineRoute/buildContractRouter + GET /api/health swapped to contract routing + typed client + registry↔manifest parity gate (664 itests, 390 unit tests, tsc clean). Plan: `docs/superpowers/plans/2026-07-05-m1-contract-layer.md`.
- [x] M2a identity: auth + users (2026-07-06) — 13 endpoints swapped to contract routing (v1 + legacy mirrors), behavior pinned first (auth-flows + users-flows itests), contract-router `pre` middleware, legacy controllers/routes/unit-mocks deleted (692 itests, 374 unit tests, tsc clean). Plan: `docs/superpowers/plans/2026-07-06-m2a-identity-auth-users.md`.
- [x] M2b identity: admin + audit log (2026-07-06) — 12 admin endpoints swapped to contract routing (v1 + legacy mirrors) with behavior pinned first; NEW GET /admin/audit-logs viewer + userAgent capture; legacy admin controller/routes/mock tests deleted (737 itests, 366 unit tests, tsc clean). Plan: `docs/superpowers/plans/2026-07-06-m2b-identity-admin-audit.md`. M2 COMPLETE.
- [x] M3 scheduling (2026-07-06) — 8 endpoints (appointments + attendance + teacher-change) swapped to contract routing; 3 teacher-change approval side effects pinned in DB; legacy routes/controllers/mock tests deleted (761 itests, 345 unit tests, tsc clean). Plan: `docs/superpowers/plans/2026-07-06-m3-scheduling.md`.
- [x] M4 learning core (2026-07-06) — 10 endpoints (grades/surahs/memorization/revisions) swapped to contract routing with SM-2 side effects pinned in DB; mushaf API RESURRECTED (3 endpoints mounted at /api/v1/mushaf — mobile reader was 404ing in production); legacy routes/controllers/mock tests deleted (806 itests, 325 unit tests, tsc clean). Plan: `docs/superpowers/plans/2026-07-06-m4-learning-core.md`.
- [ ] M5 media & documents — recordings, reports, files (`?token=` auth pinned), exports. Next: `superpowers:writing-plans` for M5.
Note (for M4): mushaf API is dead code — `app.ts` imports `mushafRoutes` but never mounts it; the module used to crash on load (broken `validate` import, fixed in b31709d). Decide mount-or-delete when M4 rebuilds learning modules; mounting now would change the M0-pinned API surface.
Note: absorbs PR 3 below (TanStack migration continues inside M9–M12).

---

# PR 3 — TanStack Query migration (IN PROGRESS)

Branch: `feat/tanstack-query`. Gate: `cd mobile && npx tsc --noEmit`.
Replaces hand-rolled fetch hooks (useState + manual MMKV cache) with React Query;
fixes the 6 pre-existing `mmkvStorage.getItem` async-vs-sync errors.

## Done (batch 1 — foundation + the 4 buggy hooks)
- [x] `mmkvStorage.getItem` → synchronous (MMKV is sync; AsyncStorage fallback mirrored to an in-memory cache). Fixes settings/store + persist.ts errors.
- [x] `src/lib/queryClient.ts`: QueryClient (staleTime 1m, gcTime 24h) + MMKV `createSyncStoragePersister`.
- [x] `app/_layout.tsx`: wrap tree in `PersistQueryClientProvider`.
- [x] Migrate `useGrades`, `useRevisions`, `useRecordings`, `useAppointments` to `useQuery` + `setQueryData`/`invalidateQueries`. Public APIs preserved (stable zero-arg fetchers) so screens are untouched.
- [x] `tsc --noEmit` → **0 errors** (all 6 pre-existing mmkv errors gone).

## Done (batch 2 — clean-fit hooks)
- [x] Migrate useAnalytics, useCertificates, useMemorization, useGamification, useMessages, useHalaqa, useTeacherChange to React Query (APIs preserved; list filters via internal state + invalidate; socket → invalidate). tsc 0 errors.

## Done (batch 3)
- [x] useNotifications → `useInfiniteQuery` (list) + `useQuery` (unread), optimistic markRead/markAllRead via setQueryData. Also fixes the old latent bug where load-more only ever re-fetched page 2. tsc 0 errors.

## Intentionally left on the old pattern (NOT broken; poor declarative-cache fit)
- useConversation — live socket-managed message thread, not a cached resource.
- useParent — multi-resource (links/children/dashboard) with a derived dashboard + imperative child selection.
- useMushaf — imperative page/surah navigation (fetch-on-demand), not declarative keys.

---

# PR 2 — Gamification reward loop: contrast, semantics, states, i18n (IN PROGRESS)

Branch: `fix/gamification-rewards-a11y`. Scope: mobile. Gate: `cd mobile && npx tsc --noEmit`.
From `/impeccable critique app/student/gamification.tsx` (24/40). Fixes the reward screen + shared MetricTile.

## Tasks
1. **colorize — MetricTile contrast + reward semantics**
   - [ ] `src/components/design.tsx`: MetricTile value → `colors.textPrimary` (was accent on same-hue tint → 1.5–1.9:1 fail). App-wide fix.
   - [ ] `app/student/gamification.tsx`: currentStreak tone `warning`→`gold`; longestStreak `gold`→`primary` (Rationed-Gold: gold marks the live streak).
2. **onboard — empty Badge Wall**
   - [ ] Replace `description=""` with `t('noBadgesYetDesc')` (how to earn the first badge).
3. **harden — leaderboard states**
   - [ ] `src/hooks/useGamification.ts`: add `leaderboardLoading` + `leaderboardError`; stop swallowing fetch errors.
   - [ ] screen: SkeletonCard while loading · EmptyState when empty · error+retry on failure.
4. **adapt — tap targets**
   - [ ] scope chips ≥44pt min-height; chip text `bodySmall`→`labelLarge`.
5. **polish — a11y + i18n**
   - [ ] back button `accessibilityLabel={t('back')}`.
   - [ ] badge date color `textMuted` (2.68:1) → `textSecondary` (4.6:1).
   - [ ] **Add missing i18n keys (ar+en):** gamification, streak, currentStreak, longestStreak, badgeWall, noBadgesYet, noBadgesYetDesc, leaderboard, leaderboardAll, leaderboardMyTeacher, leaderboardEmpty, leaderboardError, back. (All currently render raw camelCase — Arabic users see English.)

## Verify
- [x] `tsc --noEmit`: 0 new errors (only the same 6 pre-existing mmkv async-read errors; none in PR2's 4 files). All 5 steps done.
- [ ] Re-run `/impeccable critique` → score climbs from 24 (pending).

---

# PR 1 — API cycle break, interceptor consolidation, theme selectors (IN PROGRESS)

Branch: `refactor/api-cycle-interceptors-theme`
Scope: mobile only. No behavior change — pure structure + perf. Gate: `cd mobile && npx tsc --noEmit`.

Motivation (from graphify graph of `mobile/`):
- `apiClient` bridges the API layer into 8 screen communities; coupling concentrates above it.
- Import cycle: `api/index.ts → reports.ts → auth/store.ts → api/index.ts`.
- `useSettingsStore` is the #1 god node (79 edges): ~35 screens read the *whole* store, re-rendering on any setting change.
- Interceptors split-brain: request-auth in `client.ts`, 401-refresh in `auth/store.ts`.

## Tasks
### 1. Break import cycle
- [x] `src/auth/store.ts`: import `authApi` from `./auth` (not the `../api` barrel).
- [x] `src/api/reports.ts`: drop `useAuthStore`; read token from `secureStorage` in `downloadReport`.
### 2. Consolidate interceptors
- [x] New `src/api/interceptors.ts`: `installRequestInterceptor`, `installErrorMessageInterceptor`, `installAuthRefreshInterceptor(client, onAuthFailure)` (logout via callback → no new cycle).
- [x] `src/api/client.ts`: use the installers; gate baseURL `console.log` behind `__DEV__`.
- [x] `src/auth/store.ts`: call `installAuthRefreshInterceptor`; remove inline 401 block; preserve order.
### 3. Theme selectors
- [x] `src/settings/store.ts`: add `useThemeSettings()` (`{ theme, darkMode }` via selectors).
- [x] `src/hooks/useTheme.ts`: memoized `{ colors, isRTL, theme, darkMode }` for future adoption.
- [x] Migrate 37 `const { theme, darkMode } = useSettingsStore()` → `useThemeSettings()`.

## Verification
- [x] `cd mobile && npx tsc --noEmit`: my 40 changed/created files add **0** new errors. 6 errors remain, all pre-existing on `main` (proven via stash baseline) — `mmkvStorage.getItem` async-vs-sync in the fetch hooks + `persist.ts` + `loadSettings`. Out of scope; fixed by PR 2's hook rewrite.
- [x] Graph rebuild: import cycles 0 (was 1). No api/* module imports any store.

## Discovered (fold into PR 2)
- `mmkvStorage.getItem` is `async` but `useGrades`/`useAppointments`/`useRecordings`/`useRevisions`/`persist.ts`/`loadSettings` call it synchronously → cache reads are currently broken at the type level. TanStack Query migration removes these call sites entirely.

## Out of scope (follow-ups)
- PR 2: TanStack Query migration of the 15 fetch hooks.
- PR 3: adopt `useTheme().colors`, drop per-screen `getColors` + shared `createStyles`.

---

# 8-Stage UI/UX + Feature Delivery Plan — COMPLETED

All stages executed from `docs/superpowers/plans/2026-06-25-ui-design-improvements.md`.
Final commit: `ae53ef9`.

## Stages

- [x] Stage 1 — UI Foundation Hardening
  - Added `AppText` primitive with Cairo/RTL wiring.
  - Added `SettingsContext` for font/spacing scales.
  - Consolidated color tokens (`borderSubtle`, `grade*`).
  - Fixed `forceRTL` startup reload guard.
  - Fixed `react-native-mmkv` v4 API (`createMMKV`).
  - Swept dashboards for RTL logical props and hardcoded colors.
  - Commit: `bd62c7c`

- [x] Stage 2 — Notification Center (mobile)
  - Wired notification API client + `useNotifications` hook.
  - Built shared `notifications.tsx` screen.
  - Added i18n keys, route registration, bell entry points, unread badge.
  - Commit: `7253a46`

- [x] Stage 3 — Parent Role App
  - Wired parent API client + `useParent` hook.
  - Created parent home + link-request screens.
  - Added parent `BottomNav` support.
  - Added `GET /parents/student-search` server endpoint.
  - Commit: `d7cbc65`

- [x] Stage 4 — Certificates & Gamification (mobile)
  - Wired gamification + certificates API/hooks.
  - Built `student/gamification.tsx` and `student/certificates.tsx`.
  - Added quick-action tiles on student and parent home screens.
  - Commit: `3bf9cbd`

- [x] Stage 5 — Group Halaqa Room
  - Added halaqa API client + `useHalaqa` hook.
  - Created halaqa list + room screens.
  - Added `useWebRTC` signaling scaffold.
  - Added halaqa tabs to all role BottomNavs.
  - Commit: `9fe79e2`

- [x] Stage 6 — Admin Analytics Dashboard
  - Wired analytics API client + `useAnalytics` hook.
  - Built `admin/analytics.tsx` with WAU, surah miss-rate bars, teacher load cards.
  - Added analytics tab to admin BottomNav.
  - Commit: `9fe79e2`

- [x] Stage 7 — Quran Mushaf + Ayah Audio
  - Added `Surah.pages` and `Ayah` model with migration.
  - Created shared ayah types and mushaf validator.
  - Added backend mushaf service/controller/routes + tests.
  - Built mobile `student/mushaf.tsx` reader with page navigation.
  - Commit: `10d75dd`

- [x] Stage 8 — Tech-Debt & Hardening
  - Added accessibility labels/roles and `hitSlop` to new screens and `BottomNav`.
  - Added loading/error/retry states across new screens.
  - Hardened server route mounts with `authenticate` + `standardLimiter`.
  - Commit: `ae53ef9`

## Quality Gates

- `cd mobile && npx tsc --noEmit` → 0 errors.
- `npm run test:server` → 39 suites passed, 358 tests passed.

## Server Environment Notes

- Database: `quran_review` on PostgreSQL localhost:5432.
- Env files created at `packages/server/.env` and repo root `.env`.
- Seed uses dedicated `tsconfig.seed.json` with relaxed compiler flags.
- Migration ledger repaired for idempotent SQL on fresh databases.
