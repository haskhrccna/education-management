#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const fallbackPath = path.join(distDir, '404.html');
const nojekyllPath = path.join(distDir, '.nojekyll');

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

fs.copyFileSync(indexPath, fallbackPath);
fs.writeFileSync(nojekyllPath, '');

console.log(
  `prepare-github-pages: neutralized import.meta in ${patchedFiles} bundle(s) (${patchedHits} hit(s)); ` +
    'wrote dist/404.html and dist/.nojekyll'
);
