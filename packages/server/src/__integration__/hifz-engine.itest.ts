import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
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

describe('F2 page-anchored recordings', () => {
  it('upload carries page + surahId and echoes them (AC2.1 server half)', async () => {
    const t = await createUser({ role: Role.TEACHER });
    const s = await createUser({ role: Role.STUDENT, assignedTeacherId: t.id });
    const res = await request(app)
      .post('/api/v1/recordings')
      .set('Authorization', `Bearer ${s.token}`)
      .field('fileName', 'p3.m4a')
      .field('fileSizeBytes', '4')
      .field('contentType', 'audio/x-m4a')
      .field('page', '3')
      .field('surahId', '1')
      .attach('file', Buffer.from('abcd'), { filename: 'p3.m4a', contentType: 'audio/x-m4a' });
    expect(res.status).toBe(201);
    expect(res.body.page).toBe(3);
    expect(res.body.surahId).toBe(1);
  });

  it('legacy upload without page still works — nullable, zero regression (AC2.2)', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/recordings')
      .set('Authorization', `Bearer ${s.token}`)
      .field('fileName', 'x.m4a')
      .field('fileSizeBytes', '1')
      .field('contentType', 'audio/x-m4a')
      .attach('file', Buffer.from('a'), { filename: 'x.m4a', contentType: 'audio/x-m4a' });
    expect(res.status).toBe(201);
    expect(res.body.page).toBeNull();
    expect(res.body.surahId).toBeNull();
  });

  it('page 700 → 400 validation error', async () => {
    const s = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/recordings')
      .set('Authorization', `Bearer ${s.token}`)
      .field('fileName', 'x.m4a')
      .field('fileSizeBytes', '1')
      .field('contentType', 'audio/x-m4a')
      .field('page', '700')
      .attach('file', Buffer.from('a'), { filename: 'x.m4a', contentType: 'audio/x-m4a' });
    expect(res.status).toBe(400);
  });
});

describe('F3 revision queue', () => {
  const backdate = async (userId: string, page: number, daysAgo: number) => {
    // Prisma manages @updatedAt itself, so backdating goes through raw SQL.
    const when = new Date(Date.now() - daysAgo * 86400000);
    await prisma.$executeRaw`UPDATE "page_memorizations" SET "updatedAt" = ${when}, "lastReviewedAt" = ${when} WHERE "userId" = ${userId} AND "page" = ${page}`;
  };

  it('memorized page queues, reviewed drops it without waiting (AC3.3 server half, AC3.5 compute path)', async () => {
    const s = await createUser({ role: Role.STUDENT });
    await request(app)
      .put('/api/v1/mushaf/pages/3/status')
      .set('Authorization', `Bearer ${s.token}`)
      .send({ status: 'MEMORIZED' });
    await backdate(s.id, 3, 2); // sabaq interval 1 → due; the PUT already invalidated the cache

    const q1 = await request(app).get('/api/v1/mushaf/revision-queue').set('Authorization', `Bearer ${s.token}`);
    expect(q1.status).toBe(200);
    expect(q1.body.data.items).toHaveLength(1);
    expect(q1.body.data.items[0]).toMatchObject({ page: 3, band: 'SABAQ' });

    const done = await request(app).post('/api/v1/mushaf/pages/3/reviewed').set('Authorization', `Bearer ${s.token}`);
    expect(done.status).toBe(200);
    expect(done.body.data.lastReviewedAt).toBeTruthy();

    const q2 = await request(app).get('/api/v1/mushaf/revision-queue').set('Authorization', `Bearer ${s.token}`);
    expect(q2.body.data.items).toHaveLength(0);
    expect(q2.body.data.reviewedThisWeek).toBeGreaterThanOrEqual(1);
  });

  it('teacher override rows sort first and are never dropped (AC3.4)', async () => {
    const t = await createUser({ role: Role.TEACHER });
    const s = await createUser({ role: Role.STUDENT, assignedTeacherId: t.id });
    const surah = await prisma.surah.create({
      data: { number: 112, nameAr: 'الإخلاص', nameEn: 'Al-Ikhlas', ayahCount: 4, juz: 30 },
    });
    await prisma.revisionSchedule.create({
      data: { userId: s.id, surahId: surah.id, scheduledFor: new Date(Date.now() - 86400000), status: 'PENDING' },
    });
    await request(app)
      .put('/api/v1/mushaf/pages/5/status')
      .set('Authorization', `Bearer ${s.token}`)
      .send({ status: 'MEMORIZED' });
    await backdate(s.id, 5, 2);

    const q = await request(app).get('/api/v1/mushaf/revision-queue').set('Authorization', `Bearer ${s.token}`);
    expect(q.body.data.items[0]).toMatchObject({ surahId: surah.id, band: 'OVERRIDE' });
    expect(q.body.data.items[1]).toMatchObject({ page: 5 });
  });

  it('assigned teacher reads a student queue via ?studentId=; stranger 403; untracked review 404', async () => {
    const t = await createUser({ role: Role.TEACHER });
    const s = await createUser({ role: Role.STUDENT, assignedTeacherId: t.id });
    const stranger = await createUser({ role: Role.TEACHER, email: 'stranger-q@x.com' });

    const ok = await request(app)
      .get(`/api/v1/mushaf/revision-queue?studentId=${s.id}`)
      .set('Authorization', `Bearer ${t.token}`);
    expect(ok.status).toBe(200);

    const denied = await request(app)
      .get(`/api/v1/mushaf/revision-queue?studentId=${s.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(denied.status).toBe(403);

    const untracked = await request(app)
      .post('/api/v1/mushaf/pages/9/reviewed')
      .set('Authorization', `Bearer ${s.token}`);
    expect(untracked.status).toBe(404);
  });
});
