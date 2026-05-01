# التعليم الإلكتروني — Electronic Education Management System

A production-ready education management platform for students, teachers, and administrators with bilingual Arabic/English support (Arabic primary, RTL).

## Features

### Core Platform
- **Role-based access control** — Student, Teacher, Admin roles with JWT authentication
- **Appointment scheduling** — Time-based conflict detection, request/accept/reject workflow
- **Grade management** — Teachers record grades; students view their progress
- **Messaging** — Real-time chat via Socket.IO with read receipts
- **Recording uploads** — Students upload recordings; teachers review and approve
- **PDF report generation** — Teachers generate progress reports for students

### API & Backend (v1)
- **API Versioning** — `/api/v1/*` with backward-compatible legacy routes
- **OpenAPI/Swagger Docs** — Interactive API documentation at `/api/docs`
- **Structured Logging** — Pino with request tracing and slow query detection
- **Background Jobs** — BullMQ queues for broadcasts, reports, and emails
- **Redis Caching** — Query result caching for performance
- **Rate Limiting** — Per-role limits (auth: 10, standard: 100, admin: 300, upload: 20)
- **Request Timeouts** — 30s default with graceful 504 handling
- **Response Sanitization** — Passwords/tokens redacted from logs automatically
- **Health Checks** — `/api/health` with DB latency and memory usage
- **Prometheus Metrics** — `/metrics` with request duration histograms

### Security
- Helmet with CSP, HSTS, and cross-origin policies
- Zod input validation on all POST/PUT endpoints
- Centralized error handling with typed AppError codes
- Request ID propagation for distributed tracing
- Graceful shutdown with connection draining

### Mobile App
- **Expo React Native** with expo-router file-based routing
- **Secure token storage** via expo-secure-store
- **Push notifications** via expo-notifications + FCM
- **Bilingual UI** — Arabic RTL primary, English LTR
- **Typed API layer** — Axios client with interceptors
- **React hooks** — useAuth, useAppointments, useGrades, useMessages

### Notifications
- **Unified notification service** — Email + Socket.IO + Push (FCM)
- **Bilingual email templates** — Arabic/English with RTL support
- **Event-driven** — Auto-notify on grade, appointment, and message events

### Admin Tools
- **Paginated user management** — List, filter, approve, deactivate
- **Bulk operations** — Bulk approve students, bulk deactivate users
- **Progress dashboards** — Teacher and student progress analytics
- **Broadcast messaging** — Send to all users or by role
- **CSV exports** — Export grades, appointments, users
- **Audit logging** — All admin actions logged with Pino

## Quick Start

### Prerequisites
- Node.js 22+
- PostgreSQL 17
- Redis 7 (optional, for queues and caching)

### 1. Database
```bash
brew services start postgresql@17
brew services start redis
cd packages/server
cp .env.example .env    # update DATABASE_URL if needed
npx prisma migrate dev   # run migrations
npx prisma db seed       # seed admin + teacher + students
```

### 2. Backend Server
```bash
cd packages/server
npm run dev              # starts on :4000
# Or with workers:
ENABLE_WORKERS=true npm run dev
```

### 3. Mobile App
```bash
cd mobile
npm start                # Expo dev tools open
# Press 'a' for Android, 'i' for iOS simulator
```

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | public | Student/teacher self-register |
| POST | `/api/v1/auth/login` | public | Login all roles |
| POST | `/api/v1/auth/verify-email` | auth | Verify email address |
| POST | `/api/v1/auth/resend-verification` | auth | Resend verification email |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/users/profile` | auth | Get my profile |
| PUT | `/api/v1/users/profile` | auth | Update profile |
| PUT | `/api/v1/users/change-password` | auth | Change password |
| POST | `/api/v1/users/device-token` | auth | Register push token |

### Appointments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/appointments` | auth | List my appointments |
| POST | `/api/v1/appointments` | student | Create appointment |
| PUT | `/api/v1/appointments/:id` | teacher/admin | Manage appointment |

### Grades
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/grades` | auth | View grades |
| POST | `/api/v1/grades` | teacher | Create grade entry |
| GET | `/api/v1/grades/student/:id` | teacher/admin | View student grades |

### Messages
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/messages` | auth | List conversations |
| POST | `/api/v1/messages` | auth | Send message |
| PUT | `/api/v1/messages/:id/read` | auth | Mark as read |

### Recordings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/recordings` | auth | List recordings |
| POST | `/api/v1/recordings` | student | Upload recording |
| PUT | `/api/v1/recordings/:id` | teacher/admin | Review recording |
| DELETE | `/api/v1/recordings/:id` | teacher/admin | Delete recording |

### Reports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/reports` | teacher | Generate PDF report |
| GET | `/api/v1/reports` | teacher/admin | List my reports |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/users` | admin | List users (paginated) |
| POST | `/api/v1/admin/teachers` | admin | Create teacher |
| PUT | `/api/v1/admin/users/:id/approve` | admin | Approve student |
| PUT | `/api/v1/admin/users/:id/deactivate` | admin | Ban user |
| POST | `/api/v1/admin/broadcast` | admin | Broadcast message |
| POST | `/api/v1/admin/bulk/approve` | admin | Bulk approve students |
| POST | `/api/v1/admin/bulk/deactivate` | admin | Bulk deactivate users |
| GET | `/api/v1/admin/progress/teachers` | admin | Teacher progress |
| GET | `/api/v1/admin/progress/students` | admin | Student progress |

### Exports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/exports/grades` | teacher/admin | Export grades CSV |
| GET | `/api/v1/exports/appointments` | auth | Export appointments CSV |
| GET | `/api/v1/exports/users` | admin | Export users CSV |

### System
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | public | Health check |
| GET | `/metrics` | public | Prometheus metrics |
| GET | `/api/docs` | public | Swagger UI |

## Seeded Users
| Email | Password | Role | Status |
|-------|----------|------|--------|
| admin@education.com | Admin1234! | ADMIN | ACTIVE |
| teacher@education.com | Teacher1234! | TEACHER | ACTIVE |
| ali@education.com | Student1234! | STUDENT | ACTIVE |
| fatima@education.com | Student1234! | STUDENT | PENDING |

## Tech Stack
| Layer | Choice |
|-------|--------|
| Mobile | Expo 54 + React Native 0.81, expo-router |
| Backend | Node.js 22 + Express + TypeScript |
| Database | PostgreSQL 17 + Prisma 6 |
| Cache/Queue | Redis 7 + BullMQ |
| Auth | JWT (expo-secure-store on mobile) |
| State | Zustand |
| i18n | i18next (Arabic RTL primary) |
| Logging | Pino |
| Metrics | Prometheus |
| Testing | Jest 30 + ts-jest + supertest |
| CI/CD | GitHub Actions |

## Environment Variables

See `packages/server/.env.example` for all required variables. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `REDIS_URL` | No | Redis connection (queues/cache) |
| `EMAIL_HOST` | No | SMTP host for email notifications |
| `EMAIL_USER` | No | SMTP username |
| `EMAIL_PASS` | No | SMTP password |
| `FCM_SERVICE_ACCOUNT_KEY` | No | Firebase Cloud Messaging credentials |
| `ENABLE_WORKERS` | No | Set to `true` to enable BullMQ workers |

## Testing

```bash
cd packages/server
npm test              # Run all tests
npm run test:coverage # With coverage report
```

## Docker

```bash
cd packages/server
docker-compose up --build
```

Includes: API server, PostgreSQL 17, Redis 7

## License

MIT
