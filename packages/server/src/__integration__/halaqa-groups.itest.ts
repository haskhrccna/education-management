import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('POST /api/v1/halaqa/groups', () => {
  it('lets a teacher create a group with an attendance threshold', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .post('/api/v1/halaqa/groups')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: 'Evening Halaqa', attendanceThreshold: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.attendanceThreshold).toBe(3);
    expect(res.body.data.currentStreak).toBe(0);
  });

  it('rejects a student creating a group', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/halaqa/groups')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ title: 'Evening Halaqa', attendanceThreshold: 3 });
    expect(res.status).toBe(403);
  });
});

describe('collective halaqa streak', () => {
  it('increments the group streak when a session meets the attendance threshold, resets when it does not — never touching individual streaks', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const s1 = await createUser({ role: Role.STUDENT });
    const s2 = await createUser({ role: Role.STUDENT, email: 's2@example.com' });

    const group = await prisma.halaqaGroup.create({
      data: { teacherId: teacher.id, title: 'Evening Halaqa', attendanceThreshold: 2 },
    });

    // Individual streaks exist independently and must stay untouched.
    await prisma.streak.create({
      data: { userId: s1.id, currentStreak: 5, longestStreak: 5, lastActiveDate: new Date() },
    });

    // Session 1: both students attend → meets threshold of 2.
    const room1 = await prisma.halaqaRoom.create({
      data: { teacherId: teacher.id, groupId: group.id, title: 'Session', status: 'LIVE' },
    });
    await prisma.halaqaParticipant.create({ data: { roomId: room1.id, userId: s1.id } });
    await prisma.halaqaParticipant.create({ data: { roomId: room1.id, userId: s2.id } });

    const end1 = await request(app)
      .patch(`/api/v1/halaqa/${room1.id}/end`)
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(end1.status).toBe(200);

    let updatedGroup = await prisma.halaqaGroup.findUnique({ where: { id: group.id } });
    expect(updatedGroup?.currentStreak).toBe(1);
    expect(updatedGroup?.longestStreak).toBe(1);

    // The individual streak from before must be completely unaffected.
    const s1Streak = await prisma.streak.findUnique({ where: { userId: s1.id } });
    expect(s1Streak?.currentStreak).toBe(5);

    // Session 2: only one student attends → below threshold of 2 → streak resets.
    const room2 = await prisma.halaqaRoom.create({
      data: { teacherId: teacher.id, groupId: group.id, title: 'Session', status: 'LIVE' },
    });
    await prisma.halaqaParticipant.create({ data: { roomId: room2.id, userId: s1.id } });

    const end2 = await request(app)
      .patch(`/api/v1/halaqa/${room2.id}/end`)
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(end2.status).toBe(200);

    updatedGroup = await prisma.halaqaGroup.findUnique({ where: { id: group.id } });
    expect(updatedGroup?.currentStreak).toBe(0);
    expect(updatedGroup?.longestStreak).toBe(1); // longest is preserved through a reset
  });

  it('leaves a room with no group entirely unaffected (no streak side effect)', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const room = await prisma.halaqaRoom.create({ data: { teacherId: teacher.id, title: 'Session', status: 'LIVE' } });

    const res = await request(app)
      .patch(`/api/v1/halaqa/${room.id}/end`)
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/halaqa/groups/:id', () => {
  it('is visible to the owning teacher and to a student who attended a session, but not to an unrelated student', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const attendee = await createUser({ role: Role.STUDENT });
    const stranger = await createUser({ role: Role.STUDENT, email: 'stranger@example.com' });
    const group = await prisma.halaqaGroup.create({
      data: { teacherId: teacher.id, title: 'Evening Halaqa', attendanceThreshold: 1 },
    });
    const room = await prisma.halaqaRoom.create({
      data: { teacherId: teacher.id, groupId: group.id, title: 'Session' },
    });
    await prisma.halaqaParticipant.create({ data: { roomId: room.id, userId: attendee.id } });

    const teacherRes = await request(app)
      .get(`/api/v1/halaqa/groups/${group.id}`)
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(teacherRes.status).toBe(200);

    const attendeeRes = await request(app)
      .get(`/api/v1/halaqa/groups/${group.id}`)
      .set('Authorization', `Bearer ${attendee.token}`);
    expect(attendeeRes.status).toBe(200);

    const strangerRes = await request(app)
      .get(`/api/v1/halaqa/groups/${group.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(strangerRes.status).toBe(404);
  });
});
