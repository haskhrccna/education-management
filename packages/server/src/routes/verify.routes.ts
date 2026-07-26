import { Router } from 'express';
import { config } from '../config';
import { verifyToken, PROGRAM_NAME } from '../services/verification.service';
import { getActiveDefaultProfile } from '../services/academy-profile.service';

const router = Router();

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface PageMeta {
  ogImageUrl?: string; // absolute URL — required by Open Graph, WhatsApp/Facebook won't resolve a relative path
  ogTitle?: string;
  ogDescription?: string;
  programName?: string; // branded program name for <title>; falls back to PROGRAM_NAME
}

function page(title: string, body: string, meta: PageMeta = {}): string {
  const og = [
    meta.ogTitle ? `<meta property="og:title" content="${escapeHtml(meta.ogTitle)}" />` : '',
    meta.ogDescription ? `<meta property="og:description" content="${escapeHtml(meta.ogDescription)}" />` : '',
    meta.ogImageUrl ? `<meta property="og:image" content="${escapeHtml(meta.ogImageUrl)}" />` : '',
    meta.ogImageUrl
      ? `<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — ${escapeHtml(meta.programName ?? PROGRAM_NAME)}</title>
${og}
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #F5F5F5; color: #212121; padding: 24px; box-sizing: border-box;
  }
  @media (prefers-color-scheme: dark) { body { background: #121212; color: #F5F5F5; } }
  .card {
    max-width: 440px; width: 100%; background: #FFFFFF; border-radius: 16px;
    padding: 40px 32px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    border-top: 4px solid #FFC107;
  }
  @media (prefers-color-scheme: dark) { .card { background: #1E1E1E; box-shadow: 0 4px 24px rgba(0,0,0,0.4); } }
  .badge { font-size: 40px; margin-bottom: 8px; }
  .program { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #757575; margin: 0 0 16px; }
  @media (prefers-color-scheme: dark) { .program { color: #9E9E9E; } }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .sub { font-size: 15px; color: #757575; margin: 0 0 20px; }
  @media (prefers-color-scheme: dark) { .sub { color: #9E9E9E; } }
  .divider { height: 1px; background: rgba(117,117,117,0.2); margin: 20px 0; }
  .row { font-size: 14px; color: #757575; margin: 6px 0; }
  @media (prefers-color-scheme: dark) { .row { color: #9E9E9E; } }
  .row strong { color: inherit; font-weight: 600; }
  .footer { font-size: 12px; color: #9E9E9E; margin-top: 24px; }
</style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

router.get('/:token', async (req, res) => {
  const result = await verifyToken(req.params.token);

  if (!result) {
    res.status(404).send(
      page(
        'Not found',
        `<div class="badge">🔍</div>
         <p class="program">${escapeHtml(PROGRAM_NAME)}</p>
         <h1>This link isn't valid</h1>
         <p class="sub">It may have been revoked or never existed.</p>`
      )
    );
    return;
  }

  const profile = await getActiveDefaultProfile();
  const programName = profile?.programName ?? PROGRAM_NAME;
  const academyName = profile?.displayName ?? null;
  const brandLine = academyName ? `${academyName} — ${programName}` : programName;
  const sharePath = `/api/v1/public/verify/${encodeURIComponent(req.params.token)}/share.png`;
  // NEVER derive this origin from req.get('host') — the Host header is
  // client-controlled, which would let an attacker point a social-preview
  // crawler's fetch at an arbitrary host.
  const shareOrigin = config.publicApiUrl ?? `http://localhost:${config.port}`;
  const shareUrl = `${shareOrigin}${sharePath}`;

  if (result.type === 'CERTIFICATE') {
    res.send(
      page(
        'Certificate',
        `<div class="badge">🏆</div>
         <p class="program">${escapeHtml(brandLine)}</p>
         <h1>Certificate of Completion</h1>
         <p class="sub">The full Quran, memorized cover to cover</p>
         <div class="divider"></div>
         <div class="row"><strong>${escapeHtml(result.studentName)}</strong></div>
         <div class="row">Issued ${formatDate(result.issuedAt)}</div>
         <div class="footer">Verified by ${escapeHtml(programName)}</div>`,
        {
          ogImageUrl: shareUrl,
          ogTitle: 'Certificate of Completion',
          ogDescription: `Verified by ${programName}`,
          programName,
        }
      )
    );
    return;
  }

  const scopeLabel =
    result.scope === 'FULL_QURAN'
      ? 'the full Quran'
      : result.scope === 'JUZ'
        ? `Juz ${result.juzNumber}`
        : (result.surahNameEn ?? 'a surah');

  res.send(
    page(
      'Ijazah',
      `<div class="badge">🎗️</div>
       <p class="program">${escapeHtml(brandLine)}</p>
       <h1>Ijazah</h1>
       <p class="sub">Formally endorsed completion of ${escapeHtml(scopeLabel)}</p>
       <div class="divider"></div>
       <div class="row"><strong>${escapeHtml(result.studentName)}</strong></div>
       <div class="row">Endorsed by ${escapeHtml(result.teacherName)}</div>
       <div class="row">Issued ${formatDate(result.issuedAt)}</div>
       <div class="footer">Verified by ${escapeHtml(programName)}</div>`,
      { ogImageUrl: shareUrl, ogTitle: 'Ijazah', ogDescription: `Verified by ${programName}`, programName }
    )
  );
});

export default router;
