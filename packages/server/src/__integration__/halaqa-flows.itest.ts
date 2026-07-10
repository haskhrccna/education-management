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

    const denied = await agent
      .post('/api/v1/halaqa')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ title: 'Halaqa' });
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ success: false, error: 'Only teachers can create rooms' });

    const noTitle = await agent.post('/api/v1/halaqa').set('Authorization', `Bearer ${teacher.token}`).send({});
    expect(noTitle.status).toBe(400);
    expect(noTitle.body).toMatchObject({ success: false, error: 'title is required' });

    const created = await agent
      .post('/api/v1/halaqa')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: '  Morning Halaqa  ' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ title: 'Morning Halaqa', status: 'WAITING', teacherId: teacher.id });
    expect(created.body.data.teacher).toMatchObject({ id: teacher.id });

    const foreignGroup = await agent
      .post('/api/v1/halaqa')
      .set('Authorization', `Bearer ${teacher.token}`)
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
    const created = await agent
      .post('/api/v1/halaqa')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'l' });
    const roomId = created.body.data.id;

    const notOwner = await agent
      .patch(`/api/v1/halaqa/${roomId}/start`)
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

    const endDenied = await agent
      .patch(`/api/v1/halaqa/${roomId}/end`)
      .set('Authorization', `Bearer ${otherTeacher.token}`);
    expect(endDenied.status).toBe(403);
    expect(endDenied.body.error).toBe('Only the room teacher or an admin can end this session');

    const endedByAdmin = await agent
      .patch(`/api/v1/halaqa/${roomId}/end`)
      .set('Authorization', `Bearer ${admin.token}`);
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
  it('POST /groups: missing threshold 400 pinned; non-positive 400 service message; GET /groups lists own', async () => {
    const teacher = await createUser({ role: Role.TEACHER });

    const missing = await agent
      .post('/api/v1/halaqa/groups')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'g' });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('attendanceThreshold is required');

    const nonPositive = await agent
      .post('/api/v1/halaqa/groups')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'g', attendanceThreshold: 0 });
    expect(nonPositive.status).toBe(400);
    expect(nonPositive.body.error).toBe('attendanceThreshold must be a positive number');

    await agent
      .post('/api/v1/halaqa/groups')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'g1', attendanceThreshold: 2 });
    const list = await agent.get('/api/v1/halaqa/groups').set('Authorization', `Bearer ${teacher.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ title: 'g1', attendanceThreshold: 2, teacherId: teacher.id });
  });
});
