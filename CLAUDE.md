# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

- Enter Plan Mode for any non-trivial task (3+ steps). Write specs to `tasks/todo.md` before coding.
- After any user correction, update `tasks/lessons.md` with a rule to prevent recurrence.
- Never mark a task complete without proof (tests, logs, or diffs).

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
npx prisma migrate dev               # run migrations
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
| API client | Axios (`mobile/src/api/client.ts`) |
| Server | Express 5 · TypeScript |
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
    controllers/        ← Thin handlers — delegate everything to services
    services/           ← Business logic, DB access
    routes/             ← Router definitions
    middleware/         ← auth, validate, paginate, sanitize, rate-limit
    lib/                ← logger, storage, queue, health, response helpers
    prisma/client.ts    ← Singleton PrismaClient
  server/prisma/
    schema.prisma
    seed.ts
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
  src/
    api/                ← Typed Axios clients (one file per domain)
    hooks/              ← Custom React hooks (one per API resource)
    auth/store.ts       ← Zustand auth store (user, token, login/logout)
    settings/store.ts   ← Zustand settings (theme, language, darkMode)
    i18n/index.ts       ← Translation keys (ar + en — both required for every key)
    components/         ← Shared UI (design system: AppCard, Avatar, IconButton, etc.)
```

## Adding Code

**API flow:** `routes/` → `controllers/` → `services/` → Prisma. Controllers are thin; all logic lives in services.

**Validation:** use `validate(SomeZodSchema)` middleware from `@quran-review/shared` on all POST/PUT routes. For multipart form routes (file upload), multer **must run before** `validate()` — otherwise `req.body` is empty during validation.

**Errors:** throw `new AppError(statusCode, message)` — never throw raw errors. The centralized `errorHandler` in `app.ts` handles all errors.

**Pagination:** use `paginate()` middleware on list endpoints. Controllers receive `req.pagination` (`{ page, limit, skip }`). Return `paginatedResponse(items, total, page, limit)` from `lib/response.ts`.

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

`assertTeacherCanAccessStudent(teacherId, studentId)` is duplicated in each service that needs it (grades, recordings, memorization, revision, export). It requires an `ACCEPTED` appointment between the two users. This guard must be called before any teacher writes to student data.

Message service uses `assertCanCommunicate` instead — which **bypasses the check entirely when either party is ADMIN**.

### GET /messages Dual Response Shape

`GET /api/v1/messages` returns **two different shapes** depending on the query:

- **Without `?partnerId`** → `getConversations()` → returns `{ partner, lastMessage, unreadCount }[]` (conversation summaries)
- **With `?partnerId=<id>`** → `getMessagesWithUser()` → returns raw `Message[]`

Mobile consumers must handle the conversation summary shape — do not treat it as `Message[]`.

### File Download Authentication

`authenticate()` middleware accepts JWT via **either** `Authorization: Bearer <token>` header **or** `?token=<jwt>` query param. The query param path exists for file downloads opened in a browser (`/files/reports/:id`, `/files/recordings/:id`) where setting headers is not possible. Do not remove this fallback.

### Teacher Change Approval Side Effects

`decideTeacherChangeRequest` with `APPROVE + newTeacherId`:
1. Updates `assignedTeacherId` on the student record
2. Reassigns all `ACCEPTED` and `REQUESTED` appointments to the new teacher
3. Creates a new `ACCEPTED` appointment with the new teacher if none exists

### File Storage

Files are stored locally relative to `packages/server/`:
- Audio recordings: `uploads/` (served via `GET /files/recordings/:id`)
- Report PDFs: `reports/` (served via `GET /files/reports/:id`)

Both paths are abstracted through `LocalStorageAdapter` in `lib/storage.ts`.

### Background Queue

`lib/queue.ts` exports `addBroadcastJob`, `addReportJob`, etc. All queue functions return `null` gracefully when Redis is unavailable — services check the return value and fall back to synchronous execution.

## Testing

All server tests live in `src/controllers/__tests__/` and `src/services/__tests__/`. Test setup (`src/__tests__/setup.ts`) globally mocks:
- `prisma` client via `mockDeep<PrismaClient>()` from `jest-mock-extended`
- `lib/queue` (all job functions return `null`)

Run a single test file:
```bash
cd packages/server && npm test -- --testPathPattern=appointment.service
```

## Seeded Test Users

| Email | Password | Role |
|-------|----------|------|
| admin@education.com | Admin1234! | ADMIN |
| teacher@education.com | Teacher1234! | TEACHER |
| sarah@education.com | Teacher1234! | TEACHER |
| ali@education.com | Student1234! | STUDENT |
| student@education.com | Student1234! | STUDENT |

`ali@education.com` has an ACCEPTED appointment with `sarah@education.com` — use this pair for teacher-student messaging tests. `student@education.com` (Omar) has an ACCEPTED appointment with `teacher@education.com` (Ahmad).
