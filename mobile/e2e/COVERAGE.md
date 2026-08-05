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
| student-home | `student-home.quick-action.2` (grades) | `01-home-smoke.yaml` | tapped -> `student-grades.screen`, back via `bottom-nav.student-home` |
| student-home | `student-home.quick-action.3` (reports) | `01-home-smoke.yaml` | tapped -> `/student/reports` (no `BottomNav`; asserted not-visible), back via `reports.back` |
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

`reports.tsx` and `mushaf.tsx` are not in the brief's "Files" list for this task, but both are reachable from `student-home.screen` quick actions and neither renders `BottomNav`, so there was no other reliable way for `01-home-smoke.yaml` to navigate back to home (per coordinator resolution #4's explicit fallback: "if a destination lacks one, add `<screen>.back` testID to it"). Only the back button on each was tagged — no root `.screen` testID, no `covered-screens.json` registration, no other controls on either screen touched.

| screen | control (testID) | flow file | step |
|---|---|---|---|
| reports | `reports.back` | `01-home-smoke.yaml` | tapped, returns to `student-home.screen` (after `student-home.quick-action.3`) |
| mushaf | `mushaf.back` | `01-home-smoke.yaml` | tapped, returns to `student-home.screen` (after `student-home.mushaf-cta`) |

## Sanctioned text-selector exceptions

Every assertable app-rendered element on the 5 auth screens now has a testID and is asserted by id (see review fix-pass, `.superpowers/sdd/task-4-report.md`). The following text-selector assertions remain — none can carry a testID because none is an app-rendered React element:

- **Native `Alert.alert` content/buttons** (`05-first-login-smoke.yaml`, mismatch-error title `"كلمتا المرور غير متطابقتين"` and its `"OK"` button) — iOS renders `Alert.alert` as a system UIAlertController, not a React Native view; there is no `testID` prop to attach.
- **iOS AutoFill sheet** (`02-register-smoke.yaml`, `04-pending-approval-smoke.yaml` — the `point: "91%, 61%"` tap inside the `register.password` retry block) — this is an OS-level "Use Strong Password?" system sheet, not app UI; it has no testID surface. A `tapOn: text: "Close", optional: true` replacement was tried and verified to fail: Maestro reports the step as `WARNED` (element not found — the sheet's "X" close control isn't exposed under matchable text/label), the sheet's "Automatic Strong Password cover view" is left stuck over the field, and the subsequent registration fails (screenshots + full repro in BUGLOG.md). Reverted to the `point:` tap per the brief's fallback instruction.
- **Expo dev-launcher chrome** (`_helpers/boot.yaml` — `"Continue"`/`"Close"` on the dev-launcher's one-time explainer and dev menu) — this is Expo tooling chrome layered outside the app bundle, not app code we control or can add testIDs to.
