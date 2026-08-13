# Quran Review — Education Management Platform

A full-stack Quran memorization management system for Islamic schools. Students track surah progress, teachers manage sessions and grades, and admins oversee the platform.

> **Visual map:** Open `docs/app-map.html` in any browser for an interactive screen-by-screen reference with API endpoints, navigation flows, and cross-role relationship diagrams.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Mobile App Screens](#mobile-app-screens)
- [API Reference](#api-reference)
- [Security](#security)
- [Database Schema](#database-schema)
- [Feature Status](#feature-status)
- [Development Notes](#development-notes)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Mobile App (Expo React Native)                                  │
│  expo-router · Zustand · i18next (Arabic RTL primary)           │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS / REST
┌───────────────────────▼─────────────────────────────────────────┐
│  Express API Server (Node.js + TypeScript)                       │
│  JWT auth · Zod validation · Rate limiting · Sanitization        │
└───────────┬─────────────────────────┬───────────────────────────┘
            │                         │
┌───────────▼──────────┐  ┌──────────▼─────────────────────────┐
│  PostgreSQL           │  │  Redis + BullMQ                     │
│  Prisma 6 ORM        │  │  Background jobs                     │
└──────────────────────┘  └────────────────────────────────────┘
```

**Monorepo layout** (`npm workspaces`):
- `packages/server` — Express API
- `packages/shared` — Shared TypeScript types, enums, Zod validators
- `mobile/` — Expo React Native app (standalone)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 54 · React Native · expo-router (file-based) |
| State | Zustand |
| i18n | i18next · Arabic (RTL) primary, English secondary |
| API Client | Axios (typed, in `mobile/src/api/`) |
| Server | Express 5 · TypeScript |
| ORM | Prisma 6 · PostgreSQL |
| Auth | JWT (access + refresh tokens) · bcrypt |
| Queue | Redis + BullMQ |
| Push | Firebase Cloud Messaging (FCM) · graceful no-op if unconfigured |
| Validation | Zod (`@quran-review/shared`) |
| Rate Limiting | express-rate-limit (tiered: standard / auth / admin / upload / password-reset) |
| Security | helmet · cors · sanitize-html (request + response) |
| Testing | Jest + ts-jest · 131 tests · 17 suites |
| Logging | Pino |
| Metrics | Prometheus (`/metrics`) |

---

## Project Structure

```
education_management/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── app.ts                    # Express app + middleware stack
│   │   │   ├── config/index.ts           # Env config (DATABASE_URL, JWT, FCM)
│   │   │   ├── controllers/              # Route handlers (thin, delegate to services)
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── admin.controller.ts
│   │   │   │   ├── appointment.controller.ts
│   │   │   │   ├── grade.controller.ts
│   │   │   │   ├── memorization.controller.ts
│   │   │   │   ├── recording.controller.ts
│   │   │   │   ├── report.controller.ts
│   │   │   │   ├── message.controller.ts
│   │   │   │   ├── file.controller.ts    # Tenant-guarded file download
│   │   │   │   ├── revision.controller.ts
│   │   │   │   └── teacherChange.controller.ts
│   │   │   ├── services/                 # Business logic
│   │   │   │   ├── auth.service.ts       # Login, register, forgot/reset password
│   │   │   │   ├── email.service.ts      # Password reset email
│   │   │   │   ├── fcm.service.ts        # Firebase push (lazy init, no-op if unconfigured)
│   │   │   │   ├── notification.service.ts
│   │   │   │   ├── recording.service.ts
│   │   │   │   ├── export.service.ts     # Grades CSV (teacher-guarded)
│   │   │   │   ├── revision.service.ts   # Revision schedule CRUD
│   │   │   │   ├── teacherChange.service.ts
│   │   │   │   └── __tests__/            # Service unit tests
│   │   │   ├── routes/                   # Express Router definitions
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts     # authenticate() + authorize()
│   │   │   │   ├── error.middleware.ts    # Centralized error handler
│   │   │   │   ├── rate-limit.middleware.ts
│   │   │   │   ├── sanitize.middleware.ts # Request + response sanitization
│   │   │   │   ├── validate.middleware.ts # Zod schema validation
│   │   │   │   ├── request-id.middleware.ts
│   │   │   │   └── timeout.middleware.ts
│   │   │   └── lib/
│   │   │       ├── logger.ts
│   │   │       ├── health.ts
│   │   │       └── response.ts           # successResponse() wrapper
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   └── shared/
│       └── src/
│           ├── enums/                    # UserRole, AppointmentStatus, GradeType, MessageType
│           ├── types/                    # Appointment, Grade, Message, Recording, Report, User
│           ├── validators/               # Zod schemas (auth, common, teacherChange)
│           └── index.ts
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx                   # Root layout, auth gate, role redirect
│   │   ├── (auth)/                       # Auth route group
│   │   │   ├── index.tsx                 # Login
│   │   │   ├── register.tsx
│   │   │   ├── first-login.tsx
│   │   │   ├── pending-approval.tsx
│   │   │   └── forgot-password.tsx
│   │   ├── admin/
│   │   │   ├── home.tsx
│   │   │   ├── user-detail.tsx
│   │   │   ├── change-requests.tsx
│   │   │   ├── broadcast.tsx
│   │   │   └── settings.tsx
│   │   ├── teacher/
│   │   │   ├── home.tsx
│   │   │   ├── student-detail.tsx
│   │   │   ├── appointments.tsx
│   │   │   ├── recordings.tsx
│   │   │   ├── reports.tsx
│   │   │   └── grade-form.tsx
│   │   ├── student/
│   │   │   ├── home.tsx
│   │   │   ├── appointments.tsx
│   │   │   ├── grades.tsx
│   │   │   ├── recordings.tsx
│   │   │   ├── reports.tsx
│   │   │   └── teacher-change.tsx
│   │   └── messages/
│   │       ├── index.tsx                 # Conversation list (all roles)
│   │       └── conversation.tsx
│   └── src/
│       ├── api/                          # Typed Axios clients
│       ├── hooks/                        # Custom React hooks
│       ├── auth/                         # Zustand auth store
│       ├── settings/                     # Zustand settings (language, theme)
│       ├── i18n/                         # i18next + translation keys (ar, en)
│       └── components/                   # Shared UI components (SkeletonCard, etc.)
├── docs/
│   └── app-map.html                      # Interactive screen map (open in browser)
└── CLAUDE.md
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Expo Go app or iOS/Android simulator

### Environment Variables

Create `packages/server/.env`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/quran_review"
JWT_SECRET="your-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
REDIS_URL="redis://localhost:6379"
CLIENT_URL="http://localhost:8081"
NODE_ENV="development"

# Email (for password reset)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASS="password"
EMAIL_FROM="noreply@example.com"

# Firebase (optional — push notifications no-op if absent)
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
```

### Install & Run

```bash
# Install all workspaces
npm install

# Run database migrations + seed
cd packages/server
npx prisma migrate dev
npx prisma db seed

# Start server (port 4000)
npm run dev

# Start mobile app
cd ../../mobile
npm start
```

### Run Tests

```bash
npm run test:server          # from repo root
cd packages/server && npm test -- --watch   # watch mode
```

### Deploy Web To GitHub Pages

The Expo app can be exported as a static web build for GitHub Pages:

```bash
npm run build:web
```

The build output is `mobile/dist`. The export is configured for:

```text
https://haskhrccna.github.io/education-management/
```

GitHub Pages deployment is handled by `.github/workflows/pages.yml` on every push to `main`. In the GitHub repository, set **Settings → Pages → Source** to **GitHub Actions**.

For login/API flows on the deployed site, add a repository variable named `EXPO_PUBLIC_API_URL` with your deployed API URL, for example:

```text
https://api.example.com/api/v1
```

Without that variable, the static frontend still deploys, but authenticated screens need a reachable backend before they can load live data.

### Seeded Users

| Email | Password | Role | Status |
|-------|----------|------|--------|
| admin@quran-review.com | Admin1234! | ADMIN | ACTIVE |
| teacher@quran-review.com | Teacher1234! | TEACHER | ACTIVE |
| ali@quran-review.com | Student1234! | STUDENT | ACTIVE |
| fatima@quran-review.com | Student1234! | STUDENT | PENDING |

---

## Mobile App Screens

### Authentication Flow

```
Login ──► JWT issued ──► role-based redirect
                              ├── ADMIN   → admin/home
                              ├── TEACHER → teacher/home
                              └── STUDENT → student/home

Register → PENDING status → pending-approval (wait for admin)
Admin approves → user can log in normally
```

### Admin (5 screens)

| Screen | File | Purpose |
|--------|------|---------|
| Dashboard | `admin/home.tsx` | User list, filter by role/status, approve pending accounts |
| User Detail | `admin/user-detail.tsx` | Edit role/status, assign teacher to student |
| Change Requests | `admin/change-requests.tsx` | Approve/reject student teacher-change requests |
| Broadcast | `admin/broadcast.tsx` | Send message to all users or role group |
| Settings | `admin/settings.tsx` | Profile, password, language toggle, logout |

### Teacher (6 screens)

| Screen | File | Purpose |
|--------|------|---------|
| Dashboard | `teacher/home.tsx` | Student roster with live memorization progress |
| Student Detail | `teacher/student-detail.tsx` | Surah progress, grade history |
| Appointments | `teacher/appointments.tsx` | Accept/reject student session requests |
| Recordings | `teacher/recordings.tsx` | Review student recitation audio, add notes |
| Reports | `teacher/reports.tsx` | Create/export progress reports |
| Grade Form | `teacher/grade-form.tsx` | Record session grade per surah |

> **Relationship Guard:** Teachers can only access student data when an `Appointment` with `status = 'ACCEPTED'` exists between them. Enforced server-side on all student-data endpoints.

### Student (6 screens)

| Screen | File | Purpose |
|--------|------|---------|
| Dashboard | `student/home.tsx` | Memorization progress, streak, assigned teacher |
| Appointments | `student/appointments.tsx` | Request/view sessions with teacher |
| Grades | `student/grades.tsx` | Grade history with locale-aware dates (ar-SA / en-US) |
| Recordings | `student/recordings.tsx` | Upload recitation audio, view teacher feedback |
| Reports | `student/reports.tsx` | View/download teacher progress reports |
| Teacher Change | `student/teacher-change.tsx` | Request reassignment to different teacher |

### Shared (2 screens — all roles)

| Screen | File | Purpose |
|--------|------|---------|
| Messages List | `messages/index.tsx` | All conversations |
| Conversation | `messages/conversation.tsx` | Message thread |

---

## API Reference

All endpoints under `/api/v1/`. Legacy paths `/api/*` supported for backward compatibility.

### Auth (public, rate-limited)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register → PENDING status |
| POST | `/auth/login` | Login, returns JWT access + refresh tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Email reset link (3/hr in production) |
| POST | `/auth/reset-password` | Reset password with token |
| POST | `/auth/first-login` | Set password on first login |
| POST | `/auth/logout` | Invalidate refresh token |

### Users (authenticated, all roles)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/profile` | Get own profile |
| PUT | `/users/profile` | Update profile (safe fields only) |
| PUT | `/users/change-password` | Change own password |
| POST | `/users/device-token` | Register FCM device token |

### Admin (ADMIN only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | List users (filterable by role/status) |
| GET | `/admin/users/:id` | User detail |
| PUT | `/admin/users/:id` | Update user (role, status, teacher) |
| PUT | `/admin/users/:id/approve` | Approve pending registration |

### Appointments

| Method | Path | Roles |
|--------|------|-------|
| GET | `/appointments` | TEACHER, STUDENT |
| POST | `/appointments` | STUDENT |
| PUT | `/appointments/:id` | TEACHER (accept/reject) |
| DELETE | `/appointments/:id` | STUDENT (cancel) |

### Grades & Memorization

| Method | Path | Roles |
|--------|------|-------|
| GET | `/grades` | TEACHER, STUDENT |
| POST/PUT/DELETE | `/grades[/:id]` | TEACHER |
| GET | `/surahs` | ALL |
| GET | `/memorization` | TEACHER, STUDENT |
| POST/PUT | `/memorization[/:id]` | TEACHER |

### Recordings

| Method | Path | Roles |
|--------|------|-------|
| GET | `/recordings` | TEACHER, STUDENT |
| POST | `/recordings` | STUDENT (upload) |
| PUT | `/recordings/:id` | TEACHER (approve/reject + notes) |
| GET | `/files/recordings/:id` | TEACHER, STUDENT |

### Reports & Exports

| Method | Path | Roles |
|--------|------|-------|
| GET | `/reports` | TEACHER, STUDENT |
| POST | `/reports` | TEACHER |
| GET | `/files/reports/:id` | TEACHER, STUDENT |
| GET | `/exports/grades-csv` | ADMIN, TEACHER (teacher-guarded) |

### Messages

| Method | Path | Roles |
|--------|------|-------|
| GET | `/messages` | ALL |
| POST | `/messages` | ALL |
| POST | `/messages/broadcast` | ADMIN |

### Teacher Changes & Revisions

| Method | Path | Roles |
|--------|------|-------|
| GET/POST | `/teacher-changes` | ADMIN / STUDENT |
| PUT | `/teacher-changes/:id` | ADMIN |
| GET/POST | `/revisions` | TEACHER / STUDENT |
| PUT/DELETE | `/revisions/:id` | TEACHER / STUDENT / ADMIN |

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | public | Health check (DB + memory) |
| GET | `/metrics` | public | Prometheus metrics |
| GET | `/api/docs` | admin (prod) / public (dev) | Swagger UI |

---

## Security

### Implemented Controls

| Control | Detail |
|---------|--------|
| JWT auth | Access + refresh tokens · `ADMIN\|TEACHER\|STUDENT` in payload (uppercase) |
| Relationship guard | `assertTeacherCanAccessStudent` — requires `ACCEPTED` appointment |
| Tenant isolation | File downloads verify ownership before serving |
| Rate limiting | 5 tiers: standard · auth · admin · upload · password-reset (3/hr) |
| Input sanitization | `sanitizeRequestBody` + `sanitizeResponse` in middleware chain |
| Zod validation | All POST/PUT bodies validated via `validate()` middleware |
| Helmet | CSP, HSTS (maxAge 1yr), cross-origin policies — strict in production |
| Password reset | Token only sent via email; never in HTTP response body |
| Export guard | CSV export checks teacher-student relationship before serving |
| Safe profile update | Prisma `select` prevents returning sensitive fields |

### Authorization Matrix

```
ADMIN   → Full platform (admin routes, admin rate limit)
TEACHER → Own classroom data + students with ACCEPTED appointment only
STUDENT → Own data only
```

JWT payload contains `userId` (string) and `role` (uppercase string). Mobile auth store normalizes role to lowercase for display only — never use lowercase in server-side comparisons.

---

## Database Schema

Key models (`packages/server/prisma/schema.prisma`):

```
User              id, name, email, passwordHash, role, status, teacherId, deviceToken

Appointment       id, studentId, teacherId, status (PENDING|ACCEPTED|REJECTED),
                  scheduledFor, notes

Grade             id, studentId, teacherId, surahId, score,
                  type (HIFZ|REVISION|TAJWEED), notes

Memorization      id, studentId, surahId,
                  status (NOT_STARTED|IN_PROGRESS|COMPLETED|NEEDS_REVIEW),
                  progress (0-100), startDate, completedDate

Recording         id, studentId, teacherId, surahId, filePath,
                  status (PENDING|APPROVED|REJECTED), teacherNotes

Report            id, studentId, teacherId, type, period, filePath

Message           id, senderId, receiverId, content, type (DIRECT|BROADCAST), read

TeacherChange     id, studentId, currentTeacherId, requestedTeacherId, reason,
                  status (PENDING|APPROVED|REJECTED)

RevisionSchedule  id, studentId, teacherId, surahId, scheduledFor,
                  status (PENDING|COMPLETED|MISSED)

Surah             id (1-114), name (Arabic), englishName, juzNumber, verseCount
```

---

## Feature Status

| Feature | Backend | Mobile | Notes |
|---------|:-------:|:------:|-------|
| Auth (login/register/reset) | ✅ | ✅ | Reset token in email only |
| Admin user management | ✅ | ✅ | Filter, approve, deactivate, teacher assign |
| Admin broadcast | ✅ | ✅ | ALL / STUDENTS / TEACHERS |
| Teacher change requests | ✅ | ✅ | FCM push on admin decision |
| Appointments | ✅ | ✅ | Creates teacher-student relationship |
| Grades | ✅ | ✅ | Teacher records, student views |
| Memorization progress | ✅ | ✅ | 114 surahs, 4-state status |
| Recordings | ✅ | ✅ | Student uploads, teacher reviews |
| Reports | ✅ | ✅ | Teacher creates, student downloads |
| Messaging | ✅ | ✅ | Direct + broadcast |
| Revision schedules | ✅ | ⬜ | Backend complete; mobile screen not yet built |
| Push notifications (FCM) | ✅ | ✅ | No-op until firebase-admin configured |
| Grades CSV export | ✅ | ✅ | Teacher-relationship-guarded |
| Skeleton loading | — | ✅ | All home screens |
| Pull-to-refresh | — | ✅ | All home screens |
| Dark mode | — | ✅ | Via `getColors()` |
| Tab navigator | — | ⬜ | Currently flat stack |
| Offline support | — | ⬜ | Not implemented |

---

## Development Notes

### Adding a New API Endpoint

1. Route file in `packages/server/src/routes/`
2. Controller in `packages/server/src/controllers/`
3. Service in `packages/server/src/services/`
4. Zod validator in `packages/shared/src/validators/` if new body shape needed
5. Mount in `packages/server/src/app.ts`

### Adding a New Mobile Screen

1. Create `mobile/app/<role>/screen-name.tsx`
2. Add typed API client in `mobile/src/api/`
3. Add hook in `mobile/src/hooks/`
4. Add i18n keys to `mobile/src/i18n/index.ts` (both `ar` and `en`)

### i18n

Primary language is Arabic (RTL). All user-facing strings must have both `ar` and `en` entries. Use `useTranslation()` hook — never hardcode display strings.

### Role Case Convention

| Context | Format | Example |
|---------|--------|---------|
| DB / Prisma | UPPERCASE | `ADMIN` |
| JWT payload | UPPERCASE | `TEACHER` |
| Server middleware (`authorize()`) | UPPERCASE comparisons | `UserRole.ADMIN` |
| Mobile display / auth store | lowercase (normalized) | `student` |

### Environment-specific Behavior

| Setting | Development | Production |
|---------|-------------|------------|
| Password reset token | Logged to server console | Sent via email only |
| CORS | `*` (all origins) | `CLIENT_URL` only |
| API Docs (`/api/docs`) | Public | Admin-only |
| Content Security Policy | Off | On (Helmet) |
| Rate limits | High / relaxed | Enforced |
