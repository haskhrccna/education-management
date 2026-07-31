# E2E Bug Log

## Issue: Parent role blocked from logging in
- **Severity**: Critical
- **Flow**: flows/auth (login)
- **Steps**: Log in with a valid `parent`-role account's credentials.
- **Expected**: Parent is routed to `/parent/home` like any other supported role.
- **Actual**: `mobile/app/(auth)/index.tsx:38` hardcoded `allowedRoles = ['admin', 'teacher', 'student']`, omitting `'parent'`. Any parent account hit the "Unsupported role. Contact admin." alert and was never routed, even though `BottomNav.tsx` already defines a full `PARENT_TABS` set and `/parent/home` exists as a route.
- **Fix**: Added `'parent'` to `allowedRoles` in this task (Task 3). Fixed in commit for this plan step.

## Issue: `first-login.tsx` is an orphaned/unreachable screen
- **Severity**: Medium
- **Flow**: flows/auth (first-login)
- **Steps**: Search the app for any navigation call (`router.push`, `router.replace`, a `Link`, or a deep link) that targets `/first-login`.
- **Expected**: A screen that exists in `app/(auth)/first-login.tsx` should be reachable from some user flow (e.g. forced password change after first login with a temp password).
- **Actual**: No caller in the codebase navigates to `/first-login`. The screen (change current/new/confirm password, then route to `/${role}/home`) appears to implement a "first login must change password" flow, but nothing triggers it — not the login screen, not the auth store, not any redirect gate in `app/_layout.tsx`.
- **Fix**: Not fixed in this plan. testIDs were still added to the screen per the Task 3 brief so Task 4 can write a flow against it once reachability is decided. Classification: app bug — unreachable screen. Flagged for product decision in Plan 3 (either wire it into the auth flow, e.g. via a `mustChangePassword` flag from the server, or remove the screen).
