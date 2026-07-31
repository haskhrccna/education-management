import request from 'supertest';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';
import { Role, UserStatus } from '@prisma/client';

beforeAll(truncateAll);
afterAll(disconnect);

describe('seed factory + JWT auth', () => {
  it('factory user token authenticates against GET /api/v1/users/profile', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    // Observed: getProfile returns the raw user object (role/status lowercased),
    // NOT the successResponse envelope — pinned as-is for the rebuild to reproduce.
    expect(res.body.email).toBe(student.email);
    expect(res.body.role).toBe('student');
  });

  it('BANNED user is rejected with 401', async () => {
    const banned = await createUser({ role: Role.STUDENT, status: UserStatus.BANNED });
    const res = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${banned.token}`);
    expect(res.status).toBe(401);
  });

  it('missing token is rejected with 401', async () => {
    const res = await request(app).get('/api/v1/users/profile');
    expect(res.status).toBe(401);
  });

  it('reflects a role change immediately, not just after token expiry', async () => {
    const user = await createUser({ role: Role.PARENT });
    const before = await request(app).get('/api/v1/parents/children').set('Authorization', `Bearer ${user.token}`);
    expect(before.status).toBe(200);

    await prisma.user.update({ where: { id: user.id }, data: { role: Role.STUDENT } });

    // Same still-valid token, but the account is no longer a PARENT server-side.
    const after = await request(app).get('/api/v1/parents/children').set('Authorization', `Bearer ${user.token}`);
    expect(after.status).toBe(403);
  });
});
