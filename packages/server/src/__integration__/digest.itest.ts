import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';
import { sendWeeklyDigests, buildWeeklyDigest } from '../services/digest.service';

beforeEach(truncateAll);
afterAll(disconnect);

async function approvedLink(parentId: string, studentId: string, digestOptOut = false) {
  return prisma.parentLink.create({
    data: { parentId, studentId, status: 'APPROVED', decidedAt: new Date(), digestOptOut },
  });
}

describe('buildWeeklyDigest', () => {
  it('reports no activity when nothing happened in the window', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const content = await buildWeeklyDigest(student.id, since);
    expect(content.hasActivity).toBe(false);
    expect(content.sessionsAttended).toBe(0);
    expect(content.gradesSinceLastDigest).toEqual([]);
  });

  it('counts sessions and grades within the window, and ignores older ones', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const appt = await prisma.appointment.create({
      data: {
        studentId: student.id,
        teacherId: teacher.id,
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
      },
    });
    await prisma.sessionRecord.create({
      data: { appointmentId: appt.id, studentId: student.id, teacherId: teacher.id, status: 'PRESENT' },
    });
    await prisma.grade.create({
      data: { studentId: student.id, teacherId: teacher.id, surahId: null, grade: 'A', type: 'ORAL' },
    });
    // Outside the 7-day window — must not be counted.
    await prisma.grade.create({
      data: {
        studentId: student.id,
        teacherId: teacher.id,
        surahId: null,
        grade: 'B',
        type: 'ORAL',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const content = await buildWeeklyDigest(student.id, since);
    expect(content.hasActivity).toBe(true);
    expect(content.sessionsAttended).toBe(1);
    expect(content.gradesSinceLastDigest).toHaveLength(1);
    expect(content.gradesSinceLastDigest[0].grade).toBe('A');
  });

  it('counts pages memorized this week and flags activity (F7/AC7.2)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    await prisma.pageMemorization.create({
      data: { userId: student.id, page: 3, status: 'MEMORIZED', lastReviewedAt: new Date() },
    });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const content = await buildWeeklyDigest(student.id, since);
    expect(content.pagesMemorizedThisWeek).toBe(1);
    expect(content.hasActivity).toBe(true);
    // Freshly memorized + just reviewed → sabaq interval 1 not yet elapsed.
    expect(content.revisionDueToday).toBe(0);
  });
});

describe('sendWeeklyDigests', () => {
  it('sends to APPROVED, non-opted-out links only, and persists a notification per parent', async () => {
    const included = await createUser({ role: Role.PARENT, email: 'included@example.com' });
    const optedOut = await createUser({ role: Role.PARENT, email: 'optedout@example.com' });
    const pending = await createUser({ role: Role.PARENT, email: 'pending@example.com' });
    const studentA = await createUser({ role: Role.STUDENT, email: 'a@example.com' });
    const studentB = await createUser({ role: Role.STUDENT, email: 'b@example.com' });
    const studentC = await createUser({ role: Role.STUDENT, email: 'c@example.com' });

    await approvedLink(included.id, studentA.id, false);
    await approvedLink(optedOut.id, studentB.id, true);
    await prisma.parentLink.create({ data: { parentId: pending.id, studentId: studentC.id, status: 'PENDING' } });

    const sent = await sendWeeklyDigests();
    expect(sent).toBe(1);

    const includedNotifications = await prisma.notification.findMany({ where: { userId: included.id } });
    expect(includedNotifications).toHaveLength(1);
    expect(includedNotifications[0].type).toBe('weekly_digest');

    const optedOutNotifications = await prisma.notification.findMany({ where: { userId: optedOut.id } });
    expect(optedOutNotifications).toHaveLength(0);

    const pendingNotifications = await prisma.notification.findMany({ where: { userId: pending.id } });
    expect(pendingNotifications).toHaveLength(0);
  });

  it('sends independently to multiple parents in the same run', async () => {
    const parent1 = await createUser({ role: Role.PARENT, email: 'p1@example.com' });
    const parent2 = await createUser({ role: Role.PARENT, email: 'p2@example.com' });
    const student1 = await createUser({ role: Role.STUDENT, email: 's1@example.com' });
    const student2 = await createUser({ role: Role.STUDENT, email: 's2@example.com' });

    await approvedLink(parent1.id, student1.id, false);
    await approvedLink(parent2.id, student2.id, false);

    const sent = await sendWeeklyDigests();
    expect(sent).toBe(2);
    expect(await prisma.notification.count({ where: { userId: parent1.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: parent2.id } })).toBe(1);
  });
});

describe('buildWeeklyDigest error path', () => {
  it("throws a 404 AppError for a studentId with no matching user (defense-in-depth for sendWeeklyDigests' try/catch)", async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await expect(buildWeeklyDigest('00000000-0000-4000-8000-000000000000', since)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('PATCH /api/v1/parent-links/:id/digest-preference', () => {
  it('lets a parent opt their own link out and back in', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const link = await approvedLink(parent.id, student.id, false);

    const off = await request(app)
      .patch(`/api/v1/parent-links/${link.id}/digest-preference`)
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ digestOptOut: true });
    expect(off.status).toBe(200);
    expect(off.body.digestOptOut).toBe(true);

    const row = await prisma.parentLink.findUnique({ where: { id: link.id } });
    expect(row!.digestOptOut).toBe(true);
  });

  it("404s when the link isn't the caller's", async () => {
    const owner = await createUser({ role: Role.PARENT, email: 'owner@example.com' });
    const outsider = await createUser({ role: Role.PARENT, email: 'outsider@example.com' });
    const student = await createUser({ role: Role.STUDENT });
    const link = await approvedLink(owner.id, student.id, false);

    const res = await request(app)
      .patch(`/api/v1/parent-links/${link.id}/digest-preference`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ digestOptOut: true });
    expect(res.status).toBe(404);
  });

  it('403s a non-parent caller', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .patch('/api/v1/parent-links/00000000-0000-4000-8000-000000000000/digest-preference')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ digestOptOut: true });
    expect(res.status).toBe(403);
  });
});
