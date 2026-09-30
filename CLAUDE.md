# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

- For feature work, write the spec to `tasks/todo.md` before coding.
- After any user correction, update `tasks/lessons.md` with a rule to prevent recurrence.
- Never mark a task complete without proof (tests, logs, or diffs).

## Design Context

Mobile UI design is governed by two specs — read them before building or changing any screen:

- **`mobile/PRODUCT.md`** — register: **product**. Quran-memorization companion for students/teachers/parents/admins. Lead principle: *reward real achievement with dignity* ("rewarding, not toy-like"). Anti-references: corporate/sterile SaaS, childish/toy-like, cluttered/institutional.
- **`mobile/DESIGN.md`** — visual system, North Star **"The Illuminated Manuscript"** (tokens in `constants/theme.ts`). Hard rules: **Rationed Gold** (amber accent marks earned achievement only), **Status-Is-Not-Only-Color**, **Honor-the-Scale** (size via `AppText`), Arabic-first/RTL, WCAG AA across all 4 themes + dark mode.

## Commands

```bash
# From repo root
npm install                          # install all workspaces
npm run test:server                  # run all server tests

# Server (packages/server/)
npm run dev                          # ts-node-dev --respawn, port 4000
npm test                             # jest
npm test -- --watch                  # watch mode
npm test -- --testPathPattern=auth   # run a single test file
npm run build                        # tsc
npx prisma migrate dev               # run migrations (never db push — verify ledger with packages/server/scripts/verify-migrations.sh)
npx prisma db seed                   # seed test users

# Mobile (mobile/)
npm start                            # Expo dev server
```

**Physical device testing:** set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:4000/api/v1` — the default `localhost` only works on the iOS simulator.

## Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 54 · React Native · expo-router (file-based routing) |
| State | Zustand (`src/auth/store`, `src/settings/store`) |
| i18n | i18next · Arabic RTL primary, English secondary |
| API client | Typed contract client (`mobile/src/api/contract.ts`); Axios (`client.ts`) only for auth and multipart upload |
| Server | Express 4 · TypeScript |
| ORM | Prisma 6 · PostgreSQL |
| Auth | JWT access + refresh tokens · bcrypt |
| Queue | Redis + BullMQ (graceful no-op if Redis absent) |
| Push | Firebase Cloud Messaging (graceful no-op if unconfigured) |
| Validation | Zod via `@quran-review/shared` |
| Testing | Jest + ts-jest · `jest-mock-extended` for Prisma mocking |

## Project Layout

```
packages/
  server/src/
    app.ts              ← Express app, middleware stack, route mounts
    config/index.ts     ← All env vars (DATABASE_URL, JWT, FCM, SMTP)
    modules/*/*.module.ts ← Route + handler layer, one dir per domain (32 files).
                            Wired via defineRoute/buildContractRouter (lib/contract-router.ts);
                            handlers should be thin and delegate to services/
    services/           ← Business logic, DB access
    routes/             ← A handful of auxiliary routers only (docs, metrics, verify) —
                            NOT the main route layer, that's modules/ above
    middleware/         ← auth, validate, paginate, sanitize, rate-limit
    lib/                ← logger, storage, queue, health, response helpers
    prisma/client.ts    ← Singleton PrismaClient
    prisma/seed.ts      ← Seed script (test users)
  server/prisma/
    schema.prisma
  shared/src/
    enums/              ← UserRole, AppointmentStatus, GradeType, MessageType
    types/              ← Shared TS types
    validators/         ← Zod schemas (common.ts, auth.ts, teacherChange.ts)
    index.ts            ← Re-exports everything

mobile/
  app/
    _layout.tsx         ← Root layout: auth gate + role-based redirect
    (auth)/             ← Public routes (login, register, pending-approval)
    admin/              ← Admin screens (home, user-detail, change-requests, broadcast)
    teacher/            ← Teacher screens (home, appointments, recordings, reports, grade-form)
    student/            ← Student screens (home, appointments, grades, recordings, reports, teacher-change)
    messages/           ← Shared: conversation list + thread (all roles)
    parent/             ← Parent screens
    halaqa/             ← Group halaqa (live session) screens
    onboarding/         ← Per-role first-run wizards
    (public)/           ← Public routes (no auth)
    account.tsx, notifications.tsx ← Shared screens
  src/
    api/                ← Typed contract-client wrappers (one file per domain)
    hooks/              ← Custom React hooks (one per API resource)
    auth/store.ts       ← Zustand auth store (user, token, login/logout)
    settings/store.ts   ← Zustand settings (theme, language, darkMode)
    i18n/index.ts       ← Translation keys (ar + en — both required for every key)
    components/         ← Shared UI (design system: AppCard, Avatar, IconButton, etc.)
```

## Adding Code

**API flow:** `modules/<domain>/<domain>.module.ts` (route + handler, via `defineRoute`/`buildContractRouter`) → `services/` → Prisma. Handlers are thin; all logic lives in services.

**Validation:** declare the body schema (from `@quran-review/shared`) in the route's contract; `buildContractRouter` applies `validate()` (`middleware/validate.middleware.ts`) automatically. For multipart routes (file upload), put multer in the route's `pre` array. `pre` runs before `validate()`; otherwise `req.body` would be empty during validation.

**Errors:** throw `new AppError(statusCode, message)` — never throw raw errors. The centralized `errorHandler` in `app.ts` handles all errors.

**Pagination:** use `paginate()` middleware on list endpoints. Handlers receive `req.pagination` (`{ page, limit, skip }`). Return `paginatedResponse(items, total, page, limit)` from `middleware/pagination.middleware.ts`.

**New shared type or validator:** add to `packages/shared/src/` and re-export from `index.ts`.

**New mobile screen:** create `mobile/app/<role>/screen.tsx`, add API client in `mobile/src/api/`, add hook in `mobile/src/hooks/`, add i18n keys to `mobile/src/i18n/index.ts` (both `ar` and `en`).

## Critical Architecture Details

### Role Case Convention

| Context | Format |
|---------|--------|
| DB / Prisma schema | UPPERCASE (`ADMIN`, `TEACHER`, `STUDENT`) |
| JWT payload | UPPERCASE |
| `authorize()` middleware comparisons | UPPERCASE (`UserRole.ADMIN`) |
| Mobile auth store / display | lowercase (normalized at login) |
| Zod validators for API bodies | lowercase enum (`'student' | 'teacher' | 'admin'`) |

**Never compare roles in server code using lowercase strings.**

### Teacher-Student Relationship Guard

`assertTeacherCanAccessStudent(teacherId, studentId)` is duplicated in each service where a teacher writes student data (grade, recording, memorization, revision, export, attendance, weak-ayah, ijazah, curriculum-plan); a new service of that kind needs its own copy. It requires an `ACCEPTED` appointment between the two users. This guard must be called before any teacher writes to student data.

Message service uses `assertCanCommunicate` instead — which **bypasses the check entirely when either party is ADMIN**.

### GET /messages Dual Response Shape

`GET /api/v1/messages` returns **two different shapes** depending on the query:

- **Without `?partnerId`** → `getConversations()` → returns `{ partner, lastMessage, unreadCount }[]` (conversation summaries)
- **With `?partnerId=<id>`** → `getMessagesWithUser()` → returns raw `Message[]`

Mobile consumers must handle the conversation summary shape — do not treat it as `Message[]`.

### File Download Authentication

`authenticate()` accepts only an `Authorization: Bearer <token>` header. File-download routes use `fileAuthenticate()` instead, which also accepts `?token=<jwt>`, because a browser opening `/files/reports/:id` or `/files/recordings/:id` can't set headers. A contract opts in with `authVia: 'headerOrQueryToken'` (see `lib/contract-router.ts`). Do not remove this fallback.

### Teacher Change Approval Side Effects

`decideTeacherChangeRequest` with `APPROVE + newTeacherId`:
1. Updates `assignedTeacherId` on the student record
2. Reassigns all `ACCEPTED` and `REQUESTED` appointments to the new teacher
3. Creates a new `ACCEPTED` appointment with the new teacher if none exists

### File Storage

By default, files are stored locally relative to `packages/server/`:
- Audio recordings: `uploads/` (served via `GET /files/recordings/:id`)
- Report PDFs: `reports/` (served via `GET /files/reports/:id`)

Local storage goes through `LocalStorageAdapter` in `lib/storage.ts`. With `STORAGE_ENABLED=1`, uploads use object storage via `services/storage.service.ts` (see `modules/files/files.module.ts`); the download resolvers in `services/file.service.ts` handle both.

### Background Queue

`lib/queue.ts` exports `addBroadcastJob`, `addReportJob`, etc. All queue functions return `null` gracefully when Redis is unavailable — services check the return value and fall back to synchronous execution.

## Testing

Server unit tests live in `src/services/__tests__/` and `src/middleware/__tests__/`; supertest integration tests live in `src/__integration__/`. Test setup (`src/__tests__/setup.ts`) globally mocks:
- `prisma` client via `mockDeep<PrismaClient>()` from `jest-mock-extended`
- `lib/queue` (all job functions return `null`)

Route modules (`src/modules/*/*.module.ts`) have no dedicated unit tests — they're thin wiring over `defineRoute`/`buildContractRouter` and are exercised via the `__integration__` supertest suite instead. Test the underlying service directly for business-logic coverage.

Run a single test file:
```bash
cd packages/server && npm test -- --testPathPattern=appointment.service
```

## Seeded Test Users

Emails use the `@quran-review.com` domain (see `packages/server/src/prisma/seed.ts`). Passwords are the defaults below, overridable via `SEED_ADMIN_PASSWORD` / `SEED_TEACHER_PASSWORD` / `SEED_STUDENT_PASSWORD`.

| Email | Password | Role | Name | Status |
|-------|----------|------|------|--------|
| admin@quran-review.com | Admin1234! | ADMIN | Super Admin | ACTIVE |
| teacher@quran-review.com | Teacher1234! | TEACHER | Ahmad Al-Rashid | ACTIVE |
| sarah@quran-review.com | Teacher1234! | TEACHER | Sarah Khalil | ACTIVE |
| ali@quran-review.com | Student1234! | STUDENT | Ali Ahmad | ACTIVE |
| fatima@quran-review.com | Student1234! | STUDENT | Fatima Hassan | PENDING |
| student@quran-review.com | Student1234! | STUDENT | Omar Demo | ACTIVE |

`ali@quran-review.com` (Ali) has an **ACCEPTED** appointment with `teacher@quran-review.com` (Ahmad) — use this pair for teacher-student messaging and relationship-guard tests. `student@quran-review.com` (Omar) has a **REQUESTED** (not-yet-accepted) appointment with `sarah@quran-review.com` (Sarah). `fatima@quran-review.com` is a PENDING (unapproved) student.

## graphify

The `graphify` CLI can build a knowledge graph of this codebase into `graphify-out/` (git-ignored, so it exists only after a local build). When `graphify-out/graph.json` exists:
- `graphify query "<question>"`, `graphify path "<A>" "<B>"`, and `graphify explain "<concept>"` return a scoped subgraph, usually smaller than `GRAPH_REPORT.md` or raw grep output. Use them when that's faster than searching the code.
- `graphify-out/wiki/index.md` is a navigation index; `graphify-out/GRAPH_REPORT.md` is the broad architecture overview.
- After changing code, run `graphify update .` (AST-only, no API cost) so the graph doesn't go stale.
