/**
 * Both clients, one database.
 *
 * The mobile app and the web export resolve their API origin from one module
 * (mobile/src/api/apiBase.ts), and the server has exactly one DATABASE_URL.
 * These tests pin both halves: a suite handed a different database is refused
 * before it runs, and a grade written once through the API comes back
 * identically to both clients.
 */
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { config } from '../config';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';
import { resolveApiBase, resolveSocketOrigin, DEFAULT_API_BASE } from '@quran-review/shared';
import { assertSharedTestDatabase, resolveTestDatabaseUrl, SHARED_TEST_DATABASE_URL } from '../lib/test-database';

beforeEach(truncateAll);
afterAll(disconnect);

describe('the mobile app and the web export share one database', () => {
  it('refuses to run against anything but the shared test database', () => {
    expect(resolveTestDatabaseUrl({})).toBe(SHARED_TEST_DATABASE_URL);
    expect(() => assertSharedTestDatabase(SHARED_TEST_DATABASE_URL)).not.toThrow();
    expect(() => assertSharedTestDatabase('postgresql://postgres:postgres@localhost:5432/quran_review')).toThrow(
      /quran_review_test/
    );
    expect(() => assertSharedTestDatabase('postgresql://postgres:postgres@localhost:5432/education_test')).toThrow(
      /education_test/
    );
  });

  it('the server under test is bound to that same database', () => {
    expect(config.databaseUrl).toBe(resolveTestDatabaseUrl());
    assertSharedTestDatabase(config.databaseUrl);
  });

  it('every client resolves the API origin from one module, so they cannot drift apart', () => {
    const readers = [
      ['src/api/client.ts', "from './apiBase'"],
      ['src/api/contract.ts', "from './apiBase'"],
      ['src/hooks/useSocket.ts', "from '../api/apiBase'"],
      ['src/lib/mushafAssets.ts', "from '../api/apiBase'"],
      ['app/teacher/recordings.tsx', "from '@/src/api/contract'"],
    ] as const;
    for (const [file, importFrom] of readers) {
      const source = fs.readFileSync(path.join(__dirname, '../../../../mobile', file), 'utf8');
      expect(source).toContain(importFrom);
      expect(source).not.toMatch(/process\.env\.EXPO_PUBLIC_API_URL/);
    }
  });

  it('native and web resolve the identical origin, and a hosted site with no API is refused', () => {
    const env = { EXPO_PUBLIC_API_URL: 'https://api.example.com/api/v1' };
    expect(resolveApiBase({ os: 'ios', env })).toBe(resolveApiBase({ os: 'web', env }));
    expect(resolveSocketOrigin({ os: 'web', env })).toBe('https://api.example.com');

    expect(resolveApiBase({ os: 'web' })).toBe(DEFAULT_API_BASE);
    expect(() => resolveApiBase({ os: 'web', hostname: 'haskhrccna.github.io' })).toThrow(/EXPO_PUBLIC_API_URL/);
    // A developer serving the site from their own machine may use the loopback default.
    expect(resolveApiBase({ os: 'web', hostname: 'localhost' })).toBe(DEFAULT_API_BASE);
  });

  it('a grade written once is readable identically by the mobile client and the web client', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT, assignedTeacherId: teacher.id });
    await prisma.appointment.create({
      data: {
        teacherId: teacher.id,
        studentId: student.id,
        requestedDate: new Date(),
        requestedTime: '09:00',
        status: 'ACCEPTED',
      },
    });
    const surah = await prisma.surah.create({
      data: { number: 1, nameAr: 'الفاتحة', nameEn: 'Al-Fatiha', ayahCount: 7, juz: 1 },
    });

    const written = await request(app)
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, surahId: surah.id, grade: 'A', type: 'ORAL', notes: 'Solid' });
    expect(written.status).toBe(201);

    // Same user, same API, same row. The two clients differ only in transport.
    const asMobile = await request(app)
      .get('/api/v1/grades')
      .set('Authorization', `Bearer ${student.token}`)
      .set('User-Agent', 'QuranReview/1.0 (mobile)');
    const asWeb = await request(app)
      .get('/api/v1/grades')
      .set('Authorization', `Bearer ${student.token}`)
      .set('User-Agent', 'Mozilla/5.0 (web)');

    expect(asMobile.status).toBe(200);
    expect(asWeb.body).toEqual(asMobile.body);
    expect(asWeb.body).toEqual([expect.objectContaining({ id: written.body.id, studentId: student.id, grade: 'A' })]);
  });
});
