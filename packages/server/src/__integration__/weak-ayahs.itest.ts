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

async function seedAyah() {
  const surah = await prisma.surah.create({
    data: { number: 114, nameAr: 'الناس', nameEn: 'An-Nas', ayahCount: 1, juz: 30 },
  });
  return prisma.ayah.create({
    data: { surahId: surah.id, number: 1, page: 604, juz: 30, text: 'قل أعوذ برب الناس' },
  });
}

describe('POST /api/v1/weak-ayahs', () => {
  it('flags an ayah and seeds a drill card via the existing SM-2 defaults', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const ayah = await seedAyah();

    const res = await request(app)
      .post('/api/v1/weak-ayahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, ayahId: ayah.id });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.consecutiveCorrect).toBe(0);

    const drills = await prisma.revisionSchedule.findMany({ where: { userId: student.id, ayahId: ayah.id } });
    expect(drills).toHaveLength(1);
    expect(drills[0].status).toBe('PENDING');
    expect(drills[0].surahId).toBe(ayah.surahId);
  });

  it('is idempotent: re-flagging an already-ACTIVE ayah does not duplicate the flag or the drill card', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const ayah = await seedAyah();

    await request(app)
      .post('/api/v1/weak-ayahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, ayahId: ayah.id });
    const second = await request(app)
      .post('/api/v1/weak-ayahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, ayahId: ayah.id });

    expect(second.status).toBe(201);
    const flags = await prisma.weakAyahFlag.findMany({ where: { studentId: student.id, ayahId: ayah.id } });
    expect(flags).toHaveLength(1);
    const drills = await prisma.revisionSchedule.findMany({ where: { userId: student.id, ayahId: ayah.id } });
    expect(drills).toHaveLength(1);
  });

  it('403s a teacher with no accepted appointment with the student', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const ayah = await seedAyah();

    const res = await request(app)
      .post('/api/v1/weak-ayahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, ayahId: ayah.id });
    expect(res.status).toBe(403);
  });

  it('403s a non-teacher caller', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const ayah = await seedAyah();
    const res = await request(app)
      .post('/api/v1/weak-ayahs')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ studentId: student.id, ayahId: ayah.id });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/weak-ayahs', () => {
  it('scopes to the caller: teacher sees only their own students’ flags', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const outsiderTeacher = await createUser({ role: Role.TEACHER, email: 'outsider-t@example.com' });
    const student = await createUser({ role: Role.STUDENT });
    const otherStudent = await createUser({ role: Role.STUDENT, email: 'other-s@example.com' });
    await linkAccepted(student.id, teacher.id);
    await linkAccepted(otherStudent.id, outsiderTeacher.id);
    const ayah = await seedAyah();

    await request(app)
      .post('/api/v1/weak-ayahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, ayahId: ayah.id });
    await request(app)
      .post('/api/v1/weak-ayahs')
      .set('Authorization', `Bearer ${outsiderTeacher.token}`)
      .send({ studentId: otherStudent.id, ayahId: ayah.id });

    const res = await request(app).get('/api/v1/weak-ayahs').set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].studentId).toBe(student.id);
  });
});

describe('weak-ayah drill retirement (via PUT /api/v1/revisions/:id)', () => {
  it('retires the flag after 3 consecutive COMPLETED drill reviews and stops generating new drills', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const ayah = await seedAyah();

    const flagRes = await request(app)
      .post('/api/v1/weak-ayahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, ayahId: ayah.id });
    const flagId = flagRes.body.data.id;

    for (let i = 0; i < 3; i++) {
      const pending = await prisma.revisionSchedule.findFirst({
        where: { userId: student.id, ayahId: ayah.id, status: 'PENDING' },
      });
      expect(pending).not.toBeNull();

      const res = await request(app)
        .put(`/api/v1/revisions/${pending!.id}`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({ status: 'COMPLETED' });
      expect(res.status).toBe(200);
    }

    const flag = await prisma.weakAyahFlag.findUnique({ where: { id: flagId } });
    expect(flag!.status).toBe('RETIRED');
    expect(flag!.consecutiveCorrect).toBe(3);

    const remainingPending = await prisma.revisionSchedule.count({
      where: { userId: student.id, ayahId: ayah.id, status: 'PENDING' },
    });
    expect(remainingPending).toBe(0);
  });

  it('a MISSED review resets the consecutive-correct streak instead of retiring the flag', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const ayah = await seedAyah();

    const flagRes = await request(app)
      .post('/api/v1/weak-ayahs')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, ayahId: ayah.id });
    const flagId = flagRes.body.data.id;

    let pending = await prisma.revisionSchedule.findFirst({
      where: { userId: student.id, ayahId: ayah.id, status: 'PENDING' },
    });
    await request(app)
      .put(`/api/v1/revisions/${pending!.id}`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ status: 'COMPLETED' });

    let flag = await prisma.weakAyahFlag.findUnique({ where: { id: flagId } });
    expect(flag!.consecutiveCorrect).toBe(1);

    pending = await prisma.revisionSchedule.findFirst({
      where: { userId: student.id, ayahId: ayah.id, status: 'PENDING' },
    });
    await request(app)
      .put(`/api/v1/revisions/${pending!.id}`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ status: 'MISSED' });

    flag = await prisma.weakAyahFlag.findUnique({ where: { id: flagId } });
    expect(flag!.status).toBe('ACTIVE');
    expect(flag!.consecutiveCorrect).toBe(0);
  });
});
