import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('F1 page memorization', () => {
  it('student marks a page and reads it back in one call (AC1.1/AC1.2 server half)', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const put = await request(app)
      .put('/api/v1/mushaf/pages/3/status')
      .set('Authorization', `Bearer ${s.token}`)
      .send({ status: 'MEMORIZED' });
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({ page: 3, status: 'MEMORIZED' });
    expect(put.body.data.lastReviewedAt).toBeTruthy(); // AC1.6

    const list = await request(app).get('/api/v1/mushaf/my-pages').set('Authorization', `Bearer ${s.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ page: 3, status: 'MEMORIZED' });
  });

  it('cross-student write → 403; assigned teacher write → 200 (AC1.4)', async () => {
    const t = await createUser({ role: Role.TEACHER });
    const s = await createUser({ role: Role.STUDENT, assignedTeacherId: t.id });
    const other = await createUser({ role: Role.STUDENT, email: 'other@x.com' });

    const evil = await request(app)
      .put('/api/v1/mushaf/pages/1/status')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ status: 'MEMORIZED', studentId: s.id });
    expect(evil.status).toBe(403);

    const ok = await request(app)
      .put('/api/v1/mushaf/pages/1/status')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ status: 'LEARNING', studentId: s.id });
    expect(ok.status).toBe(200);

    // and the assigned teacher can read them back via ?studentId=
    const read = await request(app)
      .get(`/api/v1/mushaf/my-pages?studentId=${s.id}`)
      .set('Authorization', `Bearer ${t.token}`);
    expect(read.status).toBe(200);
    expect(read.body.data).toHaveLength(1);

    // a non-linked teacher cannot
    const stranger = await createUser({ role: Role.TEACHER, email: 'stranger-t@x.com' });
    const denied = await request(app)
      .get(`/api/v1/mushaf/my-pages?studentId=${s.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(denied.status).toBe(403);
  });

  it('page 605 → 400 Invalid page number', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .put('/api/v1/mushaf/pages/605/status')
      .set('Authorization', `Bearer ${s.token}`)
      .send({ status: 'LEARNING' });
    expect(res.status).toBe(400);
  });

  it('anon → 401 on both endpoints', async () => {
    expect((await request(app).get('/api/v1/mushaf/my-pages')).status).toBe(401);
    expect((await request(app).put('/api/v1/mushaf/pages/1/status').send({ status: 'LEARNING' })).status).toBe(401);
  });
});
