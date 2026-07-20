import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('F5 complete-onboarding', () => {
  it('stamps once and is idempotent; profile echoes it', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const first = await request(app)
      .post('/api/v1/account/complete-onboarding')
      .set('Authorization', `Bearer ${s.token}`);
    expect(first.status).toBe(200);
    const stamp = first.body.data.onboardingCompletedAt;
    expect(stamp).toBeTruthy();

    const second = await request(app)
      .post('/api/v1/account/complete-onboarding')
      .set('Authorization', `Bearer ${s.token}`);
    expect(second.body.data.onboardingCompletedAt).toBe(stamp); // idempotent — the wizard is unrepeatable

    const profile = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${s.token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.onboardingCompletedAt).toBe(stamp);
  });

  it('login user payload carries null before onboarding', async () => {
    await createUser({ role: Role.STUDENT, email: 'ob@x.com', password: 'Test1234!' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'ob@x.com', password: 'Test1234!' });
    expect(res.status).toBe(200);
    expect(res.body.user.onboardingCompletedAt).toBeNull();
  });

  it('anon → 401', async () => {
    expect((await request(app).post('/api/v1/account/complete-onboarding')).status).toBe(401);
  });
});
