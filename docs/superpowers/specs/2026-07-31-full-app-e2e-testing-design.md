# Full-App E2E Test Suite (Maestro) — Design

**Date:** 2026-07-31
**Status:** Approved (Option C: two-layer suite — screen smoke + logic journeys)
**Scope decisions:** Automated E2E with Maestro · local-only (no CI job yet) · iOS simulator only

## Goal

Automated end-to-end coverage of **every screen, button, link, and logic path** in the
education_management mobile app, exercised the way a real user uses it. The existing
1,300+ server tests cover services and routes; this suite covers the user-facing layer:
rendering, taps, navigation, and cross-role business flows. The suite must be deterministic,
rerunnable, and implementable task-by-task by an agent (Sonnet 5).

## Ground facts (verified 2026-07-31)

- 49 `.tsx` files in `mobile/app/` across 8 groups: auth (5), student (12), teacher (9),
  admin (10), parent (5 incl. `_layout`), shared/messages/halaqa/account/notifications (6),
  onboarding (3), public (1), plus root/halaqa `_layout` files.
- **Zero `testID` props exist** in `mobile/app/` or `mobile/src/components/` today.
- **No parent user in the seed** (`packages/server/src/prisma/seed.ts`).
- No `mobile/ios/` directory (managed Expo). `expo-dev-client ~6.0.21` is installed,
  so `npx expo run:ios` produces a dev build Maestro can drive.
- No existing E2E tooling (no Maestro, no Detox).

## 1. Architecture & tooling

- **Maestro** (installed via Homebrew) drives the app on the iOS simulator.
  Flows are YAML files under `mobile/e2e/flows/`, one directory per screen group
  (`auth/`, `student/`, `teacher/`, `admin/`, `parent/`, `shared/`, `onboarding/`)
  plus `journeys/` for cross-screen logic flows.
- App under test: **Expo dev-client build** (`npx expo run:ios`) pointed at the local
  server (`http://localhost:4000/api/v1` — the default `EXPO_PUBLIC_API_URL`).
- **Runner script** `mobile/e2e/run.sh`:
  1. Resets and seeds the dedicated E2E database (see §2).
  2. Health-checks the server; aborts with a clear message if the server or the
     simulator app is not running.
  3. Runs `maestro test` on the given folder (or the whole suite when no argument).
  4. Orders execution: read-only smoke flows first, then data-mutating journeys.
- No CI job in this phase. The suite is run locally; CI integration is a later,
  separate decision.

## 2. Test data & determinism

- New E2E seed: `packages/server/src/prisma/seed-e2e.ts`. It runs the existing seed
  logic, then adds:
  - `parent@quran-review.com` (PARENT, ACTIVE) with an **APPROVED** ParentLink to Ali
    (`ali@quran-review.com`).
  - A second parent (`parent2@quran-review.com`) with a **PENDING** link to Ali
    (feeds the admin approvals screen).
  - A **REVOKED** link case (third parent or a revoked prior link) so the revoked-link
    UI states are reachable.
  - Sample data for Ali so every parent/teacher/admin detail screen renders content:
    grades, at least one report PDF, at least one recording, messages with his teacher,
    and notifications.
- Reset procedure: `prisma migrate reset --force --skip-seed` followed by the E2E seed,
  against a **dedicated `DATABASE_URL`** (the existing test DB on port 5433). The dev
  database is never touched by the E2E runner.
- Deterministic passwords via the existing `SEED_*_PASSWORD` env convention; the E2E
  seed adds `SEED_PARENT_PASSWORD` (default `Parent1234!`).

## 3. testID convention — the one app-code change

- Convention: `testID="<screen>.<element>"`, kebab-case, index-suffixed for lists —
  e.g. `login.submit`, `parent-home.child-card.0`, `admin-approvals.approve.1`.
- Every interactive element (buttons, links, tab bar items, list rows, inputs, toggles)
  and key assertion targets (headers, empty states, toasts) across all 49 screens.
- Shared components (`AppCard`, `IconButton`, `BottomNav`, etc.) get a `testID`
  pass-through prop where one is missing today.
- Flows select **only by testID**, never by text — immune to Arabic/English switching
  and copy edits. (Language-switch behavior itself is covered by a dedicated journey.)

## 4. Layer 1 — Screen smoke flows

The "every screen, button, link" guarantee. One flow file per screen group. Each flow:
logs in as the appropriate role, visits every screen in the group, asserts it renders
(header testID visible), and taps **every control**, asserting its observable effect
(navigation target appears / sheet opens / toast shows / state toggles), then returns.

| Group | Screens | Login as |
|---|---|---|
| auth | login, register, forgot-password, first-login, pending-approval | — (logged out; pending-approval via `fatima@`) |
| student | home, appointments, grades, recordings, reports, revisions, plans, mushaf, gamification, certificates, ijazahs, teacher-change | `ali@quran-review.com` |
| teacher | home, appointments, grade-form, recordings, reports, revisions, plans, ijazahs, student-detail | `teacher@quran-review.com` |
| admin | home, user-detail, change-requests, broadcast, analytics, audit-logs, milestones, settings, academy-health, academy-profile | `admin@quran-review.com` |
| parent | home (+ tab layout), child-reports, child-recordings, link-request | `parent@quran-review.com` |
| shared | messages index, conversation, notifications, account, halaqa index, halaqa room | per-screen appropriate role |
| onboarding + public | onboarding student/teacher/parent, public academy `[slug]` | fresh users / logged out |

**Coverage checklist:** `mobile/e2e/COVERAGE.md` — a table of every screen → every
control → the flow file + step that covers it. Maintained in the same commit as the
flow that adds coverage. A control with no row is a plan bug, not an acceptable gap.

## 5. Layer 2 — Logic journey flows (~14)

Cross-screen business flows, each in `mobile/e2e/flows/journeys/`, each self-contained
(fresh state, own logins, multi-role where needed by logging out/in):

1. Registration → pending-approval screen → admin approves → first login succeeds.
2. Student books appointment → teacher accepts → both see ACCEPTED state.
3. Teacher submits grade (grade-form) → student sees it on grades screen.
4. Recording: student uploads → teacher reviews → parent plays it (child-recordings).
5. Report: generated for Ali → parent opens/downloads it (child-reports).
6. Parent link lifecycle: request → admin approves → parent sees child → admin revokes
   → parent loses access → re-request behavior matches SEC-M1 rules (409 on
   re-approving a revoked link; a fresh request is required).
7. Teacher change request → admin approves → appointments reassigned (verify on both
   student and new teacher screens).
8. Messaging: student ⇄ teacher both directions, unread badge appears and clears.
9. Admin broadcast → target user receives notification.
10. Gamification/streak updates after a new grade is recorded.
11. Mushaf: navigation, page turning, memorization marking persists after reload.
12. Plans: teacher creates plan → student views and tracks progress.
13. Certificate/ijazah issued → student sees it on certificates/ijazahs screens.
14. Settings: language switch AR ⇄ EN (RTL flip renders) and dark-mode toggle —
    smoke-assert key screens still render in both.

## 6. Flakiness & failure policy

- Every flow starts from a known state: `clearState`, fresh login; no flow depends on
  another flow's leftovers except steps inside a single ordered journey file.
- Waits use Maestro `extendedWaitUntil` on testIDs. **No blind `sleep`/fixed delays.**
- A failing flow is a **finding**, never something to weaken. The implementer must
  classify it: app bug (log it in the plan's bug log; fix if in scope, otherwise file
  for follow-up) or test bug (fix the flow). Assertions are only changed when the
  asserted behavior is confirmed wrong.

## 7. Deliverables & phasing — 3 sequential implementation plans

1. **Plan 1 — Harness + auth + student:** Maestro install docs, `run.sh`, E2E seed,
   testID pass-through props in shared components, testIDs + smoke flows for auth and
   student groups, journeys 1–3, 10, 11 (student-centric), COVERAGE.md started.
2. **Plan 2 — Teacher + admin:** testIDs + smoke flows for teacher and admin groups,
   journeys 7, 9, 12, 13 (teacher/admin-centric).
3. **Plan 3 — Parent + shared + onboarding/public:** remaining testIDs + smoke flows,
   journeys 4, 5, 6, 8, 14; final COVERAGE.md audit — every screen and control
   accounted for, or an explicit justified exclusion listed.

Each plan is written with `superpowers:writing-plans` and executed task-by-task via
`superpowers:subagent-driven-development`, matching the F9/F10 process.

## Out of scope

- Android emulator runs (flows are written to be platform-portable; enabling Android
  later should require no flow rewrites).
- CI (GitHub Actions) execution.
- Performance/load testing, accessibility audits, and unit/integration test changes.
- Push-notification delivery from real FCM (notification screens are tested via seeded
  in-app notification records).
