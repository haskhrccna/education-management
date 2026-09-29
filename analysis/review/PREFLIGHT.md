# Preflight: review

- **Date:** 2026-09-29
- **Source:** `/home/haskhr/Documents/education-management` (repo root, read in place). `legacy/review` was **not**
  created. A symlink from the repo into itself risks a watch loop in Expo SDK 54's Metro, which follows symlinks.
  Later commands should use `--source /home/haskhr/Documents/education-management`.
- **Target stack:** none (goal is *understand*; see `INTENT.md`).

## Answers

1. **Scope.** Is this code the complete system, or one slice of a larger codebase?
   > Complete system
2. **Build & test locally.** Can this environment restore, build, and run the tests? How long does full CI take?
   > Yes, CI ~5–10 min
3. **Bespoke build infrastructure.** Is there organization-specific build or dependency machinery?
   > No, standard npm
4. **Prior attempts.** Has anyone tried to modernize this before? What went wrong?
   > No
5. **Off limits.** Is anything not allowed to change in this pass?
   > Nothing off limits

## Check 6: Scope boundary

A standalone git repository (483 commits, 2026-04-30 → 2026-09-29). It is an npm-workspaces monorepo with no
references outside it: `packages/server`, `packages/shared`, `mobile`. **The website is not a separate codebase.** It
is the `mobile` Expo app exported for web (`npm run build:web`) and published to GitHub Pages by
`.github/workflows/pages.yml`. No inbound consumers.

## Headline findings for the user's question (do mobile and web work and share one database?)

| # | Finding | Evidence |
|---|---|---|
| F1 | ❌ **The live website is not connected to any shared database.** Its bundle calls `http://localhost:4000/api/v1`, which is the visitor's own machine. | `curl` of the live entry bundle at https://haskhrccna.github.io/education-management/ contains `http://localhost:4000/api/v1`. `gh variable list` shows **0** repository variables, so `EXPO_PUBLIC_API_URL` and `CLIENT_URL` are unset. The committed `pages.yml` only *warns* when they are unset, so the deploy "succeeded". |
| F2 | ⚠️ **No deployed API was found.** | `render.yaml` defines `quran-review-api` + Postgres `quran-review-db`, but `https://quran-review-api.onrender.com/api/health` did not answer (HTTP 000). UNVERIFIED whether the service exists under a different URL. |
| F3 | ❌ **A mobile production build would point at a placeholder API.** | `mobile/eas.json:33` `EXPO_PUBLIC_API_URL: https://api.your-domain.com/api/v1` (staging: `api-staging.your-domain.com`). |
| F4 | ✅ **By design, both clients share one database through one API.** | One resolver, `packages/shared/src/api-base.ts` (uncommitted), re-exported by `mobile/src/api/apiBase.ts`. Every client call goes through the server; neither client talks to Postgres directly. `shared-database.itest.ts` (uncommitted) pins this and passes. |
| F5 | ⚠️ **CI on `main` is red**, and the uncommitted work fixes it. | Last 3 CI runs failed on 1 integration test (`parent-media.itest.ts` › parent downloads a report via `?token=`). On the working tree, all 1032/1032 integration tests pass locally. The uncommitted `pages.yml` turns F1's warning into a hard error. |

## Checks

| Check | Status | Found | Fix |
|---|---|---|---|
| 0 Answers | ✅ | All five answered | none |
| 1 Stack | ✅ | TypeScript: 322 `.ts`, 69 `.tsx`; 33 SQL migrations. Server 249 files, mobile ~230, shared 43. Express 4 + Prisma 6 + PostgreSQL; Expo SDK 54 (iOS/Android/web); Redis/BullMQ optional. Deploy: Render (Docker, `render.yaml`), GitHub Pages (web), EAS (native) | none |
| 2 Analysis tooling | ⚠️ | `python3` 3.13.13 ✅; `scc`, `cloc`, `lizard` missing | `sudo apt install -y cloc` or `go install github.com/boyter/scc/v3@latest`; `pipx install lizard` |
| 3a Build definition | ✅ | `.github/workflows/ci.yml`: Node 22, `npm ci`, `prisma generate`, `tsc`, `migrate deploy`, drift check, jest; integration on Postgres 17 (:5433). `pages.yml`: Node 22 web export. No `.npmrc` / private feed. No `engines` or `.nvmrc` pin (CI uses Node 22; local is v22.23.2) | Optional: add `.nvmrc` = 22 |
| 3b Smoke test | ✅ | L2, all on this tree: `prisma generate` ✅ · server `tsc --noEmit` ✅ (13 s) · mobile `tsc --noEmit` ✅ (11 s) · server unit **376/376** ✅ (31 s) · integration **1032/1032** ✅ (77 s, throwaway `postgres:17-alpine`, removed after) · web export ✅ (24 s; `EXPO_PUBLIC_API_URL` correctly baked in). Local gaps: no `packages/server/.env`, no local Postgres, no `psql` | none for analysis |
| 4 Source completeness | ✅ | Type-check resolves every import. Data definitions present (`schema.prisma` + 34 migration dirs). Deploy descriptors present. No binary-only artifacts | none |
| 5 Optional context | ⚠️ | Git history ✅ (483 commits). No APM/telemetry; production API not reachable (F2) | Share the real API URL/logs if one exists |
| 6 Scope | ✅ | Standalone repo, no inbound or outbound crossings | none |
| 7 Source protection | ⚠️ | No `Edit` deny rule in `.claude/settings.json`, `.claude/settings.local.json` or `~/.claude/settings.json` | See below |

**Check 7 note.** The source is the working repo itself, so a `legacy/**` rule would protect nothing here. For a
read-only pass, add a deny for the source paths to `.claude/settings.json` if you want enforcement, e.g.
`{ "permissions": { "deny": ["Edit(/packages/**)", "Edit(/mobile/**)"] } }`. A permission rule covers Claude's file
tools and the shell commands it recognizes, not a script that opens files itself. The hard guarantee is a read-only
mount or a sandbox.

**Side effect:** the web-export smoke test rewrote `mobile/dist/` (git-ignored build output). Nothing tracked was changed.

## Verdict per command

| Command | Verdict | Why |
|---|---|---|
| `assess` | **Ready-with-gaps** | Metrics fall back to `find`/`wc` until `scc`/`cloc` is installed |
| `map` | **Ready** | `python3` present; source complete |
| `extract-rules` | **Ready** | none |
| `brief` | **Ready** (after discovery) | none |
| `harden` | **Ready-with-gaps** | No SAST tool found (`npm audit` runs in CI) |
| `transform` / `reimagine` / `uplift` | n/a | Goal is *understand* |

## Most important fix

**F1: the website has no backend.** Deploy the API (Render blueprint in `render.yaml`), then set the repository
variables `EXPO_PUBLIC_API_URL` (`https://<api-host>/api/v1`) and `CLIENT_URL` (`https://haskhrccna.github.io`). Commit
the stricter `pages.yml` and redeploy Pages. Then put the same API URL in `mobile/eas.json` (F3), so the app and the
site share one database.
