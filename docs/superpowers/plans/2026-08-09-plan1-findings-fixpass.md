# Plan 1 Findings Fix-Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every outstanding real app bug documented in `mobile/e2e/BUGLOG.md` from the E2E Plan 1 branch, now that it's merged to `main`.

**Architecture:** Six independent, mechanically-scoped fixes to existing mobile/server code, each verified against the existing Maestro E2E suite (which already covers the affected screens) plus targeted new server unit tests where server logic changes. No new screens, no new architecture — every fix targets a specific, already-diagnosed defect.

**Tech Stack:** Same as the rest of the repo — Expo/React Native mobile, Express/Prisma server, Maestro E2E (already installed from Plan 1), Jest for server tests.

## Global Constraints

- Every fix must be verified against the live iOS simulator via the existing Maestro suite (`mobile/e2e/`) before being considered done — this is a bug-fix pass on code the E2E suite already exercises, so "the flows still pass" is the primary proof, not a new requirement to invent.
- `mobile/e2e/run.sh` requires the Prisma AI-invocation consent gate for its DB reset step — that consent is coordinator-only (already held from Plan 1); implementers use direct `maestro test <path>` invocations against a coordinator-reset E2E database, exactly as established throughout Plan 1. Do not attempt `prisma migrate reset` yourselves.
- `iOS Keychain survives clearState` — any flow with multiple `launchApp: clearState: true` calls needs `clearKeychain` immediately before each one (established Plan 1 rule).
- User decisions already made, binding for this plan: `first-login.tsx` is **removed** (not wired in); grade submission **is** wired into the streak (`recordActivity`/`evaluateMilestones`).
- `mobile/e2e/BUGLOG.md` and `mobile/e2e/COVERAGE.md` must be updated to mark each fixed finding as resolved — do not leave stale "not fixed" language once a fix lands.
- Server: never throw raw errors — use `AppError`. Gamification calls (`recordActivity`/`evaluateMilestones`) are always best-effort, wrapped in try/catch, matching every existing caller (`recording.service.ts`, `revision.service.ts`, `ijazah.service.ts`, `memorization.service.ts`, `curriculum-plan.service.ts`).
- Mobile: `accessible={false}` is the established, already-shipped fix pattern for the "outer Pressable/TouchableOpacity with `onPress` swallows its interactive descendants into one iOS accessibility node" bug class — it does not affect `onPress`/gesture handling, only accessibility-tree exposure.

---

### Task 1: Remove `first-login.tsx` (dead, unreachable screen)

**Files:**
- Delete: `mobile/app/(auth)/first-login.tsx`
- Delete: `mobile/e2e/flows/auth/05-first-login-smoke.yaml`
- Modify: `mobile/app/_layout.tsx:129` (remove the `<Stack.Screen name="(auth)/first-login" />` line)
- Modify: `mobile/e2e/covered-screens.json` (remove the `"app/(auth)/first-login.tsx"` entry — 17 → 16 checker-enforced screens)
- Modify: `mobile/e2e/COVERAGE.md` (remove the `first-login` table section; update every "5 auth screens" reference to "4 auth screens"; update "17 checker-enforced screens" references to "16")
- Modify: `mobile/e2e/BUGLOG.md` (mark the "Issue: `first-login.tsx` is an orphaned/unreachable screen" entry as RESOLVED — removed, not wired in)
- Test: `node mobile/scripts/check-testids.js`, `cd mobile && npx tsc --noEmit`, live Maestro run of `mobile/e2e/flows/auth`

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces: `mobile/e2e/covered-screens.json` with 16 entries (4 auth + 12 student) — Task 3's checker-count expectations must match this new baseline.

- [ ] **Step 1: Delete the screen and its route registration**

```bash
rm mobile/app/\(auth\)/first-login.tsx
```

In `mobile/app/_layout.tsx`, remove line 129:
```tsx
            <Stack.Screen name="(auth)/first-login" />
```

- [ ] **Step 2: Delete the orphaned E2E flow**

```bash
rm mobile/e2e/flows/auth/05-first-login-smoke.yaml
```

- [ ] **Step 3: Update `covered-screens.json`**

```json
[
  "app/(auth)/index.tsx",
  "app/(auth)/register.tsx",
  "app/(auth)/forgot-password.tsx",
  "app/(auth)/pending-approval.tsx",
  "app/student/home.tsx",
  "app/student/appointments.tsx",
  "app/student/grades.tsx",
  "app/student/recordings.tsx",
  "app/student/reports.tsx",
  "app/student/revisions.tsx",
  "app/student/teacher-change.tsx",
  "app/student/plans.tsx",
  "app/student/mushaf.tsx",
  "app/student/gamification.tsx",
  "app/student/certificates.tsx",
  "app/student/ijazahs.tsx"
]
```

- [ ] **Step 4: Update `COVERAGE.md`**

Remove the entire `first-login` table block (the 5 rows starting `| first-login | \`first-login.screen\` | ...`). Update the header line (currently `One row per control (testID) on the 5 auth screens covered by \`flows/auth/\`...`) to say "4 auth screens". Update the `## Sanctioned text-selector exceptions` section's opening line ("Every assertable app-rendered element on the 5 auth screens...") to say "4 auth screens", and remove the `Native Alert.alert content/buttons (05-first-login-smoke.yaml, ...)` bullet entirely (that was first-login's mismatch-error alert — no longer applicable). Update the `## Exclusions` section's "17 checker-enforced screens" to "16 checker-enforced screens".

- [ ] **Step 5: Update `BUGLOG.md`**

Find the entry starting `## Issue: \`first-login.tsx\` is an orphaned/unreachable screen` and change its heading to:
```
## Issue: `first-login.tsx` is an orphaned/unreachable screen (RESOLVED — removed)
```
Add one line at the end of that entry's `- **Fix**:` bullet (replacing "Not fixed in this plan..."):
```
- **Fix**: Removed entirely in the Plan 1 findings fix-pass — the screen, its route, and its E2E flow were deleted. Product decision: the screen was fully dead code with no server-side trigger mechanism (no `mustChangePassword` flag exists), so removal was simpler and lower-risk than building the missing wiring.
```

- [ ] **Step 6: Verify gates**

```bash
cd mobile && node scripts/check-testids.js
```
Expected: `check-testids: OK (16 screens covered)`

```bash
cd mobile && npx tsc --noEmit
```
Expected: clean, no errors (confirms nothing else imports/references the deleted screen).

```bash
grep -rn "first-login" mobile/app mobile/src
```
Expected: no matches (confirms the route registration and screen are fully gone from app code; leave the historical mentions in `mobile/e2e/flows/journeys/*.yaml` comments and `BUGLOG.md`/`COVERAGE.md` prose as-is — those are documentation, not code).

- [ ] **Step 7: Live-verify the auth suite**

Environment: iOS simulator booted, Metro serving this worktree on :8081, server on :4000 against the E2E DB, `JAVA_HOME=/opt/homebrew/opt/openjdk` exported.

```bash
maestro test mobile/e2e/flows/auth
```
Expected: `4/4 Flows Passed` (down from 5/5 — `05-first-login-smoke` no longer exists).

- [ ] **Step 8: Commit**

```bash
git add mobile/app/_layout.tsx mobile/e2e/covered-screens.json mobile/e2e/COVERAGE.md mobile/e2e/BUGLOG.md
git rm mobile/app/\(auth\)/first-login.tsx mobile/e2e/flows/auth/05-first-login-smoke.yaml
git commit -m "fix(mobile): remove first-login.tsx — dead, unreachable screen (BUGLOG finding)"
```

---

### Task 2: Fix `BottomNav` active-tab mismatch on non-tab student screens

**Files:**
- Modify: `mobile/app/student/ijazahs.tsx:198`
- Modify: `mobile/app/student/revisions.tsx:195`
- Modify: `mobile/app/student/plans.tsx:128`
- Modify: `mobile/app/student/teacher-change.tsx:162`
- Modify: `mobile/e2e/BUGLOG.md` (mark the "BottomNav shows Home as the active tab" entry RESOLVED)
- Test: `cd mobile && npx tsc --noEmit`, live Maestro run of the 4 affected screens' smoke flows

**Interfaces:**
- Consumes: `BottomNav`'s existing `active: string` prop (`mobile/src/components/BottomNav.tsx:206`, untyped as a literal union — any string is valid, `isActive = active === tab.id` at line 231 simply becomes `false` for every tab when `active` matches none of them).
- Produces: nothing new for later tasks.

**Context:** `BottomNav`'s `STUDENT_TABS` only has 6 tab ids: `home`, `sessions`, `recordings`, `halaqa`, `grades`, `profile`. `ijazahs.tsx`, `revisions.tsx`, `plans.tsx`, and `teacher-change.tsx` are all reached via `student-home.tsx`'s quick-actions grid, not the tab bar — they are not primary tab destinations and have no tab of their own. All four currently pass `active="home"`, incorrectly highlighting the Home tab. The correct fix (per the original BUGLOG finding's own "Expected" statement — "or no tab, if these aren't primary tab destinations") is to pass a value that matches no tab id, so no tab renders as active.

- [ ] **Step 1: Fix all four screens**

In `mobile/app/student/ijazahs.tsx:198`, change:
```tsx
      <BottomNav role="student" active="home" />
```
to:
```tsx
      <BottomNav role="student" active="none" />
```

Apply the identical change (`active="home"` → `active="none"`) at:
- `mobile/app/student/revisions.tsx:195`
- `mobile/app/student/plans.tsx:128`
- `mobile/app/student/teacher-change.tsx:162`

- [ ] **Step 2: Verify tsc**

```bash
cd mobile && npx tsc --noEmit
```
Expected: clean (the `active` prop is typed as plain `string`, so `"none"` is valid without any type change).

- [ ] **Step 3: Live-verify**

```bash
maestro test mobile/e2e/flows/student/07-teacher-change-smoke.yaml mobile/e2e/flows/student/06-revisions-smoke.yaml mobile/e2e/flows/student/08-plans-smoke.yaml mobile/e2e/flows/student/12-ijazahs-smoke.yaml
```
Expected: `4/4 Flows Passed` — none of these flows assert on `bottom-nav.*` `isActive` styling (only tap targets), so this is a behavior-only change; the flows are not expected to need any assertion changes.

Take one manual screenshot check via the simulator on the Ijazahs screen after this fix (open the app, log in as `ali@quran-review.com`, navigate to Ijazahs via the quick-action tile) to visually confirm no bottom-nav tab is highlighted green — this is the one visual detail no Maestro assertion in the existing suite checks for.

- [ ] **Step 4: Update `BUGLOG.md`**

Find the entry starting `## BottomNav shows "Home" as the active tab on the Ijazahs screen`. Change the heading to:
```
## BottomNav shows "Home" as the active tab on the Ijazahs screen (RESOLVED — Plan 1 findings fix-pass)
```
Replace the `- **Classification**:` line with:
```
- **Classification:** minor app bug (BottomNav `active` prop mismatch) — FIXED. `ijazahs.tsx`, `revisions.tsx`, `plans.tsx`, and `teacher-change.tsx` (found via a broader grep during the fix pass — same root cause, not previously documented individually) now pass `active="none"` instead of `active="home"`, since none of the four are primary tab destinations and `active="none"` matches no `STUDENT_TABS` id, correctly leaving the tab bar unhighlighted.
```

- [ ] **Step 5: Commit**

```bash
git add mobile/app/student/ijazahs.tsx mobile/app/student/revisions.tsx mobile/app/student/plans.tsx mobile/app/student/teacher-change.tsx mobile/e2e/BUGLOG.md
git commit -m "fix(mobile): BottomNav no longer highlights Home on non-tab student screens (BUGLOG finding)"
```

---

### Task 3: Fix date/time-picker accessibility (`student/appointments.tsx`)

**Files:**
- Modify: `mobile/app/student/appointments.tsx:491` (date picker's `modalSheet` Pressable)
- Modify: `mobile/app/student/appointments.tsx:543` (time picker's `modalSheet` Pressable — same structure, mirrored)
- Modify: `mobile/e2e/flows/student/02-appointments-smoke.yaml` (optional strengthening — see Step 3)
- Modify: `mobile/e2e/BUGLOG.md` (mark the date/time-picker finding RESOLVED; note the admin-approvals row text-reachability finding is now moot since it already uses testID selection successfully)
- Test: live Maestro run of `02-appointments-smoke.yaml`, manual accessibility-hierarchy check

**Interfaces:**
- Consumes: the same `accessible={false}` fix pattern already shipped in `mobile/app/admin/change-requests.tsx:249` (Plan 1, Task 8) — this task applies the identical, already-proven pattern to a second location with the same root cause.
- Produces: nothing new for later tasks.

**Context:** `mobile/app/student/appointments.tsx`'s date-picker and time-picker modals each wrap a `FlatList` of ~90 rows inside a `Pressable` (`modalSheet`, with its own `onPress={() => {}}`) inside another `Pressable` (`modalBackdrop`, `onPress={dismiss}`). Both `onPress` handlers make their `Pressable` implicitly `accessible={true}` on iOS with no override, collapsing the entire `FlatList` (and every row's testID) into one opaque accessibility node — the exact same defect class already found and fixed once on `admin/change-requests.tsx`'s row `TouchableOpacity`. The rows work fine for a sighted touch user (BUGLOG confirms a raw coordinate tap selects correctly); they are unreachable by testID/text selectors and by VoiceOver.

- [ ] **Step 1: Fix the date-picker modal sheet**

In `mobile/app/student/appointments.tsx`, find (around line 491):
```tsx
          <Pressable style={styles.modalSheet} onPress={() => {}} testID="student-appointments.date-modal-sheet">
```
Change to:
```tsx
          <Pressable
            style={styles.modalSheet}
            onPress={() => {}}
            accessible={false}
            testID="student-appointments.date-modal-sheet"
          >
```

- [ ] **Step 2: Fix the time-picker modal sheet (identical structure, around line 543)**

```tsx
          <Pressable style={styles.modalSheet} onPress={() => {}} testID="student-appointments.time-modal-sheet">
```
Change to:
```tsx
          <Pressable
            style={styles.modalSheet}
            onPress={() => {}}
            accessible={false}
            testID="student-appointments.time-modal-sheet"
          >
```

- [ ] **Step 3: Live-verify the fix actually exposes individual rows**

Environment: iOS simulator booted, Metro serving this worktree, server on :4000 against the E2E DB, `JAVA_HOME=/opt/homebrew/opt/openjdk` exported.

```bash
maestro test mobile/e2e/flows/student/02-appointments-smoke.yaml
```
Expected: still passes (this flow currently dismisses the pickers via `date-modal-close`/`time-modal-close`, not by selecting a row — that part of the flow is unaffected by this fix).

Then write a standalone verification (do NOT commit this as a new permanent flow unless it passes cleanly and you choose to fold it into `02-appointments-smoke.yaml` as a strengthening): open `student-appointments.book-form`, tap `student-appointments.date-select`, then attempt `tapOn: { id: "student-appointments.date-option.0" }`. If this now succeeds (previously it failed with `Element not found`), the fix worked — the individual rows are now addressable.

If it succeeds, strengthen `02-appointments-smoke.yaml` by replacing its `date-modal-close`/`time-modal-close` dismiss steps with an actual row selection: `tapOn: { id: "student-appointments.date-option.0" }` (closes the sheet as a side effect of selecting a date, per the component's `onPress` at line 514-517) and the equivalent for the time picker. This closes the loop on the original finding's own "Test-flow workaround" note, which explicitly said the row testIDs "remain present in source but are not tapped by any flow" — with the accessibility fix landed, they now can be. If you extend the flow, re-run it and confirm it still passes end to end.

- [ ] **Step 4: Update `BUGLOG.md`**

Find the entry `## Date/time picker modal rows in student/appointments.tsx are not individually reachable by accessibility identifier`. Change the heading to:
```
## Date/time picker modal rows in student/appointments.tsx are not individually reachable by accessibility identifier (RESOLVED — Plan 1 findings fix-pass)
```
Replace the `- **Classification**:` line with:
```
- **Classification:** real app-level accessibility bug (WCAG AA row-level navigability) — FIXED. Added `accessible={false}` to both `date-modal-sheet` and `time-modal-sheet` Pressables (`mobile/app/student/appointments.tsx`), the same proven pattern already shipped for `admin/change-requests.tsx`'s row in Plan 1 Task 8. Verified live: `student-appointments.date-option.0`/`time-option.N` are now individually addressable by testID.
```

Find the entry `## Task 8: \`admin/change-requests.tsx\` approval-row text is not individually reachable by Maestro's \`text:\` selector`. Add a note at the end:
```
- **Status note (Plan 1 findings fix-pass):** the row's testID-based selection (documented in this entry's own "Test-flow workaround") was never actually blocked by this finding — only `text:`-based selection was. `journeys/01-registration-approval.yaml` already uses `id: "admin-approvals.row.0"` successfully today. This finding remains technically true (the row's rendered *text* still isn't reachable via `text:` selectors) but has no practical impact on this suite; not further modified in this pass.
```

- [ ] **Step 5: Commit**

```bash
git add mobile/app/student/appointments.tsx mobile/e2e/flows/student/02-appointments-smoke.yaml mobile/e2e/BUGLOG.md
git commit -m "fix(mobile): date/time-picker rows now individually accessible (BUGLOG finding)"
```
(Omit `mobile/e2e/flows/student/02-appointments-smoke.yaml` from the `git add` if Step 3's flow strengthening wasn't applied.)

---

### Task 4: Investigate and resolve the quick-action wrong-navigation bug

**Files:**
- Modify: `mobile/app/student/home.tsx` (only if a real code defect is found and fixed — see below)
- Modify: `mobile/e2e/flows/student/01-home-smoke.yaml` (only if the isolated-segment workaround can be removed because the bug no longer reproduces)
- Modify: `mobile/e2e/BUGLOG.md` (document the outcome either way — fixed, or confirmed non-reproducing with a clean environment)
- Test: live Maestro runs against a **freshly restarted** Metro + simulator (not the same long-running dev session used elsewhere in this plan)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing for later tasks.

**Context — read this before starting:** Three of `student-home.tsx`'s seven quick-action tiles (`.2`/grades, `.3`/reports, `.4`/revisions) were found across Plan 1 to intermittently navigate to the WRONG destination screen, each landing on a *different* wrong screen in different reproductions. Extensive live diagnosis already ruled out: testID/selector issues (a raw coordinate tap reproduces the identical wrong result), scroll-momentum races (3s explicit waits made no difference), rate-limiting (reproduced as the very first API call of a session), and a destination/route problem (a direct deep link and two other components calling the identical `router.push('/student/grades')` always work correctly). Direct code inspection of the `quickActions.map((action, index) => <TouchableOpacity onPress={() => router.push(action.route as any)} ... />)` pattern shows no obvious defect — `action` is a fresh per-render binding, not a stale closure over a memoized array. The prior investigation's own top recommendation, never yet tried, is: **re-test against a freshly restarted Metro + simulator, not one reused across dozens of app launches in a single long dev session** (Metro had been running for well over an hour across the whole session when this was found) — the hypothesis being Fast-Refresh/dev-session state corruption rather than a genuine production defect.

**This task has two possible honest outcomes — follow the evidence, don't force a "fix":**
- **(A) The bug does not reproduce with a genuinely fresh Metro + simulator** across a reasonable number of attempts (aim for at least 15-20 taps across `.2`, `.3`, `.4`, mixing isolated-fresh-session taps and taps chained after other navigation, mirroring the original repro conditions as closely as possible). If so, this confirms the dev-session-corruption hypothesis — no code changes are needed. Document this clearly, restore `01-home-smoke.yaml`'s full tap→assert-destination→return coverage for `.2`/`.3`/`.4` (removing the isolated-segment/loose-assertion workaround, since the destinations are now provably reliable), and close the finding.
- **(B) The bug still reproduces** even with a fresh environment. If so, this is a genuine production defect — continue root-causing with fresh eyes: check the installed `expo-router` version against its changelog for known `router.push` race conditions, check whether `quickActions` (recreated every render, per Step 1's own read of the source) combined with React 18's automatic batching could be double-invoking or stale-invoking `onPress` under rapid taps, and check the simulator's own event log/timing during a live repro. If a concrete root cause is found, fix it minimally and verify live across the same repro conditions that found it. If the root cause remains elusive after a genuinely fresh-environment investigation, document the additional (fresh-environment) evidence gathered, keep `01-home-smoke.yaml`'s existing workaround as-is, and escalate clearly — this would be the one finding in this plan legitimately deferred to a future pass, and should be reported to the user as such rather than silently left in the same state.

- [ ] **Step 1: Fully restart the environment**

```bash
pkill -f "expo start" 2>/dev/null; true
```
Kill any existing Metro process. Then:
```bash
cd mobile && npx expo start --port 8081 --clear
```
(note `--clear`, to also flush Metro's transform cache — not just restart the process). Reboot the iOS simulator itself (Simulator app → Device → Erase All Content and Settings, or use a fresh simulator device) rather than reusing one that's had the app installed/relaunched dozens of times already this plan. Rebuild and reinstall the dev-client app fresh (`npx expo run:ios`).

- [ ] **Step 2: Reproduce methodically**

With the server running against the E2E database (coordinator-reset, per this plan's Global Constraints), log in as `ali@quran-review.com` and manually (or via a temporary standalone Maestro probe flow, not committed) tap `quick-action.2`, then relaunch fresh and tap `.3`, then relaunch fresh and tap `.4` — repeat each several times, both as the first navigation of a fresh session and chained after visiting 2-3 other screens first (mirroring the exact conditions Task 5/6's original reproductions used). Record the destination reached each time.

- [ ] **Step 3: Act on the outcome**

If outcome (A) — bug doesn't reproduce — update `mobile/e2e/flows/student/01-home-smoke.yaml`: replace the isolated-segment, loose-`assertNotVisible`-only taps for `quick-action.2`/`.3`/`.4` with full tap→assert-correct-destination→return-via-`bottom-nav.student-home` coverage, matching the pattern already used for `.0`/`.1`. Run the full flow live to confirm.

If outcome (B) — bug still reproduces with concrete new evidence but no root cause found — make no code changes; the existing `01-home-smoke.yaml` workaround stays as-is.

If outcome (B) with a root cause found and fixed — apply the minimal fix to `mobile/app/student/home.tsx`, then update `01-home-smoke.yaml` the same way as outcome (A) once verified.

- [ ] **Step 4: Update `BUGLOG.md`**

Find the entry `## \`student-home.tsx\` quick-action tiles intermittently navigate to the WRONG destination screen` (and its two "Task 6 addendum" follow-ups). Add a new subsection at the end of the last addendum:

For outcome (A):
```
## Plan 1 findings fix-pass: quick-action wrong-navigation bug confirmed as dev-session/Fast-Refresh artifact, not a production defect
- **Investigation:** re-tested `.2`/`.3`/`.4` against a freshly restarted Metro (`--clear`) and a freshly erased iOS simulator, per this file's own standing recommendation. [N] reproduction attempts across all three tiles, both as first-navigation-of-session and chained after other screens — [describe actual result: e.g. "zero wrong-destination results in N attempts"].
- **Conclusion:** the original findings' own hypothesis holds — the wrong-destination behavior was specific to a single long-running dev session (Metro serving the same process across dozens of app launches, well over an hour), not a reproducible defect in the shipped code or a genuine production risk.
- **Test-flow change:** `01-home-smoke.yaml`'s isolated-segment workaround for `.2`/`.3`/`.4` removed — all seven quick-action tiles now get full tap→assert-destination→return coverage, matching `.0`/`.1`'s original treatment.
```

For outcome (B), write the equivalent honest section describing what was tried, what was found (or not found), and the current state.

- [ ] **Step 5: Commit**

```bash
git add mobile/e2e/BUGLOG.md
# plus mobile/app/student/home.tsx and/or mobile/e2e/flows/student/01-home-smoke.yaml, only if changed
git commit -m "fix(mobile): resolve quick-action wrong-navigation investigation (BUGLOG finding)"
```

---

### Task 5: Fix cold-restart auth-gate redirect

**Files:**
- Modify: `mobile/app/_layout.tsx` (the auth-gate `useEffect`, around lines 57-81 — line numbers will have shifted slightly after Task 1's removal of the `first-login` route line; locate by content, not line number)
- Modify: `mobile/e2e/flows/journeys/11-mushaf-persistence.yaml` (the final assertion can now be strengthened — see Step 3)
- Modify: `mobile/e2e/BUGLOG.md` (mark the finding RESOLVED)
- Test: live Maestro run of `mobile/e2e/flows/journeys/11-mushaf-persistence.yaml`, plus a quick manual re-verification of every other journey/flow that does a `launchApp` without `clearState` after an initial login (none currently exist besides Journey 11, per a repo-wide check in Step 1)

**Interfaces:**
- Consumes: `useAuthStore()`'s `user` object shape (`mobile/src/auth/store.ts` — has `.status`, `.role`, `.onboardingCompletedAt`, already used by the gate's existing branches).
- Produces: nothing new for later tasks.

**Context:** `app/_layout.tsx`'s auth-gate `useEffect` has three branches: unauthenticated-on-protected-screen → bounce to `/`; pending → bounce to `/pending-approval`; active-not-onboarded → bounce to onboarding. There is no fourth branch for "authenticated, active, onboarded user currently sitting on a PUBLIC route" — so a real user who force-quits and reopens the app with a still-valid Keychain token sees the branded login screen (not a spinner, not an error — `loadSession()` genuinely succeeds in the background, confirmed by a direct-deep-link probe reaching a protected route immediately after the same relaunch) and stays there until they manually submit the login form again. This is Medium-High severity: it defeats the entire purpose of persisting a session token.

- [ ] **Step 1: Confirm there's no other code path relying on this gap**

```bash
grep -rn "clearState: true" mobile/e2e/flows/journeys/*.yaml
```
Every journey except `11-mushaf-persistence.yaml` always calls `clearKeychain` immediately before each `launchApp: clearState: true` (established Plan 1 rule) — meaning every OTHER flow's relaunches genuinely start from a logged-out state and are unaffected by this fix. Only `11-mushaf-persistence.yaml` deliberately relaunches with a still-valid session, which is exactly the scenario this fix targets. Confirm this with the grep before proceeding (expected: `clearKeychain` appears immediately before every `launchApp: clearState: true` line across all journey files, with `11-mushaf-persistence.yaml` being the sole flow using a bare `launchApp` with no `clearState` at all).

- [ ] **Step 2: Add the missing auth-gate branch**

In `mobile/app/_layout.tsx`, find the auth-gate `useEffect` (search for the comment `// Auth gate: redirect based on session state once settings are loaded`). The current structure is:

```tsx
    if (!user) {
      if (inProtectedScreen) {
        router.replace('/');
      }
    } else if (user.status === 'pending') {
      router.replace('/pending-approval');
    } else if (
      // F5: first sign-in → role onboarding wizard (admin exempt; stamped users skip).
      user.status === 'active' &&
      user.onboardingCompletedAt == null &&
      ['student', 'teacher', 'parent'].includes(user.role) &&
      segments[0] !== 'onboarding'
    ) {
      router.replace(`/onboarding/${user.role}` as never);
    }
  }, [isLoaded, user, segments]);
```

Add a fourth `else if` branch after the onboarding one:

```tsx
    if (!user) {
      if (inProtectedScreen) {
        router.replace('/');
      }
    } else if (user.status === 'pending') {
      router.replace('/pending-approval');
    } else if (
      // F5: first sign-in → role onboarding wizard (admin exempt; stamped users skip).
      user.status === 'active' &&
      user.onboardingCompletedAt == null &&
      ['student', 'teacher', 'parent'].includes(user.role) &&
      segments[0] !== 'onboarding'
    ) {
      router.replace(`/onboarding/${user.role}` as never);
    } else if (user.status === 'active' && !inProtectedScreen) {
      // A fully authenticated, active, onboarded user sitting on a PUBLIC
      // route (e.g. loadSession() restored a still-valid Keychain token on a
      // cold app restart, but nothing had ever redirected them off the
      // login/register/forgot-password screens). Without this branch, a real
      // user who force-quits and reopens the app sees the login form on
      // every cold start even though their session never expired.
      router.replace(`/${user.role}/home` as never);
    }
  }, [isLoaded, user, segments]);
```

The new branch only fires when `!inProtectedScreen` (i.e. the user is on `/`, `/register`, `/forgot-password`, or `/pending-approval` — the public route set), so it cannot interfere with the onboarding branch (which specifically checks `segments[0] !== 'onboarding'`, and `onboarding` is itself in `protectedRoots`, so a user actively on `/onboarding/*` never reaches this new branch) or with any already-protected screen the user is legitimately on.

- [ ] **Step 3: Live-verify — the core scenario**

Environment: iOS simulator booted, Metro serving this worktree, server on :4000 against the E2E DB, `JAVA_HOME=/opt/homebrew/opt/openjdk` exported.

```bash
maestro test mobile/e2e/flows/journeys/11-mushaf-persistence.yaml
```
Expected: still passes. The flow currently proceeds straight to a protected deep link after the relaunch rather than asserting `student-home.screen` (documented in the flow's own comments as the honest reflection of the pre-fix bug). Now that the bug is fixed, strengthen the flow: after the `stopApp`/`launchApp` (no clearState) step, replace the direct-to-deep-link approach with an assertion that the app lands on `student-home.screen` on its own — remove the "DEVIATION" comment block describing the old broken behavior and its workaround, since the underlying bug it was working around no longer exists. Re-run the flow after strengthening it to confirm the new, stronger assertion passes.

- [ ] **Step 4: Live-verify — no regression on the rest of the suite**

```bash
maestro test mobile/e2e/flows/auth
maestro test mobile/e2e/flows/student
```
Expected: `4/4` (auth, post-Task-1) and `12/12` (student) still passing — every one of these flows starts with `clearKeychain` + `clearState: true`, so none of them have a stale session to trigger the new branch unexpectedly; this run is purely a regression check.

- [ ] **Step 5: Update `BUGLOG.md`**

Find the entry `## Task 10: a cold app restart with a fully valid, restored session lands on the login screen instead of home`. Change the heading to:
```
## Task 10: a cold app restart with a fully valid, restored session lands on the login screen instead of home (RESOLVED — Plan 1 findings fix-pass)
```
Replace the `- **Classification**:` line with:
```
- **Classification:** app bug (real, user-facing) — FIXED. Added a fourth branch to `app/_layout.tsx`'s auth-gate `useEffect`: an authenticated, active, onboarded user on a public route (`!inProtectedScreen`) is now redirected to `/${role}/home`. Scoped narrowly enough that it cannot interfere with the pending/onboarding branches (both already handled by earlier, higher-priority branches in the same `if`/`else if` chain) or with a user legitimately on a protected screen. Verified live: `journeys/11-mushaf-persistence.yaml`'s cold-restart-with-a-valid-session scenario now lands directly on `student-home.screen`, no protected-deep-link workaround needed.
```

- [ ] **Step 6: Commit**

```bash
git add mobile/app/_layout.tsx mobile/e2e/flows/journeys/11-mushaf-persistence.yaml mobile/e2e/BUGLOG.md
git commit -m "fix(mobile): auth gate redirects an already-authenticated user off public routes (BUGLOG finding)"
```

---

### Task 6: Wire grade submission into the streak

**Files:**
- Modify: `packages/server/src/services/grade.service.ts`
- Modify: `packages/server/src/services/__tests__/grade.service.test.ts`
- Modify: `mobile/e2e/flows/journeys/10-streak-after-grade.yaml` (the flow's own header comment and final assertion — see Step 4)
- Modify: `mobile/e2e/COVERAGE.md` (journey-10 section)
- Modify: `mobile/e2e/BUGLOG.md` (mark the finding RESOLVED)
- Test: `cd packages/server && npm test -- --testPathPattern=grade.service`, live Maestro run of `journeys/10-streak-after-grade.yaml`

**Interfaces:**
- Consumes: `recordActivity(userId: string, when?: Date)` and `evaluateMilestones(studentId: string)`, both exported from `packages/server/src/services/gamification.service.ts` (already used identically by `recording.service.ts:69-70`, `revision.service.ts:266`, `ijazah.service.ts:95`, `memorization.service.ts:89`, `curriculum-plan.service.ts:119-120`).
- Produces: nothing new for later tasks.

**Context:** `grade.service.ts`'s `createGrade` is the one plausible "student was active today" action that doesn't call `recordActivity`. User decision: wire it in, following the exact same best-effort try/catch pattern every sibling service already uses (a gamification failure must never break the primary grade-creation flow).

- [ ] **Step 1: Add the import and the call**

In `packages/server/src/services/grade.service.ts`, add to the top of the file (after the existing imports):
```ts
import { recordActivity, evaluateMilestones } from './gamification.service';
```

In `createGrade`, after the `notifyNewGrade` call and before `return grade;`, add:
```ts
  // Phase 5: a graded session counts as daily activity for the student,
  // same as recording/revision/memorization/ijazah/curriculum-plan actions.
  // Best-effort — a streak-update failure must not break grade submission.
  try {
    await recordActivity(studentId);
    await evaluateMilestones(studentId);
  } catch {
    /* gamification is best-effort */
  }

  return grade;
```

The full function should now read:
```ts
export const createGrade = async (
  teacherId: string,
  studentId: string,
  surahId: number | null,
  gradeValue: string,
  type: GradeTypeInput,
  notes?: string
) => {
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.deletedAt) throw new AppError(404, 'Student not found');
  if (student.role !== 'STUDENT') throw new AppError(400, 'Target user is not a student');
  await assertTeacherCanAccessStudent(teacherId, studentId);

  if (surahId !== null) {
    const surah = await prisma.surah.findUnique({ where: { id: surahId }, select: { id: true } });
    if (!surah) throw new AppError(400, 'Surah not found');
  }

  const grade = await prisma.grade.create({
    data: { teacherId, studentId, surahId, grade: gradeValue, type, notes: notes || null },
    include: { ...gradeInclude, student: { select: { firstName: true, lastName: true, email: true } } },
  });

  const { notifyNewGrade } = await import('./notification.service');
  const surahName = grade.surah?.nameAr ?? (grade.surahId ? `Surah #${grade.surahId}` : 'Overall Recital');
  await notifyNewGrade(studentId, { ...grade, surahName });

  // Phase 5: a graded session counts as daily activity for the student,
  // same as recording/revision/memorization/ijazah/curriculum-plan actions.
  // Best-effort — a streak-update failure must not break grade submission.
  try {
    await recordActivity(studentId);
    await evaluateMilestones(studentId);
  } catch {
    /* gamification is best-effort */
  }

  return grade;
};
```

- [ ] **Step 2: Write the failing test**

In `packages/server/src/services/__tests__/grade.service.test.ts`, find the `describe('createGrade', ...)` block. Before writing the new tests, read the file's existing passing tests in full — in particular, note the EXACT name of the mocked Prisma client variable (commonly `prismaMock` in this codebase's convention, per `CLAUDE.md`'s `jest-mock-extended` note, but confirm by reading this specific file's imports/setup) and the exact mock-chaining pattern already used for the sequential `user.findUnique` calls (the happy-path "creates a grade with a surah" test already mocks this three-call sequence — copy its exact structure, don't guess). Add two new tests immediately after that existing happy-path test, following its established mocking style:

```ts
    it('records daily activity and evaluates milestones after a successful grade creation', async () => {
      // Mirror the exact mock setup used by the "creates a grade with a surah" test above
      // (same three user.findUnique calls, same grade.create shape) - just add a streak.upsert
      // expectation on top.
      // ... (copy that test's full arrange block verbatim, then:)
      await createGrade('teacher-1', 'student-1', 1, '95', 'EXAM', 'Good work');
      expect(prismaMock.streak.upsert).toHaveBeenCalled();
    });

    it('does not let a gamification failure break grade creation', async () => {
      // Same arrange block as above, but:
      prismaMock.streak.upsert.mockRejectedValue(new Error('DB down'));
      const result = await createGrade('teacher-1', 'student-1', 1, '95', 'EXAM', 'Good work');
      expect(result.id).toBe('grade-1');
    });
```

Write out both tests' full bodies (not the abbreviated placeholders above) by literally copying the existing "creates a grade with a surah" test's arrange block into each, then adding the one new assertion (or one new mock override) each needs — this guarantees the mock setup exactly matches this file's real, already-passing conventions instead of a guessed shape.

- [ ] **Step 3: Run the tests to verify they pass**

```bash
cd packages/server && npm test -- --testPathPattern=grade.service
```
Expected: all tests in the file pass, including the two new ones.

- [ ] **Step 4: Update the E2E journey**

`mobile/e2e/flows/journeys/10-streak-after-grade.yaml`'s header comment currently explains, at length, why the flow asserts only `student-gamification.streak` *rendering* and never its *value changing*, because grade submission didn't call `recordActivity`. That's no longer accurate. Update the header comment to reflect the new, correct behavior:

Replace the comment block (currently explaining `recordActivity`'s 6 callers and that `grade.service.ts` isn't one of them) with:
```yaml
# Journey 10: student views their streak -> teacher submits a fresh grade for
# them -> student re-logs-in and the streak screen reflects the new activity.
#
# grade.service.ts's createGrade now calls recordActivity() (Plan 1 findings
# fix-pass) - grading is wired into the streak the same way recording/
# revision/mushaf/ijazah/memorization/curriculum-plan actions already are.
# Ali has no seeded Streak row in either seed script, so before this flow's
# grade submission, getMyGamification zero-fills { currentStreak: 0,
# longestStreak: 0 }. After the grade submission, a Streak row now exists
# with currentStreak/longestStreak >= 1.
```

Then find the flow's final assertion (currently just checking `student-gamification.streak` is visible) and strengthen it to assert actual content — add an assertion on whatever testID exposes the numeric streak value on `student/gamification.tsx` (check the screen's source for the exact testID; it may need adding if none currently exposes the raw number distinctly from the container). If no such testID exists, add one (`student-gamification.streak-value` on the `AppText`/`MetricTile` that renders the number, following this suite's `<screen>.<element>` convention) as part of this step. `gamification.tsx` is already in `covered-screens.json` from Plan 1, so no registration change is needed there — just re-run `node mobile/scripts/check-testids.js` after adding the testID to confirm it's still green.

- [ ] **Step 5: Live-verify**

```bash
maestro test mobile/e2e/flows/journeys/10-streak-after-grade.yaml
```
Expected: passes, now with a genuine "streak value changed" proof rather than a "streak still renders" proof.

- [ ] **Step 6: Update `COVERAGE.md` and `BUGLOG.md`**

In `mobile/e2e/COVERAGE.md`'s `### Journey 10` section, update the "What is deliberately NOT asserted, and why" bullet to reflect that the value change IS now asserted, since the underlying gap is fixed.

In `mobile/e2e/BUGLOG.md`, find the entry `## Task 10 (CORRECTED post-review — see below): grade submission specifically does not count toward the student streak`. Change the heading to:
```
## Task 10: grade submission now counts toward the student streak (RESOLVED — Plan 1 findings fix-pass)
```
Replace the `- **Classification**:` line with:
```
- **Classification:** minor product inconsistency — FIXED. `grade.service.ts`'s `createGrade` now calls `recordActivity`/`evaluateMilestones` in a best-effort try/catch, matching every sibling service. Product decision: a teacher grading a student is a legitimate signal the student was active that day.
```

- [ ] **Step 7: Run full server test suite as a regression check**

```bash
cd packages/server && npm test
```
Expected: all suites pass (no regression from this change elsewhere).

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/services/grade.service.ts packages/server/src/services/__tests__/grade.service.test.ts mobile/e2e/flows/journeys/10-streak-after-grade.yaml mobile/e2e/COVERAGE.md mobile/e2e/BUGLOG.md
git commit -m "fix(server): grade submission now counts toward the student streak (BUGLOG finding)"
```
