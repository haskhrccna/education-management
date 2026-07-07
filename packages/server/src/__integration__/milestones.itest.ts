import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';
import { recordActivity, evaluateMilestones } from '../services/gamification.service';

beforeEach(truncateAll);
afterAll(disconnect);

describe('POST /api/v1/milestones', () => {
  it('creates a new milestone (badge + definition) without any code deploy', async () => {
    const admin = await createUser({ role: Role.ADMIN });

    const res = await request(app).post('/api/v1/milestones').set('Authorization', `Bearer ${admin.token}`).send({
      name: 'Halaqa Regular',
      description: 'Attended 10 halaqa sessions',
      iconKey: 'halaqa-star',
      triggerType: 'HALAQA_ATTENDANCE_COUNT',
      threshold: 10,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.badgeCode).toBe('halaqa_regular');
    expect(res.body.data.threshold).toBe(10);
    expect(res.body.data.badge.name).toBe('Halaqa Regular');

    const badge = await prisma.badge.findUnique({ where: { code: 'halaqa_regular' } });
    expect(badge).not.toBeNull();
  });

  it('409s a duplicate milestone name (same slugified code)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const body = {
      name: 'Dup Name',
      description: 'x',
      iconKey: 'x',
      triggerType: 'STREAK_LENGTH' as const,
      threshold: 5,
    };
    await request(app).post('/api/v1/milestones').set('Authorization', `Bearer ${admin.token}`).send(body);
    const res = await request(app).post('/api/v1/milestones').set('Authorization', `Bearer ${admin.token}`).send(body);
    expect(res.status).toBe(409);
  });

  it('400s a non-positive threshold', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .post('/api/v1/milestones')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'x', description: 'x', iconKey: 'x', triggerType: 'STREAK_LENGTH', threshold: 0 });
    expect(res.status).toBe(400);
  });

  it('403s a non-admin caller', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .post('/api/v1/milestones')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ name: 'x', description: 'x', iconKey: 'x', triggerType: 'STREAK_LENGTH', threshold: 5 });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/milestones', () => {
  it('lists every definition in the catalog', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await request(app)
      .post('/api/v1/milestones')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'One', description: 'x', iconKey: 'x', triggerType: 'STREAK_LENGTH', threshold: 5 });
    await request(app)
      .post('/api/v1/milestones')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Two', description: 'x', iconKey: 'x', triggerType: 'SURAH_COUNT', threshold: 3 });

    const res = await request(app).get('/api/v1/milestones').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('evaluateMilestones with an admin-created milestone (no code deploy)', () => {
  it('awards a brand-new PLAN_COMPLETION milestone the moment a student meets its threshold', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const student = await createUser({ role: Role.STUDENT });

    await request(app).post('/api/v1/milestones').set('Authorization', `Bearer ${admin.token}`).send({
      name: 'Plan Finisher',
      description: 'Completed a curriculum plan',
      iconKey: 'trophy',
      triggerType: 'PLAN_COMPLETION',
      threshold: 1,
    });

    // No plans completed yet — should not award.
    let awarded = await evaluateMilestones(student.id);
    expect(awarded.map((a) => a.code)).not.toContain('plan_finisher');

    // Simulate one completed plan directly (2.2's own flow is exercised in its own itest).
    const teacher = await createUser({ role: Role.TEACHER, email: 'teacher2@example.com' });
    const surah = await prisma.surah.create({
      data: { number: 200, nameAr: 'س', nameEn: 'S', ayahCount: 1, juz: 1 },
    });
    await prisma.curriculumPlan.create({
      data: {
        studentId: student.id,
        teacherId: teacher.id,
        name: 'done plan',
        status: 'COMPLETED',
        items: { create: [{ surahId: surah.id, targetDate: new Date(), order: 0 }] },
      },
    });

    awarded = await evaluateMilestones(student.id);
    expect(awarded.map((a) => a.code)).toContain('plan_finisher');

    const userBadge = await prisma.userBadge.findFirst({
      where: { userId: student.id },
      include: { badge: true },
    });
    expect(userBadge?.badge.code).toBe('plan_finisher');
  });

  it('the five migrated milestones still fire exactly as before (zero behavior change)', async () => {
    // Re-seed the 5 original catalog rows directly (the test DB has no
    // migration-seeded data — db push doesn't run migration SQL).
    const codes = ['first_surah_memorized', 'first_revision_completed', 'juz_complete', 'streak_7', 'streak_30'];
    for (const code of codes) {
      await prisma.badge.create({ data: { code, name: code, description: code, iconKey: 'x' } });
    }
    await prisma.milestoneDefinition.createMany({
      data: [
        { badgeCode: 'first_surah_memorized', triggerType: 'SURAH_COUNT', threshold: 1 },
        { badgeCode: 'first_revision_completed', triggerType: 'REVISION_COUNT', threshold: 1 },
        { badgeCode: 'juz_complete', triggerType: 'SURAH_COUNT', threshold: 30 },
        { badgeCode: 'streak_7', triggerType: 'STREAK_LENGTH', threshold: 7 },
        { badgeCode: 'streak_30', triggerType: 'STREAK_LENGTH', threshold: 30 },
      ],
    });

    const student = await createUser({ role: Role.STUDENT });
    let day = new Date('2026-01-01T00:00:00Z');
    for (let i = 0; i < 7; i++) {
      await recordActivity(student.id, day);
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    }

    const awarded = await evaluateMilestones(student.id);
    expect(awarded.map((a) => a.code)).toContain('streak_7');
    expect(awarded.map((a) => a.code)).not.toContain('streak_30');
    expect(awarded.map((a) => a.code)).not.toContain('first_surah_memorized');
  });
});
