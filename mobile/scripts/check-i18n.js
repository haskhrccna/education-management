#!/usr/bin/env node
/* Fails when any t('key') used in app/ or src/ is missing from ar or en. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/i18n/index.ts'), 'utf8');
const arBlock = src.slice(src.indexOf('arTranslations'), src.indexOf('enTranslations'));
const enBlock = src.slice(src.indexOf('enTranslations'), src.indexOf('i18next.use'));
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

/*
 * Inline-translation ratchet.
 *
 * The check above only sees strings that go through t('key'). A large share of
 * this app's user-facing text instead uses inline `isAr ? 'عربي' : 'English'`
 * ternaries, which the gate is structurally blind to. That blindness is not
 * theoretical: walking the app on 2026-07-28 surfaced two live defects that
 * live entirely in inline ternaries — teacher/home.tsx renders two different
 * cards ('Reviews' -> /teacher/recordings and 'Revisions' -> /teacher/revisions)
 * that are both titled 'المراجعات' in Arabic, and 'آية' is used for both "Ayah"
 * and "ayahs" because inline ternaries cannot express plural forms at all.
 *
 * Migrating all of these to t() is tracked separately (see
 * docs/superpowers/specs/2026-07-28-i18n-integrity-design.md). Until then this
 * ratchet stops the debt growing: it fails when the count of inline ternaries,
 * or the number of Arabic strings serving more than one English string, rises
 * above the recorded baseline. Lower these numbers as strings are migrated —
 * never raise them.
 */
const TERNARY_BASELINE = 260;
const COLLISION_BASELINE = 5;

const pairs = [];
const walkPairs = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkPairs(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const text = fs.readFileSync(p, 'utf8');
      const re = /isAr\s*\?\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g;
      let m;
      while ((m = re.exec(text))) pairs.push({ ar: m[1], en: m[2], file: path.relative(root, p) });
    }
  }
};
walkPairs(path.join(root, 'app'));
walkPairs(path.join(root, 'src'));

// One Arabic string legitimately maps to one concept. Mapping it to two
// different English strings means either a duplicated label on screen (a real
// navigation hazard, as with 'المراجعات') or a missing plural form.
const byAr = new Map();
for (const p of pairs) {
  if (!byAr.has(p.ar)) byAr.set(p.ar, new Map());
  const ens = byAr.get(p.ar);
  if (!ens.has(p.en)) ens.set(p.en, new Set());
  ens.get(p.en).add(p.file);
}
const collisions = [...byAr.entries()].filter(([, ens]) => ens.size > 1);

let failed = false;
if (pairs.length > TERNARY_BASELINE) {
  console.error(
    `check-i18n: inline isAr ternaries rose to ${pairs.length} (baseline ${TERNARY_BASELINE}).\n` +
      `New user-facing strings must go through t('key') so this gate can verify them.`
  );
  failed = true;
}
if (collisions.length > COLLISION_BASELINE) {
  console.error(
    `check-i18n: ${collisions.length} Arabic string(s) map to more than one English string ` +
      `(baseline ${COLLISION_BASELINE}).`
  );
  failed = true;
}
if (collisions.length) {
  console.warn(`check-i18n: ${collisions.length} ambiguous Arabic label(s) (at/under baseline, not failing):`);
  for (const [arText, ens] of collisions) {
    console.warn(`  "${arText}"`);
    for (const [enText, files] of ens) console.warn(`    -> "${enText}"  [${[...files].join(', ')}]`);
  }
}
if (failed) process.exit(1);

console.log(
  `check-i18n: OK (${used.size} used keys, ar ${ar.size}, en ${en.size}; ` +
    `${pairs.length} inline ternaries, ${collisions.length} ambiguous labels)`
);
