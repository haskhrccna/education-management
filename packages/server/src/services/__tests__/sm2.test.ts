import { computeSm2 } from '../revision.service';

/**
 * SM-2 algorithm is the heart of Phase 4. These tests verify the pure math
 * with no Prisma mocks — the function is the seed of every revision
 * interval the system ever computes, so a regression here cascades.
 */
describe('computeSm2 (SM-2 algorithm)', () => {
  // The "first-time learner" state we seed on a freshly-completed surah.
  const fresh = { interval: 1, easeFactor: 2.5, repetitions: 0 };

  describe('quality < 3 (lapse / failed recall)', () => {
    it('quality 0 → repetitions reset to 0, interval back to 1', () => {
      const next = computeSm2({ interval: 15, easeFactor: 2.5, repetitions: 4 }, 0);
      expect(next.repetitions).toBe(0);
      expect(next.interval).toBe(1);
    });

    it('quality 2 → repetitions reset to 0, interval back to 1', () => {
      const next = computeSm2({ interval: 30, easeFactor: 2.6, repetitions: 5 }, 2);
      expect(next.repetitions).toBe(0);
      expect(next.interval).toBe(1);
    });

    it('easeFactor never drops below 1.3 even after many failures', () => {
      let state = { interval: 10, easeFactor: 1.4, repetitions: 3 };
      for (let i = 0; i < 10; i++) {
        state = computeSm2(state, 0);
        expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
      }
      expect(state.easeFactor).toBe(1.3);
    });
  });

  describe('quality >= 3 (recalled)', () => {
    it('first successful recall (repetitions 0→1) → interval 1', () => {
      const next = computeSm2(fresh, 4);
      expect(next.repetitions).toBe(1);
      expect(next.interval).toBe(1);
    });

    it('second successful recall (repetitions 1→2) → interval 6', () => {
      const next = computeSm2({ interval: 1, easeFactor: 2.5, repetitions: 1 }, 4);
      expect(next.repetitions).toBe(2);
      expect(next.interval).toBe(6);
    });

    it('third+ recall multiplies interval by easeFactor, rounded', () => {
      // 6 * 2.5 = 15
      const next = computeSm2({ interval: 6, easeFactor: 2.5, repetitions: 2 }, 4);
      expect(next.repetitions).toBe(3);
      expect(next.interval).toBe(15);
    });

    it('perfect quality 5 increases easeFactor by 0.1', () => {
      const next = computeSm2(fresh, 5);
      // quality 5: delta = 0.1 - 0*(0.08 + 0*0.02) = 0.1
      expect(next.easeFactor).toBeCloseTo(2.6, 5);
    });

    it('borderline quality 3 leaves easeFactor essentially unchanged', () => {
      // quality 3: delta = 0.1 - 2*(0.08 + 2*0.02) = 0.1 - 2*0.12 = -0.14
      const next = computeSm2({ ...fresh, easeFactor: 2.5 }, 3);
      expect(next.easeFactor).toBeCloseTo(2.36, 2);
      expect(next.repetitions).toBe(1); // still advanced, just barely
    });
  });

  describe('progression walk (the "good student" path)', () => {
    it('5 perfect reviews: 1 → 6 → 15 → ~38 → ~94 (ease-compounded)', () => {
      let state = fresh;
      const intervals: number[] = [];
      for (let i = 0; i < 5; i++) {
        state = computeSm2(state, 5);
        intervals.push(state.interval);
      }
      // 1, 6, then ease-compounded. The canonical "1, 6, then growing"
      // shape is what we're really asserting — exact numbers depend on
      // the easeFactor update at each step.
      expect(intervals[0]).toBe(1);
      expect(intervals[1]).toBe(6);
      expect(intervals[2]).toBeGreaterThan(intervals[1]);
      expect(intervals[3]).toBeGreaterThan(intervals[2]);
      expect(intervals[4]).toBeGreaterThan(intervals[3]);
    });
  });
});
