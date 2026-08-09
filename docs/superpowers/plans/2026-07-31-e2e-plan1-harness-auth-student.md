# E2E Plan 1: Maestro Harness + Auth + Student Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Maestro E2E harness (runner, dedicated DB reset, E2E seed, testID conventions) and deliver smoke + journey coverage for the auth and student screen groups.

**Architecture:** Maestro YAML flows in `mobile/e2e/flows/` drive an Expo dev-client build on the iOS simulator against the local server pointed at a dedicated E2E database (port 5433). Flows select elements **only by testID** (`<screen>.<element>` convention). A Node script (`check-testids.js`) mechanically enforces that every interactive element in covered screens has a testID; `COVERAGE.md` maps every control to the flow step that exercises it.

**Tech Stack:** Maestro (Homebrew) · Expo SDK 54 dev-client · Prisma 6 / PostgreSQL 17 (docker-compose.test.yml) · ts-node seed scripts · Node check script.

**Spec:** `docs/superpowers/specs/2026-07-31-full-app-e2e-testing-design.md`

## Global Constraints

- Flows select **only by testID**, never by visible text (spec §3). Exception: none in this plan.
- testID convention: `<screen>.<element>`, kebab-case, `.N` index suffix for list rows (e.g. `login.submit`, `student-home.quick-action.0`).
- No blind `sleep`/fixed delays in flows — use `extendedWaitUntil` on testIDs (spec §6).
- The E2E runner must **never** touch the dev database. E2E `DATABASE_URL` is always `postgresql://postgres:postgres@localhost:5433/quran_review_test`.
- A failing flow is a finding: classify app bug vs test bug **before** touching any assertion. Log app bugs in `mobile/e2e/BUGLOG.md` (create it on first finding, one `##` section per bug: symptom, screen, expected, actual, classification).
- Do not change server business logic. The only app-code changes allowed are: adding `testID` props, the `allowedRoles` parent fix in Task 3, and testID pass-through props on shared components.
- Existing i18n rule still applies to any new user-facing string (none are expected in this plan).
- Run all commands from repo root unless a `cd` is shown.
- Known app findings already identified (verify, then log in BUGLOG.md — do not silently fix beyond what your task says): (1) `mobile/app/(auth)/index.tsx:38` blocks the `parent` role at login; (2) `mobile/app/(auth)/first-login.tsx` is orphaned — no code navigates to it.

## Prerequisites (implementer must verify before Task 1)

```bash
maestro --version || brew install --cask maestro   # if brew tap needed: brew tap mobile-dev-inc/tap && brew install maestro
xcrun simctl list devices booted                    # at least one booted iOS simulator
```

The app under test is built once with `cd mobile && npx expo run:ios` (dev client). The server runs with `cd packages/server && DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npm run dev`.

---

### Task 1: E2E seed — refactor seed.ts export + seed-e2e.ts

**Files:**
- Modify: `packages/server/src/prisma/seed.ts` (bottom of file, lines ~199 `async function main()` and the trailing `main()` call)
- Create: `packages/server/src/prisma/seed-e2e.ts`
- Test: manual run against the E2E DB (commands below) — this is a script, not a unit-testable module; proof is the printed user table.

**Interfaces:**
- Consumes: existing `main()` seed logic, Prisma models `User`, `ParentLink`, `Grade`, `Message`, `Notification` (fields verified against `packages/server/prisma/schema.prisma`).
- Produces: `export async function runSeed(): Promise<void>` in `seed.ts`; `seed-e2e.ts` runnable via `npx ts-node src/prisma/seed-e2e.ts`; E2E users `parent@quran-review.com`, `parent2@quran-review.com`, `parent3@quran-review.com` (all PARENT/ACTIVE, password default `Parent1234!`, env override `SEED_PARENT_PASSWORD`). Tasks 2+ rely on these emails/passwords verbatim.

- [ ] **Step 1: Refactor seed.ts to export its main function**

In `packages/server/src/prisma/seed.ts`, rename `async function main()` to `export async function runSeed()` and replace the trailing invocation block:

```ts
// was: main().catch(...).finally(...)
if (require.main === module) {
  runSeed()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
}
```

`seed-e2e.ts` creates its own PrismaClient — do not export the seed's client.

- [ ] **Step 2: Verify the plain seed still works exactly as before**

```bash
cd packages/server && docker compose -f docker-compose.test.yml up -d --wait
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npx prisma migrate reset --force --skip-seed
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npx ts-node src/prisma/seed.ts
```

Expected: the familiar `🌱 Seed completed. Users available:` table with 6 users, no errors.

- [ ] **Step 3: Write seed-e2e.ts**

Create `packages/server/src/prisma/seed-e2e.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { runSeed } from './seed';

const prisma = new PrismaClient();
const PARENT_PASSWORD = process.env.SEED_PARENT_PASSWORD || 'Parent1234!';

async function mainE2E() {
  await runSeed();

  const parentPass = await bcrypt.hash(PARENT_PASSWORD, 10);
  const ali = await prisma.user.findUniqueOrThrow({ where: { email: 'ali@quran-review.com' } });
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: 'teacher@quran-review.com' } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@quran-review.com' } });

  const mkParent = (email: string, firstName: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: parentPass,
        role: 'PARENT',
        firstName,
        lastName: 'Guardian',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

  const parent1 = await mkParent('parent@quran-review.com', 'Yusuf');   // APPROVED link
  const parent2 = await mkParent('parent2@quran-review.com', 'Layla');  // PENDING link
  const parent3 = await mkParent('parent3@quran-review.com', 'Zaid');   // REVOKED link

  await prisma.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent1.id, studentId: ali.id } },
    update: { status: 'APPROVED', decidedAt: new Date(), decidedBy: admin.id },
    create: { parentId: parent1.id, studentId: ali.id, status: 'APPROVED', decidedAt: new Date(), decidedBy: admin.id },
  });
  await prisma.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent2.id, studentId: ali.id } },
    update: { status: 'PENDING' },
    create: { parentId: parent2.id, studentId: ali.id, status: 'PENDING', reason: "I am Ali's mother" },
  });
  await prisma.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent3.id, studentId: ali.id } },
    update: { status: 'REVOKED', decidedAt: new Date(), decidedBy: admin.id },
    create: { parentId: parent3.id, studentId: ali.id, status: 'REVOKED', decidedAt: new Date(), decidedBy: admin.id },
  });

  // Content for Ali so student/parent/teacher detail screens render data.
  const fatiha = await prisma.surah.findFirst({ where: { number: 1 } });
  await prisma.grade.createMany({
    data: [
      { studentId: ali.id, teacherId: teacher.id, surahId: fatiha?.id ?? null, grade: 'A', type: 'MEMORIZATION', notes: 'Excellent tajweed' },
      { studentId: ali.id, teacherId: teacher.id, surahId: fatiha?.id ?? null, grade: 'B+', type: 'REVISION', notes: 'Minor hesitation' },
    ],
    skipDuplicates: true,
  });
  await prisma.message.createMany({
    data: [
      { senderId: teacher.id, receiverId: ali.id, content: 'أحسنت في حفظ سورة الفاتحة' },
      { senderId: ali.id, receiverId: teacher.id, content: 'جزاك الله خيراً يا أستاذ' },
    ],
    skipDuplicates: true,
  });
  await prisma.notification.createMany({
    data: [
      { userId: ali.id, type: 'GRADE', title: 'درجة جديدة', body: 'حصلت على درجة جديدة في سورة الفاتحة' },
      { userId: ali.id, type: 'GENERAL', title: 'تذكير', body: 'موعد المراجعة غداً' },
    ],
    skipDuplicates: true,
  });

  console.log('\n🧪 E2E seed complete. Extra users:');
  console.log(`  parent@quran-review.com  | PARENT | APPROVED link → Ali | ${PARENT_PASSWORD}`);
  console.log(`  parent2@quran-review.com | PARENT | PENDING link → Ali`);
  console.log(`  parent3@quran-review.com | PARENT | REVOKED link → Ali`);
}

mainE2E()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
```

Before running: verify the `GradeType` enum values with `grep -n "enum GradeType" -A 5 packages/server/prisma/schema.prisma` and adjust `MEMORIZATION`/`REVISION` if the actual values differ (use the first two real values). Same for the `Notification.type` strings — check how the app creates them (`grep -rn "type:" packages/server/src/services/notification*.ts | head`) and match existing type strings. Also confirm `role: 'PARENT'` exists in the `UserRole` enum (`grep -n "enum UserRole" -A 6 packages/server/prisma/schema.prisma`).

- [ ] **Step 4: Run seed-e2e against the E2E DB, twice**

```bash
cd packages/server
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npx prisma migrate reset --force --skip-seed
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npx ts-node src/prisma/seed-e2e.ts
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npx ts-node src/prisma/seed-e2e.ts
```

Expected: base seed table, then the `🧪 E2E seed complete` block; the second run must also succeed (idempotent via upserts/skipDuplicates).

- [ ] **Step 5: Verify with a direct query**

```bash
docker compose -f docker-compose.test.yml exec -T db-test psql -U postgres -d quran_review_test -c "SELECT status, count(*) FROM parent_links GROUP BY status;"
```

Expected: one row each for APPROVED, PENDING, REVOKED.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/prisma/seed.ts packages/server/src/prisma/seed-e2e.ts
git commit -m "feat(e2e): E2E seed with parent users and linked sample data"
```

---

### Task 2: Harness — run.sh, check-testids.js, e2e README

**Files:**
- Create: `mobile/e2e/run.sh` (chmod +x)
- Create: `mobile/scripts/check-testids.js`
- Create: `mobile/e2e/README.md`
- Create: `mobile/e2e/covered-screens.json`
- Create: `mobile/e2e/flows/.gitkeep`
- Modify: `mobile/package.json` (add two scripts)
- Test: run `run.sh` with server up/down; run `check-testids.js` against a screen with and without testIDs.

**Interfaces:**
- Consumes: Task 1's `seed-e2e.ts`; `packages/server/docker-compose.test.yml`; server health at `GET /api/health`.
- Produces: `bash mobile/e2e/run.sh [flow-path]` (resets DB, seeds, verifies server is on the E2E DB, runs `maestro test`); `node mobile/scripts/check-testids.js` (exit 1 if any interactive element in a covered screen lacks testID); `mobile/e2e/covered-screens.json` — a JSON array of screen paths (relative to `mobile/`) that later tasks append to.

- [ ] **Step 1: Write run.sh**

```bash
#!/usr/bin/env bash
# E2E runner: reset E2E DB → seed → verify server is on the E2E DB → maestro test.
set -euo pipefail

E2E_DB_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/../../packages/server"
# the optional argument is relative to mobile/e2e/ (e.g. "flows/auth"); default: all flows
FLOWS="$SCRIPT_DIR/${1:-flows}"

echo "==> [1/4] E2E database up + reset"
(cd "$SERVER_DIR" && docker compose -f docker-compose.test.yml up -d --wait)
# terminate lingering connections so migrate reset cannot fail on an open pool
(cd "$SERVER_DIR" && docker compose -f docker-compose.test.yml exec -T db-test \
  psql -U postgres -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='quran_review_test' AND pid <> pg_backend_pid();" >/dev/null)
(cd "$SERVER_DIR" && DATABASE_URL="$E2E_DB_URL" npx prisma migrate reset --force --skip-seed)

echo "==> [2/4] E2E seed"
(cd "$SERVER_DIR" && DATABASE_URL="$E2E_DB_URL" npx ts-node src/prisma/seed-e2e.ts)

echo "==> [3/4] Server checks"
if ! curl -fsS http://localhost:4000/api/health >/dev/null 2>&1; then
  echo "ERROR: server not running on :4000."
  echo "Start it with:  cd packages/server && DATABASE_URL=\"$E2E_DB_URL\" npm run dev"
  exit 1
fi
# parent@ exists ONLY in the E2E seed → proves the server is on the E2E DB, not dev.
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"parent@quran-review.com","password":"'"${SEED_PARENT_PASSWORD:-Parent1234!}"'"}')
if [ "$LOGIN_STATUS" != "200" ]; then
  echo "ERROR: server on :4000 is NOT connected to the E2E database (parent login returned $LOGIN_STATUS)."
  echo "Restart it with:  cd packages/server && DATABASE_URL=\"$E2E_DB_URL\" npm run dev"
  exit 1
fi

echo "==> [4/4] check-testids + maestro test $FLOWS"
node "$SCRIPT_DIR/../scripts/check-testids.js"
maestro test "$FLOWS"
```

`chmod +x mobile/e2e/run.sh`. If the login route differs, find it with `grep -rn "auth" packages/server/src/app.ts | head -3`, verify by curling manually, then fix the URL in run.sh.

- [ ] **Step 2: Write check-testids.js**

`mobile/scripts/check-testids.js` — scans screens listed in `mobile/e2e/covered-screens.json`; every `<TouchableOpacity`, `<Pressable`, `<TextInput`, `<Switch`, and `<IconButton` opening tag must carry an explicit `testID` attribute:

```js
#!/usr/bin/env node
// Fails (exit 1) if any interactive element in a covered screen lacks an explicit testID prop.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const covered = JSON.parse(fs.readFileSync(path.join(root, 'e2e', 'covered-screens.json'), 'utf8'));
const INTERACTIVE = /<(TouchableOpacity|Pressable|TextInput|Switch|IconButton)\b/g;

let failures = 0;
for (const rel of covered) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = INTERACTIVE.exec(src)) !== null) {
    // capture the full opening tag (scan to the matching '>' outside JSX-expression braces)
    let depth = 0, i = m.index, end = -1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      else if (src[i] === '>' && depth === 0) { end = i; break; }
    }
    const tag = src.slice(m.index, end + 1);
    if (!/\btestID\s*=/.test(tag)) {
      const line = src.slice(0, m.index).split('\n').length;
      console.error(`MISSING testID: ${rel}:${line} <${m[1]}>`);
      failures++;
    }
  }
}
if (failures) {
  console.error(`\n${failures} interactive element(s) missing testID.`);
  process.exit(1);
}
console.log(`check-testids: OK (${covered.length} screens covered)`);
```

- [ ] **Step 3: Create covered-screens.json (empty) and npm scripts**

`mobile/e2e/covered-screens.json`:

```json
[]
```

In `mobile/package.json` `"scripts"`, add:

```json
"e2e": "bash e2e/run.sh",
"check:testids": "node scripts/check-testids.js"
```

- [ ] **Step 4: Verify the checker red/green**

```bash
cd mobile && node scripts/check-testids.js        # OK (0 screens covered)
echo '["app/(auth)/index.tsx"]' > e2e/covered-screens.json
node scripts/check-testids.js; echo "exit=$?"     # expect MISSING testID lines, exit=1 (login has zero testIDs yet)
echo '[]' > e2e/covered-screens.json              # restore
```

- [ ] **Step 5: Verify run.sh guardrails**

With the server **stopped**: `bash mobile/e2e/run.sh` → expect the "server not running" error after seeding. With the server running against the **dev** DB: expect the "NOT connected to the E2E database" error. With the server started via `cd packages/server && DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test" npm run dev`: expect it to reach `maestro test` (an empty flows dir error is acceptable at this point).

- [ ] **Step 6: Write mobile/e2e/README.md**

Content: prerequisites (Maestro install command, booted simulator, dev-client build via `npx expo run:ios`, server start command with the E2E DATABASE_URL), how to run all flows (`npm run e2e`) or one group (`npm run e2e -- flows/auth`), the testID convention, the covered-screens.json contract, the BUGLOG.md policy, and the no-sleep rule. Keep it under 60 lines.

- [ ] **Step 7: Commit**

```bash
git add mobile/e2e mobile/scripts/check-testids.js mobile/package.json
git commit -m "feat(e2e): Maestro runner, testID checker, e2e docs"
```

---

### Task 3: Shared-component testID pass-through + auth screen testIDs + parent login fix

**Files:**
- Modify: `mobile/src/components/design.tsx` (`IconButton` — add optional `testID?: string` prop, forward to its root touchable)
- Modify: `mobile/src/components/BottomNav.tsx` (each tab gets `testID={'bottom-nav.' + <route-derived-slug>}`, e.g. `/student/appointments` → `bottom-nav.student-appointments`, `/halaqa` → `bottom-nav.halaqa`)
- Modify: `mobile/app/(auth)/index.tsx`, `register.tsx`, `forgot-password.tsx`, `first-login.tsx`, `pending-approval.tsx`
- Create: `mobile/e2e/BUGLOG.md`
- Modify: `mobile/e2e/covered-screens.json` (add the 5 auth screens)
- Test: `node mobile/scripts/check-testids.js` green; `cd mobile && npx tsc --noEmit` green.

**Interfaces:**
- Consumes: Task 2's checker + covered-screens.json.
- Produces: exact auth testIDs used by Task 4's flows: `login.screen`, `login.email`, `login.password`, `login.submit`, `login.error`, `login.forgot-link`, `login.register-link`; `register.screen`, `register.first-name`, `register.last-name`, `register.email`, `register.password`, `register.submit`, `register.back-link` (same naming pattern for any additional inputs found in the file, e.g. `register.confirm-password`); `forgot-password.screen`, `forgot-password.email`, `forgot-password.submit`, `forgot-password.back-link`; `first-login.screen`, `first-login.current-password`, `first-login.new-password`, `first-login.confirm-password`, `first-login.submit`; `pending-approval.screen`, `pending-approval.header`, `pending-approval.logout`. `BottomNav` tab testIDs as above.

- [ ] **Step 1: Fix the parent login bug (BUGLOG first)**

Create `mobile/e2e/BUGLOG.md` with a section for the parent-role block, then in `mobile/app/(auth)/index.tsx:38` change:

```ts
const allowedRoles = ['admin', 'teacher', 'student', 'parent'];
```

Also log the orphaned `first-login.tsx` finding in BUGLOG.md (classification: app bug — unreachable screen; not fixed in this plan; flagged for product decision in Plan 3).

- [ ] **Step 2: Add testIDs to all 5 auth screens + shared components**

Exact anchors in `index.tsx`: email `TextInput` (line ~87) → `testID="login.email"`; password `TextInput` (~105) → `login.password`; submit `TouchableOpacity` (~119) → `login.submit`; error box `Animated.View` (~78) → `login.error`; forgot link (~130) → `login.forgot-link`; register link (~141) → `login.register-link`; root `SafeAreaView` (~50) → `login.screen`. Apply the same pattern to the other 4 screens: root container gets `<screen>.screen`, every interactive element gets a `<screen>.<purpose>` testID per the Produces list. `IconButton` in `design.tsx` gets `testID` added to its props type and forwarded.

- [ ] **Step 3: Add the auth screens to covered-screens.json**

```json
[
  "app/(auth)/index.tsx",
  "app/(auth)/register.tsx",
  "app/(auth)/forgot-password.tsx",
  "app/(auth)/first-login.tsx",
  "app/(auth)/pending-approval.tsx"
]
```

- [ ] **Step 4: Verify**

```bash
cd mobile && node scripts/check-testids.js   # expect: OK (5 screens covered)
npx tsc --noEmit                             # expect: no errors
```

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(auth)" mobile/src/components mobile/e2e
git commit -m "feat(e2e): auth testIDs, BottomNav/IconButton testID support, allow parent login"
```

---

### Task 4: Auth smoke flows + login helper + COVERAGE.md

**Files:**
- Create: `mobile/e2e/flows/_helpers/login.yaml`
- Create: `mobile/e2e/flows/auth/01-login-smoke.yaml`, `02-register-smoke.yaml`, `03-forgot-password-smoke.yaml`, `04-pending-approval-smoke.yaml`, `05-first-login-smoke.yaml`
- Create: `mobile/e2e/COVERAGE.md`
- Test: `bash mobile/e2e/run.sh flows/auth` — all 5 flows PASS.

**Interfaces:**
- Consumes: Task 3's testIDs; Task 1's seeded users (`ali@`/`Student1234!`, `fatima@` PENDING).
- Produces: `_helpers/login.yaml` taking env `EMAIL`, `PASSWORD` — every later flow starts with `launchApp clearState` + this helper. COVERAGE.md table format: `| screen | control (testID) | flow file | step |`.

- [ ] **Step 1: Write the login helper**

`mobile/e2e/flows/_helpers/login.yaml`:

```yaml
appId: com.quranreview.app
---
- extendedWaitUntil:
    visible:
      id: "login.email"
    timeout: 20000
- tapOn:
    id: "login.email"
- inputText: ${EMAIL}
- tapOn:
    id: "login.password"
- inputText: ${PASSWORD}
- tapOn:
    id: "login.submit"
```

- [ ] **Step 2: Write 01-login-smoke.yaml (fully)**

```yaml
appId: com.quranreview.app
tags: [auth, smoke]
---
- launchApp:
    clearState: true
# wrong password → error box
- runFlow:
    file: ../_helpers/login.yaml
    env:
      EMAIL: ali@quran-review.com
      PASSWORD: WrongPass1!
- extendedWaitUntil:
    visible:
      id: "login.error"
    timeout: 10000
# links work
- tapOn:
    id: "login.forgot-link"
- extendedWaitUntil:
    visible:
      id: "forgot-password.screen"
    timeout: 10000
- tapOn:
    id: "forgot-password.back-link"
- tapOn:
    id: "login.register-link"
- extendedWaitUntil:
    visible:
      id: "register.screen"
    timeout: 10000
- tapOn:
    id: "register.back-link"
# correct login lands on student home
- runFlow:
    file: ../_helpers/login.yaml
    env:
      EMAIL: ali@quran-review.com
      PASSWORD: Student1234!
- extendedWaitUntil:
    visible:
      id: "student-home.screen"
    timeout: 20000
```

Note: `student-home.screen` is added in Task 5. Until Task 5 lands, assert on `bottom-nav.student-home` instead; the final committed state after Task 5 must assert `student-home.screen` (Task 5 Step 4 flips it).

- [ ] **Step 3: Write the remaining 4 auth flows**

Same structure, per screen: `02-register-smoke` — open register from login, submit empty first (assert the inline validation error testID), fill every input (unique email `e2e-reg-smoke@quran-review.com`), submit, assert the post-register destination (discover it with `grep -n "router\." "mobile/app/(auth)/register.tsx"`). `03-forgot-password-smoke` — open, submit empty (assert error state), fill email, submit, assert the confirmation testID. `04-pending-approval-smoke` — login as `fatima@quran-review.com`/`Student1234!` (PENDING), assert `pending-approval.screen`, tap `pending-approval.logout`, assert back on `login.screen`. `05-first-login-smoke` — login as ali, then `- openLink: quran-review://first-login`, assert `first-login.screen`; fill mismatching new/confirm passwords, submit, assert the error testID; do NOT actually change a password (would break later flows). Every control tapped gets a COVERAGE.md row.

- [ ] **Step 4: Run red → green**

```bash
bash mobile/e2e/run.sh flows/auth
```

First run may fail — classify every failure (app bug → BUGLOG.md; test bug → fix flow). Iterate to all 5 PASS.

- [ ] **Step 5: Write COVERAGE.md**

Header + one table per screen; a row for **every** control testID on the 5 auth screens mapping to flow file + step. Cross-check against the testIDs added in Task 3 — no control may be missing.

- [ ] **Step 6: Commit**

```bash
git add mobile/e2e
git commit -m "feat(e2e): auth smoke flows, login helper, coverage ledger"
```

---

### Task 5: Student smoke A — home, appointments, grades

**Files:**
- Modify: `mobile/app/student/home.tsx`, `mobile/app/student/appointments.tsx`, `mobile/app/student/grades.tsx` (testIDs on root + every control)
- Modify (root testID only): `mobile/app/notifications.tsx`, `mobile/app/messages/index.tsx`, `mobile/app/account.tsx`, `mobile/app/halaqa/index.tsx`
- Modify: `mobile/e2e/covered-screens.json` (append the 3 student screens only)
- Create: `mobile/e2e/flows/student/01-home-smoke.yaml`, `02-appointments-smoke.yaml`, `03-grades-smoke.yaml`
- Modify: `mobile/e2e/flows/auth/01-login-smoke.yaml` (flip final assert to `student-home.screen`)
- Modify: `mobile/e2e/COVERAGE.md`
- Test: `node mobile/scripts/check-testids.js` green; `bash mobile/e2e/run.sh flows/student` and `.../auth` PASS.

**Interfaces:**
- Consumes: `_helpers/login.yaml`, ali@ login, `bottom-nav.*` tab testIDs from Task 3.
- Produces: `student-home.screen`, `student-appointments.screen`, `student-grades.screen` root testIDs; destination root testIDs `notifications.screen`, `messages.screen`, `account.screen`, `halaqa.screen` (root only — full pass in Plan 3); `student-appointments.book` (used by Journey 2 in Task 9); `student-home.mushaf-cta` (used by Task 7).

- [ ] **Step 1: Add testIDs to the 3 screens (the standard procedure)**

Procedure per screen — this exact procedure also applies in Tasks 6–7: (1) open the file; (2) root SafeAreaView/container → `<screen>.screen`; (3) every `TouchableOpacity`/`Pressable`/`TextInput`/`Switch`/`IconButton` → `<screen>.<purpose>` where `<purpose>` names what the control does, derived from its onPress target or label key (e.g. `router.push('/notifications')` → `student-home.notifications`); (4) list-item controls in `.map()`/FlatList get `` testID={`<screen>.<row-name>.${index}`} ``; (5) add the file to `covered-screens.json`; (6) `node scripts/check-testids.js` must pass. Known anchors in `home.tsx`: notifications (~line 227), messages (~234), account (~247), mushaf resume (~325), quick actions map (~370) → `student-home.quick-action.${index}`, teacher/messages card (~403, ~432), grades section action (~441), mushaf CTA (~502) → `student-home.mushaf-cta`. Also add the four destination-screen root testIDs (root container only).

- [ ] **Step 2: Write the flow for home (fully)**

`mobile/e2e/flows/student/01-home-smoke.yaml`:

```yaml
appId: com.quranreview.app
tags: [student, smoke]
---
- launchApp:
    clearState: true
- runFlow:
    file: ../_helpers/login.yaml
    env:
      EMAIL: ali@quran-review.com
      PASSWORD: Student1234!
- extendedWaitUntil:
    visible:
      id: "student-home.screen"
    timeout: 20000
# every nav control: tap → assert destination root testID → back to home
- tapOn:
    id: "student-home.notifications"
- extendedWaitUntil: { visible: { id: "notifications.screen" }, timeout: 10000 }
- back
- tapOn:
    id: "student-home.messages"
- extendedWaitUntil: { visible: { id: "messages.screen" }, timeout: 10000 }
- back
- tapOn:
    id: "student-home.account"
- extendedWaitUntil: { visible: { id: "account.screen" }, timeout: 10000 }
- back
- tapOn:
    id: "student-home.mushaf-cta"
- assertNotVisible:
    id: "student-home.screen"
- back
- tapOn: { id: "bottom-nav.student-appointments" }
- extendedWaitUntil: { visible: { id: "student-appointments.screen" }, timeout: 10000 }
- tapOn: { id: "bottom-nav.student-home" }
- extendedWaitUntil: { visible: { id: "student-home.screen" }, timeout: 10000 }
```

Extend with the remaining home controls (quick actions `student-home.quick-action.N`, teacher card, grades action, mushaf resume) with the same tap→assert→back pattern; where the destination has no `.screen` id yet, use the `assertNotVisible` + `back` pattern shown for the mushaf CTA. If `- back` does not navigate on iOS (no hardware back), tap the destination screen's back control instead — add a `<screen>.back` testID to it while in Step 1.

- [ ] **Step 3: Write appointments + grades flows**

`02-appointments-smoke.yaml`: login → tab to appointments → assert the list renders (row `student-appointments.row.0` visible, from the seeded ACCEPTED appointment) → open the booking UI via `student-appointments.book` → assert the form/sheet testID → cancel/back without submitting (booking itself is Journey 2). `03-grades-smoke.yaml`: login → grades tab → assert seeded grade row `student-grades.row.0` visible → exercise every filter/segment control present → back. Every control = a COVERAGE.md row.

- [ ] **Step 4: Run red → green, flip Task 4's login assert**

```bash
node mobile/scripts/check-testids.js && bash mobile/e2e/run.sh flows/student
bash mobile/e2e/run.sh flows/auth   # 01-login-smoke now asserts student-home.screen
```

Expected: all student + auth flows PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/student mobile/app/notifications.tsx mobile/app/messages mobile/app/account.tsx mobile/app/halaqa mobile/e2e
git commit -m "feat(e2e): student home/appointments/grades smoke flows + testIDs"
```

---

### Task 6: Student smoke B — recordings, reports, revisions, teacher-change

**Files:**
- Modify: `mobile/app/student/recordings.tsx`, `reports.tsx`, `revisions.tsx`, `teacher-change.tsx` (testIDs per the Task 5 Step 1 procedure)
- Modify: `mobile/e2e/covered-screens.json` (+4)
- Create: `mobile/e2e/flows/student/04-recordings-smoke.yaml`, `05-reports-smoke.yaml`, `06-revisions-smoke.yaml`, `07-teacher-change-smoke.yaml`
- Modify: `mobile/e2e/COVERAGE.md`
- Test: `node mobile/scripts/check-testids.js` && `bash mobile/e2e/run.sh flows/student` — all PASS.

**Interfaces:**
- Consumes: login helper; ali@ seeded data (grades + revision schedules exist; recordings/reports may be empty → assert empty-state testIDs).
- Produces: root testIDs `student-recordings.screen`, `student-reports.screen`, `student-revisions.screen`, `student-teacher-change.screen`.

- [ ] **Step 1: testIDs for the 4 screens** — exact Task 5 Step 1 procedure. Navigation to each screen: check `mobile/app/student/home.tsx` quick actions and `BottomNav` for the route; if a screen is only reachable via a quick action, the flow taps that quick-action index.
- [ ] **Step 2: Write the 4 flows** — same skeleton as `01-home-smoke.yaml` (launch/clearState/login → navigate → assert `.screen` → tap every control with tap→assert→back). Assert the empty-state testID where the seed provides no data. Recordings: do NOT start a real recording — tap the record control, assert the recorder UI testID appears, dismiss. Teacher-change: fill the request form but **cancel without submitting** (submission mutates state exercised by Journey 7 in Plan 2 — note this exclusion in COVERAGE.md with the justification).
- [ ] **Step 3: Red → green** — `bash mobile/e2e/run.sh flows/student`; classify failures; iterate to PASS.
- [ ] **Step 4: COVERAGE.md rows for every control; commit**

```bash
git add mobile/app/student mobile/e2e
git commit -m "feat(e2e): student recordings/reports/revisions/teacher-change smoke flows"
```

---

### Task 7: Student smoke C — plans, mushaf, gamification, certificates, ijazahs

**Files:**
- Modify: `mobile/app/student/plans.tsx`, `mushaf.tsx`, `gamification.tsx`, `certificates.tsx`, `ijazahs.tsx` (testIDs per Task 5 Step 1 procedure)
- Modify: `mobile/e2e/covered-screens.json` (+5)
- Create: `mobile/e2e/flows/student/08-plans-smoke.yaml`, `09-mushaf-smoke.yaml`, `10-gamification-smoke.yaml`, `11-certificates-smoke.yaml`, `12-ijazahs-smoke.yaml`
- Modify: `mobile/e2e/COVERAGE.md`
- Test: `node mobile/scripts/check-testids.js` && `bash mobile/e2e/run.sh flows/student` — all 12 student flows PASS.

**Interfaces:**
- Consumes: login helper; seeded revision schedules (3 rows for ali); `student-home.mushaf-cta` from Task 5.
- Produces: `student-mushaf.screen`, `student-mushaf.page-next`, `student-mushaf.page-prev`, `student-mushaf.mark-memorized` (adjust to the real control names found in the file, keeping these three purposes — used by Journey 11 in Task 10); `student-gamification.screen` + `student-gamification.streak` (used by Journey 10).

- [ ] **Step 1: testIDs for the 5 screens** — Task 5 Step 1 procedure. Mushaf is gesture-heavy: page-turn controls that are Touchables get testIDs; pure swipe gestures are exercised in the flow with Maestro `swipe` (direction LEFT/RIGHT) and noted in COVERAGE.md as gesture-covered.
- [ ] **Step 2: Write the 5 flows** — same skeleton. Mushaf: open via `student-home.mushaf-cta`, assert `.screen`, page forward and back (control or swipe), open the surah/page picker if present, assert it. Gamification: assert `student-gamification.streak` visible. Certificates/ijazahs: likely empty-state — assert the empty-state testID and any request/info controls.
- [ ] **Step 3: Red → green** — `bash mobile/e2e/run.sh flows/student` → all 12 PASS.
- [ ] **Step 4: COVERAGE.md complete for all 12 student screens; commit**

```bash
git add mobile/app/student mobile/e2e
git commit -m "feat(e2e): student plans/mushaf/gamification/certificates/ijazahs smoke flows"
```

---

### Task 8: Journey 1 — registration → admin approval → login

**Files:**
- Modify: `mobile/app/admin/home.tsx`, `mobile/app/admin/user-detail.tsx` (minimal testIDs: ONLY the controls this journey needs — the full admin pass is Plan 2; do NOT add these files to covered-screens.json)
- Create: `mobile/e2e/flows/journeys/01-registration-approval.yaml`
- Modify: `mobile/e2e/COVERAGE.md` (journey section)
- Test: `bash mobile/e2e/run.sh flows/journeys` PASS, and deterministic after reset (Step 2).

**Interfaces:**
- Consumes: register screen testIDs (Task 3), login helper, admin@/Admin1234!.
- Produces: `admin-home.screen`, `admin-home.users`, `admin-users.search`, `admin-users.row.0`, `admin-user-detail.approve` (find the real anchors: `grep -n "user-detail\|APPROVE\|ACTIVE\|status" mobile/app/admin/home.tsx mobile/app/admin/user-detail.tsx`; keep these exact names — Plan 2 reuses them verbatim).

- [ ] **Step 1: Write the journey flow**

```yaml
appId: com.quranreview.app
tags: [journey]
---
# Part 1: student registers
- launchApp:
    clearState: true
- extendedWaitUntil: { visible: { id: "login.email" }, timeout: 20000 }
- tapOn: { id: "login.register-link" }
- extendedWaitUntil: { visible: { id: "register.screen" }, timeout: 10000 }
- tapOn: { id: "register.first-name" }
- inputText: "Journey"
- tapOn: { id: "register.last-name" }
- inputText: "One"
- tapOn: { id: "register.email" }
- inputText: "e2e-journey1@quran-review.com"
- tapOn: { id: "register.password" }
- inputText: "Journey1234!"
- tapOn: { id: "register.submit" }
# lands on pending state (adjust to the actual post-register destination found in Task 4)
- extendedWaitUntil: { visible: { id: "pending-approval.screen" }, timeout: 15000 }
# Part 2: pending login is blocked
- launchApp:
    clearState: true
- runFlow:
    file: ../_helpers/login.yaml
    env: { EMAIL: "e2e-journey1@quran-review.com", PASSWORD: "Journey1234!" }
- extendedWaitUntil: { visible: { id: "pending-approval.screen" }, timeout: 15000 }
# Part 3: admin approves
- launchApp:
    clearState: true
- runFlow:
    file: ../_helpers/login.yaml
    env: { EMAIL: "admin@quran-review.com", PASSWORD: "Admin1234!" }
- extendedWaitUntil: { visible: { id: "admin-home.screen" }, timeout: 20000 }
- tapOn: { id: "admin-home.users" }
- tapOn: { id: "admin-users.search" }
- inputText: "e2e-journey1"
- tapOn: { id: "admin-users.row.0" }
- tapOn: { id: "admin-user-detail.approve" }
# Part 4: student can now log in
- launchApp:
    clearState: true
- runFlow:
    file: ../_helpers/login.yaml
    env: { EMAIL: "e2e-journey1@quran-review.com", PASSWORD: "Journey1234!" }
- extendedWaitUntil: { visible: { id: "student-home.screen" }, timeout: 20000 }
```

Adjust register field testIDs to the actual set produced in Task 3, and the admin navigation to what `admin/home.tsx` actually provides (the users list may live on home; if there is no search input, use `- scrollUntilVisible: { element: { id: "admin-users.row.<n>" } }` anchored on the new user's row and document the deviation in COVERAGE.md).

- [ ] **Step 2: Red → green + determinism proof** — `bash mobile/e2e/run.sh flows/journeys` → PASS. Then `maestro test mobile/e2e/flows/journeys` again WITHOUT reset — expect failure only at registration (duplicate email). Then full `bash mobile/e2e/run.sh flows/journeys` → PASS again (reset restores determinism).
- [ ] **Step 3: COVERAGE.md journey section + commit**

```bash
git add mobile/app/admin mobile/e2e
git commit -m "feat(e2e): journey 1 registration-to-approval flow"
```

---

### Task 9: Journeys 2+3 — appointment booking→accept, grade→student sees it

**Files:**
- Modify: `mobile/app/teacher/appointments.tsx`, `mobile/app/teacher/grade-form.tsx`, `mobile/app/teacher/home.tsx` (minimal testIDs for the controls these journeys need; NOT the full teacher pass — Plan 2; do not add to covered-screens.json)
- Create: `mobile/e2e/flows/journeys/02-appointment-booking.yaml`, `03-grade-visibility.yaml`
- Modify: `mobile/e2e/COVERAGE.md`
- Test: `bash mobile/e2e/run.sh flows/journeys` — 3/3 PASS.

**Interfaces:**
- Consumes: `student-appointments.book` (Task 5), login helper, teacher@/Teacher1234!.
- Produces: `teacher-home.screen`, `teacher-appointments.screen`, `teacher-appointments.row.0`, `teacher-appointments.accept.0`, `grade-form.screen`, `grade-form.student-select`, `grade-form.grade-input`, `grade-form.submit` (adjust to the real controls, keep the convention; Plan 2 reuses these names).

- [ ] **Step 1: Journey 2 flow** — login ali → appointments → `student-appointments.book` → fill the booking form (teacher Ahmad; tomorrow's date; time 10:00 — add testIDs to the form controls while here) → submit → assert a REQUESTED row appears (`student-appointments.status.0` testID on the row's status element). Then clearState → login teacher@ → teacher appointments → `teacher-appointments.accept.0` on the new REQUESTED row → assert the status change. Then clearState → login ali → assert the appointment shows ACCEPTED.
- [ ] **Step 2: Journey 3 flow** — login teacher@ → grade-form (add the nav control testID on teacher home) → select Ali, enter grade `A-`, pick the first real GradeType, submit → assert the success state. Then clearState → login ali → grades screen → assert the new grade row (add `student-grades.row-grade.0` testID on the grade text element if row-presence alone can't distinguish it from seeded rows).
- [ ] **Step 3: Red → green + determinism** — full `bash mobile/e2e/run.sh flows/journeys` from reset: 3/3 PASS.
- [ ] **Step 4: COVERAGE.md + commit**

```bash
git add mobile/app/teacher mobile/e2e
git commit -m "feat(e2e): journeys 2-3 booking/accept and grade visibility"
```

---

### Task 10: Journeys 10+11 (streak, mushaf persistence) + Plan-1 coverage audit

**Files:**
- Create: `mobile/e2e/flows/journeys/10-streak-after-grade.yaml`, `11-mushaf-persistence.yaml`
- Modify: `mobile/e2e/COVERAGE.md` (final audit + `## Exclusions` section)
- Modify: `tasks/todo.md` (close-out entry)
- Test: full suite `bash mobile/e2e/run.sh` — every flow PASSES from a fresh reset, twice consecutively.

**Interfaces:**
- Consumes: `student-gamification.streak` (Task 7), `student-mushaf.*` (Task 7), grade-form testIDs (Task 9).
- Produces: completed Plan-1 coverage: auth (5 screens) + student (12 screens) fully covered; journeys 1, 2, 3, 10, 11 green.

- [ ] **Step 1: Journey 10** — login ali → gamification → assert `student-gamification.streak` visible → clearState → teacher submits a fresh grade (same steps as Journey 3) → clearState → login ali → gamification → assert `student-gamification.streak` still renders. Numeric-change assertions are content-based and brittle by-id-only: if the streak value element has its own testID, assert its visibility post-refresh; document in COVERAGE.md exactly what is and is not asserted.
- [ ] **Step 2: Journey 11** — login ali → mushaf → navigate 2 pages forward → mark memorized (`student-mushaf.mark-memorized`) → `- stopApp` then `- launchApp` (NO clearState) → mushaf → assert the memorized marker testID is still visible.
- [ ] **Step 3: Full-suite runs** — `bash mobile/e2e/run.sh` twice back-to-back; both runs must pass every flow (auth 5, student 12, journeys 5). This is the determinism gate.
- [ ] **Step 4: Coverage audit** — for each of the 17 covered screens, cross-check COVERAGE.md against the screen file: every interactive element has a row or a one-line justified entry in `## Exclusions`. `node mobile/scripts/check-testids.js` green.
- [ ] **Step 5: Close-out** — append to `tasks/todo.md`: Plan 1 done, flow counts, BUGLOG.md findings summary, pointers for Plan 2 (the teacher/admin testID names already produced by Tasks 8–9).
- [ ] **Step 6: Commit**

```bash
git add mobile/e2e tasks/todo.md
git commit -m "feat(e2e): journeys 10-11, Plan-1 coverage audit complete"
```
