import fs from 'fs';
import path from 'path';
import { config } from '../config';

export const TOTAL_MUSHAF_PAGES = 604;

/** Where the 604 page WebPs live. Env-overridable so tests/deploys can relocate it. */
export function getMushafPagesDir(): string {
  return config.mushafPagesDir;
}

export function verifyMushafAssets(dir: string): { present: number; missing: number[] } {
  const missing: number[] = [];
  let present = 0;
  for (let p = 1; p <= TOTAL_MUSHAF_PAGES; p++) {
    if (fs.existsSync(path.join(dir, `${p}.webp`))) present++;
    else missing.push(p);
  }
  return { present, missing };
}
