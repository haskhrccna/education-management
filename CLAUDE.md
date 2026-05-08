# Education Management System — Project Instructions

## Structure
```
packages/
├── server/src/     → Express API (controllers, services, routes, middleware)
├── server/prisma/  → Schema + seed
└── shared/src/     → Shared TS types, enums, Zod validators
mobile/src/         → Expo RN app (api, auth, hooks, settings, i18n)
```

## Tech Stack
Express + TypeScript • PostgreSQL + Prisma 6 • Redis + BullMQ • JWT • Zustand • i18next (Arabic RTL)

## Adding Code
- **New API endpoint**: route in `server/src/routes/` → controller in `server/src/controllers/` → service logic in `server/src/services/`
- **Validate inputs**: Use Zod validators from `@edu/shared` on all POST/PUT body params
- **Error handling**: Return via centralized AppError — don't throw raw errors
- **New shared type**: Add to `packages/shared/src/types/`, re-export from index.ts
- **Mobile API call**: Use the typed Axios client in `mobile/src/api/` with existing hooks pattern (`useAppointments`, `useGrades`, etc.)

## Conventions
- kebab-case files, camelCase functions, PascalCase components
- Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...`
- All API routes versioned under `/api/v1/*`
- Database model = Prisma schema — never write raw SQL without migration

## Run & Test
```bash
cd packages/server && npm run dev     # server on :4000
npm run test:server                    # run tests
cd mobile && npm start                 # Expo
npx prisma migrate dev                # migrations
npx prisma db seed                    # seed data
```
