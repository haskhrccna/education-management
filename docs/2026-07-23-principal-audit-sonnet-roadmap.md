# Principal Engineering Audit + Claude Sonnet Execution Roadmap — 2026-07-23

Audit performed on `main` @ `fea1e08`. Every claim below was verified by running the repo's own gates or targeted static analysis in this session — no assertions from memory.

---

## Part 1 — Audit Results

### 1.1 Verification gates (all executed this session)

| Gate | Result |
|---|---|
| Server unit tests | ✅ 32 suites / **308 passed** |
| Server integration tests (real Postgres, docker) | ✅ 33 suites / **910 passed** |
| `tsc --noEmit` server / shared / mobile | ✅ 0 errors ×3 |
| `npm run check-i18n` | ✅ 305 used keys present in ar+en |
| `scripts/verify-migrations.sh` (fresh `migrate deploy` == schema.prisma) | ✅ "No difference detected" |

### 1.2 Route & API-schema integrity — CLEAN

The architecture makes this class of defect structurally hard to introduce, and the guards all passed:

- **Contract registry ↔ endpoint manifest ↔ live Express routes**: three-way parity is enforced by `completeness.itest.ts` (static route discovery unioned with the contract registry, diffed against `endpoint-manifest.ts`). Passing = no phantom endpoints, no unmounted contracts.
- **Authorization matrix**: every manifest endpoint × 5 identities (anon + 4 roles) asserted (`authz-matrix.itest.ts`) — no route with missing/incorrect access control.
- **Contract-conformance at runtime**: `contract-router` parses every non-production handler response against its Zod schema (fail-loud), and the mobile typed client parses responses again client-side. Schema drift breaks tests/tsc, not production.

### 1.3 Mobile navigation graph — CLEAN

- All **47 route files** under `mobile/app/` were cross-referenced against every `router.push/replace`, `pathname:` object, and the 4 per-role BottomNav tables: **every navigation target resolves to an existing file**, including group-elided paths (`/pending-approval` → `(auth)/pending-approval`), and every screen has ≥ 1 inbound reference (no orphan screens).
- Role-interpolated targets (`/${role}/home`, `/onboarding/${user.role}`) resolve for all four roles; admin is correctly exempt from onboarding.

### 1.4 Mobile ↔ server data-flow linkage — CLEAN

- 23 API modules use the typed contract client (compile-time linkage).
- The only non-contract calls are the two **documented holdouts** (auth flows on axios, multipart recording upload) — their raw paths (`/auth/login|logout|refresh|register`, `/users/profile`, `/users/change-password`, `POST /recordings`) all exist in the endpoint manifest.
- Browser/PDF URL builders (`/api/v1/files/*?token=`, `/api/v1/verify/:token`) match the pinned `authVia: headerOrQueryToken` contracts.
- **Socket protocol fully paired**: every event mobile listens for (`new_message`, `appointment_update`, `halaqa:*`) has a server emit site, and every server listener has a client emitter — with one product-level exception (finding F3 below).

### 1.5 External links — CLEAN

- `https://api.quran.com/api/v4` (ayah import pipeline): **live, HTTP 200** verified this session.
- `http://api.local` occurrences: test fixtures only (`contract-client.test.ts`).
- One citation link (SuperMemo SM-2 algorithm page) in a comment — documentation, not a runtime dependency.

### 1.6 Findings (ranked)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| **F1** | **High (process)** | **CI is a blind spot: GitHub Actions never runs.** The workflow lives at `education_management/.github/workflows/ci.yml`, but the git root is the parent `opencode/` repo — GitHub only reads workflows from the repo root. Every gate in §1.1 is local-only; nothing protects `main` from a push that skips them. Known deviation (b) from the H1 close-out, still unfixed. | `git rev-parse --show-toplevel` → `/Users/haskhr/Documents/opencode` |
| **F2** | Medium | **`prisma:push` script still in `packages/server/package.json`** (`"prisma:push": "prisma db push"`) — contradicts H1 AC4.2 ("db push removed from toolchain") and the CLAUDE.md rule. One habitual keystroke away from re-introducing the ledger drift that F4a was built to eliminate. | `package.json:9` |
| **F3** | Medium (product) | **Halaqa audio is a non-functional scaffold.** `useWebRTC.ts` carries TODOs and emits `halaqa:answer` with `answer: null`; mobile never emits `halaqa:offer`/`halaqa:ice-candidate`; no RTCPeerConnection exists. The server relay is complete and test-pinned, but rooms are presence-only while the UI implies live audio. Decide: ship real audio or descope the UI promise. | `useWebRTC.ts:57-68` |
| **F4** | Low | **`.env.example` missing 6 config vars** consumed by `config/index.ts`: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `MUSHAF_PAGES_DIR`, `ALLOW_MISSING_MUSHAF_PAGES`, `REFRESH_TOKEN_EXPIRES_IN`. Fresh-clone operators discover them by reading source. | `comm` diff this session |
| **F5** | Info | **i18n counter artifact + unused keys.** `check-i18n` reports ar 386 / en 390; the 4-key delta is the i18next config block (`lng`, `fallbackLng`, `compatibilityJSON`, `resources`) being counted as en translation keys — a script parsing bug, not missing translations. ~80 defined-but-unused keys tolerated by design. | counter reproduction this session |
| **F6** | Info | **Documented debt from H1/H2 close-outs still open** (not regressions): F3 revision-queue precompute is in-process LRU not Redis; F7 nudge opt-out is dedupe-only (no notification prefs); teacher recording page-tag is display-only; nudges inactive without `ENABLE_WORKERS`. | `tasks/todo.md` deviation logs |

**Bottom line:** the codebase itself has **zero dead ends or broken references** — routes, schemas, nav targets, socket events, and external links all resolve. The real risks are *around* the code: an inert CI pipeline (F1) and a loaded footgun in the scripts block (F2).

---

## Part 2 — Claude Sonnet Execution Roadmap

### 2.1 Why this codebase is unusually well-suited to Sonnet-driven execution

The M0–M13 rebuild built the ideal harness for LLM-driven development. Preserve these properties in every future task:

1. **Machine-checkable ground truth.** 1,218 tests + 3 typechecks + i18n/migration guards mean "done" is computed, not judged. Sonnet's output should never be accepted on plausibility — only on gates.
2. **Contracts as single source of truth.** One Zod contract drives server routing, response validation, the mobile client, the authz matrix, and the manifest. A Sonnet task that starts from the contract cannot desynchronize the layers.
3. **Convention density.** `defineRoute` → service → Prisma; `AppError` only; ar+en keys; `useTheme()`; manifest entry per endpoint. Deterministic patterns → deterministic generation.

### 2.2 Standing task protocol (apply to every phase below)

- **Model:** `claude-sonnet-5` for all implementation tasks (high volume, pattern-following, strong tool use). Escalate to a stronger model only for cross-cutting design decisions (new subsystem shape, security posture), never for routine feature work.
- **One branch per feature, one task per context window.** Feed each task: the relevant plan section, the contract file, one exemplar module, and the gate commands. Do not feed whole-repo context — the conventions carry the information.
- **Contract-first ordering, always:** shared Zod contract → failing itest → service → module wiring → manifest entry → mobile api/hook/screen → i18n → gates.
- **TDD is non-negotiable:** the failing test is written and *run to fail* before implementation (the executing-plans skill enforces step granularity).
- **Pinned tests are immutable:** never edit an existing itest to make new code pass without an explicitly approved pin-change note in the commit body.
- **AC proof map** appended to `tasks/todo.md` at every feature close-out (existing convention — it doubles as regression documentation and future-session context).
- **Hard rules re-stated in every prompt:** never `db push`; every endpoint into the manifest; `security-reviewer` sign-off on any public/auth/admin/upload surface.

### 2.3 Phase 0 — Close the audit findings (0.5 day) · branch `chore/audit-hardening`

| Step | Action | Gate |
|---|---|---|
| 0.1 | **Fix CI (F1).** Decide: (a) move `.github/` to the `opencode/` root with `defaults.run.working-directory: education_management` + `paths:` filter, or (b) split `education_management` into its own repository (cleaner long-term; it is already self-contained). Then confirm a PR actually triggers the workflow. | Green Actions run visible on GitHub |
| 0.2 | **Remove `prisma:push` script (F2)** from `packages/server/package.json`. | grep returns nothing; unit tests still green |
| 0.3 | **Complete `.env.example` (F4)** with the 6 missing vars + one-line comments. | diff vs `config/index.ts` empty |
| 0.4 | **Fix i18n counter (F5)** to exclude the i18next config block; optionally emit an unused-keys report (warn, don't fail). | `check-i18n` reports symmetric counts |

Phase 0 is deliberately first: it makes every subsequent Sonnet-generated PR *provably* gated instead of locally gated.

### 2.4 Phase 1 — F8: Public landing + certificate share image (1 day) · branch `feat/public-share-image`

Plan already written and self-reviewed: **`docs/superpowers/plans/2026-07-23-f8-public-share.md`** (8 tasks, full code in every step, AC8.1–8.5 proof-mapped, resvg-not-puppeteer deviation documented). Execute via subagent-per-task with gates between tasks. `security-reviewer` sign-off required (new public surface).

### 2.5 Phase 2 — Remaining Horizon 3 (2.5 days)

Sequential, per the critical path:

| Feature | Branch | Scope anchor | Est. |
|---|---|---|---|
| **F9** Academy Health one-pager | `feat/academy-health` | `GET /api/v1/admin/academy-health` aggregate (+ `pagesMemorizedThisWeek`, `revisionAdherencePct`), Redis 1h TTL with graceful fallback, PDF export via existing `report.service`, admin screen. Itest asserts cache + latency budget. | 0.5 d |
| **F10** Admin+Parent+Shared UX rethink | `feat/admin-parent-ux` | Admin home top-actions, parent child-summary cards, notification deep-links (nav-target audit in §1.3 is the regression baseline). De-scope fallback: admin home + parent home only. | 1 d |
| **F11** Offline resilience | `feat/offline-resilience` | Mushaf prefetch ("Download my Mushaf"), persisted `setPageStatus`/`markPageReviewed` mutations + pending-sync badge, MMKV-backed recording upload retry queue, offline-rendered read screens. Unit tests on the retry queue. | 1 d |

Write each plan with the writing-plans skill *before* implementation — the F8 plan is the template for granularity.

### 2.6 Phase 3 — Debt re-entry (post-H3, prioritized)

1. **Halaqa audio decision (finding F3):** either integrate `react-native-webrtc` behind the existing pinned relay protocol, or remove the audio affordance from the room UI until it exists. A silent scaffold shipping to users is the worst of both.
2. **Notification preferences** (unlocks real F7 opt-out per AC7.1).
3. **Redis-backed revision-queue precompute** (replaces the in-process LRU when deployment grows past single-node).
4. **Axios retirement decision** (fold auth + multipart upload into the contract client; delete `client.ts`/`interceptors.ts`).
5. **M10–M12 UX mini-brainstorms** — explicitly user-gated; run `superpowers:brainstorming` together, then plan+execute.
6. **A-track capabilities** (analytics event log, batch teacher actions, multi-tenancy) per their documented re-entry gates.

### 2.7 Definition of done (every phase)

1. All §1.1 gates green **in CI**, not just locally (Phase 0 makes this real).
2. New endpoints present in manifest + authz matrix; no pinned test edited without an approved note.
3. AC proof map in `tasks/todo.md`; deviations documented at close-out.
4. `security-reviewer` sign-off for any public, auth, admin, or upload surface.
5. One device/simulator smoke test per mobile-facing feature.
