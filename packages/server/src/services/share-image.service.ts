import fs from 'fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { AppError } from '../middleware/error.middleware';
import { shareImageStorage } from '../lib/storage';
import { config } from '../config';
import { verifyToken, VerificationResult } from './verification.service';
import { getActiveDefaultProfile } from './academy-profile.service';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function achievementLabel(r: VerificationResult): { title: string; subtitle: string } {
  if (r.type === 'CERTIFICATE') {
    return { title: 'Certificate of Completion', subtitle: 'The full Quran, memorized cover to cover' };
  }
  const scope =
    r.scope === 'FULL_QURAN'
      ? 'the full Quran'
      : r.scope === 'JUZ'
        ? `Juz ${r.juzNumber}`
        : (r.surahNameEn ?? 'a surah');
  return { title: 'Ijazah', subtitle: `Formally endorsed completion of ${scope}` };
}

/**
 * Pure 1200×630 SVG. Flat colors keep the rendered PNG far below the 200KB
 * budget. Only verify-page facts appear (AC8.4): achievement, student name,
 * endorsing teacher, dates, program/academy name.
 */
export function buildShareSvg(result: VerificationResult, programName: string, academyName: string | null): string {
  const { title, subtitle } = achievementLabel(result);
  const issued = result.issuedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const teacherLine = result.type === 'IJAZAH' ? `Endorsed by ${result.teacherName}` : '';
  const footer = academyName ? `${academyName} · ${programName}` : programName;
  const F = `font-family="Cairo, 'Noto Sans Arabic', sans-serif"`;
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#1B5E20"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="#FFFFFF"/>
  <rect x="40" y="40" width="1120" height="10" rx="5" fill="#FFC107"/>
  <text x="600" y="150" text-anchor="middle" ${F} font-size="28" letter-spacing="4" fill="#757575">${esc(footer.toUpperCase())}</text>
  <text x="600" y="250" text-anchor="middle" ${F} font-size="56" font-weight="bold" fill="#212121">${esc(title)}</text>
  <text x="600" y="310" text-anchor="middle" ${F} font-size="30" fill="#757575">${esc(subtitle)}</text>
  <text x="600" y="410" text-anchor="middle" ${F} font-size="44" font-weight="bold" fill="#1B5E20">${esc(result.studentName)}</text>
  ${teacherLine ? `<text x="600" y="465" text-anchor="middle" ${F} font-size="28" fill="#757575">${esc(teacherLine)}</text>` : ''}
  <text x="600" y="540" text-anchor="middle" ${F} font-size="24" fill="#9E9E9E">Issued ${esc(issued)} · Verified by ${esc(programName)}</text>
</svg>`;
}

/**
 * Token validity is checked BEFORE any cache read: a revoked/rotated token
 * 404s immediately (AC8.3). The disk cache only saves render cost.
 */
export async function renderShareImage(token: string): Promise<Buffer> {
  const result = await verifyToken(token);
  if (!result) throw new AppError(404, 'Not found');

  const key = `${token}.png`;
  try {
    const p = shareImageStorage.getLocalPath(key);
    const stat = await fs.stat(p);
    if (Date.now() - stat.mtimeMs < CACHE_TTL_MS) return await fs.readFile(p);
  } catch {
    // cache miss or file vanished mid-read — fall through to render
  }

  const profile = await getActiveDefaultProfile();
  const svg = buildShareSvg(result, profile?.programName ?? result.programName, profile?.displayName ?? null);
  const png = new Resvg(svg, {
    font: {
      fontFiles: [config.shareImageFontPath],
      loadSystemFonts: false,
      defaultFontFamily: 'Cairo',
    },
  })
    .render()
    .asPng();
  const buf = Buffer.from(png);

  // Best-effort cache write; failure must not break the response.
  try {
    await shareImageStorage.saveBuffer(buf, key);
  } catch {
    /* ignore */
  }
  return buf;
}
