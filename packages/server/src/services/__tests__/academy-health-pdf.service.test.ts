import { generateAcademyHealthPDF } from '../academy-health-pdf.service';
import type { AcademyHealthMetrics } from '../academy-health.service';

const metrics: AcademyHealthMetrics = {
  totalStudents: 42,
  activeThisWeek: 30,
  activeRatePct: 71,
  pagesMemorizedThisWeek: 58,
  revisionAdherencePct: 88,
  atRiskCount: 3,
  teacherLoad: [{ teacherId: 't1', firstName: 'Ahmad', lastName: 'Al-Rashid', activeStudents: 12 }],
  completionRatePct: 92,
  generatedAt: '2026-07-26T12:00:00.000Z',
};

describe('generateAcademyHealthPDF', () => {
  it('produces a non-empty PDF buffer with a valid PDF header', async () => {
    const buf = await generateAcademyHealthPDF(metrics);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('completes within the 5s budget (AC9.3)', async () => {
    const start = Date.now();
    await generateAcademyHealthPDF(metrics);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
