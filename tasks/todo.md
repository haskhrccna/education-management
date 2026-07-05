# REBUILD 10x — full-codebase strangler rewrite (SPEC APPROVED 2026-07-04)

Spec: `docs/superpowers/specs/2026-07-04-rebuild-10x-design.md`.
Decisions (all user-confirmed): goal = everything (quality+UX+scale) · strategy = strangler in-place · stack = same platform, 10x architecture.
14 milestones M0–M13: characterization-test harness → contract layer → module-by-module server swap → mobile clusters → legacy retirement.
Baseline evidence: 379/379 server unit tests pass (2026-07-05). 127 manifest endpoints (80 v1/top-level + 47 legacy mirrors), 21 models, 37 screens measured.

- [x] M0 characterization harness (2026-07-05) — integration DB + supertest + factory + 127-endpoint × 5-identity authz matrix (647 itests green in ~4s) + envelope pinning + CI `integration` job. Plan: `docs/superpowers/plans/2026-07-04-m0-characterization-harness.md`. Pinned surprise: `GET /users/profile` returns a raw object, not the success envelope.
- [ ] M1 contract layer — next: `superpowers:writing-plans` for M1.
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
