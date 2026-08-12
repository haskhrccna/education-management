# E2E Coverage — Auth Screens (Task 4)

One row per control (testID) on the 4 auth screens covered by `flows/auth/`, cross-checked against Task 3's full testID inventory (`.superpowers/sdd/task-3-report.md`). No control is missing.

| screen | control (testID) | flow file | step |
|---|---|---|---|
| login | `login.screen` | `02-register-smoke.yaml` | asserted visible after tapping `register.back-link` (return to login) |
| login | `login.screen` | `04-pending-approval-smoke.yaml` | asserted visible as the final step, after `pending-approval.logout` |
| login | `login.email` | `01-login-smoke.yaml` | filled via `_helpers/login.yaml`, both the wrong-password and correct-password attempts |
| login | `login.password` | `01-login-smoke.yaml` | filled via `_helpers/login.yaml`, both attempts |
| login | `login.submit` | `01-login-smoke.yaml` | tapped via `_helpers/login.yaml`, both attempts |
| login | `login.error` | `01-login-smoke.yaml` | asserted visible after the wrong-password attempt |
| login | `login.error` | `04-pending-approval-smoke.yaml` | asserted visible after fatima's (PENDING) login is rejected (403) |
| login | `login.forgot-link` | `01-login-smoke.yaml` | tapped to open forgot-password |
| login | `login.register-link` | `01-login-smoke.yaml` | tapped to open register |
| login | `login.register-link` | `02-register-smoke.yaml` | tapped (initial open, and again after the remount) |
| login | `login.register-link` | `04-pending-approval-smoke.yaml` | tapped after fatima's rejected login |
| register | `register.screen` | `01-login-smoke.yaml` | asserted visible after tapping `login.register-link` |
| register | `register.screen` | `02-register-smoke.yaml` | asserted visible (initial open, and again after the remount) |
| register | `register.error` | `02-register-smoke.yaml` | asserted visible after submitting the form empty |
| register | `register.first-name` | `02-register-smoke.yaml` | filled |
| register | `register.first-name` | `04-pending-approval-smoke.yaml` | filled |
| register | `register.last-name` | `02-register-smoke.yaml` | filled |
| register | `register.last-name` | `04-pending-approval-smoke.yaml` | filled |
| register | `register.email` | `02-register-smoke.yaml` | filled with the unique fixture email |
| register | `register.email` | `04-pending-approval-smoke.yaml` | filled with the unique fixture email |
| register | `register.password` | `02-register-smoke.yaml` | filled inside the `retry:` block (see BUGLOG.md AutoFill note) |
| register | `register.password` | `04-pending-approval-smoke.yaml` | filled inside the same `retry:` block |
| register | `register.submit` | `02-register-smoke.yaml` | tapped (empty-submit case, and the real submission) |
| register | `register.submit` | `04-pending-approval-smoke.yaml` | tapped |
| register | `register.back-link` | `01-login-smoke.yaml` | tapped to return to login |
| register | `register.back-link` | `02-register-smoke.yaml` | tapped to force the screen remount before real data entry |
| forgot-password | `forgot-password.screen` | `01-login-smoke.yaml` | asserted visible after tapping `login.forgot-link` |
| forgot-password | `forgot-password.screen` | `03-forgot-password-smoke.yaml` | asserted visible (open), and again after the empty-submit no-op |
| forgot-password | `forgot-password.email` | `03-forgot-password-smoke.yaml` | filled |
| forgot-password | `forgot-password.submit` | `03-forgot-password-smoke.yaml` | tapped twice — once disabled (email empty), once with email filled |
| forgot-password | `forgot-password.success` | `03-forgot-password-smoke.yaml` | asserted visible as the flow's final step, after submitting with a real email — the `successCard` `View` shown in place of the form once `submitted` is true. **Coverage-audit correction (Task 10):** this row was missing from the table despite the control existing in source since Task 4's review fix-pass and being exercised by this flow the whole time — found by this task's full audit cross-check of every `testID` in the 17 covered source files against this document. |
| forgot-password | `forgot-password.back-link` | `01-login-smoke.yaml` | tapped to return to login |
| pending-approval | `pending-approval.screen` | `02-register-smoke.yaml` | asserted visible as the post-register destination |
| pending-approval | `pending-approval.screen` | `04-pending-approval-smoke.yaml` | asserted visible after registration completes |
| pending-approval | `pending-approval.header` | `04-pending-approval-smoke.yaml` | asserted visible |
| pending-approval | `pending-approval.logout` | `04-pending-approval-smoke.yaml` | tapped, returns to `login.screen` |

## Not applicable to this coverage table

- `bottom-nav.*` (shared `BottomNav` component) and the `IconButton` `testID` prop are Task 3 infrastructure, not controls that live *on* any of the 4 auth screens — no auth screen renders either. Excluded per the brief's scope ("every control testID on the 4 auth screens").

## E2E Coverage — Student Home / Appointments / Grades (Task 5)

One row per control (testID) on the 3 student screens covered by `flows/student/`, plus the 4 root-only destination screens (notifications/messages/account/halaqa) and the two out-of-scope-but-touched back buttons (`reports.back`, `mushaf.back`) added as navigation fallbacks. No interactive element on `student/home.tsx`, `student/appointments.tsx`, or `student/grades.tsx` is missing a testID (`check-testids.js` enforces this).

| screen | control (testID) | flow file | step |
|---|---|---|---|
| student-home | `student-home.screen` | `01-home-smoke.yaml` | asserted visible after login; re-asserted after every round trip |
| student-home | `student-home.notifications` | `01-home-smoke.yaml` | tapped -> `notifications.screen` |
| student-home | `student-home.messages` | `01-home-smoke.yaml` | tapped -> `messages.screen` |
| student-home | `student-home.account` | `01-home-smoke.yaml` | tapped -> `account.screen` |
| student-home | `student-home.logout` | *(none — testID present, not tapped)* | Destructive (ends the authenticated session under test); not exercised by any smoke flow. Presence verified by `check-testids.js` only. |
| student-home | `student-home.revision-item.N` | *(none — testID present, not tapped)* | Ali's seeded revision queue was empty in every run observed (`revisionAllDone` empty state rendered instead); no row existed to tap. Documented deviation. |
| student-home | `student-home.revision-mark.N` | *(none — testID present, not tapped)* | Same reason as `revision-item.N` above. |
| student-home | `student-home.quick-action.0` (session) | `01-home-smoke.yaml` | tapped -> `student-appointments.screen`, back via `bottom-nav.student-home` |
| student-home | `student-home.quick-action.1` (record) | `01-home-smoke.yaml` | tapped -> `/student/recordings` (no `.screen` testID yet; asserted `student-home.screen` not visible), back via `bottom-nav.student-home` |
| student-home | `student-home.quick-action.2` (grades) | `01-home-smoke.yaml` | tapped -> `student-grades.screen`, back via `bottom-nav.student-home`. **Fix-pass update:** full destination assertion restored — `.2` sits above the fold (no real scroll needed) and re-tested clean 3/3 under the exact old flow pattern, so coverage was safely restored; its *original* Plan 1 failure is only indirectly, not conclusively, attributed to the `scrollUntilVisible` defect found for the below-the-fold tiles — see BUGLOG.md Finding #3 for the full, hedged explanation. |
| student-home | `student-home.quick-action.3` (reports) | `01-home-smoke.yaml` | tapped -> `student-reports.screen`, back via `reports.back` (no `BottomNav` on this screen). **Fix-pass update:** full destination assertion and return-tap restored, same status as `.2` above (re-tested clean 3/3, original-failure attribution not conclusively proven) — see BUGLOG.md Finding #3. |
| student-home | `student-home.quick-action.4` (revisions) | `01-home-smoke.yaml` | swiped into view (below the fold — `swipe`, not `scrollUntilVisible`, per the Fix-pass BUGLOG.md resolution), tapped -> `student-revisions.screen`, back via `bottom-nav.student-home` |
| student-home | `student-home.quick-action.5` (plans) | `01-home-smoke.yaml` | swiped into view, tapped -> `student-plans.screen`, back via `bottom-nav.student-home` |
| student-home | `student-home.quick-action.6` (ijazahs) | `01-home-smoke.yaml` | swiped into view (two swipes — sits alone in the grid's last row) -> `student-ijazahs.screen`, back via `bottom-nav.student-home` |
| student-home | `student-home.teacher-card` | `01-home-smoke.yaml` | tapped (ali has an assigned teacher) -> `messages.screen`, back via `messages.back` |
| student-home | `student-home.teacher-action` | *(none — testID present, not tapped)* | Nested `IconButton` inside the `teacher-card` `TouchableOpacity`; same `onPress` target as the card it's nested in, already exercised via `teacher-card`. Presence verified by `check-testids.js` only. |
| student-home | `student-home.grades-view-all` | `01-home-smoke.yaml` | tapped -> `student-grades.screen`, back via `bottom-nav.student-home` |
| student-home | `student-home.mushaf-cta` | `01-home-smoke.yaml` | tapped -> `/student/mushaf` (no `BottomNav`; asserted not-visible), back via `mushaf.back` |
| student-home | `bottom-nav.student-appointments` | `01-home-smoke.yaml` | tapped -> `student-appointments.screen`, back via `bottom-nav.student-home` |
| student-appointments | `student-appointments.screen` | `01-home-smoke.yaml`, `02-appointments-smoke.yaml` | asserted visible |
| student-appointments | `student-appointments.back` | `02-appointments-smoke.yaml` | tapped, returns to `student-home.screen` |
| student-appointments | `student-appointments.row.0` | `02-appointments-smoke.yaml` | asserted visible — ali's seeded ACCEPTED appointment with `teacher@quran-review.com`, rendered in the "history" (decided) list |
| student-appointments | `student-appointments.book` | `02-appointments-smoke.yaml` | tapped to open the form (`book-form` asserted visible), tapped again to cancel/close it without submitting |
| student-appointments | `student-appointments.book-form` | `02-appointments-smoke.yaml` | asserted visible after opening, asserted not-visible after cancel |
| student-appointments | `student-appointments.change-teacher` | *(none — testID present, not tapped)* | Only rendered when `assignedTeacher` is set; tapping would navigate to `/student/teacher-change` (out of this task's scope, no testIDs added there). Presence verified by `check-testids.js` only. |
| student-appointments | `student-appointments.request-teacher` | *(none — testID present, not tapped)* | Only rendered when the student has **no** assigned teacher — not ali's case. Same out-of-scope destination as above. |
| student-appointments | `student-appointments.date-select` | `02-appointments-smoke.yaml` | tapped -> `date-modal-sheet` |
| student-appointments | `student-appointments.date-modal-backdrop` | *(none — testID present, not tapped)* | Backdrop `Pressable` dismisses the sheet on tap; the flow instead dismisses the sheet as a side effect of picking a `date-option.N` row. Presence verified by `check-testids.js` only. |
| student-appointments | `student-appointments.date-modal-sheet` | `02-appointments-smoke.yaml` | asserted visible after opening, asserted not-visible after a row is picked |
| student-appointments | `student-appointments.date-modal-close` | *(none — testID present, not tapped)* | **Fix-pass update:** the flow previously dismissed via this button (see the now-resolved BUGLOG.md finding below); it now instead picks `date-option.0` directly, which closes the sheet as a side effect. Presence verified by `check-testids.js` only. |
| student-appointments | `student-appointments.date-option.N` | `02-appointments-smoke.yaml` (`date-option.0`) | **Fix-pass RESOLVED** (was: **Deviation** — not tapped by any flow, `Element not found`). The picker's `modalSheet` `Pressable` was collapsing the entire `FlatList` into one accessibility node (also affected VoiceOver); `accessible={false}` was added to the sheet (Plan 1 findings fix-pass), and the flow now taps `date-option.0` by testID directly. See `BUGLOG.md` (RESOLVED entry). |
| student-appointments | `student-appointments.time-select` | `02-appointments-smoke.yaml` | tapped -> `time-modal-sheet` |
| student-appointments | `student-appointments.time-modal-backdrop` | *(none — testID present, not tapped)* | Same rationale as `date-modal-backdrop`. |
| student-appointments | `student-appointments.time-modal-sheet` | `02-appointments-smoke.yaml` | asserted visible after opening, asserted not-visible after a row is picked |
| student-appointments | `student-appointments.time-modal-close` | *(none — testID present, not tapped)* | Same fix-pass update as `date-modal-close` above — superseded by picking `time-option.0` directly. Presence verified by `check-testids.js` only. |
| student-appointments | `student-appointments.time-option.N` | `02-appointments-smoke.yaml` (`time-option.0`) | Same fix-pass resolution as `date-option.N` above. |
| student-appointments | `student-appointments.duration-chip.0/1/2` | `02-appointments-smoke.yaml` | all three tapped in sequence (1 -> 2 -> 0), leaving the form on its default (30 min) |
| student-appointments | `student-appointments.recurring-toggle` | `02-appointments-smoke.yaml` | tapped twice (on, then off) |
| student-appointments | `student-appointments.submit` | *(none — testID present, not tapped)* | Submitting would create a real appointment/recurring slot server-side; booking itself is Journey 2 (a later task) per the brief. Presence verified by `check-testids.js` only. |
| student-appointments | `student-appointments.recurring-slot.N` / `student-appointments.recurring-slot-cancel.N` | *(none — testID present, not tapped)* | Ali has no seeded recurring slots in any run observed — the "Standing weekly slots" section never rendered. Presence verified by `check-testids.js` only. |
| student-grades | `student-grades.screen` | `01-home-smoke.yaml`, `03-grades-smoke.yaml` | asserted visible |
| student-grades | `student-grades.back` | `03-grades-smoke.yaml` | tapped, returns to `student-home.screen` |
| student-grades | `student-grades.row.0` | `03-grades-smoke.yaml` | asserted visible — ali's most recent seeded grade (`seed-e2e.ts`) |
| student-grades | `student-grades.retry` | *(none — testID present, not tapped)* | Only rendered on a fetch error (`error` state from `useGrades`), which the happy-path smoke flow never hits. Presence verified by `check-testids.js` only. Also: this screen has **no filter/segment control at all** — a deviation from the brief's Step 3 ("exercise every filter/segment control present"); confirmed by reading the full source, nothing to exercise beyond the back button and this conditional retry button. |

## Root-only destination screens (Task 5, not in covered-screens.json)

Per the brief and coordinator resolution #3/#4: root container testID only, plus a back-button testID where the screen otherwise lacks one usable from these flows. Full per-control audits of these screens are out of scope (Plan 3 per the brief).

| screen | control (testID) | flow file | step |
|---|---|---|---|
| notifications | `notifications.screen` | `01-home-smoke.yaml` | asserted visible |
| notifications | `notifications.back` | `01-home-smoke.yaml` | tapped, returns to `student-home.screen` |
| messages | `messages.screen` | `01-home-smoke.yaml` | asserted visible |
| messages | `messages.back` | `01-home-smoke.yaml` | tapped, returns to `student-home.screen` |
| account | `account.screen` | `01-home-smoke.yaml` | asserted visible |
| account | `account.back` | `01-home-smoke.yaml` | tapped, returns to `student-home.screen` |
| halaqa | `halaqa.screen` | *(none — testID present, not exercised)* | Not reachable from any of the 3 student screens' controls exercised in this task's flows (added per the brief's blanket instruction to add the root testID on all 4 destination screens; `halaqa` is reached via `bottom-nav.halaqa`, out of this task's flow scope). `halaqa/index.tsx` is intentionally **not** in `covered-screens.json` per the brief (root-only screens are excluded). |
| halaqa | `halaqa.back` | *(none, same as above)* | Added for consistency/future use; not exercised here. |

## Additional back-button testIDs (out of the brief's file list, added as navigation fallbacks)

`reports.tsx` is not in the brief's "Files" list for this task, but is reachable from `student-home.screen` quick actions and doesn't render `BottomNav`, so there was no other reliable way for `01-home-smoke.yaml` to navigate back to home (per coordinator resolution #4's explicit fallback: "if a destination lacks one, add `<screen>.back` testID to it"). Only the back button was tagged — no root `.screen` testID, no `covered-screens.json` registration, no other controls on the screen touched. **Fix-pass update:** `reports.back` is now used — `quick-action.3`'s destination was root-caused as a Maestro `scrollUntilVisible` defect, not a real nondeterminism in `reports.tsx` or `student-home.tsx` (see BUGLOG.md's resolved Finding #3), so `01-home-smoke.yaml` now taps `quick-action.3`, asserts `student-reports.screen`, and returns home via `reports.back`.

`mushaf.tsx` was originally in this section too (Task 5 added a bare `mushaf.back` testID as the same kind of fallback). Task 7 promotes `mushaf.tsx` to a fully-covered screen (added to `covered-screens.json`, every interactive element tagged, `mushaf.back` renamed to `student-mushaf.back` for convention consistency) — see the Task 7 section below for its full inventory; it no longer belongs in this fallback-only list.

| screen | control (testID) | flow file | step |
|---|---|---|---|
| reports | `reports.back` | `01-home-smoke.yaml` | tapped to return home after `quick-action.3` lands on `student-reports.screen`. **Fix-pass update:** now exercised — see the note above. |

## E2E Coverage — Student Plans / Mushaf / Gamification / Certificates / Ijazahs (Task 7)

One row per control (testID) on the 5 student screens covered by `08-plans-smoke.yaml`, `09-mushaf-smoke.yaml`, `10-gamification-smoke.yaml`, `11-certificates-smoke.yaml`, `12-ijazahs-smoke.yaml`. No interactive element on `student/plans.tsx`, `student/mushaf.tsx`, `student/gamification.tsx`, `student/certificates.tsx`, or `student/ijazahs.tsx` is missing a testID (`check-testids.js` enforces this — `mobile/src/components/design.tsx`'s `SegmentedControl` was also given an optional `testID` prop, threaded to its options, so `student-gamification.leaderboard-scope.*` has real per-option identity; this addition is not itself enforced by the checker since `design.tsx` is a shared component file, not a covered screen).

All 5 screens are reached via `openLink: "quran-review://student/<route>"` deep links, **not** their `student-home.quick-action.N` tiles, per the coordinator's binding resolution for this task: `quick-action.5` (plans) and `quick-action.6` (ijazahs) are UNVERIFIED against BUGLOG.md Finding #3 (the wrong-destination quick-action bug, confirmed on 3 of 7 tiles — `.2`/`.3`/`.4` — as of Task 6), and `mushaf`/`gamification`/`certificates` aren't reachable from a quick-action tile at all (`mushaf` has its own `student-home.mushaf-cta`; `gamification`/`certificates` are only linked from `parent/home.tsx`).

| screen | control (testID) | flow file | step |
|---|---|---|---|
| student-plans | `student-plans.screen` | `08-plans-smoke.yaml` | asserted visible after the deep link |
| student-plans | `student-plans.back` | `08-plans-smoke.yaml` | tapped, returns to `student-home.screen` |
| student-plans | `student-plans.empty` | `08-plans-smoke.yaml` | asserted visible — ali has no seeded `CurriculumPlan` rows |
| student-plans | `student-plans.retry` | *(none — testID present, not tapped)* | Only rendered on a fetch error. Presence verified by `check-testids.js` only. |
| student-plans | `student-plans.row.N` | *(none — testID present, not tapped)* | No seeded plans render any rows in any run observed. Presence verified by `check-testids.js` only (not itself a `TouchableOpacity`/`Pressable`, so not enforced by the checker's regex either — added purely for row-identification convention, matching `student-grades.row.N` etc.). |
| student-mushaf | `student-mushaf.screen` | `09-mushaf-smoke.yaml` | asserted visible after the deep link |
| student-mushaf | `student-mushaf.back` | `09-mushaf-smoke.yaml` | tapped, returns to `student-home.screen`. Renamed from the bare `mushaf.back` Task 5 left it with — `01-home-smoke.yaml`'s reference was updated in this task to match. |
| student-mushaf | `student-mushaf.page-image.N` | `09-mushaf-smoke.yaml` | `student-mushaf.page-image.1` tapped to open the zoom modal (page 1 is on-screen after the next/prev round trip below) |
| student-mushaf | `student-mushaf.page-prev` | `09-mushaf-smoke.yaml` | tapped, after `page-next` |
| student-mushaf | `student-mushaf.page-next` | `09-mushaf-smoke.yaml` | tapped first, ahead of `page-prev` |
| student-mushaf | *(gesture-covered: FlatList swipe paging)* | `09-mushaf-smoke.yaml` | no dedicated testID possible for the bare swipe gesture itself (per coordinator resolution #3); exercised via Maestro `swipe` (start 90%,50% -> end 10%,50%, avoiding screen edges) as a loose smoke check — only confirms `student-mushaf.screen` survives the gesture, since the resulting page-number direction is RTL-dependent (app defaults to Arabic) and not pinned down. This gesture is **not** swipe-only navigation (the `page-next`/`page-prev` Touchables above cover the same page-turn function), so the brief's "swipe gesture only" carve-out doesn't strictly require even this loose check — included anyway for confidence. |
| student-mushaf | `student-mushaf.status-chip` | `09-mushaf-smoke.yaml` | tapped, opens the page-status picker modal |
| student-mushaf | `student-mushaf.status-modal-backdrop` | *(none — testID present, not tapped)* | Dismissing via backdrop tap not exercised; the flow instead dismisses by selecting a status option. Presence verified by `check-testids.js` only. |
| student-mushaf | `student-mushaf.status-modal-sheet` | `09-mushaf-smoke.yaml` | asserted visible after opening |
| student-mushaf | `student-mushaf.status-option.NOT_STARTED` | `09-mushaf-smoke.yaml` | tapped — a no-op re-selection (ali has no seeded `PageStatus` rows, so page 1's status is already `NOT_STARTED`), closes the modal without a real mutation |
| student-mushaf | `student-mushaf.mark-memorized` | *(none — testID present, not tapped)* | This is the `MEMORIZED` status option (named per Task 6's interface note for Task 10's consumption, not `status-option.MEMORIZED`) — not tapped by this flow to avoid a real page-status mutation (ali's pages start `NOT_STARTED`; selecting this would persist a real `MEMORIZED` status change with no reset between runs). Presence verified by `check-testids.js` only. |
| student-mushaf | `student-mushaf.status-option.LEARNING` / `.SOLID` | *(none — testID present, not tapped)* | Same non-mutation rationale as `mark-memorized`. Presence verified by `check-testids.js` only. |
| student-mushaf | `student-mushaf.record-open` | `09-mushaf-smoke.yaml` | tapped, opens the recite-from-the-page recorder modal |
| student-mushaf | `student-mushaf.record-modal-backdrop` | *(none — testID present, not tapped)* | Presence verified by `check-testids.js` only. |
| student-mushaf | `student-mushaf.record-modal-sheet` | *(none — testID present, not tapped)* | Implicitly covered (its child `start-recording` is asserted visible, meaning the sheet itself is rendered), but not asserted by its own id. Presence verified by `check-testids.js` only. |
| student-mushaf | `student-mushaf.start-recording` | `09-mushaf-smoke.yaml` | asserted visible (recorder modal's default state) — **not tapped**, to avoid triggering a real mic-permission system prompt and persisting an upload (same posture as `04-recordings-smoke.yaml`) |
| student-mushaf | `student-mushaf.stop-recording` | *(none — testID present, not tapped)* | Only rendered once a recording is in progress, which this flow deliberately never starts. Presence verified by `check-testids.js` only. |
| student-mushaf | `student-mushaf.cancel-recording` | `09-mushaf-smoke.yaml` | tapped to close the recorder modal without recording |
| student-mushaf | `student-mushaf.zoom-close` | `09-mushaf-smoke.yaml` | asserted visible after tapping `page-image.1`, then tapped to close the zoom modal |
| student-gamification | `student-gamification.screen` | `10-gamification-smoke.yaml` | asserted visible after the deep link |
| student-gamification | `student-gamification.back` | `10-gamification-smoke.yaml` | tapped, returns to `student-home.screen` |
| student-gamification | `student-gamification.streak` | `10-gamification-smoke.yaml` | asserted visible — the current/longest-streak `MetricTile` pair, unconditional once `gamification.tsx` loads (server returns a zeroed shape for a user with no `Streak` row rather than erroring) |
| student-gamification | `student-gamification.retry` | *(none — testID present, not tapped)* | Only rendered on a fetch error. Presence verified by `check-testids.js` only. |
| student-gamification | `student-gamification.badges-empty` | `10-gamification-smoke.yaml` | asserted visible — ali has no seeded `UserBadge` rows |
| student-gamification | `student-gamification.badges` / `student-gamification.badge.N` | *(none — testID present, not tapped)* | No seeded badges render any rows in any run observed. Presence verified by `check-testids.js` only (`AppCard` is not itself matched by the checker's regex — added for row-identification convention). |
| student-gamification | `student-gamification.leaderboard-scope` / `.all` / `.my-teacher` | `10-gamification-smoke.yaml` | both `.my-teacher` and `.all` tapped in sequence, exercising the `SegmentedControl` |
| student-gamification | `student-gamification.leaderboard-retry` | *(none — testID present, not tapped)* | Only rendered on a leaderboard fetch error. Presence verified by `check-testids.js` only. |
| student-gamification | `student-gamification.leaderboard-empty` | `10-gamification-smoke.yaml` | asserted visible under both leaderboard scopes — no `Streak` rows exist for **any** seeded user in either seed script, not just ali, so the leaderboard is empty regardless of scope |
| student-gamification | `student-gamification.leaderboard-row.N` | *(none — testID present, not tapped)* | No seeded streaks render any leaderboard rows in any run observed. Presence verified by `check-testids.js` only. |
| student-certificates | `student-certificates.screen` | `11-certificates-smoke.yaml` | asserted visible after the deep link |
| student-certificates | `student-certificates.back` | `11-certificates-smoke.yaml` | tapped, returns to `student-home.screen` |
| student-certificates | `student-certificates.empty` | `11-certificates-smoke.yaml` | asserted visible — ali has no seeded `Certificate` rows |
| student-certificates | `student-certificates.retry` | *(none — testID present, not tapped)* | Only rendered on a fetch error. Presence verified by `check-testids.js` only. |
| student-certificates | `student-certificates.row.N` / `.download.N` / `.share.N` / `.regenerate.N` | *(none — testID present, not tapped)* | No seeded certificates render any rows in any run observed. Presence verified by `check-testids.js` only. |
| student-ijazahs | `student-ijazahs.screen` | `12-ijazahs-smoke.yaml` | asserted visible after the deep link |
| student-ijazahs | `student-ijazahs.back` | `12-ijazahs-smoke.yaml` | tapped, returns to `student-home.screen` |
| student-ijazahs | `student-ijazahs.empty` | `12-ijazahs-smoke.yaml` | asserted visible — ali has no seeded `Ijazah` rows |
| student-ijazahs | `student-ijazahs.retry` | *(none — testID present, not tapped)* | Only rendered on a fetch error. Presence verified by `check-testids.js` only. |
| student-ijazahs | `student-ijazahs.row.N` / `.share.N` / `.regenerate.N` | *(none — testID present, not tapped)* | No seeded ijazahs render any rows in any run observed. Presence verified by `check-testids.js` only. |
| student-home | `student-home.quick-action.5` (plans) / `.6` (ijazahs) | *(none — not tapped by this task's flows)* | Deliberately not tapped as a way of reaching `student-plans.screen`/`student-ijazahs.screen` — both were UNVERIFIED against BUGLOG.md Finding #3 per this task's brief (Task 7, at the time), so this task reached those screens exclusively via deep link. **Fix-pass update:** Finding #3 is now resolved (root-caused to a Maestro `scrollUntilVisible` defect, not an app bug) and `01-home-smoke.yaml` was updated to tap these two tiles directly with full, strict destination assertions (see the per-control table above) — this row describes Task 7's own historical rationale for its deep-link choice, not the current state of `01-home-smoke.yaml`. |

## E2E Coverage — Student Recordings / Reports / Revisions / Teacher-Change (Task 6)

One row per control (testID) on the 4 student screens covered by `04-recordings-smoke.yaml`, `05-reports-smoke.yaml`, `06-revisions-smoke.yaml`, `07-teacher-change-smoke.yaml`. No interactive element on `student/recordings.tsx`, `student/reports.tsx`, `student/revisions.tsx`, or `student/teacher-change.tsx` is missing a testID (`check-testids.js` enforces this).

| screen | control (testID) | flow file | step |
|---|---|---|---|
| student-recordings | `student-recordings.screen` | `04-recordings-smoke.yaml` | asserted visible |
| student-recordings | `student-recordings.back` | `04-recordings-smoke.yaml` | tapped, returns to `student-home.screen` |
| student-recordings | `student-recordings.empty` | `04-recordings-smoke.yaml` | asserted visible — ali has no seeded recordings |
| student-recordings | `student-recordings.record` | `04-recordings-smoke.yaml` | tapped — see BUGLOG.md: mic permission was already granted on this simulator (persists across `clearState`), so this starts a real `AVAudioSession` recording rather than showing a permission prompt |
| student-recordings | `student-recordings.recording-banner` | `04-recordings-smoke.yaml` | asserted visible immediately after `record`, asserted not-visible after `cancel-recording` |
| student-recordings | `student-recordings.cancel-recording` | `04-recordings-smoke.yaml` | tapped immediately after the recording banner appears — discards the in-progress recording without uploading (per coordinator resolution #3: no real audio artifact left behind) |
| student-recordings | `student-recordings.stop-recording` | *(none — testID present, not tapped)* | Would stop-and-upload the recording; not exercised since resolution #3 requires canceling instead. Presence verified by `check-testids.js` only. |
| student-recordings | `student-recordings.pick-audio` | `04-recordings-smoke.yaml` | tapped -> opens iOS's native `UIDocumentPickerViewController` ("Recents" browser, no testID surface — OS chrome); dismissed via a raw point tap wrapped in a 3-attempt retry with `waitForAnimationToEnd` settles before and after the tap (see BUGLOG.md — a 2-attempt version without the post-tap settle proved insufficient in a live run) |
| student-recordings | `student-recordings.retry` | *(none — testID present, not tapped)* | Only rendered on a fetch error; the happy-path smoke flow never hits it. Presence verified by `check-testids.js` only. |
| student-recordings | `student-recordings.row.N` / `student-recordings.row-page-link.N` | *(none — testID present, not tapped)* | Ali has no seeded recordings in any run observed (empty state renders instead); no row existed to tap. Presence verified by `check-testids.js` only. |
| student-reports | `student-reports.screen` | `05-reports-smoke.yaml` | asserted visible — reached via the `quran-review://student/reports` deep link (see below), not `quick-action.3` directly |
| student-reports | `reports.back` | `05-reports-smoke.yaml` | tapped — this is Task 5's pre-existing testID (screen-id prefix `reports`, not `student-reports`, kept as-is per the brief's explicit "reuse it... check before adding a duplicate" instruction rather than renamed for convention consistency); return-to-home afterward goes through `bottom-nav.student-home`, not a direct assert on `reports.back`'s destination — see BUGLOG.md Task 6 addendum for why |
| student-reports | `student-reports.empty` | `05-reports-smoke.yaml` | asserted visible — ali has no seeded reports |
| student-reports | `student-reports.retry` | *(none — testID present, not tapped)* | Only rendered on a fetch error. Presence verified by `check-testids.js` only. |
| student-reports | `student-reports.row.N` / `student-reports.download.N` | *(none — testID present, not tapped)* | Ali has no seeded `Report` rows in any run observed (empty state renders instead). Presence verified by `check-testids.js` only. |
| student-home | `student-home.quick-action.3` (reports) | `05-reports-smoke.yaml` | tapped with only `assertNotVisible: student-home.screen` (loose assertion, per coordinator resolution #1 — this tile is one of the two confirmed-nondeterministic-destination tiles, BUGLOG.md Finding #3). Reproduced landing on `student-grades.screen` in this task's run (a third distinct wrong-destination reproduction — see the Task 6 BUGLOG addendum). `student-reports.screen` itself is reached separately and reliably via `openLink: "quran-review://student/reports"`, called directly after the quick-action tap without an intervening `launchApp` (a relaunch was tried first and found to drop the session back to `login.screen` — documented in the flow file's inline comment). |
| student-revisions | `student-revisions.screen` | `06-revisions-smoke.yaml` | asserted visible, reached via `student-home.quick-action.4` — reliable (not one of the two flagged-nondeterministic tiles) |
| student-revisions | `student-revisions.back` | `06-revisions-smoke.yaml` | tapped, returns to `student-home.screen` |
| student-revisions | `student-revisions.row.0` | `06-revisions-smoke.yaml` | asserted visible — one of ali's 3 seeded PENDING `RevisionSchedule` rows (`packages/server/src/prisma/seed.ts`) |
| student-revisions | `student-revisions.row.1` / `student-revisions.row.2` | *(none — testID present, not individually asserted)* | Ali has 3 seeded rows total; only row 0 is individually asserted/exercised, matching the "assert a representative row" depth used elsewhere in this suite (e.g. `student-grades.row.0`, `student-appointments.row.0`). Presence verified by `check-testids.js` only. |
| student-revisions | `student-revisions.mark-completed.0` | `06-revisions-smoke.yaml` | tapped -> native confirm `Alert` appears -> **canceled** (not confirmed), so the seeded PENDING row is never mutated (no DB reset runs between flow iterations in this task's environment — see the hard restriction on `prisma migrate reset`) |
| student-revisions | `student-revisions.mark-missed.0` | `06-revisions-smoke.yaml` | tapped -> native confirm `Alert` appears -> **canceled**, same non-mutation rationale as above |
| student-revisions | `student-revisions.retry` | *(none — testID present, not tapped)* | Only rendered on a fetch error. Presence verified by `check-testids.js` only. |
| student-revisions | `student-revisions.empty` | *(none — testID present, not tapped)* | Ali has 3 seeded rows, so the empty state never renders in this flow. Presence verified by `check-testids.js` only. |
| student-teacher-change | `student-teacher-change.screen` | `07-teacher-change-smoke.yaml` | asserted visible, reached via `student-appointments.change-teacher` (reliable — a direct link on `student-appointments.screen`'s booking form, not a home quick-action) |
| student-teacher-change | `student-teacher-change.back` | `07-teacher-change-smoke.yaml` | tapped **instead of** `submit` — returns to `student-appointments.screen` |
| student-teacher-change | `student-teacher-change.reason` | `07-teacher-change-smoke.yaml` | filled with a >=10-character reason string |
| student-teacher-change | `student-teacher-change.submit` | *(none — testID present, deliberately NOT tapped)* | Hard requirement (coordinator resolution #5): submitting would create a real `TeacherChangeRequest` row, mutating state Plan 2's admin flows and Journey 7 depend on. Verified via direct DB query after this task's flow runs: `SELECT count(*) FROM teacher_change_requests` returns `0`. Presence verified by `check-testids.js` only. |
| student-appointments | `student-appointments.change-teacher` | `07-teacher-change-smoke.yaml` | tapped -> `student-teacher-change.screen` (Task 5 had left this testID present-but-untapped; this task exercises it for the first time) |

## E2E Coverage — Journey 1: registration -> admin approval -> login (Task 8)

`journeys/01-registration-approval.yaml` — the suite's first cross-role journey and first task touching admin screens. Per coordinator resolution #1 for this task, admin testIDs added here are **minimal, journey-scoped only** — `mobile/app/admin/home.tsx` and `mobile/app/admin/change-requests.tsx` are deliberately **not** added to `covered-screens.json` (no full-admin-screen `check-testids.js` enforcement; that is out of scope, reserved for a future admin-smoke task).

**Deviations from the brief's draft flow (all verified empirically against the real source, per coordinator resolution #4/#3):**

1. **No dedicated "users list" screen exists.** `admin/home.tsx` has no separate users-list route — its `approvalsSummary` button (now `admin-home.approvals`) navigates straight to `admin/change-requests.tsx`, a single combined **Approvals** screen listing pending student accounts, teacher-change requests, and parent-link requests together (filterable by chips, no search input). The brief's placeholder names (`admin-home.users`, `admin-users.*`, `admin-user-detail.approve`) were adjusted to match: `admin-home.approvals` (link), `admin-approvals.screen` (the combined list), `admin-approvals.filter.STUDENT_ACCOUNT` (the chip that isolates pending student accounts), `admin-approvals.row.${index}` (row container, added for convention/future reuse though this flow doesn't tap it by index), `admin-approvals.approve` (the approve button — safe as a single non-indexed testID since only one row can be expanded, hence only one approve button rendered, at a time).
2. **No search input, so `scrollUntilVisible` locates the row** — via `id: "admin-approvals.row.0"`, per coordinator resolution #3. A text-based `scrollUntilVisible`/`tapOn` on `"Journey One"` was tried first and **failed live**, even though the text is plainly visible on screen without scrolling (screenshot confirmed): iOS merges the whole row's Avatar/title/subtitle/badge into one accessibility node (`accessibilityText: "JO, Journey One, حساب طالب بانتظار التفعيل, ..."` — a comma-joined concatenation), the same accessibility-swallowing pattern already documented in BUGLOG.md for the date/time-picker `FlatList`; Maestro's text selector cannot reach a substring inside that merged label. Using the row's own testID instead works, and is deterministic despite the STUDENT_ACCOUNT-filtered list also containing the seeded PENDING fixture `fatima@quran-review.com`: `GET /admin/users` is ordered `createdAt desc` (`admin.service.ts`), preserved through the client-side PENDING+STUDENT filter, so the just-registered fixture user — always the newest such row in this controlled environment — is always row `0`. See the new BUGLOG.md entry for this task.
3. **Part 2 ("pending login is blocked") asserts `login.error`, not `pending-approval.screen`** — the brief's draft assumed the latter, but this is already-documented, already-verified app behavior from Task 4 (`auth/04-pending-approval-smoke.yaml`, BUGLOG.md): the server rejects login for any non-`ACTIVE` account with a 403 before the app ever receives a user object, so the auth-gate redirect in `_layout.tsx` (`user.status === 'pending' -> router.replace('/pending-approval')`) never fires — `user` stays `null` and the app remains on `login.screen` showing `login.error`. Not a new finding, not re-derived from scratch — this task simply applies the already-established fact to a new flow. No new BUGLOG.md entry was needed.
4. **Registration destination re-verified, unchanged**: `register.tsx`'s `handleRegister` still calls `router.replace('/pending-approval')` on success and `register()` in `mobile/src/auth/store.ts` still only calls the API (never sets `user`/`token`) — so `pending-approval.screen` is reached by a raw, unauthenticated navigation, exactly as in Task 4. `pending-approval.logout`'s `router.push('/')` therefore lands cleanly on a real `login.screen` with no auth-gate bounce-back (there is no authenticated `user` object to trigger one).

### testID inventory (admin, journey-scoped — for Task 9's consumption)

| screen | testID | control |
|---|---|---|
| `admin-home.screen` (`mobile/app/admin/home.tsx`) | `admin-home.screen` | root `View` |
| | `admin-home.approvals` | the "Approvals" summary card/button — navigates to `admin/change-requests` |
| `admin-approvals.screen` (`mobile/app/admin/change-requests.tsx`) | `admin-approvals.screen` | root `SafeAreaView` |
| | `admin-approvals.filter.ALL` / `.TEACHER_CHANGE` / `.PARENT_LINK` / `.STUDENT_ACCOUNT` | the 4 filter chips (all 4 given testIDs — trivial to do while already touching this `.map()`, not a scope expansion; this flow only taps `.STUDENT_ACCOUNT`) |
| | `admin-approvals.row.${index}` | each approval-row `TouchableOpacity` (index into the currently-filtered list) — present for Task 9/future reuse, not tapped by this flow (which taps by text instead, see deviation #2) |
| | `admin-approvals.approve` | the Approve button inside an expanded row's action row (STUDENT_ACCOUNT/PARENT_LINK branch only — TEACHER_CHANGE's branch uses a different "Assign Teacher" flow, out of this journey's scope, no testID added there) |

**Note for Task 9**: `admin/home.tsx` and `admin/change-requests.tsx` still have plenty of untouched interactive elements (header icons, academy-grid cards, teacher-change "Assign Teacher"/"Deny" buttons, parent-link "Deny" button, the teacher-picker modal, edit/delete on `user-detail.tsx`, etc.) — none of those have testIDs yet. If Task 9 needs a full admin-screen pass, it starts from a source file that is only partially annotated.

### Determinism proof

`journeys/01-registration-approval.yaml` mutates real DB state (creates `e2e-journey1@quran-review.com`, then flips it PENDING -> ACTIVE). A second run of the same flow **without** a DB reset must fail specifically at the Part 1 registration step, with a 409 (duplicate email) surfaced as `register.error`, proving the fixture user genuinely persisted rather than the flow being accidentally idempotent. See the verification results below for the actual run output.

## E2E Coverage — Journeys 2+3: appointment booking -> accept, grade -> student sees it (Task 9)

`journeys/02-appointment-booking.yaml` and `journeys/03-grade-visibility.yaml` — the suite's first flows to touch `mobile/app/teacher/*.tsx`. Per coordinator resolution #1 for this task, teacher testIDs added here are **minimal, journey-scoped only** — `teacher/home.tsx`, `teacher/appointments.tsx`, and `teacher/grade-form.tsx` are deliberately **not** added to `covered-screens.json` (same pattern as the admin screens in Task 8).

### App-level fixes made while building these flows

1. **Latent testID-collision bug fixed in `student/appointments.tsx`.** `pending`/`decided` were each derived via an independent `.filter()`, so `renderAppointment`'s `index` argument (used for `student-appointments.row.${index}` / the new `.status.${index}`) restarted at 0 in *each* list. Harmless while a student only ever had a decided appointment (the only case any flow through Task 8 exercised), but a real duplicate-testID collision the moment a student has one pending AND one decided appointment on screen simultaneously — exactly what `02-appointment-booking.yaml` creates (a new REQUESTED booking alongside the seeded ACCEPTED one). Fixed by indexing both lists against the single global `appointments` array (`GET /appointments` is `orderBy: requestedDate desc` — appointment.service.ts:133/139) instead of each filtered list's own local position, so every row's index is unique across the whole screen. `02-appointments-smoke.yaml` (Task 5) is unaffected — Ali only ever has one decided appointment in that flow's baseline, so its `student-appointments.row.0` assertion resolves to the same element before and after this fix.
2. **`StatusPill` (`mobile/src/components/design.tsx`) gained an optional `testID` prop**, threaded through to its root `View`. It previously accepted no `testID` at all, so there was no way to assert a specific row's status independent of the row's other content — needed for `student-appointments.status.${index}` (this task) and reusable by any future flow needing to assert a specific status pill.

### testID inventory (teacher, journey-scoped — for Plan 2's consumption)

| screen | testID | control |
|---|---|---|
| `teacher-home.screen` (`mobile/app/teacher/home.tsx`) | `teacher-home.screen` | root `View` |
| | `teacher-home.nav-appointments` | the "Requests" action tile — navigates to `/teacher/appointments` |
| | `teacher-home.nav-grade-form` | the "Give grade" action tile — navigates to `/teacher/grade-form` |
| `teacher-appointments.screen` (`mobile/app/teacher/appointments.tsx`) | `teacher-appointments.screen` | root `SafeAreaView` |
| | `teacher-appointments.row.${index}` | each **pending** appointment card (index local to the pending list only — this screen's `decided` rows are not given testIDs, out of this task's minimal scope) |
| | `teacher-appointments.accept.${index}` | the Accept button on a pending row |
| | `teacher-appointments.status.${index}` | the status badge on a pending row (added alongside `.row`/`.accept` for symmetry; not required by the brief's explicit produces-list but low-cost and directly useful for asserting the accept action's effect) |
| `grade-form.screen` (`mobile/app/teacher/grade-form.tsx`) | `grade-form.screen` | root `SafeAreaView` |
| | `grade-form.header` | the header `View` (not touchable itself — added during live verification as a reliable, provably non-keyboard-covered dismiss target; see the keyboard-occlusion note below) |
| | `grade-form.student-select.${index}` | each accepted-student chip (brief names this `grade-form.student-select` singular; implemented as an indexed list per coordinator resolution #5's list-row convention, since the underlying control is a `.map()` of chips, not a single dropdown) |
| | `grade-form.grade-input` | the score `TextInput` |
| | `grade-form.type-chip.${index}` | each `GradeType` chip (not in the brief's explicit produces-list, but needed to deterministically exercise "pick the first real GradeType" per Step 2) |
| | `grade-form.submit` | the submit button |
| `student-appointments.status.${index}` (`mobile/app/student/appointments.tsx`) | *(new this task)* | threaded through the newly-added `StatusPill` `testID` prop; global-index-safe per the fix above |
| `student-grades.row-grade.${index}` (`mobile/app/student/grades.tsx`) | *(new this task)* | the grade-value `Text` inside each row — distinguishes a specific grade's value from row-presence alone |

### Determinism

Both flows depend on `GET /appointments` and `GET /grades` being `orderBy` `requestedDate desc` / `createdAt desc` respectively (both confirmed in the relevant `*.service.ts`), combined with the seed data's fixed dates being far in the past relative to any real run:

- **Journey 2**: the new booking (dated "today" via the date-picker's first row — see the flow file's coordinate-tap note) always sorts before the seeded pair's `2026-05-01` appointment, so it is always global index 0 both before AND after acceptance.
- **Journey 3**: the new grade (`'A-'`) is always newer than Ali's two seeded grades (`'A'`, `'B+'`), so it is always index 0 on the student's grades screen. The flow asserts both the testID and the exact text (`assertVisible: {id, text}`) to positively distinguish it from the seeded rows, not just its row position.

### Coordinate-tap workaround (date/time pickers)

Reuses the already-documented, already-verified BUGLOG.md finding ("Date/time picker modal rows... not individually reachable by accessibility identifier") — `02-appointments-smoke.yaml` (Task 5) only opened/closed the pickers without selecting a row; this task's Journey 2 is the first flow that needs an actual date+time selected to submit a real booking, so it taps the FIRST row in each picker's `FlatList` (`date-option.0` = today, `time-option.0` = 00:00) via a raw `point:` coordinate tap ("50%, 36%"), on the reasoning that the row closest to the sheet's header carries the least layout-estimate error. **Verified live: this coordinate estimate held on the first attempt** — Journey 2 passed end to end with no adjustment needed.

### Keyboard-occlusion finding (Journey 3, `grade-form.grade-input`)

Live verification of Journey 3 surfaced a real testing gap (not an app bug — see BUGLOG.md for the full writeup and classification): `grade-form.grade-input`'s on-screen numeric keypad (`keyboardType="numeric"`, no Done/return key) stayed open after typing, and the next scrolled-to taps (`type-chip.0`, `submit`) landed on the keypad itself instead of the intended controls — confirmed by two consecutive failure screenshots showing the score field corrupted to `"A-0"` (a stray "0" from the keypad) and no grade row created server-side. `hideKeyboard` failed outright (no dismiss action to invoke). Fixed by adding `testID="grade-form.header"` to the header's non-touchable `View` (source fix, `grade-form.tsx`) and scrolling/tapping it before continuing — relies on the form's `keyboardShouldPersistTaps="handled"`, which only skips keyboard dismissal for taps a child touchable actually handles. Verified live after the fix: Journey 3 passes end to end.

### Live verification results (this task)

Both flows run individually via `JAVA_HOME=/opt/homebrew/opt/openjdk maestro test mobile/e2e/flows/journeys/0{2,3}-*.yaml` (not `run.sh`'s directory mode — its DB-reset step invokes `prisma migrate reset`, which is coordinator-only per this task's hard restrictions, and Prisma's own AI-safety guard independently blocks an agent from running it without explicit human consent):

- **`02-appointment-booking.yaml`**: passed end to end on the very first live attempt (all three parts — booking, teacher acceptance, student confirmation — `COMPLETED`). A second bare re-run (no DB reset between runs) failed at the submit step with the booking form still visible — diagnosed as the app's own overlap-prevention guard correctly rejecting a second identical today/00:00 slot, not a flow defect (both runs pick the same first-row date/time by design, per the determinism note above) — not a real failure, just an artifact of testing without the reset `run.sh` normally provides between flow directory runs. The stray extra appointment row this created was removed via a targeted `DELETE` (documented above) to restore the clean seeded baseline, and a fresh single re-run confirmed a clean pass.
- **`03-grade-visibility.yaml`**: failed twice during diagnosis (missing `scrollUntilVisible` before `grade-form.grade-input`, then the keyboard-occlusion issue above, two attempts before the source-level `grade-form.header` fix landed) — passed cleanly end to end after both fixes, including the final `assertVisible: {id: "student-grades.row-grade.0", text: "A-"}` check.
- Both flows were confirmed against real Postgres state via `docker compose exec db-test psql` queries before and after each run (appointment/grade row counts and values), not just Maestro's own pass/fail reporting.
- Journey 1 (`01-registration-approval.yaml`) was not re-run in this task — out of scope (already verified in Task 8); nothing in this task's changes touches `admin/*.tsx` or the registration/login flow.

## E2E Coverage — Journeys 10+11: streak-after-grade, mushaf-persistence (Task 10)

`journeys/10-streak-after-grade.yaml` and `journeys/11-mushaf-persistence.yaml` — the plan's final two journeys, both reusing testIDs/flow patterns established by earlier tasks (Task 7's `student-mushaf.*`/`student-gamification.*`, Task 9's `grade-form.*` sequence) rather than adding new screens.

### Journey 10: `student-gamification.streak-value` increments after a teacher submits a grade

- **What is asserted**: `student-gamification.streak-value` (the raw `currentStreak` number, a dedicated testID distinct from `student-gamification.streak`'s container `View`) reads `"0"` before, and `"1"` after, a teacher submits a fresh grade for ali — a genuine before/after value-change proof, not just a "still renders" check — across a full relaunch + role-switch + relaunch round trip.
- **What is deliberately NOT asserted, and why**: nothing is deliberately withheld here anymore. Previously this journey could only assert that `student-gamification.streak` stayed visible, because `grade.service.ts`'s `createGrade` didn't call `recordActivity`/`evaluateMilestones` — grading wasn't wired into the streak the way mushaf/recording/revision/ijazah/memorization/curriculum-plan actions already were (BUGLOG.md's Task 10 finding). That gap is fixed as part of this fix-pass: `createGrade` now calls both in the same best-effort try/catch pattern every sibling service uses, so the value-change assertion above is now real and load-bearing.
- **Re-runnability**: NOT idempotent — requires a fresh Ali (no `Streak` row) at start, i.e. a reseed/DB reset before each run (which `run.sh` provides between flow-directory runs). Part 1 asserts `streak-value` `"0"` *before* the grade, but Part 2's grade calls `recordActivity`, which persists a `Streak` row for Ali in Postgres (unaffected by `clearKeychain`/`clearState`, which only reset the app sandbox + keychain, not the server DB). So after one run Ali's `currentStreak` is `1`: a bare same-UTC-day re-run fails Part 1's `"0"`; a next-day re-run bumps it to `2`, failing both Part 1's `"0"` and Part 3's `"1"`. (The `Grade` row itself has no unique constraint — the collision state is the persisted `Streak` row, not a duplicate grade.)
- **Server-side verification**: `grade.service.test.ts` covers the new wiring with two unit tests (`recordActivity`/`evaluateMilestones` invoked on success; a gamification failure doesn't break grade creation).
- **Live verification**: Journey 10 passed end to end on iPhone 17 Pro Max / iOS 26.2 (2026-08-12), 80 steps / 0 failures — `student-gamification.streak-value` read `"0"` before the teacher's grade submission and `"1"` after, across the full relaunch/role-switch/relaunch round trip. (Surfaced and fixed a shared-helper gap in the same run: `_helpers/boot.yaml` did not dismiss iOS's "Open in <app>?" scheme-confirmation dialog, which `launchApp: clearState` re-triggers on every relaunch; an `optional` `tapOn: "Open"` was added there.)

### Journey 11: a marked-memorized mushaf page survives a real cold app restart

- **What is asserted**: mark page 3 `MEMORIZED` via `student-mushaf.mark-memorized` → kill the app (`stopApp`) → relaunch it (`launchApp`, **no** `clearState`, **no** `clearKeychain` — the one flow in this entire suite that deliberately omits both) → re-open the same page (`quran-review://student/mushaf?page=3`) → the status chip still shows `MEMORIZED`. This proves the status write reached the server/DB (not just an optimistic local update — the cold JS restart discards any in-memory/query-cache state, so the label can only have come from a fresh fetch of the persisted `PageMemorization` row) and that the session itself is not lost by the relaunch.
- **Re-runnability**: `PageMemorization` has `@@unique([userId, page])` and `setPageStatus` is an upsert, so — unlike Journey 2 and Journey 10 — this journey is safely re-runnable back-to-back without a DB reset.
- **Deviation — the reader's on-screen page number has no testID**: `{t('pageNumber')} {currentPage} / {TOTAL_PAGES}` is a plain `Text`/`AppText`, never given a testID by any prior task. Determinism instead comes from tapping `page-next` exactly twice from a known start (page 1) and from explicitly re-opening page 3 by deep-link `?page=` param after the relaunch (a pre-existing capability of `mushaf.tsx`, not new).
- **Two real app bugs found and diagnosed live while building this journey** (both logged in BUGLOG.md with full repro evidence; see there for complete write-ups):
  1. **A cold app restart with a fully valid, restored session lands on `login.screen`, not home** — `app/_layout.tsx`'s auth gate has no branch redirecting an already-authenticated user off the public login route. Diagnosed via a direct deep-link probe (a protected route succeeds immediately after the relaunch, with zero login steps, proving the session itself is intact — only the UI's own redirect is missing). **Not fixed at the source** — the correct fix touches the shared root auth gate every flow in this suite depends on, including the already-verified `first-login.tsx` `protectedRoots` carve-out, judged too broad a blast radius to patch blind within this task's scope. The flow was adjusted to match real, verified app behavior: it does not assert `student-home.screen` after the relaunch, and proceeds straight to the protected deep link instead.
  2. **`student-mushaf.status-chip`'s accessibility label was static** (`t('pageStatus')`, "Page status") and never included the current status value, so the whole subtree (including the dynamic `AppText` showing e.g. "محفوظة") collapsed into one accessibility node under iOS's default `accessible={true}` behavior for an explicitly-labeled `TouchableOpacity` — hiding the actual status from Maestro AND from real VoiceOver users, a genuine WCAG "Status-Is-Not-Only-Color" gap (color+text both render visually; neither is exposed as accessible content). **Fixed at the source** (small, single-screen, isolated change — `mushaf.tsx`'s `accessibilityLabel` now interpolates the current status), verified live after the fix.
  3. Even after fix #2, a bare `assertVisible: text: "محفوظة"` still failed — the fixed label is `"حالة الصفحة: محفوظة"` (a compound string containing, not equal to, the target), and Maestro's `text:` selector full-matches its pattern against the entire accessible text rather than doing a substring/contains match. Fixed at the **flow** level: wildcarded the pattern to `text: ".*محفوظة.*"`.
- **Live verification**: failed twice during diagnosis (bug #1's missing redirect, then bug #2/#3's accessibility-label matching), passed cleanly end to end after both the flow-level accommodation for #1 and the source+flow fixes for #2/#3 — including the final memorized-status content assertion after the real cold restart.

## Sanctioned text-selector exceptions

Every assertable app-rendered element on the 4 auth screens now has a testID and is asserted by id (see review fix-pass, `.superpowers/sdd/task-4-report.md`). The following text-selector assertions remain — none can carry a testID because none is an app-rendered React element:

- **iOS AutoFill sheet** (`02-register-smoke.yaml`, `04-pending-approval-smoke.yaml` — the `point: "91%, 61%"` tap inside the `register.password` retry block) — this is an OS-level "Use Strong Password?" system sheet, not app UI; it has no testID surface. A `tapOn: text: "Close", optional: true` replacement was tried and verified to fail: Maestro reports the step as `WARNED` (element not found — the sheet's "X" close control isn't exposed under matchable text/label), the sheet's "Automatic Strong Password cover view" is left stuck over the field, and the subsequent registration fails (screenshots + full repro in BUGLOG.md). Reverted to the `point:` tap per the brief's fallback instruction.
- **Expo dev-launcher chrome** (`_helpers/boot.yaml` — `"Continue"`/`"Close"` on the dev-launcher's one-time explainer and dev menu) — this is Expo tooling chrome layered outside the app bundle, not app code we control or can add testIDs to.

The one exception below is NOT an OS/tooling element (unlike the three above) — it's a plain app-rendered `Text`, sanctioned because content-based selection failed for structural reasons on its sibling element, not because a testID is impossible:

- **`student/appointments.tsx`'s pending-section empty-state title** (`journeys/02-appointment-booking.yaml`, `assertVisible: text: "لا توجد مواعيد معلقة"`) — used to prove the pending list is empty after the teacher accepts, since `StatusPill`'s testID lives on its outer `View` while the ACCEPTED/PENDING label is a separate nested `AppText` child, so neither a combined `id`+`text` selector nor a `childOf`-scoped variant could pin the check to that specific pill (both tried and failed — see Task 9 report). This element could carry a testID in a future task; it just wasn't in this journey's scope.

- **`student-mushaf.status-chip`'s status text** (`journeys/11-mushaf-persistence.yaml`, `assertVisible: text: ".*محفوظة.*"`) — the underlying `accessibilityLabel` bug was fixed at the source this task (see BUGLOG.md), but the assertion itself is still necessarily a text selector: `StatusPill`-style testIDs on this chip are fixed regardless of status value, so proving the *value* (not just presence) still requires reading the label text. Wildcarded (`.*محفوظة.*`) rather than matching the full compound label, since Maestro's `text:` selector full-matches its pattern (not substring/contains).

## Exclusions

Consolidated summary of every genuinely-uncovered interactive element across all 16 checker-enforced screens (student + auth) plus the journey-scoped admin/teacher testIDs, cross-checked against the per-screen tables above (each row already carries its own one-line justification — this section is the audit's roll-up, not a duplicate).

**By category:**

- **Empty-state-only under current seed data** (largest category — the control exists, has a testID, but no row/item ever renders to tap because ali/the fixture accounts have no seeded content for that surface): `student-home.revision-item/mark.N`, `student-appointments.recurring-slot.N`, `student-plans.row.N`, `student-recordings.row.N`, `student-reports.row.N`, `student-certificates.row.N` + its download/share/regenerate actions, `student-ijazahs.row.N` + its share/regenerate actions, `student-gamification.badges/badge.N`, `student-gamification.leaderboard-row.N`. None of these are testable without adding seed data outside this plan's scope (Plan 1's seed additions were themselves scoped to what Tasks 1-10 needed).
- **Error-state-only** (rendered solely on a fetch failure, never hit by any happy-path smoke flow): every screen's `*.retry` control (`student-appointments`, `student-grades`, `student-plans`, `student-recordings`, `student-reports`, `student-revisions`, `student-gamification`, `student-gamification.leaderboard-retry`, `student-certificates`, `student-ijazahs`).
- **Destructive or state-mutating, deliberately not tapped**: `student-home.logout` (ends the session under test); `student-appointments.submit` (booking is Journey 2's job, not the smoke flow's); `student-mushaf.mark-memorized`/`.status-option.LEARNING`/`.SOLID` (would persist a real, unresettable status mutation outside Journey 11's controlled use of `mark-memorized`); `student-recordings.stop-recording` (would upload a real recording).
- **Conditionally-rendered, not ali's case**: `student-appointments.change-teacher`/`.request-teacher` (only one renders depending on `assignedTeacher`, and ali has one); `student-grades`'s complete absence of any filter/segment control (confirmed by reading the full source — nothing to exercise beyond what's already covered).
- **Modal/sheet backdrop-dismiss variants**: `student-appointments.date-modal-backdrop`/`.time-modal-backdrop`, `student-mushaf.status-modal-backdrop`, `student-mushaf.record-modal-backdrop` — the flows dismiss the sheet as a side effect of picking a row/option instead; the backdrop tap itself is an untested but structurally-identical alternate path. (`student-appointments.date-modal-close`/`.time-modal-close` are similarly no longer tapped by any flow, per the fix-pass update in the per-control table above.)
- **Historical note, now resolved (Plan 1 findings fix-pass):** `student-home.quick-action.2/.3/.4` were previously believed to not reliably reach their intended destination (BUGLOG.md Finding #3). `.4` (and every other below-the-fold control) is conclusively root-caused to a Maestro `scrollUntilVisible` defect, not an app bug. `.2`/`.3` sit above the fold and re-test clean under both the old and new flow patterns, so `01-home-smoke.yaml` safely restored full, strict destination assertions for all 7 tiles (see the per-control table above) — but their *original* Plan 1 failure is only indirectly, not conclusively, attributed to the same `scrollUntilVisible` cause, since neither needs real scrolling for that mechanism to apply; see BUGLOG.md's Finding #3 for the full, hedged explanation. `05-reports-smoke.yaml` and `06-revisions-smoke.yaml` still reach their screens via `openLink` deep links rather than the quick-action tap (written before this root cause was known) — that workaround is now known-unnecessary but restoring direct-tap coverage there was out of the fix-pass's scope; see BUGLOG.md's Finding #3 for the follow-up note.
- **Root-only screens (not full passes, by design)**: `notifications.screen`, `messages.screen`, `account.screen`, `halaqa.screen` — Plan 1's brief scoped these to root-testID-only; a full per-control pass on any of the four is Plan 3 work.
- **Admin/teacher screens (journey-scoped, not full passes, by design)**: `admin/home.tsx`, `admin/change-requests.tsx`, `teacher/home.tsx`, `teacher/appointments.tsx`, `teacher/grade-form.tsx` — none are in `covered-screens.json`; each got exactly the minimal testIDs its journey needed (Tasks 8-9), not a full-screen audit. A dedicated admin-smoke and teacher-smoke task (mirroring Tasks 5-7's student-group pattern) is unstarted — the natural first work of Plan 2.
- **Nested/redundant controls**: `student-home.teacher-action` (same `onPress` target as its parent `teacher-card`, already exercised).
- **Not enforced by the checker at all, so not covered by this audit's core claim** (final whole-branch review finding): `check-testids.js`'s regex matches exactly five element types (`TouchableOpacity`, `Pressable`, `TextInput`, `Switch`, `IconButton`). It does not see `RefreshControl` — pull-to-refresh is present on 9 of the 12 student screens (`grades.tsx`, `reports.tsx`, `home.tsx`, `revisions.tsx`, `recordings.tsx`, `appointments.tsx`, `gamification.tsx`, `certificates.tsx`, `plans.tsx`, `ijazahs.tsx`), is untagged, and is exercised by no flow in this suite. `SectionHeader`'s action button is a real navigational control that happens to have a testID only where an author remembered to add one manually — the checker cannot enforce it. Neither is a testID gap the checker would catch if missing; both are genuine, previously-undocumented coverage gaps.

**Nothing in the categories above is an unexplained gap** — every item traces to one of: no seed data, error-only rendering, deliberate non-mutation, a documented app bug, or an explicit, brief-mandated scope boundary. `node mobile/scripts/check-testids.js` guarantees only the narrower claim that every `TouchableOpacity`/`Pressable`/`TextInput`/`Switch`/`IconButton` on the 16 covered screens has *a* testID — not "every interactive element" in the broader sense (see the `RefreshControl`/`SectionHeader`-action row above, which the checker's regex cannot see). This section covers the claim the checker CAN make (every testID it does enforce is accounted for by a flow or a justified reason) plus, now, an explicit note on what it structurally can't.
