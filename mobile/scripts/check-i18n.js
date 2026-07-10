#!/usr/bin/env node
/* Fails when any t('key') used in app/ or src/ is missing from ar or en. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/i18n/index.ts'), 'utf8');
const arBlock = src.slice(src.indexOf('arTranslations'), src.indexOf('enTranslations'));
const enBlock = src.slice(src.indexOf('enTranslations'));
const grab = (block) => {
  const keys = new Set();
  const re = /^\s\s([A-Za-z][A-Za-z0-9_]*):\s/gm;
  let m;
  while ((m = re.exec(block))) keys.add(m[1]);
  return keys;
};
const ar = grab(arBlock);
const en = grab(enBlock);
const used = new Set();
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const text = fs.readFileSync(p, 'utf8');
      const re = /[^A-Za-z.]t\(\s*'([A-Za-z][A-Za-z0-9_]*)'/g;
      let m;
      while ((m = re.exec(text))) used.add(m[1]);
    }
  }
};
walk(path.join(root, 'app'));
walk(path.join(root, 'src'));
const missing = [...used].filter((k) => !ar.has(k) || !en.has(k)).sort();
if (missing.length) {
  console.error(`check-i18n: ${missing.length} used key(s) missing from ar or en:\n` + missing.join('\n'));
  process.exit(1);
}
console.log(`check-i18n: OK (${used.size} used keys, ar ${ar.size}, en ${en.size})`);
