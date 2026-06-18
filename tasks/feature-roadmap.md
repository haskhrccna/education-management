# Feature Roadmap — Quran Review Education Platform

> Generated 2026-06-05. Codebase review + user-driven feature insights + phased implementation plan.

## 1. Where the platform stands today

**Solid foundation, complete plumbing.** Auth (JWT + refresh + password reset), role-based access (STUDENT/TEACHER/ADMIN), appointments, grades, audio recordings + review, PDF reports, 1:1 real-time messaging (Socket.IO), memorization progress (surah/ayah), manual revision schedules, teacher-change requests, admin broadcast/approval, audit logging, rate limiting, FCM/email graceful no-ops. 140 server tests pass, TS clean on server + mobile.

**What's missing is product depth for the Hifz domain**, not infrastructure. The gaps below are ranked by how many users hit them and how central they are to Quran memorization specifically.

---

## 2. Feature insights — what users most likely need

### Gap analysis by persona

| Persona | Biggest unmet need |
|---|---|
| **Student (child)** | Can't read/hear the Quran in-app; no engagement loop (streaks/badges); revision is whatever the teacher remembers to set |
| **Teacher** | Reviews recordings with free-text only (no timestamped mistake marking); no attendance tracking; 1:1 only — no halaqa |
| **Parent** | **Cannot use the app at all** — no role exists |
| **Admin** | No analytics beyond raw metrics; no fee/enrollment tracking |

---

## 3. Prioritized roadmap

### TIER 1 — Highest value, ship first

#### F1. Quran Mushaf Viewer + Ayah Audio  ⭐ core domain gap
A Hifz app where students can't see or hear the Quran is incomplete. Integrate a Quran data source (Al-Quran Cloud / Quran.com API) for Uthmani-script ayah text, word-by-word, translation, and multi-qari audio. Cache for offline. Deep-link from a surah in memorization/revision screens straight to its text + recitation.

#### F2. In-App Notification Center
`notifyUser` already fans out to socket/email/push but **persists nothing**. Add a `Notification` model + feed so users see history: appointment changes, new grades, revision due, new messages, broadcast. Single highest-leverage backend addition — every existing event becomes a durable notification for free.

#### F3. Parent / Guardian Role + Dashboard
Most students are children; parents are a primary stakeholder locked out today. Add `PARENT` role, a parent↔child link, and a read-only dashboard: child's progress, attendance, grades, reports, upcoming revisions.

### TIER 2 — High value

#### F4. Attendance + Session Completion
Appointments can be COMPLETED but there's no record of who actually attended. Add per-session attendance (present/absent/late), session notes, and feed it into reports + the parent dashboard.

#### F5. Gamification — streaks, badges, leaderboard
Children's retention engine. Daily-recitation streak (uses existing `lastRecitedAt`), juz-completion badges, optional halaqa leaderboard. Pure additive — drives daily active use.

#### F6. Spaced-Repetition Revision Engine
`RevisionSchedule` exists but is fully manual. Auto-generate revisions with an SM-2-style algorithm: recently memorized surahs surface more often, MISSED ones re-queue sooner. This is the heart of Hifz retention and turns a passive table into the app's most-used feature.

### TIER 3 — Backlog (larger scope)

- **F7. Group Classes / Halaqah** — move beyond 1:1: teacher creates a halaqa, many students, group announcements + shared schedule.
- **F8. Timestamped recitation feedback** — teacher marks specific mistakes on the audio timeline (tajweed error @1:23) instead of one free-text blob.
- **F9. Certificates / Ijazah** — issue + PDF-generate juz/khatm completion certificates.
- **F10. Payments / Fees** — subscription/fee tracking (Stripe) for academies.

---

## 4. Implementation plan (Tier 1 + Tier 2)

Follows existing patterns: `routes/ → controllers/ → services/ → Prisma`; Zod validators in `@quran-review/shared`; `AppError` for errors; `validate()` on mutations; `paginate()` on lists; mobile = api client + hook + screen + i18n (ar+en); tests in `__tests__`.

### Phase 1 — Notification Center (F2)  · ~3 days
1. **Schema**: `Notification { id, userId, type, title, body, data Json?, readAt?, createdAt }` + `@@index([userId, readAt, createdAt])`. Migrate via `/db-migrate`.
2. **Service**: extend `notification.service.ts` `notifyUser` to also `prisma.notification.create(...)` (best-effort, non-blocking). Add `listNotifications(userId, pagination)`, `markRead(id, userId)`, `markAllRead(userId)`, `unreadCount(userId)`.
3. **Routes/controller**: `notification.routes.ts` → `GET /` (paginate), `PATCH /:id/read`, `POST /read-all`, `GET /unread-count`. Mount in `app.ts` under `/api/v1/notifications`.
4. **Shared**: no new validator needed (read-only + id param).
5. **Mobile**: `api/notifications.ts`, `hooks/useNotifications.ts` (+ socket `notification` listener), `app/notifications.tsx` bell + feed, unread badge in headers. i18n keys.
6. **Tests**: `notification.service.test.ts` (create-on-notify, scoping, mark-read idempotency).

### Phase 2 — Attendance (F4)  · ~2 days
1. **Schema**: `AttendanceStatus { PRESENT, ABSENT, LATE, EXCUSED }`; `SessionRecord { id, appointmentId @unique, teacherId, studentId, status, notes?, recordedAt }`. Migrate.
2. **Service** `attendance.service.ts`: `recordAttendance(appointmentId, teacherId, status, notes)` guarded by `assertTeacherCanAccessStudent`; `getStudentAttendance(studentId, caller)` with student/teacher/parent scoping.
3. **Routes**: `POST /appointments/:id/attendance` (teacher), `GET /attendance?studentId=` . Setting attendance also flips appointment → COMPLETED.
4. **Mobile**: teacher appointment row → attendance action; surface in `student-detail` + reports.
5. **Tests**: guard enforcement, COMPLETED side-effect, double-record rejection.

### Phase 3 — Parent Role + Dashboard (F3)  · ~4 days
1. **Schema**: add `PARENT` to `Role`; `ParentLink { id, parentId, studentId, @@unique([parentId, studentId]) }`. Migrate.
2. **Shared**: extend role enums (validators + JWT typing). **Verify `authorize()` and all UPPERCASE comparisons** per the role-case convention in CLAUDE.md.
3. **Service** `parent.service.ts`: `linkChild` (admin-approved), `getChildren(parentId)`, `getChildDashboard(parentId, studentId)` — asserts the link before returning progress/grades/reports/attendance/revisions (all read-only).
4. **Routes**: `/api/v1/parents` → `GET /children`, `GET /children/:studentId/dashboard`; admin endpoint to approve links.
5. **Mobile**: `app/parent/` (home, child-dashboard); `_layout.tsx` role redirect for `parent`; register flow allows parent + child-link request.
6. **Tests**: link-required guard (parent can't read an unlinked child), role redirect.

### Phase 4 — Spaced-Repetition Revision Engine (F6)  · ~3 days
1. **Schema**: extend `RevisionSchedule` with `interval Int @default(1)`, `easeFactor Float @default(2.5)`, `repetitions Int @default(0)`.
2. **Service** `revision.service.ts`: on memorization COMPLETE, seed a revision; on mark COMPLETED/MISSED, run SM-2 to compute next `scheduledFor`. Add `generateDueRevisions(userId)`.
3. **Job**: daily BullMQ job (graceful no-op without Redis) enqueues due revisions + fires F2 notification "Revision due: Surah X".
4. **Mobile**: "Due today" section on student revisions screen; one-tap mark.
5. **Tests**: SM-2 interval math, MISSED re-queue, due-filter boundaries.

### Phase 5 — Gamification (F5)  · ~3 days
1. **Schema**: `Streak { userId @unique, current, longest, lastActiveDate }`; `Badge`/`UserBadge` (or derive badges on read).
2. **Service** `gamification.service.ts`: update streak on recitation/recording; award juz-completion badges off memorization progress; `getLeaderboard(scope)`.
3. **Routes**: `GET /gamification/me`, `GET /gamification/leaderboard`.
4. **Mobile**: streak flame + badges on student home; optional halaqa leaderboard.
5. **Tests**: streak increment/reset across day boundaries, badge-award idempotency.

### Phase 6 — Quran Mushaf Viewer + Audio (F1)  · ~5 days (largest)
1. **Decision**: client-direct to public Quran API vs. server proxy + cache. Recommend **server proxy** (`quran.service.ts`) to normalize, cache (Redis/DB), and avoid client key sprawl.
2. **Schema (optional cache)**: `Ayah { surahId, numberInSurah, textUthmani, translation? }` seeded once; audio stays remote CDN URLs.
3. **Routes**: `GET /quran/surahs/:number/ayahs`, `GET /quran/surahs/:number/audio?qari=`.
4. **Mobile**: `app/quran/[surah].tsx` RTL mushaf reader + ayah audio player (reuse expo-av), qari picker, offline cache of viewed surahs; deep-link from memorization & revision rows.
5. **Tests**: proxy/cache hit-miss, surah bounds (1–114).

---

## 5. Suggested sequencing & rationale

```
Phase 1 (Notifications) ─┐
                         ├─► unlocks durable events for every later feature
Phase 2 (Attendance) ────┘
Phase 3 (Parent role)  ──► depends on attendance + progress data to be useful
Phase 4 (Spaced rep)   ──► depends on Notifications for "revision due" pings
Phase 5 (Gamification) ──► independent; ship anytime after Phase 1
Phase 6 (Mushaf)       ──► largest; independent; can run in parallel by another dev
```

Ship **Phase 1 first** — it's small and every subsequent feature emits richer notifications for free. **Phase 6 (Mushaf)** delivers the most student-visible "wow" but is the biggest lift, so start it in parallel.

## 6. Cross-cutting for every phase
- Migrations only via `/db-migrate` (never `db push`).
- Run `security-reviewer` agent after auth/role/route changes (esp. Phase 3 PARENT role).
- Both `ar` + `en` i18n keys for every new string (RTL-first).
- Add tests before marking any phase complete (CLAUDE.md: no completion without proof).
