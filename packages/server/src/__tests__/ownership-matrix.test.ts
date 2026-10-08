/**
 * Ownership matrix: can a caller read a record that is not theirs?
 *
 * The integration authz matrix (`__integration__/authz-matrix.itest.ts`) proves
 * the ROLE GATE — every endpoint × every identity, asserting a rejected role
 * gets 403. It cannot prove ownership: for `access: 'authenticated'` routes it
 * treats every role as allowed, and it calls each `:id` route with a UUID that
 * matches no row, so a handler that happily returns someone else's record still
 * passes. Two endpoints shipped exactly that way — a PARENT could read any
 * curriculum plan and any ijazah by id — and 1,052 green tests did not notice.
 *
 * This suite closes that gap at the service layer, where the decision actually
 * lives: for each by-id resolver, a record owned by one family is requested by
 * every other identity, and anything but a refusal fails.
 */
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../prisma/client', () => ({ __esModule: true, prisma: mockDeep<PrismaClient>() }));

import { prisma } from '../prisma/client';
import { getPlan, listPlans } from '../services/curriculum-plan.service';
import { getIjazah, listIjazahs } from '../services/ijazah.service';

const p = prisma as unknown as DeepMockProxy<PrismaClient>;

/** The record under test always belongs to these two — never to the caller. */
const OWNER_STUDENT = 'student-owner';
const OWNER_TEACHER = 'teacher-owner';

/** Every identity that is not the owning student, the owning teacher, or an admin. */
const OUTSIDERS: { label: string; id: string; role: string }[] = [
  { label: 'a parent', id: 'parent-1', role: 'PARENT' },
  { label: 'an unrelated student', id: 'student-other', role: 'STUDENT' },
  { label: 'an unrelated teacher', id: 'teacher-other', role: 'TEACHER' },
  // Guards must deny by default, not enumerate. A role added later (say
  // ASSISTANT) must be refused by these resolvers until someone decides
  // otherwise — this case is the regression test for that promise.
  { label: 'a role invented after this code was written', id: 'someone-1', role: 'ASSISTANT' },
];

const PLAN = {
  id: 'plan-1',
  studentId: OWNER_STUDENT,
  teacherId: OWNER_TEACHER,
  status: 'ACTIVE',
  items: [],
  createdAt: new Date(),
};

const IJAZAH = { id: 'ij-1', studentId: OWNER_STUDENT, teacherId: OWNER_TEACHER };

describe('ownership matrix — by-id resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    p.curriculumPlan.findUnique.mockResolvedValue(PLAN as never);
    p.ijazah.findUnique.mockResolvedValue(IJAZAH as never);
    p.memorizationProgress.findMany.mockResolvedValue([] as never);
  });

  describe('GET /curriculum-plans/:id', () => {
    for (const who of OUTSIDERS) {
      it(`refuses ${who.label}`, async () => {
        // 404 (the student/teacher mismatch path, which hides existence) and
        // 403 (the deny-by-default path) are both correct refusals; returning
        // the record is not.
        await getPlan('plan-1', who.id, who.role).then(
          () => {
            throw new Error(`getPlan returned a plan owned by ${OWNER_STUDENT} to ${who.label}`);
          },
          (err: { statusCode?: number }) => expect([403, 404]).toContain(err.statusCode)
        );
      });
    }

    it('allows the owning student', async () => {
      await expect(getPlan('plan-1', OWNER_STUDENT, 'STUDENT')).resolves.toMatchObject({ id: 'plan-1' });
    });

    it('allows the owning teacher', async () => {
      await expect(getPlan('plan-1', OWNER_TEACHER, 'TEACHER')).resolves.toMatchObject({ id: 'plan-1' });
    });

    it('allows an admin', async () => {
      await expect(getPlan('plan-1', 'admin-1', 'ADMIN')).resolves.toMatchObject({ id: 'plan-1' });
    });
  });

  describe('GET /ijazahs/:id', () => {
    for (const who of OUTSIDERS) {
      it(`refuses ${who.label}`, async () => {
        await getIjazah('ij-1', who.id, who.role).then(
          () => {
            throw new Error(`getIjazah returned an ijazah owned by ${OWNER_STUDENT} to ${who.label}`);
          },
          (err: { statusCode?: number }) => expect([403, 404]).toContain(err.statusCode)
        );
      });
    }

    it('allows the owning student', async () => {
      await expect(getIjazah('ij-1', OWNER_STUDENT, 'STUDENT')).resolves.toMatchObject({ id: 'ij-1' });
    });

    it('allows the owning teacher', async () => {
      await expect(getIjazah('ij-1', OWNER_TEACHER, 'TEACHER')).resolves.toMatchObject({ id: 'ij-1' });
    });

    it('allows an admin', async () => {
      await expect(getIjazah('ij-1', 'admin-1', 'ADMIN')).resolves.toMatchObject({ id: 'ij-1' });
    });
  });

  describe('list endpoints deny unknown roles rather than guessing a filter', () => {
    beforeEach(() => {
      p.curriculumPlan.findMany.mockResolvedValue([] as never);
      p.ijazah.findMany.mockResolvedValue([] as never);
    });

    for (const who of OUTSIDERS.filter((o) => o.role !== 'STUDENT' && o.role !== 'TEACHER')) {
      it(`listPlans refuses ${who.label}`, async () => {
        await expect(listPlans(who.id, who.role)).rejects.toMatchObject({ statusCode: 403 });
      });

      it(`listIjazahs refuses ${who.label}`, async () => {
        await expect(listIjazahs(who.id, who.role)).rejects.toMatchObject({ statusCode: 403 });
      });
    }

    it('scopes a student to their own plans', async () => {
      await listPlans(OWNER_STUDENT, 'STUDENT');
      expect(p.curriculumPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: OWNER_STUDENT } })
      );
    });

    it('scopes a teacher to their own plans', async () => {
      await listPlans(OWNER_TEACHER, 'TEACHER');
      expect(p.curriculumPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teacherId: OWNER_TEACHER } })
      );
    });
  });
});
