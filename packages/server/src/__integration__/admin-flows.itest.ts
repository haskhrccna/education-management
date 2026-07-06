import request from 'supertest';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const PW = 'Str0ngPass!x';

describe('GET /api/v1/admin/users', () => {
  it('200: paginatedResponse envelope {data, meta} with role filter', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ role: Role.TEACHER, email: 't1@example.com' });
    await createUser({ role: Role.STUDENT, email: 's1@example.com' });

    const res = await request(app)
      .get('/api/v1/admin/users?role=teacher')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ email: 't1@example.com', role: 'TEACHER' });
    expect(res.body.data[0]).toHaveProperty('createdAt');
  });
});

describe('POST /api/v1/admin/teachers', () => {
  it('201: raw teacher echo, ACTIVE from birth', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'newt@example.com', password: PW, firstName: 'New', lastName: 'Teacher' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'newt@example.com', role: 'TEACHER', status: 'ACTIVE' });
    expect(res.body.success).toBeUndefined(); // raw echo, no envelope
  });

  it('409 on duplicate email', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const t = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: t.email, password: PW, firstName: 'Dup', lastName: 'Dup' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });
});

describe('PUT /api/v1/admin/users/:id/approve', () => {
  it('200: PENDING student → ACTIVE (raw user echo)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    const res = await request(app)
      .put(`/api/v1/admin/users/${s.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: s.id, status: 'ACTIVE' });
  });

  it('400 when target is not a student', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const t = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .put(`/api/v1/admin/users/${t.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('User is not a student');
  });

  it('404 for unknown id', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .put('/api/v1/admin/users/00000000-0000-4000-8000-000000000000/approve')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Student not found');
  });
});

describe('PUT /api/v1/admin/users/:id/deactivate', () => {
  it('200: user → BANNED', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .put(`/api/v1/admin/users/${s.id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: s.id, status: 'BANNED' });
  });
});

describe('GET /api/v1/admin/users/:id', () => {
  it('200: {user, analytics} composite; deviceToken NEVER leaks', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    await prisma.user.update({ where: { id: s.id }, data: { deviceToken: 'secret-push-token' } });

    const res = await request(app).get(`/api/v1/admin/users/${s.id}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: s.id, role: 'STUDENT' });
    expect(res.body.user.deviceToken).toBeUndefined();
    expect(res.body.analytics).toMatchObject({ totalAppointments: 0, totalGrades: 0, averageGrade: 0 });
    expect(res.body.analytics).toHaveProperty('memberSince');
  });

  it('404 for unknown id', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .get('/api/v1/admin/users/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/admin/users/:id', () => {
  it('200: partial update, raw echo with createdAt', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .put(`/api/v1/admin/users/${s.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ firstName: 'Zaid' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: s.id, firstName: 'Zaid' });
    expect(res.body).toHaveProperty('createdAt');
  });

  it('409 when email already in use', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const a = await createUser({ role: Role.STUDENT, email: 'a@example.com' });
    const b = await createUser({ role: Role.STUDENT, email: 'b@example.com' });
    const res = await request(app)
      .put(`/api/v1/admin/users/${b.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: a.email });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });

  it("400 'Invalid role' for PARENT — schema allows it, service rejects it (pinned quirk)", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .put(`/api/v1/admin/users/${s.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'PARENT' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid role');
  });
});

describe('DELETE /api/v1/admin/users/:id (soft delete)', () => {
  it('200 {id, deleted:true}; row anonymized, login dead', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, password: PW });
    const res = await request(app).delete(`/api/v1/admin/users/${s.id}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: s.id, deleted: true });

    const row = await prisma.user.findUnique({ where: { id: s.id } });
    expect(row!.email).toBe(`deleted-${s.id}@deleted.local`);
    expect(row!.firstName).toBe('Deleted User');
    expect(row!.deletedAt).not.toBeNull();

    const login = await request(app).post('/api/v1/auth/login').send({ email: s.email, password: PW });
    expect(login.status).toBe(401); // original email no longer exists on the row
  });
});

describe('GET /api/v1/admin/progress/*', () => {
  it('teachers: computed rows {id,email,name,acceptedAppointments,gradesGiven,averageGrade}', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ role: Role.TEACHER, email: 'prog-t@example.com' });
    const res = await request(app).get('/api/v1/admin/progress/teachers').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      email: 'prog-t@example.com',
      acceptedAppointments: 0,
      gradesGiven: 0,
      averageGrade: 0,
    });
    expect(res.body[0].name).toContain(' ');
  });

  it('teachers?teacherId=<unknown> → literal null body (pinned quirk)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .get('/api/v1/admin/progress/teachers?teacherId=00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('students: computed rows {gradesReceived, acceptedAppointments, averageGrade}', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ role: Role.STUDENT, email: 'prog-s@example.com' });
    const res = await request(app).get('/api/v1/admin/progress/students').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ email: 'prog-s@example.com', gradesReceived: 0, acceptedAppointments: 0 });
  });
});

describe('POST /api/v1/admin/broadcast', () => {
  it('200: {sent, message} + either queued:true (Redis) or numeric recipients (sync fallback)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/admin/broadcast')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ message: 'Assembly at 5pm' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sent: true, message: 'Assembly at 5pm' });
    expect(res.body.queued === true || typeof res.body.recipients === 'number').toBe(true);
  });
});

describe('POST /api/v1/admin/bulk/*', () => {
  it('bulk/approve: per-id results incl. "Already active" and "Student not found"', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const pending = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    const active = await createUser({ role: Role.STUDENT });
    const ghost = '00000000-0000-4000-8000-000000000000';
    const res = await request(app)
      .post('/api/v1/admin/bulk/approve')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ studentIds: [pending.id, active.id, ghost] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: pending.id, success: true },
      { id: active.id, success: false, reason: 'Already active' },
      { id: ghost, success: false, reason: 'Student not found' },
    ]);
  });

  it('bulk/deactivate: per-id results', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT });
    const ghost = '00000000-0000-4000-8000-000000000000';
    const res = await request(app)
      .post('/api/v1/admin/bulk/deactivate')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ userIds: [s.id, ghost] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: s.id, success: true },
      { id: ghost, success: false, reason: 'User not found' },
    ]);
  });
});

describe('legacy mirror /api/admin', () => {
  it('GET /api/admin/users behaves identically', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
  });
});
