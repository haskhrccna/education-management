# M0 — Characterization Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a black-box integration test harness (real Postgres, supertest HTTP, seed factory, full endpoint × role authorization matrix, CI gate) that pins the current server's externally observable behavior before any rebuild work starts.

**Architecture:** A second Jest project (`jest.integration.config.js`) that boots the real `app.ts` against a dedicated throwaway Postgres (port 5433, tmpfs). No Prisma mocks. A checked-in endpoint manifest is verified for completeness against a source parser, then driven through supertest as an authorization matrix. Spec: `docs/superpowers/specs/2026-07-04-rebuild-10x-design.md`, milestone M0.

**Tech Stack:** Jest 30 + ts-jest, supertest 7 (already installed), postgres:17-alpine via docker compose, Prisma 6 (`db push` for schema), jsonwebtoken, bcryptjs.

## Global Constraints

- All new files live in `packages/server` (tests under `src/__integration__/`); do not touch `mobile/` or `packages/shared/`.
- Integration test files use suffix `.itest.ts` so the existing unit config (`testMatch: **/__tests__/**/*.test.ts`) never picks them up, and vice versa.
- The existing 358 unit tests must still pass after every task: `cd packages/server && npm test`.
- Integration env: `NODE_ENV=test`, `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/quran_review_test` (override via `TEST_DATABASE_URL`), `JWT_SECRET=integration-test-secret-0123456789abcdef0123456789abcdef`.
- Never point tests at port 5432 — that is the dev database.
- The only production-code change allowed in M0 is the rate-limiter `skip` in Task 1. Everything else observes; it does not modify.
- JWT payload shape (from `auth.service.ts:19`): `jwt.sign({ userId, role }, config.jwtSecret, ...)` — role UPPERCASE.
- Error envelope (from `lib/response.ts`): success `{ success: true, data, meta? }`, error `{ success: false, error }`. Role-gate rejection is exactly `403` + `error: 'Insufficient permissions'` (`auth.middleware.ts:66`).
- All commits on the current working branch; message prefix `test(m0):` (or `ci(m0):` where noted).

---

### Task 1: Integration infrastructure — test DB, Jest project, health smoke test

**Files:**
- Create: `packages/server/docker-compose.test.yml`
- Create: `packages/server/jest.integration.config.js`
- Create: `packages/server/src/__integration__/env.ts`
- Create: `packages/server/src/__integration__/global-setup.ts`
- Create: `packages/server/src/__integration__/db.ts`
- Modify: `packages/server/src/middleware/rate-limit.middleware.ts` (add `skip` to all 6 limiters)
- Modify: `packages/server/package.json` (scripts)
- Test: `packages/server/src/__integration__/health.itest.ts`

**Interfaces:**
- Consumes: existing `app.ts` default export; existing `prisma` singleton (`src/prisma/client.ts`).
- Produces: `truncateAll(): Promise<void>` and `disconnect(): Promise<void>` from `./db` — every later task calls these; npm scripts `test:integration`, `test:integration:down`.

- [ ] **Step 1: Create the throwaway test database compose file**

`packages/server/docker-compose.test.yml`:

```yaml
services:
  db-test:
    image: postgres:17-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=quran_review_test
    ports:
      - '5433:5432'
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d quran_review_test']
      interval: 2s
      timeout: 2s
      retries: 15
```

- [ ] **Step 2: Create the integration Jest config**

`packages/server/jest.integration.config.js`:

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__integration__/**/*.itest.ts'],
  moduleNameMapper: {
    '^@edu/shared$': '<rootDir>/../shared/src/index.ts',
    '^@quran-review/shared$': '<rootDir>/../shared/src/index.ts',
  },
  setupFiles: ['<rootDir>/src/__integration__/env.ts'],
  globalSetup: '<rootDir>/src/__integration__/global-setup.ts',
  testTimeout: 30000,
  maxWorkers: 1,
};
```

(`setupFiles` — not `setupFilesAfterEach` — so env vars are set before `config/index.ts` runs its `requireEnv('DATABASE_URL')` at import time. `maxWorkers: 1` because all suites share one database.)

- [ ] **Step 3: Create env bootstrap and global setup**

`packages/server/src/__integration__/env.ts`:

```ts
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/quran_review_test';
process.env.JWT_SECRET = 'integration-test-secret-0123456789abcdef0123456789abcdef';
```

`packages/server/src/__integration__/global-setup.ts`:

```ts
import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/quran_review_test';
  execSync('npx prisma db push --force-reset --skip-generate', {
    cwd: path.join(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
```

- [ ] **Step 4: Create the DB helper**

`packages/server/src/__integration__/db.ts`:

```ts
import { prisma } from '../prisma/client';

/** Wipe all app tables between suites/tests. Keeps the schema; resets identities. */
export async function truncateAll(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%'`;
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`
  );
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
```

- [ ] **Step 5: Disable rate limiting under NODE_ENV=test**

In `packages/server/src/middleware/rate-limit.middleware.ts`, add this line to the options object of **all six** limiters (`standardLimiter`, `authLimiter`, `adminLimiter`, `uploadLimiter`, `broadcastLimiter`, `passwordResetLimiter`):

```ts
  skip: () => process.env.NODE_ENV === 'test',
```

(The authz matrix in Task 4 fires ~600 requests in one 15-minute window; production and development behavior are unchanged.)

- [ ] **Step 6: Add npm scripts**

In `packages/server/package.json` `"scripts"`, add:

```json
"test:integration": "docker compose -f docker-compose.test.yml up -d --wait && jest -c jest.integration.config.js --runInBand",
"test:integration:down": "docker compose -f docker-compose.test.yml down -v"
```

- [ ] **Step 7: Write the smoke test**

`packages/server/src/__integration__/health.itest.ts`:

```ts
import request from 'supertest';
import app from '../app';
import { disconnect } from './db';

afterAll(disconnect);

describe('GET /api/health', () => {
  it('returns 200 with the success envelope', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(['healthy', 'degraded']).toContain(res.body.data.status);
  });
});

describe('rate limiting in test env', () => {
  it('does not 429 on 12 rapid login attempts', async () => {
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@itest.local', password: 'WrongPass1!' });
      expect(res.status).not.toBe(429);
    }
  });
});
```

- [ ] **Step 8: Run — verify it fails before the DB is up, passes after**

Run without the container (proves it hits a real DB, not a mock):
`cd packages/server && npx jest -c jest.integration.config.js`
Expected: FAIL — `prisma db push` cannot reach localhost:5433.

Then: `npm run test:integration`
Expected: PASS — health 200 envelope + no 429s.

- [ ] **Step 9: Verify unit suite untouched**

Run: `npm test`
Expected: 358 passed (rate-limiter `skip` is inert outside NODE_ENV=test; unit config still matches only `*.test.ts`).

- [ ] **Step 10: Commit**

```bash
git add packages/server/docker-compose.test.yml packages/server/jest.integration.config.js packages/server/src/__integration__/ packages/server/src/middleware/rate-limit.middleware.ts packages/server/package.json
git commit -m "test(m0): integration harness — real-Postgres jest project + health smoke test"
```

---

### Task 2: Seed factory + auth helpers

**Files:**
- Create: `packages/server/src/__integration__/factory.ts`
- Test: `packages/server/src/__integration__/factory.itest.ts`

**Interfaces:**
- Consumes: `truncateAll`/`disconnect` from `./db` (Task 1).
- Produces: `createUser(opts: { role: Role; status?: UserStatus; email?: string; password?: string }): Promise<TestUser>` where `TestUser = { id: string; email: string; role: Role; token: string }`; `tokenFor(userId: string, role: Role): string`. Tasks 4–5 and all later milestones depend on these exact signatures.

- [ ] **Step 1: Write the failing test**

`packages/server/src/__integration__/factory.itest.ts`:

```ts
import request from 'supertest';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';
import { Role, UserStatus } from '@prisma/client';

beforeAll(truncateAll);
afterAll(disconnect);

describe('seed factory + JWT auth', () => {
  it('factory user token authenticates against GET /api/v1/users/profile', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(JSON.stringify(res.body)).toContain(student.email);
  });

  it('BANNED user is rejected with 401', async () => {
    const banned = await createUser({ role: Role.STUDENT, status: UserStatus.BANNED });
    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${banned.token}`);
    expect(res.status).toBe(401);
  });

  it('missing token is rejected with 401', async () => {
    const res = await request(app).get('/api/v1/users/profile');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && docker compose -f docker-compose.test.yml up -d --wait && npx jest -c jest.integration.config.js -t 'seed factory'`
Expected: FAIL — `Cannot find module './factory'`.

- [ ] **Step 3: Write the factory**

`packages/server/src/__integration__/factory.ts`:

```ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../prisma/client';
import { config } from '../config';

export interface TestUser {
  id: string;
  email: string;
  role: Role;
  token: string;
}

let seq = 0;

/** Mint a JWT exactly like auth.service.ts does: { userId, role } signed with config.jwtSecret. */
export function tokenFor(userId: string, role: Role): string {
  return jwt.sign({ userId, role }, config.jwtSecret, { expiresIn: '1h' });
}

export async function createUser(opts: {
  role: Role;
  status?: UserStatus;
  email?: string;
  password?: string;
}): Promise<TestUser> {
  const email = opts.email ?? `itest-${opts.role.toLowerCase()}-${++seq}-${Date.now()}@itest.local`;
  const passwordHash = await bcrypt.hash(opts.password ?? 'Test1234!', 4); // low cost: test speed
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: opts.role,
      firstName: 'Itest',
      lastName: opts.role,
      status: opts.status ?? UserStatus.ACTIVE,
    },
  });
  return { id: user.id, email: user.email, role: user.role, token: tokenFor(user.id, user.role) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest -c jest.integration.config.js -t 'seed factory'`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/__integration__/factory.ts packages/server/src/__integration__/factory.itest.ts
git commit -m "test(m0): seed factory + JWT helper for integration tests"
```

---

### Task 3: Endpoint manifest + completeness check

**Files:**
- Create: `packages/server/src/__integration__/route-inventory.ts`
- Create: `packages/server/src/__integration__/endpoint-manifest.ts`
- Test: `packages/server/src/__integration__/completeness.itest.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure source analysis; no DB).
- Produces: `endpointManifest: EndpointSpec[]` with types `EndpointSpec { method: HttpMethod; path: string; access: Access; skip?: string }`, `Access = 'public' | 'authenticated' | RoleName[]` — consumed by Task 4; `discoverEndpoints(): { method: string; path: string }[]`.

- [ ] **Step 1: Write the failing completeness test**

`packages/server/src/__integration__/completeness.itest.ts`:

```ts
import { discoverEndpoints } from './route-inventory';
import { endpointManifest } from './endpoint-manifest';

describe('endpoint manifest completeness', () => {
  it('every discovered endpoint is in the manifest, and vice versa', () => {
    const discovered = new Set(discoverEndpoints().map((e) => `${e.method} ${e.path}`));
    const manifest = new Set(endpointManifest.map((e) => `${e.method} ${e.path}`));
    const missingFromManifest = [...discovered].filter((k) => !manifest.has(k)).sort();
    const staleInManifest = [...manifest].filter((k) => !discovered.has(k)).sort();
    expect(missingFromManifest).toEqual([]);
    expect(staleInManifest).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the source-based route inventory**

`packages/server/src/__integration__/route-inventory.ts`:

```ts
import fs from 'fs';
import path from 'path';

export interface DiscoveredEndpoint {
  method: string; // UPPERCASE
  path: string; // full URL path, params as :name
}

const ROUTES_DIR = path.join(__dirname, '../routes');
const APP_FILE = path.join(__dirname, '../app.ts');

/** Endpoint definitions per router variable inside one route file. */
function parseRouteFile(file: string): Record<string, { method: string; sub: string }[]> {
  const src = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
  const byRouter: Record<string, { method: string; sub: string }[]> = {};
  const re = /(\w+)\.(get|post|put|patch|delete)\s*\(\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const [, routerVar, method, sub] = m;
    (byRouter[routerVar] ??= []).push({ method, sub });
  }
  return byRouter;
}

export function discoverEndpoints(): DiscoveredEndpoint[] {
  const appSrc = fs.readFileSync(APP_FILE, 'utf8');

  // Map import identifier -> route file ("authRoutes" -> "auth.routes.ts"; named imports too).
  const importMap: Record<string, string> = {};
  const importRe = /import\s+(?:(\w+)|\{([^}]+)\})\s+from\s+'\.\/routes\/([\w.]+)'/g;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(appSrc))) {
    const [, def, named, file] = im;
    if (def) importMap[def] = `${file}.ts`;
    if (named) for (const n of named.split(',').map((s) => s.trim())) importMap[n] = `${file}.ts`;
  }

  const endpoints: DiscoveredEndpoint[] = [];

  // Mounted routers: app.use('<mount>', ...middleware, <routerVar>);
  const mountRe = /app\.use\(\s*'([^']+)'\s*,[^;]*?(\w+)\s*\);/g;
  let mm: RegExpExecArray | null;
  while ((mm = mountRe.exec(appSrc))) {
    const [, mount, routerVar] = mm;
    const file = importMap[routerVar];
    if (!file) continue; // app.use with inline handler or bare middleware
    const byRouter = parseRouteFile(file);
    // Default-export files declare `const router = Router()`; named exports match the import name.
    const defs = byRouter[routerVar] ?? byRouter['router'] ?? [];
    for (const d of defs) {
      endpoints.push({ method: d.method.toUpperCase(), path: mount + (d.sub === '/' ? '' : d.sub) });
    }
  }

  // Inline app-level endpoints (e.g. GET /api/health).
  const inlineRe = /app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
  let il: RegExpExecArray | null;
  while ((il = inlineRe.exec(appSrc))) {
    endpoints.push({ method: il[1].toUpperCase(), path: il[2] });
  }

  // Dedup (docs router is mounted in both branches of an env conditional).
  const seen = new Set<string>();
  return endpoints
    .filter((e) => {
      const k = `${e.method} ${e.path}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}
```

- [ ] **Step 3: Write the checked-in manifest**

`packages/server/src/__integration__/endpoint-manifest.ts` — v1 surface written out in full (access values transcribed from each route file's `authorize(...)` calls and `router.use` guards); legacy `/api/*` mirrors derived:

```ts
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Access = 'public' | 'authenticated' | ('STUDENT' | 'TEACHER' | 'ADMIN' | 'PARENT')[];

export interface EndpointSpec {
  method: HttpMethod;
  path: string;
  access: Access;
  /** Excluded from the authz matrix with a reason (still counted for completeness). */
  skip?: string;
}

const v1: EndpointSpec[] = [
  // auth
  { method: 'POST', path: '/api/v1/auth/register', access: 'public' },
  { method: 'POST', path: '/api/v1/auth/login', access: 'public' },
  { method: 'POST', path: '/api/v1/auth/refresh', access: 'public' },
  { method: 'POST', path: '/api/v1/auth/logout', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/auth/verify-email', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/auth/resend-verification', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/auth/forgot-password', access: 'public' },
  { method: 'POST', path: '/api/v1/auth/reset-password', access: 'public' },
  // users
  { method: 'GET', path: '/api/v1/users/profile', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/users/teachers', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/users/profile', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/users/change-password', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/users/device-token', access: 'authenticated' },
  // appointments
  { method: 'GET', path: '/api/v1/appointments', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/appointments', access: ['STUDENT'] },
  { method: 'PUT', path: '/api/v1/appointments/:id', access: ['TEACHER', 'ADMIN'] },
  { method: 'POST', path: '/api/v1/appointments/:id/attendance', access: ['TEACHER'] },
  // grades
  { method: 'GET', path: '/api/v1/grades', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/grades', access: ['TEACHER'] },
  { method: 'GET', path: '/api/v1/grades/student/:id', access: ['TEACHER', 'ADMIN'] },
  // recordings
  { method: 'POST', path: '/api/v1/recordings', access: ['STUDENT'] },
  { method: 'GET', path: '/api/v1/recordings', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/recordings/:id', access: ['TEACHER', 'ADMIN'] },
  { method: 'DELETE', path: '/api/v1/recordings/:id', access: ['TEACHER', 'ADMIN'] },
  // reports
  { method: 'POST', path: '/api/v1/reports', access: ['TEACHER'] },
  { method: 'GET', path: '/api/v1/reports', access: ['TEACHER', 'ADMIN', 'STUDENT'] },
  // admin (router.use(authorize(ADMIN)))
  { method: 'GET', path: '/api/v1/admin/users', access: ['ADMIN'] },
  { method: 'POST', path: '/api/v1/admin/teachers', access: ['ADMIN'] },
  { method: 'PUT', path: '/api/v1/admin/users/:id/approve', access: ['ADMIN'] },
  { method: 'PUT', path: '/api/v1/admin/users/:id/deactivate', access: ['ADMIN'] },
  { method: 'GET', path: '/api/v1/admin/users/:id', access: ['ADMIN'] },
  { method: 'PUT', path: '/api/v1/admin/users/:id', access: ['ADMIN'] },
  { method: 'DELETE', path: '/api/v1/admin/users/:id', access: ['ADMIN'] },
  { method: 'GET', path: '/api/v1/admin/progress/teachers', access: ['ADMIN'] },
  { method: 'GET', path: '/api/v1/admin/progress/students', access: ['ADMIN'] },
  { method: 'POST', path: '/api/v1/admin/broadcast', access: ['ADMIN'] },
  { method: 'POST', path: '/api/v1/admin/bulk/approve', access: ['ADMIN'] },
  { method: 'POST', path: '/api/v1/admin/bulk/deactivate', access: ['ADMIN'] },
  // messages
  { method: 'GET', path: '/api/v1/messages', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/messages', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/messages/:id/read', access: 'authenticated' },
  // surahs + memorization
  { method: 'GET', path: '/api/v1/surahs', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/memorization', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/memorization/:surahId', access: ['TEACHER'] },
  // files (fileAuthenticate: Bearer header OR ?token=)
  { method: 'GET', path: '/api/v1/files/recordings/:id', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/files/reports/:id', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/files/certificates/:id', access: 'authenticated' },
  // exports
  { method: 'GET', path: '/api/v1/exports/grades', access: ['TEACHER', 'ADMIN'] },
  { method: 'GET', path: '/api/v1/exports/appointments', access: ['TEACHER', 'ADMIN'] },
  { method: 'GET', path: '/api/v1/exports/users', access: ['ADMIN'] },
  // teacher-changes
  { method: 'POST', path: '/api/v1/teacher-changes', access: ['STUDENT'] },
  { method: 'GET', path: '/api/v1/teacher-changes', access: ['ADMIN', 'TEACHER', 'STUDENT'] },
  { method: 'PATCH', path: '/api/v1/teacher-changes/:id', access: ['ADMIN'] },
  // revisions
  { method: 'GET', path: '/api/v1/revisions', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/revisions', access: ['TEACHER'] },
  { method: 'PUT', path: '/api/v1/revisions/:id', access: ['STUDENT', 'TEACHER'] },
  { method: 'DELETE', path: '/api/v1/revisions/:id', access: ['STUDENT', 'TEACHER', 'ADMIN'] },
  // notifications
  { method: 'GET', path: '/api/v1/notifications', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/notifications/read-all', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/notifications/unread-count', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/notifications/:id/read', access: 'authenticated' },
  // attendance
  { method: 'GET', path: '/api/v1/attendance', access: 'authenticated' },
  // parents
  { method: 'POST', path: '/api/v1/parents/links', access: ['PARENT'] },
  { method: 'GET', path: '/api/v1/parents/links', access: ['PARENT', 'ADMIN'] },
  { method: 'GET', path: '/api/v1/parents/children', access: ['PARENT'] },
  { method: 'GET', path: '/api/v1/parents/student-search', access: ['PARENT'] },
  { method: 'GET', path: '/api/v1/parents/children/:studentId/dashboard', access: ['PARENT'] },
  { method: 'PATCH', path: '/api/v1/parents/links/:id/decision', access: ['ADMIN'] },
  // gamification
  { method: 'GET', path: '/api/v1/gamification/me', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/gamification/leaderboard', access: 'authenticated' },
  // analytics (router.use(authorize(ADMIN)))
  { method: 'GET', path: '/api/v1/analytics', access: ['ADMIN'] },
  // certificates
  { method: 'GET', path: '/api/v1/certificates', access: 'authenticated' },
  // halaqa
  { method: 'GET', path: '/api/v1/halaqa', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/halaqa', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/halaqa/:id', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/halaqa/:id/start', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/halaqa/:id/end', access: 'authenticated' },
];

const topLevel: EndpointSpec[] = [
  { method: 'GET', path: '/api/health', access: 'public' },
  // NODE_ENV=test mounts docs behind authenticate+authorize(ADMIN) (public only in development)
  { method: 'GET', path: '/api/docs', access: ['ADMIN'] },
  { method: 'GET', path: '/metrics', access: ['ADMIN'] },
];

/** Legacy /api/* mounts in app.ts that mirror /api/v1/* with identical middleware. */
const LEGACY_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/users',
  '/api/v1/appointments',
  '/api/v1/grades',
  '/api/v1/recordings',
  '/api/v1/reports',
  '/api/v1/admin',
  '/api/v1/messages',
  '/api/v1/files',
  '/api/v1/exports',
];

const legacy: EndpointSpec[] = v1
  .filter((e) => LEGACY_PREFIXES.some((p) => e.path === p || e.path.startsWith(`${p}/`)))
  .map((e) => ({ ...e, path: e.path.replace('/api/v1/', '/api/') }));

export const endpointManifest: EndpointSpec[] = [...v1, ...topLevel, ...legacy];
```

- [ ] **Step 4: Run the completeness test**

Run: `cd packages/server && npx jest -c jest.integration.config.js -t 'completeness'`
Expected: PASS with both diff arrays empty. If it fails, the diff output lists exactly which endpoints the parser found that the manifest lacks (or vice versa) — **fix the manifest to match reality, never the reverse**, unless the parser itself mis-parsed (verify any discrepancy against the actual route file before editing). Expected totals: 77 v1 route-file endpoints + 3 top-level + 47 legacy mirrors = 127 manifest entries.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/__integration__/route-inventory.ts packages/server/src/__integration__/endpoint-manifest.ts packages/server/src/__integration__/completeness.itest.ts
git commit -m "test(m0): endpoint manifest (127 endpoints) + source-parity completeness check"
```

---

### Task 4: Authorization matrix — every endpoint × every identity

**Files:**
- Test: `packages/server/src/__integration__/authz-matrix.itest.ts`
- Modify (annotations only, if triage requires): `packages/server/src/__integration__/endpoint-manifest.ts`

**Interfaces:**
- Consumes: `endpointManifest`, `EndpointSpec` (Task 3); `createUser` (Task 2); `truncateAll`, `disconnect` (Task 1).
- Produces: the CI-enforced authorization contract used by every rebuild milestone (M2–M8) as its safety net.

- [ ] **Step 1: Write the matrix test**

`packages/server/src/__integration__/authz-matrix.itest.ts`:

```ts
import request from 'supertest';
import app from '../app';
import { Role } from '@prisma/client';
import { endpointManifest, EndpointSpec } from './endpoint-manifest';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

const FAKE_ID = '00000000-0000-0000-0000-000000000000';
const ROLES: Role[] = [Role.STUDENT, Role.TEACHER, Role.PARENT, Role.ADMIN];
type Identity = Role | 'anon';
const IDENTITIES: Identity[] = ['anon', ...ROLES];

const tokens: Partial<Record<Role, string>> = {};

beforeAll(async () => {
  await truncateAll();
  for (const role of ROLES) tokens[role] = (await createUser({ role })).token;
});
afterAll(disconnect);

const urlFor = (spec: EndpointSpec) => spec.path.replace(/:[A-Za-z]+/g, FAKE_ID);

function isAllowed(spec: EndpointSpec, id: Identity): boolean {
  if (spec.access === 'public') return true;
  if (id === 'anon') return false;
  if (spec.access === 'authenticated') return true;
  return (spec.access as string[]).includes(id);
}

describe('authorization matrix', () => {
  for (const spec of endpointManifest) {
    if (spec.skip) continue;
    for (const id of IDENTITIES) {
      const allowed = isAllowed(spec, id);
      it(`${spec.method} ${spec.path} — ${id}: ${allowed ? 'passes authz' : 'rejected'}`, async () => {
        const method = spec.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
        let req = request(app)[method](urlFor(spec));
        if (id !== 'anon') req = req.set('Authorization', `Bearer ${tokens[id as Role]}`);
        if (method !== 'get' && method !== 'delete') req = req.send({});
        const res = await req;
        if (!allowed) {
          if (id === 'anon') {
            expect(res.status).toBe(401);
          } else {
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Insufficient permissions');
          }
        } else {
          // Authz cleared: any downstream outcome (200/400/404/resource-level 403) is fine,
          // as long as it is not an auth failure or the role-gate rejection.
          expect(res.status).not.toBe(401);
          expect(res.status === 403 && res.body.error === 'Insufficient permissions').toBe(false);
        }
      });
    }
  }
});
```

- [ ] **Step 2: Run — triage, don't force**

Run: `cd packages/server && npm run test:integration`
Expected: ~635 matrix tests run; target PASS. For each failure, diagnose in this order:
1. **Manifest annotation wrong** (most likely) — re-read the route file and its `router.use(...)` guards; correct the `access` value in `endpoint-manifest.ts`.
2. **Endpoint genuinely misbehaves under an empty body or fake ID** (e.g. a 500) — do **not** change server code in M0; add `skip: '<one-line reason + observed status>'` to that entry so the fact is recorded, and list every skip in the commit message. Skips become explicit work items for that module's rebuild milestone.
3. Never weaken the shared assertions to make one endpoint pass.

- [ ] **Step 3: Run the full integration + unit suites**

Run: `npm run test:integration && npm test`
Expected: both green (unit: 358 passed).

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/__integration__/authz-matrix.itest.ts packages/server/src/__integration__/endpoint-manifest.ts
git commit -m "test(m0): authz matrix — 127 endpoints x 5 identities pinned"
```

---

### Task 5: Response envelope + error-shape characterization

**Files:**
- Test: `packages/server/src/__integration__/envelope.itest.ts`

**Interfaces:**
- Consumes: `createUser` (Task 2); `truncateAll`, `disconnect` (Task 1).
- Produces: pinned envelope shapes the M1 contract DSL must reproduce exactly.

- [ ] **Step 1: Write the test**

`packages/server/src/__integration__/envelope.itest.ts`:

```ts
import request from 'supertest';
import app from '../app';
import { Role } from '@prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

const FAKE_ID = '00000000-0000-0000-0000-000000000000';

beforeAll(truncateAll);
afterAll(disconnect);

describe('response envelope characterization', () => {
  it('unknown route → 404 with { success: false, error: "Not found" }', async () => {
    const res = await request(app).get('/api/v1/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Not found' });
  });

  it('validation failure → 400 with { success: false, error: <string> }', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });

  it('auth failure → 401 with { success: false, error: <string> }', async () => {
    const res = await request(app).get('/api/v1/users/profile');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });

  it('success → { success: true, data: ... } with no error key', async () => {
    const user = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).not.toHaveProperty('error');
  });

  it('file download accepts JWT via ?token= query param (contract from CLAUDE.md)', async () => {
    const user = await createUser({ role: Role.STUDENT });
    // Nonexistent file id: asserts the auth path only — 401 without token, non-401 with it.
    const anon = await request(app).get(`/api/v1/files/recordings/${FAKE_ID}`);
    expect(anon.status).toBe(401);
    const withToken = await request(app).get(`/api/v1/files/recordings/${FAKE_ID}?token=${user.token}`);
    expect(withToken.status).not.toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify actual behavior; pin what is observed**

Run: `cd packages/server && npx jest -c jest.integration.config.js -t 'envelope'`
Expected: PASS. If an assertion fails because reality differs (e.g. the 404 body carries a `meta` key), **update the assertion to pin the observed value** — this suite documents current behavior, it does not judge it. Record any surprise as a comment above the assertion.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/__integration__/envelope.itest.ts
git commit -m "test(m0): pin response envelope, 404/400/401 shapes, ?token= file auth"
```

---

### Task 6: CI gate

**Files:**
- Modify: `.github/workflows/ci.yml` (append job)
- Modify: `tasks/todo.md` (mark M0 done)

**Interfaces:**
- Consumes: the integration Jest project from Task 1 (CI uses a Postgres service container instead of docker compose).
- Produces: a required `integration` CI job that every later milestone runs against.

- [ ] **Step 1: Read the existing workflow**

Run: `cat .github/workflows/ci.yml` — note the Node version and install pattern used by existing jobs and reuse them (replace `node-version: 20` below if existing jobs pin a different version).

- [ ] **Step 2: Append the integration job**

Add under `jobs:` in `.github/workflows/ci.yml` (indentation matched to sibling jobs):

```yaml
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: quran_review_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
        working-directory: packages/server
      - run: npx jest -c jest.integration.config.js --runInBand
        working-directory: packages/server
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5433/quran_review_test
```

(Schema push happens inside the suite's `global-setup.ts`, so the job needs no separate migrate step.)

- [ ] **Step 3: Validate the workflow YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"`
Expected: `ok`.

- [ ] **Step 4: Final full local run**

Run: `cd packages/server && npm run test:integration && npm test && npm run test:integration:down`
Expected: all integration suites green, unit 358 passed, test DB torn down.

- [ ] **Step 5: Mark M0 complete in the tracker**

In `tasks/todo.md`, under the "REBUILD 10x" section, append:

```markdown
- [x] M0 characterization harness — integration DB + supertest + factory + 127-endpoint authz matrix + envelope pinning + CI gate (all suites green)
```

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml tasks/todo.md
git commit -m "ci(m0): integration test job with postgres service — rebuild safety net armed"
```

---

## Out of scope for M0 (deliberate)

- Behavioral scenario tests (teacher-change side effects, messages dual shape, SM-2, queue fallback) — each is pinned in the milestone that rebuilds its module (M3, M6, M4, M6 respectively), immediately before that rebuild.
- Socket.io/halaqa event tests — M8.
- Mobile MSW harness — M9.
- Any production-code change beyond the rate-limiter `skip`.
