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
