import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

// GET /revisions, /weak-ayahs and /attendance are open to any authenticated
// role, and their services used to filter only for STUDENT and TEACHER. A
// PARENT fell through with no filter and read every family's children. Parents
// read their own children through the parent dashboard, not these endpoints.

beforeEach(truncateAll);
afterAll(disconnect);

interface World {
  student: TestUser;
  teacher: TestUser;
  parent: TestUser;
  planId: string;
  ijazahId: string;
}

async function seedOtherFamily(): Promise<World> {
  const teacher = await createUser({ role: Role.TEACHER });
  const student = await createUser({ role: Role.STUDENT });
  const parent = await createUser({ role: Role.PARENT }); // no ParentLink to this student

  const appointment = await prisma.appointment.create({
    data: {
      studentId: student.id,
      teacherId: teacher.id,
      requestedDate: new Date(),
      requestedTime: '10:00',
      status: 'ACCEPTED',
    },
  });
  const surah = await prisma.surah.create({
    data: { number: 114, nameAr: 'الناس', nameEn: 'An-Nas', ayahCount: 1, juz: 30 },
  });
  const ayah = await prisma.ayah.create({
    data: { surahId: surah.id, number: 1, page: 604, juz: 30, text: 'قل أعوذ برب الناس' },
  });
  await prisma.revisionSchedule.create({ data: { userId: student.id, surahId: surah.id, scheduledFor: new Date() } });
  await prisma.weakAyahFlag.create({
    data: { studentId: student.id, ayahId: ayah.id, flaggedByTeacherId: teacher.id },
  });
  await prisma.sessionRecord.create({
    data: { appointmentId: appointment.id, studentId: student.id, teacherId: teacher.id, status: 'PRESENT' },
  });
  const plan = await prisma.curriculumPlan.create({
    data: {
      studentId: student.id,
      teacherId: teacher.id,
      name: 'Juz Amma',
      items: { create: [{ surahId: surah.id, targetDate: new Date(), order: 1 }] },
    },
  });
  const ijazah = await prisma.ijazah.create({
    data: { studentId: student.id, teacherId: teacher.id, scope: 'SURAH', surahId: surah.id },
  });

  return { student, teacher, parent, planId: plan.id, ijazahId: ijazah.id };
}

const get = (path: string, user: TestUser) => request(app).get(path).set('Authorization', `Bearer ${user.token}`);

// Some of these routes answer with a bare array, others with { data: [...] }.
const rows = (res: request.Response): unknown[] | undefined =>
  Array.isArray(res.body) ? res.body : Array.isArray(res.body?.data) ? res.body.data : undefined;

describe('PARENT cannot read other students through the generic list endpoints', () => {
  it('GET /revisions → 403 for a parent, with no rows in the body', async () => {
    const { parent } = await seedOtherFamily();
    const res = await get('/api/v1/revisions', parent);
    expect(res.status).toBe(403);
    expect(rows(res)).toBeUndefined();
  });

  it('GET /weak-ayahs → 403 for a parent, with no rows in the body', async () => {
    const { parent } = await seedOtherFamily();
    const res = await get('/api/v1/weak-ayahs', parent);
    expect(res.status).toBe(403);
    expect(rows(res)).toBeUndefined();
  });

  it('GET /attendance?studentId= → 403 for a parent, with no rows in the body', async () => {
    const { parent, student } = await seedOtherFamily();
    const res = await get(`/api/v1/attendance?studentId=${student.id}`, parent);
    expect(res.status).toBe(403);
    expect(rows(res)).toBeUndefined();
  });
});

describe('students and teachers keep their access (controls)', () => {
  it('the student still sees their own revisions, weak ayahs and attendance', async () => {
    const { student } = await seedOtherFamily();
    const [rev, weak, att] = await Promise.all([
      get('/api/v1/revisions', student),
      get('/api/v1/weak-ayahs', student),
      get('/api/v1/attendance', student),
    ]);
    expect(rev.status).toBe(200);
    expect(rows(rev)).toHaveLength(1);
    expect(weak.status).toBe(200);
    expect(rows(weak)).toHaveLength(1);
    expect(att.status).toBe(200);
    expect(rows(att)).toHaveLength(1);
  });

  it("the linked teacher still sees their student's revisions, weak ayahs and attendance", async () => {
    const { teacher, student } = await seedOtherFamily();
    const [rev, weak, att] = await Promise.all([
      get('/api/v1/revisions', teacher),
      get('/api/v1/weak-ayahs', teacher),
      get(`/api/v1/attendance?studentId=${student.id}`, teacher),
    ]);
    expect(rev.status).toBe(200);
    expect(rows(rev)).toHaveLength(1);
    expect(weak.status).toBe(200);
    expect(rows(weak)).toHaveLength(1);
    expect(att.status).toBe(200);
    expect(rows(att)).toHaveLength(1);
  });
});

// The same default-allow shape, one layer down: these two read a single record
// by id, and their role checks covered only STUDENT and TEACHER. A PARENT
// matched neither branch and received the record — any family's. The role is
// now rejected by the contract's access list before the handler runs, and the
// services deny by default behind it.
describe("PARENT cannot read another family's records by id", () => {
  it('GET /curriculum-plans/:id → 403, and the plan is not in the body', async () => {
    const { parent, planId } = await seedOtherFamily();
    const res = await get(`/api/v1/curriculum-plans/${planId}`, parent);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('Juz Amma');
  });

  it('GET /ijazahs/:id → 403, and the record is not in the body', async () => {
    const { parent, ijazahId, student } = await seedOtherFamily();
    const res = await get(`/api/v1/ijazahs/${ijazahId}`, parent);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain(student.id);
  });

  it('GET /curriculum-plans and /ijazahs (lists) → 403 for a parent', async () => {
    const { parent } = await seedOtherFamily();
    const [plans, ijazahs] = await Promise.all([
      get('/api/v1/curriculum-plans', parent),
      get('/api/v1/ijazahs', parent),
    ]);
    expect(plans.status).toBe(403);
    expect(ijazahs.status).toBe(403);
  });

  it('the owning student and teacher still read them (controls)', async () => {
    const { student, teacher, planId, ijazahId } = await seedOtherFamily();
    const [studentPlan, teacherPlan, studentIjazah, teacherIjazah] = await Promise.all([
      get(`/api/v1/curriculum-plans/${planId}`, student),
      get(`/api/v1/curriculum-plans/${planId}`, teacher),
      get(`/api/v1/ijazahs/${ijazahId}`, student),
      get(`/api/v1/ijazahs/${ijazahId}`, teacher),
    ]);
    expect(studentPlan.status).toBe(200);
    expect(teacherPlan.status).toBe(200);
    expect(studentIjazah.status).toBe(200);
    expect(teacherIjazah.status).toBe(200);
  });

  it('an unrelated student cannot read either record', async () => {
    const { planId, ijazahId } = await seedOtherFamily();
    const outsider = await createUser({ role: Role.STUDENT });
    const [plan, ijazah] = await Promise.all([
      get(`/api/v1/curriculum-plans/${planId}`, outsider),
      get(`/api/v1/ijazahs/${ijazahId}`, outsider),
    ]);
    expect(plan.status).toBe(404);
    expect(ijazah.status).toBe(404);
  });
});
