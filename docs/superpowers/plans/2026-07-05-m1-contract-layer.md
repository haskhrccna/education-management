# M1 — Contract Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Zod contract DSL in `packages/shared/src/contracts/` as the single source of truth for endpoints, a `defineRoute(contract, handler)` server helper proven by swapping `GET /api/health` to contract-driven routing, all 8 auth contracts registered, and a typed client generator — with the M0 characterization suite (647 itests) and unit suite (379 tests) green throughout.

**Architecture:** Contracts declare method, full canonical path, access, request schemas, and per-status response schemas. `buildContractRouter` turns contracts+handlers into an Express Router reusing the *existing* `authenticate`/`authorize`/`validate` middleware so error strings stay byte-identical to what M0 pinned. The endpoint-inventory used by the completeness itest is extended to union the contract registry, so contract-mounted routes (invisible to static source parsing) stay covered. Auth gets contracts + registry parity now; its routing swap happens in M2 (identity rebuild) where `auth.controller.ts` and its unit tests are rewritten anyway.

**Tech Stack:** Zod ^4.3.6 · Express 5 (v4 API) · TypeScript strict · Jest (unit: `*.test.ts` mocked-Prisma; integration: `*.itest.ts` real Postgres via `jest.integration.config.js`).

## Global Constraints

- Runtime behavior of any swapped endpoint must be **byte-identical** — M0 pins it: role-gate 403 body is exactly `{ success: false, error: 'Insufficient permissions' }`, anon 401, validation 400 is `Validation failed: <field>: <msg>, ...`, health success is `{ success: true, data: {...} }`.
- Roles in contracts are **UPPERCASE** (`UserRole` enum from `packages/shared/src/enums/roles.ts`) — same values `authorize()` compares. Never lowercase in server-side code.
- After every task: `cd packages/server && npx tsc --noEmit` passes (the pre-commit hook runs it), unit suite passes, and from `packages/server`: `npx jest -c jest.integration.config.js --runInBand` passes (647+ tests; test DB: `docker compose -f docker-compose.test.yml up -d --wait` if not already running).
- No mobile code changes in M1 (client generator ships in shared; mobile adoption is M9).
- Zod v4 APIs only (`z.ZodType`, `z.object`, `z.enum`, `z.literal`); shared package has zod as its only dependency — keep it that way (the client generator uses global `fetch`, no axios).
- Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Pre-commit runs prettier — diffs after commit are expected formatting, not corruption.
- Work happens on branch `feat/rebuild-m1` (already created from merged main).

---

### Task 1: Contract DSL types in shared

**Files:**
- Create: `packages/shared/src/contracts/types.ts`
- Modify: `packages/shared/src/index.ts` (add one export line)
- Test: `packages/server/src/__tests__/contract-dsl.test.ts`

**Interfaces:**
- Consumes: `UserRole` from `../enums/roles` (existing).
- Produces (Tasks 2–5 depend on these exact names): `HttpMethod`, `ContractAccess`, `RouteContract<TParams,TQuery,TBody,TResponses>`, `defineContract(c)`, `AnyRouteContract`, `ContractResponse<C>`, `ContractBody<C>`, `ContractParams<C>`, `ContractQuery<C>`, `ErrorEnvelope`.

- [ ] **Step 1: Write the failing test**

`packages/server/src/__tests__/contract-dsl.test.ts`:

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope, UserRole } from '@quran-review/shared';
import type { ContractResponse } from '@quran-review/shared';

describe('contract DSL', () => {
  const ping = defineContract({
    method: 'POST',
    path: '/api/v1/ping/:id',
    summary: 'test contract',
    access: [UserRole.ADMIN],
    request: { body: z.object({ n: z.number() }) },
    responses: { 200: z.object({ doubled: z.number() }), 403: ErrorEnvelope },
  });

  it('defineContract returns its input unchanged (identity with inference)', () => {
    expect(ping.method).toBe('POST');
    expect(ping.path).toBe('/api/v1/ping/:id');
    expect(ping.access).toEqual([UserRole.ADMIN]);
  });

  it('response union types are usable (compile-time check exercised at runtime)', () => {
    const ok: ContractResponse<typeof ping> = { status: 200, body: { doubled: 4 } };
    const denied: ContractResponse<typeof ping> = {
      status: 403,
      body: { success: false, error: 'Insufficient permissions' },
    };
    expect(ok.status).toBe(200);
    expect(denied.status).toBe(403);
  });

  it('ErrorEnvelope matches the pinned error shape', () => {
    expect(ErrorEnvelope.parse({ success: false, error: 'Not found' })).toEqual({
      success: false,
      error: 'Not found',
    });
    expect(
      ErrorEnvelope.parse({ success: false, error: 'x', meta: { requestId: 'r-1' } }).meta,
    ).toEqual({ requestId: 'r-1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx jest --testPathPattern=contract-dsl`
Expected: FAIL — `@quran-review/shared` has no export `defineContract`.

- [ ] **Step 3: Write the DSL**

`packages/shared/src/contracts/types.ts`:

```ts
import { z } from 'zod';
import { UserRole } from '../enums/roles';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** 'public' | 'authenticated' | explicit UPPERCASE role allow-list (same values authorize() compares). */
export type ContractAccess = 'public' | 'authenticated' | UserRole[];

/** Every non-2xx error body in this API (errorHandler + 404 handler shape, pinned by M0). */
export const ErrorEnvelope = z.object({
  success: z.literal(false),
  error: z.string(),
  meta: z.object({ requestId: z.string().optional() }).optional(),
});

export interface RouteContract<
  TParams extends z.ZodType = z.ZodType,
  TQuery extends z.ZodType = z.ZodType,
  TBody extends z.ZodType = z.ZodType,
  TResponses extends Record<number, z.ZodType> = Record<number, z.ZodType>,
> {
  method: HttpMethod;
  /** Full canonical path (e.g. '/api/v1/auth/login', '/api/health'); params as :name. */
  path: string;
  summary: string;
  access: ContractAccess;
  request?: { params?: TParams; query?: TQuery; body?: TBody };
  /** Response schema per status code. 204 uses z.undefined(). */
  responses: TResponses;
}

/** Widened alias for registries and generic helpers. */
export type AnyRouteContract = RouteContract<z.ZodType, z.ZodType, z.ZodType, Record<number, z.ZodType>>;

/** Identity helper that preserves literal types for inference. */
export const defineContract = <
  TParams extends z.ZodType,
  TQuery extends z.ZodType,
  TBody extends z.ZodType,
  TResponses extends Record<number, z.ZodType>,
>(
  c: RouteContract<TParams, TQuery, TBody, TResponses>,
): RouteContract<TParams, TQuery, TBody, TResponses> => c;

/** Discriminated union of { status, body } for every declared response. */
export type ContractResponse<C extends AnyRouteContract> = {
  [S in keyof C['responses'] & number]: { status: S; body: z.infer<C['responses'][S]> };
}[keyof C['responses'] & number];

export type ContractBody<C extends AnyRouteContract> = C['request'] extends { body: infer B extends z.ZodType }
  ? z.infer<B>
  : undefined;

export type ContractParams<C extends AnyRouteContract> = C['request'] extends {
  params: infer P extends z.ZodType;
}
  ? z.infer<P>
  : Record<string, string>;

export type ContractQuery<C extends AnyRouteContract> = C['request'] extends { query: infer Q extends z.ZodType }
  ? z.infer<Q>
  : Record<string, unknown>;
```

Append to `packages/shared/src/index.ts`:

```ts
// Contracts
export * from './contracts/types';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx jest --testPathPattern=contract-dsl`
Expected: PASS (3 tests). Also run `npx tsc --noEmit` in `packages/server` — clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/contracts/types.ts packages/shared/src/index.ts packages/server/src/__tests__/contract-dsl.test.ts
git commit -m "feat(m1): contract DSL — RouteContract, defineContract, typed response unions"
```

---

### Task 2: Health + auth contracts and the registry

**Files:**
- Create: `packages/shared/src/contracts/health.contracts.ts`
- Create: `packages/shared/src/contracts/auth.contracts.ts`
- Create: `packages/shared/src/contracts/registry.ts`
- Modify: `packages/shared/src/index.ts` (three export lines)
- Test: `packages/server/src/__tests__/contract-schemas.test.ts`

**Interfaces:**
- Consumes: `defineContract`, `ErrorEnvelope` (Task 1); `LoginSchema`, `RegisterSchema`, `RefreshTokenSchema` from `../validators/common`; `ForgotPasswordSchema`, `ResetPasswordSchema` from `../validators/auth`.
- Produces: `healthContracts.getHealth`; `authContracts.{register,login,refresh,logout,verifyEmail,resendVerification,forgotPassword,resetPassword}`; `contractRegistry: AnyRouteContract[]` (Tasks 3–6 iterate this).

**Response shapes are transcriptions of current behavior** (from `auth.controller.ts` / `lib/health.ts` / `lib/response.ts`) — they are pins, not designs. Notable pinned facts: register echoes the user with **UPPERCASE** role/status (raw Prisma select); login lowercases both; neither is wrapped in the success envelope; health *is* enveloped.

- [ ] **Step 1: Write the failing test**

`packages/server/src/__tests__/contract-schemas.test.ts`:

```ts
import { authContracts, healthContracts, contractRegistry } from '@quran-review/shared';

describe('contract schemas pin current response shapes', () => {
  it('registry has 9 contracts with unique method+path', () => {
    expect(contractRegistry).toHaveLength(9);
    const keys = contractRegistry.map((c) => `${c.method} ${c.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('login 200 schema accepts the observed login body', () => {
    const observed = {
      message: 'Login successful',
      user: {
        id: '9dfad50c-57bb-4a1b-bf1e-98ddbbb9db29',
        email: 'itest-student-1@itest.local',
        role: 'student',
        firstName: 'Itest',
        lastName: 'STUDENT',
        status: 'active',
      },
      token: 'x.y.z',
      refreshToken: 'a'.repeat(64),
    };
    expect(() => authContracts.login.responses[200].parse(observed)).not.toThrow();
  });

  it('register 201 schema requires UPPERCASE role/status (raw Prisma echo)', () => {
    const observed = {
      message: 'Registration successful. Awaiting admin approval.',
      user: {
        id: '9dfad50c-57bb-4a1b-bf1e-98ddbbb9db29',
        email: 'new@itest.local',
        role: 'STUDENT',
        firstName: 'A',
        lastName: 'B',
        status: 'PENDING',
      },
    };
    expect(() => authContracts.register.responses[201].parse(observed)).not.toThrow();
    expect(() =>
      authContracts.register.responses[201].parse({
        ...observed,
        user: { ...observed.user, role: 'student' },
      }),
    ).toThrow();
  });

  it('health 200 schema accepts the observed health envelope', () => {
    const observed = {
      success: true,
      data: {
        status: 'healthy',
        timestamp: '2026-07-05T00:00:00.000Z',
        version: '1.0.0',
        checks: {
          database: { status: 'up', latencyMs: 3 },
          memory: { status: 'up', usedMB: 100, totalMB: 200 },
        },
      },
    };
    expect(() => healthContracts.getHealth.responses[200].parse(observed)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx jest --testPathPattern=contract-schemas`
Expected: FAIL — no export `authContracts`.

- [ ] **Step 3: Write the contracts**

`packages/shared/src/contracts/health.contracts.ts`:

```ts
import { z } from 'zod';
import { defineContract } from './types';

const HealthData = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  version: z.string(),
  checks: z.object({
    database: z.object({ status: z.enum(['up', 'down']), latencyMs: z.number() }),
    redis: z.object({ status: z.enum(['up', 'down', 'disabled']) }).optional(),
    memory: z.object({ status: z.literal('up'), usedMB: z.number(), totalMB: z.number() }),
  }),
});

/** getHealthStatus() wrapped by successResponse — the one enveloped success in this pilot. */
const HealthEnvelope = z.object({ success: z.literal(true), data: HealthData });

export const healthContracts = {
  getHealth: defineContract({
    method: 'GET',
    path: '/api/health',
    summary: 'Liveness/readiness probe (DB + memory checks)',
    access: 'public',
    responses: { 200: HealthEnvelope, 503: HealthEnvelope },
  }),
};
```

`packages/shared/src/contracts/auth.contracts.ts`:

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope } from './types';
import { LoginSchema, RegisterSchema, RefreshTokenSchema } from '../validators/common';
import { ForgotPasswordSchema, ResetPasswordSchema } from '../validators/auth';

const Message = z.object({ message: z.string() });

/** register echoes the raw Prisma select — UPPERCASE role/status, no envelope. */
const RegisteredUser = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['STUDENT', 'TEACHER']),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'BANNED']),
});

/** login lowercases role/status for the mobile client. */
const SessionUser = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['student', 'teacher', 'admin', 'parent']),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(['pending', 'approved', 'active', 'banned']),
});

export const authContracts = {
  register: defineContract({
    method: 'POST',
    path: '/api/v1/auth/register',
    summary: 'Self-register a student or teacher (lands in PENDING)',
    access: 'public',
    request: { body: RegisterSchema },
    responses: {
      201: z.object({ message: z.string(), user: RegisteredUser }),
      400: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  login: defineContract({
    method: 'POST',
    path: '/api/v1/auth/login',
    summary: 'Email+password login → JWT access + refresh token',
    access: 'public',
    request: { body: LoginSchema },
    responses: {
      200: z.object({ message: z.string(), user: SessionUser, token: z.string(), refreshToken: z.string() }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  refresh: defineContract({
    method: 'POST',
    path: '/api/v1/auth/refresh',
    summary: 'Rotate refresh token → new JWT pair',
    access: 'public',
    request: { body: RefreshTokenSchema },
    responses: {
      200: z.object({ token: z.string(), refreshToken: z.string() }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
    },
  }),
  logout: defineContract({
    method: 'POST',
    path: '/api/v1/auth/logout',
    summary: 'Invalidate the stored refresh token',
    access: 'authenticated',
    responses: { 204: z.undefined(), 401: ErrorEnvelope },
  }),
  verifyEmail: defineContract({
    method: 'POST',
    path: '/api/v1/auth/verify-email',
    summary: 'Mark the authenticated user email as verified',
    access: 'authenticated',
    responses: {
      200: z.object({ message: z.string(), status: z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'BANNED']) }),
      401: ErrorEnvelope,
    },
  }),
  resendVerification: defineContract({
    method: 'POST',
    path: '/api/v1/auth/resend-verification',
    summary: 'Resend the welcome/verification email',
    access: 'authenticated',
    responses: { 200: Message, 401: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  forgotPassword: defineContract({
    method: 'POST',
    path: '/api/v1/auth/forgot-password',
    summary: 'Request password-reset email (never reveals registration)',
    access: 'public',
    request: { body: ForgotPasswordSchema },
    responses: { 200: Message, 400: ErrorEnvelope },
  }),
  resetPassword: defineContract({
    method: 'POST',
    path: '/api/v1/auth/reset-password',
    summary: 'Reset password with the emailed token',
    access: 'public',
    request: { body: ResetPasswordSchema },
    responses: { 200: Message, 400: ErrorEnvelope },
  }),
};
```

`packages/shared/src/contracts/registry.ts`:

```ts
import { AnyRouteContract } from './types';
import { healthContracts } from './health.contracts';
import { authContracts } from './auth.contracts';

/** Every declared contract. Tests iterate this; an endpoint here but absent
 *  from the endpoint manifest (or vice versa, once its module is swapped) fails CI. */
export const contractRegistry: AnyRouteContract[] = [
  ...Object.values(healthContracts),
  ...Object.values(authContracts),
];
```

Append to `packages/shared/src/index.ts`:

```ts
export * from './contracts/health.contracts';
export * from './contracts/auth.contracts';
export * from './contracts/registry';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx jest --testPathPattern=contract-schemas`
Expected: PASS (4 tests). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/contracts/ packages/shared/src/index.ts packages/server/src/__tests__/contract-schemas.test.ts
git commit -m "feat(m1): health + auth contracts and contract registry (9 endpoints pinned)"
```

---

### Task 3: `defineRoute` + `buildContractRouter` on the server

**Files:**
- Create: `packages/server/src/lib/contract-router.ts`
- Test: `packages/server/src/__integration__/contract-router.itest.ts`

**Interfaces:**
- Consumes: `RouteContract`, `AnyRouteContract`, `ContractResponse`, `ContractBody`, `ContractParams`, `ContractQuery` (Task 1); existing `authenticate`, `authorize` (`../middleware/auth.middleware`), `validate` (`../middleware/validate.middleware`), `config` (`../config`).
- Produces: `defineRoute(contract, handler) → ContractRoute`; `buildContractRouter(routes, { mountPrefix }) → express.Router`. Task 4 and every M2+ module depend on these exact signatures.

**Behavioral requirement:** the middleware chain must be the *existing* middleware, in the existing order (auth → authz → validation → handler), so all error bodies stay byte-identical to M0's pins.

- [ ] **Step 1: Write the failing integration test**

`packages/server/src/__integration__/contract-router.itest.ts` — mounts scratch contracts on a scratch Express app that reuses the real error handler, then asserts the pinned behaviors:

```ts
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { defineContract, ErrorEnvelope, UserRole } from '@quran-review/shared';
import { defineRoute, buildContractRouter } from '../lib/contract-router';
import { errorHandler } from '../middleware/error.middleware';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

const echo = defineContract({
  method: 'POST',
  path: '/api/v1/scratch/echo',
  summary: 'itest scratch route',
  access: [UserRole.ADMIN],
  request: { body: z.object({ n: z.number() }) },
  responses: { 200: z.object({ doubled: z.number() }), 401: ErrorEnvelope, 403: ErrorEnvelope, 400: ErrorEnvelope },
});

const open = defineContract({
  method: 'GET',
  path: '/api/v1/scratch/open',
  summary: 'itest public route',
  access: 'public',
  responses: { 200: z.object({ ok: z.literal(true) }) },
});

const broken = defineContract({
  method: 'GET',
  path: '/api/v1/scratch/broken',
  summary: 'itest response-schema violation',
  access: 'public',
  responses: { 200: z.object({ mustBe: z.literal('present') }) },
});

const app = express();
app.use(express.json());
app.use(
  '/api/v1/scratch',
  buildContractRouter(
    [
      defineRoute(echo, async ({ body }) => ({ status: 200 as const, body: { doubled: body.n * 2 } })),
      defineRoute(open, async () => ({ status: 200 as const, body: { ok: true as const } })),
      // deliberately violates its declared 200 schema:
      defineRoute(broken, async () => ({ status: 200 as const, body: {} as { mustBe: 'present' } })),
    ],
    { mountPrefix: '/api/v1/scratch' },
  ),
);
app.use(errorHandler);

beforeAll(truncateAll);
afterAll(disconnect);

describe('buildContractRouter', () => {
  it('public route works without a token', async () => {
    const res = await request(app).get('/api/v1/scratch/open');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('anon on protected route → 401 (via real authenticate)', async () => {
    const res = await request(app).post('/api/v1/scratch/echo').send({ n: 1 });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('wrong role → 403 with the pinned role-gate body', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/scratch/echo')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ n: 1 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('invalid body → 400 in the pinned "Validation failed:" format (via real validate)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .post('/api/v1/scratch/echo')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Validation failed: n:/);
  });

  it('valid request → typed handler result serialized as JSON', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .post('/api/v1/scratch/echo')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ n: 21 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ doubled: 42 });
  });

  it('response violating its declared schema → 500 in test env (fail loud)', async () => {
    const res = await request(app).get('/api/v1/scratch/broken');
    expect(res.status).toBe(500);
  });

  it('rejects a contract whose path does not start with the mount prefix', () => {
    expect(() =>
      buildContractRouter(
        [defineRoute(open, async () => ({ status: 200 as const, body: { ok: true as const } }))],
        { mountPrefix: '/api/v1/other' },
      ),
    ).toThrow(/mountPrefix/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && docker compose -f docker-compose.test.yml up -d --wait && npx jest -c jest.integration.config.js --runInBand --testPathPattern=contract-router`
Expected: FAIL — `Cannot find module '../lib/contract-router'`.

- [ ] **Step 3: Write the contract router**

`packages/server/src/lib/contract-router.ts`:

```ts
import { Router, Request, Response, RequestHandler } from 'express';
import {
  AnyRouteContract,
  ContractBody,
  ContractParams,
  ContractQuery,
  ContractResponse,
} from '@quran-review/shared';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { config } from '../config';

export interface HandlerCtx<C extends AnyRouteContract> {
  body: ContractBody<C>;
  params: ContractParams<C>;
  query: ContractQuery<C>;
  /** Set by authenticate for non-public contracts. */
  userId?: string;
  role?: string;
  req: Request;
  res: Response;
}

export type ContractHandler<C extends AnyRouteContract> = (ctx: HandlerCtx<C>) => Promise<ContractResponse<C>>;

export interface ContractRoute<C extends AnyRouteContract = AnyRouteContract> {
  contract: C;
  handler: ContractHandler<C>;
}

export function defineRoute<C extends AnyRouteContract>(contract: C, handler: ContractHandler<C>): ContractRoute<C> {
  return { contract, handler };
}

/**
 * Builds an Express router from contract routes. Reuses the existing
 * authenticate/authorize/validate middleware so every error body stays
 * byte-identical to the M0 characterization pins.
 */
// Array<ContractRoute<any>> (not ContractRoute[]): handler is contravariant in C,
// so ContractRoute<SpecificContract> is not assignable to ContractRoute<AnyRouteContract>
// under strictFunctionTypes.
export function buildContractRouter(routes: Array<ContractRoute<any>>, opts: { mountPrefix: string }): Router {
  const router = Router();
  for (const { contract, handler } of routes) {
    if (!contract.path.startsWith(opts.mountPrefix)) {
      throw new Error(`Contract path ${contract.path} does not start with mountPrefix ${opts.mountPrefix}`);
    }
    const sub = contract.path.slice(opts.mountPrefix.length) || '/';
    const chain: RequestHandler[] = [];
    if (contract.access !== 'public') chain.push(authenticate);
    if (Array.isArray(contract.access)) chain.push(authorize(...contract.access));
    if (contract.request?.body) chain.push(validate(contract.request.body));
    chain.push(async (req, res, next) => {
      try {
        const result = await handler({
          body: req.body,
          params: req.params as never,
          query: req.query as never,
          userId: req.userId,
          role: req.role,
          req,
          res,
        });
        // Fail loud outside production if a handler violates its own contract.
        const schema = (contract.responses as Record<number, { parse: (v: unknown) => unknown }>)[result.status];
        if (config.env !== 'production' && schema && result.status !== 204) {
          schema.parse(result.body);
        }
        if (result.status === 204) {
          res.status(204).send();
          return;
        }
        res.status(result.status).json(result.body);
      } catch (err) {
        next(err);
      }
    });
    const method = contract.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    router[method](sub, ...chain);
  }
  return router;
}
```

Note: if `req.role` is not declared on Express's `Request` type in this codebase, check what `auth.middleware.ts` actually sets (`grep -n "req\." packages/server/src/middleware/auth.middleware.ts`) and mirror that exact property name here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest -c jest.integration.config.js --runInBand --testPathPattern=contract-router`
Expected: PASS (7 tests). `npx tsc --noEmit` clean.

- [ ] **Step 5: Run the full integration + unit suites (regression gate)**

Run: `npx jest -c jest.integration.config.js --runInBand && npx jest`
Expected: 647+7 itests pass, 379+7 unit tests pass (counts grow by the new suites only).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/lib/contract-router.ts packages/server/src/__integration__/contract-router.itest.ts
git commit -m "feat(m1): defineRoute + buildContractRouter reusing pinned middleware chain"
```

---

### Task 4: Pilot swap — `GET /api/health` served from its contract

**Files:**
- Create: `packages/server/src/modules/health/health.module.ts`
- Modify: `packages/server/src/app.ts` (replace the inline `app.get('/api/health', ...)` handler, lines ~79–84)
- Modify: `packages/server/src/__integration__/route-inventory.ts` (union the contract registry into discovery)

**Interfaces:**
- Consumes: `healthContracts` (Task 2); `defineRoute`, `buildContractRouter` (Task 3); existing `getHealthStatus` (`../../lib/health`).
- Produces: `healthRouter` (express Router) consumed by `app.ts`; `discoverEndpoints()` now returns contract-registry endpoints too (every M2+ swap relies on this).

- [ ] **Step 1: Extend route discovery first (it is what keeps completeness green through the swap)**

In `packages/server/src/__integration__/route-inventory.ts`, add the import at the top:

```ts
import { contractRegistry } from '@quran-review/shared';
```

and inside `discoverEndpoints()`, immediately before the dedup block, add:

```ts
  // Contract-mounted routes are invisible to static source parsing —
  // union the registry (dedup below absorbs endpoints that exist in both).
  for (const c of contractRegistry) {
    endpoints.push({ method: c.method, path: c.path });
  }
```

- [ ] **Step 2: Run the completeness itest — must still pass (registry ⊆ manifest already)**

Run: `npx jest -c jest.integration.config.js --runInBand --testPathPattern=completeness`
Expected: PASS — auth endpoints are discovered both statically and via registry (deduped); `/api/health` via inline regex and registry (deduped).

- [ ] **Step 3: Write the health module**

`packages/server/src/modules/health/health.module.ts`:

```ts
import { healthContracts } from '@quran-review/shared';
import { getHealthStatus } from '../../lib/health';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const getHealth = defineRoute(healthContracts.getHealth, async () => {
  const health = await getHealthStatus();
  // Same status mapping as the old inline handler: healthy/degraded → 200, unhealthy → 503.
  return health.status === 'unhealthy'
    ? { status: 503 as const, body: { success: true as const, data: health } }
    : { status: 200 as const, body: { success: true as const, data: health } };
});

export const healthRouter = buildContractRouter([getHealth], { mountPrefix: '/api' });
```

- [ ] **Step 4: Swap the mount in `app.ts`**

Replace:

```ts
// Health check
app.get('/api/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(successResponse(health));
});
```

with:

```ts
// Health check — first contract-driven route (M1 pilot)
app.use('/api', healthRouter);
```

Add `import { healthRouter } from './modules/health/health.module';` with the other imports, and remove the now-unused `getHealthStatus` / `successResponse` imports from `app.ts` **only if** nothing else in the file uses them (`grep -n "successResponse\|getHealthStatus" packages/server/src/app.ts` first — the 404 handler uses `errorResponse`, not these, but verify).

- [ ] **Step 5: Run the full characterization suite — the swap must be invisible**

Run: `npx jest -c jest.integration.config.js --runInBand`
Expected: all suites pass (health.itest pins 200 + `{success:true,data.status}`; the authz matrix pins anon/role access on `GET /api/health`; completeness pins discovery). If health.itest fails on body shape, the module handler drifted from the old inline handler — fix the handler, never the pin.

- [ ] **Step 6: Run unit suite + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: 379+ pass, clean typecheck.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/modules/health/health.module.ts packages/server/src/app.ts packages/server/src/__integration__/route-inventory.ts
git commit -m "feat(m1): swap GET /api/health to contract-driven routing (pilot proven)"
```

---

### Task 5: Typed client generator in shared

**Files:**
- Create: `packages/shared/src/contracts/client.ts`
- Modify: `packages/shared/src/index.ts` (one export line)
- Test: `packages/server/src/__tests__/contract-client.test.ts`

**Interfaces:**
- Consumes: `AnyRouteContract`, `ContractResponse`, `ContractBody`, `ContractParams`, `ContractQuery` (Task 1); contracts (Task 2).
- Produces: `createContractClient({ baseUrl, fetchImpl?, getToken? })` → `{ call(contract, args?) }`; `ContractClientError`. M9 (mobile migration) builds on this exact API.

- [ ] **Step 1: Write the failing test**

`packages/server/src/__tests__/contract-client.test.ts`:

```ts
import { authContracts, createContractClient, ContractClientError } from '@quran-review/shared';

type FetchArgs = { url: string; init: RequestInit };

function stubFetch(status: number, body: unknown, capture: FetchArgs[]) {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    capture.push({ url: String(url), init: init ?? {} });
    return {
      status,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
}

describe('createContractClient', () => {
  const loginBody = {
    message: 'Login successful',
    user: {
      id: 'u-1',
      email: 'a@b.c',
      role: 'student',
      firstName: 'A',
      lastName: 'B',
      status: 'active',
    },
    token: 't',
    refreshToken: 'r'.repeat(64),
  };

  it('builds URL/method/headers/body from the contract and parses the typed response', async () => {
    const calls: FetchArgs[] = [];
    const client = createContractClient({
      baseUrl: 'http://api.local',
      fetchImpl: stubFetch(200, loginBody, calls),
    });
    const res = await client.call(authContracts.login, { body: { email: 'a@b.c', password: 'pw' } });
    expect(calls[0].url).toBe('http://api.local/api/v1/auth/login');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: 'a@b.c', password: 'pw' });
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.body.user.role).toBe('student');
  });

  it('attaches Authorization header when getToken returns a token', async () => {
    const calls: FetchArgs[] = [];
    const client = createContractClient({
      baseUrl: 'http://api.local',
      fetchImpl: stubFetch(204, undefined, calls),
      getToken: () => 'jwt-123',
    });
    const res = await client.call(authContracts.logout);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-123');
    expect(res.status).toBe(204);
  });

  it('declared error statuses come back as typed results, not throws', async () => {
    const client = createContractClient({
      baseUrl: 'http://api.local',
      fetchImpl: stubFetch(401, { success: false, error: 'Invalid credentials' }, []),
    });
    const res = await client.call(authContracts.login, { body: { email: 'a@b.c', password: 'no' } });
    expect(res.status).toBe(401);
    if (res.status === 401) expect(res.body.error).toBe('Invalid credentials');
  });

  it('undeclared statuses throw ContractClientError', async () => {
    const client = createContractClient({
      baseUrl: 'http://api.local',
      fetchImpl: stubFetch(418, { success: false, error: 'teapot' }, []),
    });
    await expect(client.call(authContracts.login, { body: { email: 'a@b.c', password: 'x' } })).rejects.toBeInstanceOf(
      ContractClientError,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx jest --testPathPattern=contract-client`
Expected: FAIL — no export `createContractClient`.

- [ ] **Step 3: Write the client**

`packages/shared/src/contracts/client.ts`:

```ts
import { AnyRouteContract, ContractBody, ContractParams, ContractQuery, ContractResponse } from './types';

export class ContractClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Undeclared response status ${status}`);
    this.name = 'ContractClientError';
  }
}

export interface ContractClientOptions {
  /** Origin only, no trailing slash — contract paths are absolute (e.g. '/api/v1/auth/login'). */
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getToken?: () => string | null | undefined;
}

export interface CallArgs<C extends AnyRouteContract> {
  body?: ContractBody<C>;
  params?: ContractParams<C>;
  query?: ContractQuery<C>;
}

export function createContractClient(opts: ContractClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async call<C extends AnyRouteContract>(contract: C, args: CallArgs<C> = {}): Promise<ContractResponse<C>> {
      let path = contract.path;
      for (const [key, value] of Object.entries((args.params ?? {}) as Record<string, string>)) {
        path = path.replace(`:${key}`, encodeURIComponent(value));
      }
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries((args.query ?? {}) as Record<string, unknown>)) {
        if (value !== undefined) query.append(key, String(value));
      }
      const qs = query.toString().length > 0 ? `?${query.toString()}` : '';

      const headers: Record<string, string> = {};
      if (args.body !== undefined) headers['Content-Type'] = 'application/json';
      const token = opts.getToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await doFetch(`${opts.baseUrl}${path}${qs}`, {
        method: contract.method,
        headers,
        body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
      });

      const schema = (contract.responses as Record<number, { parse: (v: unknown) => unknown }>)[res.status];
      if (!schema) {
        const raw = await res.json().catch(() => undefined);
        throw new ContractClientError(res.status, raw);
      }
      const raw = res.status === 204 ? undefined : await res.json();
      return { status: res.status, body: schema.parse(raw) } as ContractResponse<C>;
    },
  };
}
```

Append to `packages/shared/src/index.ts`:

```ts
export * from './contracts/client';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx jest --testPathPattern=contract-client`
Expected: PASS (4 tests). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/contracts/client.ts packages/shared/src/index.ts packages/server/src/__tests__/contract-client.test.ts
git commit -m "feat(m1): typed contract client — URL building, auth header, per-status parsing"
```

---

### Task 6: Registry↔manifest parity gate + wrap-up

**Files:**
- Test: `packages/server/src/__integration__/registry-parity.itest.ts`
- Modify: `tasks/todo.md` (mark M1 done)

**Interfaces:**
- Consumes: `contractRegistry` (Task 2); `endpointManifest` (M0).
- Produces: the CI rule that a contract cannot drift from the manifest — M2+ swaps extend `contractRegistry` and this gate keeps them honest.

- [ ] **Step 1: Write the parity test**

`packages/server/src/__integration__/registry-parity.itest.ts`:

```ts
import { contractRegistry } from '@quran-review/shared';
import { endpointManifest } from './endpoint-manifest';

describe('contract registry ↔ endpoint manifest parity', () => {
  for (const contract of contractRegistry) {
    it(`${contract.method} ${contract.path} exists in the manifest with identical access`, () => {
      const entry = endpointManifest.find((e) => e.method === contract.method && e.path === contract.path);
      expect(entry).toBeDefined();
      // UserRole enum values are the same strings the manifest uses — deep-equal works.
      expect(entry!.access).toEqual(contract.access);
    });
  }

  it('registry entries are unique by method+path', () => {
    const keys = contractRegistry.map((c) => `${c.method} ${c.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest -c jest.integration.config.js --runInBand --testPathPattern=registry-parity`
Expected: PASS (10 tests: 9 contracts + uniqueness). If an access mismatch appears, re-read the route file — the manifest was verified against live behavior in M0, so correct the *contract*, not the manifest.

- [ ] **Step 3: Full final gate — both suites**

Run: `npx jest -c jest.integration.config.js --runInBand && npx jest && npx tsc --noEmit`
Expected: all integration suites pass (≈664 tests), all unit tests pass (≈390), typecheck clean.

- [ ] **Step 4: Mark M1 done**

In `tasks/todo.md`, under the REBUILD section, replace the line `- [ ] M1 contract layer — next: superpowers:writing-plans for M1.` with:

```markdown
- [x] M1 contract layer (date of completion) — contract DSL + 9 contracts (health + auth) + defineRoute/buildContractRouter + GET /api/health swapped to contract routing + typed client + registry↔manifest parity gate. Plan: `docs/superpowers/plans/2026-07-05-m1-contract-layer.md`.
- [ ] M2 identity module — rebuild auth + users onto defineRoute using the M1 auth contracts; port/retire `auth.controller.ts` and its unit tests. Next: `superpowers:writing-plans` for M2.
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/__integration__/registry-parity.itest.ts tasks/todo.md
git commit -m "test(m1): registry-manifest parity gate + mark M1 complete"
```

---

## Out of scope for M1 (deliberate)

- Swapping auth routing to contracts — M2 (identity rebuild) does it with the contracts shipped here; `auth.controller.ts` + `auth.controller.test.ts` stay untouched until then.
- Mobile adoption of the generated client — M9.
- Contracts for the remaining ~70 v1 endpoints — added milestone-by-milestone as each module is rebuilt (M3–M8).
- OpenAPI/docs generation from contracts — nice-to-have, revisit at M13.
- Enforcing "every endpoint must have a contract" — impossible until all modules are swapped; the registry-parity gate (Task 6) is the M1-appropriate version.
