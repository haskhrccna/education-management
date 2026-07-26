import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const profileData = {
  slug: 'default',
  displayName: 'Dar Al-Huda',
  programName: 'Hifz Program',
  publicBio: 'A Quran memorization academy',
  active: true,
};

describe('GET /api/v1/public/academy/:slug', () => {
  it('returns the active profile without auth (AC8.5)', async () => {
    await prisma.academyProfile.create({ data: profileData });
    const res = await request(app).get('/api/v1/public/academy/default');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ slug: 'default', displayName: 'Dar Al-Huda', programName: 'Hifz Program' });
    expect(res.body.id).toBeUndefined();
    expect(res.body.active).toBeUndefined();
  });

  it('404s an inactive profile', async () => {
    await prisma.academyProfile.create({ data: { ...profileData, active: false } });
    const res = await request(app).get('/api/v1/public/academy/default');
    expect(res.status).toBe(404);
  });

  it('404s an unknown slug', async () => {
    const res = await request(app).get('/api/v1/public/academy/nope');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/public/verify/:token/share.png', () => {
  const pngParse = (r: any, cb: any) => {
    const chunks: Buffer[] = [];
    r.on('data', (c: Buffer) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  };

  it('returns a 1200×630 PNG ≤ 200KB for a valid certificate token (AC8.2)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    await prisma.user.update({ where: { id: student.id }, data: { firstName: 'Amina' } });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });

    const res = await request(app)
      .get(`/api/v1/public/verify/${cert.verificationToken}/share.png`)
      .buffer(true)
      .parse(pngParse);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    const buf = res.body as Buffer;
    // PNG signature + IHDR dimensions
    expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
    expect(buf.length).toBeLessThanOrEqual(200 * 1024);
    // Regression guard: a textless render (no bundled font available to
    // resvg) is ~6.7KB; a real render with text is ~20-38KB. This catches
    // the share image silently going blank without decoding pixels.
    expect(buf.length).toBeGreaterThan(15 * 1024);
  });

  it('404s an unknown token', async () => {
    const res = await request(app).get('/api/v1/public/verify/does-not-exist/share.png');
    expect(res.status).toBe(404);
  });

  it('404s immediately after the link is regenerated, even if the image was cached (AC8.3)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });
    const oldToken = cert.verificationToken;

    const warm = await request(app).get(`/api/v1/public/verify/${oldToken}/share.png`);
    expect(warm.status).toBe(200);

    const regen = await request(app)
      .patch(`/api/v1/certificates/${cert.id}/regenerate-link`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(regen.status).toBe(200);

    const stale = await request(app).get(`/api/v1/public/verify/${oldToken}/share.png`);
    expect(stale.status).toBe(404);
  });

  it('404s a revoked (active=false) token even with a warm cache', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });
    await request(app).get(`/api/v1/public/verify/${cert.verificationToken}/share.png`);
    await prisma.certificate.update({ where: { id: cert.id }, data: { active: false } });

    const res = await request(app).get(`/api/v1/public/verify/${cert.verificationToken}/share.png`);
    expect(res.status).toBe(404);
  });

  it('renders the ijazah variant (teacher in pipeline, no student email — AC8.4)', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const ijazah = await prisma.ijazah.create({
      data: { studentId: student.id, teacherId: teacher.id, scope: 'FULL_QURAN' },
    });
    const res = await request(app).get(`/api/v1/public/verify/${ijazah.verificationToken}/share.png`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });
});

describe('admin academy-profile endpoints', () => {
  it('PUT creates then GET returns it; public reflects the change (AC3.1)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const put = await request(app)
      .put('/api/v1/admin/academy-profile')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ displayName: 'Dar Al-Huda', programName: 'Hifz Program', active: true });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ slug: 'default', displayName: 'Dar Al-Huda', active: true });

    const get = await request(app).get('/api/v1/admin/academy-profile').set('Authorization', `Bearer ${admin.token}`);
    expect(get.status).toBe(200);

    const pub = await request(app).get('/api/v1/public/academy/default');
    expect(pub.status).toBe(200);
    expect(pub.body.displayName).toBe('Dar Al-Huda');
  });

  it('GET 404s before first save', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app).get('/api/v1/admin/academy-profile').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it('rejects invalid body with 400', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .put('/api/v1/admin/academy-profile')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ displayName: '', programName: 'x' });
    expect(res.status).toBe(400);
  });
});
