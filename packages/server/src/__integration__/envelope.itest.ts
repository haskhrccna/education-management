import request from 'supertest';
import app from '../app';
import { Role } from '@prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

const FAKE_ID = '00000000-0000-0000-0000-000000000000';

beforeAll(truncateAll);
afterAll(disconnect);

describe('response envelope characterization', () => {
  it('unknown route → 404 with { success: false, error: "Not found" }', async () => {
    const res = await request(app).get('/api/v1/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Not found' });
  });

  it('validation failure → 400 with { success: false, error: <string> }', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });

  it('auth failure → 401 with { success: false, error: <string> }', async () => {
    const res = await request(app).get('/api/v1/users/profile');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });

  it('success → { success: true, data: ... } with no error key', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).not.toHaveProperty('error');
  });

  it('SURPRISE (pinned): GET /users/profile returns a raw object, not the envelope', async () => {
    // getProfile does res.json({...user, role: lowercase}) — it bypasses successResponse.
    // Pinned so the M2 rebuild reproduces (or knowingly migrates) this shape.
    const user = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body.email).toBe(user.email);
    expect(res.body.role).toBe('student');
  });

  it('file download accepts JWT via ?token= query param (contract from CLAUDE.md)', async () => {
    const user = await createUser({ role: Role.STUDENT });
    // Nonexistent file id: asserts the auth path only — 401 without token, non-401 with it.
    const anon = await request(app).get(`/api/v1/files/recordings/${FAKE_ID}`);
    expect(anon.status).toBe(401);
    const withToken = await request(app).get(`/api/v1/files/recordings/${FAKE_ID}?token=${user.token}`);
    expect(withToken.status).not.toBe(401);
  });
});
