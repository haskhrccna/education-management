# E2E Plan 2: Teacher + Admin Smoke Flows & Journeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Maestro E2E suite (built in Plan 1) with testIDs + Layer-1 smoke flows for the **teacher** and **admin** screen groups, plus the four teacher/admin-centric Layer-2 journeys (7, 9, 12, 13), keeping `COVERAGE.md` complete.

**Architecture:** Reuse the Plan 1 harness verbatim — `mobile/e2e/run.sh` (dedicated test DB on 5433, reset → `seed-e2e.ts` → server-on-E2E-DB check → `maestro test`), `_helpers/boot.yaml`, `_helpers/login.yaml`, `mobile/scripts/check-testids.js`, `covered-screens.json`. Each smoke task adds `testID="<screen>.<element>"` to a screen group, appends those screens to `covered-screens.json`, writes one flow file per screen that visits it and taps every control asserting the observable effect, and records every control in `COVERAGE.md`. Journey flows live in `mobile/e2e/flows/journeys/` and are multi-role, self-contained.

**Tech Stack:** Maestro 2.8.0 · Expo dev-client (iOS Simulator, iPhone 17 Pro Max / iOS 26.2) · React Native / expo-router · the existing Express+Prisma server on the E2E DB.

## Global Constraints

- **testID convention:** `testID="<screen>.<element>"`, kebab-case; list rows index-suffixed: `` testID={`<screen>.<row>.${index}`} `` (verbatim from the E2E design §3). Root container of every screen → `<screen>.screen`.
- **Flows select ONLY by testID, never by text** (immune to AR/EN switch). The sole sanctioned text-selector exceptions are OS/tooling chrome already documented in `COVERAGE.md` (iOS AutoFill sheet, Expo dev-launcher, iOS "Open in <app>?" dialog handled in `boot.yaml`).
- **No blind `sleep`** in flow YAML — use `extendedWaitUntil` on testIDs (E2E design §6).
- **Every `launchApp: clearState: true` MUST be immediately preceded by `- clearKeychain`** (BUGLOG "Task 8 addendum 2" — iOS keychain survives clearState and leaks the prior session otherwise).
- **A failing flow is a finding, never something to weaken** (E2E design §6): classify as app bug (log in `mobile/e2e/BUGLOG.md`; fix only if in scope, else file for follow-up) or test bug (fix the flow). Only change an assertion when the asserted behaviour is confirmed wrong.
- **i18n:** any new key needs both `ar` and `en` (project rule) — Plan 2 should need none; testIDs are not translated.
- **DB safety:** never `prisma migrate reset` against anything but the E2E DB on `localhost:5433`; the harness `run.sh` already scopes this. Never touch the dev DB.
- **Role case:** server/JWT UPPERCASE, mobile store lowercase (see `CLAUDE.md`). Not touched by this plan, but journey assertions must use the mobile lowercase where they read the store.

---

## Prerequisites (implementer must verify before Task 1)

- [ ] Plan 1 is merged to `main`; branch this work from the latest `main`.
- [ ] E2E DB reachable: `docker start server-db-test-1` then `docker exec server-db-test-1 pg_isready -U postgres`. If the volume is empty, `DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npx prisma migrate deploy` (safe on empty DB — NEVER `migrate reset` here without explicit human consent) then `npx ts-node packages/server/src/prisma/seed-e2e.ts`.
- [ ] Server running against the E2E DB: `cd packages/server && DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npm run dev`.
- [ ] Simulator booted; the "Open in <app>?" scheme dialog is handled by `boot.yaml`'s optional `tapOn: "Open"` — no manual priming needed.
- [ ] Sanity: `bash mobile/e2e/run.sh flows/auth` and `bash mobile/e2e/run.sh flows/student` both PASS on the current `main` (proves the harness is intact before adding to it).

**Standard testID procedure (referenced by every smoke task below):** (1) open the screen file; (2) root `SafeAreaView`/`View` container → `testID="<screen>.screen"`; (3) every `TouchableOpacity`/`Pressable`/`TextInput`/`Switch`/`IconButton` → `testID="<screen>.<purpose>"`, where `<purpose>` names the action, derived from its `onPress` target or label key (e.g. `router.push('/teacher/appointments')` → `teacher-home.appointments`); (4) controls rendered inside `.map()`/`FlatList` get `` testID={`<screen>.<row>.${index}`} ``; the header back control → `<screen>.back`; (5) append the file path to `mobile/e2e/covered-screens.json`; (6) `node mobile/scripts/check-testids.js` must stay green. **Every control added = one row added to `COVERAGE.md` in the same commit.**

**Seed accounts (from `seed-e2e.ts`):** `teacher@quran-review.com`/`Teacher1234!` (Ahmad — ACCEPTED appointment with Ali), `admin@quran-review.com`/`Admin1234!`, `ali@quran-review.com`/`Student1234!` (has grades, a report, a recording, notifications), `sarah@quran-review.com`/`Teacher1234!` (second teacher), `student@quran-review.com`/`Student1234!` (Omar — REQUESTED appointment with Sarah), `fatima@quran-review.com` (PENDING student), `parent@`/`parent2@`/`parent3@` (`Parent1234!`).

**Screen-group login map (E2E design §4):** teacher group → `teacher@`; admin group → `admin@`. Every flow: `- clearKeychain` → `launchApp: { clearState: true }` → `runFlow _helpers/login.yaml` with the role's EMAIL/PASSWORD → assert `<role>-home.screen` → exercise the screen.

---

### Task 1: Teacher smoke A — home, appointments, grade-form, student-detail

**Files:**
- Modify (testIDs on root + every control): `mobile/app/teacher/home.tsx` (has 4 testIDs today — complete the set), `mobile/app/teacher/appointments.tsx` (8 today), `mobile/app/teacher/grade-form.tsx` (6 today), `mobile/app/teacher/student-detail.tsx` (0 today).
- Modify: `mobile/e2e/covered-screens.json` (append the 4 teacher screens).
- Create: `mobile/e2e/flows/teacher/01-home-smoke.yaml`, `02-appointments-smoke.yaml`, `03-grade-form-smoke.yaml`, `04-student-detail-smoke.yaml`.
- Modify: `mobile/e2e/COVERAGE.md` (a `## Teacher group` section + per-control rows).
- Test: `node mobile/scripts/check-testids.js` green; `bash mobile/e2e/run.sh flows/teacher` PASS.

**Interfaces:**
- Consumes: `_helpers/login.yaml` (EMAIL/PASSWORD env), `bottom-nav.*` teacher tab testIDs (already present from the BottomNav work: `bottom-nav.teacher-home`, etc. — verify the exact ids in `mobile/src/components/BottomNav.tsx`).
- Produces: root testIDs `teacher-home.screen`, `teacher-appointments.screen`, `teacher-grade-form.screen`, `teacher-student-detail.screen`; the nav testIDs `teacher-home.student-card.${index}` (opens student-detail — consumed by Journey 7/12/13 setup), `teacher-appointments.accept.${index}` / `teacher-appointments.decline.${index}` (verify exact names; consumed by Journey 2 which already exists), `teacher-grade-form.submit` (consumed by Journey 3 which already exists).

- [ ] **Step 1: Add/complete testIDs on the 4 screens** using the Standard testID procedure. Known anchors: `teacher/home.tsx` — header notifications/messages/account controls, the student-list `.map()` → `teacher-home.student-card.${index}`, quick links to appointments/recordings/reports/revisions/plans/ijazahs. `teacher/appointments.tsx` — per-row accept/decline/reschedule controls (`.map()` → `teacher-appointments.<action>.${index}`), any status filter chips. `teacher/grade-form.tsx` — student select, surah select, grade input, type selector, notes input, submit (`teacher-grade-form.submit`). `teacher/student-detail.tsx` — header back (`teacher-student-detail.back`), the tabs/sections and any per-item links; **BUGLOG note:** `student-detail` reads the student name from a `name` route param and falls back to literal "Student" when absent — assert on `teacher-student-detail.screen` (root), not on a name string.

- [ ] **Step 2: Write `01-home-smoke.yaml` fully** — the pattern for all teacher flows:

```yaml
appId: com.quranreview.app
tags: [teacher, smoke]
---
- clearKeychain
- launchApp:
    clearState: true
- runFlow:
    file: ../_helpers/login.yaml
    env:
      EMAIL: teacher@quran-review.com
      PASSWORD: Teacher1234!
- extendedWaitUntil:
    visible:
      id: "teacher-home.screen"
    timeout: 20000
# every nav control: tap -> assert destination root testID -> return home
- tapOn: { id: "teacher-home.appointments" }
- extendedWaitUntil: { visible: { id: "teacher-appointments.screen" }, timeout: 10000 }
- tapOn: { id: "bottom-nav.teacher-home" }
- extendedWaitUntil: { visible: { id: "teacher-home.screen" }, timeout: 10000 }
# repeat tap->assert->return for each remaining home control (recordings, reports,
# revisions, plans, ijazahs, notifications, messages, account, first student-card).
# Where a destination has no `.screen` id yet in this task, add it in Step 1, or use
# `assertVisible: { id: "<dest>.back" }` + tap that back control to return.
```

- [ ] **Step 3: Write `02`, `03`, `04` flows** (concrete, each control = a COVERAGE row):
  - `02-appointments-smoke.yaml`: login → tab to appointments → assert `teacher-appointments.screen` + at least one row from Ali's ACCEPTED appointment → exercise any status-filter chips (tap each, assert list still renders) → **do NOT** accept/decline (that mutation belongs to Journey 2/7; assert the controls are visible only) → return home.
  - `03-grade-form-smoke.yaml`: reach grade-form (from home or `openLink: quran-review://teacher/grade-form`) → assert `teacher-grade-form.screen` → tap student select, surah select, type selector, fill grade + notes → assert `teacher-grade-form.submit` is visible/enabled → **do NOT submit** (Journey 3 covers submission) → back.
  - `04-student-detail-smoke.yaml`: from `teacher-home.student-card.0` → assert `teacher-student-detail.screen` → tap each section/tab/link, asserting its effect → `teacher-student-detail.back` → assert `teacher-home.screen`.

- [ ] **Step 4: Red → green.** `node mobile/scripts/check-testids.js && bash mobile/e2e/run.sh flows/teacher`. Expected: all four teacher-A flows PASS. Any failure → classify (app bug → BUGLOG; test bug → fix flow) per the Global Constraints.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/teacher/home.tsx mobile/app/teacher/appointments.tsx mobile/app/teacher/grade-form.tsx mobile/app/teacher/student-detail.tsx mobile/e2e/covered-screens.json mobile/e2e/flows/teacher mobile/e2e/COVERAGE.md
git commit -m "feat(e2e): teacher smoke A — home/appointments/grade-form/student-detail testIDs + flows"
```

---

### Task 2: Teacher smoke B — recordings, reports, revisions, plans, ijazahs

**Files:**
- Modify (testIDs, Standard procedure): `mobile/app/teacher/recordings.tsx`, `reports.tsx`, `revisions.tsx`, `plans.tsx`, `ijazahs.tsx` (all 0 testIDs today).
- Modify: `mobile/e2e/covered-screens.json` (append the 5 screens).
- Create: `mobile/e2e/flows/teacher/05-recordings-smoke.yaml`, `06-reports-smoke.yaml`, `07-revisions-smoke.yaml`, `08-plans-smoke.yaml`, `09-ijazahs-smoke.yaml`.
- Modify: `mobile/e2e/COVERAGE.md`.
- Test: `node mobile/scripts/check-testids.js` green; `bash mobile/e2e/run.sh flows/teacher` PASS (all 9 teacher flows).

**Interfaces:**
- Consumes: teacher login; `teacher-home.*` links from Task 1.
- Produces: root testIDs `teacher-recordings.screen`, `teacher-reports.screen`, `teacher-revisions.screen`, `teacher-plans.screen`, `teacher-ijazahs.screen`; the create-form controls `teacher-plans.toggle-form` / `teacher-plans.student.${index}` / `teacher-plans.surah.${index}` / `teacher-plans.add-item` / `teacher-plans.submit` (consumed by Journey 12) and `teacher-ijazahs.toggle-form` / `teacher-ijazahs.student.${index}` / `teacher-ijazahs.scope.${index}` / `teacher-ijazahs.submit` (consumed by Journey 13).

- [ ] **Step 1: Add testIDs** via the Standard procedure. Known anchors (verified line refs may drift — the implementer re-checks): `recordings.tsx` — filter chips (~273), back (~293), FlatList rows with play/approve/reject/flag (~369, ~458, ~620, ~623), review modal input+submit (~400, ~425). `reports.tsx` — back (~140), toggle-form (~150), student picker `.map()` (~175), title/body inputs (~197, ~216), submit (~236), row download (~299). `revisions.tsx` — back (~299), toggle-form (~303), SURAH/DRILL mode toggles (~316, ~327), student/surah pickers (~347, ~372), per-row complete/missed/delete (~267, ~276, ~283). `plans.tsx` — back (~212), toggle-form (~216) → `teacher-plans.toggle-form`, student picker (~233) → `teacher-plans.student.${index}`, surah picker (~269) → `teacher-plans.surah.${index}`, target-date input (~288), add-item (~299) → `teacher-plans.add-item`, staged-item remove (~311), submit (~319) → `teacher-plans.submit`, list rows (~338). `ijazahs.tsx` — back (~164), toggle-form (~168) → `teacher-ijazahs.toggle-form`, student picker (~183) → `teacher-ijazahs.student.${index}`, scope buttons SURAH/JUZ/FULL_QURAN (~220) → `teacher-ijazahs.scope.${index}`, surah picker (~239), grade + notes inputs (~262, ~274), submit (~282) → `teacher-ijazahs.submit`, issued-list rows.

- [ ] **Step 2: Write the 5 flows** (login as `teacher@`; reach each screen from `teacher-home.*` or `openLink: quran-review://teacher/<screen>`; assert `<screen>.screen`; open the create form via its toggle, tap each picker/field, assert the submit control is visible; **do NOT submit** create forms — Journeys 12/13 own those mutations; for list-row action controls that mutate (approve/reject/complete/missed/delete/download), assert the control is visible and, where a confirm dialog appears, open then cancel it — do not commit the mutation; back to home). Mirror the fully-written `01-home-smoke.yaml` structure.

- [ ] **Step 3: Red → green.** `node mobile/scripts/check-testids.js && bash mobile/e2e/run.sh flows/teacher`. Expected: 9/9 teacher flows PASS. Classify any failure (BUGLOG vs flow fix).

- [ ] **Step 4: Commit**

```bash
git add mobile/app/teacher/recordings.tsx mobile/app/teacher/reports.tsx mobile/app/teacher/revisions.tsx mobile/app/teacher/plans.tsx mobile/app/teacher/ijazahs.tsx mobile/e2e/covered-screens.json mobile/e2e/flows/teacher mobile/e2e/COVERAGE.md
git commit -m "feat(e2e): teacher smoke B — recordings/reports/revisions/plans/ijazahs testIDs + flows"
```

---

### Task 3: Admin smoke A — home, user-detail, change-requests, broadcast

**Files:**
- Modify (testIDs, Standard procedure): `mobile/app/admin/home.tsx` (2 today), `user-detail.tsx` (0), `change-requests.tsx` (4), `broadcast.tsx` (0).
- Modify: `mobile/e2e/covered-screens.json` (append the 4 admin screens).
- Create: `mobile/e2e/flows/admin/01-home-smoke.yaml`, `02-user-detail-smoke.yaml`, `03-change-requests-smoke.yaml`, `04-broadcast-smoke.yaml`.
- Modify: `mobile/e2e/COVERAGE.md` (`## Admin group`).
- Test: `node mobile/scripts/check-testids.js`; `bash mobile/e2e/run.sh flows/admin` PASS.

**Interfaces:**
- Consumes: admin login (`admin@`/`Admin1234!`), admin `bottom-nav.*` ids.
- Produces: `admin-home.screen`, `admin-user-detail.screen`, `admin-change-requests.screen`, `admin-broadcast.screen`; `admin-home.user-row.${index}` (opens user-detail), `admin-change-requests.approve.${index}` / `.reject.${index}` (consumed by Journey 7), `admin-broadcast.target.${index}` / `admin-broadcast.message` / `admin-broadcast.send` (consumed by Journey 9).

- [ ] **Step 1: Add testIDs** (Standard procedure). Known anchors: `broadcast.tsx` — back (~58), target chips `.map()` (~74) → `admin-broadcast.target.${index}`, message input (~93) → `admin-broadcast.message`, send (~107) → `admin-broadcast.send`. `user-detail.tsx` — back (~133), edit toggle (~143), the field inputs (~160–199), save (~207), teacher/student list rows (~239, ~259), delete (~381) → `admin-user-detail.delete`. `home.tsx` and `change-requests.tsx` — inventory their controls (user list rows, section links, per-request approve/reject) and name them `admin-home.*` / `admin-change-requests.*`.

- [ ] **Step 2: Write the 4 flows.** `01-home-smoke.yaml` fully (login as `admin@` → assert `admin-home.screen` → tap each home nav control → assert destination `.screen` → return; open the first user row → assert `admin-user-detail.screen` → back). `02-user-detail-smoke.yaml`: open a user from home → assert screen → toggle edit, assert inputs appear → **do NOT save/delete** → back. `03-change-requests-smoke.yaml`: reach the screen → assert `admin-change-requests.screen` → assert approve/reject controls are visible on any seeded request → **do NOT decide** (Journey 7 owns that) → back. `04-broadcast-smoke.yaml`: reach broadcast → assert screen → tap each target chip, fill message → assert `admin-broadcast.send` enabled → **do NOT send** (Journey 9 owns that) → back.

- [ ] **Step 3: Red → green.** `node mobile/scripts/check-testids.js && bash mobile/e2e/run.sh flows/admin`. Classify failures.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/admin/home.tsx mobile/app/admin/user-detail.tsx mobile/app/admin/change-requests.tsx mobile/app/admin/broadcast.tsx mobile/e2e/covered-screens.json mobile/e2e/flows/admin mobile/e2e/COVERAGE.md
git commit -m "feat(e2e): admin smoke A — home/user-detail/change-requests/broadcast testIDs + flows"
```

---

### Task 4: Admin smoke B — analytics, audit-logs, milestones, settings, academy-health, academy-profile

**Files:**
- Modify (testIDs, Standard procedure): `mobile/app/admin/analytics.tsx`, `audit-logs.tsx`, `milestones.tsx`, `settings.tsx`, `academy-health.tsx`, `academy-profile.tsx` (all 0 today).
- Modify: `mobile/e2e/covered-screens.json` (append the 6 screens).
- Create: `mobile/e2e/flows/admin/05-analytics-smoke.yaml`, `06-audit-logs-smoke.yaml`, `07-milestones-smoke.yaml`, `08-settings-smoke.yaml`, `09-academy-health-smoke.yaml`, `10-academy-profile-smoke.yaml`.
- Modify: `mobile/e2e/COVERAGE.md`.
- Test: `node mobile/scripts/check-testids.js`; `bash mobile/e2e/run.sh flows/admin` PASS (all 10 admin flows).

**Interfaces:**
- Consumes: admin login; `admin-home.*` links from Task 3.
- Produces: `admin-analytics.screen`, `admin-audit-logs.screen`, `admin-milestones.screen`, `admin-settings.screen`, `admin-academy-health.screen`, `admin-academy-profile.screen`, each with `<screen>.back`. Note: `audit-logs` and `milestones` already carry `<BottomNav active="none">` from the fix-pass — do not disturb that.

- [ ] **Step 1: Add testIDs** (Standard procedure). For each screen: root → `<screen>.screen`; header back → `<screen>.back`; every filter chip / segment / date control / retry / empty-state / list row → `<screen>.<purpose>` (rows index-suffixed). `settings.tsx` — language control, dark-mode switch, and any other toggles must each get a testID (these are also exercised by Journey 14 in Plan 3, so name them stably: `admin-settings.language`, `admin-settings.dark-mode`). `audit-logs.tsx` — actor/action/date filters + rows. `academy-profile.tsx` — the edit form inputs + save (assert only; do not save). `academy-health.tsx` / `analytics.tsx` / `milestones.tsx` — mostly read-only metric tiles: root + back + any refresh/segment control.

- [ ] **Step 2: Write the 6 flows.** Each: login as `admin@` → reach the screen from `admin-home.*` or `openLink: quran-review://admin/<screen>` → assert `<screen>.screen` → tap each interactive control asserting its effect (filter re-renders list, segment switches, refresh reloads) → for `academy-profile` open the edit form and assert inputs, **do NOT save** → `<screen>.back` → assert `admin-home.screen`. `settings` flow: toggle dark-mode on then off (assert the switch state each way) and open the language control, **but do NOT switch language** here (the RTL flip + relaunch is Journey 14/Plan 3) — assert the control is present and dismiss.

- [ ] **Step 3: Red → green.** `node mobile/scripts/check-testids.js && bash mobile/e2e/run.sh flows/admin`. Expected 10/10 admin flows PASS. Classify failures.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/admin/analytics.tsx mobile/app/admin/audit-logs.tsx mobile/app/admin/milestones.tsx mobile/app/admin/settings.tsx mobile/app/admin/academy-health.tsx mobile/app/admin/academy-profile.tsx mobile/e2e/covered-screens.json mobile/e2e/flows/admin mobile/e2e/COVERAGE.md
git commit -m "feat(e2e): admin smoke B — analytics/audit-logs/milestones/settings/academy-health/academy-profile testIDs + flows"
```

---

### Task 5: Journeys 7 + 9 — teacher-change→admin-approve→reassign, admin-broadcast→notification

**Files:**
- Create: `mobile/e2e/flows/journeys/07-teacher-change-reassign.yaml`, `09-admin-broadcast-notification.yaml`.
- Modify: `mobile/e2e/COVERAGE.md` (journeys section), `mobile/e2e/BUGLOG.md` (only if a finding surfaces).
- Test: each journey PASSES individually via `JAVA_HOME=/opt/homebrew/opt/openjdk maestro test mobile/e2e/flows/journeys/07-teacher-change-reassign.yaml` (and `09`), against a freshly reset+seeded E2E DB.

**Interfaces:**
- Consumes: `_helpers/login.yaml`; from Plan 1: `student/teacher-change` submit control (verify its testID name in `mobile/app/student/teacher-change.tsx` — Plan 1 named it `student-teacher-change.submit`); from Task 3: `admin-change-requests.approve.${index}`, `admin-broadcast.target.${index}`/`.message`/`.send`; the shared `notifications.screen` — add `notifications.row.${index}` if missing (adding a row testID to the shared notifications screen is in-scope here).
- Produces: nothing consumed downstream (terminal journeys).

- [ ] **Step 1: Journey 7 — teacher change → admin approve → reassignment visible.** Sequence: (a) log in as the student who will request a change (use **Omar** `student@`, who has a REQUESTED appointment with Sarah — his reassignment does not disturb Ali's ACCEPTED pairing that other flows depend on; **verify in `seed-e2e.ts`/`assignedTeacherId` who Omar can change *to*; if Omar has no assigned teacher, fall back to Ali and add a header note that this journey needs a fresh reset because it mutates Ali's assignment**) → open `student/teacher-change` (`openLink quran-review://student/teacher-change`) → submit a change request (reason text + `student-teacher-change.submit`) → assert the success/pending state. (b) `clearKeychain` + relaunch, log in as `admin@` → open `admin/change-requests` → assert the new request row is visible → tap `admin-change-requests.approve.0` → assert the row clears / success. (c) `clearKeychain` + relaunch, log in as the new teacher → assert the reassigned appointment now appears on `teacher-appointments.screen`. Header comment: this journey mutates persistent teacher assignment, so it MUST run against a fresh `run.sh` reset and is order-sensitive relative to other journeys in a bare multi-file run.

- [ ] **Step 2: Journey 9 — admin broadcast → target receives notification.** Sequence: (a) log in as `admin@` → `openLink quran-review://admin/broadcast` → tap the **students** target chip (`admin-broadcast.target.${index}` — verify which index is "students" from `broadcast.tsx`'s `chips` array) → fill `admin-broadcast.message` with a fixed string → tap `admin-broadcast.send` → assert the `broadcastSent` "OK" alert, tap OK, assert `admin-home.screen`. (b) `clearKeychain` + relaunch, log in as `ali@` (a student in the broadcast target group) → open `notifications` (`student-home.notifications`) → assert a notification row is visible (`notifications.row.0`). Assert on the row testID, not the message text (broadcast text is not testID-addressable).

- [ ] **Step 3: Verify live.** Reset+seed via `bash mobile/e2e/run.sh flows/journeys` OR run each file individually after a manual reset. Expected: both PASS. Any failure → classify (app bug → BUGLOG with repro; test bug → fix flow).

- [ ] **Step 4: Commit**

```bash
git add mobile/e2e/flows/journeys/07-teacher-change-reassign.yaml mobile/e2e/flows/journeys/09-admin-broadcast-notification.yaml mobile/e2e/COVERAGE.md
git commit -m "feat(e2e): journeys 7 (teacher-change reassign) + 9 (admin broadcast notification)"
```

---

### Task 6: Journeys 12 + 13 — teacher creates plan→student views, ijazah issued→student sees

**Files:**
- Create: `mobile/e2e/flows/journeys/12-plan-create-student-views.yaml`, `13-ijazah-issue-student-sees.yaml`.
- Modify: `mobile/e2e/COVERAGE.md`; `mobile/e2e/BUGLOG.md` only if a finding surfaces.
- Test: each PASSES individually against a fresh reset+seed.

**Interfaces:**
- Consumes: from Task 2 — `teacher-plans.toggle-form`/`.student.${index}`/`.surah.${index}`/`.add-item`/`.submit`, `teacher-ijazahs.toggle-form`/`.student.${index}`/`.scope.${index}`/`.submit`; from Plan 1 — `student-plans.screen` + row testIDs, `student-ijazahs.screen` + row testIDs, `student-certificates.screen`.
- Produces: terminal.

- [ ] **Step 1: Journey 12 — plan create → student views.** (a) Log in as `teacher@` → `openLink quran-review://teacher/plans` → `teacher-plans.toggle-form` → pick Ali (`teacher-plans.student.0` — verify Ali is index 0 among the teacher's students) → pick a surah (`teacher-plans.surah.0`) → set target-date input → `teacher-plans.add-item` → `teacher-plans.submit` → assert the new plan row appears in the teacher list. (b) `clearKeychain` + relaunch, log in as `ali@` → `openLink quran-review://student/plans` → assert `student-plans.screen` and that a plan row (`student-plans.row.0`) is now visible → open it and assert its items/progress render.

- [ ] **Step 2: Journey 13 — ijazah issued → student sees.** (a) Log in as `teacher@` → `openLink quran-review://teacher/ijazahs` → `teacher-ijazahs.toggle-form` → pick Ali (`teacher-ijazahs.student.0`) → pick scope `SURAH` (`teacher-ijazahs.scope.0`) → pick a surah → fill grade + notes → `teacher-ijazahs.submit` → assert the "Ijazah issued" success alert, dismiss → assert the new ijazah appears in the teacher's issued list. (b) `clearKeychain` + relaunch, log in as `ali@` → `openLink quran-review://student/ijazahs` → assert `student-ijazahs.screen` + a row (`student-ijazahs.row.0`) is now visible. **Verify** whether an issued ijazah also surfaces on `student/certificates`; if it does, add an assertion there; if certificates are a separate artifact with no seed/issue path, leave certificates to Plan 3 and note it in COVERAGE.md.

- [ ] **Step 3: Verify live.** Both journeys PASS individually after a fresh reset+seed. Classify failures.

- [ ] **Step 4: Commit**

```bash
git add mobile/e2e/flows/journeys/12-plan-create-student-views.yaml mobile/e2e/flows/journeys/13-ijazah-issue-student-sees.yaml mobile/e2e/COVERAGE.md
git commit -m "feat(e2e): journeys 12 (plan create->student views) + 13 (ijazah issue->student sees)"
```

---

### Task 7: Plan 2 coverage audit + close-out

**Files:**
- Modify: `mobile/e2e/COVERAGE.md` (teacher + admin groups fully audited — every screen → every control → flow file + step, or an explicit justified exclusion), `mobile/e2e/README.md` (if the teacher/admin groups need a runner note).
- Test: full teacher + admin + the four new journeys all PASS; `node mobile/scripts/check-testids.js` green.

**Interfaces:** none produced; this is the gate.

- [ ] **Step 1: Cross-check coverage.** For every teacher screen (9) and admin screen (10), grep its source for every `testID=` and confirm each has a `COVERAGE.md` row naming the flow file + step that exercises it. Any control with no row → add the row and, if the flow doesn't exercise it, extend the flow. Any deliberately-unexercised control (destructive delete, real send) → an explicit "Exclusions" row stating why (mirrors Plan 1's exclusion style).

- [ ] **Step 2: Full green run.**

```bash
node mobile/scripts/check-testids.js
bash mobile/e2e/run.sh flows/teacher
bash mobile/e2e/run.sh flows/admin
JAVA_HOME=/opt/homebrew/opt/openjdk maestro test mobile/e2e/flows/journeys/07-teacher-change-reassign.yaml
JAVA_HOME=/opt/homebrew/opt/openjdk maestro test mobile/e2e/flows/journeys/09-admin-broadcast-notification.yaml
JAVA_HOME=/opt/homebrew/opt/openjdk maestro test mobile/e2e/flows/journeys/12-plan-create-student-views.yaml
JAVA_HOME=/opt/homebrew/opt/openjdk maestro test mobile/e2e/flows/journeys/13-ijazah-issue-student-sees.yaml
```

Expected: teacher 9/9, admin 10/10, journeys 4/4 PASS; check-testids green with the new screen count (16 from Plan 1 + 9 teacher + 10 admin = 35).

- [ ] **Step 3: Commit + close-out**

```bash
git add mobile/e2e/COVERAGE.md mobile/e2e/README.md
git commit -m "docs(e2e): Plan 2 coverage audit + close-out — teacher + admin fully accounted"
```

Then invoke `superpowers:finishing-a-development-branch`.

---

## Self-Review

**1. Spec coverage** (design §7 Plan 2 = "testIDs + smoke flows for teacher and admin groups, journeys 7, 9, 12, 13"):
- Teacher group (9 screens) → Tasks 1–2 ✓. Admin group (10 screens) → Tasks 3–4 ✓. Journey 7 → Task 5 ✓. Journey 9 → Task 5 ✓. Journey 12 → Task 6 ✓. Journey 13 → Task 6 ✓. Coverage audit (design §4 "a control with no row is a plan bug") → Task 7 ✓.
- Out of scope, correctly deferred to Plan 3: parent/shared/onboarding/public groups; journeys 4,5,6,8,14; final whole-app COVERAGE audit.

**2. Placeholder scan:** the smoke tasks intentionally follow Plan 1's proven "Standard procedure + known anchors + one fully-written example flow + concrete per-screen descriptions" model rather than enumerating every testID — this matches how Plan 1 (merged, all flows green) was written and executed. Line-number anchors are marked as drift-prone ("re-check"). No "TBD"/"implement later" left. Journey steps that depend on a runtime fact (which chip index is "students", whether an ijazah surfaces on certificates, which teacher Omar can change to) carry an explicit **verify-against-source** instruction — the same controlled-discovery pattern Plan 1 used ("adjust to the actual post-register destination found in Task 4").

**3. Type/name consistency:** cross-task testIDs are declared in each task's **Produces** and consumed by name in the journey tasks: `teacher-plans.submit`, `teacher-ijazahs.submit`/`.scope.${index}`/`.student.${index}`, `admin-change-requests.approve.${index}`, `admin-broadcast.target.${index}`/`.message`/`.send`, `student-teacher-change.submit`, `notifications.row.${index}` — all spelled identically at declaration and use.
