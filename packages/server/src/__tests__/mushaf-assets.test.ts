import fs from 'fs';
import os from 'os';
import path from 'path';
import { verifyMushafAssets } from '../lib/mushaf-assets';

describe('verifyMushafAssets', () => {
  it('reports missing pages and counts present ones', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mushaf-'));
    fs.writeFileSync(path.join(dir, '1.webp'), 'x');
    fs.writeFileSync(path.join(dir, '604.webp'), 'x');
    const r = verifyMushafAssets(dir);
    expect(r.present).toBe(2);
    expect(r.missing).toHaveLength(602);
    expect(r.missing[0]).toBe(2);
  });

  it('handles a nonexistent dir as all-missing', () => {
    const r = verifyMushafAssets('/nonexistent-h1-dir');
    expect(r.present).toBe(0);
    expect(r.missing).toHaveLength(604);
  });
});
