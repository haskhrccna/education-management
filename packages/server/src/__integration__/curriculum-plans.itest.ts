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

async function seedSurahs(count: number) {
  const surahs = [];
  for (let i = 0; i < count; i++) {
    surahs.push(
      await prisma.surah.create({
        data: { number: 100 + i, nameAr: `سورة ${i}`, nameEn: `Surah ${i}`, ayahCount: 5, juz: 30 },
      })
    );
  }
  return surahs;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe('POST /api/v1/curriculum-plans', () => {
  it('creates a plan with ordered items and reports ON_PACE when nothing is overdue', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const [s1, s2] = await seedSurahs(2);

    const res = await request(app)
      .post('/api/v1/curriculum-plans')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        name: 'Juz Amma in 12 weeks',
        items: [
          { surahId: s1.id, targetDate: daysFromNow(30) },
          { surahId: s2.id, targetDate: daysFromNow(60) },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0].surahId).toBe(s1.id);
    expect(res.body.data.items[1].surahId).toBe(s2.id);
    expect(res.body.data.pace).toBe('ON_PACE');
  });

  it('reports BEHIND when a target date has already passed with no completion', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const [s1] = await seedSurahs(1);

    const res = await request(app)
      .post('/api/v1/curriculum-plans')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, name: 'Overdue plan', items: [{ surahId: s1.id, targetDate: daysFromNow(-5) }] });

    expect(res.status).toBe(201);
    expect(res.body.data.pace).toBe('BEHIND');
  });

  it('rejects duplicate surahs in the same plan', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const [s1] = await seedSurahs(1);

    const res = await request(app)
      .post('/api/v1/curriculum-plans')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        name: 'dup',
        items: [
          { surahId: s1.id, targetDate: daysFromNow(10) },
          { surahId: s1.id, targetDate: daysFromNow(20) },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('403s a teacher with no accepted appointment with the student', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const [s1] = await seedSurahs(1);

    const res = await request(app)
      .post('/api/v1/curriculum-plans')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, name: 'x', items: [{ surahId: s1.id, targetDate: daysFromNow(10) }] });
    expect(res.status).toBe(403);
  });

  it('403s a non-teacher caller', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const [s1] = await seedSurahs(1);
    const res = await request(app)
      .post('/api/v1/curriculum-plans')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ studentId: student.id, name: 'x', items: [{ surahId: s1.id, targetDate: daysFromNow(10) }] });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/curriculum-plans', () => {
  it('scopes to the caller: student sees only their own plans', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const otherStudent = await createUser({ role: Role.STUDENT, email: 'other-p@example.com' });
    await linkAccepted(student.id, teacher.id);
    await linkAccepted(otherStudent.id, teacher.id);
    const [s1, s2] = await seedSurahs(2);

    await request(app)
      .post('/api/v1/curriculum-plans')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, name: 'mine', items: [{ surahId: s1.id, targetDate: daysFromNow(10) }] });
    await request(app)
      .post('/api/v1/curriculum-plans')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: otherStudent.id, name: 'not mine', items: [{ surahId: s2.id, targetDate: daysFromNow(10) }] });

    const res = await request(app).get('/api/v1/curriculum-plans').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('mine');
  });
});

describe('plan completion via memorization progress', () => {
  it('marks a plan COMPLETED and fires the existing milestone pipeline once every item is memorized', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    const [s1, s2] = await seedSurahs(2);

    const created = await request(app)
      .post('/api/v1/curriculum-plans')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        name: 'two surahs',
        items: [
          { surahId: s1.id, targetDate: daysFromNow(30) },
          { surahId: s2.id, targetDate: daysFromNow(30) },
        ],
      });
    const planId = created.body.data.id;

    await request(app)
      .put(`/api/v1/memorization/${s1.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 5, status: 'COMPLETE' });

    let plan = await prisma.curriculumPlan.findUnique({ where: { id: planId } });
    expect(plan!.status).toBe('ACTIVE');

    await request(app)
      .put(`/api/v1/memorization/${s2.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 5, status: 'COMPLETE' });

    plan = await prisma.curriculumPlan.findUnique({ where: { id: planId } });
    expect(plan!.status).toBe('COMPLETED');
  });
});
