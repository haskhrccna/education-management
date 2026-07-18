import fs from 'fs';
import os from 'os';
import path from 'path';

// Point the static mushaf mount at a stub dir so integration tests don't
// need the real 51MB asset set. Runs (setupFiles) before app.ts reads config.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mushaf-itest-'));
fs.writeFileSync(path.join(dir, '1.webp'), 'stub-page-1');
fs.writeFileSync(path.join(dir, '604.webp'), 'stub-page-604');
process.env.MUSHAF_PAGES_DIR = dir;
