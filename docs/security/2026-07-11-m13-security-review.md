# M13 Final Security Review — 2026-07-11

Scope: the rebuilt server (`packages/server`) at the end of the M0–M13 strangler rewrite — 80 canonical `/api/v1` endpoints on contract routing, Socket.IO realtime, file storage, and the mobile client's transport. Review performed against the checklist below; every claim was verified in code this session.

## Summary

**No unaddressed High findings.** One High-adjacent issue (JWT leakage into request logs via `?token=`) was found and fixed in this milestone. Five Medium/Low recommendations are recorded for future work.

| # | Area | Finding | Severity | Status |
|---|------|---------|----------|--------|
| 1 | Logging | `requestLogger` logged `req.originalUrl` verbatim, so file-download JWTs (`?token=<JWT>`) were persisted to logs twice per request | **High** | **FIXED** — `redactUrl()` replaces token values with `[REDACTED]` (`lib/logger.ts`) |
| 2 | Rate limiting | `passwordResetLimiter` keyed by attacker-supplied `req.body.email`: one IP could spray resets across unlimited distinct emails (3/hour each) | Medium | **FIXED** — keyed by IP (caps total reset requests per host); max raised 3→5 to preserve legit UX (`rate-limit.middleware.ts`) |
| 3 | CORS | HTTP CORS `origin: '*'` with `credentials: true` and Socket.IO CORS `'*'` outside production | Medium | ACCEPTED (dev-only by config) — deployment note: ensure `CLIENT_URL` is set in staging/prod (fails closed without it: `origin: false` for sockets, `config.clientUrl` for HTTP) |
| 4 | Headers | helmet CSP + COEP enabled only in production | Low | ACCEPTED — fine for a JSON API; revisit if HTML surfaces grow beyond `/api/v1/verify` |
| 5 | Storage | `LocalStorageAdapter` joined `baseDir + key` without a normalized prefix check | Low (defense-in-depth) | **FIXED** — `resolveKey()` resolves against baseDir and throws `AppError(400)` on escape; routes all four methods through it (`lib/storage.ts`) |
| 6 | Redaction | Sensitive-field redaction was done only at call sites (response sanitizer + audit middleware) | Low | **FIXED** — added a central pino `redact` config as a third safety net for anything logged directly (`lib/logger.ts`) |

## Checklist results (verified good)

- **Authentication** (`middleware/auth.middleware.ts`): JWT verified against `config.jwtSecret`; EVERY request re-checks the DB user — deleted accounts, BANNED status, and `passwordChangedAt > iat` (password-change token invalidation) all yield 401. `fileAuthenticate` accepts `?token=` only on the three `/files/*` download routes via contract `authVia` — the query-token surface is minimal and now log-safe (finding 1).
- **Authorization**: two layers — contract `access` arrays enforced by the shared router (`authorize()` → pinned 403), plus handler-level ownership/relationship guards (accepted-appointment gate, parent approved-link gate, owner-or-admin patterns, not-yours-is-404 for certificates/groups/ijazahs). The 80-endpoint × 5-identity authz matrix pins all of it.
- **Secrets** (`config/index.ts`): `JWT_SECRET` is required AND length-checked (no fallback default); `DATABASE_URL` required. Nothing secret is committed; integration tests use a dedicated throwaway secret via `__integration__/env.ts`.
- **Injection**: no `$queryRaw`/`$executeRaw` outside `lib/health.ts` (`SELECT 1`) and the test-only truncation helper — all data access is parameterized Prisma.
- **Uploads** (`modules/recordings`): multer restricted by mime AND extension allowlist, 100MB limit; stored names are `uuid-<sanitized>`; upload rate-limited (20/15min per user).
- **Rate limiting**: all six limiters key by userId-with-IP-fallback; login is 10/15min per IP in production; test bypass via `NODE_ENV === 'test'` only.
- **Body size**: `express.json({ limit: '512kb' })` plus request timeout middleware.
- **Realtime** (`services/socket.service.ts`): JWT handshake required (pinned reject messages); WebRTC relay never trusts client-claimed identity — `fromUserId` is server-stamped (M8 pins); disconnect cleanup fixed in M8.
- **Error surface**: uniform `{success:false,error}` envelopes; no stack traces in responses; centralized `errorHandler`.
- **Legacy surface**: the duplicate `/api/*` mirror surface was retired in this milestone — attack surface halved to the canonical 80 endpoints.

## Residual risks / follow-ups

1. Apply recommendations 2 and 5 in a routine hardening pass (small, behavior-safe).
2. Deployment checklist must set `CLIENT_URL`, `JWT_SECRET` (64+ hex), and run behind TLS (HSTS is already emitted).
3. The mobile axios holdouts (auth flows, multipart upload) still bypass the typed contract layer — retire with a follow-up decision on removing axios entirely.
