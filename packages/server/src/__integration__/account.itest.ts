import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('GET /api/v1/account/data-export', () => {
  it('returns everything tied to the caller and nothing tied to anyone else', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const otherStudent = await createUser({ role: Role.STUDENT, email: 'other@example.com' });

    await prisma.appointment.create({
      data: { studentId: student.id, teacherId: teacher.id, requestedDate: new Date(), requestedTime: '10:00' },
    });
    await prisma.appointment.create({
      data: {
        studentId: otherStudent.id,
        teacherId: teacher.id,
        requestedDate: new Date(),
        requestedTime: '11:00',
      },
    });

    const res = await request(app).get('/api/v1/account/data-export').set('Authorization', `Bearer ${student.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.id).toBe(student.id);
    expect(res.body.data.appointments.asStudent).toHaveLength(1);
    expect(res.body.data.appointments.asStudent[0].studentId).toBe(student.id);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/account/data-export');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/account', () => {
  it('self-deletes: anonymizes the caller exactly like the admin path, and logs future auth out', async () => {
    const student = await createUser({ role: Role.STUDENT });

    const res = await request(app).delete('/api/v1/account').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const anonymized = await prisma.user.findUnique({ where: { id: student.id } });
    expect(anonymized?.status).toBe('BANNED');
    expect(anonymized?.deletedAt).not.toBeNull();
    expect(anonymized?.email).toContain('deleted-');

    // The same (now-stale) token should no longer authenticate — the account is BANNED.
    const after = await request(app).get('/api/v1/account/data-export').set('Authorization', `Bearer ${student.token}`);
    expect(after.status).toBe(401);
  });
});
