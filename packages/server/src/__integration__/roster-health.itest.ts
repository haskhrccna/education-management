import request from 'supertest';
import { Role, AttendanceStatus } from '@prisma/client';
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

async function recordSession(
  appointmentId: string,
  studentId: string,
  teacherId: string,
  status: AttendanceStatus,
  daysAgo: number
) {
  return prisma.sessionRecord.create({
    data: {
      appointmentId,
      studentId,
      teacherId,
      status,
      recordedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    },
  });
}

describe('GET /api/v1/roster/health', () => {
  it('403s a non-teacher caller', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/v1/roster/health').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('401s an anonymous caller', async () => {
    const res = await request(app).get('/api/v1/roster/health');
    expect(res.status).toBe(401);
  });

  it('returns only students the teacher has an ACCEPTED appointment with, sorted by first name', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const outsiderTeacher = await createUser({ role: Role.TEACHER, email: 'outsider-t@example.com' });
    const zaid = await createUser({ role: Role.STUDENT, email: 'zaid@example.com' });
    const amir = await createUser({ role: Role.STUDENT, email: 'amir@example.com' });
    const notMine = await createUser({ role: Role.STUDENT, email: 'notmine@example.com' });
    await prisma.user.update({ where: { id: zaid.id }, data: { firstName: 'Zaid' } });
    await prisma.user.update({ where: { id: amir.id }, data: { firstName: 'Amir' } });

    await linkAccepted(zaid.id, teacher.id);
    await linkAccepted(amir.id, teacher.id);
    await linkAccepted(notMine.id, outsiderTeacher.id);

    const res = await request(app).get('/api/v1/roster/health').set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.map((r: any) => r.studentId);
    expect(ids).toEqual(expect.arrayContaining([zaid.id, amir.id]));
    expect(ids).not.toContain(notMine.id);
    // sorted by first name: Amir before Zaid
    expect(res.body.data[0].studentId).toBe(amir.id);
  });

  it('flags MISSED_SESSIONS after 2 consecutive ABSENT session records', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const a1 = await linkAccepted(student.id, teacher.id);

    // Two distinct appointments so each gets its own SessionRecord (unique per appointmentId).
    const a2 = await prisma.appointment.create({
      data: {
        studentId: student.id,
        teacherId: teacher.id,
        requestedDate: new Date(),
        requestedTime: '11:00',
        status: 'ACCEPTED',
      },
    });

    await recordSession(a1.id, student.id, teacher.id, 'ABSENT', 3);
    await recordSession(a2.id, student.id, teacher.id, 'ABSENT', 1);

    const res = await request(app).get('/api/v1/roster/health').set('Authorization', `Bearer ${teacher.token}`);
    const row = res.body.data.find((r: any) => r.studentId === student.id);
    expect(row.atRisk).toBe(true);
    expect(row.reasons).toContain('MISSED_SESSIONS');
  });

  it('does NOT flag MISSED_SESSIONS when the most recent session was attended', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const a1 = await linkAccepted(student.id, teacher.id);
    const a2 = await prisma.appointment.create({
      data: {
        studentId: student.id,
        teacherId: teacher.id,
        requestedDate: new Date(),
        requestedTime: '11:00',
        status: 'ACCEPTED',
      },
    });

    await recordSession(a1.id, student.id, teacher.id, 'ABSENT', 3);
    await recordSession(a2.id, student.id, teacher.id, 'PRESENT', 1);

    const res = await request(app).get('/api/v1/roster/health').set('Authorization', `Bearer ${teacher.token}`);
    const row = res.body.data.find((r: any) => r.studentId === student.id);
    expect(row.reasons).not.toContain('MISSED_SESSIONS');
  });

  it('flags STREAK_BROKEN when currentStreak is 0, longestStreak was earned, and the reset happened this week', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    await prisma.streak.create({
      data: { userId: student.id, currentStreak: 0, longestStreak: 12, lastActiveDate: new Date() },
    });

    const res = await request(app).get('/api/v1/roster/health').set('Authorization', `Bearer ${teacher.token}`);
    const row = res.body.data.find((r: any) => r.studentId === student.id);
    expect(row.reasons).toContain('STREAK_BROKEN');
  });

  it('does NOT flag STREAK_BROKEN for a student who never had a streak', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    await linkAccepted(student.id, teacher.id);
    await prisma.streak.create({
      data: { userId: student.id, currentStreak: 0, longestStreak: 0, lastActiveDate: new Date() },
    });

    const res = await request(app).get('/api/v1/roster/health').set('Authorization', `Bearer ${teacher.token}`);
    const row = res.body.data.find((r: any) => r.studentId === student.id);
    expect(row.reasons).not.toContain('STREAK_BROKEN');
  });

  it('flags GRADE_GAP when the most recent grade from this teacher is older than 14 days, or absent', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const staleGraded = await createUser({ role: Role.STUDENT, email: 'stale@example.com' });
    const freshGraded = await createUser({ role: Role.STUDENT, email: 'fresh@example.com' });
    const ungraded = await createUser({ role: Role.STUDENT, email: 'ungraded@example.com' });
    await linkAccepted(staleGraded.id, teacher.id);
    await linkAccepted(freshGraded.id, teacher.id);
    await linkAccepted(ungraded.id, teacher.id);

    await prisma.grade.create({
      data: {
        studentId: staleGraded.id,
        teacherId: teacher.id,
        surahId: null,
        grade: 'A',
        type: 'ORAL',
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.grade.create({
      data: { studentId: freshGraded.id, teacherId: teacher.id, surahId: null, grade: 'A', type: 'ORAL' },
    });

    const res = await request(app).get('/api/v1/roster/health').set('Authorization', `Bearer ${teacher.token}`);
    const staleRow = res.body.data.find((r: any) => r.studentId === staleGraded.id);
    const freshRow = res.body.data.find((r: any) => r.studentId === freshGraded.id);
    const ungradedRow = res.body.data.find((r: any) => r.studentId === ungraded.id);
    expect(staleRow.reasons).toContain('GRADE_GAP');
    expect(freshRow.reasons).not.toContain('GRADE_GAP');
    expect(ungradedRow.reasons).toContain('GRADE_GAP');
  });

  it('a teacher with no accepted students gets an empty roster, not an error', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await request(app).get('/api/v1/roster/health').set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
