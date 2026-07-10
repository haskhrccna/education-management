# M8 Halaqa Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (session precedent: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the 8 halaqa HTTP endpoints onto contract routing with behavior pinned first, and pin the Socket.IO room/WebRTC-signaling/presence protocol with its first-ever tests, then delete the legacy route/controller.

**Architecture:** Two halves. (1) HTTP: the routine M2–M7 strangler swap — pin, contract, module, delete. (2) Realtime: `services/socket.service.ts` is already a clean service wired from `server.ts` (NOT `app.ts`), so the itest harness has never exercised it — zero coverage today. M8 characterizes it in place with a live Socket.IO server + `socket.io-client`: auth handshake, join/leave presence (DB attendance rows + room broadcasts), pure-relay offer/answer/ICE forwarding, disconnect auto-leave. The socket service itself is NOT rewritten — it is pinned.

**Tech Stack:** Express 5 · Zod v4 contracts · Prisma 6 · Socket.IO 4.8 (`socket.io` server dep exists; `socket.io-client` added to server devDeps — currently only hoisted via mobile) · Jest 30 integration harness.

## Context

Spec §5 M8 = "Halaqa realtime — socket rooms, WebRTC signaling, presence". The halaqa HTTP router is the **last legacy Express router** (after M8 only docs/metrics/verify utility mounts remain, deferred to M13). The socket protocol (`socket.service.ts:10-98`): JWT handshake via `handshake.auth.token` or Authorization header; every socket joins a personal room named by userId; `halaqa:join`/`halaqa:leave` record attendance via `halaqaService.recordJoin/recordLeave` and broadcast `halaqa:participant-joined/-left` to `halaqa:<roomId>`; `halaqa:offer/answer/ice-candidate` relay `{roomId, fromUserId, sdp|candidate}` to the target's personal room without inspecting payloads; disconnect auto-leaves all `halaqa:*` rooms.

## Global Constraints (spec + session rules)

- Error bodies byte-identical to pins; `meta.requestId` present — use `toMatchObject`.
- "Fix the handler/contract, never the pin."
- Manifest `endpoint-manifest.ts` halaqa entries (8, all `'authenticated'`) stay untouched; role gates are handler-level (pinned messages), NOT contract `access` arrays — parity requires access `'authenticated'`.
- Route-order hazard: `/groups` must register before `/:id` (the legacy router comments this; the contract module preserves it via array order).
- The legacy router applies `standardLimiter` inside the router ON TOP of the mount-level one (double-limited today); the module keeps only the mount-level limiter — behaviorally identical (same limiter; test env bypasses).
- Zod v4 `z.looseObject`; interfaces-vs-looseObject trap (M6); shared supertest agent; phantom-flake rerun rule; Jest 30 `--testPathPatterns`; commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; never pair `git commit` with `-n`-bearing commands (hook false-positive). Branch `feat/rebuild-m8` off `main`.

## Legacy behavior inventory (what gets pinned)

**HTTP** (all mount: `authenticate, standardLimiter`; envelope `{success:true,data}`):

| Endpoint | Behavior |
|---|---|
| GET /halaqa/groups | teacher's own groups, `createdAt desc` |
| POST /halaqa/groups | handler gates: non-TEACHER/ADMIN 403 `Only teachers can create halaqa groups`; 400 `title is required`; 400 `attendanceThreshold is required` (non-number); service 400 `attendanceThreshold must be a positive number`; 201 |
| GET /halaqa/groups/:id | owner/admin/attendee; others+unknown ⇒ 404 `Group not found` (not-yours-is-not-found) |
| GET /halaqa | default WAITING+LIVE only; `?status=ENDED` filter; teacher include + `_count.participants` |
| POST /halaqa | 403 `Only teachers can create rooms`; 400 `title is required`; optional groupId (foreign group ⇒ 404 `Group not found`); 201 with teacher include |
| GET /halaqa/:id | 404 `Room not found`; active participants (leftAt null) with user include |
| PATCH /halaqa/:id/start | owner-only 403 `Only the room teacher can start this session`; 409 `Room is not in WAITING state`; 200 LIVE+startedAt |
| PATCH /halaqa/:id/end | owner-or-admin 403 `Only the room teacher or an admin can end this session`; 409 `Room is already ended`; closes open participants; best-effort group-streak recompute (already pinned by halaqa-groups.itest.ts — don't duplicate) |

**Socket** (currently untested):

| Event | Pinned behavior |
|---|---|
| handshake | no token ⇒ `connect_error` message `Authentication required`; garbage token ⇒ `Invalid or expired token`; valid JWT ⇒ connected, auto-joined to personal room `<userId>` |
| `halaqa:join {roomId}` | upserts HalaqaParticipant (joinedAt refreshed, leftAt null); broadcasts `halaqa:participant-joined {roomId, userId}` to others in `halaqa:<roomId>`; joining an ENDED room ⇒ `halaqa:error {message:'Room has ended'}` (410 AppError message), unknown ⇒ `Room not found` |
| `halaqa:leave {roomId}` | sets leftAt; broadcasts `halaqa:participant-left {roomId, userId}` |
| `halaqa:offer/answer {roomId,targetUserId,sdp}` | relayed verbatim to target personal room as `{roomId, fromUserId, sdp}` — sender identity is server-stamped |
| `halaqa:ice-candidate {roomId,targetUserId,candidate}` | same relay with `candidate` |
| disconnect | auto `recordLeave` + `participant-left` broadcast for every joined `halaqa:*` room |

## File Structure

**Create**
- `packages/server/src/__integration__/halaqa-flows.itest.ts` — HTTP pins (green against legacy first)
- `packages/server/src/__integration__/halaqa-socket.itest.ts` — socket protocol pins (new coverage; same code before/after swap since socket.service is untouched)
- `packages/shared/src/contracts/halaqa.contracts.ts` — `halaqaContracts` (8)
- `packages/server/src/modules/halaqa/halaqa.module.ts`

**Modify**
- `packages/server/package.json` — devDependencies += `"socket.io-client": "^4.8.3"` (run `npm install` from repo root)
- `packages/shared/src/contracts/registry.ts`, `packages/shared/src/index.ts`
- `packages/server/src/__tests__/contract-schemas.test.ts` — registry count 98→106
- `packages/server/src/app.ts` — halaqa mount swap
- `tasks/todo.md`

**Delete (Task 4)**
- `packages/server/src/routes/halaqa.routes.ts`, `packages/server/src/controllers/halaqa.controller.ts` (no controller test exists — the controllers/__tests__ dir is already gone)
- Keep: `services/halaqa.service.ts` (+ its unit test), `services/socket.service.ts` (pinned, not touched).

---

### Task 0: Branch + plan doc + devDep

- [ ] `git checkout -b feat/rebuild-m8`
- [ ] Commit this plan: `docs(m8): halaqa realtime implementation plan`
- [ ] `npm install --save-dev socket.io-client@^4.8.3 -w packages/server` (from repo root); commit `package.json` + `package-lock.json`: `chore(m8): socket.io-client devDep for socket protocol pins`

### Task 1: Pin HTTP behavior (halaqa-flows.itest.ts)

**Files:** Create `packages/server/src/__integration__/halaqa-flows.itest.ts`
**Interfaces:** factory/db helpers as in every flows suite; shared agent. Don't re-pin what `halaqa-groups.itest.ts` already covers (group create/streak/visibility) — pin the gaps: rooms lifecycle + group validation messages.

- [ ] **Step 1: Write the pins.**

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const agent = request.agent(app);
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

describe('halaqa rooms', () => {
  it('POST /: student 403 pinned; missing title 400; teacher 201 with teacher include', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });

    const denied = await agent.post('/api/v1/halaqa').set('Authorization', `Bearer ${student.token}`)
      .send({ title: 'Halaqa' });
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ success: false, error: 'Only teachers can create rooms' });

    const noTitle = await agent.post('/api/v1/halaqa').set('Authorization', `Bearer ${teacher.token}`).send({});
    expect(noTitle.status).toBe(400);
    expect(noTitle.body).toMatchObject({ success: false, error: 'title is required' });

    const created = await agent.post('/api/v1/halaqa').set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: '  Morning Halaqa  ' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ title: 'Morning Halaqa', status: 'WAITING', teacherId: teacher.id });
    expect(created.body.data.teacher).toMatchObject({ id: teacher.id });

    const foreignGroup = await agent.post('/api/v1/halaqa').set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'x', groupId: FAKE_ID });
    expect(foreignGroup.status).toBe(404);
    expect(foreignGroup.body.error).toBe('Group not found');
  });

  it('GET /: default lists WAITING+LIVE only; ?status=ENDED filters; _count.participants present', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const mk = (title: string) =>
      agent.post('/api/v1/halaqa').set('Authorization', `Bearer ${teacher.token}`).send({ title });
    const a = await mk('a');
    const b = await mk('b');
    await agent.patch(`/api/v1/halaqa/${b.body.data.id}/start`).set('Authorization', `Bearer ${teacher.token}`);
    await agent.patch(`/api/v1/halaqa/${b.body.data.id}/end`).set('Authorization', `Bearer ${teacher.token}`);

    const open = await agent.get('/api/v1/halaqa').set('Authorization', `Bearer ${student.token}`);
    expect(open.status).toBe(200);
    expect(open.body.data).toHaveLength(1);
    expect(open.body.data[0]).toMatchObject({ id: a.body.data.id });
    expect(open.body.data[0]._count).toMatchObject({ participants: 0 });

    const ended = await agent.get('/api/v1/halaqa?status=ENDED').set('Authorization', `Bearer ${student.token}`);
    expect(ended.body.data).toHaveLength(1);
    expect(ended.body.data[0]).toMatchObject({ id: b.body.data.id, status: 'ENDED' });
  });

  it('lifecycle: start owner-only + WAITING-only; end owner-or-admin + not-twice; GET /:id 404', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const otherTeacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    const created = await agent.post('/api/v1/halaqa').set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'l' });
    const roomId = created.body.data.id;

    const notOwner = await agent.patch(`/api/v1/halaqa/${roomId}/start`)
      .set('Authorization', `Bearer ${otherTeacher.token}`);
    expect(notOwner.status).toBe(403);
    expect(notOwner.body.error).toBe('Only the room teacher can start this session');

    const started = await agent.patch(`/api/v1/halaqa/${roomId}/start`).set('Authorization', `Bearer ${teacher.token}`);
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('LIVE');
    expect(started.body.data.startedAt).not.toBeNull();

    const again = await agent.patch(`/api/v1/halaqa/${roomId}/start`).set('Authorization', `Bearer ${teacher.token}`);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('Room is not in WAITING state');

    const endDenied = await agent.patch(`/api/v1/halaqa/${roomId}/end`)
      .set('Authorization', `Bearer ${otherTeacher.token}`);
    expect(endDenied.status).toBe(403);
    expect(endDenied.body.error).toBe('Only the room teacher or an admin can end this session');

    const endedByAdmin = await agent.patch(`/api/v1/halaqa/${roomId}/end`).set('Authorization', `Bearer ${admin.token}`);
    expect(endedByAdmin.status).toBe(200);
    expect(endedByAdmin.body.data.status).toBe('ENDED');

    const endTwice = await agent.patch(`/api/v1/halaqa/${roomId}/end`).set('Authorization', `Bearer ${teacher.token}`);
    expect(endTwice.status).toBe(409);
    expect(endTwice.body.error).toBe('Room is already ended');

    const ghost = await agent.get(`/api/v1/halaqa/${FAKE_ID}`).set('Authorization', `Bearer ${teacher.token}`);
    expect(ghost.status).toBe(404);
    expect(ghost.body.error).toBe('Room not found');
  });
});

describe('halaqa group validation gaps (create/streak/visibility already pinned in halaqa-groups.itest.ts)', () => {
  it('POST /groups: missing threshold 400 pinned; non-positive 400 service message; GET /groups lists own desc', async () => {
    const teacher = await createUser({ role: Role.TEACHER });

    const missing = await agent.post('/api/v1/halaqa/groups').set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'g' });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('attendanceThreshold is required');

    const nonPositive = await agent.post('/api/v1/halaqa/groups').set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'g', attendanceThreshold: 0 });
    expect(nonPositive.status).toBe(400);
    expect(nonPositive.body.error).toBe('attendanceThreshold must be a positive number');

    await agent.post('/api/v1/halaqa/groups').set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'g1', attendanceThreshold: 2 });
    const list = await agent.get('/api/v1/halaqa/groups').set('Authorization', `Bearer ${teacher.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ title: 'g1', attendanceThreshold: 2, teacherId: teacher.id });
  });
});
```

- [ ] **Step 2:** `cd packages/server && npx jest -c jest.integration.config.js --runInBand --testPathPatterns=halaqa-flows` → green against legacy.
- [ ] **Step 3: Commit** `test(m8): pin halaqa HTTP behavior before swap`

### Task 2: Pin the socket protocol (halaqa-socket.itest.ts)

**Files:** Create `packages/server/src/__integration__/halaqa-socket.itest.ts`
**Interfaces:** Consumes `setupSocketIO`/`closeSocketIO` from `../services/socket.service`, `io as Client` from `socket.io-client`, factory (`createUser` for JWTs), prisma for attendance assertions, `http.createServer(app)` on an ephemeral port.

- [ ] **Step 1: Write the pins.**

```ts
import http from 'http';
import { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { setupSocketIO, closeSocketIO } from '../services/socket.service';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

let server: http.Server;
let url: string;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  setupSocketIO(server);
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(truncateAll);

afterEach(() => {
  for (const c of clients.splice(0)) c.disconnect();
});

afterAll(async () => {
  await closeSocketIO();
  await new Promise<void>((r) => server.close(() => r()));
  await disconnect();
});

function connect(token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = Client(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
    clients.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

function waitFor<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

/** Poll until the async server-side effect lands (max ~3s). */
async function until(cond: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 30; i++) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('condition not met within 3s');
}

async function liveRoom(teacher: TestUser) {
  const room = await prisma.halaqaRoom.create({ data: { teacherId: teacher.id, title: 'live', status: 'LIVE' } });
  return room.id;
}

describe('handshake auth (pinned)', () => {
  it('rejects missing token with Authentication required', async () => {
    await expect(connect()).rejects.toMatchObject({ message: 'Authentication required' });
  });

  it('rejects a garbage token with Invalid or expired token', async () => {
    await expect(connect('not-a-jwt')).rejects.toMatchObject({ message: 'Invalid or expired token' });
  });

  it('accepts a valid JWT', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const socket = await connect(student.token);
    expect(socket.connected).toBe(true);
  });
});

describe('presence: join/leave record attendance and broadcast (pinned)', () => {
  it('join upserts a participant row and notifies existing members; leave sets leftAt and notifies', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const roomId = await liveRoom(teacher);

    const teacherSock = await connect(teacher.token);
    teacherSock.emit('halaqa:join', { roomId });
    await until(async () => (await prisma.halaqaParticipant.count({ where: { roomId } })) === 1);

    const studentSock = await connect(student.token);
    const joined = waitFor<{ roomId: string; userId: string }>(teacherSock, 'halaqa:participant-joined');
    studentSock.emit('halaqa:join', { roomId });
    expect(await joined).toEqual({ roomId, userId: student.id });

    const row = await prisma.halaqaParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: student.id } },
    });
    expect(row?.leftAt).toBeNull();

    const left = waitFor<{ roomId: string; userId: string }>(teacherSock, 'halaqa:participant-left');
    studentSock.emit('halaqa:leave', { roomId });
    expect(await left).toEqual({ roomId, userId: student.id });
    const after = await prisma.halaqaParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: student.id } },
    });
    expect(after?.leftAt).not.toBeNull();
  });

  it('joining an ENDED room emits halaqa:error with the pinned message', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const room = await prisma.halaqaRoom.create({ data: { teacherId: teacher.id, title: 'x', status: 'ENDED' } });
    const sock = await connect(teacher.token);
    const errP = waitFor<{ message: string }>(sock, 'halaqa:error');
    sock.emit('halaqa:join', { roomId: room.id });
    expect(await errP).toEqual({ message: 'Room has ended' });
  });

  it('disconnect auto-leaves: participant row closed and others notified', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const roomId = await liveRoom(teacher);
    const teacherSock = await connect(teacher.token);
    teacherSock.emit('halaqa:join', { roomId });
    await until(async () => (await prisma.halaqaParticipant.count({ where: { roomId } })) === 1);
    const studentSock = await connect(student.token);
    const joined = waitFor(teacherSock, 'halaqa:participant-joined');
    studentSock.emit('halaqa:join', { roomId });
    await joined;

    const left = waitFor<{ roomId: string; userId: string }>(teacherSock, 'halaqa:participant-left');
    studentSock.disconnect();
    expect(await left).toEqual({ roomId, userId: student.id });
  });
});

describe('WebRTC signaling: pure relay stamped with fromUserId (pinned)', () => {
  it('offer, answer and ICE are forwarded to the target personal room without payload inspection', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const roomId = await liveRoom(teacher);
    const a = await connect(teacher.token);
    const b = await connect(student.token);

    const offer = waitFor<{ roomId: string; fromUserId: string; sdp: unknown }>(b, 'halaqa:offer');
    a.emit('halaqa:offer', { roomId, targetUserId: student.id, sdp: { type: 'offer', blob: 'x' } });
    expect(await offer).toEqual({ roomId, fromUserId: teacher.id, sdp: { type: 'offer', blob: 'x' } });

    const answer = waitFor<{ roomId: string; fromUserId: string; sdp: unknown }>(a, 'halaqa:answer');
    b.emit('halaqa:answer', { roomId, targetUserId: teacher.id, sdp: { type: 'answer' } });
    expect(await answer).toEqual({ roomId, fromUserId: student.id, sdp: { type: 'answer' } });

    const ice = waitFor<{ roomId: string; fromUserId: string; candidate: unknown }>(b, 'halaqa:ice-candidate');
    a.emit('halaqa:ice-candidate', { roomId, targetUserId: student.id, candidate: { c: 1 } });
    expect(await ice).toEqual({ roomId, fromUserId: teacher.id, candidate: { c: 1 } });
  });
});
```

- [ ] **Step 2:** `npx jest -c jest.integration.config.js --runInBand --testPathPatterns=halaqa-socket` → green (this is NEW coverage of UNCHANGED code — failures mean the pin is written wrong; fix the test to match observed behavior).
- [ ] **Step 3: Commit** `test(m8): pin socket room/WebRTC-signaling/presence protocol (first socket coverage)`

### Task 3: Contracts — halaqa.contracts.ts

**Files:** Create `packages/shared/src/contracts/halaqa.contracts.ts`; modify `registry.ts`, `index.ts`, `contract-schemas.test.ts` (98→106)
**Interfaces (produces):** `halaqaContracts.{listGroups,createGroup,getGroup,listRooms,createRoom,getRoom,startRoom,endRoom}`.

- [ ] **Step 1:** All access `'authenticated'` (manifest parity; role gates live in handlers):

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';

const Ok = <T extends z.ZodType>(data: T) => z.looseObject({ success: z.literal(true), data });

const GroupRow = z.looseObject({
  id: z.string(),
  teacherId: z.string(),
  title: z.string(),
  attendanceThreshold: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
});

const RoomRow = z.looseObject({
  id: z.string(),
  teacherId: z.string(),
  title: z.string(),
  status: z.enum(['WAITING', 'LIVE', 'ENDED']),
  groupId: z.string().nullable(),
  startedAt: DateOut.nullable(),
  endedAt: DateOut.nullable(),
});

export const halaqaContracts = {
  listGroups: defineContract({
    method: 'GET',
    path: '/api/v1/halaqa/groups',
    summary: "Teacher's own groups, createdAt desc",
    access: 'authenticated',
    responses: { 200: Ok(z.array(GroupRow)), 401: ErrorEnvelope },
  }),
  createGroup: defineContract({
    method: 'POST',
    path: '/api/v1/halaqa/groups',
    summary: 'Handler-gated TEACHER/ADMIN; manual body validation (pinned messages)',
    access: 'authenticated',
    responses: { 201: Ok(GroupRow), 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  getGroup: defineContract({
    method: 'GET',
    path: '/api/v1/halaqa/groups/:id',
    summary: 'Owner/admin/attendee; others get 404 (not-yours-is-not-found, pinned)',
    access: 'authenticated',
    responses: { 200: Ok(GroupRow), 401: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  listRooms: defineContract({
    method: 'GET',
    path: '/api/v1/halaqa',
    summary: 'Default WAITING+LIVE; ?status= filter; teacher include + _count.participants',
    access: 'authenticated',
    responses: { 200: Ok(z.array(RoomRow)), 401: ErrorEnvelope },
  }),
  createRoom: defineContract({
    method: 'POST',
    path: '/api/v1/halaqa',
    summary: 'Handler-gated TEACHER/ADMIN; title trimmed; optional groupId must be own group',
    access: 'authenticated',
    responses: { 201: Ok(RoomRow), 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  getRoom: defineContract({
    method: 'GET',
    path: '/api/v1/halaqa/:id',
    summary: 'Room with active participants (leftAt null) + user includes',
    access: 'authenticated',
    responses: { 200: Ok(RoomRow), 401: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  startRoom: defineContract({
    method: 'PATCH',
    path: '/api/v1/halaqa/:id/start',
    summary: 'Owner-only; WAITING→LIVE once (409 otherwise)',
    access: 'authenticated',
    responses: { 200: Ok(RoomRow), 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
  }),
  endRoom: defineContract({
    method: 'PATCH',
    path: '/api/v1/halaqa/:id/end',
    summary: 'Owner-or-admin; closes participants; best-effort group streak recompute; 409 if already ended',
    access: 'authenticated',
    responses: { 200: Ok(RoomRow), 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
  }),
};
```

- [ ] **Step 2:** registry import+spread, index re-export, count 98→106.
- [ ] **Step 3:** `npx jest --testPathPatterns=contract-schemas` + `npx jest -c jest.integration.config.js --runInBand --testPathPatterns='registry-parity|completeness'` → green.
- [ ] **Step 4: Commit** `feat(m8): halaqa contracts`

### Task 4: Swap module + delete legacy

**Files:** Create `modules/halaqa/halaqa.module.ts`; modify `app.ts`; delete `routes/halaqa.routes.ts`, `controllers/halaqa.controller.ts`
**Interfaces:** Consumes `halaqaContracts` + untouched `halaqa.service`. Produces `halaqaRouter` (`/api/v1/halaqa`). **Array order: groups routes FIRST** (`/groups` before `/:id`).

- [ ] **Step 1: halaqa.module.ts** — handlers mirror the controller (manual gates/validation verbatim):

```ts
import { halaqaContracts } from '@quran-review/shared';
import * as halaqaService from '../../services/halaqa.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listGroups = defineRoute(halaqaContracts.listGroups, async ({ userId }) => {
  const groups = await halaqaService.listGroups(userId!);
  return { status: 200 as const, body: { success: true as const, data: groups } };
});

const createGroup = defineRoute(halaqaContracts.createGroup, async ({ userId, userRole, req }) => {
  if (userRole !== 'TEACHER' && userRole !== 'ADMIN') {
    throw new AppError(403, 'Only teachers can create halaqa groups');
  }
  const { title, attendanceThreshold } = (req.body ?? {}) as { title?: string; attendanceThreshold?: number };
  if (!title || !title.trim()) throw new AppError(400, 'title is required');
  if (typeof attendanceThreshold !== 'number') throw new AppError(400, 'attendanceThreshold is required');
  const group = await halaqaService.createGroup(userId!, title.trim(), attendanceThreshold);
  return { status: 201 as const, body: { success: true as const, data: group } };
});

const getGroup = defineRoute(halaqaContracts.getGroup, async ({ userId, userRole, params }) => {
  const group = await halaqaService.getGroup(String(params.id), userId!, userRole!);
  return { status: 200 as const, body: { success: true as const, data: group } };
});

const listRooms = defineRoute(halaqaContracts.listRooms, async ({ query }) => {
  const status = typeof query.status === 'string' ? query.status : undefined;
  const rooms = await halaqaService.listRooms(status);
  return { status: 200 as const, body: { success: true as const, data: rooms } };
});

const createRoom = defineRoute(halaqaContracts.createRoom, async ({ userId, userRole, req }) => {
  if (userRole !== 'TEACHER' && userRole !== 'ADMIN') throw new AppError(403, 'Only teachers can create rooms');
  const { title, groupId } = (req.body ?? {}) as { title?: string; groupId?: string };
  if (!title || !title.trim()) throw new AppError(400, 'title is required');
  const room = await halaqaService.createRoom(userId!, title.trim(), groupId);
  return { status: 201 as const, body: { success: true as const, data: room } };
});

const getRoom = defineRoute(halaqaContracts.getRoom, async ({ params }) => {
  const room = await halaqaService.getRoom(String(params.id));
  return { status: 200 as const, body: { success: true as const, data: room } };
});

const startRoom = defineRoute(halaqaContracts.startRoom, async ({ userId, params }) => {
  const room = await halaqaService.startRoom(String(params.id), userId!);
  return { status: 200 as const, body: { success: true as const, data: room } };
});

const endRoom = defineRoute(halaqaContracts.endRoom, async ({ userId, userRole, params }) => {
  const room = await halaqaService.endRoom(String(params.id), userId!, userRole!);
  return { status: 200 as const, body: { success: true as const, data: room } };
});

// Groups before rooms: '/groups' must register ahead of '/:id' (legacy router pinned this ordering).
export const halaqaRouter = buildContractRouter(
  [listGroups, createGroup, getGroup, listRooms, createRoom, getRoom, startRoom, endRoom],
  { mountPrefix: '/api/v1/halaqa' }
);
```

- [ ] **Step 2: app.ts.** Remove `halaqaRoutes` import; add `import { halaqaRouter } from './modules/halaqa/halaqa.module';`; swap the mount: `app.use('/api/v1/halaqa', authenticate, standardLimiter, halaqaRouter);`
- [ ] **Step 3:** Delete `routes/halaqa.routes.ts`, `controllers/halaqa.controller.ts`.
- [ ] **Step 4: Full gate.** Full itest suite (halaqa-flows + halaqa-socket + halaqa-groups + matrix all green) + unit suite + tsc server/shared.
- [ ] **Step 5: Commit** `feat(m8): halaqa on contract routing; last legacy router deleted`

### Task 5: Close out M8

- [ ] **Step 1:** `tasks/todo.md`: `[x] M8 halaqa realtime (2026-07-10) — 8 HTTP endpoints swapped (last legacy Express router retired); Socket.IO room/WebRTC-signaling/presence protocol pinned with its first tests (handshake auth, join/leave attendance + broadcasts, pure-relay offer/answer/ICE, disconnect auto-leave) (<final counts>). Plan: docs/superpowers/plans/2026-07-10-m8-halaqa-realtime.md.` Next: `[ ] M9 mobile foundation — generated client, TanStack persister/offline, theming/i18n cleanup. Next: superpowers:writing-plans for M9.`
- [ ] **Step 2:** Final gate re-run; paste counts.
- [ ] **Step 3: Commit** `docs(m8): mark M8 complete`
- [ ] **Step 4:** finishing-a-development-branch — merge into `main` locally per pattern; no push unless asked.

## Verification

- HTTP pins green against legacy, untouched through Task 4; socket pins are before/after invariant (socket.service unchanged).
- `authz-matrix` (all 8 halaqa endpoints × 5 identities), `halaqa-groups.itest.ts` (streak semantics), `registry-parity`, `completeness` all unmodified.
- Socket suite must close its server + clients in afterAll/afterEach — `forceExit` hides leaks, don't rely on it.

## Self-review notes

- Spec's three M8 items (socket rooms, WebRTC signaling, presence) all live in Task 2's pins; the HTTP swap covers the halaqa router named in the milestone table.
- Route-order (`/groups` before `/:id`) is preserved by array order and exercised by both flows suites (`GET /halaqa/groups` returning groups, not a room 404).
- The double-standardLimiter quirk is dropped knowingly (documented in Global Constraints) — same limiter instance, no observable behavior change.
