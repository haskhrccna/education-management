import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('GET /api/v1/verify/:token', () => {
  it('renders the certificate page for a valid token, with no auth required', async () => {
    const student = await createUser({ role: Role.STUDENT });
    await prisma.user.update({ where: { id: student.id }, data: { firstName: 'Amina' } });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });

    const res = await request(app).get(`/api/v1/verify/${cert.verificationToken}`);

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain('Amina');
    expect(res.text).toContain('Certificate of Completion');
  });

  it('renders the ijazah page showing student, teacher, and program — no other student PII', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    await prisma.user.update({ where: { id: teacher.id }, data: { firstName: 'Yusuf' } });
    const student = await createUser({ role: Role.STUDENT });
    await prisma.user.update({ where: { id: student.id }, data: { firstName: 'Amina' } });
    const ijazah = await prisma.ijazah.create({
      data: { studentId: student.id, teacherId: teacher.id, scope: 'FULL_QURAN' },
    });

    const res = await request(app).get(`/api/v1/verify/${ijazah.verificationToken}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Amina');
    expect(res.text).toContain('Yusuf');
    expect(res.text).not.toContain(student.email);
  });

  it('404s for an unknown token', async () => {
    const res = await request(app).get('/api/v1/verify/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('404s for a revoked (inactive) token', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const cert = await prisma.certificate.create({
      data: { studentId: student.id, pdfUrl: '/x.pdf', active: false },
    });
    const res = await request(app).get(`/api/v1/verify/${cert.verificationToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/certificates/:id/regenerate-link', () => {
  it("lets a student regenerate their own certificate's link, invalidating the old one", async () => {
    const student = await createUser({ role: Role.STUDENT });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });
    const oldToken = cert.verificationToken;

    const res = await request(app)
      .patch(`/api/v1/certificates/${cert.id}/regenerate-link`)
      .set('Authorization', `Bearer ${student.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.verificationToken).not.toBe(oldToken);

    const oldLookup = await request(app).get(`/api/v1/verify/${oldToken}`);
    expect(oldLookup.status).toBe(404);
    const newLookup = await request(app).get(`/api/v1/verify/${res.body.data.verificationToken}`);
    expect(newLookup.status).toBe(200);
  });

  it("404s a student regenerating someone else's certificate link", async () => {
    const owner = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT, email: 'other@example.com' });
    const cert = await prisma.certificate.create({ data: { studentId: owner.id, pdfUrl: '/x.pdf' } });

    const res = await request(app)
      .patch(`/api/v1/certificates/${cert.id}/regenerate-link`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/ijazahs/:id/regenerate-link', () => {
  it("lets a student regenerate their own ijazah's link, invalidating the old one", async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const ijazah = await prisma.ijazah.create({
      data: { studentId: student.id, teacherId: teacher.id, scope: 'FULL_QURAN' },
    });
    const oldToken = ijazah.verificationToken;

    const res = await request(app)
      .patch(`/api/v1/ijazahs/${ijazah.id}/regenerate-link`)
      .set('Authorization', `Bearer ${student.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.verificationToken).not.toBe(oldToken);

    const oldLookup = await request(app).get(`/api/v1/verify/${oldToken}`);
    expect(oldLookup.status).toBe(404);
  });

  it("404s a student regenerating someone else's ijazah link", async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const owner = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT, email: 'other2@example.com' });
    const ijazah = await prisma.ijazah.create({
      data: { studentId: owner.id, teacherId: teacher.id, scope: 'FULL_QURAN' },
    });

    const res = await request(app)
      .patch(`/api/v1/ijazahs/${ijazah.id}/regenerate-link`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
