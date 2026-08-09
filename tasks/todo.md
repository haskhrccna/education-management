# NEW CAPABILITIES ROADMAP — 10x product value (proposed 2026-07-06)

Roadmap artifact: https://claude.ai/code/artifact/e98e733e-d68b-420b-9313-368fa167f7f0 (16 features, 5 phases/stages).
Executing stage by stage, same TDD/branch/commit discipline as the REBUILD track below. Each stage gets its own
feature branch off `main`, merged when its features are green.

## Stage 1 — Close the loop (Q1)

- [x] 1.1 Recitation Accuracy Scoring — stub architecture (2026-07-07). User chose to defer the ASR/tajweed
      vendor decision (cost + children's-voice-data privacy review needed first) and build the pluggable
      architecture now: `RecitationScorer` interface + `StubRecitationScorer` (recitation-scorer.service.ts,
      always UNAVAILABLE/null), new `Recording.accuracyScore`/`scoreStatus` columns, a BullMQ
      recitation-scoring queue + worker (same graceful Redis-absent fallback as every other job), triggered
      from `uploadRecording`, surfaced as a badge on the teacher review-queue card. Real scoring ships later
      by changing only `getRecitationScorer()` — no caller changes. 837 itests (2 new) / 326 unit tests (1
      new) / mobile+server tsc clean.
- [x] 1.2 Shadow-Reading in the Mushaf Viewer (2026-07-06) — per-ayah play/pause + 0.75x/1x speed, zero backend
      change (audioUrl was already returned, just never consumed). Also fixed 3 untranslated i18n keys used
      in that screen. Scope note: left the pre-existing `/* TODO log memorization */` long-press placeholder
      untouched — it's a separate concern (the memorized-ayah data model is a counter, not a per-ayah set, so
      a persistent per-ayah checkmark isn't representable without a schema change; out of scope for this
      audio-only feature). 806 itests / 325 unit tests / mobile+server tsc clean.
- [x] 1.3 Weekly Parent Digest (2026-07-06) — digest.service.ts (buildWeeklyDigest + sendWeeklyDigests) over
      existing SessionRecord/Streak/Grade/Appointment data, delivered via the existing notifyUser fan-out.
      New ParentLink.digestOptOut column + PATCH /api/v1/parent-links/:id/digest-preference (fresh prefix,
      legacy /api/v1/parents Express router untouched) + BullMQ weekly-digest queue with a Sunday-08:00
      repeatable trigger (ENABLE_WORKERS-gated, same as every other worker). Mobile: opt-out Switch on
      parent/home.tsx. Day/time isn't yet admin-configurable — noted follow-up. 835 itests (14 new) / 325
      unit tests / mobile+server tsc clean.
- [x] 1.4 Teacher Roster Health Dashboard (2026-07-06) — new GET /api/v1/roster/health (TEACHER-only) flags
      2+ consecutive missed sessions, a streak broken this week, or no grade in 14 days; wired into the
      existing (previously unfulfilled) "Students needing attention" section on teacher/home.tsx, with
      StatusPill reason chips and a fallback to the prior all-students view when nobody is at-risk. Thresholds
      are fixed constants for now — admin-configurable thresholds (full AC) is a noted follow-up. 821 itests
      (9 new) / 325 unit tests / mobile+server tsc clean.

## Stage 2 — Deepen the memorization engine (Q2)

- [x] 2.3 Recurring Appointment Slots (2026-07-07) — extracted `bookOccurrence` out of
      `appointment.service.ts`'s `createAppointment` (behavior-preserving refactor, verified against its
      existing unit tests first) so generated occurrences reuse the exact same duplicate/overlap-check —
      "no parallel booking model," per the AC. New `RecurringSlot` model generates a rolling 8-week batch of
      ordinary `Appointment` rows; a conflicting occurrence is skipped, not thrown. `updateRecurringSlot` is
      prospective-only (verified by test). New BullMQ weekly extension job keeps the rolling window moving
      forward indefinitely. 871 itests (10 new) / 326 unit tests / mobile+server tsc clean.
- [x] 2.1 Per-Ayah Weak-Spot Drilling (2026-07-07) — reuses `computeSm2` unchanged at ayah granularity: a
      drill is a `RevisionSchedule` row with `ayahId` set, alongside the existing `ayahId=null` whole-surah
      cards. New `WeakAyahFlag` tracks a consecutive-correct counter; 3 in a row retires the flag automatically
      and stops seeding further drills. Only the manual (teacher-flags) path is wired — automatic flagging
      from low accuracy scores has no data path yet, since `Recording` carries no per-ayah reference and 1.1
      is still a stub. Mobile: drill cards get a distinct badge in both revision queues; teacher gets a
      "flag a weak ayah" mode on the existing add-revision form. 890 itests (7 new) / 326 unit tests /
      mobile+server tsc clean.
- [x] 2.2 Structured Curriculum Plans (2026-07-07) — new `CurriculumPlan`/`CurriculumPlanItem` models; optional
      `planId` FK added to both `Appointment` and `RevisionSchedule` (unused by any UI yet — the ad hoc flow
      is untouched for teachers who never create a plan). Pace (`ON_PACE`/`BEHIND`/`AHEAD`) is computed fresh
      on every read by comparing actual completions to how many items should be done by now. Plan completion
      hooks into `memorization.service.ts`'s existing `transitionedIntoComplete` branch and re-fires the same
      `recordActivity`/`evaluateMilestones` pair every other completion event already uses — no bespoke wiring,
      since 3.2's generalized milestone catalog doesn't exist yet. Mobile: new teacher (create + list) and
      student (read-only) plan screens, linked from both home screens. 915 itests (7 new) / 326 unit tests /
      mobile+server tsc clean.

## Stage 3 — Recognition & trust (Q3, flagship)

- [x] 3.2 Milestone System Generalization (2026-07-07) — new `MilestoneDefinition` catalog (badgeCode,
      triggerType, threshold) replacing `evaluateMilestones`'s hardcoded conditionals; a new milestone is now
      a catalog row, never a deploy. Migration seeds the 5 original milestones. Mobile: admin/milestones.tsx
      (create form + catalog list), linked next to Broadcast. 934 itests (7 new) / 327 unit tests /
      mobile+server tsc clean.
- [x] 3.1 Ijazah/Sanad Progress Tracking, flagship (2026-07-07) — new `Ijazah` model: a teacher formally
      endorses a student's completed surah/juz/full-Quran, verified against real `MemorizationProgress`
      completion (reusing the exact queries already used elsewhere — no new tracking invented).
      `chainIjazahId` self-relation builds a real sanad when the endorsing teacher's own certifying ijazah is
      in-system; `teacherChainRef` free-text fallback otherwise. Every issuance re-fires
      `recordActivity`/`evaluateMilestones`, wiring up 3.2's previously-stubbed `IJAZAH_ISSUED` trigger for
      real. Writes to the existing `AuditLog` table (`lib/audit.ts`) for admin program-wide audit. Mobile:
      teacher issuance form + student gold-accented ijazah view (Rationed Gold applies — genuine earned
      achievement). 960 itests (8 new) / 327 unit tests / mobile+server tsc clean.
- [x] 3.3 Shareable, Verified Certificates (2026-07-07) — `Certificate` and `Ijazah` both gained a stable
      `verificationToken` + `active` flag. `GET /api/v1/verify/:token` is a deliberately public, no-login HTML
      page (not JSON, not behind `authenticate`) showing only the achievement, endorsing teacher, and program
      name. Regenerating a link IS the revoke — the old token stops resolving the instant a new one replaces
      it; ownership-checked via the same not-found-and-not-yours precedent used throughout this rebuild.
      Mobile fix: the pre-existing certificate Share button was leaking a live JWT in the shared PDF URL —
      now shares the public verify link instead. 985 itests (8 new) / 327 unit tests / mobile+server tsc
      clean.
- [x] 3.4 Halaqa Group Streaks (2026-07-07) — new `HalaqaGroup`: a persistent named halaqa that live
      `HalaqaRoom` sessions can belong to, carrying a collective streak (consecutive sessions meeting a
      configurable `attendanceThreshold`) recomputed only when a session ends — best-effort, isolated
      try/catch, same convention as every other secondary side effect. Verified in the itest that it never
      touches the `Streak` table or an individual's personal streak/leaderboard. Mobile: group picker +
      inline quick-create on the room-creation card; a gold streak badge shown only on the room screen
      itself. 1005 itests (5 new) / 327 unit tests / mobile+server tsc clean.

Stage 3 complete — all 4 features green. Ready to merge `feat/roadmap-stage3` into `main`.

## Stage 4 — Trust & reliability (Q4)

- [x] 4.1 Guardian Consent Flow (2026-07-07) — new `GuardianConsentStatus` on `User`, deliberately separate from
      `ParentLinkStatus` (which verifies WHO the parent is — this tracks whether they consent to the specific
      data processing, recitation voice recordings, for their child). Opens to PENDING as a best-effort side
      effect of `approveLink`. `PATCH /api/v1/parent-links/:id/consent` (PARENT-only) grants/declines.
      `uploadRecording` blocks only when a parent link exists AND consent isn't GRANTED — a student with no
      parent link at all is completely unaffected, so this can never lock a student out where the platform has
      no guardian contact on file. Mobile: a card on `parent/home.tsx` next to the digest toggle. 1019 itests
      (8 new) / 327 unit tests / mobile+server tsc clean.
- [x] 4.2 Retention & Data Portability (2026-07-07) — `GET /api/v1/account/data-export`: everything the
      platform holds about the caller (appointments, grades, recordings, memorization, revisions, messages,
      certificates, ijazahs, streak, parent links — both directions where applicable), strictly scoped to the
      caller's own userId. `DELETE /api/v1/account`: self-service deletion reusing the existing admin
      anonymization exactly (no new deletion logic to keep in sync). Marked `skip` in the authz matrix since it
      destroys the calling identity itself — covered by its own itest instead. Mobile: new shared `/account`
      screen linked from all 4 home screens. 1029 itests (3 new) / 327 unit tests / mobile+server tsc clean.
- [x] 4.3 Offline-First Reliability (2026-07-07), mobile-only — the persisted query cache
      (`PersistQueryClientProvider` + MMKV) was already wired from the earlier TanStack Query migration; the
      real gap was React Query's `onlineManager` defaulting to browser online/offline events (nonexistent in
      React Native), silently assuming "always online" so paused queries/mutations never resumed on reconnect.
      Added `@react-native-community/netinfo` backing `onlineManager` with real device connectivity (the
      official RN recipe), mutation persistence (`shouldDehydrateMutation` + `resumePausedMutations()` on
      restore) so a mutation made offline survives an app kill, and a small always-mounted `OfflineBanner`.
      No backend change — server regression unaffected (327 unit tests green); mobile tsc clean.

Stage 4 complete — all 3 features green. Ready to merge `feat/roadmap-stage4` into `main`.

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
- [x] M5 media & documents (2026-07-10) — 12 endpoints (recordings/reports/files/exports) swapped to contract routing with behavior pinned first (media-flows itests incl. `?token=` file auth + CSV header rows); contract DSL gained `rawResponse()` (non-JSON: sendFile/CSV) + `authVia: 'headerOrQueryToken'` (fileAuthenticate in the contract); report controller logic moved into report.service, file download resolvers extracted to file.service; legacy routes/controllers/mock tests deleted (1060 itests, 309 unit tests, tsc clean server+shared). Plan: `docs/superpowers/plans/2026-07-10-m5-media-documents.md`.
- [x] M6 communication (2026-07-10) — 7 endpoints (messages ×3 + notifications ×4) swapped to contract routing with behavior pinned first; the GET /messages dual response shape is expressed as a contract union and pinned structurally in communication-flows itests; broadcast + FCM device-token were already contract-routed in M2b/M2a; notification 404 mapping moved controller→handler; legacy routes/controllers/mock tests deleted (1077 itests, 298 unit tests, tsc clean server+shared). Plan: `docs/superpowers/plans/2026-07-10-m6-communication.md`.
- [x] M7 progress & rewards (2026-07-10) — 11 endpoints swapped (gamification 2, certificates listing folded into the existing module, analytics 1, parents 6); certificates dual-mount collapsed to a single contract mount; manual body validations preserved with pinned messages; legacy routes/controllers/mock tests deleted (1094 itests, 281 unit tests, tsc clean server+shared). Plan: `docs/superpowers/plans/2026-07-10-m7-progress-rewards.md`.
- [x] M8 halaqa realtime (2026-07-10) — 8 HTTP endpoints swapped (LAST legacy Express router retired; only docs/metrics/verify utility mounts remain for M13); Socket.IO room/WebRTC-signaling/presence protocol pinned with its first-ever tests (handshake auth, join/leave attendance + broadcasts, pure-relay offer/answer/ICE, disconnect auto-leave). Pin exposed + fixed a latent bug: auto-leave listened on 'disconnect' where socket.rooms is already empty — never ran in production; now on 'disconnecting' (1113 itests, 281 unit tests, tsc clean server+shared). Plan: `docs/superpowers/plans/2026-07-10-m8-halaqa-realtime.md`.
- [x] M9 mobile foundation (2026-07-10) — typed contract client wired for RN (secure-storage auth fetchImpl + single-flight 401 refresh) with gamification as the pilot domain; useTheme() adopted across all 46 getColors call sites (palette derivation now memoized in one hook + ThemeColors type); 63-key i18n gap closed in BOTH ar+en (notifications/halaqa/certificates/parent/analytics screens no longer render raw keys) with a permanent `npm run check-i18n` guard; TanStack offline stack verified intact from 4.3 (mobile tsc 0 errors; check-i18n OK; server untouched). Plan: `docs/superpowers/plans/2026-07-10-m9-mobile-foundation.md`. NOTE: device smoke test of the shared-package runtime import (gamification screens) recommended before release.
- [x] M10–M12 mechanical halves (2026-07-11) — typed contract client adopted across the ENTIRE mobile API layer, cluster by cluster: M10 student (grades, memorization, revisions, mushaf, certificates, account, teacherChange), M11 teacher (appointments, attendance, roster, weakAyahs, curriculumPlans, recurringSlots, ijazahs, reports, recordings JSON endpoints), M12 admin/parent/shared (users, notifications, messages, parents, milestones, analytics, halaqa). 23 modules migrated with public signatures unchanged (hooks/screens untouched); axios remains ONLY for the documented holdouts: auth flows (store-coupled) and multipart recording upload; browser/PDF URL builders now use API_ORIGIN (mobile tsc 0; check-i18n OK; server untouched). Plan: `docs/superpowers/plans/2026-07-10-m10-m12-typed-client-adoption.md`. NOTE: one device smoke test (login → one migrated screen per role) validates the shared fetch path before release.
- [x] M13 retirement & hardening (2026-07-11) — legacy /api/* mirrors RETIRED (10 mounts + manifest/inventory derivations + 10 explicit pins; matrix now the canonical 80-endpoint surface, suite 1113→864 green); dead-code sweep (successResponse removed); `npm run perf` load test with local budgets (health p95 2ms @ ~15k rps, authed read p95 6ms @ ~3.9k rps, zero errors); final security review at `docs/security/2026-07-11-m13-security-review.md` — one High finding (file-download JWTs persisted in request logs) FIXED via URL redaction; 5 Medium/Low recommendations recorded. Plan: `docs/superpowers/plans/2026-07-11-m13-retirement-hardening.md`.

**REBUILD COMPLETE (M0–M13, 2026-07-04 → 2026-07-11):** old codebase used as spec → 864-test characterization suite over a real DB · 106-contract typed API layer (single source of truth server+mobile) · 27 contract modules, zero legacy controllers/routes · socket protocol pinned · mobile on the typed client with theming/i18n foundations + guards · legacy surface retired · load-tested · security-reviewed. Remaining (user-gated): the three per-cluster UX mini-brainstorms below, one device smoke test, axios-holdout retirement decision.

- [ ] M10 UX mini-brainstorm (user) — student cluster, 10 screens: per spec §6 the UX rethink is fenced into a brainstorm with the user, not open-ended. Run `superpowers:brainstorming` together, then plan+execute the agreed changes.
- [ ] M11 UX mini-brainstorm (user) — teacher cluster, 7 screens (same fence).
- [ ] M12 UX mini-brainstorm (user) — admin + parent + shared, 12 screens (same fence).
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
- [x] H1 Hifz Engine (2026-07-19, branch feat/h1-hifz-engine) — roadmap `2026-07-16-10x-roadmap.md` F1–F4. Gates: 304 unit + 900 integration tests green, tsc clean (server/shared/mobile), check-i18n OK, `scripts/verify-migrations.sh` green. AC proof map:
  - AC1.1–1.2 reader chips + single-fetch statuses (`useMushafPages`, hifz-engine.itest F1); AC1.3 pages/604 on student home + teacher student-detail + parent card (`derivePageProgress` single source); AC1.4 guard itests (cross-student 403, assigned-teacher 200); AC1.5 additive migration + ledger green; AC1.6 MEMORIZED/SOLID stamp lastReviewedAt (unit + itest)
  - AC2.1 mic on reader → tagged upload (itest echo); AC2.2 review modal renders the recited page, legacy nulls regression-pinned (media-flows untouched); AC2.3 one-tap weak-ayah flag from the page's ayah list; AC2.4 page tags on rows (student rows deep-link; teacher tag display-only — /student/* routes are role-gated); AC2.5 media-flows green untouched
  - AC3.1 pure deterministic buildRevisionQueue (8 unit tests incl. exact-array + double-run); AC3.2 band ordering + weak boost unit-tested; AC3.3 reviewed→optimistic removal (hook) + itest queue-drop; AC3.4 override-first itest; AC3.5 compute path itested; cached path via in-process LRU (see deviations); AC3.6 adherence on teacher/parent surfaces
  - AC4.1 fresh `migrate deploy` builds full schema (harness + itest globalSetup now uses migrate deploy every run); AC4.2 db push removed from toolchain + docs; AC4.3 DEPLOYMENT.md populate path; AC4.4 fail-loud production start; AC4.5 static smoke itest (1/604/immutable/404)
  - **Conscious deviations:** (a) F3 nightly precompute → in-process LRU cache-aside with write-invalidation (single-node deploy; Redis version is a deploy-time follow-up); (b) AC4.1 "CI on every PR" limited — the workflow lives under `education_management/.github/` but the git root is the parent `opencode/`, so GitHub Actions never runs it (ask user: copy to repo root?); (c) teacher recording page-tag is display-only (role-gated routes)
  - **Found during work:** stray branch `fix/migration-baseline` was created from this branch's tip during a session gap (not by this work); left untouched.
- [x] H2 Activation & Teacher Leverage (2026-07-20, branch feat/h2-activation) — roadmap F5–F7. Gates: 308 unit + 910 integration green, tsc clean ×3, check-i18n OK, ledger green. AC proof map:
  - F5: `User.onboardingCompletedAt` + idempotent POST /account/complete-onboarding (registry 111; activation.itest); auth gate routes un-stamped active student/teacher/parent to /onboarding/<role> (admin exempt); student wizard welcome→teacher(Say-Salaam deep link / unassigned fallback AC2.1.3)→record-first-page via mushaf ?record=1 (one recorder path, AC2.1.4); teacher wizard welcome→admin-assignment explainer+live roster→optional first plan (skip stamps, AC2.2.2); parent wizard APPROVED auto-complete (AC2.3.2) else link-request reuse (AC2.3.3)
  - F6: teacher home = Today-first cockpit (today's sessions + one-tap Grade ≤3 taps S1-AC2 + Review chips; pending-reviews card; at-risk top-3 with reason chips S1-AC1/AC3); roster rows show X/604 + due-today (AC6.2); review queue self-sorts needs-attention-first (S1-AC5/AC6.1); S1-AC4 verified already met (plans one-tab create+items+assign)
  - F7: pure shouldNudge (evening ≥20:00, once/day) + sendStreakNudges via notifyUser + daily 20:00 BullMQ cron; digest gains pagesMemorizedThisWeek + revisionDueToday (buildRevisionQueue reuse), send-once pin intact (AC7.3)
  - **Deviations:** (a) onboarding stamp surfaced via login/profile payloads, NOT the pinned JWT (user-approved); (b) teacher wizard adapted to the admin-assigns model — stage-2 "add first student" replaced by "first plan or conscious skip"; (c) AC7.1 opt-out → notification-row dedupe only (no prefs infra; follow-up); (d) S1-AC7 impeccable-critique skipped (skill unavailable); (e) nudges inactive without Redis (queue-lib convention); (f) login-body pins in contract-schemas/contract-client extended additively.
  - Added accessibility labels/roles and `hitSlop` to new screens and `BottomNav`.
  - Added loading/error/retry states across new screens.
  - Hardened server route mounts with `authenticate` + `standardLimiter`.
  - Commit: `ae53ef9`

- [x] H3 F8 — Public Landing & Certificate Share Image (2026-07-26, branch feat/public-share-image, repo now standalone at github.com/haskhrccna/education-management) — plan `docs/superpowers/plans/2026-07-23-f8-public-share.md`. Gates: 311 unit + 947 integration green, tsc clean ×3, check-i18n OK (315 keys, ar/en 396), migration ledger green, CI green on `main`. AC proof map:
  - AC8.1 WhatsApp-first share: `certificates.tsx`/`ijazahs.tsx` `handleShare` tries `whatsapp://send` before falling back to the system share sheet, still sharing only the safe verify link (never the JWT-bearing download URL — regression-checked against the pre-existing fix for this exact leak)
  - AC8.2 `GET /api/v1/public/verify/:token/share.png` — 1200×630 PNG ≤200KB via `@resvg/resvg-js` (SVG→PNG, no headless browser); `public-surface.itest.ts` pins PNG signature, exact IHDR dimensions, and a `>15KB` lower bound (added after final review caught the font bug below)
  - AC8.3 revocation immediacy: `renderShareImage` calls `verifyToken()` before any cache read, so a rotated or revoked token 404s even against a warm cache (itested both ways); regenerate-link now also evicts the old token's cached PNG
  - AC8.4 zero PII beyond the existing verify page: `buildShareSvg` only ever sees `VerificationResult` fields; every interpolated string is XML-escaped (unit-tested)
  - AC8.5 `GET /api/v1/public/academy/:slug` public, no auth; mobile `(public)/academy/[slug]` route group sits outside `protectedRoots`
  - AC3.1/3.6 admin can edit the academy profile (`GET`/`PUT /api/v1/admin/academy-profile`); ADMIN-gated at contract+manifest+route layers, audited via the existing `auditLog()`
  - **Conscious deviation:** `@resvg/resvg-js` instead of the spec's `puppeteer-core` suggestion — no Chromium runtime dependency; the spec's own risk table had flagged this as needing confirmation.
  - **Caught only by final whole-branch + security review** (per-task review structurally couldn't see either, since they live between tasks): (a) the share PNG rendered **completely blank in production** — Alpine ships no fonts, and resvg silently drops all `<text>` nodes rather than throwing when `loadSystemFonts: true` finds none; fixed by bundling `Cairo-Variable.ttf` into `packages/server/assets/fonts/` (copied into the Docker runner stage) and switching to `fontFiles`/`loadSystemFonts: false`; (b) `og:image` was a host-relative path, so WhatsApp/Facebook would never have rendered the preview — fixed with a new `PUBLIC_API_URL` config (mirrors `CLIENT_URL`'s pattern; deliberately not derived from `req.get('host')`, which is Host-header-spoofable).
  - Also fixed from the same review pass: public-profile serializer switched from strip-known-bad to an explicit Prisma `select` + `.strict()` Zod schema (fail-closed instead of fail-open on future model fields); share-image cache read collapsed from a 3-syscall TOCTOU race to one try/catch; `logoUrl` validator now rejects non-`https://` schemes (was accepting `javascript:`); RTL fix (`marginEnd` not `marginRight`) in the new admin editor screen.
  - **Follow-ups (non-blocking per final review's explicit "ready to merge" verdict):** bundled font is regular-weight only — `font-weight="bold"` is a silent no-op on the variable font face, so the share card's title/name render flatter than the dev-machine preview showed (needs a bundled bold face); `PUBLIC_API_URL` validates presence but not URL shape; `logoUrl` is fully wired through the schema/contracts but has no admin UI to set it or anywhere that renders it yet.
  - Server split into its own repo mid-session (`github.com/haskhrccna/education-management`, private) with full history preserved via `git filter-repo` — the prior monorepo's CI workflow lived under a path GitHub Actions never read from, so this was the actual fix for that dead-CI gap. First real CI runs then surfaced (and this session fixed) 6 more previously-invisible bugs: `queue.ts`'s Redis "graceful degradation" that wasn't (bounded retries + try/catch added), a missing `prisma generate` step in the server CI job, a `migrate diff` path bug (`npm exec --workspace` changes cwd), a too-short test `JWT_SECRET`, ~1000 packages of accidental Expo/React-Native dependencies in the server package (traced to a committed `packages/server/ios/` Xcode scaffold, now deleted), and an `npm audit` gate scoped to the whole shared lockfile instead of the server's own risk surface (mobile's real Expo SDK has an unrelated `postcss` finding requiring a major-version bump, tracked separately, explicitly allowlisted with a dated comment).

- [x] H3 F9 — Academy Health One-Pager (2026-07-27, branch feat/academy-health) — plan `docs/superpowers/plans/2026-07-26-f9-academy-health.md`. Gates: 320 unit + 965 integration green, tsc clean ×3, check-i18n OK (321 keys, ar/en 402), migration ledger green (no schema change — pure read). AC proof map:
  - AC9.1 `GET /api/v1/admin/academy-health` returns all 7 required metrics (total students, active this week + rate, pages memorized this week, revision adherence %, at-risk count, teacher load, completion rate) — every field's presence and correctness itested; every Prisma field/relation/enum name independently verified against `schema.prisma` (no invented names)
  - AC9.2 1h Redis cache-aside via the now-fixed `lib/redis.ts` (see prerequisite fix below), graceful fallback to a live DB computation when Redis is absent; cache-hit itest guarded by a runtime `getRedis().ping()` check (CI's integration job has no Redis service, so this degrades to a logged skip there rather than flaking — the underlying cache-aside *logic* is separately proven by mocked unit tests regardless of Redis availability)
  - AC9.3 in-memory PDF export via `pdfkit` — no disk persistence (grep-confirmed zero `fs`/path usage); a reviewer decompressed the generated PDF's actual content stream and confirmed all 9 metric fields render as real text, not just inferred from source
  - AC9.4 board-meeting-usable screen: large stat cards (not a dense table), high-contrast text throughout (a real WCAG AA failure was caught and fixed twice in this pass — see below)
  - **Documented interpretation (flagged, not yet confirmed by user):** "completion rate" = academy-wide attendance completion rate (`PRESENT`+`LATE` ÷ all session records) over the last 7 days — no existing metric definition covered this; a different definition (e.g. % reaching a memorization milestone) may have been intended.
  - **Caught only by final whole-branch + security review** (both independently found the same bug): the PDF export's `?token=` query-auth path — the ONLY auth path the mobile export button can actually use, since `WebBrowser.openBrowserAsync()` can't attach an `Authorization` header — was dead. `/api/v1/admin` is mounted behind a blanket header-only `authenticate` that ran before the contract-level `fileAuthenticate` ever got a chance to accept the query token; every real export attempt 401'd despite the itest suite being green (the itest only ever used a Bearer header). Fixed by moving the endpoint to `GET /api/v1/files/academy-health.pdf` — the mount already built for exactly this pattern (3 existing `authVia: 'headerOrQueryToken'` file-download contracts) — without touching `/api/v1/admin`'s mount (would have weakened 17 other admin routes' auth and broken `adminLimiter`'s user-keyed rate limiting). Live-proved post-fix: `?token=` alone, no header → 200 PDF.
  - Also fixed from the same review pass: at-risk count was inflated (counted every unapproved/never-graded student regardless of enrollment, so a single pending signup could read 100% at-risk) — rescoped to students with an ACCEPTED appointment, matching what "enrolled" means everywhere else in this codebase; the at-risk threshold constants were duplicated as bare literals instead of imported from `roster.service.ts` (now exported and shared, closing a drift risk); a WCAG AA contrast failure on the at-risk stat card (1.92:1, needs 3:1) — then a **second** AA failure was introduced by the very same fix pass's new "as of `<time>`" freshness line (4.23:1, needs 4.5:1) and caught by the re-review, fixed in a follow-up commit; itests were contaminated by an un-invalidated Redis cache across test runs (added `cacheDelete` to `beforeEach`).
  - **Prerequisite fix (before F9 work started):** `lib/redis.ts`'s cache client had zero callers until F9 and carried the exact same unbounded-retry bug already fixed in `queue.ts` earlier this session — fixed with the same pattern (bounded retries, `enableOfflineQueue:false`, short `connectTimeout`) before building on top of it.
  - **Noted, not fixed (out of scope, explicitly non-blocking per re-review):** integration-suite flakiness in 3 unrelated pre-existing test files, traced to a documented keep-alive connection-reuse issue already called out in `authz-matrix.itest.ts`'s own comments — not caused by this branch; `academy-health.itest.ts` itself passed 6/6 in every run. Filed separately for follow-up.

- [x] H3 F10a — Admin UX Rethink (2026-07-29, branch feat/admin-ux-rethink, merged via PR #1) — plan `docs/superpowers/plans/2026-07-28-f10a-admin-ux-rethink.md`; spec `docs/superpowers/specs/2026-07-27-admin-ux-rethink-design.md`. Executed via subagent-driven-development, 8 tasks each with implementer + independent reviewer. Gates on merged `main`: 320 unit + 973 integration green, tsc clean (server+mobile), check-i18n OK (351 keys, ar 442/en 438, 245 inline ternaries — down from 260 baseline, 5 ambiguous labels), lint 0 errors (67 pre-existing warnings). AC proof map:
  - AC5.1 admin home is a true one-pager: unified pending-approvals summary card (teacher-change + parent-link + student-account counts combined) + MetricTile row + grouped "Academy" nav-card grid, replacing a flat button row and an inline approval queue; all three approval types now live on one Approvals screen behind filter chips with type-appropriate decision UI (teacher-change can never bypass the teacher-picker — traced end-to-end twice, once per-task and once in final review — since approval reassigns appointments server-side)
  - AC5.2 audit-log viewer filterable by actor (name/email search-and-select), action, resource type, and date range, server-side paginated (`paginate(20,100)` bounded, never client-side full-list) — the actor filter was originally omitted from the plan's own Task 5 code, caught by the controller mid-execution (not by either subagent review) and closed in a follow-up commit before the final review ran
  - Real bugs found and fixed along the way, none of them things the plan or spec predicted: a response-envelope double-unwrap on admin home that had shipped 0/0/0 for students/teachers/pending; Hermes ships with no `Intl.PluralRules` at all (verified against the shipped binary, not assumed) — polyfilled with `intl-pluralrules`, verified live on device across all 4 Arabic CLDR categories; the admin bottom-nav's Broadcast tab was labelled "Notifications" in Arabic and "Broadcast" in English; a bidi bug on Academy Health's teacher-load rows (`0Sarah Khalil`) from a Latin name resolving LTR inside an RTL flex row
  - **Caught only by final whole-branch + security review** (dispatched in parallel, both Opus; both initially failed on an account spend-limit error and were re-dispatched once the limit was raised): I1 the admin-home pending count read the same unpaginated-`/admin/users` bug pattern already fixed one screen over, just not propagated; I2 two data sources (teacher-change load, parent-link count) failed silently into an empty/zero state instead of an error banner; I3 the audit-log `dateTo` filter excluded the selected day entirely (date-only string parsed as midnight UTC); I4 partial date input in the filter fired 400s or, worse, silently queried the wrong window
  - **Security review (WARN, 0 Critical/High, 3 Medium):** SEC-M1 the audit trail (actor PII + IP + user-agent) persisted unencrypted on-device via the react-query MMKV cache and survived logout; SEC-M2 approving a parent-link or teacher-change — the two most consequential admin grants in the system — wrote no audit-log entry at all, invisible in the branch's own new viewer; SEC-M3 no `trust proxy` configured, so `req.ip` (displayed to admins as audit evidence) would be a reverse proxy's address in any real deployment, not the actor's. Everything else explicitly checked and confirmed clean: IDOR/access-control (structurally enforced via a registry-parity + authz-matrix test pair, not just asserted), injection, XSS, crypto, auth, rate limiting, secrets, mass assignment, supply chain (`intl-pluralrules` inspected at the source level — zero deps, no install scripts, no eval/network).
  - **Fix pass and re-review:** user explicitly scoped the fix pass to the 7 must-fix findings only (4 Important + 3 Medium), deferring 12 Minor + 5 Low + Informational to the ledger. A dedicated re-review independently re-verified all 7 as genuinely fixed (traced Fix 2's error state to the actual banner JSX, confirmed Fix 3/6's tests query the read-side endpoint rather than the write-side response) — and caught one regression the fix pass itself introduced: the SEC-M1 privacy fix had replaced react-query's default persistence predicate (`status === 'success'`) instead of composing with it, so failed/in-flight queries started persisting app-wide, colliding with Fix 2's own new error banner (a stale error would hydrate back on cold start and flash spuriously). Fixed with the reviewer's exact one-line prescription, verified via tsc/lint/check-i18n rather than a third review round (cost judgment call, flagged to the user rather than silently skipped).
  - **⚠️ Flagged for a human decision, not resolved by this work:** `app.set('trust proxy', 1)` is a single-reverse-proxy default that has **not** been verified against the actual production deployment topology — the wrong hop count either misattributes `req.ip` in audit logs or (if ever changed to `true`) lets an admin forge their own audit IP via `X-Forwarded-For`. Called out at the top of PR #1; needs confirming before production deploy.
  - **Deferred, not in this work (recorded in full, file:line, in `.superpowers/sdd/progress.md`):** 12 Minor + 5 Low + Informational findings across both reviews and the re-review — asymmetric student-account-approval UI (no Deny), a parent-link approve note silently discarded server-side, the `goldMuted`/`warningLight` theme-color collision noted separately, a stale-privilege-window auth pattern this branch slightly widened but didn't introduce, and several UI rough edges (mismatched error-banner i18n key, date-input mid-edit desync). None rated blocking by any reviewer.
  - **Also recorded separately (not this branch's scope):** the i18n gate itself was hardened mid-session — before this work, `check-i18n.js` was structurally blind to the ~260 inline `isAr ? 'ar' : 'en'` ternaries carrying roughly a third of the app's user-facing strings, which is exactly where two live bugs (a duplicated Arabic card title on teacher home, a missing plural form) were found on a manual device walkthrough. Gate now ratchets that count and a same-Arabic-different-English collision count, both baselined and must only fall. Full writeup: `docs/superpowers/specs/2026-07-28-i18n-integrity-design.md`. F10b (Parent) and F10c (Shared) specs exist (`docs/superpowers/specs/2026-07-27-{parent,shared}-ux-rethink-design.md`) but have no plan or execution yet.

- [x] H3 F10b — Parent UX Rethink (2026-07-29, branch feat/parent-ux-rethink) — plan `docs/superpowers/plans/2026-07-29-f10b-parent-ux-rethink.md`; spec `docs/superpowers/specs/2026-07-27-parent-ux-rethink-design.md`. 8 tasks, executed sequentially in this session. Gates: 320 unit + 997 integration green, tsc clean (server+mobile), check-i18n OK (369 used keys, ar 467/en 463, 239 inline ternaries — down from 245 baseline, 5 ambiguous labels, unchanged), lint 0 errors (64 pre-existing warnings, unchanged set). AC proof map:
  - **AC5.3** (parent home is the child's summary, one card per linked child with today's session/last grade/streak/action chips, M4.1 consent inline) — Task 5's stacked `ChildCard`s (`mobile/app/parent/home.tsx`) replace the old selector+single-panel; `todaysAppointment()` and `dashboard.grades[0]` read data Task 1 already provides (no new fetch); streak is new in Task 1, rendered via `MetricTile tone="gold"` — the card's one legitimate gold element, since a memorization streak is exactly the "earned achievement" the Rationed Gold rule reserves gold for; consent/digest toggles relocated unchanged into the card. Tasks 6-7 make "View report"/"View recordings" actually functional — previously unimplementable, since no parent-scoped read path existed at all (`child-reports.tsx`, `child-recordings.tsx`, both routed from the card's action chips). "Send message" resolves the child's teacher via `dashboard.student.assignedTeacher`, added to `childDashboard` in Task 1 — previously there was no teacher-id source on this response at all.
  - **AC5.5** (screens pass the mobile gates) — this task's Step 6: tsc/lint/check-i18n all clean, zero regressions.
  - **Task 8 audit finding (link-request.tsx):** the file was already close to full DESIGN.md compliance — `AppText` used throughout with no raw `<Text>`, the search/reason card already hairline-bordered via `AppCard`, the header back button already ≥44pt with `hitSlop`, no gold anywhere, and all feedback routed through `Alert.alert` (title+message, never color-only). One real gap found: the submit button's touch target was sized only from padding + `AppText`'s computed line-height, which drops to 41pt (below the DESIGN.md ≥44pt minimum) at the app's smallest font-scale setting (0.85×) — unlike the sibling Task 6/7 screens' action buttons, which set `minHeight: 44` explicitly. Fixed with the same `minHeight: 44` + `justifyContent: 'center'` pattern; no other changes were needed, so none were made.
  - **Note on the spec's stated scope:** the spec's "Files Changed" table said `mobile/src/api/*` needed only a "possible small addition" and its "Scope" line claimed "No server changes." Neither held up under a code audit — three real gaps existed, all closed in Tasks 1-2 of this branch: (1) `childDashboard` exposed neither a child's teacher nor their streak — both required by AC5.3's card and neither derivable client-side; (2) no parent-scoped list endpoint existed for reports or recordings — `listReports`/`listRecordings` had no `PARENT` branch, and the mobile client's pre-existing `studentId` param on `reportsApi.getReports` was a provable no-op, since the server handler never read `query` at all; (3) even a parent who could see a recording/report's existence would 403 trying to download it — `resolveRecordingDownload`/`resolveReportDownload` in `file.service.ts` checked owner/admin/teacher only, with no `PARENT` branch whatsoever. All three fixed via the same `assertParentHasApprovedLink` guard `childDashboard` already established as this feature's one invariant.
  - **Deferred, not in this work:** the spec's F10c (Shared) work is untouched by this branch. Task 5's `MetricTile tone="gold"` streak display was not itself re-audited against every other screen's gold usage — out of scope for Task 8, which was limited to `link-request.tsx`.

  **Fix pass (post-review, 2026-07-30):** the final whole-branch review found 2 Critical issues in the above — "today's session" never matched due to a DateTime-vs-date-string comparison bug (always false, in every timezone, not a timezone edge case), and "Send message" 403'd because the messaging service had no PARENT-role authorization path at all. Both are now fixed: see commits for "today's session" / DateTime bug and "parents can message their child's assigned teacher". Also fixed in the same pass: per-child dashboard fetch failures are now surfaced instead of silently rendering as empty facts (I1); the two new list endpoints are capped at 100 rows (I3); an approved parent link can now be revoked by an admin, closing a previously-permanent access grant (SEC-M1); a demoted user's role now takes effect immediately rather than surviving until token expiry (SEC-M3); parent downloads of a child's recording/report are now audit-logged (SEC-M4). Deviations: SEC-M1 also required adding `REVOKED` to `ParentLinkRow`'s status enum in `progress.contracts.ts` (the brief expected no contract change — the response schema enumerates the status, so the server would not typecheck without it), and the admin-facing mobile "Revoke" action was deliberately not added, because `app/admin/change-requests.tsx` is a PENDING-only approvals queue and surfacing approved links there would restructure its documented decision-flow isolation — the server capability is complete and the button can ship separately. Full review reports: `.superpowers/sdd/final-review-report.md`, `.superpowers/sdd/security-review-report.md`; fix-pass report: `.superpowers/sdd/fix-pass-report.md`.

- [x] **E2E Plan 1 — Maestro harness + auth + student + 5 cross-role journeys** (2026-08-09, branch `feat/e2e-plan1`) — plan `docs/superpowers/plans/2026-07-31-e2e-plan1-harness-auth-student.md`; spec `docs/superpowers/specs/2026-07-31-full-app-e2e-testing-design.md`. 10 tasks, subagent-driven-development with the coordinator running final live-simulator verification directly (rather than via further subagent dispatch) from Task 5 onward, once repeated environment/session restarts made the dispatch-loop pattern prohibitively slow for that specific step.
  - **Delivered:** Maestro harness (`mobile/e2e/run.sh`, `mobile/scripts/check-testids.js`, dedicated E2E seed `packages/server/src/prisma/seed-e2e.ts` with 3 parent fixtures at APPROVED/PENDING/REVOKED link states); **17 checker-enforced screens** with full testID coverage (5 auth + 12 student — the entire student screen surface); **17 smoke flows** (5 auth + 12 student, each exercising every interactive element or a documented, justified exclusion — see `mobile/e2e/COVERAGE.md`'s `## Exclusions` section); **5 cross-role journeys** covering every student↔teacher↔admin relationship in the app: registration→admin-approval→login, appointment booking→teacher-accept, teacher-grades→student-sees-it, streak-render-survives-a-grade-write, and a marked-memorized mushaf page surviving a real cold app restart. Journey-scoped (not full-pass) testIDs added to `admin/home.tsx`, `admin/change-requests.tsx`, `teacher/home.tsx`, `teacher/appointments.tsx`, `teacher/grade-form.tsx` as each journey needed them.
  - **Full findings ledger — every distinct bug found across all 10 tasks** (complete write-ups in `mobile/e2e/BUGLOG.md`):
    - **Fixed at the app-code level (5):** parent role blocked from logging in (`(auth)/index.tsx`'s `allowedRoles` hardcode, Task 3); `admin/change-requests.tsx`'s approval row swallowed its own nested action buttons' testIDs into one opaque iOS accessibility node — real VoiceOver-affecting defect, not just a test-tooling gap (Task 8, `accessible={false}`); `student/appointments.tsx`'s two independently-filtered pending/decided lists each restarted their own row index at 0, a genuine testID-uniqueness collision (Task 9); `mushaf.tsx`'s page-status chip had a static `accessibilityLabel` hiding the actual dynamic status from any accessibility consumer (Task 10); `standardLimiter` (100 req/15min, not `NODE_ENV`-scoped unlike its 3 siblings) tripped under E2E's rapid navigation — widened for development (Task 5).
    - **Real app/product bugs, diagnosed and documented but NOT fixed** (each judged out of its task's narrow charter — flagged for a future plan): `first-login.tsx` is completely unreachable, dead code (Task 3); `BottomNav` falls through to admin tabs for `PARENT` role (Task 3); `student-home.tsx`'s quick-action tiles intermittently navigate to the WRONG destination — 3 of 7 tiles now confirmed affected across Tasks 5-6, root cause never isolated; the date/time-picker's ~90-row FlatList collapses into one accessibility node, unreachable by any selector (Task 5); **grade submission specifically does not count toward the student streak** — `recordActivity` (the `Streak` table's real writer) has 6 genuine callers wiring it into mushaf/recording/revision/ijazah/memorization/curriculum-plan actions, but `grade.service.ts` is not one of them (Task 10, minor product inconsistency, corrected post-review from an earlier overclaim that no action wired it up at all); **a cold app restart with a fully valid session lands on the login screen instead of home** — the root auth gate has no branch redirecting an already-authenticated user off the public login route, so every real user's app appears to "log them out" on every force-quit/reopen even though nothing expired (Task 10, Medium-High severity, real UX defect).
    - **Test-tooling findings, not app bugs (documented for future flow authors):** iOS Keychain survives `clearState` alone — any multi-role-transition flow needs an explicit `clearKeychain` before each `launchApp` (discovered the hard way in Task 8, now a documented hard requirement); iOS Password AutoFill wedges `TextInput` state after an empty-submit attempt on the same screen instance (Task 4); Maestro's `text:` selector full-matches rather than substring-matches (Task 10); a combined `id`+`text` Maestro selector requires both on the same accessibility node, and `childOf` isn't a guaranteed workaround either (Task 9); the mic-permission-persists-across-`clearState` and native-document-picker-needs-a-settle-delay findings (Task 6).
  - **Determinism proven, not assumed:** Journey 1's registration step was proven non-idempotent by design (re-running without a DB reset fails specifically and only at "Email already registered") and Journey 2's appointment booking the same way (re-booking the same slot correctly 409s) — both traced directly against `appointment.service.ts`'s `bookOccurrence` collision-check query to confirm it's genuinely date-scoped, not a false positive. Journeys 10 and 11 were confirmed safely re-runnable without a reset (no unique-constraint collision risk) by reading `Grade`'s and `PageMemorization`'s actual schema constraints.
  - **Full-suite proof:** every flow verified passing individually (several multiple times); a single clean 5-journey combined-directory run was never achieved — two consecutive attempts both failed on the same documented infrastructure fault (the local XCUITest driver's connection dropping under sustained combined-run load, confirmed via Maestro's own log, e.g. "Device became unreachable"), not a flow or app defect. The auth (5/5) and student (12/12) suites, unaffected by this task's changes, were separately confirmed clean multiple times across Tasks 8-9. `node mobile/scripts/check-testids.js` and `cd mobile && npx tsc --noEmit` clean throughout.
  - **Not in this plan (Plan 2 starting point):** full admin-screen and full teacher-screen smoke passes (mirroring this plan's Tasks 5-7 pattern for the student group) — only journey-scoped testIDs exist on those 5 files today; parent-screen smoke + journeys (parent-link lifecycle, messaging, broadcast) per the original spec's Plan 3 phasing; CI integration (this suite is local-only by design, per the spec).

## Quality Gates

- `cd mobile && npx tsc --noEmit` → 0 errors.
- `npm run test:server` → 39 suites passed, 358 tests passed.

## Server Environment Notes

- Database: `quran_review` on PostgreSQL localhost:5432.
- Env files created at `packages/server/.env` and repo root `.env`.
- Seed uses dedicated `tsconfig.seed.json` with relaxed compiler flags.
- Migration ledger baseline-repaired (F4a, 2026-07-18): `20260606120000_baseline_db_push_repair` creates the six db-push-only tables; `20260716120000_capture_db_push_drift` captures column/index/FK drift. Fresh `migrate deploy` builds the full schema (proof: `scripts/verify-migrations.sh`; itest globalSetup now uses `migrate deploy`, never `db push`).

---

# 2026-07-16 — Full 10× Roadmap Implementation Plan (approved → execute)

**Plan file:** `docs/superpowers/plans/2026-07-16-10x-roadmap-implementation.md`  
**Roadmap review:** `docs/10x-roadmap-independent-review-2026-07-16.md`  
**Goal:** move the platform from a management/booking tool to the student's daily hifz instrument.

## Immediate next tasks

- [ ] F4a — Repair `surahs` baseline migration so `prisma migrate reset --force` works on a fresh DB.
- [ ] F4b — Mushaf asset pipeline: documented one-command populate + production fail-loud guard.
- [ ] F1 — Page-level memorization on the real Mushaf (schema + contracts + reader UI + progress surfaces).

## Horizon schedule

1. **H1 — Hifz Engine:** F4a → F4b → F1 → F2 → F3 (~6.5 days)
2. **H2 — Activation & Teacher Leverage:** F5 → F6 → F7 (~5 days)
3. **H3 — Acquisition & Academy-Readiness:** F8 → F9 → F10 → F11 (~3.5 days)

## Cross-cutting gates (every branch)

- Server integration + unit tests green.
- Mobile `npx tsc --noEmit` + `npm run check-i18n` clean.
- New endpoints added to authz matrix.
- `security-reviewer` agent sign-off on auth/public/admin/offline surfaces.
- ar + en i18n for every new string.
- No completion without proof (tests, logs, or diffs).
