/**
 * listPlans computes a pace verdict per plan. It used to do that one plan at a
 * time (`Promise.all(plans.map(attachPace))`), each with its own
 * memorizationProgress query — so an admin listing every plan in the academy
 * issued one query per plan. The batched version must produce the SAME
 * verdicts, which is what these tests pin; the query count is asserted
 * separately so a well-meaning refactor cannot quietly reintroduce the fan-out.
 */
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({ __esModule: true, prisma: mockDeep<PrismaClient>() }));

import { prisma } from '../../prisma/client';
import { listPlans } from '../curriculum-plan.service';

const p = prisma as unknown as DeepMockProxy<PrismaClient>;

const PAST = new Date('2020-01-01');
const FUTURE = new Date('2099-01-01');

/** Two students, three plans, every pace outcome represented. */
const PLANS = [
  {
    // Target date passed, surah not memorized → BEHIND
    id: 'plan-behind',
    studentId: 'student-a',
    teacherId: 'teacher-1',
    items: [{ surahId: 1, targetDate: PAST }],
  },
  {
    // Not due yet, but already memorized → AHEAD
    id: 'plan-ahead',
    studentId: 'student-a',
    teacherId: 'teacher-1',
    items: [{ surahId: 2, targetDate: FUTURE }],
  },
  {
    // Due and done → ON_PACE. Different student, so the batch must not mix
    // one student's completions into another's plan.
    id: 'plan-onpace',
    studentId: 'student-b',
    teacherId: 'teacher-1',
    items: [{ surahId: 3, targetDate: PAST }],
  },
];

describe('listPlans — pace verdicts and query count', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    p.curriculumPlan.findMany.mockResolvedValue(PLANS as never);
    // student-a finished surah 2; student-b finished surah 3.
    p.memorizationProgress.findMany.mockResolvedValue([
      { userId: 'student-a', surahId: 2 },
      { userId: 'student-b', surahId: 3 },
    ] as never);
  });

  it('gives each plan the verdict it had before the batching change', async () => {
    const plans = (await listPlans('admin-1', 'ADMIN')) as unknown as { id: string; pace: string }[];
    expect(plans.map((x) => [x.id, x.pace])).toEqual([
      ['plan-behind', 'BEHIND'],
      ['plan-ahead', 'AHEAD'],
      ['plan-onpace', 'ON_PACE'],
    ]);
  });

  it('reads progress once for the whole list, not once per plan', async () => {
    await listPlans('admin-1', 'ADMIN');
    expect(p.memorizationProgress.findMany).toHaveBeenCalledTimes(1);
  });

  it("does not credit one student with another student's completed surah", async () => {
    // student-b finished surah 3; plan-behind belongs to student-a and wants
    // surah 1. If the batch keyed on surah alone, this would flip to ON_PACE.
    const plans = (await listPlans('admin-1', 'ADMIN')) as unknown as { id: string; pace: string }[];
    expect(plans.find((x) => x.id === 'plan-behind')?.pace).toBe('BEHIND');
  });

  it('treats a plan with no items as ON_PACE', async () => {
    p.curriculumPlan.findMany.mockResolvedValue([
      { id: 'empty', studentId: 'student-a', teacherId: 'teacher-1', items: [] },
    ] as never);
    const plans = (await listPlans('teacher-1', 'TEACHER')) as unknown as { pace: string }[];
    expect(plans[0].pace).toBe('ON_PACE');
  });

  it('asks for nothing when there are no plans', async () => {
    p.curriculumPlan.findMany.mockResolvedValue([] as never);
    const plans = await listPlans('teacher-1', 'TEACHER');
    expect(plans).toEqual([]);
    expect(p.memorizationProgress.findMany).not.toHaveBeenCalled();
  });
});
