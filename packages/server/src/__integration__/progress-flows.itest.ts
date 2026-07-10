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

describe('gamification', () => {
  it('GET /me → {success,data:{streak,badges}} with zero-streak default', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await agent.get('/api/v1/gamification/me').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.streak).toMatchObject({ userId: student.id, currentStreak: 0, longestStreak: 0 });
    expect(res.body.data.badges).toEqual([]);
  });

  it('GET /leaderboard: default scope lists streak holders; teacher scope filters; empty teacher ⇒ []', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    await prisma.streak.create({
      data: { userId: student.id, currentStreak: 3, longestStreak: 5, lastActiveDate: new Date() },
    });
    await prisma.streak.create({
      data: { userId: other.id, currentStreak: 1, longestStreak: 1, lastActiveDate: new Date() },
    });

    const all = await agent.get('/api/v1/gamification/leaderboard').set('Authorization', `Bearer ${student.token}`);
    expect(all.status).toBe(200);
    expect(all.body.success).toBe(true);
    expect(all.body.data.length).toBeGreaterThanOrEqual(2);

    const scoped = await agent
      .get(`/api/v1/gamification/leaderboard?scope=teacher:${teacher.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(scoped.status).toBe(200);
    expect(scoped.body.data).toHaveLength(1);

    const empty = await agent
      .get(`/api/v1/gamification/leaderboard?scope=teacher:${FAKE_ID}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(empty.body.data).toEqual([]);
  });
});

describe('certificates listing', () => {
  it('student sees own; admin sees all + ?studentId filter; teacher → 403 pinned message', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/certificates/a.pdf' } });
    await prisma.certificate.create({ data: { studentId: other.id, pdfUrl: '/certificates/b.pdf' } });

    const own = await agent.get('/api/v1/certificates').set('Authorization', `Bearer ${student.token}`);
    expect(own.status).toBe(200);
    expect(own.body.success).toBe(true);
    expect(own.body.data).toHaveLength(1);
    expect(own.body.data[0].student).toMatchObject({ id: student.id });

    const all = await agent.get('/api/v1/certificates').set('Authorization', `Bearer ${admin.token}`);
    expect(all.body.data).toHaveLength(2);

    const filtered = await agent
      .get(`/api/v1/certificates?studentId=${other.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(filtered.body.data).toHaveLength(1);

    const denied = await agent.get('/api/v1/certificates').set('Authorization', `Bearer ${teacher.token}`);
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ success: false, error: 'Only students and admins can access certificates' });
  });
});

describe('analytics', () => {
  it('admin → successResponse({surahMissRates, teacherLoad, weeklyActiveStudents})', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await agent.get('/api/v1/analytics').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.surahMissRates)).toBe(true);
    expect(Array.isArray(res.body.data.teacherLoad)).toBe(true);
    expect(res.body.data.weeklyActiveStudents).toBeDefined();
  });
});

describe('parents', () => {
  it('POST /links: 201 PENDING link; missing studentId → 400 pinned; duplicate → 409 with status text', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });

    const missing = await agent.post('/api/v1/parents/links').set('Authorization', `Bearer ${parent.token}`).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ success: false, error: 'studentId is required' });

    const created = await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: student.id, reason: 'my child' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ parentId: parent.id, studentId: student.id, status: 'PENDING' });

    const dup = await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: student.id });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('A link already exists for this parent/student pair (status: PENDING)');

    const notStudent = await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: (await createUser({ role: Role.TEACHER })).id });
    expect(notStudent.status).toBe(400);
    expect(notStudent.body.error).toBe('Link target must be a student account');
  });

  it('decision flow: bad action 400; APPROVE 200 (idempotent); children + dashboard unlock; DENY-after-APPROVE 409', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const created = await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: student.id });
    const linkId = created.body.data.id;

    const bad = await agent
      .patch(`/api/v1/parents/links/${linkId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'MAYBE' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('action must be APPROVE or DENY');

    const approve = await agent
      .patch(`/api/v1/parents/links/${linkId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('APPROVED');

    const again = await agent
      .patch(`/api/v1/parents/links/${linkId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });
    expect(again.status).toBe(200); // idempotent (pinned)

    const children = await agent.get('/api/v1/parents/children').set('Authorization', `Bearer ${parent.token}`);
    expect(children.body.data).toHaveLength(1);
    expect(children.body.data[0]).toMatchObject({ linkId, student: { id: student.id } });

    const dash = await agent
      .get(`/api/v1/parents/children/${student.id}/dashboard`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(dash.status).toBe(200);
    expect(dash.body.data.student).toMatchObject({ id: student.id });
    expect(dash.body.data).toHaveProperty('memorization');
    expect(dash.body.data).toHaveProperty('upcomingAppointments');

    const deny = await agent
      .patch(`/api/v1/parents/links/${linkId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'DENY' });
    expect(deny.status).toBe(409);
    expect(deny.body.error).toBe('Cannot deny an approved link — admin must revoke separately');
  });

  it('dashboard without approved link → 403; GET /links role scoping; student-search 200/404', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const otherParent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    await agent
      .post('/api/v1/parents/links')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ studentId: student.id });

    const noLink = await agent
      .get(`/api/v1/parents/children/${student.id}/dashboard`)
      .set('Authorization', `Bearer ${otherParent.token}`);
    expect(noLink.status).toBe(403);
    expect(noLink.body.error).toBe('No approved link to this student');

    const mine = await agent.get('/api/v1/parents/links').set('Authorization', `Bearer ${otherParent.token}`);
    expect(mine.body.data).toEqual([]);
    const adminAll = await agent.get('/api/v1/parents/links').set('Authorization', `Bearer ${admin.token}`);
    expect(adminAll.body.data).toHaveLength(1);
    expect(adminAll.body.data[0].parent).toMatchObject({ id: parent.id });

    const found = await agent
      .get(`/api/v1/parents/student-search?email=${encodeURIComponent(student.email)}`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(found.status).toBe(200);
    expect(found.body.data).toMatchObject({ id: student.id, email: student.email });

    const missing = await agent
      .get('/api/v1/parents/student-search?email=nobody@example.com')
      .set('Authorization', `Bearer ${parent.token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('Student not found');
  });
});
