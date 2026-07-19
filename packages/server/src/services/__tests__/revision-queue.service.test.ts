import { buildRevisionQueue, RevisionQueueItem } from '../revision-queue.service';

const day = (n: number, base = new Date('2026-07-19T12:00:00Z')) => new Date(base.getTime() - n * 86400000);
const TODAY = new Date('2026-07-19T12:00:00Z');

function page(p: number, ageDays: number, reviewedDaysAgo: number | null, status = 'MEMORIZED') {
  return {
    page: p,
    status,
    lastReviewedAt: reviewedDaysAgo == null ? null : day(reviewedDaysAgo),
    updatedAt: day(ageDays),
  };
}

describe('buildRevisionQueue (pure — sabaq/sabqi/manzil)', () => {
  it('fresh page (sabaq, interval 1) not yet reviewed today → due', () => {
    const q = buildRevisionQueue({ today: TODAY, pages: [page(10, 1, null)], weakPages: new Set(), overrides: [] });
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ page: 10, band: 'SABAQ', overdueDays: 0 });
  });

  it('sabqi page (age 10d, interval 3): reviewed 2d ago → not due; 3d ago → due', () => {
    const notDue = buildRevisionQueue({ today: TODAY, pages: [page(20, 10, 2)], weakPages: new Set(), overrides: [] });
    expect(notDue).toHaveLength(0);
    const due = buildRevisionQueue({ today: TODAY, pages: [page(20, 10, 3)], weakPages: new Set(), overrides: [] });
    expect(due[0]).toMatchObject({ page: 20, band: 'SABQI', overdueDays: 0 });
  });

  it('manzil page (age 40d, interval 7) reviewed 8d ago → due, overdue 1', () => {
    const q = buildRevisionQueue({ today: TODAY, pages: [page(30, 40, 8)], weakPages: new Set(), overrides: [] });
    expect(q[0]).toMatchObject({ page: 30, band: 'MANZIL', overdueDays: 1 });
  });

  it('weak page is boosted one band tighter (AC3.2): sabqi weak due after 2d', () => {
    const q = buildRevisionQueue({
      today: TODAY,
      pages: [page(20, 10, 2)],
      weakPages: new Set([20]),
      overrides: [],
    });
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ page: 20, band: 'SABQI' });
  });

  it('teacher override always sorts first and is never dropped (AC3.4)', () => {
    const q = buildRevisionQueue({
      today: TODAY,
      pages: [page(30, 40, 8)],
      weakPages: new Set(),
      overrides: [{ surahId: 2, scheduledFor: day(1) }],
    });
    expect(q[0]).toMatchObject({ surahId: 2, band: 'OVERRIDE' });
    expect(q[1]).toMatchObject({ page: 30, band: 'MANZIL' });
  });

  it('ordering: manzil (overdue desc) then sabqi then sabaq; ties by page asc (AC3.2)', () => {
    const q = buildRevisionQueue({
      today: TODAY,
      pages: [
        page(5, 1, null), // SABAQ
        page(40, 40, 20), // MANZIL overdue 13
        page(41, 40, 8), // MANZIL overdue 1
        page(21, 10, 5), // SABQI overdue 2
      ],
      weakPages: new Set(),
      overrides: [],
    });
    expect(q.map((i: RevisionQueueItem) => i.page)).toEqual([40, 41, 21, 5]);
  });

  it('deterministic: same input twice → identical output (AC3.1)', () => {
    const input = {
      today: TODAY,
      pages: [page(5, 1, null), page(40, 40, 20), page(21, 10, 5)],
      weakPages: new Set([21]),
      overrides: [{ surahId: 3, scheduledFor: day(2) }],
    };
    expect(buildRevisionQueue(input)).toEqual(buildRevisionQueue(input));
  });

  it('LEARNING / NOT_STARTED pages never queue', () => {
    const q = buildRevisionQueue({
      today: TODAY,
      pages: [page(7, 1, null, 'LEARNING'), page(8, 1, null, 'NOT_STARTED')],
      weakPages: new Set(),
      overrides: [],
    });
    expect(q).toHaveLength(0);
  });
});
