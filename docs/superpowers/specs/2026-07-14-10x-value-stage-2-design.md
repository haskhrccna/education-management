# 10x Value Stage 2 — Academy-Ready Roadmap

**Date:** 2026-07-14
**Status:** Draft (in brainstorm)
**Successor to:** 2026-07-04 rebuild spec (M0–M13 complete) + the 2026-07-06 16-feature roadmap (Stages 1–4 complete)
**Decisions confirmed by user:** scope = new features + the three pending UX mini-brainstorms; horizon = 1–2 weeks (8 working days); value dimensions = all four (delight, retention, acquisition, monetization); PRs 1–3 land first.

---

## 1. Context

The Quran Review platform completed a full strangler rebuild (M0–M13, 2026-07-04 → 2026-07-11) plus the 16-feature product roadmap (Stages 1–4, 2026-07-06 → 2026-07-07). State at 2026-07-14:

- 864 characterization integration tests + 327 unit tests, all green.
- 106 typed contracts, 27 contract modules, 0 legacy controllers.
- Mobile on the typed client, theming + i18n foundations in place, 63-key i18n gap closed (ar+en) with a permanent guard.
- Security-reviewed, load-tested, p95 health 2ms @ ~15k rps, authed read p95 6ms @ ~3.9k rps.
- Three open in-flight PRs: `feat/api-cycle-interceptors-theme` (PR1), `fix/gamification-rewards-a11y` (PR2), `feat/tanstack-query` (PR3) — all tsc-green, expected to land before this roadmap starts.

The remaining unforced errors are:

1. **Three UX mini-brainstorms** explicitly fenced out of the rebuild (M10 student, M11 teacher, M12 admin+parent+shared) — never designed, never executed.
2. **Zero onboarding** — a new user lands on a populated or empty home screen with no first-session guidance. Activation is the #1 retention lever and currently nothing.
3. **Public verify is a single-record fact page** (M3.3) — a real acquisition surface waiting to be built.
4. **No admin-facing "academy health" report** — a platform director has no one-pager to show a board.

This roadmap closes all four in 8 working days.

---

## 2. Goals & non-goals

**Goal:** In 8 working days, turn the platform from "solid single-academy tool" into "ready to pitch to a multi-academy rollout."

**Five stages, in order:**

| # | Stage | Theme | Days |
|---|---|---|---|
| S0 | Land PRs 1–3 | Foundation (already in flight) | 0 |
| S1 | M11 Teacher UX rathink (7 screens) | Supply-side polish | 2 |
| S2 | Onboarding & First-Session magic (3 role-specific flows) | Retention / activation | 2 |
| S3 | Public landing surface (verify page → real landing + share image) | Acquisition | 1 |
| S4 | M10 Student UX rathink (10 screens) | Delight / daily-use | 2 |
| S5 | M12 Admin+Parent+Shared UX rathink (12 screens) + Academy Health report | Monetization readiness | 1 |

**In scope:**

- Mobile UX changes for S1, S4, S5 (one mini-brainstorm per cluster, gated by rebuild spec §6).
- Three new mobile flows: `/onboarding/student`, `/onboarding/teacher`, `/onboarding/parent`.
- One new server module: `public/` — public landing + share image generation.
- One new server module: `analytics/` — Academy Health weekly report.
- New public landing page (mobile) at `/public/academy/[slug]` — read-only, no login.
- i18n keys: ar + en for every new string (gated by `npm run check-i18n`).
- Tests per stage (per CLAUDE.md: "never mark a task complete without proof").

**Out of scope (deferred):**

- Payments / Stripe / seat-based subscriptions (S5.5 in the original roadmap; not this sprint).
- Real ASR / Tajweed AI (rebuild's 1.1 is a stub; vendor decision still gated on cost + children's-voice-data privacy review).
- Multi-tenancy (separate academy data isolation).
- Web client.
- i18n beyond ar + en.
- Admin-configurable thresholds for roster health (already noted follow-up for 1.4; deferred).
- Admin-configurable digest day/time (already noted follow-up for 1.3; deferred).
- Per-ayah memorization data model (deferred from 1.2; in scope for S4 only if the model is small enough to ship in this stage; otherwise noted as a follow-up).

**Sequencing rationale:**

- S1 first: teachers are the supply-side bottleneck. If teachers don't like it, the academy doesn't renew.
- S2 second: onboarding converts curiosity into retention. No point polishing student UX if the first session is a dead end.
- S3 third: once onboarding produces real first sessions, the public landing has real content to share.
- S4 fourth: children-facing polish compounds retention; safe to do once onboarding lands.
- S5 last: admin/parent polish + Academy Health report is the monetization-ready closer; depends on the parent flow from S2 being polished.

---

## 3. Architecture (shared patterns)

The five stages share three architectural patterns; each stage builds on them.

### 3.1 Mini-brainstorm fence for UX rathinks (S1, S4, S5)

Per the rebuild spec §6, every screen cluster's UX rathink is a separate brainstorm → spec → plan → execute cycle. So this roadmap is the *sequencing* of three future mini-brainstorms (M11, M10, M12) plus two net-new features, but it does **not** pre-design the screens. Each cluster (S1, S4, S5) will:

- Trigger a `superpowers:brainstorming` skill with the user at execution time.
- Produce its own per-cluster spec → plan → PR.
- Hold the same mobile `tsc --noEmit` gate + `npm run check-i18n` gate as every prior stage.

This roadmap commits to *what* each cluster must achieve (high-level AC in §4), not *how* (which is designed inside the brainstorm).

### 3.2 Onboarding as a server-gated, per-role flow (S2)

The three role-specific onboarding flows are separate first-launch wizards surfaced from `app/_layout.tsx`'s auth gate. Each is a stack of 2–4 screens in `app/onboarding/<role>/`. They are gated by a new `User.onboardingCompletedAt DateTime?` column:

- `null` after registration → wizard shows on next sign-in.
- Non-null → wizard never shows again.
- Per-role: student wizard only runs for STUDENT role; teacher for TEACHER; parent for PARENT.
- Dismissable: a "skip for now" button hides the wizard and stamps `onboardingCompletedAt` (acceptable for teachers/parents; students have no skip — required to use the app meaningfully).
- The `onboardingCompletedAt` itself is the "don't show this again" flag; no separate toggle.

### 3.3 Public surface lives in a new `public/` server module (S3)

The public landing + share image sit in `packages/server/src/modules/public/`:

- New minimal model: `AcademyProfile { id, slug @unique, displayName, publicBio, programName, logoUrl?, contactEmail?, active Boolean @default(false), updatedAt }`. Seeded by admin. Single-row per platform for the MVP (slug defaults to `"default"`).
- `GET /api/v1/public/academy/:slug` — returns the profile (no auth). 404 if `active = false`.
- `GET /api/v1/verify/:token` (existing) — extended response to include `academy: AcademyProfile` if `active`.
- `GET /api/v1/public/verify/:token/share.png` — server-rendered 1200×630 PNG. Uses `puppeteer-core` (default, self-host-friendly) to render an HTML template with the achievement, the endorsing teacher name, the program name, the academy logo. Cached on disk under `uploads/share/`, 24h TTL. Returns 404 if the token is invalid or the related certificate/ijazah is revoked.
- Mobile: a new public route `app/(public)/academy/[slug].tsx` (expo-router, mounted under a public-only group `(public)/` that bypasses the auth redirect).
- Privacy: academy profile is public, but verify responses never expose student PII beyond what the existing M3.3 verify page already shows (name, surah, date, endorsing teacher).

### 3.4 Academy Health report is read-only analytics on existing tables (S5)

- New server route `GET /api/v1/admin/academy-health` (ADMIN-only). Aggregates from `Appointment`, `Grade`, `SessionRecord` (attendance), `Streak`, `ParentLink`, `User` (status counts). Pure read — no new data collection, no new tables.
- Cached in Redis with 1h TTL; if Redis absent, computed on the fly (same graceful no-op convention as every other queue function).
- Mobile: new admin screen `app/admin/academy-health.tsx` with a one-page summary. PDF export optional, behind a "Export PDF" button reusing the existing `report.service.ts` PDF generator.

### 3.5 Cross-cutting for all five stages

- All new endpoints use the existing `defineRoute(contract, handler)` from M1 — no hand-wired routes.
- All new shared types/validators in `packages/shared/src/`.
- All new server modules follow `routes/ → controllers/ → services/ → Prisma` (now via contract routing).
- All new mobile screens = `api client` + `hook` + `screen` + i18n (ar+en) + theme-correct styling via the `useTheme()` hook adopted in M9.
- All migrations go through `/db-migrate` (never `db push`), per CLAUDE.md.
- All new server code has tests: service unit tests + integration tests in the authz matrix.
- Security: `security-reviewer` agent runs after S2 (new auth flow), S3 (public surface), and S5 (admin report).

---

## 4. Per-stage acceptance criteria

### Stage 1 — M11 Teacher UX rathink (7 screens)

**Cluster scope** (existing `app/teacher/` route group):
- `app/teacher/home.tsx` — daily landing
- `app/teacher/appointments.tsx` — session list
- `app/teacher/recordings.tsx` — review queue
- `app/teacher/reports.tsx` — PDF report list
- `app/teacher/grade-form.tsx` — grading UI
- `app/teacher/roster.tsx` — student list (from M11.4 — surfaced from /roster/health backend route shipped in 1.4)
- `app/teacher/curriculum-plans.tsx` — plan creator (from 2.2)

**AC1.** Daily landing surfaces what needs to be done *now*. On a fresh open, a teacher sees: today's appointments with student name + surah/ayah (one tap to open session), pending review-queue recordings count, and a maximum of 3 at-risk students from the existing roster-health endpoint. No drilling required to find the next action.

**AC2.** Sessions can be graded in ≤ 3 taps from the home screen. Grade-form is reached via the home-screen appointment card; recording review is one tap from the same card. The review-then-grade flow is a single linear path with no nested modals.

**AC3.** At-risk students get a reason, not just a label. The roster health card on the home screen uses `StatusPill` reason chips for "missed 2+ sessions," "streak broken this week," "no grade in 14 days."

**AC4.** Curriculum-plan creator is one tab, not three. A teacher creates a plan, adds items (surah + target date), and assigns it to one or more students — from a single screen. The existing "ad hoc" path stays available for teachers who never create a plan.

**AC5.** Review-queue is sorted, not chronological. Recordings queue by "needs teacher attention first" — combination of `accuracyScore = null`, `scoreStatus = UNAVAILABLE`, and oldest-first within the same status. No manual re-sorting.

**AC6.** All 7 screens pass `useTheme()` adoption, i18n (ar+en), 44pt tap targets, a11y labels. Per M9 + lessons.md: no raw `getColors` calls, no `isAr` ternaries, every `TouchableOpacity` gets `accessibilityRole`/`accessibilityLabel`/`hitSlop`, every `t()` string has a key in both `ar` and `en`.

**AC7.** `/impeccable critique app/teacher/` scores higher than the current baseline (measured at brainstorm time).

**Effort:** 2 working days. Process gate: per-cluster brainstorm.

### Stage 2 — Onboarding & First-Session magic (3 role-specific flows)

**Schema (migration):** add `User.onboardingCompletedAt DateTime?` (nullable, defaults to `null` for existing users; existing users will see the wizard once on next sign-in — deliberate retention choice, see §7 risk table).

**Server (new module `account/` or extension of existing):**
- New route: `POST /api/v1/account/complete-onboarding` (auth required, idempotent, sets `onboardingCompletedAt = now()`). Single endpoint, all roles.
- `JWT` payload gains `onboardingCompletedAt` (read-only on mobile).

#### 2.1 — Student first-recording wizard

**Trigger:** `User.onboardingCompletedAt IS NULL AND role = 'STUDENT'` on sign-in, before the role redirect.

**Flow (3 screens, ≤ 60 seconds total):**

| # | Screen | Purpose | AC |
|---|---|---|---|
| 1 | `app/onboarding/student/welcome.tsx` | Brand welcome + value framing. Single illustration, single CTA. | Renders Quran companion brand, sets the tone ("rewarding, not toy-like" per PRODUCT.md). Arabic-first + RTL. CTA = "ابدأ" (Start). No skip. |
| 2 | `app/onboarding/student/teacher.tsx` | "Your teacher is X" — shows the assigned teacher name, avatar, "Say Salaam" CTA that opens a pre-filled message in the existing messages screen. | Reads from `useAuthStore.user.assignedTeacherId`. If no assigned teacher: shows "Your teacher will be assigned soon" empty state. CTA opens `messages/[partnerId]` with prefilled body. |
| 3 | `app/onboarding/student/record.tsx` | "Record your first surah" — opens the existing `expo-av` recorder with a pre-filled short surah suggestion. | Pre-fills surah number from `MemorizationProgress` (first surah with status ≠ COMPLETE). Reuses `useRecordings().create()`. On success: stamps `onboardingCompletedAt`, navigates to home with a success toast. |

**AC2.1.1.** A new student reaches a successful `uploadRecording` from cold-start in ≤ 90 seconds.
**AC2.1.2.** Wizard is unrepeatable (gated by `onboardingCompletedAt`).
**AC2.1.3.** The "Your teacher is X" step gracefully handles no assigned teacher without crashing.
**AC2.1.4.** Recording step uses the same `expo-av` recorder as the existing flow — no parallel recording code path.
**AC2.1.5.** All 3 screens pass: 44pt tap targets, `useTheme()` adoption, ar+en i18n keys, `accessibilityLabel` on every CTA.
**AC2.1.6.** `security-reviewer` runs after S2 lands.
**AC2.1.7.** Integration test: fresh STUDENT sign-up → wizard → first recording → home. Asserts `onboardingCompletedAt` is set, the recording row exists, the home screen renders the new "first recording" celebration.

#### 2.2 — Teacher first-student handoff

**Trigger:** `User.onboardingCompletedAt IS NULL AND role = 'TEACHER'` on sign-in.

**Flow (2 screens, ≤ 45 seconds total):**

| # | Screen | Purpose | AC |
|---|---|---|---|
| 1 | `app/onboarding/teacher/welcome.tsx` | Brand welcome + "Your roster is empty" framing. Single CTA. | CTA = "Add your first student" — opens the existing admin-side `createUser` form (teacher is allowed to register a student per the existing role permission set; verify at S2 plan time). |
| 2 | `app/onboarding/teacher/curriculum.tsx` | "Plan your first curriculum" — short wizard that creates a one-week starter plan and assigns it to the just-added student. Optional. | Reuses the existing `curriculum-plans` module from 2.2. On "Skip" → still sets `onboardingCompletedAt`. On "Create" → calls the existing `createPlan` + `assignPlanToStudent` endpoints. |

**AC2.2.1.** A new teacher reaches a populated roster from cold-start in ≤ 90 seconds.
**AC2.2.2.** "Skip" on the curriculum screen sets `onboardingCompletedAt` and navigates to home.
**AC2.2.3.** The student-add step uses the existing `createUser` endpoint — no new user-creation code.
**AC2.2.4.** All 2 screens pass the same mobile gates as 2.1.
**AC2.2.5.** Integration test: fresh TEACHER sign-up → wizard → add student → home. Asserts `User` count for that teacher is 1, `onboardingCompletedAt` is set.

#### 2.3 — Parent invite + first-link

**Trigger:** `User.onboardingCompletedAt IS NULL AND role = 'PARENT'` on sign-in.

**Flow (2 screens, ≤ 45 seconds total):**

| # | Screen | Purpose | AC |
|---|---|---|---|
| 1 | `app/onboarding/parent/welcome.tsx` | Brand welcome + value framing. CTA = "Link to your child." | Explains the link flow and shows status. |
| 2 | `app/onboarding/parent/link.tsx` | "Request a link" form — student email + relationship (mother/father/guardian). | Reuses the existing parent link-request flow. On submit → "Request sent" + sets `onboardingCompletedAt`. |

**AC2.3.1.** A new parent reaches a submitted link-request from cold-start in ≤ 60 seconds.
**AC2.3.2.** If the parent already has an APPROVED link at sign-in time, the wizard auto-completes and navigates to `parent/home.tsx` directly.
**AC2.3.3.** The link-request form reuses the existing `requestLink` endpoint — no new endpoint.
**AC2.3.4.** All 2 screens pass the same mobile gates.
**AC2.3.5.** Integration test: fresh PARENT sign-up → wizard → request → home. Asserts `ParentLink` row exists with status `PENDING`, `onboardingCompletedAt` is set.

**Effort:** 2 working days. S2.1 takes the most (recording integration), S2.2 and S2.3 in parallel.

### Stage 3 — Public landing surface

**Schema (migration):** `AcademyProfile { id, slug @unique (default "default"), displayName, publicBio, programName, logoUrl?, contactEmail?, active Boolean @default(false), updatedAt }`.

**Server (new module `packages/server/src/modules/public/`):**
- `GET /api/v1/public/academy/:slug` — returns the profile (no auth). 404 if `active = false`.
- `GET /api/v1/verify/:token` (existing) — extended response to include `academy: AcademyProfile` if `active`.
- `GET /api/v1/public/verify/:token/share.png` — server-rendered 1200×630 PNG via `puppeteer-core`. Cached on disk under `uploads/share/`, 24h TTL. 404 if token invalid or related certificate/ijazah revoked.
- Admin route: `PUT /api/v1/admin/academy-profile` (ADMIN-only) — upserts the single profile.

**Mobile (new public-only route group `(public)/` bypassing the auth gate):**
- `app/(public)/academy/[slug].tsx` — branded landing. Shows academy display name, bio, program name, a "Verify a Certificate" form, and a CTA "Open in the app" (deep-links to `quran-review://` if installed, else App Store / Play Store).
- `app/(public)/verify/[token].tsx` — improved verify page. Same data, academy header, endorsement chain, "Share" button that opens the system share sheet with the share-image URL + verify URL.

**AC3.1.** An admin can fill in academy profile fields and they appear on `/(public)/academy/[slug]` within 60 seconds.
**AC3.2.** A shareable PNG renders for any active certificate/ijazah and is ≤ 200KB at 1200×630.
**AC3.3.** A revoked certificate/ijazah's share image returns 404 (no caching the revoked result).
**AC3.4.** The public surface exposes zero student PII beyond what the existing M3.3 verify page already shows.
**AC3.5.** `security-reviewer` runs after S3 lands.
**AC3.6.** Integration tests: academy profile active/inactive 200/404; share.png for valid/revoked token 200/404; admin-only route rejection: STUDENT/TEACHER 403, anonymous 401.
**AC3.7.** Mobile tsc + check-i18n clean.

**Effort:** 1 working day.

### Stage 4 — M10 Student UX rathink (10 screens)

**Cluster scope:**
- `app/student/home.tsx` — daily landing
- `app/student/appointments.tsx` — session list
- `app/student/grades.tsx` — grade history
- `app/student/recordings.tsx` — own recordings
- `app/student/reports.tsx` — parent-visible reports
- `app/student/gamification.tsx` — streak + badges
- `app/student/memorization.tsx` — surah progress
- `app/student/teacher-change.tsx` — request flow
- `app/student/curriculum-plans.tsx` — read-only plan view
- `app/student/mushaf/[surah].tsx` — Quran reader

**AC4.1.** Home screen surfaces "what's next" in 2 taps. Today's appointment (or "no session today"), today's revision (from the spaced-repetition engine shipped in 1.6), and the current streak. No menu hunting.
**AC4.2.** Recording flow is a single CTA from any relevant screen. "Record this surah" reachable from memorization, revision, and curriculum-plan cards.
**AC4.3.** Mushaf reader is one continuous scroll, not paginated. Long-press to mark an ayah as memorized — only if the per-ayah memorization data model is small enough to ship in this stage; otherwise noted as a follow-up.
**AC4.4.** Streak + gamification follow the Rationed-Gold principle from `DESIGN.md` — gold accent only on real achievements (current streak, badge earned), not on labels or chrome. PR2 already in flight covers most of this; S4 is the per-cluster review of remaining gamification-adjacent screens.
**AC4.5.** All 10 screens pass the same mobile gates as S1.
**AC4.6.** `/impeccable critique app/student/` scores higher than current baseline.
**AC4.7.** Student-only assumption: no destructive actions in the child UI. A child never sees "delete recording," "change teacher" without a parent-confirmation flow, or "leave a review." The teacher-change flow already has a parent-consent path; S4 verifies it's reachable without auth friction.

**Effort:** 2 working days. Process gate: per-cluster brainstorm.

### Stage 5 — M12 Admin+Parent+Shared UX rathink (12 screens) + Academy Health report

**Cluster scope:**
- Admin (7): `app/admin/home.tsx`, `app/admin/users.tsx`, `app/admin/change-requests.tsx`, `app/admin/broadcast.tsx`, `app/admin/milestones.tsx`, `app/admin/audit-logs.tsx`, `app/admin/academy-health.tsx` (new in S5)
- Parent (3): `app/parent/home.tsx`, `app/parent/child-dashboard.tsx`, `app/parent/link-request.tsx`
- Shared (2): `app/messages/...`, `app/notifications.tsx`

**AC5.1.** Admin home is a one-pager. A single screen shows: pending approvals (teacher-change requests, parent-link requests), active user counts by role, broadcast composer, and the new Academy Health link.
**AC5.2.** Audit-log viewer (from M2b) is filterable, not just chronological. Filter by actor, action, date range, target entity. Pagination works on 10k+ rows without a hitch.
**AC5.3.** Parent home is the child's summary, not a navigation menu. One card per linked child with: today's session (or "no session"), last grade, current streak, action chips ("View report," "View recordings," "Send message"). The new M4.1 guardian-consent toggle sits inline.
**AC5.4.** Messages and notifications feel like one product. Cross-link: tapping a notification of type `NEW_MESSAGE` deep-links to the conversation.
**AC5.5.** All 12 screens pass the same mobile gates.

**Academy Health report (new server module + new admin mobile screen):**

- `GET /api/v1/admin/academy-health` (ADMIN-only). Response:
  ```ts
  {
    period: { from: Date, to: Date },            // last 7 days
    users: { active: number, pending: number, byRole: Record<Role, number> },
    engagement: {
      dailyActiveStudents: number,
      weeklyActiveStudents: number,
      averageStreak: number,
    },
    learning: {
      sessionsCompleted: number,
      averageGrade: number | null,
      atRiskStudents: number,                    // reuses the M1.4 roster-health rule set
    },
    parents: {
      totalLinks: number,
      approvedLinks: number,
      pendingLinks: number,
      consentGranted: number,                    // from M4.1
    },
    healthScore: number                          // 0–100, weighted composite
  }
  ```
- Cached in Redis with 1h TTL (graceful no-op without Redis).
- Pure read — no new tables, no new data collection.
- Mobile screen `app/admin/academy-health.tsx`: one-page summary, large numbers, sparkline (no full charting library — `<Sparkline />` SVG or inline `<View>` bar array). "Export PDF" button uses the existing `report.service.ts` PDF generator.
- AC: admin can hit the endpoint and read it in ≤ 2 seconds. PDF export ≤ 5 seconds. Re-running the endpoint 10× in a minute hits the Redis cache (asserted by integration test).

**Effort:** 1 working day for both. De-scope fallback if too tight: ship Academy Health + admin home polish, defer parent + shared polish to a follow-up roadmap. User decides at S5 execution time.

---

## 5. Sequencing & dependency graph

```
S0 (PRs land) ──► S1 (Teacher UX) ─┐
                                    ├─► S3 (Public landing) ──► S5 (Admin+Parent+Shared + Health)
                S2 (Onboarding) ────┘
                                    │
                                    └─► S4 (Student UX) ───────► S5
```

- S0 prerequisite: PRs 1, 2, 3 land.
- S1 prerequisite: S0.
- S2 prerequisite: S1 (both touch the auth layout; S1 finishes first to avoid merge conflict on `_layout.tsx`).
- S3 prerequisite: S1 + S2 (public landing mentions onboarding for new sign-ups).
- S4 prerequisite: S2 (student UX depends on the onboarding flow being live).
- S5 prerequisite: S3 + S4 (admin health references parent + student engagement metrics after both are polished).

---

## 6. Cross-cutting quality gates (every stage)

- `cd mobile && npx tsc --noEmit` clean.
- `npm run check-i18n` clean.
- `npm run test:server` green (all stages add to the characterization suite).
- `security-reviewer` agent runs after S2, S3, S5.
- `/impeccable critique` per cluster (S1, S4, S5) at the end of each.
- All migrations via `/db-migrate` (never `db push`), per CLAUDE.md.
- All new server endpoints have integration tests in the authz matrix.
- No PR is merged without proof: tests, logs, or diffs (per CLAUDE.md).

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| S5 is too tight (12-screen rathink + Academy Health in 1 day) | De-scope fallback: ship Academy Health + admin home polish, defer parent + shared polish. |
| S2 onboarding reuses `expo-av` recorder, but iOS permissions flow may have changed | Per S2 plan time, smoke test on physical iOS device before merging. |
| S3 `puppeteer-core` adds a dependency to a server already load-tested | Use `puppeteer-core` against a pre-installed Chromium binary. Plan time: confirm Chromium availability in the deployment environment. |
| S1 / S4 / S5 per-cluster brainstorms may surface scope that doesn't fit the day count | The per-cluster brainstorm itself is the gate: if AC don't fit, the user re-scopes before planning, not after. |
| Existing users suddenly hit a wizard on next sign-in if migration defaults to `null` | All existing users keep `null` → they see the wizard too. **This is a deliberate choice** (retention matters for the existing user base too). Note in the S2 spec: existing users see the wizard once, can skip if role permits. |
| Per-ayah memorization data model (S4.3) is too heavy | S4 ships without long-press-to-mark; per-ayah mark is a follow-up. |

---

## 8. Definition of done

The roadmap is complete when:

1. All 5 stages are merged to `main` with their tests green.
2. The characterization suite is up to date with all new endpoints covered.
3. `/impeccable critique` shows improvement on all three UX clusters (S1, S4, S5) over the brainstorm-time baseline.
4. `security-reviewer` has signed off on S2, S3, S5.
5. A new STUDENT can sign up and reach a recorded first session in ≤ 90 seconds, end-to-end.
6. An admin can hit `/admin/academy-health` and read the report in ≤ 2 seconds.
7. A shareable PNG renders for any active certificate/ijazah, ≤ 200KB.
8. The PRs 1–3 are merged (S0).
