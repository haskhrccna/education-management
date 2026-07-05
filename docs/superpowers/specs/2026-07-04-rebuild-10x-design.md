# Rebuild 10x — Design Spec

**Date:** 2026-07-04
**Status:** Approved 2026-07-04
**Decisions confirmed by user:** 10x goal = everything (quality + product/UX + scale); strategy = strangler rewrite in-place; stack = same platform (Express 5 + Prisma 6 + PostgreSQL + Expo/React Native), 10x architecture on top.

---

## 1. What we are rebuilding (the spec, measured)

| Surface | Size |
|---|---|
| Server | 133 TS files, ~12,500 lines, 22 services, 23 route files, **79 REST endpoints** |
| Realtime | socket.io halaqa rooms + WebRTC signaling (`socket.service.ts`, `useWebRTC`) |
| Data | 21 Prisma models, 10 enums (531-line schema) |
| Mobile | 94 TS/TSX files, ~15,500 lines, 37 screens, 21 hooks, 20 API clients |
| Shared | ~390 lines: enums, types, Zod validators |
| Existing tests | 358 passing unit tests (39 suites, Prisma mocked) — pin service logic, **not** the HTTP contract |

Domains: auth, users/admin, appointments, attendance, teacher-change, grades, memorization (+SM-2 revision), mushaf/surah/ayah, recordings, reports, files, exports, messages, notifications (+FCM), parents, gamification (streaks/badges), certificates, analytics, halaqa (live rooms).

Behavioral invariants the rebuild must preserve (from CLAUDE.md + code):

- Role case convention (DB/JWT UPPERCASE, mobile lowercase, API bodies lowercase).
- `assertTeacherCanAccessStudent` guard: teacher writes require an ACCEPTED appointment; messaging bypasses when either party is ADMIN.
- `GET /messages` dual shape (conversations vs. thread with `?partnerId`).
- File download auth via header **or** `?token=` query param.
- Teacher-change approval's 3 side effects (reassign student, reassign appointments, ensure ACCEPTED appointment).
- Queue functions return `null` without Redis; services fall back to synchronous.
- Legacy `/api/*` mounts mirror `/api/v1/*` (to be retired in the final milestone).

## 2. Why not big-bang

28k lines, one developer + agent, a working app in use. The strangler approach keeps the app shippable at every commit, and each swapped module is proven by tests before the old one is deleted. The old code stays the executable spec until its replacement passes.

## 3. Target architecture ("10x")

### 3.1 Contract layer — the keystone

A single source of truth in `packages/shared/src/contracts/`: every endpoint declared once as a Zod contract — method, path, params/query/body schemas, response schema per status, allowed roles.

- **Server:** a `defineRoute(contract, handler)` helper replaces hand-wired routes — it applies auth, role authorization, validation, and response serialization from the contract. Misimplementing a contract is a compile error.
- **Mobile:** the typed API client is generated from the same contracts — no more hand-maintained `mobile/src/api/*.ts` drifting from the server.
- **Tests:** characterization tests iterate the contract registry, so an endpoint that exists but has no contract fails CI.

This one layer attacks the project's biggest systemic risks: contract drift, the dual-shape messages surprise, role-case bugs, and unvalidated routes.

### 3.2 Server modules

Vertical feature modules under `packages/server/src/modules/<name>/` (contract-impl, service, policies, tests), replacing the flat controllers/services/routes triple. Cross-cutting concerns become single modules:

- **`access-policy/`** — one implementation of teacher-student access, communication policy, parent-child visibility. Deletes the 5 duplicated guards.
- **`jobs/`** — BullMQ with the existing graceful no-op, plus job status introspection.
- **`observability/`** — request metrics per contract, structured audit log, health.

Services take dependencies explicitly (constructor/factory) so tests stop needing global module mocks.

### 3.3 Data layer

Keep Prisma 6. Changes: cursor-based pagination on hot lists (messages, notifications, recordings), an N+1 audit with includes fixed per module, and partial indexes derived from actual query shapes during each module's rebuild.

### 3.4 Mobile

- Finish the TanStack Query migration (branch already underway) as part of each screen cluster.
- Generated typed client from contracts replaces `src/api/*`.
- Offline-first: TanStack Query persister on MMKV, mutation queue for the flows that matter offline (memorization logging, attendance).
- Design-system enforcement per `DESIGN.md`/`PRODUCT.md`: kill the 125+ `isAr` ternaries in favor of `t()` + RTL-safe styles (known audit findings), all text through `AppText`.
- Product/UX rethink is **per screen cluster**, each gets its own mini-brainstorm during its milestone — not designed globally up front.

### 3.5 Scale & performance

Per-module perf budgets asserted in integration tests (p95 per endpoint against seeded data), rate-limit and cache policy declared in contracts, load-test gate in the final milestone.

## 4. Characterization test strategy ("tests that capture everything")

New harness in `packages/server/src/__integration__/`:

1. **Real database:** Postgres via docker-compose test instance (or Testcontainers), migrated + seeded per suite. No Prisma mocks.
2. **Black-box HTTP:** supertest against the real `app.ts` — status codes, response shapes (Zod-parsed), error envelope.
3. **Authz matrix:** for each of the 79 endpoints × 4 roles (+ anonymous), assert allow/deny. Table-driven from the contract registry.
4. **Behavioral scenarios:** the invariants in §1 as end-to-end stories (e.g., teacher-change approval side effects verified in the DB).
5. **Realtime:** socket.io-client tests for halaqa join/leave/signal events.
6. **Mobile:** hooks tested against MSW handlers generated from contracts; the existing 358 unit tests stay as-is and keep passing throughout.

The loop per module: **pin old behavior with characterization tests → rebuild module → same tests pass → add improvement tests → swap + delete old code.**

## 5. Milestones (strangler order)

Each milestone = its own plan → implement → review cycle; app ships green at every milestone boundary.

| # | Milestone | Contents |
|---|---|---|
| M0 | Test harness | Integration DB, supertest harness, CI gate, authz-matrix generator, seed factory |
| M1 | Contract foundation | Contract DSL in shared, `defineRoute`, client generator, first contract: health + auth |
| M2 | Identity | auth, users, admin approval, roles, audit log |
| M3 | Scheduling | appointments, attendance, teacher-change (3 side effects pinned) |
| M4 | Learning core | memorization, SM-2 revisions, mushaf/surah, grades |
| M5 | Media & documents | recordings, reports, files (`?token=` auth pinned), exports |
| M6 | Communication | messages (dual shape pinned), notifications, FCM, broadcast |
| M7 | Progress & rewards | gamification, certificates, analytics, parents |
| M8 | Halaqa realtime | socket rooms, WebRTC signaling, presence |
| M9 | Mobile foundation | generated client, TanStack persister/offline, theming/i18n cleanup |
| M10 | Mobile: student cluster | 10 screens, per-cluster UX rethink |
| M11 | Mobile: teacher cluster | 7 screens |
| M12 | Mobile: admin + parent + shared | 12 screens |
| M13 | Retirement & hardening | delete legacy `/api/*` mounts + dead code, load test, perf budgets, final security review |

Rough sizing: M0–M2 are the heavy lifts (harness + keystone); M3–M8 are repetitive module swaps that get faster as the pattern settles; M9–M12 dominated by UX decisions.

## 6. Error handling & risk

- **Regression risk:** nothing merges unless both the old unit suite (358) and the new characterization suite pass. Old code deleted only after its module's swap milestone is green.
- **Contract-generator risk (M1):** if the DSL fights Express 5 or codegen stalls, fallback is contracts-as-types + hand-written thin client — still one source of truth, no codegen.
- **Scope risk:** product/UX rethink can balloon; it is fenced into per-cluster mini-brainstorms with the user, not open-ended.
- **Realtime risk:** halaqa/WebRTC is the least-tested surface; M8 starts with recording current socket event flows before touching them.

## 7. Out of scope

Stack jumps (Fastify/Drizzle/tRPC), multi-tenancy, web client, CI/CD infra changes beyond the test gate, i18n beyond ar/en.
