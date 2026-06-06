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
| 2 | Attendance + Session Completion | F4 | ~2d | ✅ done (commit 84a6c50) |
| 3 | Parent / Guardian role + dashboard | F3 | ~4d | ✅ done |
| 4 | Spaced-Repetition Revision Engine | F6 | ~3d | ✅ done |
| 5 | Gamification (streaks / badges) | F5 | ~3d | ⏳ |
| 6 | Quran Mushaf + Ayah Audio | F1 | ~5d | ⏳ |

---

## Phase 3 — Parent / Guardian role + dashboard  ·  in progress

**Goal:** Add a `PARENT` role so a parent can register, request a link to their child's account, and (after admin approval) read a single dashboard aggregating the child's progress, grades, attendance, upcoming appointments, and pending revisions. Parents are strictly read-only.

**Why this is the trickiest phase:** the codebase has a documented role-case split (UPPERCASE in DB/JWT/authorize, lowercase in mobile/validators). Adding a 4th role to `UserRole`, `Role` (Prisma enum), and the shared validator enums touches every switch and comparison. The audit step below is non-negotiable.

### Backend

1. **Schema**
   - Extend `enum Role { STUDENT, TEACHER, ADMIN, PARENT }`
   - Add `enum ParentLinkStatus { PENDING, APPROVED, DENIED }`
   - Add `ParentLink { id, parentId, studentId, status, requestedAt, decidedAt?, decidedBy?, @@unique([parentId, studentId]) }`
   - Back-relations on `User`
2. **Shared** (`packages/shared/src/enums/`)
   - Add `PARENT` to `UserRole`
   - Confirm the lowercase Zod validator enum also gets `parent`
3. **Service** (`services/parent.service.ts`)
   - `requestLink(parentId, studentId)` — creates a PENDING link; rejects if link already exists
   - `approveLink(linkId, adminId)` / `denyLink(linkId, adminId)` — admin-only at the route layer
   - `getChildren(parentId)` — returns APPROVED children
   - `getChildDashboard(parentId, studentId)` — **link-required guard**: throws 403 if no APPROVED link
4. **Routes** `/api/v1/parents` (mounted in app.ts)
   - `POST /links` (PARENT)
   - `GET /links` (PARENT: own; ADMIN: all)
   - `GET /children` (PARENT)
   - `GET /children/:studentId/dashboard` (PARENT — link-guarded)
   - `PATCH /links/:id/decision` (ADMIN — approve or deny)
5. **Tests** — link guard, role scoping, dashboard shape
6. **Mobile stub** at `mobile/src/api/parents.ts` (deferred — P0 #2)

### Done when (backend scope)

- [ ] Schema migrated via `npx prisma generate` + hand-applied SQL
- [ ] All new endpoints return correct shapes (verified via Jest)
- [ ] Server tests ≥ 160 + new tests pass
- [ ] TypeScript clean (`tsc --noEmit`)
- [ ] Mobile stub file added with TODO marker
- [ ] Committed on `feature/phase1-notification-center` branch

---

(Phase 1 and Phase 2 specs archived below for reference; both are done.)

<details><summary>Phase 1 spec (done — commit 8fa5603)</summary>

[see git history: 8fa5603]

</details>

<details><summary>Phase 2 spec (done — commit 84a6c50)</summary>

[see git history: 84a6c50]

</details>

