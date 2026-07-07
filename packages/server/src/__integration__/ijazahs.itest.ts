import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

async function linkAccepted(studentId: string, teacherId: string) {
  return prisma.appointment.create({
    data: {
      studentId,
      teacherId,
      requestedDate: new Date(),
      requestedTime: '10:00',
      status: 'ACCEPTED',
    },
  });
}

async function seedSurah(number: number, juz: number) {
  return prisma.surah.create({ data: { number, nameAr: `س${number}`, nameEn: `S${number}`, ayahCount: 3, juz } });
}

async function completeSurah(studentId: string, surahId: number) {
  return prisma.memorizationProgress.create({
    data: { userId: studentId, surahId, memorizedAyahs: 3, status: 'COMPLETE' },
  });
}

describe('POST /api/v1/ijazahs', () => {
  it('issues a SURAH-scope ijazah once the surah is actually fully memorized', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const surah = await seedSurah(101, 30);
    await completeSurah(student.id, surah.id);

    const res = await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, scope: 'SURAH', surahId: surah.id, teacherChainRef: 'Sheikh A, certified 2010' });

    expect(res.status).toBe(201);
    expect(res.body.data.scope).toBe('SURAH');
    expect(res.body.data.surahId).toBe(surah.id);
    expect(res.body.data.teacherChainRef).toBe('Sheikh A, certified 2010');
  });

  it("409s a SURAH-scope ijazah when the surah isn't actually fully memorized yet", async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const surah = await seedSurah(102, 30);

    const res = await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, scope: 'SURAH', surahId: surah.id });
    expect(res.status).toBe(409);
  });

  it('issues a JUZ-scope ijazah only once every surah in that juz is memorized', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const s1 = await seedSurah(103, 5);
    const s2 = await seedSurah(104, 5);
    await completeSurah(student.id, s1.id);

    const tooEarly = await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, scope: 'JUZ', juzNumber: 5 });
    expect(tooEarly.status).toBe(409);

    await completeSurah(student.id, s2.id);
    const res = await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, scope: 'JUZ', juzNumber: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.juzNumber).toBe(5);
  });

  it('builds a real sanad: chainIjazahId must belong to the endorsing teacher', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const otherTeacher = await createUser({ role: Role.TEACHER, email: 'other-t@example.com' });
    const student = await createUser({ role: Role.STUDENT });
    const otherStudent = await createUser({ role: Role.STUDENT, email: 'other-s@example.com' });
    await linkAccepted(student.id, teacher.id);
    await linkAccepted(otherStudent.id, otherTeacher.id);

    const teacherOwnSurah = await seedSurah(105, 1);
    await completeSurah(otherStudent.id, teacherOwnSurah.id);
    const teacherOwnIjazah = await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${otherTeacher.token}`)
      .send({ studentId: otherStudent.id, scope: 'SURAH', surahId: teacherOwnSurah.id });

    // Using someone ELSE's ijazah as the chain reference must fail.
    const surah = await seedSurah(106, 1);
    await completeSurah(student.id, surah.id);
    const wrongChain = await request(app).post('/api/v1/ijazahs').set('Authorization', `Bearer ${teacher.token}`).send({
      studentId: student.id,
      scope: 'SURAH',
      surahId: surah.id,
      chainIjazahId: teacherOwnIjazah.body.data.id,
    });
    expect(wrongChain.status).toBe(400);

    // A teacher's own ijazah as their chain reference succeeds.
    const ownIjazah = await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${otherTeacher.token}`)
      .send({
        studentId: otherStudent.id,
        scope: 'SURAH',
        surahId: teacherOwnSurah.id,
        chainIjazahId: teacherOwnIjazah.body.data.id,
      });
    expect(ownIjazah.status).toBe(201);
    expect(ownIjazah.body.data.chainIjazahId).toBe(teacherOwnIjazah.body.data.id);
  });

  it('403s a teacher with no accepted appointment with the student', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const surah = await seedSurah(107, 1);

    const res = await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, scope: 'SURAH', surahId: surah.id });
    expect(res.status).toBe(403);
  });

  it('403s a non-teacher caller', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const surah = await seedSurah(108, 1);
    const res = await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ studentId: student.id, scope: 'SURAH', surahId: surah.id });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/ijazahs', () => {
  it('scopes to the caller; admin sees every record for program-wide audit', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    await linkAccepted(student.id, teacher.id);
    const surah = await seedSurah(109, 1);
    await completeSurah(student.id, surah.id);
    await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, scope: 'SURAH', surahId: surah.id });

    const studentRes = await request(app).get('/api/v1/ijazahs').set('Authorization', `Bearer ${student.token}`);
    expect(studentRes.body.data).toHaveLength(1);

    const adminRes = await request(app).get('/api/v1/ijazahs').set('Authorization', `Bearer ${admin.token}`);
    expect(adminRes.body.data).toHaveLength(1);
  });
});

describe('ijazah issuance writes to the existing audit log', () => {
  it('records an ISSUE_IJAZAH entry in the AuditLog table', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const surah = await seedSurah(110, 1);
    await completeSurah(student.id, surah.id);

    await request(app)
      .post('/api/v1/ijazahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, scope: 'SURAH', surahId: surah.id });

    const entry = await prisma.auditLog.findFirst({ where: { action: 'ISSUE_IJAZAH', userId: teacher.id } });
    expect(entry).not.toBeNull();
    expect(entry!.resourceType).toBe('IJAZAH');
  });
});
