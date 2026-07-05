import request from 'supertest';
import app from '../app';
import { disconnect } from './db';

afterAll(disconnect);

describe('GET /api/health', () => {
  it('returns 200 with the success envelope', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(['healthy', 'degraded']).toContain(res.body.data.status);
  });
});

describe('rate limiting in test env', () => {
  it('does not 429 on 12 rapid login attempts', async () => {
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@itest.local', password: 'WrongPass1!' });
      expect(res.status).not.toBe(429);
    }
  });
});
