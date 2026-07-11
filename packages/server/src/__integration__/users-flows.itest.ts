import request from 'supertest';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const PW = 'Str0ngPass!x';

describe('GET /api/v1/users/profile', () => {
  it('200: RAW object (no envelope), lowercase role/status, relation fields present', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBeUndefined(); // M0-pinned surprise: raw object
    expect(res.body).toMatchObject({ id: u.id, email: u.email, role: 'student', status: 'active' });
    expect(res.body).toHaveProperty('emailVerifiedAt');
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body).toHaveProperty('assignedTeacher');
    expect(res.body).toHaveProperty('assignedStudents');
  });
});

describe('GET /api/v1/users/teachers', () => {
  it('200: RAW array of ACTIVE teachers only, {id,firstName,lastName}, sorted by firstName', async () => {
    await createUser({ role: Role.TEACHER, email: 'zz-active@example.com' });
    await createUser({ role: Role.TEACHER, status: UserStatus.PENDING, email: 'aa-pending@example.com' });
    await createUser({ role: Role.STUDENT, email: 'student@example.com' });
    const viewer = await createUser({ role: Role.STUDENT, email: 'viewer@example.com' });

    const res = await request(app).get('/api/v1/users/teachers').set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1); // pending teacher + students excluded
    expect(Object.keys(res.body[0]).sort()).toEqual(['firstName', 'id', 'lastName']);
  });
});

describe('PUT /api/v1/users/profile', () => {
  it('200: updates names, returns raw lowercase-mapped object', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ firstName: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ firstName: 'Renamed', role: 'student', status: 'active' });
    expect(res.body).toHaveProperty('createdAt');
  });
});

describe('PUT /api/v1/users/change-password', () => {
  it('401 when currentPassword is wrong', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const res = await request(app)
      .put('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ currentPassword: 'WrongPass1!', newPassword: 'N3wPass!word' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Current password is incorrect');
  });

  it('200: old password stops working, new one logs in', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const res = await request(app)
      .put('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ currentPassword: PW, newPassword: 'N3wPass!word' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Password changed successfully' });

    const oldLogin = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'N3wPass!word' });
    expect(newLogin.status).toBe(200);
  });
});

describe('POST /api/v1/users/device-token', () => {
  it('200 {saved:true}', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/users/device-token')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ deviceToken: 'expo-push-token-123' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: true });
  });

  it('400 when deviceToken is missing (schema validation)', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/users/device-token')
      .set('Authorization', `Bearer ${u.token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Validation failed: deviceToken:/);
  });
});
