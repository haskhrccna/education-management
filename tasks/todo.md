# Feature Roadmap Execution — Phase Tracker

> Source: `tasks/feature-roadmap.md` (6 phases, ~20 days total).
> Updated 2026-06-06 — first execution session.

## Execution strategy

Phases will be built **one at a time** in a single feature branch, with each phase gated on the previous (per roadmap §5). After every phase:

- `npm test` in `packages/server/` must stay green (existing 140 tests)
- New tests cover the added service / guard / endpoint
- TypeScript clean
- A short commit per phase

| # | Phase | Roadmap ID | Est | Status |
|---|---|---|---|---|
| 1 | Notification Center (durable feed) | F2 | ~3d | ✅ done (commit 8fa5603) |
| 2 | Attendance + Session Completion | F4 | ~2d | ✅ done |
| 3 | Parent / Guardian role + dashboard | F3 | ~4d | ⏳ |
| 4 | Spaced-Repetition Revision Engine | F6 | ~3d | ⏳ |
| 5 | Gamification (streaks / badges) | F5 | ~3d | ⏳ |
| 6 | Quran Mushaf + Ayah Audio | F1 | ~5d | ⏳ |

---

## Phase 2 — Attendance + Session Completion  ·  in progress

**Goal:** When a teacher closes out an appointment, capture per-session attendance (PRESENT / ABSENT / LATE / EXCUSED) + free-text notes. Setting attendance also flips the appointment to `COMPLETED`. Every attendance write emits a Phase-1 notification ("Teacher marked you present / late / absent for Surah X on Y").

**Goal:** Every event that already goes through `notifyUser()` (socket / email / push) also persists a row in a new `Notification` table, exposed via REST + mobile feed with an unread badge.

### Backend

1. **Schema**
   - Add `Notification { id, userId, type, title, body, data Json?, readAt?, createdAt }`
   - `@@index([userId, readAt, createdAt])` for "unread for me" + feed queries
2. **Service** (`services/notification.service.ts`)
   - Wrap `notifyUser` so it also `prisma.notification.create(...)` (best-effort, try/catch — must not break existing flows)
   - Add `listNotifications(userId, pagination)` — order by `createdAt desc`
   - Add `markRead(id, userId)` — ensure ownership, set `readAt = now()`
   - Add `markAllRead(userId)` — `updateMany` where `readAt IS NULL`
   - Add `unreadCount(userId)` — `count` where `readAt IS NULL`
3. **Controller** (`controllers/notification.controller.ts`)
   - `GET /` — paginated feed
   - `PATCH /:id/read` — single
   - `POST /read-all` — bulk
   - `GET /unread-count` — header/badge source
4. **Routes** (`routes/notification.routes.ts`) mounted at `/api/v1/notifications` (auth-required, all roles)
5. **Wire** in `app.ts`
6. **Tests** (`services/__tests__/notification.service.test.ts`)
   - `notifyUser` persists a Notification row with title/body/event as `type`
   - Persistence failure is logged but does NOT throw
   - `markRead` only affects the owner's row (returns 404 otherwise)
   - `markAllRead` only updates the caller's rows
   - `unreadCount` excludes `readAt IS NOT NULL`

### Mobile (DEFERRED — see note)

> **Deferred until P0 #2 (broken `apiClient` in `mobile/src/api/client.ts`) is fixed.**
> Observations 94, 110, 147 flagged the 401 refresh interceptor as broken — every API client file in `mobile/src/api/*` imports a default export from `./client` that does not currently exist. Wiring Phase 1 mobile on top of it would produce unverified code.
>
> A stub `mobile/src/api/notifications.ts` will be added with a `// TODO` marker, plus the route entry in `app/notifications.tsx` is a future task.

### Done when (backend scope)

- [ ] Schema migrated via `npx prisma migrate dev --name add_notification_center`
- [ ] All new endpoints return correct shapes (verified via Jest)
- [ ] Server tests ≥ 140 + new tests pass
- [ ] TypeScript clean (`tsc --noEmit`)
- [ ] Mobile stub file added with TODO marker
- [ ] Committed on `feature/phase1-notification-center` branch
