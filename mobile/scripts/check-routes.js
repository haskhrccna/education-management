#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appRoot = path.join(root, 'app');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

function routeFromFile(file) {
  const relative = path
    .relative(appRoot, file)
    .replace(/\\/g, '/')
    .replace(/\.(tsx|ts)$/, '');
  const segments = relative.split('/').filter((segment) => !segment.startsWith('(') && segment !== '_layout');
  if (segments.length === 0) return null;
  if (segments[segments.length - 1] === 'index') segments.pop();
  return `/${segments.join('/')}` || '/';
}

const routePatterns = walk(appRoot)
  .map(routeFromFile)
  .filter(Boolean)
  .map((route) => ({
    route,
    pattern: new RegExp(
      `^${route
        .split('/')
        .map((segment) => {
          if (!segment) return '';
          if (/^\[[^\]]+\]$/.test(segment)) return '[^/]+';
          return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/')}$`
    ),
  }));

function isInternalRoute(value) {
  return value.startsWith('/') && !value.startsWith('//') && !/^https?:\/\//.test(value);
}

function normalizeRoute(value) {
  return value.split('?')[0].replace(/\/+$/, '') || '/';
}

function hasMatchingRoute(value) {
  const route = normalizeRoute(value);
  return routePatterns.some(({ pattern }) => pattern.test(route));
}

function stackScreenExists(name) {
  const directFile = path.join(appRoot, `${name}.tsx`);
  const directTsFile = path.join(appRoot, `${name}.ts`);
  const indexFile = path.join(appRoot, name, 'index.tsx');
  const indexTsFile = path.join(appRoot, name, 'index.ts');
  const layoutFile = path.join(appRoot, name, '_layout.tsx');
  const layoutTsFile = path.join(appRoot, name, '_layout.ts');
  return [directFile, directTsFile, indexFile, indexTsFile, layoutFile, layoutTsFile].some((candidate) =>
    fs.existsSync(candidate)
  );
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

const findings = [];
for (const file of walk(path.join(root, 'app')).concat(walk(path.join(root, 'src')))) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).replace(/\\/g, '/');

  const stringCall = /\brouter\.(push|replace)\(\s*(['"`])([^'"`$]+)\2/g;
  let match;
  while ((match = stringCall.exec(text))) {
    const route = match[3];
    if (isInternalRoute(route) && !hasMatchingRoute(route)) {
      findings.push(`${relative}:${lineNumber(text, match.index)} router.${match[1]}('${route}') has no app route`);
    }
  }

  const objectPathname = /\brouter\.(push|replace)\(\s*\{[\s\S]*?\bpathname:\s*(['"`])([^'"`$]+)\1/g;
  while ((match = objectPathname.exec(text))) {
    const route = match[2];
    if (isInternalRoute(route) && !hasMatchingRoute(route)) {
      findings.push(
        `${relative}:${lineNumber(text, match.index)} router.${match[1]}({ pathname: '${route}' }) has no app route`
      );
    }
  }

  const stackScreen = /<Stack\.Screen\s+name=(['"`])([^'"`]+)\1/g;
  while ((match = stackScreen.exec(text))) {
    if (!stackScreenExists(match[2])) {
      findings.push(`${relative}:${lineNumber(text, match.index)} Stack.Screen name="${match[2]}" has no app route`);
    }
  }
}

if (findings.length) {
  console.error('check-routes: broken route links found:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`check-routes: OK (${routePatterns.length} app routes scanned)`);
