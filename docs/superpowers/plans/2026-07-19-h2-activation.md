# H2 Activation & Teacher Leverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (session precedent: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Horizon H2 of `docs/superpowers/specs/2026-07-16-10x-roadmap.md` — F5 role onboarding wizards, F6 Today-first teacher cockpit, F7 streak-risk nudges + enriched parent digest — per the user-confirmed brainstorm decisions (Today-first dashboard; teacher wizard = welcome → admin-assignment explainer → optional first curriculum plan; full H2 including F7).

**Architecture:** Same contract-first pattern as H1: additive migration (`User.onboardingCompletedAt`) → one new contract (registry 110 → 111) → `defineRoute` handler → mobile gate in `_layout.tsx` + per-role wizard screens. The cockpit is an upgrade of the existing teacher home (it already consumes roster-health and per-student progress), not a rebuild. F7 mirrors the digest queue's repeatable-cron worker pattern with graceful no-Redis skip; nudge dedupe rides the existing notifications table (no new schema).

**Tech Stack:** Express 5 · Prisma 6 · Zod v4 contracts · Jest 30 (unit + itest on 5433) · Expo SDK 54 / expo-router · TanStack Query · BullMQ (optional Redis).

## Global Constraints

- Branch: `feat/h2-activation` off `main`. One commit per task minimum.
- Migrations via `prisma migrate dev` only; `scripts/verify-migrations.sh` must stay green after every migration.
- **The JWT payload is pinned — do NOT add onboardingCompletedAt to it.** Surface it via the login response `SessionUser` and the profile payload instead (user-approved deviation from stage-2 §3.2).
- New endpoint ⇒ contract + `endpoint-manifest.ts` entry + registry count bump (110 → 111 in `contract-schemas.test.ts:12`).
- Pinned error bodies unchanged (401 `Authentication required`, role 403 `Insufficient permissions`).
- Mobile gates every task: `npx tsc --noEmit`, `node scripts/check-i18n.js` (ar+en for every key), `useTheme()` colors, `accessibilityRole`/`accessibilityLabel`/`hitSlop` on touchables.
- Test commands: unit `npx jest`, itest `npx jest -c jest.integration.config.js --runInBand [--testPathPatterns=x]` from `packages/server`.
- Never compare roles lowercase server-side; mobile role strings are lowercase.
- Binding ACs: stage-2 §4-S2 AC2.1.1–2.3.5 (teacher flow adapted per confirmed decision), S1 AC1–AC7; roadmap AC5.1/5.2, AC6.1/6.2, AC7.1–7.3.

## Verified codebase facts

- `SessionUser` (auth.contracts.ts:19) is a strict `z.object` — login handler builds the user object field-by-field (auth.module.ts:60). Profile endpoint (`users.module.ts` ~line 14) uses an explicit prisma `select`.
- Mobile auth gate: `_layout.tsx` ~line 56 `useEffect` with `protectedRoots = new Set(['student','teacher','admin','messages'])`; redirects pending → `/pending-approval`. `AuthUser` type lives in `mobile/src/api/auth.ts` (`role: 'student'|'teacher'|'admin'` — **note: no 'parent' in the type; fix while touching**; server emits it).
- Teacher home (`mobile/app/teacher/home.tsx`) already has: `useAppointments`, `useRecordings`, `useRosterHealth` (at-risk + reasons MISSED_SESSIONS/STREAK_BROKEN/GRADE_GAP with Arabic labels at lines 66-70), `progressByStudent` per-student fetch pattern, MetricTiles, "Priority queue" section (line ~329), quick-nav cards. No "Today's sessions" section yet.
- `curriculumPlansApi.create` exists (mobile/src/api/curriculumPlans.ts:23); teacher plans screen `app/teacher/plans.tsx`.
- `parentsApi` (mobile/src/api/parents.ts) has `listLinks(): ParentLink[]` (status PENDING/APPROVED/DENIED); the link-request screen is `app/parent/link-request.tsx`.
- Digest: `WeeklyDigestContent` interface (digest.service.ts:8), `buildWeeklyDigest(studentId, since)` (line 20), rendering `parts.push` (~line 66), `sendWeeklyDigests(now)` (line 76). Tests in `src/__integration__/digest.itest.ts` (buildWeeklyDigest describe at line 18).
- Queue lib repeatable pattern: digest worker + `digestQueue.add('trigger', {}, { repeat: { pattern: '0 8 * * 0' } })` at queue.ts:119-137 — mirror for the nudge.
- `Streak` model: `{userId PK, currentStreak, longestStreak, lastActiveDate @db.Date}`.
- **No notification-prefs system exists** (schema grep empty) — AC7.1 "opt-out respected" gets an honest deviation: dedupe = one nudge/day via the notifications table; prefs infra is a follow-up. Check `model Notification` fields at execution (`grep -n -A12 "^model Notification" prisma/schema.prisma`) — if `type` is a string column, use `'STREAK_NUDGE'`; if enum, extend the enum in the same migration as Task 1.
- `sendPushToUser` exists in fcm.service.ts:109 (grep exact params at use time); notification persistence service: `grep -rn "createNotification\|notification.create" src/services/notification.service.ts`.
- H1 pieces reused: `mushafPagesApi.getMyPages(studentId)`, `revisionQueueApi.getQueue(studentId)`, reader `?page=` param, recorder modal state `recOpen` in `app/student/mushaf.tsx`.

## File structure (create ▸ / modify ▸▸)

```
packages/server/
  prisma/migrations/<ts>_add_onboarding_completed_at/                    ▸ T1 (generated)
  src/services/streak-nudge.service.ts                                   ▸ T6
  src/services/__tests__/streak-nudge.service.test.ts                    ▸ T6
  src/__integration__/activation.itest.ts                                ▸ T1 (+T6 extends digest.itest)
  src/modules/account/account.module.ts                                  ▸▸ T1
  src/modules/auth/auth.module.ts (login user payload)                   ▸▸ T1
  src/modules/users/users.module.ts (profile select)                     ▸▸ T1
  src/services/digest.service.ts                                         ▸▸ T6
  src/lib/queue.ts (nudge queue + worker + cron)                         ▸▸ T6
  src/__integration__/{endpoint-manifest.ts,digest.itest.ts}             ▸▸ T1/T6
  src/__tests__/contract-schemas.test.ts (110→111)                       ▸▸ T1
  prisma/schema.prisma (User.onboardingCompletedAt)                      ▸▸ T1
packages/shared/src/contracts/{auth,account}.contracts.ts                ▸▸ T1
mobile/
  app/onboarding/student.tsx · teacher.tsx · parent.tsx                  ▸ T3/T4
  src/api/account.ts (completeOnboarding)                                ▸▸ T2
  src/api/auth.ts (AuthUser.onboardingCompletedAt + 'parent' role)       ▸▸ T2
  src/auth/store.ts (persist field + markOnboarded)                      ▸▸ T2
  app/_layout.tsx (gate + Stack.Screen 'onboarding')                     ▸▸ T2
  app/student/mushaf.tsx (?record=1 opens recorder)                      ▸▸ T3
  app/teacher/home.tsx (Today-first cockpit)                             ▸▸ T5
  app/teacher/recordings.tsx (needs-attention default sort)              ▸▸ T5
  src/i18n/index.ts (all new keys ar+en)                                 ▸▸ T3/T4/T5
tasks/todo.md                                                            ▸▸ T7
```

---

### Task 0: Branch + plan doc

- [ ] `cd /Users/haskhr/Documents/opencode && git checkout -b feat/h2-activation` (from up-to-date main).
- [ ] `git add education_management/docs/superpowers/plans/2026-07-19-h2-activation.md && git commit -m "docs(h2): activation implementation plan"`.

### Task 1: F5 server — onboardingCompletedAt + complete-onboarding endpoint

**Files:** Modify `prisma/schema.prisma`, `packages/shared/src/contracts/auth.contracts.ts`, `packages/shared/src/contracts/account.contracts.ts`, `src/modules/auth/auth.module.ts`, `src/modules/users/users.module.ts`, `src/modules/account/account.module.ts`, `endpoint-manifest.ts`, `contract-schemas.test.ts`; Create `src/__integration__/activation.itest.ts`.
**Interfaces (produces):** `User.onboardingCompletedAt DateTime?`; `accountContracts.completeOnboarding` POST `/api/v1/account/complete-onboarding` (authenticated, idempotent) → `{success:true, data:{onboardingCompletedAt: DateOut}}`; login `SessionUser` + profile payload gain `onboardingCompletedAt: DateOut.nullable()`.

- [ ] **Step 1: Schema.** `model User` add `onboardingCompletedAt DateTime?` (next to `emailVerifiedAt`). `npx prisma migrate dev --name add_onboarding_completed_at`; `./scripts/verify-migrations.sh` green; `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/quran_review_test npx prisma migrate deploy`.
- [ ] **Step 2: Contracts.** auth.contracts.ts `SessionUser` add `onboardingCompletedAt: DateOut.nullable()` (import DateOut from './types' if absent). account.contracts.ts add:

```ts
completeOnboarding: defineContract({
  method: 'POST',
  path: '/api/v1/account/complete-onboarding',
  summary: 'Stamp first-run onboarding as done (idempotent; all roles)',
  access: 'authenticated',
  responses: {
    200: z.object({ success: z.literal(true), data: z.object({ onboardingCompletedAt: DateOut }) }),
    401: ErrorEnvelope,
  },
}),
```

- [ ] **Step 3: Handlers.** auth.module login user object add `onboardingCompletedAt: user.onboardingCompletedAt,`. users.module profile `select` add `onboardingCompletedAt: true,`. account.module add route (idempotent — first call stamps, later calls echo):

```ts
const completeOnboarding = defineRoute(accountContracts.completeOnboarding, async ({ userId }) => {
  const existing = await prisma.user.findUnique({
    where: { id: userId! },
    select: { onboardingCompletedAt: true },
  });
  const stamped =
    existing?.onboardingCompletedAt ??
    (
      await prisma.user.update({
        where: { id: userId! },
        data: { onboardingCompletedAt: new Date() },
        select: { onboardingCompletedAt: true },
      })
    ).onboardingCompletedAt!;
  return { status: 200 as const, body: { success: true as const, data: { onboardingCompletedAt: stamped } } };
});
```

Register in the account router array. Manifest: `{ method: 'POST', path: '/api/v1/account/complete-onboarding', access: 'authenticated' }`. Registry count → **111**.
- [ ] **Step 4: Itests** — `activation.itest.ts`:

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('F5 complete-onboarding', () => {
  it('stamps once and is idempotent; login + profile echo it', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const first = await request(app)
      .post('/api/v1/account/complete-onboarding')
      .set('Authorization', `Bearer ${s.token}`);
    expect(first.status).toBe(200);
    const stamp = first.body.data.onboardingCompletedAt;
    expect(stamp).toBeTruthy();

    const second = await request(app)
      .post('/api/v1/account/complete-onboarding')
      .set('Authorization', `Bearer ${s.token}`);
    expect(second.body.data.onboardingCompletedAt).toBe(stamp); // idempotent (AC: unrepeatable wizard)

    const profile = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${s.token}`);
    expect(profile.body.onboardingCompletedAt).toBe(stamp);
  });

  it('login user payload carries null before onboarding', async () => {
    await createUser({ role: Role.STUDENT, email: 'ob@x.com', password: 'Test1234!' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'ob@x.com', password: 'Test1234!' });
    expect(res.status).toBe(200);
    expect(res.body.user.onboardingCompletedAt).toBeNull();
  });

  it('anon → 401', async () => {
    expect((await request(app).post('/api/v1/account/complete-onboarding')).status).toBe(401);
  });
});
```

Run `--testPathPatterns='activation|auth-flows|account|authz-matrix|completeness|registry-parity'` + unit `contract-schemas` → green. (auth-flows pins the login body — if it asserts exact keys, extend the pin with the new nullable field; that is an intentional, additive pin update.)
- [ ] **Step 5: Commit** `feat(h2): F5 server — onboarding stamp + complete-onboarding endpoint`.

### Task 2: F5 mobile core — gate + api + store

**Files:** Modify `mobile/src/api/auth.ts`, `mobile/src/api/account.ts`, `mobile/src/auth/store.ts`, `mobile/app/_layout.tsx`.
**Interfaces (produces):** `AuthUser.onboardingCompletedAt: string | null` and role union gains `'parent'`; `accountApi.completeOnboarding(): Promise<string>`; store `markOnboarded()` setting the field locally; `_layout` redirect: active user with `onboardingCompletedAt == null` and role ∈ {student, teacher, parent} → `/onboarding/<role>` (admin exempt).

- [ ] **Step 1:** `auth.ts`: `role: 'student' | 'teacher' | 'admin' | 'parent';` + `onboardingCompletedAt?: string | null;` on `AuthUser`.
- [ ] **Step 2:** `account.ts` add:

```ts
completeOnboarding: async (): Promise<string> => {
  const res = expectStatus(await contractClient.call(accountContracts.completeOnboarding, {}), 200);
  return (res.body as unknown as { data: { onboardingCompletedAt: string } }).data.onboardingCompletedAt;
},
```

(match the file's existing import style — follow whichever pattern `exportMyData` uses.)
- [ ] **Step 3:** store: add `markOnboarded: () => void` → `set((s) => s.user ? { user: { ...s.user, onboardingCompletedAt: new Date().toISOString() } } : {})`; ensure the persisted-session rebuild (store.ts ~line 80) includes the field.
- [ ] **Step 4:** `_layout.tsx`: `protectedRoots` gains `'onboarding'` (and `'parent'` if missing). In the gate effect, after the pending check:

```ts
} else if (
  user.status === 'active' &&
  user.onboardingCompletedAt == null &&
  ['student', 'teacher', 'parent'].includes(user.role) &&
  segments[0] !== 'onboarding'
) {
  router.replace(`/onboarding/${user.role}` as never);
}
```

Add `<Stack.Screen name="onboarding/student" />` (+teacher/parent) following the existing single-screen declarations.
- [ ] **Step 5:** `npx tsc --noEmit` clean. Commit `feat(h2): F5 mobile — onboarding gate, api, store`.

### Task 3: F5 student wizard + recorder deep link

**Files:** Create `mobile/app/onboarding/student.tsx`; Modify `mobile/app/student/mushaf.tsx` (open recorder via `?record=1`), `mobile/src/i18n/index.ts`.
**Interfaces:** Consumes store user.assignedTeacher (+ `markOnboarded`, `accountApi.completeOnboarding`); produces the 3-step wizard satisfying AC2.1.1–2.1.5.

- [ ] **Step 1: mushaf.tsx** — read `record` alongside `page`: `const { page: pageParam, record } = useLocalSearchParams<{ page?: string; record?: string }>();` + `React.useEffect(() => { if (record === '1') setRecOpen(true); }, [record]);`.
- [ ] **Step 2: wizard** `app/onboarding/student.tsx` — one screen, internal `step` state (0 welcome / 1 teacher / 2 record); progress dots; theme + a11y like the account screen:

```tsx
// step 0: brand welcome — single CTA t('obStart') («ابدأ»). No skip (spec).
// step 1: assigned teacher card (user.assignedTeacher) + t('obSaySalaam') CTA →
//         router.push to the messages thread — verify route shape first:
//         grep -rn "messages/\[" mobile/app/messages
//         Unassigned fallback (AC2.1.3): t('obTeacherSoon') + t('obRequestTeacher') →
//         /student/teacher-change; t('continue') proceeds regardless.
// step 2: t('obRecordFirst') explainer + CTA:
const finish = async () => {
  try { await accountApi.completeOnboarding(); } catch { /* offline-tolerant; server re-gates next login */ }
  markOnboarded();
  router.replace({ pathname: '/student/mushaf', params: { page: '1', record: '1' } });
};
```

- [ ] **Step 3: i18n** (ar+en, collision-check each): `obStart` (ابدأ/Start), `obWelcomeStudent` (أهلاً بك في رحلة الحفظ/Welcome to your hifz journey), `obWelcomeStudentDesc` (احفظ، سمّع لمعلمك، وراجع كل يوم/Memorize, recite to your teacher, review daily), `obYourTeacher` (معلمك/Your teacher), `obSaySalaam` (ألقِ السلام/Say salaam), `obTeacherSoon` (سيتم تعيين معلمك قريباً/Your teacher will be assigned soon), `obRequestTeacher` (اطلب معلماً/Request a teacher), `obRecordFirst` (سجّل أول تلاوة/Record your first recitation), `obRecordFirstDesc` (افتح الصفحة الأولى وسجّل تلاوتك/Open page one and record), `continue` (متابعة/Continue — reuse if exists).
- [ ] **Step 4:** Gates + simulator smoke (fresh student → wizard → mushaf p1 recorder open; relogin → no wizard = AC2.1.2). Commit `feat(h2): F5 student onboarding wizard`.

### Task 4: F5 teacher + parent wizards

**Files:** Create `mobile/app/onboarding/teacher.tsx`, `mobile/app/onboarding/parent.tsx`; Modify `mobile/src/i18n/index.ts`.

- [ ] **Step 1: teacher.tsx** (confirmed flow): step 0 `obWelcomeTeacher` (أهلاً بك معلّمنا/Welcome, teacher); step 1 `obHowStudentsArrive` (يعيّن المدير الطلاب إليك ويظهرون هنا فور التعيين/The admin assigns students to you; they appear as soon as they are assigned) + live roster line via `useRosterHealth()`; step 2:

```tsx
const done = async (goPlans: boolean) => {
  try { await accountApi.completeOnboarding(); } catch {}
  markOnboarded();
  router.replace(goPlans ? '/teacher/plans' : '/teacher/home');
};
// t('obCreateFirstPlan') («أنشئ أول خطة منهج») → done(true)
// t('skip') («تخطّ») → done(false)   [AC2.2.2: skip still stamps]
```

- [ ] **Step 2: parent.tsx**: on mount `parentsApi.listLinks()`; any `APPROVED` → auto `completeOnboarding()` + `markOnboarded()` + `router.replace('/parent/home')` (AC2.3.2). Else welcome `obWelcomeParent` (تابع رحلة أبنائك/Follow your child's journey) + CTA `obLinkChild` (اربط حسابك بابنك/Link to your child) → stamp + `router.replace('/parent/link-request')` (AC2.3.3).
- [ ] **Step 3:** i18n (+`skip` — reuse if exists). Gates + smoke all three roles. Commit `feat(h2): F5 teacher + parent onboarding wizards`.

### Task 5: F6 Today-first teacher cockpit (S1 AC1/2/3/5 + roadmap AC6.1/6.2)

**Files:** Modify `mobile/app/teacher/home.tsx`, `mobile/app/teacher/recordings.tsx`, `mobile/src/i18n/index.ts`.

- [ ] **Step 1: Today section first** (above metric tiles):

```tsx
const isToday = (d?: string) => {
  if (!d) return false;
  const x = new Date(d); const n = new Date();
  return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate();
};
const todaysSessions = appointments
  .filter((a) => ['ACCEPTED', 'REQUESTED'].includes(a.status?.toUpperCase() ?? '') && isToday(a.requestedDate))
  .sort((a, b) => (a.requestedTime ?? '').localeCompare(b.requestedTime ?? ''));
```

Row = time + student name + chips: `t('gradeAction')` (درّج) → `/teacher/grade-form?studentId=…` (**home→درّج→submit = ≤3 taps, S1-AC2**) and `t('reviewAction')` (راجع) → `/teacher/recordings`. Empty: `t('noSessionsToday')`.
- [ ] **Step 2: Review-queue card** under Today: `const needsAttention = recordings.filter((r) => !r.approvedAt && !r.rejectedAt);` → `{n} t('pendingReviews')` card → recordings screen.
- [ ] **Step 3: At-risk top-3 with reason chips (S1-AC1/AC3):** reuse the existing at-risk render (labels at lines 66-70) but capped `.slice(0,3)`, placed under the review card, rows tap → student-detail, reasons as colored chips with text (never color-only).
- [ ] **Step 4: H1 numbers on roster rows (AC6.2):** extend the existing `progressByStudent` per-student effect to also fetch `mushafPagesApi.getMyPages(studentId)` + `revisionQueueApi.getQueue(studentId)` (both catch-tolerant) and render `X/604 · Y {t('dueToday')}` as row meta via `derivePageProgress`.
- [ ] **Step 5: recordings default sort (S1-AC5/AC6.1):** order: pending first → `scoreStatus === 'UNAVAILABLE'` → `accuracyScore == null` → oldest first within group; decided items after, newest first. Pure `sortForReview(recordings)` in the screen + useMemo.
- [ ] **Step 6:** i18n: `todaySection` (اليوم/Today), `gradeAction` (درّج/Grade), `reviewAction` (راجع/Review), `noSessionsToday` (لا جلسات اليوم/No sessions today), `pendingReviews` (بانتظار المراجعة/Awaiting review) — collision-check. Gates + smoke as teacher@. **Dispositions recorded at close-out:** S1-AC7 (impeccable critique) skipped — skill unavailable; S1-AC4 — verify `app/teacher/plans.tsx` already offers create+items+assign in one screen; if yes record "already met", else add the missing assign control inline. Commit `feat(h2): F6 today-first teacher cockpit`.

### Task 6: F7 — streak-risk nudge + digest enrichment (AC7.1–7.3)

**Files:** Create `src/services/streak-nudge.service.ts`, `src/services/__tests__/streak-nudge.service.test.ts`; Modify `src/services/digest.service.ts`, `src/lib/queue.ts`, `src/__integration__/digest.itest.ts`.
**Interfaces (produces):** pure `shouldNudge(input: { now: Date; lastActiveDate: Date; alreadyNudgedToday: boolean }): boolean` (evening window `EVENING_HOUR = 20`, local time); `sendStreakNudges(now?: Date): Promise<number>`; `WeeklyDigestContent` gains `pagesMemorizedThisWeek: number; revisionDueToday: number`.

- [ ] **Step 1: Failing unit tests** (local-time Dates for TZ determinism):

```ts
import { shouldNudge } from '../streak-nudge.service';
const at = (h: number) => new Date(2026, 6, 19, h, 0, 0);
const yesterday = new Date(2026, 6, 18);
const today = new Date(2026, 6, 19);

describe('shouldNudge (AC7.1 window logic)', () => {
  it('nudges in the evening when no activity today and not yet nudged', () =>
    expect(shouldNudge({ now: at(20), lastActiveDate: yesterday, alreadyNudgedToday: false })).toBe(true));
  it('never before the evening window', () =>
    expect(shouldNudge({ now: at(12), lastActiveDate: yesterday, alreadyNudgedToday: false })).toBe(false));
  it('never when already active today', () =>
    expect(shouldNudge({ now: at(21), lastActiveDate: today, alreadyNudgedToday: false })).toBe(false));
  it('never twice a day', () =>
    expect(shouldNudge({ now: at(22), lastActiveDate: yesterday, alreadyNudgedToday: true })).toBe(false));
});
```

- [ ] **Step 2: Implement** `streak-nudge.service.ts`: pure `shouldNudge` (same-local-day compare + `now.getHours() >= EVENING_HOUR` + `!alreadyNudgedToday`); `sendStreakNudges(now = new Date())` — streaks `currentStreak > 0` with stale `lastActiveDate`; per user check today's `STREAK_NUDGE` notification (grep `model Notification` for exact required fields + how notification.service persists; Arabic body: `حافظ على سلسلتك! سجّل مراجعة قبل نهاية اليوم`); persist + best-effort `sendPushToUser` try/catch; return sent count. **Deviation:** opt-out prefs don't exist — once/day dedupe only.
- [ ] **Step 3: Queue wiring** mirroring the digest block: `streakNudgeQueue` + worker → `sendStreakNudges()` + repeat `'0 20 * * *'`. Redis absent → silently off (record at close-out).
- [ ] **Step 4: Digest enrichment (AC7.2/7.3):** `WeeklyDigestContent` += the two fields. In `buildWeeklyDigest`: `pagesMemorizedThisWeek = prisma.pageMemorization.count({ where: { userId: studentId, status: { in: ['MEMORIZED','SOLID'] }, updatedAt: { gte: since } } })`; `revisionDueToday` = `buildRevisionQueue` (imported from revision-queue.service — system context bypasses the requester guard deliberately) fed by the same three queries `getRevisionQueue` uses, `.length` of items. Fold `pagesMemorizedThisWeek > 0` into `hasActivity`. Rendering: `parts.push(\`${content.pagesMemorizedThisWeek} page(s) memorized\`)` when > 0, plus `\`${content.revisionDueToday} page(s) due for revision\`` when > 0. Extend digest.itest.ts: seed a MEMORIZED page inside the window → expect `pagesMemorizedThisWeek: 1`; run the existing send-once test unchanged (AC7.3 pin holds).
- [ ] **Step 5:** Units + `--testPathPatterns='digest'` + full unit suite green. Commit `feat(h2): F7 streak-risk nudge + digest pages/adherence`.

### Task 7: Close-out

- [ ] Full gates: server unit + full itest + tsc ×3 + check-i18n + `verify-migrations.sh`; record counts.
- [ ] `tasks/todo.md` `[x] H2 Activation` entry: AC proof map + deviations — (a) stamp via login/profile not JWT (approved); (b) teacher wizard adapted to admin-assigns model (stage-2 AC2.2.1 → "first plan created or consciously skipped"); (c) AC7.1 opt-out → dedupe-only (no prefs infra); (d) S1-AC7 critique skipped; (e) nudges inactive without Redis.
- [ ] Inline security pass: complete-onboarding self-only; wizards client-side; nudge job takes no user input.
- [ ] superpowers:finishing-a-development-branch — merge `feat/h2-activation` → main, post-merge smoke, push, delete branch (session precedent + standing authorization).

## Self-review notes

- **AC coverage:** S2 2.1.x→T3 (2.1.4: recorder reuse via the mushaf modal — one recording path), 2.2.x→T4 (adapted; skip stamps), 2.3.x→T4 (APPROVED auto-complete); S1 AC1/2/3/5→T5, AC6 gates everywhere, AC4/AC7 dispositioned in T5-Step 6; roadmap AC5.1→T3 (store assignedTeacher = the same single derivation), AC5.2→wizard end state, AC6.1/6.2→T5 Steps 4–5, AC7.1–7.3→T6.
- **Type consistency:** `onboardingCompletedAt` string|null (mobile) / DateOut.nullable() (contract) / DateTime? (prisma); `markOnboarded()` defined T2, used T3/T4; `sortForReview` local to recordings screen; `shouldNudge` input shape identical in test and impl.
- **Grep-anchored unknowns:** messages thread route shape, Notification model fields + persistence helper, account.ts client style, `protectedRoots` parent membership, plans-screen one-tab status, auth-flows login-body pin, `useRosterHealth` return names.
