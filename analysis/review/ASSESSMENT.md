# Assessment: review (Quran-memorization platform)

- **Date:** 2026-09-30
- **Source:** `/home/haskhr/Documents/education-management` (repo root, read in place; see PREFLIGHT.md)
- **Goal:** understand (INTENT.md)
- **Constraint:** keep the system running

> **Status update 2026-09-30:** since this assessment, PRs #8–#13 made the
> production API boot and connected the website to it, fixed the High and most
> Medium security findings, and finished push notifications and halaqa live
> audio. The "Dangling or unfinished paths" items for halaqa audio and push
> registration are resolved. The rest of this document is the original snapshot.

## Executive Summary

This is a modern TypeScript monorepo: an Express 4 + Prisma 6 API on PostgreSQL, and one Expo SDK 54 codebase that ships as the iOS/Android app and as the website. It has 11 functional domains, ~34 KSLOC of production code, 30 data models, ~121 API contracts and a strong server test suite (376 unit + 1,032 integration tests, all green). It is *not* legacy in the usual sense. The risk sits in a few specific places, not in the stack: **one High-severity access-control flaw let any PARENT account read other students' learning data (fixed in PR #10).** There are also several half-finished features (live-halaqa audio, push registration), large untested mobile screens, and 12 server dependencies a major version behind. **Recommendation: Refactor in place.** Fix the parent data exposure first (`harden`), then take the dependency majors one at a time (`uplift`). No rewrite is warranted.

## System Inventory

Measured with `find` + `wc` (non-blank lines; `scc`/`cloc` not installed). Decision-keyword count for complexity.

| Area | Files | SLOC |
|---|---|---|
| `packages/server/src` (excl. tests) | 108 | 9,102 |
| `packages/shared/src` | 43 | 2,598 |
| `mobile/app` (screens) | ~54 | 16,482 |
| `mobile/src` + `mobile/components` | ~96 | 5,944 |
| **Production code total** | | **~34,100** |
| Tests (server unit + integration) | 71 | 10,426 |
| Prisma schema + 33 SQL migrations | 34 | 1,691 |
| Maestro E2E flows (YAML) | 53 | ~4,900 |

**Stack (file evidence):**
- **Server** (`packages/server/package.json`): Express 4.21, Prisma 6 (client and CLI), TypeScript 5.9, Zod 4, jsonwebtoken 9, bcryptjs 2, BullMQ 5 (Redis optional), Socket.IO 4.8, firebase-admin 12, multer 2, nodemailer 9, pdfkit, pino 10, helmet 8, express-rate-limit 8.
- **Mobile/web** (`mobile/package.json`): Expo ~54.0.33, React 19.1, React Native 0.81.5, expo-router 6, Zustand 4, TanStack Query 5, i18next 26 (Arabic RTL primary), axios, socket.io-client.
- **Data** (`packages/server/prisma/schema.prisma`): 30 models, 18 enums, 33 migrations, all applied in production.
- **Integration points:** REST `/api/v1` via typed contracts (`packages/shared/src/contracts`); Socket.IO (messages, halaqa signalling); BullMQ queues (digest, streak nudge, recurring-slot extension, recitation scoring); FCM push; SMTP; S3-compatible or local file storage.
- **Deploy:** Render (Docker, `render.yaml`, Frankfurt, free plan), GitHub Pages (web export), EAS (native).
- **Tests:** server unit 34 files / 376 tests; integration 37 suites / 1,032 tests on real Postgres; **mobile unit tests 0**; Maestro E2E 53 YAML files. Coverage config points at a nonexistent `src/controllers/` and omits `src/lib`, `src/modules` (`jest.config.js:16-21`), so coverage numbers are unreliable.

**Most complex files** (decision points / SLOC): `services/file.service.ts` 53/162, `app/student/appointments.tsx` 50/887, `app/teacher/recordings.tsx` 45/691, `app/teacher/revisions.tsx` 45/547, `services/revision.service.ts` 42/300, `services/admin.service.ts` 41/405, `app/student/home.tsx` 40/761, `app/teacher/home.tsx` 38/786, `app/_layout.tsx` 38/241, `services/parent.service.ts` 37/283.

## Architecture at a Glance

Diagram: `analysis/review/ARCHITECTURE.mmd`. Route mounts: `packages/server/src/app.ts:114-149`. Every domain's route layer is `modules/<domain>/<domain>.module.ts` over `lib/contract-router.ts`.

| Domain | Purpose | Main server files | Main mobile files | Owns (Prisma) |
|---|---|---|---|---|
| Identity & Access | Register, login, profile, account export, admin user mgmt, audit | `auth`, `users`, `account`, `admin` modules/services; `middleware/auth.middleware.ts` | `app/(auth)/*`, `app/onboarding/*`, `app/admin/user-detail.tsx`, `src/auth/store.ts` | User, AuditLog |
| Scheduling & Relationships | Appointments, recurring slots, attendance, teacher change, roster | `appointments`, `recurring-slots`, `attendance`, `teacher-change`, `roster` | `app/{student,teacher}/appointments.tsx`, `admin/change-requests.tsx` | Appointment, RecurringSlot, SessionRecord, TeacherChangeRequest |
| Quran Content & Mushaf | Surah/ayah reference data, page images | `surahs`, `mushaf`; `prisma/import-ayahs.ts` | `app/student/mushaf.tsx` | Surah, Ayah |
| Memorization & Revision | Progress, spaced repetition (SM-2), weak ayahs, curriculum plans | `memorization`, `revision`, `revision-queue`, `weak-ayah`, `curriculum-plan` | `app/{student,teacher}/{revisions,plans}.tsx` | MemorizationProgress, PageMemorization, RevisionSchedule, WeakAyahFlag, CurriculumPlan(+Item) |
| Assessment & Media | Grades, recordings, scoring (stub), PDF reports, files, CSV export | `grade`, `recording`, `recitation-scorer`, `report`, `file`, `export`, `storage` | `app/student/{grades,recordings,reports}.tsx`, `app/teacher/{grade-form,recordings}.tsx` | Grade, Recording, Report |
| Credentials | Ijazah, certificates, public verification, share image | `ijazah`, `certificate`, `verification`, `share-image`; `routes/verify.routes.ts` | `app/{student,teacher}/ijazahs.tsx`, `student/certificates.tsx` | Ijazah, Certificate |
| Engagement & Gamification | Streaks, badges, milestones, nudges | `gamification`, `milestone`, `streak-nudge` | `app/student/gamification.tsx`, `admin/milestones.tsx` | Streak, Badge, UserBadge, MilestoneDefinition |
| Communication & Notifications | Messages, in-app notifications, broadcast, email, push, sockets | `message`, `notification`, `email`, `fcm`, `socket`, `digest` | `app/messages/*`, `app/notifications.tsx`, `admin/broadcast.tsx` | Message, Notification |
| Parent / Guardian | Parent-child links, consent, child views, weekly digest | `parents`, `parent-links`; `parent`, `guardian-consent`, `digest` | `app/parent/*` | ParentLink |
| Live Halaqa | Group live rooms, WebRTC signalling | `halaqa`; `socket.service.ts:38-93` | `app/halaqa/*`, `useWebRTC` | HalaqaRoom, HalaqaGroup, HalaqaParticipant |
| Academy Admin & Analytics | Academy health, profile, analytics, public page | `analytics`, `academy-health(-pdf)`, `academy-profile` | `app/admin/{analytics,academy-health,academy-profile}.tsx`, `app/(public)/academy/[slug].tsx` | AcademyProfile |

**Shared data coupling:** almost every domain reads `Appointment`, because each of 9 copies of `assertTeacherCanAccessStudent` checks for an ACCEPTED one. Every domain reads `User`.

**Dangling or unfinished paths (verified):**
- **Live-halaqa audio is a stub.** `mobile/src/hooks/useWebRTC.ts:57-68` has TODO handlers and answers with `null`. The app reads `offer`/`answer` while the server relays `sdp` (`socket.service.ts:60-78`), and the app never sends `halaqa:offer`/`ice-candidate`.
- **Push notifications never register.** `mobile/src/hooks/usePushNotifications.ts` is imported nowhere, and it is the only caller of `POST /users/device-token`, so `User.deviceToken` is never filled and FCM push can't reach devices.
- **Attendance has no UI.** `mobile/src/api/attendance.ts` is imported nowhere.
- **Queue wiring is partial** (`lib/queue.ts`): `addBroadcastJob`/`addReportJob`/`addEmailJob` have no callers, `reportQueue` has no Worker, and `notificationQueue` has a Worker but no producer. Broadcast runs synchronously (`admin.service.ts:200`), which contradicts CLAUDE.md.
- **~16 contracts have no app caller:** admin bulk/progress ops, `verifyEmail`, `resendVerification`, `resetPassword` (forgot-password exists, reset screen doesn't), CSV exports.

## Production Runtime Profile

**No meaningful telemetry available.** Render's free plan exposes no HTTP latency or request-count metrics (both series empty for `srv-dam0uo7f3r2c73e2md60`). The first successful production deploy was 2026-09-29 18:56 UTC (all earlier deploys were `update_failed`; fixed in PR #8). Since then the logs show only Render health checks (2–4 ms) and verification traffic. Observed operational facts: the free instance sleeps after ~15 min idle (cold start up to ~1 min), and the free Postgres **expires 2026-10-17**. Re-run this step after real usage, or on a paid plan with metrics.

## Technical Debt (top 10 by remediation value)

| # | Debt | Evidence | Impact | Fix | Effort |
|---|---|---|---|---|---|
| 1 | Access-guard copies have drifted: 3 of 9 skip the soft-deleted check | Full check: `services/revision.service.ts:329-338`, `attendance.service.ts:15-27`. Appointment-only: `weak-ayah.service.ts:4-9`, `curriculum-plan.service.ts:6-12`, `ijazah.service.ts:14-20` | Deleted *teachers* are already blocked at `auth.middleware.ts:20`, but a teacher can still write weak-ayah flags, plans or ijazahs against a **deleted student**. The "intentional duplication" is now inconsistent | Align the 3 copies. Then extract one guard, or add a test asserting all 9 behave identically | S |
| 2 | "Not found" thrown as a raw `Error` → HTTP 500 | `services/notification.service.ts:118`, `report.service.ts:65,195`; `middleware/error.middleware.ts:35-36` | Clients get 500 for a 404; noisy error logs | `throw new AppError(404, …)`; lint-ban `throw new Error` in services/modules | S |
| 3 | Revisions handlers validate by hand; a "pinned quirk" keeps a 500 | `modules/revisions/revisions.module.ts:18-34` | Bad input returns 500 not 400; logic in the handler | Add Zod body schemas to `learningContracts.createRevision`/`markRevision`; update the pinned test | S |
| 4 | Coverage config targets a nonexistent folder | `packages/server/jest.config.js:16-21` | `lib/` and `modules/` never measured; no reliable coverage gate | Replace `src/controllers/**` with `src/lib/**`, `src/modules/**`; set thresholds | S |
| 5 | Published API docs cover ~6 of ~121 routes | `routes/docs.routes.ts:3,8` serves a hand-written `openapi.json` (last edited 2026-06-18) | `/api/docs` misleads integrators | Generate OpenAPI from the shared Zod contracts at build | M |
| 6 | Handler does direct Prisma read-then-write | `modules/account/account.module.ts:19-31` | Breaks the thin-handler rule; race on onboarding stamp | Move to `accountService.completeOnboarding()` with a conditional `updateMany` | S |
| 7 | Teacher home makes 3 requests per student and swallows errors | `mobile/app/teacher/home.tsx:152-158` | 3N requests per mount, no cache; failures show as "0 due" | One roster-summary endpoint plus a `useQuery` hook | M |
| 8 | Silently swallowed errors (mobile and server) | `mobile/app/teacher/grade-form.tsx:71`; `src/hooks/useConversation.ts:21,48`; `services/report.service.ts:153,156`; `verification.service.ts:92,107` | Empty screens instead of errors; orphaned files in storage | Error states/toasts; `logger.warn` plus an orphan-file metric | S |
| 9 | 12 server deps a major behind; `npm audit` prod 5 high / 29 moderate | `packages/server/package.json:21,30,67` (express ^4, prisma ^6); express 4→5, prisma 6→7, bullmq 5→6, firebase-admin 12→14, bcryptjs 2→3, nodemailer 9→10 | Growing upgrade cost; Express 5 changes async error flow through `contract-router` | Upgrade one package at a time behind the integration suite (small ones first, express/prisma last) | M–L |
| 10 | God-file mobile screens, zero mobile unit tests | `app/student/appointments.tsx` (~920 lines, 12 `useState`), `admin/user-detail.tsx` 818, `teacher/home.tsx` 813, `student/home.tsx` 786 | Slow, risky changes; design rules (Rationed Gold, RTL) hard to review | Extract sections to `src/components/<role>/`; add RN Testing Library tests as you extract | L |

Also noted: dead files `src/hooks/useAuth.ts`, `useMushaf.ts`, `usePushNotifications.ts`, `src/api/attendance.ts`, `socket.service.ts:115 notifyNewMessage`; stale root files `CLAUDE copy.md`, `claudemd.old`, `hermes-fix.py`; `mobile/eas.json:24` preview still points at a placeholder staging host (kept on purpose).

## Security Findings

The full table (CWE, locations, severity) is kept in the gitignored
`SECURITY.local.md` while items are still open, because this repository is public.

- **Assessed:** 20 findings, of which 3 High, 9 Medium and 8 Low. No Critical, and no production secret committed.
- **Fixed since (2026-09-30):** all 3 High (parent access to other students'
  revisions, weak-ayah flags and attendance, PR #10) and 5 Medium (halaqa room
  membership and refresh-token revocation, PR #11; socket account checks,
  in-room signalling and per-tab web token storage, PR #12).
- **Still open:** 4 Medium and 8 Low. Details are in `SECURITY.local.md`.
- **Dependencies:** the 5 high `npm audit` advisories are build-time/CLI-only and not reachable at runtime.

## Documentation Gaps (top 5)

1. **Architecture overview is obsolete.** `docs/architecture.md` is 19 lines, unchanged since the first commit (2026-04-30). Only 3 of 108 server source files open with a comment describing what they do. A new engineer needs the 11-domain map above and the contract-router flow (`defineRoute` → `buildContractRouter` → `validate`).
2. **Parent / guardian model.** ParentLink, approval and consent (`guardian-consent.service.ts`), the digest opt-out and what a parent may see appear in 31 code files and **no doc**. That undocumented access model is exactly where the High findings live.
3. **Realtime layer.** Socket.IO rooms (personal `userId` rooms, `halaqa:<id>`), the event names, auth at handshake, and the fact that halaqa WebRTC audio is not implemented yet.
4. **Background jobs.** Which queues exist, which have workers, what `ENABLE_WORKERS` gates, the Redis-absent synchronous fallback, and which producers are unused (CLAUDE.md overstates the broadcast/report queue use).
5. **Feature-completeness map.** Which user-facing features are live, stubbed or unreachable: recitation scoring (stub), halaqa audio (stub), push notifications (never registered), attendance (no UI), email verification (no token), reset password (no screen), CSV exports and admin bulk ops (no UI).

## Relative Scale

**~34.1 KSLOC production code** (~45 KSLOC including tests); size index **2.94 × 34.1^1.10 ≈ 143**.
This index is only for ranking this system against others by relative size. **It is not a timeline, an effort estimate or a cost.**

## Recommended Modernization Pattern

**Refactor** (in place, same stack). The stack is current: Expo 54, React 19, TypeScript 5.9, Zod 4, Prisma 6 on Postgres 17/18. The architecture is sound, with typed shared contracts, a thin-handler/service split and a strong integration suite, and the system went live on 2026-09-29. Nothing justifies a rewrite, re-architecture or replacement, and "keep the system running" argues against them. The value lies in (1) closing the role-based access gaps, most of all the PARENT default-allow pattern, with a default-deny role switch in every list service; (2) finishing or removing half-built features; (3) taking the 12 lagging majors one at a time behind the integration suite; and (4) breaking up the god-file screens as tests are added.

**Routing:**
- `harden` first, for the security fixes. It fits right after assessment because of the High findings.
- `uplift` for the dependency majors (Express 4→5, Prisma 6→7, BullMQ 5→6, firebase-admin 12→14, bcryptjs, nodemailer).
- `transform` and `reimagine` do not apply.

For the current *understand* goal, the next step is `map`.
