import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

async function seedSurah(ayahCount = 6) {
  return prisma.surah.create({
    data: { number: 114, nameAr: 'الناس', nameEn: 'An-Nas', ayahCount, juz: 30 },
  });
}

async function linkAccepted(student: TestUser, teacher: TestUser) {
  await prisma.appointment.create({
    data: {
      studentId: student.id,
      teacherId: teacher.id,
      requestedDate: new Date(),
      requestedTime: '10:00',
      status: 'ACCEPTED',
    },
  });
}

describe('grades', () => {
  it('POST 201: raw grade echo with surah + student includes; audit fires', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const surah = await seedSurah();

    const res = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: surah.id, grade: '95', type: 'ORAL', notes: 'excellent tajweed' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ studentId: student.id, teacherId: teacher.id, grade: '95', type: 'ORAL' });
    expect(res.body.surah).toMatchObject({ nameEn: 'An-Nas' });
    expect(res.body.student).toMatchObject({ email: student.email });
    expect(res.body.success).toBeUndefined();
  });

  it('POST: 404 unknown student; 400 non-student target; 400 unknown surah; 403 no accepted appointment', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const otherTeacher = await createUser({ role: Role.TEACHER, email: 'other-t@example.com' });
    const student = await createUser({ role: Role.STUDENT });
    const surah = await seedSurah();

    const ghost = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: '00000000-0000-4000-8000-000000000000', surahId: surah.id, grade: 'A', type: 'ORAL' });
    expect(ghost.status).toBe(404);
    expect(ghost.body.error).toBe('Student not found');

    const notStudent = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: otherTeacher.id, surahId: surah.id, grade: 'A', type: 'ORAL' });
    expect(notStudent.status).toBe(400);
    expect(notStudent.body.error).toBe('Target user is not a student');

    const noLink = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: surah.id, grade: 'A', type: 'ORAL' });
    expect(noLink.status).toBe(403);
    expect(noLink.body.error).toBe('No accepted appointment with this student');

    await linkAccepted(student, teacher);
    const badSurah = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: 9999, grade: 'A', type: 'ORAL' });
    expect(badSurah.status).toBe(400);
    expect(badSurah.body.error).toBe('Surah not found');
  });

  it('GET /grades: student sees own (raw array); GET /grades/student/:id gated by relationship, admin free', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const outsider = await createUser({ role: Role.TEACHER, email: 'outsider@example.com' });
    const admin = await createUser({ role: Role.ADMIN });
    await linkAccepted(student, teacher);
    const surah = await seedSurah();
    await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: surah.id, grade: '90', type: 'QUIZ' });

    const own = await request(app).get('/api/v1/grades').set('Authorization', `Bearer ${student.token}`);
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].surah).toMatchObject({ nameEn: 'An-Nas' });

    const byOutsider = await request(app)
      .get(`/api/v1/grades/student/${student.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(byOutsider.status).toBe(403);

    const byAdmin = await request(app)
      .get(`/api/v1/grades/student/${student.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body).toHaveLength(1);
  });
});

describe('surahs', () => {
  it('GET /surahs: raw array ordered by number', async () => {
    await seedSurah();
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/v1/surahs').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ number: 114, nameEn: 'An-Nas', ayahCount: 6, juz: 30 });
  });
});

describe('memorization', () => {
  it('GET: student reads own; teacher/admin need ?studentId (400 without)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });

    const own = await request(app).get('/api/v1/memorization').set('Authorization', `Bearer ${student.token}`);
    expect(own.status).toBe(200);
    expect(own.body).toEqual([]);

    const bare = await request(app).get('/api/v1/memorization').set('Authorization', `Bearer ${teacher.token}`);
    expect(bare.status).toBe(400);
    expect(bare.body.error).toBe('studentId query param is required');
  });

  it('PUT /:surahId hand-validation quirks: Invalid surahId / studentId is required / memorizedAyahs must be a number', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });

    const nan = await request(app)
      .put('/api/v1/memorization/abc')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 3 });
    expect(nan.status).toBe(400);
    expect(nan.body.error).toBe('Invalid surahId');

    const noStudent = await request(app)
      .put('/api/v1/memorization/1')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ memorizedAyahs: 3 });
    expect(noStudent.status).toBe(400);
    expect(noStudent.body.error).toBe('studentId is required');

    const badAyahs = await request(app)
      .put('/api/v1/memorization/1')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 'three' });
    expect(badAyahs.status).toBe(400);
    expect(badAyahs.body.error).toBe('memorizedAyahs must be a number');
  });

  it('PUT transition into COMPLETE seeds exactly one PENDING SM-2 revision (idempotent on re-recite)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const surah = await seedSurah(6);

    const complete = await request(app)
      .put(`/api/v1/memorization/${surah.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 6 });
    expect(complete.status).toBe(200);
    expect(complete.body).toMatchObject({ status: 'COMPLETE', memorizedAyahs: 6 });
    expect(complete.body.surah).toMatchObject({ nameEn: 'An-Nas' });

    const seeded = await prisma.revisionSchedule.findMany({
      where: { userId: student.id, surahId: surah.id, status: 'PENDING' },
    });
    expect(seeded).toHaveLength(1);

    // Re-recite while already COMPLETE: no duplicate PENDING revision.
    await request(app)
      .put(`/api/v1/memorization/${surah.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, memorizedAyahs: 6 });
    const after = await prisma.revisionSchedule.count({
      where: { userId: student.id, surahId: surah.id, status: 'PENDING' },
    });
    expect(after).toBe(1);
  });
});

describe('revisions', () => {
  it('GET ?surahId=abc → hand-built envelope WITHOUT meta (pinned with toEqual)', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/v1/revisions?surahId=abc').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Invalid surahId' });
  });

  it("POST with missing studentId → 500 'Internal server error' (plain Error, pinned quirk)", async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .post('/api/v1/revisions')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ surahId: 1, scheduledFor: '2027-01-15' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('POST 201 raw revision with surah include; teacher without link → 403', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const surah = await seedSurah();

    const res = await request(app)
      .post('/api/v1/revisions')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: surah.id, scheduledFor: '2027-01-15T00:00:00.000Z' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userId: student.id, surahId: surah.id, status: 'PENDING' });
    expect(res.body.surah).toMatchObject({ nameEn: 'An-Nas' });

    const outsider = await createUser({ role: Role.TEACHER, email: 'outsider@example.com' });
    const denied = await request(app)
      .post('/api/v1/revisions')
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ studentId: student.id, surahId: surah.id, scheduledFor: '2027-01-15T00:00:00.000Z' });
    expect(denied.status).toBe(403);
  });

  it('PUT marks COMPLETED and SM-2 schedules the NEXT pending card (repetitions+1); admin blocked by authorize (pinned quirk)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    await linkAccepted(student, teacher);
    const surah = await seedSurah();
    const card = await prisma.revisionSchedule.create({
      data: { userId: student.id, surahId: surah.id, scheduledFor: new Date(), status: 'PENDING' },
    });

    const adminTry = await request(app)
      .put(`/api/v1/revisions/${card.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'COMPLETED' });
    expect(adminTry.status).toBe(403);
    expect(adminTry.body.error).toBe('Insufficient permissions');

    const done = await request(app)
      .put(`/api/v1/revisions/${card.id}`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ status: 'COMPLETED' });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ status: 'COMPLETED' });
    expect(done.body.notedAt).toBeTruthy();

    // SM-2 side effect: a NEW pending card exists with repetitions=1, interval=1.
    const next = await prisma.revisionSchedule.findFirst({
      where: { userId: student.id, surahId: surah.id, status: 'PENDING' },
    });
    expect(next).not.toBeNull();
    expect(next!.repetitions).toBe(1);
    expect(next!.interval).toBe(1);
    expect(next!.id).not.toBe(card.id);
  });

  it('DELETE: student own-only; COMPLETED cards are 409-protected', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT, email: 'other-s@example.com' });
    const surah = await seedSurah();
    const card = await prisma.revisionSchedule.create({
      data: { userId: student.id, surahId: surah.id, scheduledFor: new Date(), status: 'PENDING' },
    });

    const notOwn = await request(app)
      .delete(`/api/v1/revisions/${card.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(notOwn.status).toBe(403);
    expect(notOwn.body.error).toBe('You can only delete your own revisions');

    const ok = await request(app)
      .delete(`/api/v1/revisions/${card.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ success: true });

    const completed = await prisma.revisionSchedule.create({
      data: { userId: student.id, surahId: surah.id, scheduledFor: new Date(), status: 'COMPLETED' },
    });
    const blocked = await request(app)
      .delete(`/api/v1/revisions/${completed.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('Cannot delete a completed revision');
  });
});
