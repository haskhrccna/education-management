# Architecture

- **Monorepo**: npm workspaces (`packages/shared`, `packages/server`) + standalone `mobile/`
- **Database**: PostgreSQL with Prisma ORM
- **Mobile**: Expo SDK 54, file-based routing via expo-router
- **State**: Zustand (auth), raw Axios (HTTP)
- **i18n**: Arabic RTL primary, English fallback via i18next + react-i18next

## Tech Stack
| Layer | Choice |
|-------|--------|
| Mobile | Expo 54 + React Native 0.81 |
| Backend | Node.js/Express + TypeScript |
| Database | PostgreSQL 17 |
| ORM | Prisma 6 |
| Auth | JWT (SecureStore) |
| State | Zustand |
| Routing | expo-router |
| i18n | i18next (RTL-first) |
