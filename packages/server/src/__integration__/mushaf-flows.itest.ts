import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

async function seedSurahWithAyahs() {
  const surah = await prisma.surah.create({
    data: { number: 114, nameAr: 'الناس', nameEn: 'An-Nas', ayahCount: 2, juz: 30 },
  });
  await prisma.ayah.createMany({
    data: [
      { surahId: surah.id, number: 1, page: 604, juz: 30, text: 'قل أعوذ برب الناس' },
      { surahId: surah.id, number: 2, page: 604, juz: 30, text: 'ملك الناس' },
    ],
  });
  return surah;
}

describe('mushaf API (mounted for the first time — mobile reader depends on it)', () => {
  it('GET /surahs/:id → envelope {success,data} with ordered ayahs; 404 unknown; 400 NaN', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const surah = await seedSurahWithAyahs();

    const res = await request(app).get(`/api/v1/mushaf/surahs/${surah.id}`).set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ayahs).toHaveLength(2);
    expect(res.body.data.ayahs[0].number).toBe(1);

    const missing = await request(app).get('/api/v1/mushaf/surahs/999').set('Authorization', `Bearer ${u.token}`);
    expect(missing.status).toBe(404);

    const nan = await request(app).get('/api/v1/mushaf/surahs/abc').set('Authorization', `Bearer ${u.token}`);
    expect(nan.status).toBe(400);
    expect(nan.body.error).toBe('Invalid surah id');
  });

  it('GET /pages/:page → {success,data:{page,juz,ayahs}}; 404 empty page', async () => {
    const u = await createUser({ role: Role.STUDENT });
    await seedSurahWithAyahs();

    const res = await request(app).get('/api/v1/mushaf/pages/604').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 604, juz: 30 });
    expect(res.body.data.ayahs).toHaveLength(2);

    const empty = await request(app).get('/api/v1/mushaf/pages/12').set('Authorization', `Bearer ${u.token}`);
    expect(empty.status).toBe(404);
    expect(empty.body.error).toBe('Page not found');
  });

  it('POST /log-memorization increments/decrements own ayah progress', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const surah = await seedSurahWithAyahs();

    const up = await request(app)
      .post('/api/v1/mushaf/log-memorization')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ surahId: surah.id, ayahNumber: 1, memorized: true });
    expect(up.status).toBe(200);
    expect(up.body.data).toEqual({ memorizedAyahs: 1, status: 'IN_PROGRESS' });

    const down = await request(app)
      .post('/api/v1/mushaf/log-memorization')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ surahId: surah.id, ayahNumber: 1, memorized: false });
    expect(down.body.data).toEqual({ memorizedAyahs: 0, status: 'NOT_STARTED' });

    const badAyah = await request(app)
      .post('/api/v1/mushaf/log-memorization')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ surahId: surah.id, ayahNumber: 99, memorized: true });
    expect(badAyah.status).toBe(404);
    expect(badAyah.body.error).toBe('Ayah not found');
  });

  it('anon → 401 on all three', async () => {
    expect((await request(app).get('/api/v1/mushaf/surahs/1')).status).toBe(401);
    expect((await request(app).get('/api/v1/mushaf/pages/1')).status).toBe(401);
    expect((await request(app).post('/api/v1/mushaf/log-memorization').send({})).status).toBe(401);
  });
});

describe('mushaf page images (static, F4b)', () => {
  it('serves 1.webp and 604.webp from MUSHAF_PAGES_DIR with long cache; 404 out of range', async () => {
    const res1 = await request(app).get('/mushaf-pages/1.webp');
    const res604 = await request(app).get('/mushaf-pages/604.webp');
    expect(res1.status).toBe(200);
    expect(res604.status).toBe(200);
    expect(res1.headers['cache-control']).toContain('immutable');
    expect((await request(app).get('/mushaf-pages/605.webp')).status).toBe(404);
  });
});
