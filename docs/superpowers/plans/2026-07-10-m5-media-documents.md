# M5 Media & Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (session precedent: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> On approval, first save this plan verbatim to `docs/superpowers/plans/2026-07-10-m5-media-documents.md` (plan mode restricted writes to this scratch file).

**Goal:** Swap the 12 legacy media-cluster endpoints — recordings (4), reports (2), file downloads (3), CSV exports (3) — onto contract routing with behavior pinned first, extending the contract DSL with raw (non-JSON) responses and `?token=` file auth, then delete the legacy routes/controllers/mock tests.

**Architecture:** Same strangler pattern as M2–M4: (1) pin observed behavior with black-box itests against the legacy routes, (2) declare contracts in shared, (3) build `defineRoute` modules that delegate to the existing services, (4) remount in app.ts (v1 + legacy mirror = same router instance), (5) delete legacy code while the full characterization suite stays green. New in M5: the DSL learns two things the JSON-only router couldn't express — **raw responses** (`res.sendFile` / CSV `res.send`) and **header-or-query-token auth** (`fileAuthenticate`).

**Tech Stack:** Express 5 · Zod v4 contracts (`@quran-review/shared`) · Prisma 6 · multer · Jest 30 integration harness (real Postgres on 5433, `jest.integration.config.js`).

## Context

The rebuild spec (`docs/superpowers/specs/2026-07-04-rebuild-10x-design.md` §5) defines M5 as "Media & documents — recordings, reports, files (`?token=` auth pinned), exports". M0–M4 are complete and merged (1029 itests / 327 unit tests green on `main` as of Stage 4). After M5, the only legacy Express routers left are messages/notifications (M6), gamification/certificates/analytics/parents (M7), and halaqa (M8).

Two constraints make M5 different from M3/M4:

1. **Non-JSON responses.** `buildContractRouter` (`packages/server/src/lib/contract-router.ts:79`) always ends with `res.status(...).json(body)` and Zod-parses the body. File downloads (`res.sendFile` + `Content-Disposition`) and CSV exports (`text/csv` + `res.send`) can't go through that path. The DSL gets a `rawResponse()` marker; handlers for raw statuses write to `res` themselves and return `{ status, handled: true }`.
2. **File auth.** `/api/v1/files/*` uses `fileAuthenticate` (Bearer header **or** `?token=` query param — `auth.middleware.ts:52`, a pinned M0 behavior that must not be dropped). Contracts get an `authVia?: 'header' | 'headerOrQueryToken'` field so the router picks the right middleware and the behavior is documented in the contract itself.

## Global Constraints (from spec + session rules)

- Error bodies must stay byte-identical to M0 pins: role-gate 403 = `{success:false,error:'Insufficient permissions'}`; validation 400 = `Validation failed: <field>: <msg>, ...`; missing auth 401 = `{success:false,error:'Authentication required'}`.
- "Fix the handler/contract, never the pin." If a characterization test fails after the swap, the new code is wrong.
- URL paths, methods, and access rules must not change — `endpoint-manifest.ts` entries for these 12 endpoints (+ their `/api/*` legacy mirrors; all four prefixes are already in `LEGACY_PREFIXES`) stay untouched.
- Zod is v4 (`z.looseObject` for row shapes, style precedent: `learning.contracts.ts`).
- Jest 30: `--testPathPatterns` (plural). Integration runs: `cd packages/server && npx jest -c jest.integration.config.js --runInBand`. Docker test DB `server-db-test-1` on 5433 must be up.
- Pre-commit runs prettier + tsc; `--no-verify` is blocked.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Work on branch `feat/rebuild-m5` off `main`.

## Legacy behavior inventory (what gets pinned)

| Endpoint | Access | Middleware chain (mount → route) | Response |
|---|---|---|---|
| POST /api/v1/recordings | STUDENT | authenticate, uploadLimiter → authorize → multer(`upload.single('file')`, 100 MB, audio/video mime+ext filter) → validate(CreateRecordingSchema) | 201 raw Recording; 400 `Audio file is required` when multer filtered the file out; 413 >500 MB (dead code, keep); 403 guardian-consent block (feature 4.1) |
| GET /api/v1/recordings | authenticated | authenticate, uploadLimiter → paginate(20,100) | 200 raw array with `student` include; role-scoped: STUDENT own, TEACHER accepted-appointment students ([] if none), ADMIN all. **Note:** paginate sets `req.pagination` but the controller ignores it — response is unpaginated. Keep `paginate` in `pre` anyway (parses/validates query). |
| PUT /api/v1/recordings/:id | TEACHER, ADMIN | authorize only — **no body validation** | 200 updated Recording; 404; 403 `No accepted appointment with this student`; audits REVIEW_RECORDING. Missing `approved` ⇒ falsy ⇒ `rejectedAt` set (pin this, do NOT add validation) |
| DELETE /api/v1/recordings/:id | TEACHER, ADMIN | authorize | 200 `{message:'Recording deleted'}`; owner check + teacher-relationship guard in service; audits DELETE_RECORDING |
| POST /api/v1/reports | TEACHER | authorize → validate(GenerateReportSchema) | 201 raw Report; 403 `No accepted appointment with this student`; orphan-PDF cleanup if DB insert fails (controller logic → moves to service) |
| GET /api/v1/reports | TEACHER, ADMIN, STUDENT | authorize | 200 raw array; STUDENT ⇒ `{studentId: me}`, else `{teacherId: me}` (yes, ADMIN sees only reports they authored — pin as-is) |
| GET /api/v1/files/recordings/:id | authenticated (`fileAuthenticate`) | standardLimiter → fileAuthenticate | 200 file stream + `Content-Disposition: attachment; filename="<name>"`; owner/ADMIN/TEACHER(+relationship guard); 404 `Recording not found` / `File not found`; 403 `Permission denied` (e.g. PARENT) |
| GET /api/v1/files/reports/:id | same | same | same pattern over `Report.pdfUrl` |
| GET /api/v1/files/certificates/:id | same | same | owner/ADMIN only (no teacher path) over `Certificate.pdfUrl` |
| GET /api/v1/exports/grades | TEACHER, ADMIN | authorize | 200 `text/csv` + `attachment; filename="grades.csv"`; optional `?studentId=&teacherId=` passed to `exportGradesCsv(studentId, teacherId, req.userId, req.userRole)` |
| GET /api/v1/exports/appointments | TEACHER, ADMIN | authorize | 200 CSV `appointments.csv`; `exportAppointmentsCsv(req.userId, req.userRole)` |
| GET /api/v1/exports/users | ADMIN | authorize | 200 CSV `users.csv`; `exportUsersCsv(req.query.role)` |

## File Structure

**Create**
- `packages/server/src/__integration__/media-flows.itest.ts` — behavior pins (written against legacy code first)
- `packages/shared/src/contracts/media.contracts.ts` — `mediaContracts` (12 contracts)
- `packages/server/src/modules/recordings/recordings.module.ts`
- `packages/server/src/modules/reports/reports.module.ts`
- `packages/server/src/modules/files/files.module.ts`
- `packages/server/src/modules/exports/exports.module.ts`
- `packages/server/src/services/file.service.ts` — download resolution logic extracted from `file.controller.ts`

**Modify**
- `packages/shared/src/contracts/types.ts` — `rawResponse()` marker, `authVia`, `ContractResponse` raw variant
- `packages/server/src/lib/contract-router.ts` — fileAuthenticate pick + `handled` short-circuit
- `packages/shared/src/contracts/client.ts` — raw responses returned unparsed
- `packages/shared/src/contracts/registry.ts`, `packages/shared/src/index.ts` — register/export
- `packages/server/src/services/report.service.ts` — absorb `createReport` / `listMyReports` from the controller
- `packages/server/src/app.ts` — swap 4 mounts (v1 + legacy mirrors)
- `packages/server/src/__tests__/contract-schemas.test.ts` — fixtures + registry-count update
- `tasks/todo.md` — mark M5 done, point at M6

**Delete (Tasks 4–5, after suites green)**
- `packages/server/src/routes/{recording,report,file,export}.routes.ts`
- `packages/server/src/controllers/{recording,report,file}.controller.ts`
- `packages/server/src/controllers/__tests__/{recording,report,file}.controller.test.ts`
- Keep: `services/{recording,report,export}.service.ts` and their unit tests.

---

### Task 0: Branch + plan doc

- [ ] `git checkout -b feat/rebuild-m5` (from up-to-date `main`)
- [ ] Save this plan to `docs/superpowers/plans/2026-07-10-m5-media-documents.md`
- [ ] Commit: `docs(m5): media & documents implementation plan`

### Task 1: Pin legacy behavior (media-flows.itest.ts)

**Files:** Create `packages/server/src/__integration__/media-flows.itest.ts`
**Interfaces:** Consumes `factory.ts` (`createUser`, `tokenFor`), shared `request.agent(app)` pattern from `authz-matrix.itest.ts`. Produces the golden pins Tasks 4–5 must keep green.

- [ ] **Step 1: Write the pins.** One shared agent; `beforeAll` seeds admin, a teacher+student pair with an ACCEPTED appointment, an unlinked teacher, and a parent:

```ts
// recordings
it('POST /recordings uploads multipart and returns 201 raw Recording', async () => {
  const res = await agent
    .post('/api/v1/recordings')
    .set('Authorization', `Bearer ${student.token}`)
    .field('fileName', 'test.mp3').field('fileSizeBytes', '4').field('contentType', 'audio/mpeg')
    .attach('file', Buffer.from('abcd'), { filename: 'test.mp3', contentType: 'audio/mpeg' });
  expect(res.status).toBe(201);
  expect(res.body.studentId).toBe(student.id);
  expect(res.body.url).toMatch(/^\/uploads\//);        // raw object, no envelope
  uploadedRecordingId = res.body.id;
});
it('POST /recordings with a disallowed extension → 400 Audio file is required', async () => {
  const res = await agent.post('/api/v1/recordings')
    .set('Authorization', `Bearer ${student.token}`)
    .field('fileName', 'x.txt').field('fileSizeBytes', '1').field('contentType', 'text/plain')
    .attach('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ success: false, error: 'Audio file is required' });
});
it('GET /recordings scopes by role', ...);              // student sees own w/ student include; unlinked teacher sees []
it('PUT /recordings/:id by unlinked teacher → 403 No accepted appointment with this student', ...);
it('PUT /recordings/:id with empty body sets rejectedAt (no validation — pinned)', ...);
it('PUT then DELETE /recordings/:id by linked teacher → 200 {message:"Recording deleted"}', ...);
// reports
it('POST /reports by unlinked teacher → 403', ...);
it('POST /reports by linked teacher → 201 raw Report with pdfUrl', ...);
it('GET /reports: student sees studentId-scoped, teacher sees teacherId-scoped', ...);
// files (?token= is the load-bearing pin)
it('GET /files/recordings/:id with ?token= (no header) → 200 + Content-Disposition attachment', async () => {
  const res = await agent.get(`/api/v1/files/recordings/${uploadedRecordingId}?token=${student.token}`);
  expect(res.status).toBe(200);
  expect(res.headers['content-disposition']).toMatch(/^attachment; filename=/);
});
it('GET /files/recordings/:id as parent → 403 Permission denied', ...);
it('GET /files/recordings/:id as unlinked teacher → 403 No accepted appointment with this student', ...);
it('GET /files/reports/:id as owner student via Bearer → 200 attachment', ...);
it('GET /files/recordings/<fake-uuid> → 404 {success:false,error:"Recording not found"}', ...);
// exports
it('GET /exports/grades as teacher → 200 text/csv + attachment; filename="grades.csv" + header row', async () => {
  const res = await agent.get('/api/v1/exports/grades').set('Authorization', `Bearer ${teacher.token}`);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/^text\/csv/);
  expect(res.headers['content-disposition']).toBe('attachment; filename="grades.csv"');
  expect(res.text.split('\n')[0]).toBeTruthy();          // pin the exact header row string once observed
});
it('GET /exports/appointments as teacher → 200 CSV', ...);
it('GET /exports/users as teacher → 403 Insufficient permissions; as admin → 200 CSV', ...);
// legacy mirrors spot-check
it('GET /api/recordings (legacy mirror) behaves identically', ...);
it('GET /api/files/recordings/:id?token= (legacy mirror) → 200', ...);
```

Where the sketch says "pin once observed": run the test, read the actual legacy value, hard-code it.
- [ ] **Step 2:** `cd packages/server && npx jest -c jest.integration.config.js --runInBand --testPathPatterns=media-flows` → all green against legacy code.
- [ ] **Step 3:** Full itest suite once (no pattern) to confirm no cross-suite interference. Expected: 1029 + new.
- [ ] **Step 4: Commit** `test(m5): pin recordings/reports/files/exports behavior before swap`

### Task 2: DSL — raw responses + file auth

**Files:** Modify `packages/shared/src/contracts/types.ts`, `packages/server/src/lib/contract-router.ts`, `packages/shared/src/contracts/client.ts`, `packages/server/src/__tests__/contract-dsl.test.ts`, `packages/server/src/__tests__/contract-client.test.ts`, `packages/server/src/__integration__/contract-router.itest.ts`
**Interfaces (produces):**
- `rawResponse(contentType: string): RawResponseMarker` — `{ raw: true, contentType }`
- `RouteContract.responses: Record<number, ZodType | RawResponseMarker>`; `RouteContract.authVia?: 'header' | 'headerOrQueryToken'` (default `'header'`)
- `ContractResponse<C>` gains the raw variant: for a status whose schema is a `RawResponseMarker`, the handler returns `{ status: S; handled: true }` after writing to `ctx.res` itself.
- Client: raw statuses resolve to `{ status, body: response }` (the unconsumed `fetch` Response).

- [ ] **Step 1: types.ts.**

```ts
export interface RawResponseMarker { readonly raw: true; readonly contentType: string }
export const rawResponse = (contentType: string): RawResponseMarker => ({ raw: true, contentType });
export const isRawResponse = (v: unknown): v is RawResponseMarker =>
  typeof v === 'object' && v !== null && (v as RawResponseMarker).raw === true;
```

`responses` value type widens to `z.ZodType | RawResponseMarker`; add `authVia?: 'header' | 'headerOrQueryToken'` to `RouteContract`. `ContractResponse<C>` becomes (adapting the existing mapped type):

```ts
export type ContractResponse<C extends AnyRouteContract> = {
  [S in keyof C['responses'] & number]: C['responses'][S] extends RawResponseMarker
    ? { status: S; handled: true }
    : { status: S; body: z.infer<Extract<C['responses'][S], z.ZodType>> };
}[keyof C['responses'] & number];
```

- [ ] **Step 2: contract-router.ts.** Import `fileAuthenticate`; the auth pick becomes:
```ts
if (contract.access !== 'public')
  chain.push(contract.authVia === 'headerOrQueryToken' ? fileAuthenticate : authenticate);
```
In the handler wrapper, before the parse/json block:
```ts
if ('handled' in result && result.handled) return; // handler streamed the response itself
```
and guard the fail-loud parse with `!isRawResponse(schema)`.
- [ ] **Step 3: client.ts.** Where the client parses `responses[status]`: if `isRawResponse(schema)`, return `{ status, body: response }` without calling `.json()`.
- [ ] **Step 4: unit tests.** `contract-dsl.test.ts`: a contract with `responses: { 200: rawResponse('text/csv') }` type-checks and `isRawResponse` discriminates. `contract-client.test.ts`: stub fetch returning `text/csv`; assert client returns the Response unconsumed. `contract-router.itest.ts`: add a scratch raw route (handler: `res.setHeader('Content-Type','text/csv'); res.send('a,b\n1,2'); return { status: 200 as const, handled: true as const };`) and a scratch `authVia: 'headerOrQueryToken'` route asserting `?token=` works and no-token → 401.
- [ ] **Step 5:** `cd packages/server && npx jest --testPathPatterns='contract-(dsl|client)'` and `npx jest -c jest.integration.config.js --runInBand --testPathPatterns=contract-router` → green. Full unit suite (`npx jest`) → green.
- [ ] **Step 6: Commit** `feat(m5): contract DSL raw responses + headerOrQueryToken auth`

### Task 3: Contracts — media.contracts.ts + registry

**Files:** Create `packages/shared/src/contracts/media.contracts.ts`; modify `registry.ts`, `index.ts`, `packages/server/src/__tests__/contract-schemas.test.ts`
**Interfaces (produces):** `mediaContracts.{uploadRecording,listRecordings,reviewRecording,deleteRecording,generateReport,listReports,downloadRecordingFile,downloadReportFile,downloadCertificateFile,exportGrades,exportAppointments,exportUsers}` — consumed by Tasks 4–5 modules.

- [ ] **Step 1:** Write the 12 contracts. Row shapes as `z.looseObject` (style: `learning.contracts.ts`, reuse `DateOut`, `ErrorEnvelope`):

```ts
const RecordingRow = z.looseObject({
  id: z.string(), studentId: z.string(), url: z.string(), fileName: z.string(),
  fileSizeBytes: z.number(), contentType: z.string(),
  reviewNotes: z.string().nullable(), approvedAt: DateOut.nullable(), rejectedAt: DateOut.nullable(),
  createdAt: DateOut,
});
const ReportRow = z.looseObject({
  id: z.string(), teacherId: z.string(), studentId: z.string(),
  pdfUrl: z.string(), summary: z.string(), generatedAt: DateOut,
});
```

Key contract facts (access copied from `endpoint-manifest.ts:37-115` so registry-parity passes):
- `uploadRecording`: POST `/api/v1/recordings`, `[UserRole.STUDENT]`, `request: { body: CreateRecordingSchema }`, responses `{ 201: RecordingRow, 400/401/403/413: ErrorEnvelope }`
- `listRecordings`: GET, `'authenticated'`, `{ 200: z.array(RecordingRow), 401: ErrorEnvelope }` (looseObject tolerates the `student` include)
- `reviewRecording`: PUT `/:id`, `[TEACHER, ADMIN]`, **no `request.body`** (summary: 'Body unvalidated by design; empty body ⇒ reject'), `{ 200: RecordingRow, 401/403/404: ErrorEnvelope }`
- `deleteRecording`: DELETE `/:id`, `[TEACHER, ADMIN]`, `{ 200: z.object({ message: z.literal('Recording deleted') }), 401/403/404: ErrorEnvelope }`
- `generateReport`: POST `/api/v1/reports`, `[UserRole.TEACHER]`, `request: { body: GenerateReportSchema }`, `{ 201: ReportRow, 400/401/403: ErrorEnvelope }`
- `listReports`: GET, `[TEACHER, ADMIN, STUDENT]`, `{ 200: z.array(ReportRow), 401: ErrorEnvelope }`
- `downloadRecordingFile` / `downloadReportFile` / `downloadCertificateFile`: GET `/api/v1/files/{recordings|reports|certificates}/:id`, `'authenticated'`, `authVia: 'headerOrQueryToken'`, `{ 200: rawResponse('application/octet-stream'), 401/403/404: ErrorEnvelope }`
- `exportGrades` / `exportAppointments`: GET `/api/v1/exports/{grades|appointments}`, `[TEACHER, ADMIN]`, `{ 200: rawResponse('text/csv'), 401/403: ErrorEnvelope }`; `exportUsers`: `[ADMIN]`, same shape.
- [ ] **Step 2:** Register in `registry.ts` (`...Object.values(mediaContracts)`) and export from `index.ts`.
- [ ] **Step 3:** `contract-schemas.test.ts`: bump the registry-count assertion (+12); add fixtures: a Prisma-shaped Recording parses against `RecordingRow`; `reviewRecording` has no request body; `downloadRecordingFile.authVia === 'headerOrQueryToken'`.
- [ ] **Step 4:** `npx jest --testPathPatterns=contract-schemas` green; `npx jest -c jest.integration.config.js --runInBand --testPathPatterns='registry-parity|completeness'` green (parity: manifest access must equal contract access for all 12).
- [ ] **Step 5: Commit** `feat(m5): media contracts (recordings, reports, files, exports)`

### Task 4: Swap recordings + reports modules

**Files:** Create `modules/recordings/recordings.module.ts`, `modules/reports/reports.module.ts`; modify `services/report.service.ts`, `app.ts`
**Interfaces:** Consumes `mediaContracts`, `defineRoute`/`buildContractRouter`, existing `recording.service` functions unchanged. Produces `recordingsRouter` (mountPrefix `/api/v1/recordings`), `reportsRouter` (`/api/v1/reports`), and new service functions `reportService.createReport(teacherId: string, studentId: string, summary: string)` / `reportService.listMyReports(userId: string, userRole?: string)`.

- [ ] **Step 1: report.service.ts.** Move the controller's logic verbatim (relationship guard → `generatePDFReport` → `prisma.report.create` with the orphan-PDF `unlink` on DB failure) into `createReport`; move the role-scoped `findMany` into `listMyReports`. Port the orphan-cleanup unit test from `report.controller.test.ts` into `services/__tests__/report.service.test.ts`.
- [ ] **Step 2: recordings.module.ts.** Move the multer config from `recording.routes.ts` verbatim (100 MB limit, mime+ext filter). Handlers mirror `recording.controller.ts` byte-for-byte in behavior, e.g.:

```ts
const uploadRecording = defineRoute(mediaContracts.uploadRecording, async ({ body, userId, req }) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new AppError(400, 'Audio file is required');
  if (file.size > 500 * 1024 * 1024) throw new AppError(413, 'File too large — maximum 500 MB');
  const recording = await recordingService.uploadRecording(
    userId!, file.originalname || body.fileName, file.size || body.fileSizeBytes || 0,
    file.mimetype || body.contentType || 'audio/mpeg', file.path);
  return { status: 201 as const, body: recording };
}, { pre: [upload.single('file')] });   // pre runs after authorize, before validate — same order as legacy
```

`listRecordings` gets `{ pre: [paginate(20, 100)] }` to preserve query parsing; `reviewRecording`/`deleteRecording` reproduce the controller incl. both `auditLog` calls (keep `userAgent: req.get('user-agent')` — the M2b precedent, as in `grades.module.ts`).
- [ ] **Step 3: reports.module.ts.** `generateReport` → `reportService.createReport`, 201 raw; `listReports` → `listMyReports`, 200 raw array.
- [ ] **Step 4: app.ts.** Replace imports and all four mounts:
```ts
app.use('/api/v1/recordings', authenticate, uploadLimiter, recordingsRouter);
app.use('/api/v1/reports',    authenticate, standardLimiter, reportsRouter);
app.use('/api/recordings',    authenticate, uploadLimiter, recordingsRouter);   // legacy mirror
app.use('/api/reports',       authenticate, standardLimiter, reportsRouter);
```
- [ ] **Step 5:** `npx jest -c jest.integration.config.js --runInBand --testPathPatterns='media-flows|authz-matrix|envelope'` → green (pins hold against the new modules).
- [ ] **Step 6:** Delete `routes/recording.routes.ts`, `routes/report.routes.ts`, `controllers/recording.controller.ts`, `controllers/report.controller.ts`, `controllers/__tests__/recording.controller.test.ts`, `controllers/__tests__/report.controller.test.ts`. `npx tsc --noEmit` clean; full unit suite green.
- [ ] **Step 7: Commit** `feat(m5): recordings + reports on contract routing; legacy deleted`

### Task 5: Swap files + exports modules

**Files:** Create `services/file.service.ts`, `modules/files/files.module.ts`, `modules/exports/exports.module.ts`; modify `app.ts`
**Interfaces:** Produces `fileService.resolveRecordingDownload(userId: string, userRole: string | undefined, id: string)` / `resolveReportDownload` / `resolveCertificateDownload`, each returning `Promise<{ filePath: string; fileName: string }>` or throwing the pinned `AppError`s; `filesRouter` (`/api/v1/files`), `exportsRouter` (`/api/v1/exports`).

- [ ] **Step 1: file.service.ts.** Extract the three download resolvers from `file.controller.ts` verbatim — lookup, owner/ADMIN/TEACHER checks (exact pinned error strings: `Permission denied`, `No accepted appointment with this student`, `Recording not found`, `Report not found`, `Certificate not found`, `File not found`), storage-adapter path + exists check.
- [ ] **Step 2: files.module.ts.** Raw handlers:

```ts
const downloadRecordingFile = defineRoute(mediaContracts.downloadRecordingFile, async ({ params, userId, userRole, res }) => {
  const { filePath, fileName } = await fileService.resolveRecordingDownload(userId!, userRole, String(params.id));
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.sendFile(filePath);
  return { status: 200 as const, handled: true as const };
});
export const filesRouter = buildContractRouter([...], { mountPrefix: '/api/v1/files' });
```
(`fileAuthenticate` comes from the contract's `authVia` — no route-file middleware needed.)
- [ ] **Step 3: exports.module.ts.** Three raw handlers calling the untouched `export.service` functions with the same argument mapping as `export.routes.ts` (incl. `?studentId`/`?teacherId`/`?role` passthrough), setting `Content-Type: text/csv` + the exact `Content-Disposition` filenames, `res.send(csv)`, return `{ status: 200 as const, handled: true as const }`.
- [ ] **Step 4: app.ts.**
```ts
app.use('/api/v1/files',   standardLimiter, filesRouter);   // auth inside via contract authVia
app.use('/api/v1/exports', authenticate, standardLimiter, exportsRouter);
app.use('/api/files',      standardLimiter, filesRouter);
app.use('/api/exports',    authenticate, standardLimiter, exportsRouter);
```
- [ ] **Step 5:** Delete `routes/file.routes.ts`, `routes/export.routes.ts`, `controllers/file.controller.ts`, `controllers/__tests__/file.controller.test.ts`.
- [ ] **Step 6: Full gate.** `npx jest -c jest.integration.config.js --runInBand` (all itests, incl. `envelope.itest.ts`'s own `?token=` pin) + `npx jest` (unit) + `npx tsc --noEmit` in `packages/server` and `packages/shared` → all green.
- [ ] **Step 7: Commit** `feat(m5): files (?token= pinned) + CSV exports on contract routing; legacy deleted`

### Task 6: Close out M5

- [ ] **Step 1:** `tasks/todo.md`: mark `[x] M5 media & documents (2026-07-10) — 12 endpoints swapped; contract DSL gained rawResponse + headerOrQueryToken auth; legacy routes/controllers/mock tests deleted (<final counts>)`. Next line: `[ ] M6 communication — messages (dual response shape pinned), notifications, FCM, broadcast. Next: superpowers:writing-plans for M6.`
- [ ] **Step 2:** Final full gate re-run (both jest configs + tsc) — paste counts into the todo entry.
- [ ] **Step 3: Commit** `docs(m5): mark M5 complete`
- [ ] **Step 4:** Use superpowers:finishing-a-development-branch — per the M0–M4 pattern, the expected choice is merge `feat/rebuild-m5` into `main` locally (do not push unless asked).

## Verification

- **Behavior lock:** Task 1's `media-flows.itest.ts` is written and green against the *legacy* code, then must stay green untouched through Tasks 4–5. Any diff = new code is wrong.
- **Matrix/envelope/parity:** `authz-matrix.itest.ts` (127 endpoints × 5 identities), `envelope.itest.ts` (`?token=` pin), `registry-parity.itest.ts`, `completeness.itest.ts` all run unmodified — they prove the API surface didn't move.
- **Final numbers:** expect ≈1029 + ~20 new itests; unit count ≈327 minus deleted controller mocks plus ported service tests; tsc clean in server + shared.

## Self-review notes

- Spec coverage: all four M5 items (recordings, reports, files with `?token=` pinned, exports) have tasks; the DSL extension is the only net-new machinery and is unit+itest covered (Task 2) before any production route uses it (Tasks 4–5).
- The `reviewRecording` no-validation pin and the unpaginated-but-paginate-parsed GET /recordings quirk are explicitly preserved, not "fixed" — fixing pinned behavior is out of scope for a strangler swap.
- `uploadLimiter` on recordings and `standardLimiter`-only on files mounts are copied exactly from current `app.ts:98/112`.
