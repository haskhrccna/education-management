/**
 * completeOnboarding must stamp once and only once.
 *
 * The route handler used to read the user, then write if the stamp was null —
 * two calls arriving together (double tap, a retry, two tabs) could both read
 * null and both write, moving the date. The database decides now, via
 * updateMany with the null check in the WHERE clause.
 */
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({ __esModule: true, prisma: mockDeep<PrismaClient>() }));

import { prisma } from '../../prisma/client';
import { completeOnboarding } from '../account.service';

const p = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('completeOnboarding', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stamps the user when onboarding has not been completed', async () => {
    p.user.updateMany.mockResolvedValue({ count: 1 } as never);
    const before = Date.now();

    const stamp = await completeOnboarding('user-1');

    expect(stamp.getTime()).toBeGreaterThanOrEqual(before);
    // The null check belongs in the query, not in a prior read.
    expect(p.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1', onboardingCompletedAt: null } })
    );
    expect(p.user.findUnique).not.toHaveBeenCalled();
  });

  it('echoes the original stamp when the user already completed it', async () => {
    const original = new Date('2026-01-01T00:00:00.000Z');
    p.user.updateMany.mockResolvedValue({ count: 0 } as never);
    p.user.findUnique.mockResolvedValue({ onboardingCompletedAt: original } as never);

    const stamp = await completeOnboarding('user-1');

    expect(stamp).toEqual(original);
  });

  it('does not move the date when two calls race', async () => {
    const original = new Date('2026-01-01T00:00:00.000Z');
    // Exactly one updateMany wins; the loser finds the existing stamp.
    let first = true;
    p.user.updateMany.mockImplementation((async () => {
      const won = first;
      first = false;
      return { count: won ? 1 : 0 };
    }) as never);
    p.user.findUnique.mockResolvedValue({ onboardingCompletedAt: original } as never);

    const [a, b] = await Promise.all([completeOnboarding('user-1'), completeOnboarding('user-1')]);

    // One of them is the winner's fresh stamp, the other is the stored one —
    // and exactly one write was attempted per call, with no read-then-write.
    expect([a, b].filter((d) => d === original)).toHaveLength(1);
    expect(p.user.updateMany).toHaveBeenCalledTimes(2);
  });

  it('404s when the user does not exist', async () => {
    p.user.updateMany.mockResolvedValue({ count: 0 } as never);
    p.user.findUnique.mockResolvedValue(null as never);

    await expect(completeOnboarding('ghost')).rejects.toMatchObject({ statusCode: 404 });
  });
});
