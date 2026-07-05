# M2a — Identity Module (Auth + Users) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 13 auth + users endpoints onto `defineRoute`/`buildContractRouter` (M1), swap both the v1 and legacy mounts while every characterization pin stays green, then delete `auth.controller.ts`, `user.controller.ts`, their route files, and their mock-based unit tests.

**Architecture:** Strangler swap, same shape as the M1 health pilot but with behavior pins written first: (1) pin current auth/users behavior with black-box itests against the legacy code, (2) add the 5 missing users contracts, (3) teach the contract router per-route pre-middleware (for `passwordResetLimiter`), (4) port handlers into `src/modules/auth/` and `src/modules/users/`, mount each contract router at **both** its v1 path and its legacy mirror (`/api/auth`, `/api/users`), (5) delete the legacy files only after the full suite is green on the swapped mounts.

**Tech Stack:** Express 5 · Prisma 6 (real Postgres on port **5433** for itests — NEVER 5432) · Zod v4 · supertest · Jest (`.itest.ts` via `jest.integration.config.js`, unit via `jest.config.js`) · bcryptjs (NOT bcrypt)

## Global Constraints

- **Byte-identical behavior:** every response body/status the M0+M2a pins assert must be unchanged by the swap. If a pin fails after the swap, fix the module handler — never the pin.
- Scope note: spec M2 = "auth, users, admin approval, roles, audit log". This plan is **M2a = auth + users only**. Admin approval + roles admin + audit log = M2b (own plan). M2a ships green on its own.
- Both suites + typecheck green at every commit: `cd packages/server && npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit`. **Run all jest/tsc commands from `packages/server/`** — running from the repo root silently uses the wrong config.
- Jest 30: the CLI flag is `--testPathPatterns` (plural). Integration DB: `docker compose -f docker-compose.test.yml up -d` from `packages/server/` if not running; global-setup does `prisma db push` (never `--force-reset`).
- Branch: `feat/rebuild-m2a` off `main`. Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Zod v4 APIs only. `packages/shared` keeps `zod` as its only dependency.
- Roles/status are UPPERCASE server-side (Prisma, JWT, `authorize()`); login/profile responses lowercase them for mobile. Never compare roles in server code using lowercase strings.
- Pinned M0 surprises that constrain contracts here: `GET /users/profile` and `GET /users/teachers` return **raw objects/arrays, not the `{success,data}` envelope**. `403` role-gate body is exactly `{"success":false,"error":"Insufficient permissions"}`. Validation 400 format: `Validation failed: <field>: <msg>`.
- Rate limiters (`authLimiter`, `standardLimiter`, `passwordResetLimiter`) skip under `NODE_ENV=test` — order is preserved for production but not directly testable; preserve legacy middleware ordering anyway (limiter **before** validate).
- Factory API (`src/__integration__/factory.ts`): `createUser(opts: {role: Role; status?: UserStatus; email?: string; password?: string}): Promise<TestUser>` with `TestUser = {id, email, role, token}`; default password is the factory's known constant — pass an explicit `password` when a test needs to log in with it.

## File Structure

```
packages/shared/src/contracts/
  users.contracts.ts        ← NEW: 5 users contracts (+ DateOut helper import from types)
  types.ts                  ← MODIFY: add DateOut (Date|string union for Prisma dates)
  registry.ts               ← MODIFY: spread usersContracts into contractRegistry
packages/shared/src/index.ts ← MODIFY: export users.contracts
packages/server/src/
  lib/contract-router.ts    ← MODIFY: ContractRoute.pre?: RequestHandler[] (runs after access, before validate)
  modules/auth/auth.module.ts   ← NEW: 8 handlers ported from auth.controller.ts
  modules/users/users.module.ts ← NEW: 5 handlers ported from user.controller.ts
  app.ts                    ← MODIFY: swap 4 mounts (v1 + legacy for auth and users)
  __integration__/
    auth-flows.itest.ts     ← NEW: behavior pins (written FIRST, green on legacy code)
    users-flows.itest.ts    ← NEW: behavior pins
    route-inventory.ts      ← MODIFY: legacy-mirror map for contract-mounted modules
    contract-router.itest.ts ← MODIFY: pre-middleware ordering test
  controllers/auth.controller.ts        ← DELETE (Task 7)
  controllers/user.controller.ts        ← DELETE (Task 7)
  routes/auth.routes.ts                 ← DELETE (Task 7)
  routes/user.routes.ts                 ← DELETE (Task 7)
  controllers/__tests__/auth.controller.test.ts ← DELETE (Task 7)
  controllers/__tests__/user.controller.test.ts ← DELETE (Task 7)
```

Deliberately NOT unit-testing the new modules: the flow itests exercise every handler against a real DB (strictly stronger than the mock-based controller tests they replace). `auth.service.ts` and its existing unit tests are untouched — services stay.

---

### Task 1: Pin auth behavior — `auth-flows.itest.ts` green against LEGACY code

**Files:**
- Create: `packages/server/src/__integration__/auth-flows.itest.ts`

**Interfaces:**
- Consumes: `createUser`, `truncateAll`, `disconnect` from `./factory` / `./db`; real `app` from `../app`; `prisma` from `../prisma/client` (to seed a reset token — the emailed token is not observable black-box).
- Produces: the behavior pins Tasks 5 and 7 must keep green. No exports.

- [ ] **Step 1: Create branch**

```bash
cd /Users/haskhr/Documents/opencode && git checkout -b feat/rebuild-m2a main
```

- [ ] **Step 2: Write the pins**

`packages/server/src/__integration__/auth-flows.itest.ts`:

```ts
import request from 'supertest';
import crypto from 'crypto';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const PW = 'Str0ngPass!x';

describe('POST /api/v1/auth/register', () => {
  it('201: creates a PENDING student, raw {message,user} echo (UPPERCASE enums)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'new@example.com',
      password: PW,
      role: 'student',
      firstName: 'New',
      lastName: 'Student',
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Registration successful. Awaiting admin approval.');
    expect(res.body.user).toMatchObject({ email: 'new@example.com', role: 'STUDENT', status: 'PENDING' });
    expect(res.body.user.id).toEqual(expect.any(String));
  });

  it('409 on duplicate email', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).post('/api/v1/auth/register').send({
      email: u.email,
      password: PW,
      role: 'student',
      firstName: 'Dup',
      lastName: 'Dup',
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: 'Email already registered' });
  });

  it("400: role 'parent' is rejected by validation (dead controller branch stays dead)", async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'p@example.com',
      password: PW,
      role: 'parent',
      firstName: 'P',
      lastName: 'P',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Validation failed: role:/);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('200: lowercase role/status, token works on a protected route', async () => {
    const u = await createUser({ role: Role.TEACHER, password: PW });
    const res = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.user).toMatchObject({ id: u.id, email: u.email, role: 'teacher', status: 'active' });
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));

    const me = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
  });

  it('401 on wrong password', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const res = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'WrongPass1!' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'Invalid credentials' });
  });

  it('403 when status is not ACTIVE', async () => {
    const u = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING, password: PW });
    const res = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Account is not active. Please wait for admin approval.');
  });
});

describe('POST /api/v1/auth/refresh (rotation)', () => {
  it('rotates: new pair works, the old refresh token is dead', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const login = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    const first = login.body.refreshToken;

    const rot = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(rot.status).toBe(200);
    expect(rot.body.token).toEqual(expect.any(String));
    expect(rot.body.refreshToken).toEqual(expect.any(String));
    expect(rot.body.refreshToken).not.toBe(first);

    const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(replay.status).toBe(401);
    expect(replay.body.error).toBe('Invalid refresh token');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('204 and the stored refresh token is invalidated', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const login = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });

    const out = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${login.body.token}`);
    expect(out.status).toBe(204);

    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(refresh.status).toBe(401);
  });
});

describe('verify-email / resend-verification', () => {
  it('POST /verify-email → 200 {message, UPPERCASE status}', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).post('/api/v1/auth/verify-email').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Email verified', status: 'ACTIVE' });
  });

  it('POST /resend-verification → 200 message (email send is a no-op in test)', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Verification email resent' });
  });
});

describe('forgot-password / reset-password', () => {
  it('forgot-password answers 200 with the same message whether or not the email exists', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email: u.email });
    const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(known.body.message).toBe('If that email is registered, a password reset link has been sent');
  });

  it('reset-password: seeded token resets, old sessions die, new password logs in', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    // The emailed token is not observable black-box — seed its hash directly.
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordResetToken: hash, passwordResetExpiry: new Date(Date.now() + 3_600_000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, newPassword: 'N3wPass!word' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Password reset successfully' });

    const oldLogin = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'N3wPass!word' });
    expect(newLogin.status).toBe(200);
  });

  it('400 on an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'deadbeef'.repeat(8), newPassword: 'N3wPass!word' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or expired reset token');
  });
});

describe('legacy mirror /api/auth', () => {
  it('POST /api/auth/login behaves identically to /api/v1/auth/login', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const res = await request(app).post('/api/auth/login').send({ email: u.email, password: PW });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('student');
  });
});
```

> Two pins may need a one-line adjustment when first run against legacy code — **adjust the pin to the observed behavior, never the code**: (a) `verify-email` echoes the user's *current* status — the factory default is ACTIVE, so `'ACTIVE'` is expected; if the factory row differs, pin what comes back. (b) If `resetPassword` clears `refreshTokenHash` (it does — line 99 of `auth.service.ts`), old refresh tokens also die; the old-password-401 assertion is the stable pin.

- [ ] **Step 3: Run against legacy code — must be green BEFORE any rebuild**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=auth-flows
```
Expected: PASS (~13 tests). If a pin fails, the pin is wrong about current behavior — fix the pin (this is characterization, the legacy code is the spec).

- [ ] **Step 4: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/__integration__/auth-flows.itest.ts && git commit -m "test(m2a): pin auth behavior — register/login/refresh-rotation/logout/verify/reset flows

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Pin users behavior — `users-flows.itest.ts`

**Files:**
- Create: `packages/server/src/__integration__/users-flows.itest.ts`

**Interfaces:**
- Consumes: same harness as Task 1.
- Produces: pins Task 6 and 7 must keep green.

- [ ] **Step 1: Write the pins**

`packages/server/src/__integration__/users-flows.itest.ts`:

```ts
import request from 'supertest';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const PW = 'Str0ngPass!x';

describe('GET /api/v1/users/profile', () => {
  it('200: RAW object (no envelope), lowercase role/status, relation fields present', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBeUndefined(); // M0-pinned surprise: raw object
    expect(res.body).toMatchObject({ id: u.id, email: u.email, role: 'student', status: 'active' });
    expect(res.body).toHaveProperty('emailVerifiedAt');
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body).toHaveProperty('assignedTeacher');
    expect(res.body).toHaveProperty('assignedStudents');
  });
});

describe('GET /api/v1/users/teachers', () => {
  it('200: RAW array of ACTIVE teachers only, {id,firstName,lastName}, sorted by firstName', async () => {
    await createUser({ role: Role.TEACHER, email: 'zz-active@example.com' });
    await createUser({ role: Role.TEACHER, status: UserStatus.PENDING, email: 'aa-pending@example.com' });
    await createUser({ role: Role.STUDENT, email: 'student@example.com' });
    const viewer = await createUser({ role: Role.STUDENT, email: 'viewer@example.com' });

    const res = await request(app).get('/api/v1/users/teachers').set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1); // pending teacher + students excluded
    expect(Object.keys(res.body[0]).sort()).toEqual(['firstName', 'id', 'lastName']);
  });
});

describe('PUT /api/v1/users/profile', () => {
  it('200: updates names, returns raw lowercase-mapped object', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ firstName: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ firstName: 'Renamed', role: 'student', status: 'active' });
    expect(res.body).toHaveProperty('createdAt');
  });
});

describe('PUT /api/v1/users/change-password', () => {
  it('401 when currentPassword is wrong', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const res = await request(app)
      .put('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ currentPassword: 'WrongPass1!', newPassword: 'N3wPass!word' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Current password is incorrect');
  });

  it('200: old password stops working, new one logs in', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const res = await request(app)
      .put('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ currentPassword: PW, newPassword: 'N3wPass!word' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Password changed successfully' });

    const oldLogin = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'N3wPass!word' });
    expect(newLogin.status).toBe(200);
  });
});

describe('POST /api/v1/users/device-token', () => {
  it('200 {saved:true}', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/users/device-token')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ deviceToken: 'expo-push-token-123' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: true });
  });

  it('400 when deviceToken is missing (schema validation)', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/users/device-token')
      .set('Authorization', `Bearer ${u.token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Validation failed: deviceToken:/);
  });
});

describe('legacy mirror /api/users', () => {
  it('GET /api/users/profile behaves identically', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('student');
  });
});
```

- [ ] **Step 2: Run against legacy code**

```bash
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=users-flows
```
Expected: PASS (~8 tests). Same rule: a failing pin means the pin mis-guessed current behavior — fix the pin.

- [ ] **Step 3: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/__integration__/users-flows.itest.ts && git commit -m "test(m2a): pin users behavior — profile/teachers/change-password/device-token

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Users contracts in shared

**Files:**
- Modify: `packages/shared/src/contracts/types.ts` (add `DateOut`)
- Create: `packages/shared/src/contracts/users.contracts.ts`
- Modify: `packages/shared/src/contracts/registry.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `defineContract`, `ErrorEnvelope` (types.ts); `UpdateProfileSchema`, `ChangePasswordSchema` (`../validators/common`); `DeviceTokenSchema` (`../validators/auth`).
- Produces: `usersContracts.{getProfile, listTeachers, updateProfile, changePassword, saveDeviceToken}`; `DateOut` exported from types.ts. Task 6 mounts these; the registry-parity itest picks them up automatically.

- [ ] **Step 1: Add `DateOut` to `packages/shared/src/contracts/types.ts`**

Append after the `ErrorEnvelope` declaration:

```ts
/**
 * Prisma Date fields: the contract router parses the handler result BEFORE
 * res.json() serializes (Date object); the typed client parses AFTER (ISO string).
 * The union satisfies both sides of the wire.
 */
export const DateOut = z.union([z.date(), z.string()]);
```

- [ ] **Step 2: Write `packages/shared/src/contracts/users.contracts.ts`**

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UpdateProfileSchema, ChangePasswordSchema } from '../validators/common';
import { DeviceTokenSchema } from '../validators/auth';

const NameCard = z.object({ id: z.string(), firstName: z.string(), lastName: z.string() });

/** RAW response (no success envelope) — M0-pinned surprise. Role/status lowercased for mobile. */
const Profile = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['student', 'teacher', 'admin', 'parent']),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(['pending', 'approved', 'active', 'banned']),
  emailVerifiedAt: DateOut.nullable(),
  createdAt: DateOut,
  assignedTeacher: NameCard.nullable(),
  assignedStudents: z.array(NameCard),
});

const UpdatedProfile = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['student', 'teacher', 'admin', 'parent']),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(['pending', 'approved', 'active', 'banned']),
  createdAt: DateOut,
});

export const usersContracts = {
  getProfile: defineContract({
    method: 'GET',
    path: '/api/v1/users/profile',
    summary: 'Own profile — RAW object, lowercase role/status, teacher/student relations',
    access: 'authenticated',
    responses: { 200: Profile, 401: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  listTeachers: defineContract({
    method: 'GET',
    path: '/api/v1/users/teachers',
    summary: 'ACTIVE teachers as a RAW array of {id,firstName,lastName}, firstName asc',
    access: 'authenticated',
    responses: { 200: z.array(NameCard), 401: ErrorEnvelope },
  }),
  updateProfile: defineContract({
    method: 'PUT',
    path: '/api/v1/users/profile',
    summary: 'Update own first/last name',
    access: 'authenticated',
    request: { body: UpdateProfileSchema },
    responses: { 200: UpdatedProfile, 400: ErrorEnvelope, 401: ErrorEnvelope },
  }),
  changePassword: defineContract({
    method: 'PUT',
    path: '/api/v1/users/change-password',
    summary: 'Change own password (verifies current password)',
    access: 'authenticated',
    request: { body: ChangePasswordSchema },
    responses: {
      200: z.object({ message: z.string() }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  saveDeviceToken: defineContract({
    method: 'POST',
    path: '/api/v1/users/device-token',
    summary: 'Store the FCM/Expo push token on the user row',
    access: 'authenticated',
    request: { body: DeviceTokenSchema },
    responses: { 200: z.object({ saved: z.literal(true) }), 400: ErrorEnvelope, 401: ErrorEnvelope },
  }),
};
```

- [ ] **Step 3: Register + export**

In `packages/shared/src/contracts/registry.ts`, import `usersContracts` and spread its values into `contractRegistry` exactly the way `authContracts` already is (keep the existing ordering style):

```ts
import { usersContracts } from './users.contracts';
// inside the registry array/spread:
...Object.values(usersContracts),
```

In `packages/shared/src/index.ts`, in the contracts block:

```ts
export * from './contracts/users.contracts';
```

- [ ] **Step 4: Parity gate + completeness must pass (registry grew by 5)**

```bash
npx jest -c jest.integration.config.js --runInBand --testPathPatterns="registry-parity|completeness"
```
Expected: PASS — parity now runs 15 tests (14 contracts + uniqueness); manifest access for all 5 users endpoints is `'authenticated'`, matching. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/shared/src/contracts/types.ts education_management/packages/shared/src/contracts/users.contracts.ts education_management/packages/shared/src/contracts/registry.ts education_management/packages/shared/src/index.ts && git commit -m "feat(m2a): users contracts (5 endpoints) + DateOut — registry at 14

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Contract-router `pre` middleware (for per-route rate limiters)

**Files:**
- Modify: `packages/server/src/lib/contract-router.ts`
- Test: `packages/server/src/__integration__/contract-router.itest.ts`

**Interfaces:**
- Consumes: existing `ContractRoute`, `defineRoute`, `buildContractRouter`.
- Produces: `defineRoute(contract, handler, opts?: { pre?: RequestHandler[] })`; chain order becomes **authenticate → authorize → pre → validate → handler** (legacy auth.routes order is `passwordResetLimiter` before `validate` — this preserves it). Task 5 depends on this exact signature.

- [ ] **Step 1: Write the failing test** — append inside `describe('buildContractRouter', ...)` in `contract-router.itest.ts` (needs `import express from 'express'` and `errorHandler`, both already imported there):

```ts
it('pre middleware runs after access checks but BEFORE validate (legacy limiter ordering)', async () => {
  const gated = defineContract({
    method: 'POST',
    path: '/api/v1/scratch2/gated',
    summary: 'itest pre-middleware ordering',
    access: 'public',
    request: { body: z.object({ n: z.number() }) },
    responses: { 200: z.object({ ok: z.literal(true) }), 400: ErrorEnvelope, 429: ErrorEnvelope },
  });
  const preApp = express();
  preApp.use(express.json());
  preApp.use(
    '/api/v1/scratch2',
    buildContractRouter(
      [
        defineRoute(gated, async () => ({ status: 200 as const, body: { ok: true as const } }), {
          pre: [
            (req, res, next) => {
              if (req.headers['x-limit']) {
                res.status(429).json({ success: false, error: 'Too many requests' });
                return;
              }
              next();
            },
          ],
        }),
      ],
      { mountPrefix: '/api/v1/scratch2' },
    ),
  );
  preApp.use(errorHandler);

  // Invalid body + x-limit: pre fires first → 429, proving pre precedes validate.
  const limited = await request(preApp).post('/api/v1/scratch2/gated').set('x-limit', '1').send({});
  expect(limited.status).toBe(429);

  // No header: validate fires → 400.
  const invalid = await request(preApp).post('/api/v1/scratch2/gated').send({});
  expect(invalid.status).toBe(400);

  // Clean request passes through pre + validate to the handler.
  const ok = await request(preApp).post('/api/v1/scratch2/gated').send({ n: 1 });
  expect(ok.status).toBe(200);
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=contract-router
```
Expected: FAIL — TS error: `defineRoute` takes 2 arguments.

- [ ] **Step 3: Implement** — in `packages/server/src/lib/contract-router.ts`:

Add `pre` to the route type and factory:

```ts
export interface ContractRoute<C extends AnyRouteContract = AnyRouteContract> {
  contract: C;
  handler: ContractHandler<C>;
  /** Extra middleware (e.g. rate limiters) run after access checks, before body validation. */
  pre?: RequestHandler[];
}

export function defineRoute<C extends AnyRouteContract>(
  contract: C,
  handler: ContractHandler<C>,
  opts: { pre?: RequestHandler[] } = {},
): ContractRoute<C> {
  return { contract, handler, pre: opts.pre };
}
```

In `buildContractRouter`, destructure `pre` and insert it between the access chain and validate:

```ts
for (const { contract, handler, pre } of routes) {
  // ...existing prefix check + sub computation...
  const chain: RequestHandler[] = [];
  if (contract.access !== 'public') chain.push(authenticate);
  if (Array.isArray(contract.access)) chain.push(authorize(...contract.access));
  if (pre) chain.push(...pre);
  if (contract.request?.body) chain.push(validate(contract.request.body));
  // ...existing handler wrapper unchanged...
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx jest -c jest.integration.config.js --runInBand --testPathPatterns=contract-router
```
Expected: PASS (8 tests). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/lib/contract-router.ts education_management/packages/server/src/__integration__/contract-router.itest.ts && git commit -m "feat(m2a): contract-router pre middleware — access → pre → validate → handler

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Auth module + swap both mounts

**Files:**
- Create: `packages/server/src/modules/auth/auth.module.ts`
- Modify: `packages/server/src/app.ts` (2 mounts: `/api/v1/auth` line ~83, `/api/auth` line ~107)
- Modify: `packages/server/src/__integration__/route-inventory.ts` (legacy-mirror map)

**Interfaces:**
- Consumes: `authContracts` (shared), `defineRoute`/`buildContractRouter` + `pre` (Task 4), `passwordResetLimiter`, everything `auth.controller.ts` uses today (`prisma`, `AppError`, `auth.service` helpers, `sendWelcomeEmail`, `logger`).
- Produces: `authRouter` (Express Router built with `mountPrefix: '/api/v1/auth'`, mounted at BOTH `/api/v1/auth` and `/api/auth`). `CONTRACT_MIRRORS` map in route-inventory (Task 6 reuses it).

- [ ] **Step 1: Extend route discovery with the legacy-mirror map**

In `route-inventory.ts`, replace the registry-union block added in M1 with:

```ts
  // Contract-mounted routes are invisible to static source parsing —
  // union the registry (dedup below absorbs endpoints that exist in both).
  // Legacy /api/* mounts mirror /api/v1/* (same manifest convention). If a
  // mirror mount is ever removed from app.ts, the authz-matrix itest hits a
  // live 404 and fails — this map cannot silently drift.
  const CONTRACT_MIRRORS: Record<string, string> = {
    '/api/v1/auth': '/api/auth',
    '/api/v1/users': '/api/users',
  };
  for (const c of contractRegistry) {
    endpoints.push({ method: c.method, path: c.path });
    for (const [canonical, mirror] of Object.entries(CONTRACT_MIRRORS)) {
      if (c.path.startsWith(`${canonical}/`)) {
        endpoints.push({ method: c.method, path: mirror + c.path.slice(canonical.length) });
      }
    }
  }
```

(Adding the users mirror now is harmless: those mirror paths are still discovered from the legacy source parse until Task 6 lands; the dedup absorbs the overlap.)

- [ ] **Step 2: Write `packages/server/src/modules/auth/auth.module.ts`**

```ts
import { authContracts } from '@quran-review/shared';
import { prisma } from '../../prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { sendWelcomeEmail } from '../../services/email.service';
import { logger } from '../../lib/logger';
import { passwordResetLimiter } from '../../middleware/rate-limit.middleware';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
  forgotPassword as forgotPasswordService,
  resetPassword as resetPasswordService,
} from '../../services/auth.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

/** Prisma enums are UPPERCASE literal unions — Lowercase<> maps them to the mobile-facing case. */
const lc = <T extends string>(s: T) => s.toLowerCase() as Lowercase<T>;

const register = defineRoute(authContracts.register, async ({ body }) => {
  const prismaRole = body.role.toUpperCase() as 'STUDENT' | 'TEACHER';
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing && !existing.deletedAt) throw new AppError(409, 'Email already registered');
  if (existing?.deletedAt) throw new AppError(409, 'This email has been used by a deleted account. Contact support.');
  const passwordHash = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: { email: body.email, passwordHash, role: prismaRole, firstName: body.firstName, lastName: body.lastName },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true },
  });
  sendWelcomeEmail(user.email, user.firstName).catch((err) => logger.error({ err }, 'Welcome email failed'));
  return {
    status: 201 as const,
    body: {
      message: 'Registration successful. Awaiting admin approval.',
      user: {
        ...user,
        role: user.role as 'STUDENT' | 'TEACHER',
        status: user.status as 'PENDING' | 'APPROVED' | 'ACTIVE' | 'BANNED',
      },
    },
  };
});

const login = defineRoute(authContracts.login, async ({ body }) => {
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await comparePassword(body.password, user.passwordHash))) {
    throw new AppError(401, 'Invalid credentials');
  }
  if (user.deletedAt) throw new AppError(403, 'Account has been deleted. Contact support.');
  if (user.status !== 'ACTIVE') throw new AppError(403, 'Account is not active. Please wait for admin approval.');
  const token = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken();
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hashRefreshToken(refreshToken) } });
  return {
    status: 200 as const,
    body: {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: lc(user.role) as 'student' | 'teacher' | 'admin' | 'parent',
        firstName: user.firstName,
        lastName: user.lastName,
        status: lc(user.status) as 'pending' | 'approved' | 'active' | 'banned',
      },
      token,
      refreshToken,
    },
  };
});

const refresh = defineRoute(authContracts.refresh, async ({ body }) => {
  const refreshTokenHash = hashRefreshToken(body.refreshToken);
  const user = await prisma.user.findFirst({ where: { refreshTokenHash } });
  if (!user || !verifyRefreshToken(body.refreshToken, user.refreshTokenHash)) {
    throw new AppError(401, 'Invalid refresh token');
  }
  if (user.deletedAt) throw new AppError(401, 'Account has been deleted');
  if (user.status !== 'ACTIVE') throw new AppError(401, 'Account is not active');
  const token = generateToken(user.id, user.role);
  const newRefreshToken = generateRefreshToken();
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hashRefreshToken(newRefreshToken) } });
  return { status: 200 as const, body: { token, refreshToken: newRefreshToken } };
});

const logout = defineRoute(authContracts.logout, async ({ userId }) => {
  await prisma.user.update({ where: { id: userId! }, data: { refreshTokenHash: null } });
  return { status: 204 as const, body: undefined };
});

const verifyEmail = defineRoute(authContracts.verifyEmail, async ({ userId }) => {
  const user = await prisma.user.update({ where: { id: userId! }, data: { emailVerifiedAt: new Date() } });
  return {
    status: 200 as const,
    body: { message: 'Email verified', status: user.status as 'PENDING' | 'APPROVED' | 'ACTIVE' | 'BANNED' },
  };
});

const resendVerification = defineRoute(authContracts.resendVerification, async ({ userId }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { email: true, firstName: true },
  });
  if (!user) throw new AppError(404, 'User not found');
  await sendWelcomeEmail(user.email, user.firstName);
  return { status: 200 as const, body: { message: 'Verification email resent' } };
});

const forgotPassword = defineRoute(
  authContracts.forgotPassword,
  async ({ body }) => {
    await forgotPasswordService(body.email);
    return {
      status: 200 as const,
      body: { message: 'If that email is registered, a password reset link has been sent' },
    };
  },
  { pre: [passwordResetLimiter] },
);

const resetPassword = defineRoute(
  authContracts.resetPassword,
  async ({ body }) => {
    const result = await resetPasswordService(body.token, body.newPassword);
    return { status: 200 as const, body: result };
  },
  { pre: [passwordResetLimiter] },
);

export const authRouter = buildContractRouter(
  [register, login, refresh, logout, verifyEmail, resendVerification, forgotPassword, resetPassword],
  { mountPrefix: '/api/v1/auth' },
);
```

> The legacy `refresh` controller had a hand-rolled `if (!refreshToken) throw 400` — `RefreshTokenSchema` already 400s that case in both old and new stacks, so it is not ported. If the auth-flows pins disagree, believe the pins.

- [ ] **Step 3: Swap the mounts in `app.ts`**

Replace (line ~83): `app.use('/api/v1/auth', authLimiter, authRoutes);`
with: `app.use('/api/v1/auth', authLimiter, authRouter);`

Replace (line ~107): `app.use('/api/auth', authLimiter, authRoutes);`
with: `app.use('/api/auth', authLimiter, authRouter);`

Remove `import authRoutes from './routes/auth.routes';` and add
`import { authRouter } from './modules/auth/auth.module';` next to the health module import.

(`buildContractRouter`'s `mountPrefix` is only used to slice contract paths into router-relative subpaths — the resulting router mounts anywhere, which is exactly how the `/api/auth` mirror keeps working.)

- [ ] **Step 4: Full integration suite — the swap must be invisible**

```bash
npx jest -c jest.integration.config.js --runInBand
```
Expected: ALL pass. auth-flows and the authz matrix are the swap detectors. A 500 on register/login in test env means the module violated its own response contract (fail-loud parse) — fix the handler body, not the contract, unless a pin proves the contract wrong.

- [ ] **Step 5: Unit suite + typecheck**

```bash
npx jest && npx tsc --noEmit
```
Expected: PASS — `auth.controller.test.ts` still passes because the controller file still exists (deletion is Task 7).

- [ ] **Step 6: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/modules/auth/auth.module.ts education_management/packages/server/src/app.ts education_management/packages/server/src/__integration__/route-inventory.ts && git commit -m "feat(m2a): swap auth (v1 + legacy mirror) to contract-driven routing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Users module + swap both mounts

**Files:**
- Create: `packages/server/src/modules/users/users.module.ts`
- Modify: `packages/server/src/app.ts` (2 mounts: `/api/v1/users` line ~84, `/api/users` line ~108)

**Interfaces:**
- Consumes: `usersContracts` (Task 3), `defineRoute`/`buildContractRouter`, `prisma`, `AppError`, `hashPassword`/`comparePassword` (`auth.service`), `logger`.
- Produces: `usersRouter` mounted at `/api/v1/users` and `/api/users`. Mount-level `authenticate, standardLimiter` stay exactly as today (contract router re-runs authenticate — idempotent, and app-level ordering vs the limiter is preserved byte-identically).

- [ ] **Step 1: Write `packages/server/src/modules/users/users.module.ts`**

```ts
import { usersContracts } from '@quran-review/shared';
import { prisma } from '../../prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { hashPassword, comparePassword } from '../../services/auth.service';
import { logger } from '../../lib/logger';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const lc = <T extends string>(s: T) => s.toLowerCase() as Lowercase<T>;
type LcRole = 'student' | 'teacher' | 'admin' | 'parent';
type LcStatus = 'pending' | 'approved' | 'active' | 'banned';

const getProfile = defineRoute(usersContracts.getProfile, async ({ userId }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
      assignedTeacher: { select: { id: true, firstName: true, lastName: true } },
      assignedStudents: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!user) throw new AppError(404, 'User not found');
  return {
    status: 200 as const,
    body: { ...user, role: lc(user.role) as LcRole, status: lc(user.status) as LcStatus },
  };
});

const listTeachers = defineRoute(usersContracts.listTeachers, async () => {
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER', status: 'ACTIVE', deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
  return { status: 200 as const, body: teachers };
});

const updateProfile = defineRoute(usersContracts.updateProfile, async ({ body, userId }) => {
  const data: Record<string, string> = {};
  if (body.firstName) data.firstName = body.firstName;
  if (body.lastName) data.lastName = body.lastName;
  const user = await prisma.user.update({
    where: { id: userId! },
    data,
    select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true, createdAt: true },
  });
  return {
    status: 200 as const,
    body: { ...user, role: lc(user.role) as LcRole, status: lc(user.status) as LcStatus },
  };
});

const changePassword = defineRoute(usersContracts.changePassword, async ({ body, userId }) => {
  const user = await prisma.user.findUnique({ where: { id: userId! } });
  if (!user) throw new AppError(404, 'User not found');
  if (!(await comparePassword(body.currentPassword, user.passwordHash))) {
    throw new AppError(401, 'Current password is incorrect');
  }
  const passwordHash = await hashPassword(body.newPassword);
  await prisma.user.update({
    where: { id: userId! },
    data: { passwordHash, passwordChangedAt: new Date() },
  });
  return { status: 200 as const, body: { message: 'Password changed successfully' } };
});

const saveDeviceToken = defineRoute(usersContracts.saveDeviceToken, async ({ body, userId }) => {
  await prisma.user.update({ where: { id: userId! }, data: { deviceToken: body.deviceToken } });
  logger.info({ userId }, 'Device token saved to DB');
  return { status: 200 as const, body: { saved: true as const } };
});

export const usersRouter = buildContractRouter(
  [getProfile, listTeachers, updateProfile, changePassword, saveDeviceToken],
  { mountPrefix: '/api/v1/users' },
);
```

> `changePassword` in the legacy controller used a dynamic `await import('bcryptjs')` — `comparePassword` from `auth.service` is the same `bcrypt.compare` call; the users-flows pin (401 wrong password / 200 flow) proves equivalence.

- [ ] **Step 2: Swap the mounts in `app.ts`**

Replace (line ~84): `app.use('/api/v1/users', authenticate, standardLimiter, userRoutes);`
with: `app.use('/api/v1/users', authenticate, standardLimiter, usersRouter);`

Replace (line ~108): `app.use('/api/users', authenticate, standardLimiter, userRoutes);`
with: `app.use('/api/users', authenticate, standardLimiter, usersRouter);`

Remove `import userRoutes from './routes/user.routes';` and add
`import { usersRouter } from './modules/users/users.module';`.

- [ ] **Step 3: Full integration suite**

```bash
npx jest -c jest.integration.config.js --runInBand
```
Expected: ALL pass. users-flows + authz matrix (incl. `/api/users/*` mirrors) are the detectors. Watch specifically for a 500 on `GET /users/profile` — that would be the fail-loud response parse catching a `Profile` schema mismatch (most likely `emailVerifiedAt`/`assignedTeacher` nullability); pin behavior wins: fix the schema to match the pinned body.

- [ ] **Step 4: Unit suite + typecheck**

```bash
npx jest && npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add education_management/packages/server/src/modules/users/users.module.ts education_management/packages/server/src/app.ts && git commit -m "feat(m2a): swap users (v1 + legacy mirror) to contract-driven routing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Retire legacy identity code + wrap up

**Files:**
- Delete: `packages/server/src/controllers/auth.controller.ts`, `packages/server/src/controllers/user.controller.ts`, `packages/server/src/routes/auth.routes.ts`, `packages/server/src/routes/user.routes.ts`, `packages/server/src/controllers/__tests__/auth.controller.test.ts`, `packages/server/src/controllers/__tests__/user.controller.test.ts`
- Modify: `tasks/todo.md`

**Interfaces:**
- Consumes: green suites from Task 6.
- Produces: legacy identity code gone; todo.md points at M2b.

- [ ] **Step 1: Prove the files are dead**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
grep -rn "auth.controller\|user.controller\|routes/auth.routes\|routes/user.routes" src --include="*.ts" | grep -v "__tests__\|controllers/auth.controller.ts\|controllers/user.controller.ts"
```
Expected: NO output (only self/test references). If anything else imports them, stop — that import must move to the modules first.

- [ ] **Step 2: Delete**

```bash
cd /Users/haskhr/Documents/opencode
git rm education_management/packages/server/src/controllers/auth.controller.ts education_management/packages/server/src/controllers/user.controller.ts education_management/packages/server/src/routes/auth.routes.ts education_management/packages/server/src/routes/user.routes.ts education_management/packages/server/src/controllers/__tests__/auth.controller.test.ts education_management/packages/server/src/controllers/__tests__/user.controller.test.ts
```
The mock-based controller tests die with their controllers — the flow itests are their strict replacement (real DB, real HTTP).

- [ ] **Step 3: Full final gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server
npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit
```
Expected: integration all pass (~687); unit passes with fewer tests (auth/user controller suites removed), zero failures; tsc clean. Route discovery: `auth.routes.ts`/`user.routes.ts` no longer exist, but their endpoints come from the contract registry + mirror map, so completeness stays green.

- [ ] **Step 4: Mark M2a done in `tasks/todo.md`**

Replace the line
`- [ ] M2 identity module — rebuild auth + users onto defineRoute using the M1 auth contracts; port/retire auth.controller.ts and its unit tests. Next: superpowers:writing-plans for M2.`
with:

```markdown
- [x] M2a identity: auth + users (date of completion) — 13 endpoints swapped to contract routing (v1 + legacy mirrors), behavior pinned first (auth-flows + users-flows itests), contract-router `pre` middleware, legacy controllers/routes/unit-mocks deleted. Plan: `docs/superpowers/plans/2026-07-06-m2a-identity-auth-users.md`.
- [ ] M2b identity: admin + audit log — swap the 12 `/api/v1/admin/*` endpoints (approval, bulk ops, progress, broadcast) onto contracts; add the audit-log improvement on top. Next: `superpowers:writing-plans` for M2b.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/haskhr/Documents/opencode && git add -A education_management/packages/server/src education_management/tasks/todo.md && git commit -m "refactor(m2a): retire legacy auth/users controllers, routes and mock unit tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of scope for M2a (deliberate)

- Admin approval, bulk ops, progress, broadcast (12 endpoints) + audit log → M2b.
- Any change to `auth.service.ts` / `email.service.ts` internals — services survive the swap untouched.
- Mobile adoption of `usersContracts` via the typed client → M9.
- Unit tests for module handlers — the flow itests cover them against a real DB; adding mocks back would recreate what Task 7 deletes.
- Auth-limiter/`standardLimiter` policy changes — declared-in-contract rate limits are a later milestone (spec §3.5).
