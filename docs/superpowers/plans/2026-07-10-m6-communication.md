# M6 Communication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (session precedent: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the 7 remaining communication endpoints — messages (3, with the GET dual response shape pinned) and notifications (4) — onto contract routing with behavior pinned first, then delete the legacy routes/controllers/mock tests.

**Architecture:** Same strangler pattern as M2–M5: pin observed behavior with black-box itests against the legacy routes, declare contracts in shared, build `defineRoute` modules delegating to the untouched services, remount in app.ts (messages keeps its `/api/messages` legacy mirror; notifications has none), delete legacy code with the full suite green. No DSL changes needed — all 7 responses are JSON (M5's `rawResponse` machinery is not involved).

**Tech Stack:** Express 5 · Zod v4 contracts (`@quran-review/shared`) · Prisma 6 · Jest 30 integration harness (real Postgres 5433, `jest.integration.config.js`).

## Context

Spec §5 defines M6 as "Communication — messages (dual shape pinned), notifications, FCM, broadcast". Two of those four items are **already done**: `POST /api/v1/admin/broadcast` was swapped in M2b (`modules/admin/admin.module.ts:103`, `adminContracts.broadcast`, `broadcastLimiter` in `pre`) and FCM device-token registration (`POST /api/v1/users/device-token`) was swapped in M2a (users module). FCM *sending* lives in services (`notification.service` → push lib) and has no route surface. So M6's remaining scope is exactly `message.routes.ts` + `notification.routes.ts`.

The load-bearing pin (documented in CLAUDE.md): **`GET /api/v1/messages` returns two different shapes** — without `?partnerId` it returns conversation summaries `{partner, lastMessage, unreadCount}[]`; with `?partnerId=<id>` it returns raw `Message[]`. The contract expresses this as a union.

After M6, the only legacy routers left are gamification/certificates/analytics/parents (M7), halaqa (M8), plus docs/metrics/verify (M13 hardening).

## Global Constraints (spec + session rules)

- Error bodies byte-identical to M0 pins: 403 role-gate `{success:false,error:'Insufficient permissions'}`; validation 400 `Validation failed: <field>: <msg>, ...`; 401 `{success:false,error:'Authentication required'}`; error envelopes carry `meta.requestId` — pin with `toMatchObject`, never `toEqual`.
- "Fix the handler/contract, never the pin."
- Paths/methods/access unchanged — `endpoint-manifest.ts:59-62,125-129` entries stay untouched; `/api/v1/messages` is in `LEGACY_PREFIXES` (mirror), notifications is not.
- Zod v4, `z.looseObject` row shapes (style: `media.contracts.ts`).
- Jest 30 `--testPathPatterns`; integration: `cd packages/server && npx jest -c jest.integration.config.js --runInBand`; docker `server-db-test-1` on 5433 must be up.
- Shared supertest agent (`request.agent(app)`) in new itest suites — per-request `request(app)` caused phantom-response flakes in M5.
- `validate()` (`validate.middleware.ts:8`) only parses — it does NOT replace `req.body`, so unknown fields like `attachmentUrl` survive to the handler. Read them from `req.body`, not the typed contract body.
- Known intermittent flake: a full-suite run can show 1–3 "phantom response" failures where the server log has no matching request — rerun before investigating.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; `--no-verify` blocked. Branch `feat/rebuild-m6` off `main`.

## Legacy behavior inventory (what gets pinned)

| Endpoint | Access | Chain (mount → route) | Response |
|---|---|---|---|
| GET /api/v1/messages | authenticated | authenticate, standardLimiter → paginate(20,100) | **Dual shape.** No `?partnerId`: conversation summaries `[{partner:{id,firstName,lastName}, lastMessage:{id,content,type,createdAt,readAt,sentByMe}, unreadCount}]` (unpaginated). With `?partnerId`: raw `Message[]` (sender+receiver includes, `createdAt desc`, skip/limit from paginate) — 404 `User not found` (unknown/deleted partner), 403 `Messaging is limited to assigned teacher-student relationships` (e.g. student→student), 403 `No accepted appointment with this user` (unlinked teacher-student pair). ADMIN bypasses both checks. |
| POST /api/v1/messages | authenticated | validate(SendMessageSchema: receiverId uuid, content 1–2000, type TEXT\|FILE optional) | 201 raw Message with `sender` include; `type` defaults 'TEXT'; `attachmentUrl` read from req.body (outside schema — pinned); 400 `Cannot message yourself`; 404 `Sender/Receiver not found`; 403 same two comm errors; fires `notifyNewMessage` side effect |
| PUT /api/v1/messages/:id/read | authenticated | — | 200 `{message:'Marked as read'}`; 404 `Message not found`; 403 `Permission denied` (caller isn't receiver) |
| GET /api/v1/notifications | authenticated | paginate(20,100) | 200 `{data: items, meta:{page,limit,total,totalPages,hasNext,hasPrev}}` (paginatedResponse — note: NO `success` field) |
| POST /api/v1/notifications/read-all | authenticated | — | 200 `{success:true, data:{markedRead:<count>}}` |
| GET /api/v1/notifications/unread-count | authenticated | — | 200 `{success:true, data:{unread:<n>}}` |
| PATCH /api/v1/notifications/:id/read | authenticated | — | 200 `{success:true, data:<notification>}`; 404 `Notification not found` (service throws plain `Error('Notification not found')` — the controller maps it to AppError(404); this mapping moves into the module handler) |

## File Structure

**Create**
- `packages/server/src/__integration__/communication-flows.itest.ts` — behavior pins (green against legacy first)
- `packages/shared/src/contracts/communication.contracts.ts` — `communicationContracts` (7)
- `packages/server/src/modules/messages/messages.module.ts`
- `packages/server/src/modules/notifications/notifications.module.ts`

**Modify**
- `packages/shared/src/contracts/registry.ts`, `packages/shared/src/index.ts` — register/export
- `packages/server/src/__tests__/contract-schemas.test.ts` — registry count 81→88 + dual-shape fixture
- `packages/server/src/app.ts` — swap 3 mounts (v1 messages + notifications + legacy `/api/messages` mirror)
- `packages/server/src/__integration__/route-inventory.ts` — `CONTRACT_MIRRORS` += `'/api/v1/messages': '/api/messages'`
- `packages/server/src/__tests__/security.test.ts` — port the message-ownership test to `messageService.markAsRead` (service still exists; controller goes away)
- `tasks/todo.md` — mark M6 done, point at M7

**Delete (Task 3, after suites green)**
- `packages/server/src/routes/message.routes.ts`, `packages/server/src/routes/notification.routes.ts`
- `packages/server/src/controllers/message.controller.ts`, `packages/server/src/controllers/notification.controller.ts`
- `packages/server/src/controllers/__tests__/message.controller.test.ts`, `packages/server/src/controllers/__tests__/notification.controller.test.ts`
- Keep: `services/message.service.ts`, `services/notification.service.ts` and their service tests.

---

### Task 0: Branch + plan doc

- [ ] `git checkout -b feat/rebuild-m6` (from `main`)
- [ ] This plan file is already at `docs/superpowers/plans/2026-07-10-m6-communication.md`; commit it: `docs(m6): communication implementation plan`

### Task 1: Pin legacy behavior (communication-flows.itest.ts)

**Files:** Create `packages/server/src/__integration__/communication-flows.itest.ts`
**Interfaces:** Consumes `createUser` from `./factory`, `truncateAll`/`disconnect` from `./db`; module-level `const agent = request.agent(app)`. Seeds per test: linked teacher+student (ACCEPTED appointment via `prisma.appointment.create`), plus admin/second-student as needed.

- [ ] **Step 1: Write the pins.**

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const agent = request.agent(app);
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

async function linkAccepted(student: TestUser, teacher: TestUser) {
  await prisma.appointment.create({
    data: { studentId: student.id, teacherId: teacher.id, requestedDate: new Date(), requestedTime: '10:00', status: 'ACCEPTED' },
  });
}

async function send(from: TestUser, to: TestUser, content: string) {
  return agent.post('/api/v1/messages').set('Authorization', `Bearer ${from.token}`)
    .send({ receiverId: to.id, content });
}

describe('messages — GET dual shape (pinned)', () => {
  it('without ?partnerId → conversation summaries {partner,lastMessage,unreadCount}', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    await send(teacher, student, 'salam');

    const res = await agent.get('/api/v1/messages').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].partner).toMatchObject({ id: teacher.id });
    expect(res.body[0].lastMessage).toMatchObject({ content: 'salam', sentByMe: false });
    expect(res.body[0].unreadCount).toBe(1);
    expect(res.body[0].senderId).toBeUndefined();          // NOT a raw Message
  });

  it('with ?partnerId → raw Message[] with sender+receiver includes', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    await send(teacher, student, 'salam');

    const res = await agent.get(`/api/v1/messages?partnerId=${teacher.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ senderId: teacher.id, receiverId: student.id, content: 'salam', type: 'TEXT' });
    expect(res.body[0].sender).toMatchObject({ id: teacher.id });
    expect(res.body[0].partner).toBeUndefined();           // NOT a summary
  });

  it('?partnerId guards: unknown partner 404; student→student 403 relationship text; unlinked pair 403 appointment text; admin bypasses', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const student2 = await createUser({ role: Role.STUDENT });
    const unlinkedTeacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });

    const ghost = await agent.get(`/api/v1/messages?partnerId=${FAKE_ID}`).set('Authorization', `Bearer ${student.token}`);
    expect(ghost.status).toBe(404);
    expect(ghost.body).toMatchObject({ success: false, error: 'User not found' });

    const peer = await agent.get(`/api/v1/messages?partnerId=${student2.id}`).set('Authorization', `Bearer ${student.token}`);
    expect(peer.status).toBe(403);
    expect(peer.body).toMatchObject({ success: false, error: 'Messaging is limited to assigned teacher-student relationships' });

    const unlinked = await agent.get(`/api/v1/messages?partnerId=${unlinkedTeacher.id}`).set('Authorization', `Bearer ${student.token}`);
    expect(unlinked.status).toBe(403);
    expect(unlinked.body).toMatchObject({ success: false, error: 'No accepted appointment with this user' });

    const viaAdmin = await agent.get(`/api/v1/messages?partnerId=${student.id}`).set('Authorization', `Bearer ${admin.token}`);
    expect(viaAdmin.status).toBe(200);                     // ADMIN bypass (pinned)
  });
});

describe('messages — POST + mark read', () => {
  it('POST 201 raw message with sender include; type defaults TEXT', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const res = await send(student, teacher, 'question');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ senderId: student.id, receiverId: teacher.id, type: 'TEXT', content: 'question' });
    expect(res.body.sender).toMatchObject({ id: student.id });
    expect(res.body.success).toBeUndefined();
  });

  it('POST self-message 400; unknown receiver 404', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const self = await agent.post('/api/v1/messages').set('Authorization', `Bearer ${admin.token}`)
      .send({ receiverId: admin.id, content: 'hi' });
    expect(self.status).toBe(400);
    expect(self.body).toMatchObject({ success: false, error: 'Cannot message yourself' });

    const ghost = await agent.post('/api/v1/messages').set('Authorization', `Bearer ${admin.token}`)
      .send({ receiverId: FAKE_ID, content: 'hi' });
    expect(ghost.status).toBe(404);
    expect(ghost.body).toMatchObject({ success: false, error: 'Receiver not found' });
  });

  it('PUT /:id/read: receiver 200 {message}; sender 403 Permission denied; unknown 404', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const sent = await send(teacher, student, 'salam');

    const bySender = await agent.put(`/api/v1/messages/${sent.body.id}/read`).set('Authorization', `Bearer ${teacher.token}`);
    expect(bySender.status).toBe(403);
    expect(bySender.body).toMatchObject({ success: false, error: 'Permission denied' });

    const byReceiver = await agent.put(`/api/v1/messages/${sent.body.id}/read`).set('Authorization', `Bearer ${student.token}`);
    expect(byReceiver.status).toBe(200);
    expect(byReceiver.body).toEqual({ message: 'Marked as read' });

    const ghost = await agent.put(`/api/v1/messages/${FAKE_ID}/read`).set('Authorization', `Bearer ${student.token}`);
    expect(ghost.status).toBe(404);
  });

  it('legacy mirror GET /api/messages behaves identically', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await agent.get('/api/messages').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('notifications', () => {
  it('GET / returns paginatedResponse shape (data+meta, NO success field)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    await send(teacher, student, 'salam');               // notifyNewMessage persists a notification

    const res = await agent.get('/api/v1/notifications').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBeUndefined();            // pinned: NOT the success envelope
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it('unread-count → {success:true,data:{unread}}; PATCH /:id/read → {success:true,data}; read-all → {markedRead}', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    await send(teacher, student, 'one');

    const count = await agent.get('/api/v1/notifications/unread-count').set('Authorization', `Bearer ${student.token}`);
    expect(count.status).toBe(200);
    expect(count.body).toEqual({ success: true, data: { unread: 1 } });

    const feed = await agent.get('/api/v1/notifications').set('Authorization', `Bearer ${student.token}`);
    const nid = feed.body.data[0].id;
    const one = await agent.patch(`/api/v1/notifications/${nid}/read`).set('Authorization', `Bearer ${student.token}`);
    expect(one.status).toBe(200);
    expect(one.body.success).toBe(true);
    expect(one.body.data.id).toBe(nid);

    const all = await agent.post('/api/v1/notifications/read-all').set('Authorization', `Bearer ${student.token}`);
    expect(all.status).toBe(200);
    expect(all.body).toEqual({ success: true, data: { markedRead: 0 } });   // already read — adjust to observed
  });

  it('PATCH unknown/foreign id → 404 Notification not found', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await agent.patch(`/api/v1/notifications/${FAKE_ID}/read`).set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'Notification not found' });
  });
});
```

Where a value is guessed (e.g. `markedRead: 0`, unread counts — `notifyNewMessage` may or may not persist a Notification row depending on its implementation), run once against legacy, read the observed value, hard-code it. If `notifyNewMessage` does NOT persist rows, seed via `prisma.notification.create` instead.
- [ ] **Step 2:** `cd packages/server && npx jest -c jest.integration.config.js --runInBand --testPathPatterns=communication-flows` → green against legacy.
- [ ] **Step 3: Commit** `test(m6): pin messages (dual shape) + notifications behavior before swap`

### Task 2: Contracts — communication.contracts.ts + registry

**Files:** Create `packages/shared/src/contracts/communication.contracts.ts`; modify `registry.ts`, `index.ts`, `packages/server/src/__tests__/contract-schemas.test.ts`
**Interfaces (produces):** `communicationContracts.{listMessages,sendMessage,markMessageRead,listNotifications,markNotificationRead,markAllNotificationsRead,unreadNotificationCount}` — consumed by Task 3 modules.

- [ ] **Step 1:** Write the 7 contracts (access copied from manifest so registry-parity passes):

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { SendMessageSchema } from '../validators/common';

const MiniUser = z.looseObject({ id: z.string(), firstName: z.string(), lastName: z.string() });

const MessageRow = z.looseObject({
  id: z.string(),
  senderId: z.string(),
  receiverId: z.string(),
  type: z.enum(['TEXT', 'FILE']),
  content: z.string(),
  attachmentUrl: z.string().nullable(),
  readAt: DateOut.nullable(),
  createdAt: DateOut,
});

const ConversationSummary = z.looseObject({
  partner: MiniUser,
  lastMessage: z.looseObject({
    id: z.string(),
    content: z.string(),
    type: z.enum(['TEXT', 'FILE']),
    createdAt: DateOut,
    readAt: DateOut.nullable(),
    sentByMe: z.boolean(),
  }),
  unreadCount: z.number(),
});

const NotificationRow = z.looseObject({
  id: z.string(),
  userId: z.string(),
  readAt: DateOut.nullable(),
  createdAt: DateOut,
});

const PaginationMeta = z.looseObject({
  page: z.number(), limit: z.number(), total: z.number(),
  totalPages: z.number(), hasNext: z.boolean(), hasPrev: z.boolean(),
});

export const communicationContracts = {
  listMessages: defineContract({
    method: 'GET',
    path: '/api/v1/messages',
    summary: 'DUAL SHAPE (pinned): no ?partnerId ⇒ conversation summaries; ?partnerId ⇒ raw Message[]',
    access: 'authenticated',
    responses: {
      200: z.union([z.array(ConversationSummary), z.array(MessageRow)]),
      401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope,
    },
  }),
  sendMessage: defineContract({
    method: 'POST',
    path: '/api/v1/messages',
    summary: 'Send within teacher↔student (ACCEPTED appt) or with ADMIN; attachmentUrl passes outside the schema (pinned)',
    access: 'authenticated',
    request: { body: SendMessageSchema },
    responses: { 201: MessageRow, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  markMessageRead: defineContract({
    method: 'PUT',
    path: '/api/v1/messages/:id/read',
    summary: 'Receiver-only mark read',
    access: 'authenticated',
    responses: {
      200: z.object({ message: z.literal('Marked as read') }),
      401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope,
    },
  }),
  listNotifications: defineContract({
    method: 'GET',
    path: '/api/v1/notifications',
    summary: 'paginatedResponse {data,meta} — deliberately NOT the success envelope (pinned)',
    access: 'authenticated',
    responses: { 200: z.looseObject({ data: z.array(NotificationRow), meta: PaginationMeta }), 401: ErrorEnvelope },
  }),
  markAllNotificationsRead: defineContract({
    method: 'POST',
    path: '/api/v1/notifications/read-all',
    summary: 'Bulk mark read',
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.object({ markedRead: z.number() }) }),
      401: ErrorEnvelope,
    },
  }),
  unreadNotificationCount: defineContract({
    method: 'GET',
    path: '/api/v1/notifications/unread-count',
    summary: 'Badge source',
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.object({ unread: z.number() }) }),
      401: ErrorEnvelope,
    },
  }),
  markNotificationRead: defineContract({
    method: 'PATCH',
    path: '/api/v1/notifications/:id/read',
    summary: 'Owner-only; service plain Error("Notification not found") maps to 404 in the handler (pinned)',
    access: 'authenticated',
    responses: {
      200: z.looseObject({ success: z.literal(true), data: NotificationRow }),
      401: ErrorEnvelope, 404: ErrorEnvelope,
    },
  }),
};
```

Verify `NotificationRow` field names against `prisma/schema.prisma`'s Notification model before finalizing (keep it loose — id/userId/readAt/createdAt only if others differ).
- [ ] **Step 2:** `registry.ts`: `import { communicationContracts } from './communication.contracts';` + `...Object.values(communicationContracts)`. `index.ts`: `export * from './contracts/communication.contracts';`
- [ ] **Step 3:** `contract-schemas.test.ts`: bump registry count 81→88; add a dual-shape fixture test — a conversation-summary array AND a raw-message array both parse against `listMessages.responses[200]`.
- [ ] **Step 4:** `npx jest --testPathPatterns=contract-schemas` green; `npx jest -c jest.integration.config.js --runInBand --testPathPatterns='registry-parity|completeness'` green.
- [ ] **Step 5: Commit** `feat(m6): communication contracts (messages dual shape + notifications)`

### Task 3: Swap modules + delete legacy

**Files:** Create `modules/messages/messages.module.ts`, `modules/notifications/notifications.module.ts`; modify `app.ts`, `route-inventory.ts`, `__tests__/security.test.ts`; delete legacy files
**Interfaces:** Consumes `communicationContracts`, `defineRoute`/`buildContractRouter`, `paginate`/`PaginatedRequest`/`paginatedResponse` from `../../middleware/pagination.middleware`, untouched `message.service` and `notification.service`. Produces `messagesRouter` (`/api/v1/messages`), `notificationsRouter` (`/api/v1/notifications`).

- [ ] **Step 1: messages.module.ts.**

```ts
import { communicationContracts } from '@quran-review/shared';
import * as messageService from '../../services/message.service';
import { paginate, PaginatedRequest } from '../../middleware/pagination.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listMessages = defineRoute(
  communicationContracts.listMessages,
  async ({ query, userId, req }) => {
    const { limit = 20, skip = 0 } = (req as PaginatedRequest).pagination || {};
    const partnerId = query.partnerId as string | undefined;
    if (partnerId) {
      const messages = await messageService.getMessagesWithUser(userId!, partnerId, skip, limit);
      return { status: 200 as const, body: messages };
    }
    const conversations = await messageService.getConversations(userId!);
    return { status: 200 as const, body: conversations };
  },
  { pre: [paginate(20, 100)] }
);

const sendMessage = defineRoute(communicationContracts.sendMessage, async ({ body, userId, req }) => {
  // attachmentUrl deliberately read from req.body: validate() does not strip it,
  // and the legacy controller consumed it despite it being outside the schema (pinned).
  const attachmentUrl = (req.body as { attachmentUrl?: string }).attachmentUrl;
  const message = await messageService.sendMessage(
    userId!,
    body.receiverId,
    (body.type || 'TEXT') as 'TEXT' | 'FILE',
    body.content,
    attachmentUrl
  );
  return { status: 201 as const, body: message };
});

const markMessageRead = defineRoute(communicationContracts.markMessageRead, async ({ params, userId }) => {
  await messageService.markAsRead(String(params.id), userId!);
  return { status: 200 as const, body: { message: 'Marked as read' as const } };
});

export const messagesRouter = buildContractRouter([listMessages, sendMessage, markMessageRead], {
  mountPrefix: '/api/v1/messages',
});
```

- [ ] **Step 2: notifications.module.ts.**

```ts
import { communicationContracts } from '@quran-review/shared';
import { listNotifications, markRead, markAllRead, unreadCount } from '../../services/notification.service';
import { AppError } from '../../middleware/error.middleware';
import { paginate, PaginatedRequest, paginatedResponse } from '../../middleware/pagination.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const list = defineRoute(
  communicationContracts.listNotifications,
  async ({ userId, req }) => {
    const page = (req as PaginatedRequest).pagination?.page ?? 1;
    const limit = (req as PaginatedRequest).pagination?.limit ?? 20;
    const { items, total } = await listNotifications(userId!, page, limit);
    return { status: 200 as const, body: paginatedResponse(items, total, page, limit) };
  },
  { pre: [paginate(20, 100)] }
);

const markOne = defineRoute(communicationContracts.markNotificationRead, async ({ params, userId }) => {
  try {
    const updated = await markRead(String(params.id), userId!);
    return { status: 200 as const, body: { success: true as const, data: updated } };
  } catch (e: unknown) {
    // Service throws plain Error('Notification not found') when id missing or not owned (pinned mapping)
    if (e instanceof Error && e.message === 'Notification not found') throw new AppError(404, 'Notification not found');
    throw e;
  }
});

const markAll = defineRoute(communicationContracts.markAllNotificationsRead, async ({ userId }) => {
  const { count } = await markAllRead(userId!);
  return { status: 200 as const, body: { success: true as const, data: { markedRead: count } } };
});

const unread = defineRoute(communicationContracts.unreadNotificationCount, async ({ userId }) => {
  const count = await unreadCount(userId!);
  return { status: 200 as const, body: { success: true as const, data: { unread: count } } };
});

export const notificationsRouter = buildContractRouter([list, markAll, unread, markOne], {
  mountPrefix: '/api/v1/notifications',
});
```

(The legacy controller's `if (!userId) throw new AppError(401,...)` guards are redundant under contract routing — `authenticate` in the chain already 401s; do not re-add them.)
- [ ] **Step 3: app.ts.** Remove `messageRoutes`/`notificationRoutes` imports; add the two module imports next to `reportsRouter`. Swap mounts (stacks preserved verbatim):
```ts
app.use('/api/v1/messages', authenticate, standardLimiter, messagesRouter);
app.use('/api/v1/notifications', authenticate, standardLimiter, notificationsRouter);
app.use('/api/messages', authenticate, standardLimiter, messagesRouter);   // legacy mirror
```
- [ ] **Step 4: route-inventory.ts.** `CONTRACT_MIRRORS` += `'/api/v1/messages': '/api/messages',` (notifications has no mirror — do NOT add one).
- [ ] **Step 5: security.test.ts.** Replace the `Message ownership` test's controller require with the service:
```ts
const { markAsRead } = require('../services/message.service');
await expect(markAsRead('msg-1', 'user-1')).rejects.toThrow('Permission denied');
```
(mock stays: `message.findUnique` resolves `{ id: 'msg-1', receiverId: 'user-2' }`).
- [ ] **Step 6:** Delete `routes/message.routes.ts`, `routes/notification.routes.ts`, `controllers/message.controller.ts`, `controllers/notification.controller.ts`, `controllers/__tests__/message.controller.test.ts`, `controllers/__tests__/notification.controller.test.ts`.
- [ ] **Step 7: Full gate.** `npx jest -c jest.integration.config.js --runInBand` (expect ≈1060 + new, incl. communication-flows and the untouched authz-matrix/envelope) + `npx jest` (unit, minus the two deleted controller suites) + `npx tsc --noEmit` in `packages/server` and `packages/shared` → all green.
- [ ] **Step 8: Commit** `feat(m6): messages (dual shape pinned) + notifications on contract routing; legacy deleted`

### Task 4: Close out M6

- [ ] **Step 1:** `tasks/todo.md`: `[x] M6 communication (2026-07-10) — 7 endpoints (messages dual-shape + notifications) swapped to contract routing, behavior pinned first; broadcast + FCM device-token were already contract-routed in M2a/M2b; legacy routes/controllers/mock tests deleted (<final counts>). Plan: docs/superpowers/plans/2026-07-10-m6-communication.md.` Next: `[ ] M7 progress & rewards — gamification, certificates, analytics, parents. Next: superpowers:writing-plans for M7.`
- [ ] **Step 2:** Final gate re-run; paste counts.
- [ ] **Step 3: Commit** `docs(m6): mark M6 complete`
- [ ] **Step 4:** superpowers:finishing-a-development-branch — expected choice per M0–M5 pattern: merge `feat/rebuild-m6` into `main` locally; do not push unless asked.

## Verification

- Task 1's suite green against legacy, then untouched through Task 3 — any diff means the new code is wrong.
- `authz-matrix` (127×5), `envelope`, `registry-parity`, `completeness` run unmodified.
- Dual-shape pin is the flagship check: both branches of `GET /messages` asserted structurally (summary has `partner`, raw has `senderId` — each asserts the other's discriminator is absent).

## Self-review notes

- Spec's four M6 items: messages + notifications get tasks here; broadcast (M2b) and FCM device-token (M2a) are already contract-routed — documented in Context so the milestone closes honestly.
- Notification 404 mapping (plain Error → AppError) moves controller→handler, not into the service — service unit tests stay valid.
- Type names consistent across tasks: `communicationContracts.*` keys in Task 2 match every reference in Task 3.
