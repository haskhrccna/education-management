/**
 * Quran ayah import (fixes the mushaf reader's "Page not found").
 *
 * Source: Quran.com API v4 (`verses/by_page`) — KFGQPC Uthmani text, the
 * authoritative Madani Mushaf (Hafs an Asim), which carries the exact
 * 604-page layout, juz, and verse mapping the `Ayah` table needs.
 *
 * Idempotent: re-running skips rows that already exist (@@unique[surahId,number]).
 * Reusable: `importAyahs(db)` is called from the seed; running this file
 * directly imports against the shared prisma client.
 *
 * Standalone: cd packages/server && npx ts-node --transpile-only src/prisma/import-ayahs.ts
 */
import { PrismaClient } from '@prisma/client';

const API = 'https://api.quran.com/api/v4';
const TOTAL_PAGES = 604;
const CHUNK = 10; // pages fetched concurrently — polite to the public API

interface ApiVerse {
  verse_key: string; // "surah:ayah", e.g. "2:255"
  page_number: number;
  juz_number: number;
  text_uthmani?: string;
}

interface AyahRow {
  surahId: number;
  number: number;
  page: number;
  juz: number;
  text: string | null;
}

async function fetchPage(page: number): Promise<ApiVerse[]> {
  const res = await fetch(`${API}/verses/by_page/${page}?fields=text_uthmani&per_page=300`);
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
  const json = (await res.json()) as { verses: ApiVerse[] };
  return json.verses ?? [];
}

/**
 * Fetch all 6,236 ayahs from the verified source and upsert them into `db`.
 * Requires network access. Returns how many rows were newly inserted and the
 * total ayah count afterwards. Throws if the source is unreachable — callers
 * that must survive offline (e.g. the seed) should catch it.
 */
export async function importAyahs(
  db: PrismaClient,
  opts: { quiet?: boolean } = {}
): Promise<{ inserted: number; total: number }> {
  const log = (msg: string) => {
    if (!opts.quiet) process.stdout.write(msg);
  };

  // Map surah number (1-114) -> surah.id (autoincrement PK).
  const surahs = await db.surah.findMany({ select: { id: true, number: true } });
  if (surahs.length === 0) throw new Error('No surahs seeded — run the seed first.');
  const surahIdByNumber = new Map(surahs.map((s) => [s.number, s.id]));

  const rows: AyahRow[] = [];
  const pagesBySurah = new Map<number, Set<number>>(); // surahId -> distinct pages

  for (let start = 1; start <= TOTAL_PAGES; start += CHUNK) {
    const pages = Array.from({ length: Math.min(CHUNK, TOTAL_PAGES - start + 1) }, (_, i) => start + i);
    const results = await Promise.all(pages.map(fetchPage));
    for (const verses of results) {
      for (const v of verses) {
        const [surahNumber, ayahNumber] = v.verse_key.split(':').map(Number);
        const surahId = surahIdByNumber.get(surahNumber);
        if (!surahId) continue; // surah not seeded — skip defensively
        rows.push({
          surahId,
          number: ayahNumber,
          page: v.page_number,
          juz: v.juz_number,
          text: v.text_uthmani ?? null,
        });
        if (!pagesBySurah.has(surahId)) pagesBySurah.set(surahId, new Set());
        pagesBySurah.get(surahId)!.add(v.page_number);
      }
    }
    log(`\r  fetched pages ${Math.min(start + CHUNK - 1, TOTAL_PAGES)}/${TOTAL_PAGES}`);
  }
  log('\n');

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);
    const res = await db.ayah.createMany({ data: batch, skipDuplicates: true });
    inserted += res.count;
  }

  // Populate Surah.pages (distinct pages each surah spans), sorted.
  for (const [surahId, pageSet] of pagesBySurah) {
    await db.surah.update({
      where: { id: surahId },
      data: { pages: Array.from(pageSet).sort((a, b) => a - b) },
    });
  }

  const total = await db.ayah.count();
  return { inserted, total };
}

// Standalone CLI entry — only runs when this file is executed directly,
// not when imported by the seed. Uses a plain client (no audit extension)
// since this is a one-shot bulk import.
if (require.main === module) {
  const prisma = new PrismaClient();
  importAyahs(prisma)
    .then(({ inserted, total }) => {
      console.log(`✅ Ayah import complete — inserted ${inserted} new, ${total} total in DB.`);
    })
    .catch((err) => {
      console.error('\n❌ import failed:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
