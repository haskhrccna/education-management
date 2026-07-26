import { buildShareSvg } from '../share-image.service';
import type { VerificationResult } from '../verification.service';

const cert: VerificationResult = {
  type: 'CERTIFICATE',
  studentName: 'Amina Yusuf',
  programName: 'Quran Review',
  issuedAt: new Date('2026-01-15'),
};

const ijazah: VerificationResult = {
  type: 'IJAZAH',
  studentName: 'Amina Yusuf',
  teacherName: 'Shaykh Ahmad',
  programName: 'Quran Review',
  scope: 'JUZ',
  surahNameEn: null,
  surahNameAr: null,
  juzNumber: 30,
  issuedAt: new Date('2026-01-15'),
};

describe('buildShareSvg', () => {
  it('is a 1200×630 SVG containing achievement, student, and program name', () => {
    const svg = buildShareSvg(cert, 'Quran Review', null);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('Amina Yusuf');
    expect(svg).toContain('Certificate of Completion');
    expect(svg).toContain('QURAN REVIEW');
  });

  it('includes the endorsing teacher, scope, and academy for an ijazah', () => {
    const svg = buildShareSvg(ijazah, 'Quran Review', 'Dar Al-Huda');
    expect(svg).toContain('Shaykh Ahmad');
    expect(svg).toContain('Juz 30');
    expect(svg).toContain('DAR AL-HUDA');
  });

  it('escapes XML-hostile characters in names (no injection surface)', () => {
    const svg = buildShareSvg({ ...cert, studentName: 'A<b>&"x"' }, 'P&Q', null);
    expect(svg).not.toContain('A<b>');
    expect(svg).toContain('A&lt;b&gt;&amp;&quot;x&quot;');
  });
});
