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
    data: {
      studentId: student.id,
      teacherId: teacher.id,
      requestedDate: new Date(),
      requestedTime: '10:00',
      status: 'ACCEPTED',
    },
  });
}

async function send(from: TestUser, to: TestUser, content: string) {
  return agent
    .post('/api/v1/messages')
    .set('Authorization', `Bearer ${from.token}`)
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
    expect(res.body[0].senderId).toBeUndefined(); // NOT a raw Message
  });

  it('with ?partnerId → raw Message[] with sender+receiver includes', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    await send(teacher, student, 'salam');

    const res = await agent
      .get(`/api/v1/messages?partnerId=${teacher.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      senderId: teacher.id,
      receiverId: student.id,
      content: 'salam',
      type: 'TEXT',
    });
    expect(res.body[0].sender).toMatchObject({ id: teacher.id });
    expect(res.body[0].partner).toBeUndefined(); // NOT a summary
  });

  it('?partnerId guards: unknown partner 404; student→student 403; unlinked pair 403; admin bypasses', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const student2 = await createUser({ role: Role.STUDENT });
    const unlinkedTeacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });

    const ghost = await agent
      .get(`/api/v1/messages?partnerId=${FAKE_ID}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(ghost.status).toBe(404);
    expect(ghost.body).toMatchObject({ success: false, error: 'User not found' });

    const peer = await agent
      .get(`/api/v1/messages?partnerId=${student2.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(peer.status).toBe(403);
    expect(peer.body).toMatchObject({
      success: false,
      error: 'Messaging is limited to assigned teacher-student relationships',
    });

    const unlinked = await agent
      .get(`/api/v1/messages?partnerId=${unlinkedTeacher.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(unlinked.status).toBe(403);
    expect(unlinked.body).toMatchObject({ success: false, error: 'No accepted appointment with this user' });

    const viaAdmin = await agent
      .get(`/api/v1/messages?partnerId=${student.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(viaAdmin.status).toBe(200); // ADMIN bypass (pinned)
  });
});

describe('messages — POST + mark read', () => {
  it('POST 201 raw message with sender include; type defaults TEXT', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const res = await send(student, teacher, 'question');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      senderId: student.id,
      receiverId: teacher.id,
      type: 'TEXT',
      content: 'question',
    });
    expect(res.body.sender).toMatchObject({ id: student.id });
    expect(res.body.success).toBeUndefined();
  });

  it('POST self-message 400; unknown receiver 404', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const self = await agent
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ receiverId: admin.id, content: 'hi' });
    expect(self.status).toBe(400);
    expect(self.body).toMatchObject({ success: false, error: 'Cannot message yourself' });

    const ghost = await agent
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ receiverId: FAKE_ID, content: 'hi' });
    expect(ghost.status).toBe(404);
    expect(ghost.body).toMatchObject({ success: false, error: 'Receiver not found' });
  });

  it('PUT /:id/read: receiver 200 {message}; sender 403 Permission denied; unknown 404', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const sent = await send(teacher, student, 'salam');

    const bySender = await agent
      .put(`/api/v1/messages/${sent.body.id}/read`)
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(bySender.status).toBe(403);
    expect(bySender.body).toMatchObject({ success: false, error: 'Permission denied' });

    const byReceiver = await agent
      .put(`/api/v1/messages/${sent.body.id}/read`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(byReceiver.status).toBe(200);
    expect(byReceiver.body).toEqual({ message: 'Marked as read' });

    const ghost = await agent.put(`/api/v1/messages/${FAKE_ID}/read`).set('Authorization', `Bearer ${student.token}`);
    expect(ghost.status).toBe(404);
    expect(ghost.body).toMatchObject({ success: false, error: 'Message not found' });
  });
});

describe('notifications', () => {
  it('GET / returns paginatedResponse shape (data+meta, NO success field)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    await send(teacher, student, 'salam'); // notifyNewMessage persists a notification

    const res = await agent.get('/api/v1/notifications').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBeUndefined(); // pinned: NOT the success envelope
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ userId: student.id, type: 'new_message', readAt: null });
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  it('unread-count, PATCH /:id/read, then read-all — pinned envelopes', async () => {
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
    expect(one.body.data.readAt).not.toBeNull();

    const all = await agent.post('/api/v1/notifications/read-all').set('Authorization', `Bearer ${student.token}`);
    expect(all.status).toBe(200);
    expect(all.body).toEqual({ success: true, data: { markedRead: 0 } }); // the only one is already read
  });

  it('PATCH unknown/foreign id → 404 Notification not found', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await agent
      .patch(`/api/v1/notifications/${FAKE_ID}/read`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'Notification not found' });
  });
});
