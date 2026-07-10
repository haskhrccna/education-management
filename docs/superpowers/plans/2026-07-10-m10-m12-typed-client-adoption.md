# M10–M12 Mechanical Half: Typed-Client Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (session precedent: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every eligible mobile API module from axios to the typed `contractClient`, cluster by cluster (M10 student, M11 teacher, M12 admin/parent/shared), preserving each module's public signatures so hooks and screens are untouched.

**Architecture:** One uniform pattern established by the M9 gamification pilot: import the domain's contracts object + `contractClient`/`expectStatus`, call `contractClient.call(contract, {params, query, body})`, unwrap to the exact same return value the axios version produced (`res.body` for raw responses, `res.body.data` for `{success,data}` envelopes), cast through `as unknown as T` (looseObject unions don't overlap local interfaces). Deliberate axios holdouts stay documented in-file: `auth.ts` (auth-store-coupled login/refresh/logout), `recordings.uploadRecording/upload` (multipart FormData — the contract client is JSON-only), and browser-URL builders (`reports.downloadReport`, `certificates.downloadUrl/verifyUrl`, `ijazahs.verifyUrl`) which switch to the exported `API_ORIGIN`.

**Tech Stack:** Expo RN · `@quran-review/shared` contracts (106) · `mobile/src/api/contract.ts` from M9.

## Context

Spec §5 defines M10–M12 as screen-cluster milestones with "per-cluster UX rethink"; spec §6 fences that rethink into "per-cluster mini-brainstorms with the user, not open-ended". This plan executes the milestones' **objective half** — full typed-client adoption, which M9 scoped for exactly this phase — and leaves the UX halves flagged in `tasks/todo.md` as awaiting the user brainstorms. Gate is `cd mobile && npx tsc --noEmit` (0 errors) per cluster; every server response shape referenced here is guarded by the 1113-test characterization suite.

## Global Constraints

- Every `*Api` export keeps its exact name, parameters, and resolved return value — hooks/screens must not change (verify with `git diff --stat` touching only `mobile/src/api/*`).
- Unwrap fidelity: match the OLD axios line — `res.data` ⇒ `res.body`; `res.data.data` / `res.data?.data ?? X` ⇒ `res.body.data` (envelope guaranteed by contract).
- Casts through `unknown` (M9 pilot lesson).
- 204 responses: `contractClient` returns `body: undefined` — modules returning `void` just `expectStatus(res, 204)` and return.
- Holdouts keep axios and say why in a comment.
- Branch `feat/rebuild-m10-12` off `main`; mobile tsc 0 after each cluster; commit per cluster; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; no `-n` near `git commit`.

## Module → contract mapping

| Module | Contracts object | Calls |
|---|---|---|
| grades.ts | `learningContracts` | getMine→`listGrades`(200 raw) · getStudentGrades→`studentGrades`(params id, 200 raw) · create→`createGrade`(201 raw) |
| memorization.ts | `learningContracts` | getMine/getStudentProgress→`getMemorization`(query studentId?, 200 raw) · updateProgress→`updateMemorization`(params surahId, 200 raw) · getSurahs→`listSurahs`(200 raw) |
| revisions.ts | `learningContracts` | getMyRevisions→`listRevisions` · createRevision→`createRevision`(201) · markRevision→`markRevision` · deleteRevision→`deleteRevision`(status per contract) |
| mushaf.ts | `mushafContracts` | getSurah→`surahAyahs`(params id, envelope) · getPage→`page`(params page, envelope) · logMemorization→`logMemorization` |
| certificates.ts | `certificatesContracts` | list→`listCertificates`(query studentId?, envelope) · regenerateLink→`regenerateLink`(envelope) · downloadUrl/verifyUrl→build from `API_ORIGIN` (keep `?token=` param) |
| account.ts | `accountContracts` | exportMyData→`exportMyData`(envelope) · deleteMyAccount→`deleteMyAccount`(void) |
| teacherChange.ts | `schedulingContracts`+`usersContracts` | submit→`submitTeacherChange` · list→`listTeacherChanges`(query status?) · decide→`decideTeacherChange` · listTeachers→`usersContracts.listTeachers`(raw) |
| appointments.ts | `schedulingContracts` | getMine→`listAppointments`(raw) · create→`createAppointment` · manage→`manageAppointment`(params id) |
| attendance.ts | `schedulingContracts` | record→`recordAttendance`(params id) · list→`listAttendance`(query studentId?) |
| roster.ts | `rosterContracts` | getHealth→`health`(envelope) |
| weakAyahs.ts | `weakAyahsContracts` | flag→`flag`(envelope) · list→`list`(envelope) |
| curriculumPlans.ts | `curriculumPlansContracts` | create→`create`(envelope) · list→`list`(envelope) |
| recurringSlots.ts | `recurringSlotsContracts` | create→`create`(envelope) · list→`list`(envelope) · cancel→`cancel`(envelope) |
| ijazahs.ts | `ijazahsContracts` | issue→`issue`(envelope) · list→`list`(envelope) · regenerateLink→`regenerateLink`(envelope) · verifyUrl→`API_ORIGIN` |
| reports.ts | `mediaContracts` | getReports→`listReports`(raw) · createReport→`generateReport`(201 raw) · downloadReport→HOLDOUT (WebBrowser + `API_ORIGIN` + `?token=`) |
| recordings.ts | `mediaContracts` | list/getRecordings→`listRecordings`(raw) · reviewRecording→`reviewRecording`(raw; body via `as never` — contract pins NO validation) · deleteRecording→`deleteRecording`(raw `{message}`) · upload stays axios (multipart) |
| users.ts | `usersContracts`+`adminContracts` | getProfile→`getProfile`(RAW pinned) · listAll→`adminContracts.listUsers`(query limit, paginated `{data,meta}` raw ⇒ `.data`) · updateProfile→`updateProfile` · changePassword→`changePassword` |
| notifications.ts | `communicationContracts` | list→`listNotifications`(raw `{data,meta}`) · unreadCount→`unreadNotificationCount`(envelope) · markAllRead→`markAllNotificationsRead`(envelope) · markRead→`markNotificationRead`(envelope) |
| messages.ts | `communicationContracts`+`adminContracts` | getConversations/getThread→`listMessages`(raw, query partnerId?) · send→`sendMessage`(201 raw) · markRead→`markMessageRead` · broadcast→`adminContracts.broadcast` |
| parents.ts | `progressContracts`+`parentLinksContracts` | listLinks→`listParentLinks`(env) · requestLink→`requestParentLink`(201 env) · searchStudent→`parentStudentSearch`(env) · listChildren→`parentChildren`(env) · getChildDashboard→`childDashboard`(env) · setDigestPreference→`parentLinksContracts.setDigestPreference` (match old unwrap `res.data`) · decideConsent→`parentLinksContracts.decideConsent` (match old unwrap) |
| milestones.ts | `milestonesContracts` | create→`create`(env) · list→`list`(env) |
| analytics.ts | `progressContracts` | getAdminAnalytics→`adminAnalytics`(env) |
| halaqa.ts | `halaqaContracts` | list→`listRooms` · create→`createRoom`(201) · get→`getRoom` · start→`startRoom` · end→`endRoom` · groups list→`listGroups` · groups create→`createGroup`(201) · groups get→`getGroup` (all envelopes) |
| **HOLDOUT** auth.ts | — | login/register/refresh/logout stay axios: the auth store owns interceptor installation + credential lifecycle; migrating is an M13-scope decision |

Before each module: open its contract file once to confirm success status codes (200/201/204) and declared `request` slots — pass only declared slots; body-less pinned contracts take `body: x as never`.

## Worked examples (the three unwrap shapes)

**Raw response (grades.getMine):**
```ts
import { learningContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

getMine: async (): Promise<Grade[]> => {
  const res = expectStatus(await contractClient.call(learningContracts.listGrades), 200);
  return res.body as unknown as Grade[];
},
getStudentGrades: async (studentId: string): Promise<Grade[]> => {
  const res = expectStatus(
    await contractClient.call(learningContracts.studentGrades, { params: { id: studentId } }),
    200
  );
  return res.body as unknown as Grade[];
},
```

**Envelope (halaqa.get):**
```ts
get: async (id: string): Promise<HalaqaRoom> => {
  const res = expectStatus(await contractClient.call(halaqaContracts.getRoom, { params: { id } }), 200);
  return (res.body as unknown as { data: HalaqaRoom }).data;
},
```

**Pinned body-less contract that still takes a body (recordings.reviewRecording):**
```ts
reviewRecording: async (id: string, body: ReviewRecordingBody): Promise<Recording> => {
  const res = expectStatus(
    await contractClient.call(mediaContracts.reviewRecording, {
      params: { id },
      body: body as never, // contract pins NO validation; body passes through untyped
    }),
    200
  );
  return res.body as unknown as Recording;
},
```

**contract.ts addition (Task 1):** `export const API_ORIGIN = ORIGIN;` — URL builders become e.g. `` `${API_ORIGIN}/api/v1/files/certificates/${certId}?token=${encodeURIComponent(token)}` ``.

---

### Task 0: Branch + plan doc
- [ ] `git checkout -b feat/rebuild-m10-12`; commit plan: `docs(m10-12): typed-client adoption plan (mechanical half)`

### Task 1 (M10 — student cluster): grades, memorization, revisions, mushaf, certificates, account, teacherChange
- [ ] Add `export const API_ORIGIN = ORIGIN;` to `mobile/src/api/contract.ts`
- [ ] Migrate the 7 modules per the mapping table (check each contract's declared statuses/slots first)
- [ ] `cd mobile && npx tsc --noEmit` → 0
- [ ] Commit `feat(m10): student-cluster API modules on the typed contract client`

### Task 2 (M11 — teacher cluster): appointments, attendance, roster, weakAyahs, curriculumPlans, recurringSlots, ijazahs, reports, recordings (JSON parts)
- [ ] Migrate per table; recordings upload + reports download stay axios/WebBrowser with a holdout comment
- [ ] `npx tsc --noEmit` → 0
- [ ] Commit `feat(m11): teacher-cluster API modules on the typed contract client`

### Task 3 (M12 — admin/parent/shared): users, notifications, messages, parents, milestones, analytics, halaqa
- [ ] Migrate per table; auth.ts untouched with a holdout comment block at top
- [ ] `npx tsc --noEmit` → 0; `npm run check-i18n` still OK
- [ ] `grep -rln "from './client'" mobile/src/api` → only the documented holdouts (auth.ts, recordings.ts, reports.ts) plus client/interceptors themselves
- [ ] Commit `feat(m12): admin/parent/shared API modules on the typed contract client`

### Task 4: Close out
- [ ] `tasks/todo.md`: mark M10–M12 **mechanical halves** done with counts (modules migrated / holdouts); add explicit `[ ]` items for the three per-cluster UX mini-brainstorms awaiting the user (spec §6).
- [ ] Final gates: mobile tsc 0; check-i18n OK; `git diff --stat main -- packages/` empty.
- [ ] Commit `docs(m10-12): mark typed-client adoption complete; UX brainstorms pending`; merge to `main`, no push.

## Verification
- Per-cluster mobile tsc 0; final grep proves axios remains only in the documented holdouts.
- Runtime: a single device smoke test (login → one migrated screen per cluster) validates the shared fetch path — user follow-up, noted in todo.

## Self-review notes
- Signatures preserved everywhere — return-shape fidelity mapped line-by-line from the axios originals surveyed 2026-07-10.
- `users.listAll` unwraps `res.data.data ?? res.data` today; `adminContracts.listUsers` returns the paginated `{data,meta}` raw — new code `.data` matches.
- `messages.getConversations` returns the DUAL-shape raw body — the module already types it loosely; behavior unchanged.
