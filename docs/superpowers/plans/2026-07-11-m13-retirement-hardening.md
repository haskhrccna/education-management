# M13 Retirement & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (session precedent: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the legacy `/api/*` mirror mounts (mobile is fully on `/api/v1`), sweep now-dead code, add a repeatable load-test script with local perf budgets, and close the rebuild with a written security review.

**Architecture:** The mirrors were kept alive through M0–M12 solely so the un-migrated mobile app kept working; M9–M12 removed that dependency (axios baseURL is `/api/v1`, contract client uses canonical paths). Retirement is a coordinated four-place deletion — app.ts mounts, `endpoint-manifest.ts`'s `LEGACY_PREFIXES`+`legacy` derivation, `route-inventory.ts`'s `CONTRACT_MIRRORS`, and the handful of explicit legacy-mirror pins in five itest suites — after which the authz matrix shrinks from 127 to 80 endpoints by design. Load testing runs in-process (an `app.listen(0)` against the docker test DB) via autocannon so no server/daemon orchestration is needed. The security review is a written checklist-driven report; fixes only for findings rated High.

**Tech Stack:** Express 5 · autocannon (new server devDep) · ts-node · existing integration harness env (`src/__integration__/env.ts` wires NODE_ENV=test, the 5433 test DB, and a fixed JWT secret).

## Context

Spec §5: M13 = "Retirement & hardening — delete legacy `/api/*` mounts + dead code, load test, perf budgets, final security review". The app.ts comment on the mirror block has said "remove after mobile update" since before M0; that update is complete. Deleting mirrors is a deliberate, user-approved API-surface change — the one time in this rebuild we change pinned behavior on purpose, so the pins that assert the mirrors exist are deleted in the same commit as the mounts.

## Global Constraints

- The v1 surface must be untouched: after retirement, the FULL itest suite passes with counts shrinking only by the removed mirror coverage (47 matrix endpoints × 5 identities + 8 explicit mirror pins).
- Mobile gate unchanged (tsc 0) — no mobile files change in M13.
- Load-test budgets are LOCAL BASELINES (documented as such), asserted loosely enough to be stable: p95 ≤ 150ms for `GET /api/health`, p95 ≤ 400ms for an authenticated read, error rate 0.
- Security fixes in-milestone only for High severity; Medium/Low go into the report as recommendations.
- Branch `feat/rebuild-m13`; commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; no `-n` near `git commit`.

## Retirement inventory (all references to legacy mirrors)

- `src/app.ts:127-137` — the "Legacy redirects" comment + 10 mounts (auth, users, appointments, grades, recordings, reports, admin, messages, files, exports).
- `src/__integration__/endpoint-manifest.ts` — `LEGACY_PREFIXES` array + `const legacy` derivation + `...legacy` spread (manifest 127→80).
- `src/__integration__/route-inventory.ts` — the `CONTRACT_MIRRORS` map + its loop body (keep the plain `endpoints.push({method,path})` per contract).
- Explicit itest pins: `auth-flows.itest.ts` (legacy /api/auth case), `users-flows.itest.ts` (3 refs), `learning-flows.itest.ts` (legacy mirror case), `media-flows.itest.ts` (the `legacy /api/* mirrors` describe block, 3 tests), `communication-flows.itest.ts` (legacy mirror test).

## File Structure

**Create**
- `packages/server/scripts/loadtest.ts` — in-process autocannon run + budget assertions
- `docs/security/2026-07-11-m13-security-review.md` — the final review report

**Modify**
- `packages/server/src/app.ts`, `endpoint-manifest.ts`, `route-inventory.ts`, the five itest files above
- `packages/server/package.json` — autocannon devDep + `"perf": "ts-node scripts/loadtest.ts"`
- `tasks/todo.md`

**Delete** — nothing beyond the in-file removals; docs/metrics/verify utility routers stay (mounted, tested, not legacy business surface).

---

### Task 0: Branch + plan
- [ ] `git checkout -b feat/rebuild-m13`; commit plan: `docs(m13): retirement & hardening plan`

### Task 1: Retire the legacy mirrors (single atomic commit)
- [ ] app.ts: delete lines 126-137 (comment + 10 mounts).
- [ ] endpoint-manifest.ts: delete `LEGACY_PREFIXES`, the `legacy` const, and its spread; `endpointManifest = [...v1, ...topLevel]`.
- [ ] route-inventory.ts: delete `CONTRACT_MIRRORS` and its inner loop; keep `endpoints.push({ method: c.method, path: c.path })`.
- [ ] Delete the explicit legacy pins in the five itest files (whole `it(...)`/`describe(...)` blocks that hit non-v1 `/api/<domain>` paths).
- [ ] Full itest suite: expect roughly 1113 minus the mirror coverage; ALL GREEN, zero failures. Unit suite + tsc server/shared unchanged.
- [ ] Commit `feat(m13)!: retire legacy /api/* mirrors — mobile is fully on /api/v1`

### Task 2: Dead-code sweep (evidence-based)
- [ ] `successResponse` (lib/response.ts): grep shows no production callers since M8 (only itests import it) — if confirmed, keep `errorResponse` (404 handler) and delete `successResponse`, updating the importing itests to inline the envelope literal. If any production caller remains, leave it and note why.
- [ ] Sweep for other unused exports in `src/lib` and `src/middleware`, cross-checked against usages; delete only zero-reference exports. No speculative deletions.
- [ ] Suites + tsc green. Commit `chore(m13): dead-code sweep after strangler completion`

### Task 3: Load test + perf budgets
- [ ] `npm install --save-dev autocannon @types/autocannon -w packages/server`
- [ ] `packages/server/scripts/loadtest.ts`:

```ts
import '../src/__integration__/env';
import http from 'http';
import { AddressInfo } from 'net';
import autocannon from 'autocannon';
import { Role } from '@prisma/client';
import app from '../src/app';
import { createUser } from '../src/__integration__/factory';
import { truncateAll, disconnect } from '../src/__integration__/db';

const BUDGETS = { healthP95: 150, readP95: 400 }; // ms — LOCAL baselines

async function run() {
  await truncateAll();
  const student = await createUser({ role: Role.STUDENT });
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const health = await autocannon({ url: `${origin}/api/health`, duration: 10, connections: 20 });
  const reads = await autocannon({
    url: `${origin}/api/v1/grades`,
    duration: 10,
    connections: 20,
    headers: { Authorization: `Bearer ${student.token}` },
  });

  const p95 = (r: autocannon.Result) => r.latency.p97_5 ?? r.latency.p99;
  console.log(`health: p95≈${p95(health)}ms rps=${Math.round(health.requests.average)} errors=${health.errors}`);
  console.log(`grades: p95≈${p95(reads)}ms rps=${Math.round(reads.requests.average)} errors=${reads.errors}`);

  const failures: string[] = [];
  if (health.errors > 0 || reads.errors > 0) failures.push('non-zero error count');
  if (p95(health) > BUDGETS.healthP95) failures.push(`health p95 > ${BUDGETS.healthP95}ms`);
  if (p95(reads) > BUDGETS.readP95) failures.push(`read p95 > ${BUDGETS.readP95}ms`);

  await new Promise<void>((r) => server.close(() => r()));
  await disconnect();
  if (failures.length) {
    console.error('PERF BUDGET FAILURES:', failures.join('; '));
    process.exit(1);
  }
  console.log('perf budgets: OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

(autocannon exposes p2_5/p50/p97_5/p99 — p97_5 is the p95 proxy; adjust property names to the installed typings if they differ.)
- [ ] package.json script: `"perf": "ts-node scripts/loadtest.ts"`; requires docker test DB up.
- [ ] Run `npm run perf` — record the numbers in the todo entry. Commit `feat(m13): in-process load test with local perf budgets`

### Task 4: Final security review (written report; fix High findings)
- [ ] Review checklist against current code, writing `docs/security/2026-07-11-m13-security-review.md` with a finding table (area, observation, severity, recommendation):
  1. AuthN: `auth.middleware.ts` — JWT verification, per-request DB user check (ban/password-invalidation), `fileAuthenticate` `?token=` scope (query-string token leakage into logs?).
  2. AuthZ: contract `access` arrays + handler-level gates; the pinned not-yours-is-404 patterns; admin bypass in messaging.
  3. Secrets: `config/index.ts` `requireJwtSecret()` (no default — verify), `.env` handling, logger redaction coverage.
  4. Transport/headers: helmet config (CSP only in production — assess), HTTP CORS + `socket.service` CORS `'*'` outside production.
  5. Uploads: multer mime+extension allowlist, size limits, filename sanitization in `recording.service`; path-traversal check on download filename derivation (`url.split('/').pop()`).
  6. Rate limiting: which limiters have dev/test bypasses; login brute-force posture.
  7. Injection: Prisma parameterization — grep `$queryRaw`/`$executeRaw`.
  8. Realtime: socket JWT handshake, server-stamped `fromUserId` relay (M8 pins).
- [ ] Fix anything rated High in the same task (each fix must keep the full suite green — pinned error bodies must not change).
- [ ] Commit `docs(m13): final security review` (+ fix commits if any)

### Task 5: Close out the rebuild
- [ ] `tasks/todo.md`: mark M13 done with counts + perf numbers; add a `REBUILD COMPLETE` line summarizing M0–M13.
- [ ] Final full gate: itest + unit + tsc server/shared + mobile tsc + check-i18n.
- [ ] Commit `docs(m13): rebuild M0–M13 complete`; merge `feat/rebuild-m13` into `main`; no push unless asked.

## Verification
- Task 1 is the only intentional surface change of the entire rebuild — proven controlled by the full suite passing with the predicted shrink and `grep -rn "'/api/" src | grep -v "v1\|health\|docs"` returning nothing in app code.
- `npm run perf` green with recorded numbers.
- Security report exists with zero unaddressed High findings.

## Self-review notes
- docs/metrics/verify routers deliberately stay: mounted utility surface, covered by manifest topLevel + verification itests — not "legacy business code" per the spec line.
- The mirror retirement and its test deletions land in ONE commit so no intermediate state fails CI.
- Load test uses the throwaway test DB (5433) — never the dev database.
