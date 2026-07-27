import PDFDocument from 'pdfkit';
import type { AcademyHealthMetrics } from './academy-health.service';

/** In-memory PDF — this is an ephemeral admin export, not a persisted Report
 *  row (unlike report.service.ts's per-student reports, which are re-downloaded
 *  later and so need disk persistence). */
export async function generateAcademyHealthPDF(metrics: AcademyHealthMetrics): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: true, margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(22).text('Academy Health Report', { align: 'center' }).moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor('#757575')
      .text(`Generated ${new Date(metrics.generatedAt).toLocaleString('en-US')}`, { align: 'center' })
      .fillColor('#000000')
      .moveDown(1.5);

    const row = (label: string, value: string | number) => {
      doc.fontSize(13).text(`${label}:`, { continued: true }).fontSize(13).text(` ${value}`);
      doc.moveDown(0.4);
    };

    row('Total students', metrics.totalStudents);
    row('Active this week', `${metrics.activeThisWeek} (${metrics.activeRatePct}%)`);
    row('Pages memorized this week', metrics.pagesMemorizedThisWeek);
    row('Revision adherence', `${metrics.revisionAdherencePct}%`);
    row('At-risk students', metrics.atRiskCount);
    row('Attendance completion rate', `${metrics.completionRatePct}%`);
    doc.moveDown(1);

    doc.fontSize(15).text('Teacher Load', { underline: true }).moveDown(0.5);
    if (metrics.teacherLoad.length === 0) {
      doc.fontSize(11).text('No teachers on record.');
    } else {
      for (const t of metrics.teacherLoad) {
        doc.fontSize(11).text(`${t.firstName} ${t.lastName} — ${t.activeStudents} active student(s)`);
      }
    }

    doc.end();
  });
}
