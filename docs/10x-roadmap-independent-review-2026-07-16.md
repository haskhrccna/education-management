# Independent 10× Value Roadmap Review — Quran Review

**Date:** 2026-07-16  
**Audited by:** Claude Code  
**Basis:** mobile screens, server modules, Prisma schema, existing tests, deployment docs, and the committed `docs/superpowers/specs/2026-07-16-10x-roadmap.md`.  
**Verdict:** The committed roadmap is directionally correct. This document validates it, sharpens the evidence, and adds a few independent angles.

---

## 1. Current-state audit (evidence from code)

### What is shipped and green

| Layer | Evidence |
|-------|----------|
| **Server architecture** | 31 contract-routed modules, 106 typed contracts, 865 integration + 282 unit tests green. Zero legacy Express routers remain (`app.ts` mounts only contract routers + docs/metrics/verify). |
| **Auth & roles** | JWT + refresh, `STUDENT/TEACHER/ADMIN/PARENT`, one-assigned-teacher-per-student enforced end-to-end (`appointment.service.ts`, `teacher-change` flow, locked booking UI). |
| **Scheduling** | Appointments, recurring slots (8-week rolling window), attendance, session records. |
| **Learning core** | Surah/ayah dataset, SM-2 revision algorithm (`revision.service.ts`), weak-ayah drilling, curriculum plans. |
| **Mushaf** | KFGQPC Madani image reader (604 pages), `mushaf.service.ts` returns ayahs per page, but **no memorization action** exists in the reader (`logAyahMemorization` is orphaned). |
| **Media** | Audio recordings, PDF reports, local file storage + `?token=` download auth. |
| **Recognition** | Gamification (streaks/badges/leaderboard), certificates + ijazahs with public verify links, halaqa group streaks, milestone catalog. |
| **Trust** | Guardian consent, data export, self-delete, audit log, offline query cache, rate limiting, security review. |
| **Mobile foundation** | Expo SDK 54, typed contract client, TanStack Query + persistence, theming/i18n guards. |

### The three gaps that actually block 10× value

| Gap | Why it matters | Evidence in code |
|-----|----------------|------------------|
| **G1: Hifz loop is broken in half** | The Mushaf reader displays the Quran but cannot log memorization or start a recording. Students must leave the reader to act. | `mobile/app/student/mushaf.tsx` has only zoom/page navigation; `mushaf.service.ts::logAyahMemorization` is not called from any screen. |
| **G2: Recordings float in space** | A recording is a file + free-text notes. The teacher reviews audio without seeing the page/surah the student recited from. | `Recording` model has no `page`/`surahId`/`ayahId` columns. |
| **G3: Revision is still teacher-driven** | SM-2 exists, but revisions are seeded only when a teacher marks a surah complete or creates one manually. No automatic daily queue runs from actual memorized pages. | `revision.service.ts::seedRevisionForCompletion` is triggered only by `memorization.service.ts::updateProgress` (teacher action). `getRevisions` has a `due` filter but no scheduler builds the queue. |

These three gaps are the 10× thesis: close them and the app becomes the instrument a hifz student uses every day. Everything else (onboarding, sharing, academy health) multiplies that loop.

---

## 2. The 10× thesis

> A generic tutoring app manages schedules and grades. A 10× Quran-memorization companion makes the real Mushaf page the center of daily action: open → see today's revision → read from the page → record from it → teacher reviews with the page beside the audio → progress and streak update automatically. No manual scheduling by anyone.

The product must shift from **booking & grading tool** to **daily hifz instrument**.

---

## 3. Roadmap — three horizons

Estimated total: **15 working days** across the three horizons. Each feature ships as one branch → tests → merge.

### H1 — The Hifz Engine (the daily loop)

#### F1 · Page-level memorization on the real Mushaf

**Rationale:** Hifz is tracked by page in the Madani Mushaf. Replace the orphaned per-ayah counter with page-level status driven from the reader.

**Build:**
- Add `PageMemorization { userId, page 1–604, status NOT_STARTED|LEARNING|MEMORIZED|SOLID, lastReviewedAt, updatedAt }` with `@@unique([userId, page])`.
- Contracts: `GET /mushaf/my-pages`, `POST /mushaf/my-pages/:page/status`.
- Reader gains a status chip + 2-tap action (Learning / Memorized) per page.
- All progress surfaces derive from `memorizedPages/604` and juz completion; keep `MemorizationProgress` for grading context.

**Acceptance criteria:**
- **AC1.1** From any Mushaf page, a student marks it `LEARNING` or `MEMORIZED` in ≤ 2 taps without leaving the reader; the chip reflects status on revisit and after app restart.
- **AC1.2** `GET /mushaf/my-pages` returns all 604 statuses in one call (≤ 300ms); the reader paints chips from a single fetch, not per-page requests.
- **AC1.3** Student home, memorization screen, teacher `student-detail`, and parent child view show the same pages-memorized percentage and per-juz breakdown.
- **AC1.4** Only the student or their assigned teacher can write page statuses; cross-student writes return 403 and are covered by the authz matrix.
- **AC1.5** Migration is additive; `prisma migrate reset --force` succeeds on a fresh DB (depends on F4a landing first or together).
- **AC1.6** Marking a page `MEMORIZED` records `lastReviewedAt` and feeds the revision queue (F3).

---

#### F2 · Recite from the page

**Rationale:** Anchor every recording to a Quran page so review has context.

**Build:**
- Add `Recording.page Int?` and optional `surahId` to the schema.
- Mic button on the reader starts the existing `expo-av` recorder with the current page pre-filled.
- Teacher review screen renders the page image (already served at `/mushaf-pages/<n>.webp`) beside audio.
- Weak-ayah flagging becomes a one-tap action on that review screen; flags feed F3.

**Acceptance criteria:**
- **AC2.1** From a Mushaf page, start recording in ≤ 2 taps; upload carries `page`; no parallel recording code path (reuses existing uploader + guards).
- **AC2.2** Teacher review of a page-tagged recording shows the page image + audio on one screen; untagged legacy recordings render exactly as today (nullable column, zero regression — existing media-flow tests stay green).
- **AC2.3** Teacher flags a weak ayah from the review screen in ≤ 2 taps; flag lands in `WeakAyahFlag` for that student and seeds a drill revision.
- **AC2.4** Recording list rows show page/surah tag; tapping it opens the reader at that page.
- **AC2.5** Upload still enforces the assigned-teacher relationship guard; contract + integration tests updated additively (existing 865 stay green).

---

#### F3 · Self-running revision queue (Sabaq · Sabqi · Manzil)

**Rationale:** The classical review ladder should run itself; teachers override, not maintain, the queue.

**Build:**
- Pure function `buildRevisionQueue(userId, date)` over `PageMemorization` (recency-banded intervals) + `WeakAyahFlag` (boost weak pages) + existing `RevisionSchedule` (teacher overrides always win).
- Student home gets a "Today's revision" card: ordered pages deep-linking into the reader.
- Completing a page stamps `lastReviewedAt` and removes it from today's queue (optimistic update).
- Nightly BullMQ job precomputes queues; graceful no-Redis fallback computes on read.
- Optional reminder push through existing notification service.

**Acceptance criteria:**
- **AC3.1** A student with ≥ 1 memorized page always has a non-empty, deterministic daily queue: same inputs → same queue (unit-tested pure function; no RNG).
- **AC3.2** Queue order: overdue manzil first, then sabqi, then sabaq; pages containing an active weak-ayah flag are boosted one band (each rule unit-tested).
- **AC3.3** "Reviewed" from the reader/card updates `lastReviewedAt` and removes the page from today's queue without a refetch (optimistic update).
- **AC3.4** Teacher-created `RevisionSchedule` rows appear at the top of the student's queue and are never dropped by the algorithm.
- **AC3.5** Works with Redis absent (computed on request) and with Redis present (nightly precompute + cached read ≤ 100ms) — both paths integration-tested.
- **AC3.6** Parent child-view and teacher roster show revision adherence (done/queued this week) from the same data.

---

#### F4 · Deploy unblockers (parallel)

**F4a — Migration baseline.**
- **AC4.1** `npx prisma migrate reset --force` on an empty Postgres completes with zero manual steps (the `surahs`-table gap is captured in a baseline migration); CI proves it on every PR.
- **AC4.2** `db push` is removed from all docs and scripts; `CLAUDE.md` updated.

**F4b — Mushaf asset pipeline.**
- **AC4.3** A documented one-command path populates `mushaf-pages/` on any machine (`scripts/extract_mushaf_pages.py` against the source PDF, or a checksummed archive — decision at plan time).
- **AC4.4** Server refuses to start in production mode with an empty/partial `mushaf-pages/` unless explicitly overridden (env flag) — fail loud, not 404s at runtime.
- **AC4.5** `GET /mushaf-pages/1.webp` and `/604.webp` return 200 + correct checksums in a smoke integration test.

---

### H2 — Activation & Teacher Leverage

#### F5 · Role onboarding wizards

**Rationale:** New users currently land on an empty home; reduce time-to-first-value to ≤ 90 seconds.

**Build:**
- Add `User.onboardingCompletedAt` and `POST /account/complete-onboarding`.
- Student wizard: greet assigned teacher, record first page via F2, see F3 revision card.
- Teacher/admin/parent wizards tailored to first meaningful action.

**Acceptance criteria:**
- **AC5.1** Student wizard's teacher step reuses the assigned-teacher derivation from `appointments.tsx` (profile → ACCEPTED-appointment fallback); no third derivation is introduced.
- **AC5.2** Completing the student wizard leaves the student with: teacher greeted (message sent), ≥ 1 page-anchored recording, and the F3 revision card visible on home.
- **AC5.3** Each role wizard has ≤ 3 steps and lands the user on the screen where their first daily action happens.
- **AC5.4** Onboarding status is read-only after completion; analytics event fires.
- **AC5.5** Wizard is RTL-first, honors reduced motion, passes `check-i18n` for ar+en.

---

#### F6 · Teacher cockpit rethink

**Rationale:** The teacher home currently shows many lists; reduce it to "what needs my attention now."

**Build:**
- Daily landing surfaces now-actions: revisions to review, recordings pending, at-risk students, today's appointments.
- Grade in ≤ 3 taps from the cockpit.
- Review queue integrates F2's page-anchored review (page image beside audio).
- Roster rows show page-based progress and revision adherence from F1/F3.

**Acceptance criteria:**
- **AC6.1** Teacher home loads with a single prioritized list of "now" actions sorted by urgency (pending review > at-risk > today's appointments).
- **AC6.2** Recording review opens with page image + playback on one screen (F2).
- **AC6.3** Grade action from roster or review screen is reachable in ≤ 3 taps.
- **AC6.4** At-risk reasons (missed sessions, broken streak, grade gap) are visible without tapping into a student.
- **AC6.5** Teacher home avoids N+1 student-progress fetches by using a batched endpoint or inline roster progress.
- **AC6.6** All new screens pass the `impeccable critique` gate, `tsc --noEmit`, and `check-i18n`.

---

#### F7 · Streak-risk nudges + digest surfacing

**Rationale:** The digest and notification infra exist; connect them to the loop to prevent drop-off.

**Build:**
- End-of-day-minus-2h push if no activity and streak about to lapse (max 1/day, opt-out respected).
- Parent weekly digest adds pages-memorized-this-week + revision adherence (from F1/F3).

**Acceptance criteria:**
- **AC7.1** A student whose streak lapses at end-of-day-minus-2h with no activity receives exactly one push that day; opt-out via existing notification prefs is respected; window logic unit-tested.
- **AC7.2** Parent weekly digest includes pages memorized this week and revision adherence; existing digest tests extended, not replaced.
- **AC7.3** Digest send remains idempotent per week per parent (existing pin holds).

---

### H3 — Acquisition & Academy-Readiness

#### F8 · Public landing + certificate share image

**Rationale:** The verify page is a bare fact; make it a shareable acquisition surface.

**Build:**
- `AcademyProfile` model + `public/` module.
- 1200×630 share PNG (≤ 200KB) generated server-side for certificates/ijazahs.
- Revoked certificate → 404 for the share image.
- WhatsApp-first share sheet copy.

**Acceptance criteria:**
- **AC8.1** The share sheet is WhatsApp-first in ordering/copy; share URL opens the improved verify page with academy branding.
- **AC8.2** `GET /public/certificates/:token/share.png` returns a 1200×630 PNG ≤ 200KB with achievement, endorsing teacher, and program name.
- **AC8.3** Regenerating a certificate link invalidates the old share image URL immediately.
- **AC8.4** No PII beyond what is already on the public verify page leaks in the image.
- **AC8.5** Public landing `/public` renders academy profile data without authentication; mobile route group exists.

---

#### F9 · Academy Health one-pager

**Rationale:** Admins need a single screen to show a director or board.

**Build:**
- `GET /admin/academy-health` aggregate (≤ 2s read, Redis-cached with graceful fallback).
- Mobile admin screen with the aggregate + PDF export (≤ 5s).
- Extend response with loop metrics: `learning.pagesMemorizedThisWeek` and `learning.revisionAdherencePct`.

**Acceptance criteria:**
- **AC9.1** Aggregate endpoint returns: total students, active this week, pages memorized this week, revision adherence %, at-risk count, teacher load distribution, completion rate.
- **AC9.2** Read ≤ 2s with Redis, ≤ 5s without; cache hit asserted by integration test.
- **AC9.3** PDF export ≤ 5s and includes the same metrics.
- **AC9.4** Screen is usable in a board meeting (large text, high contrast, printable).

---

#### F10 · Admin + Parent + Shared UX rethink

**Rationale:** Remaining screens from the rebuild's UX brainstorm gate need attention.

**Build:**
- Admin home as action center + one-pager entry.
- Parent home as child-summary cards + quick deep-links to progress/revisions/grades/appointments.
- Notification → conversation deep-links.

**Acceptance criteria:**
- **AC10.1** Admin home surfaces the three most common actions (approve users, broadcast, academy health) above the fold.
- **AC10.2** Parent home shows each linked child as a card with progress %, streak status, and next appointment.
- **AC10.3** Tapping a notification opens the relevant conversation, appointment, or grade detail.
- **AC10.4** Parent home moves beyond read-only and exposes quick actions: message teacher, view child's Mushaf page, opt into micro-goal reminders (optional; at minimum surface the child's current page/surah).
- **AC10.5** Full a11y/i18n/theme gates pass.

---

#### F11 · Offline resilience for the hifz loop

**Rationale:** The app is used in mosques/madrasas with weak connectivity; the loop must survive.

**Build:**
- "Download my Mushaf" action prefetches the student's memorized + queued pages (bounded set, not all 604) to the image disk cache with progress bar.
- Page-status marks (F1) and revision completions (F3) queue offline and sync on reconnect (TanStack mutation persistence already dehydrates).
- Recording upload retries automatically on reconnect with bounded retries and user-visible failure state.
- Read-only screens render last-known data offline instead of error states.

**Acceptance criteria:**
- **AC11.1** Memorized + queued pages open in airplane mode after download; progress bar shows cache fill.
- **AC11.2** Offline page-status marks and revision completions persist across app kill and sync on reconnect; a "pending sync" badge shows queued count.
- **AC11.3** A queued-then-failed recording upload is recoverable from the recordings screen (retry/delete).
- **AC11.4** Home, grades, and cached Mushaf pages render last-known data offline; no infinite spinners.

---

## 4. Independent additions not in the committed roadmap

These were surfaced by direct code review and are worth tracking as follow-ups or replacements if priorities shift:

| # | Capability | Why it matters | Suggested re-entry gate |
|---|------------|----------------|-------------------------|
| **A1** | **Product analytics / event log** | Today there is no evidence of user behavior beyond the admin analytics screen. Without event instrumentation, every UX rethink is guesswork. | Add `Event { userId, name, payload Json, createdAt }` and a thin `trackEvent()` helper; start with onboarding funnel, revision completion, recording upload, share clicks. |
| **A2** | **Batch teacher actions** | Teachers with many students currently tap one by one. Batch "mark attended + graded" for a halaqa session would save hours per week. | After F6; depends on session-record + attendance data. |
| **A3** | **Tajweed / recitation AI scoring** | Already deferred in the committed roadmap for vendor/privacy reasons. The right prerequisite is F2 (page-anchored audio), which gives the data shape needed to attribute mistakes to ayahs later. | Signed DPA + budget decision; prerequisite F2 shipped. |
| **A4** | **Web admin cockpit** | Academy directors and teachers with poor eyesight may prefer a large-screen view. The typed contract layer makes a web client cheap to add. | First academy pilot explicitly requests it or F9 proves too cramped on mobile. |
| **A5** | **Multi-tenancy / white-label** | Once >1 academy is signed, isolation becomes necessary. Large blast radius; do after H3. | ≥ 2 academies signed and F8/F9 are the pitch tools. |
| **A6** | **Teacher voice-note feedback** | Tajweed corrections are tonal; typing them is slow and lossy. | Add `teacherAudioNoteUrl` to `Recording`; reuse existing player UI; ship after F2 page-anchored review. |
| **A7** | **Parent-led micro-goal reminders** | Parents currently see a read-only banner; converting them to active supporters of daily practice is high-value. | Add `StudentGoal { parentId, studentId, dailyPages, timeOfDay, active }` + push; count completion toward streak. |
| **A8** | **Teacher pre-session prep sheet** | Teacher home shows counts but not compiled context; this is the fastest way to cut grading/review taps. | Auto-generate a one-pager from recent recording, weak-ayah flags, due revisions, and page progress per session. |

---

## 5. Sequencing & dependencies

```
F4a (migrations) ─┐
                  ├─► F1 (pages) ─► F2 (recite) ─► F3 (revision) ─► H2: F5 ─► F6 ─► F7 ─► H3: F8 ─► F9 ─► F10 ─► F11
F4b (assets) ─────┘                                                  (F5 needs F2; F6 needs F1–F3; F9 needs F1/F3 metrics)
```

**Critical path:** F4a → F1 → F2 → F3. Until these four are green, the product is still a management tool, not a daily instrument.

**Parallel tracks:**
- F4b (asset pipeline) can run alongside F1–F3.
- F5–F7 can begin as soon as F2/F3 contracts are stable.
- F8–F11 are sequential after the loop is closed.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| F1 page-status writes race with F3 queue reads | Queue is a pure function over rows; no denormalized counters to corrupt. |
| F2/F11 multipart upload remains the last contract holdout | Track explicitly as part of F2; either move to signed URL or document why raw FormData is required; add focused security review. |
| F3 interval tuning is pedagogy, not code | Ship conservative classical defaults (1/3/7-day bands); teacher override (AC3.4) is the escape hatch; make bands config constants, not schema. |
| F6 teacher home N+1 progress fetches | Add batch/inline endpoint as part of F6; verify with load test. |
| F10 parent role beyond read-only expands scope | Fence parent actions to messaging + page view + opt-in nudges; do not build full parent scheduling until after core loop is green. |
| F11 offline sync conflicts (same page marked on two devices) | Last-write-wins on `updatedAt` — acceptable for single-student-owned rows; document the behavior. |
| UX rathinks (F5, F6, F10) need brainstorm gate | Follow the established process: brainstorm → spec → plan before any screen code. |
| Zero mobile automated tests | Add unit tests for new hooks as part of F1/F2/F3 and run them in CI. |
| Product analytics (A1) missing means UX decisions are blind | Instrument the onboarding + loop events as part of F5/F6; don't wait for a separate analytics vendor. |

---

## 7. Definition of done (roadmap-level)

1. A student's daily loop works end-to-end: open app → today's revision queue → read the real Mushaf page → recite & record from it → teacher reviews with the page on screen → progress and streak update — with zero manual scheduling.
2. `pagesMemorized/604` is the single progress number shown to student, teacher, parent, and academy-health report.
3. A new user of any role reaches their first meaningful action in ≤ 90 seconds (F5, measured).
4. An academy director can open one screen (F9) and share one certificate image (F8) to pitch the platform.
5. A fresh clone + empty database reaches a running, fully-populated system (migrations, seed, ayahs, Mushaf images) with documented one-command steps (F4).
6. All existing suites stay green throughout; every new endpoint is in the authz matrix; `security-reviewer` signs off on F5 (auth/onboarding), F8 (public), F9 (admin), and F11 (offline/sync).
7. Mobile automated test coverage: at least unit tests for new hooks (F1–F3) and one design-system smoke test; mobile `tsc --noEmit` and `check-i18n` run in CI.
