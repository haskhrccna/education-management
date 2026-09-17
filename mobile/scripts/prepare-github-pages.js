#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const fallbackPath = path.join(distDir, '404.html');
const nojekyllPath = path.join(distDir, '.nojekyll');

/** Every exported .html file under dist/, recursively. */
function walkHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

if (!fs.existsSync(indexPath)) {
  console.error(`prepare-github-pages: missing ${indexPath}. Run expo export -p web first.`);
  process.exit(1);
}

// --- Neutralize `import.meta` in the web bundles ---------------------------
// Expo's web export loads the entry bundle as a CLASSIC <script defer> (not
// type="module"). Zustand v5 (and potentially other deps) ship dev-only
// deprecation guards written as `import.meta.env?.MODE`. In a classic script
// `import.meta` is a hard SyntaxError ("Cannot use 'import.meta' outside a
// module"), so the whole bundle fails to parse and the page renders BLANK.
// We rewrite `import.meta.env` -> a production-mode stand-in object, then any
// remaining bare `import.meta` -> a safe object, so the code parses and runs
// (and the dev warnings stay silent because MODE reads "production"). This is
// applied ONLY to the web export in dist/ — it never touches the native
// iOS/Android bundles.
const jsDir = path.join(distDir, '_expo', 'static', 'js', 'web');
let patchedFiles = 0;
let patchedHits = 0;
if (fs.existsSync(jsDir)) {
  for (const file of fs.readdirSync(jsDir)) {
    if (!file.endsWith('.js')) continue;
    const filePath = path.join(jsDir, file);
    const original = fs.readFileSync(filePath, 'utf8');
    if (!original.includes('import.meta')) continue;
    const before = (original.match(/import\.meta/g) || []).length;
    const patched = original
      .replace(/import\.meta\.env/g, '({MODE:"production"})')
      .replace(/import\.meta/g, '({env:{MODE:"production"}})');
    fs.writeFileSync(filePath, patched);
    patchedFiles += 1;
    patchedHits += before;
  }
}

// --- Strip react-helmet's empty <title> --------------------------------
// Expo's static renderer always emits `<title data-rh="true"></title>` from
// react-helmet, even when no screen sets a title. Browsers honour the FIRST
// title element, so that empty tag beat the real one from app/+html.tsx and
// every page shipped with a blank browser tab (and a blank link preview).
// Removing only the EMPTY helmet title leaves any route-set title intact.
let strippedTitles = 0;
for (const file of walkHtml(distDir)) {
  const html = fs.readFileSync(file, 'utf8');
  const stripped = html.replace(/<title data-rh="true">\s*<\/title>/g, '');
  if (stripped !== html) {
    fs.writeFileSync(file, stripped);
    strippedTitles += 1;
  }
}

fs.copyFileSync(indexPath, fallbackPath);
fs.writeFileSync(nojekyllPath, '');

// --- PWA: static export emits `dist/index.html` for the root only; service
// worker + manifest live in `public/` and are copied verbatim by Expo. Make
// sure a manifest link tag exists (Expo emits only favicon/base) and stamp
// the deployment's base path into the SW registration script for scoping.
const indexHtml = fs.readFileSync(indexPath, 'utf8');
// Expo copies public/* verbatim (sw.js already landed) but does NOT emit a
// manifest.json — write one from app.json's web block so install-to-homescreen
// works without any bundler change.
const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')).expo;
// The export emits NO <base> tag — the old `<base href>` lookup here always
// fell through to './', which silently mis-scoped the PWA manifest on a
// GitHub Pages project path. app.json's experiments.baseUrl is the single
// source of truth (it is also what the bundler inlines as EXPO_BASE_URL).
const rawBaseUrl = (appJson.experiments?.baseUrl || '').trim();
const baseHref = rawBaseUrl && rawBaseUrl !== '/' ? `/${rawBaseUrl.replace(/^\/+|\/+$/g, '')}/` : '/';
const manifestJson = {
  name: appJson.web?.name || appJson.name,
  short_name: appJson.web?.shortName || appJson.name,
  description: appJson.web?.description || '',
  start_url: baseHref,
  scope: baseHref,
  display: appJson.web?.display || 'standalone',
  orientation: appJson.web?.orientation || appJson.orientation || 'portrait',
  theme_color: appJson.web?.themeColor || '#1B5E20',
  background_color: appJson.web?.backgroundColor || appJson.splash?.backgroundColor || '#1B5E20',
  lang: appJson.web?.lang || 'ar',
  dir: appJson.web?.dir || 'auto',
  icons: [
    { src: `${baseHref}assets/assets/icon.png`, sizes: 'any', type: 'image/png', purpose: 'any' },
    { src: `${baseHref}favicon.ico`, sizes: '16x16 32x32', type: 'image/x-icon' },
  ],
};
if (!fs.existsSync(path.join(distDir, 'manifest.json'))) {
  fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifestJson, null, 2));
  console.log('prepare-github-pages: wrote dist/manifest.json');
}
if (!indexHtml.includes('rel="manifest"')) {
  const manifestTag = `  <link rel="manifest" href="${baseHref.replace(/\/$/, '')}/manifest.json" />\n`;
  fs.writeFileSync(indexPath, indexHtml.replace('</head>', `${manifestTag}</head>`));
  // 404.html is the fallback on Pages — keep it in sync.
  fs.copyFileSync(indexPath, fallbackPath);
  console.log(`prepare-github-pages: injected manifest link (base ${baseHref})`);
}

console.log(
  `prepare-github-pages: neutralized import.meta in ${patchedFiles} bundle(s) (${patchedHits} hit(s)); ` +
    `stripped ${strippedTitles} empty helmet title(s); wrote dist/404.html and dist/.nojekyll`
);

// --- Release guards -------------------------------------------------------
// These three regressions all shipped to production once and none of them
// failed a build, because a broken PWA/blank tab still exports "successfully".
// CI runs this script as part of the web smoke job, so assert them here.
const failures = [];

const finalIndex = fs.readFileSync(indexPath, 'utf8');
const titleMatch = finalIndex.match(/<title[^>]*>([\s\S]*?)<\/title>/);
if (!titleMatch || !titleMatch[1].trim()) {
  failures.push('dist/index.html has no non-empty <title> (check app/+html.tsx).');
}
if (!/<meta[^>]+name="description"/.test(finalIndex)) {
  failures.push('dist/index.html has no meta description (check app/+html.tsx).');
}
if (!finalIndex.includes('rel="manifest"')) {
  failures.push('dist/index.html has no manifest link — the app is not installable.');
}
if (!fs.existsSync(path.join(distDir, 'sw.js'))) {
  failures.push('dist/sw.js is missing — offline support would 404 at registration.');
}
// The service worker is registered at `${baseHref}sw.js`; if the manifest and
// the export disagree about the base path, registration 404s silently.
const manifestHref = (finalIndex.match(/rel="manifest"\s+href="([^"]+)"/) || [])[1];
if (manifestHref && !manifestHref.startsWith(baseHref)) {
  failures.push(`manifest href (${manifestHref}) does not sit under the deploy base path (${baseHref}).`);
}

if (failures.length) {
  console.error('prepare-github-pages: release guard failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `prepare-github-pages: release guards OK (base ${baseHref}, title ${JSON.stringify(titleMatch[1].trim())})`
);
