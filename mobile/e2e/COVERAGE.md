# E2E Coverage — Auth Screens (Task 4)

One row per control (testID) on the 5 auth screens covered by `flows/auth/`, cross-checked against Task 3's full testID inventory (`.superpowers/sdd/task-3-report.md`). No control is missing.

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
| forgot-password | `forgot-password.back-link` | `01-login-smoke.yaml` | tapped to return to login |
| first-login | `first-login.screen` | `05-first-login-smoke.yaml` | asserted visible after the `quran-review://first-login` deep link (as admin — see BUGLOG.md) |
| first-login | `first-login.current-password` | `05-first-login-smoke.yaml` | filled |
| first-login | `first-login.new-password` | `05-first-login-smoke.yaml` | filled |
| first-login | `first-login.confirm-password` | `05-first-login-smoke.yaml` | filled with a deliberately mismatching value |
| first-login | `first-login.submit` | `05-first-login-smoke.yaml` | tapped, triggers the native mismatch alert |
| pending-approval | `pending-approval.screen` | `02-register-smoke.yaml` | asserted visible as the post-register destination |
| pending-approval | `pending-approval.screen` | `04-pending-approval-smoke.yaml` | asserted visible after registration completes |
| pending-approval | `pending-approval.header` | `04-pending-approval-smoke.yaml` | asserted visible |
| pending-approval | `pending-approval.logout` | `04-pending-approval-smoke.yaml` | tapped, returns to `login.screen` |

## Not applicable to this coverage table

- `bottom-nav.*` (shared `BottomNav` component) and the `IconButton` `testID` prop are Task 3 infrastructure, not controls that live *on* any of the 5 auth screens — no auth screen renders either. Excluded per the brief's scope ("every control testID on the 5 auth screens").

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
| student-home | `student-home.quick-action.2` (grades) | `01-home-smoke.yaml` | tapped, in its own isolated fresh-login segment; only `assertNotVisible: student-home.screen` is checked — **destination NOT asserted and no return tap performed**. This tile's actual landing screen is confirmed nondeterministic (BUGLOG.md: reproduced landing on `student-appointments.screen` in isolation) — see Findings #3. The segment ends after the tap; no `back`/`bottom-nav` control is exercised for it. |
| student-home | `student-home.quick-action.3` (reports) | `01-home-smoke.yaml` | tapped, in its own isolated fresh-login segment; only `assertNotVisible: student-home.screen` is checked — **destination NOT asserted and no return tap performed**. This tile's actual landing screen is confirmed nondeterministic (BUGLOG.md: reproduced landing on `student-grades.screen` when chained after other navigation) — see Findings #3. `reports.back` is **not referenced by this or any flow file** (confirmed by grep); the `reports.tsx` back button remains untapped by any smoke flow. |
| student-home | `student-home.quick-action.4` (revisions) | `01-home-smoke.yaml` | tapped -> `/student/revisions`, back via `bottom-nav.student-home` |
| student-home | `student-home.quick-action.5` (plans) | `01-home-smoke.yaml` | tapped -> `/student/plans`, back via `bottom-nav.student-home` |
| student-home | `student-home.quick-action.6` (ijazahs) | `01-home-smoke.yaml` | tapped (after `scrollUntilVisible` — sits alone in the grid's last row) -> `/student/ijazahs`, back via `bottom-nav.student-home` |
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
| student-appointments | `student-appointments.date-modal-backdrop` | *(none — testID present, not tapped)* | Backdrop `Pressable` dismisses the sheet on tap; the flow instead dismisses via `date-modal-close`. Presence verified by `check-testids.js` only. |
| student-appointments | `student-appointments.date-modal-sheet` | `02-appointments-smoke.yaml` | asserted visible after opening, asserted not-visible after closing |
| student-appointments | `student-appointments.date-modal-close` | `02-appointments-smoke.yaml` | tapped to dismiss the sheet (see deviation below — this replaces picking a `date-option.N` row) |
| student-appointments | `student-appointments.date-option.N` | *(none — app bug, see BUGLOG.md)* | **Deviation:** not tapped by any flow. The entire `FlatList` of ~90 rendered rows collapses into one accessibility node on the `modalSheet` `Pressable` ancestor — individual rows have no separate accessibility-tree node, so `id:`/`text:` selectors cannot reach `date-option.0` (`Element not found`, confirmed even after `extendedWaitUntil`). A raw coordinate tap in the simulator confirms the row is functionally fine (selects the date, closes the sheet) — this is an accessibility-exposure bug (also affects VoiceOver), not a broken control. Logged in `BUGLOG.md`; testID presence verified by `check-testids.js` only. |
| student-appointments | `student-appointments.time-select` | `02-appointments-smoke.yaml` | tapped -> `time-modal-sheet` |
| student-appointments | `student-appointments.time-modal-backdrop` | *(none — testID present, not tapped)* | Same rationale as `date-modal-backdrop`. |
| student-appointments | `student-appointments.time-modal-sheet` | `02-appointments-smoke.yaml` | asserted visible after opening, asserted not-visible after closing |
| student-appointments | `student-appointments.time-modal-close` | `02-appointments-smoke.yaml` | tapped to dismiss the sheet (same deviation as the date picker) |
| student-appointments | `student-appointments.time-option.N` | *(none — app bug, see BUGLOG.md)* | Same deviation and root cause as `date-option.N` above. |
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

`reports.tsx` is not in the brief's "Files" list for this task, but is reachable from `student-home.screen` quick actions and doesn't render `BottomNav`, so there was no other reliable way for `01-home-smoke.yaml` to navigate back to home (per coordinator resolution #4's explicit fallback: "if a destination lacks one, add `<screen>.back` testID to it"). Only the back button was tagged — no root `.screen` testID, no `covered-screens.json` registration, no other controls on the screen touched. **`reports.back` ended up unused**: `quick-action.3`'s destination turned out to be nondeterministic (Findings #3), so the flow could not reliably assume it lands on `reports.tsx` to tap its back button — the segment ends right after the tap with only `assertNotVisible: student-home.screen`. The `reports.back` testID remains present in source (verified by `check-testids.js`) but is not exercised by any flow.

`mushaf.tsx` was originally in this section too (Task 5 added a bare `mushaf.back` testID as the same kind of fallback). Task 7 promotes `mushaf.tsx` to a fully-covered screen (added to `covered-screens.json`, every interactive element tagged, `mushaf.back` renamed to `student-mushaf.back` for convention consistency) — see the Task 7 section below for its full inventory; it no longer belongs in this fallback-only list.

| screen | control (testID) | flow file | step |
|---|---|---|---|
| reports | `reports.back` | *(none — testID present, not tapped)* | Added as a planned return path for `quick-action.3`, but never used: that tile's destination is nondeterministic (see Findings #3 / BUGLOG.md), so the flow cannot safely assume landing on `reports.tsx`. Presence verified by `check-testids.js` only. |

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
| student-home | `student-home.quick-action.5` (plans) / `.6` (ijazahs) | *(none — not tapped by this task's flows)* | Deliberately not tapped as a way of reaching `student-plans.screen`/`student-ijazahs.screen` — both are UNVERIFIED against BUGLOG.md Finding #3 per this task's brief, so this task reaches those screens exclusively via deep link. (`01-home-smoke.yaml`'s own loose, destination-non-asserting taps on these two tiles — pre-existing from Task 5 — are unaffected and out of this task's scope to change.) |

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

## Sanctioned text-selector exceptions

Every assertable app-rendered element on the 5 auth screens now has a testID and is asserted by id (see review fix-pass, `.superpowers/sdd/task-4-report.md`). The following text-selector assertions remain — none can carry a testID because none is an app-rendered React element:

- **Native `Alert.alert` content/buttons** (`05-first-login-smoke.yaml`, mismatch-error title `"كلمتا المرور غير متطابقتين"` and its `"OK"` button) — iOS renders `Alert.alert` as a system UIAlertController, not a React Native view; there is no `testID` prop to attach.
- **iOS AutoFill sheet** (`02-register-smoke.yaml`, `04-pending-approval-smoke.yaml` — the `point: "91%, 61%"` tap inside the `register.password` retry block) — this is an OS-level "Use Strong Password?" system sheet, not app UI; it has no testID surface. A `tapOn: text: "Close", optional: true` replacement was tried and verified to fail: Maestro reports the step as `WARNED` (element not found — the sheet's "X" close control isn't exposed under matchable text/label), the sheet's "Automatic Strong Password cover view" is left stuck over the field, and the subsequent registration fails (screenshots + full repro in BUGLOG.md). Reverted to the `point:` tap per the brief's fallback instruction.
- **Expo dev-launcher chrome** (`_helpers/boot.yaml` — `"Continue"`/`"Close"` on the dev-launcher's one-time explainer and dev menu) — this is Expo tooling chrome layered outside the app bundle, not app code we control or can add testIDs to.
