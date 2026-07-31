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

## Sanctioned text-selector exceptions

Every assertable app-rendered element on the 5 auth screens now has a testID and is asserted by id (see review fix-pass, `.superpowers/sdd/task-4-report.md`). The following text-selector assertions remain — none can carry a testID because none is an app-rendered React element:

- **Native `Alert.alert` content/buttons** (`05-first-login-smoke.yaml`, mismatch-error title `"كلمتا المرور غير متطابقتين"` and its `"OK"` button) — iOS renders `Alert.alert` as a system UIAlertController, not a React Native view; there is no `testID` prop to attach.
- **iOS AutoFill sheet** (`02-register-smoke.yaml`, `04-pending-approval-smoke.yaml` — the `point: "91%, 61%"` tap inside the `register.password` retry block) — this is an OS-level "Use Strong Password?" system sheet, not app UI; it has no testID surface. A `tapOn: text: "Close", optional: true` replacement was tried and verified to fail: Maestro reports the step as `WARNED` (element not found — the sheet's "X" close control isn't exposed under matchable text/label), the sheet's "Automatic Strong Password cover view" is left stuck over the field, and the subsequent registration fails (screenshots + full repro in BUGLOG.md). Reverted to the `point:` tap per the brief's fallback instruction.
- **Expo dev-launcher chrome** (`_helpers/boot.yaml` — `"Continue"`/`"Close"` on the dev-launcher's one-time explainer and dev menu) — this is Expo tooling chrome layered outside the app bundle, not app code we control or can add testIDs to.
