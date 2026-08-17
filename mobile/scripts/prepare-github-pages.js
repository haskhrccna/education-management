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

fs.copyFileSync(indexPath, fallbackPath);
fs.writeFileSync(nojekyllPath, '');

console.log('prepare-github-pages: wrote dist/404.html and dist/.nojekyll');
