# التعليم الإلكتروني — Electronic Education Management System

Education management app for students, teachers, and admins with bilingual Arabic/English support (Arabic primary, RTL).

## Quick Start

### 1. Database
```bash
brew services start postgresql@17
cd packages/server
cp .env.example .env    # update DATABASE_URL if needed
npx prisma migrate dev   # run migrations
npx prisma db seed       # seed admin + teacher
```

### 2. Backend Server
```bash
cd packages/server
npm run dev     # starts on :4000
```

### 3. Mobile App
```bash
cd mobile
npm start      # Expo dev tools open
# Press 'a' for Android, 'i' for iOS simulator
```

## Seeded Users
| Email | Password | Role |
|-------|----------|------|
| admin@education.com | Admin1234! | ADMIN |
| teacher@education.com | Teacher1234! | TEACHER |

Register new students at the app's registration screen.

## API Endpoints (Phase 1+2)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | public | Student self-register |
| POST | `/api/auth/login` | public | Login all roles |
| POST | `/api/auth/verify-email` | auth | Verify + approve student |
| GET | `/api/appointments` | auth | View my appointments |
| POST | `/api/appointments` | student | Create appointment request |
| PUT | `/api/appointments/:id` | teacher/admin | Accept/amend/reject |
| GET | `/api/grades` | auth | View own grades (student) / all (teacher) |
| POST | `/api/grades` | teacher | Create grade entry |

## Tech Stack
| Layer | Choice |
|-------|--------|
| Mobile | Expo 54 + RN 0.81, expo-router |
| Backend | Node.js/Express + TypeScript |
| Database | PostgreSQL 17 + Prisma 6 |
| Auth | JWT (SecureStore) |
| State | Zustand |
| i18n | i18next (Arabic RTL primary) |
