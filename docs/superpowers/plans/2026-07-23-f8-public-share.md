# F8 · Public Landing + Certificate Share Image — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public verify page a branded, shareable acquisition surface: `AcademyProfile` model, public `GET /academy/:slug` + `GET /verify/:token/share.png` (1200×630 PNG ≤ 200KB), admin profile editing, WhatsApp-first mobile share, and a public mobile route group.

**Architecture:** New contract-routed `public` server module (no auth) + two admin contract routes on the existing admin mount. Share image is an SVG template rendered to PNG with `@resvg/resvg-js` (no browser dependency — conscious deviation from the spec's `puppeteer-core` suggestion, which its own risk table flagged for Chromium availability). Token validity is checked **before** any cache read, so revocation always 404s immediately; the disk cache (keyed by token, 24h TTL) only saves render cost.

**Tech Stack:** Prisma 6 migration · Zod contracts (`@quran-review/shared`) · `defineRoute`/`buildContractRouter` · `@resvg/resvg-js` · Expo Router public group · i18next (ar+en).

**Simulator demo checkpoints:** after Task 7, each surface is demonstrable in the integrated iOS simulator: admin → Academy Profile editor; student → certificates share flow (WhatsApp-first); `(public)/academy/default` via deep link `quran-review://academy/default`; verify page + share.png in Safari at `http://localhost:4000/api/v1/verify/<token>`.

## Global Constraints

- All migrations via `npx prisma migrate dev` — **never `db push`**; verify with `scripts/verify-migrations.sh`.
- All new endpoints use `defineRoute(contract, handler)` — no hand-wired Express routes.
- Every new endpoint added to `endpoint-manifest.ts` (completeness itest enforces registry↔manifest parity).
- Errors: `throw new AppError(status, message)` only.
- Mobile: every new i18n key in BOTH `ar` and `en` (`npm run check-i18n` enforces); `useTheme()` for colors; `AppText` for text; `marginStart/End` not Left/Right; a11y role+label+44pt targets on touchables.
- Roles UPPERCASE on server, lowercase on mobile.
- Public surface must expose **zero student PII** beyond the existing verify page (name, achievement, teacher name, dates, program name).
- Gates per branch: itests green · unit green · `tsc --noEmit` clean (server, shared, mobile) · `check-i18n` OK · `security-reviewer` agent sign-off (public surface).

**Branch:** `feat/public-share-image` off `main`.

**Acceptance criteria (from spec):**
- AC8.1 Share sheet WhatsApp-first in ordering/copy; share URL opens branded verify page.
- AC8.2 `share.png` = 1200×630 PNG ≤ 200KB with achievement, endorsing teacher, program name.
- AC8.3 Regenerating/revoking a link invalidates the share image URL immediately (no stale cache).
- AC8.4 No PII beyond the verify page.
- AC8.5 `GET /api/v1/public/academy/:slug` renders without auth; mobile public route group exists.
- AC3.1 Admin can edit academy profile fields.
- AC3.6 Itests: profile active/inactive 200/404; share.png valid/revoked 200/404; admin route rejection 401/403.

---

### Task 1: Dependency + `AcademyProfile` schema + migration

**Files:**
- Modify: `packages/server/package.json` (add `@resvg/resvg-js`)
- Modify: `packages/server/prisma/schema.prisma`
- Create: `packages/server/prisma/migrations/<timestamp>_add_academy_profile/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma model `AcademyProfile { id, slug (unique), displayName, publicBio?, programName, logoUrl?, contactEmail?, active (default false), createdAt, updatedAt }`. Slug is `"default"` for the single-academy MVP.

- [ ] **Step 1: Create branch and install the renderer**

```bash
git checkout -b feat/public-share-image
cd packages/server && npm install @resvg/resvg-js
```

Expected: `@resvg/resvg-js@^2` in `packages/server/package.json` dependencies.

- [ ] **Step 2: Add the model to `schema.prisma`** (append near `Certificate`, before `enum HalaqaStatus`)

```prisma
// Public-facing academy identity for the landing page + branded verify/share
// surfaces. Single row per platform for the MVP (slug "default"), seeded by admin.
model AcademyProfile {
  id           String   @id @default(uuid())
  slug         String   @unique
  displayName  String
  publicBio    String?
  programName  String
  logoUrl      String?
  contactEmail String?
  active       Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("academy_profiles")
}
```

- [ ] **Step 3: Generate the migration**

```bash
cd packages/server && npx prisma migrate dev --name add_academy_profile
```

Expected: new migration folder; `prisma generate` runs clean.

- [ ] **Step 4: Verify the migration ledger**

```bash
bash scripts/verify-migrations.sh
```

Expected: green (fresh `migrate deploy` builds full schema).

- [ ] **Step 5: Commit**

```bash
git add packages/server/package.json packages/server/prisma package-lock.json
git commit -m "feat(f8): AcademyProfile model + resvg dependency"
```

(Adjust lockfile path to whichever lockfile actually changed — workspaces hoist to the root lockfile.)

---

### Task 2: Shared contracts + validator

**Files:**
- Create: `packages/shared/src/contracts/public.contracts.ts`
- Modify: `packages/shared/src/contracts/admin.contracts.ts` (2 new contracts)
- Modify: `packages/shared/src/validators/common.ts` (UpsertAcademyProfileSchema)
- Modify: `packages/shared/src/contracts/registry.ts` (register publicContracts)
- Modify: `packages/shared/src/index.ts` (export publicContracts — mirror how `mediaContracts` is exported)

**Interfaces:**
- Produces: `publicContracts.getAcademyProfile` (`GET /api/v1/public/academy/:slug`, public, 200 `AcademyProfilePublic` | 404), `publicContracts.getShareImage` (`GET /api/v1/public/verify/:token/share.png`, public, 200 raw `image/png` | 404), `adminContracts.getAcademyProfile` (`GET /api/v1/admin/academy-profile`, ADMIN, 200 | 404), `adminContracts.upsertAcademyProfile` (`PUT /api/v1/admin/academy-profile`, ADMIN, 200).
- Produces: `UpsertAcademyProfileSchema` Zod schema + `AcademyProfilePublic` Zod object.

- [ ] **Step 1: Add the validator to `packages/shared/src/validators/common.ts`**

```ts
export const UpsertAcademyProfileSchema = z.object({
  displayName: z.string().min(1).max(120),
  programName: z.string().min(1).max(120),
  publicBio: z.string().max(2000).nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  active: z.boolean().optional(),
});
export type ZodUpsertAcademyProfileInput = z.infer<typeof UpsertAcademyProfileSchema>;
```

- [ ] **Step 2: Create `packages/shared/src/contracts/public.contracts.ts`**

```ts
import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut, rawResponse } from './types';

/** Public view of the academy — contactEmail is academy contact info, not student PII. */
export const AcademyProfilePublic = z.object({
  slug: z.string(),
  displayName: z.string(),
  publicBio: z.string().nullable(),
  programName: z.string(),
  logoUrl: z.string().nullable(),
  contactEmail: z.string().nullable(),
  updatedAt: DateOut,
});

export const publicContracts = {
  getAcademyProfile: defineContract({
    method: 'GET',
    path: '/api/v1/public/academy/:slug',
    summary: 'Public academy landing profile; 404 when missing or inactive',
    access: 'public',
    request: { params: z.object({ slug: z.string() }) },
    responses: { 200: AcademyProfilePublic, 404: ErrorEnvelope },
  }),
  getShareImage: defineContract({
    method: 'GET',
    path: '/api/v1/public/verify/:token/share.png',
    summary: '1200×630 share PNG for a certificate/ijazah; 404 for unknown or revoked token',
    access: 'public',
    request: { params: z.object({ token: z.string() }) },
    responses: { 200: rawResponse('image/png'), 404: ErrorEnvelope },
  }),
};
```

- [ ] **Step 3: Add admin contracts to `admin.contracts.ts`** (inside the `adminContracts` object; `AcademyProfileRow` above it; import `UpsertAcademyProfileSchema` from `../validators/common`)

```ts
// Full row incl. id/active for the admin editor.
const AcademyProfileRow = z.object({
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  publicBio: z.string().nullable(),
  programName: z.string(),
  logoUrl: z.string().nullable(),
  contactEmail: z.string().nullable(),
  active: z.boolean(),
  createdAt: DateOut,
  updatedAt: DateOut,
});
```

```ts
  getAcademyProfile: defineContract({
    method: 'GET',
    path: '/api/v1/admin/academy-profile',
    summary: 'Admin reads the (single, slug="default") academy profile — 404 before first save',
    access: ADMIN,
    responses: { 200: AcademyProfileRow, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  upsertAcademyProfile: defineContract({
    method: 'PUT',
    path: '/api/v1/admin/academy-profile',
    summary: 'Admin creates/updates the academy profile (upsert on slug="default")',
    access: ADMIN,
    request: { body: UpsertAcademyProfileSchema },
    responses: { 200: AcademyProfileRow, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
```

- [ ] **Step 4: Register in `registry.ts`**

```ts
import { publicContracts } from './public.contracts';
// ...
  ...Object.values(publicContracts),
```

- [ ] **Step 5: Export from `packages/shared/src/index.ts`** — mirror the existing contract exports; add `publicContracts` (and `ZodUpsertAcademyProfileInput` where other validator types are exported).

- [ ] **Step 6: Typecheck shared**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat(f8): public + admin academy-profile contracts"
```

---

### Task 3: Services — academy profile + share image (TDD on the pure SVG builder)

**Files:**
- Create: `packages/server/src/services/academy-profile.service.ts`
- Create: `packages/server/src/services/share-image.service.ts`
- Create: `packages/server/src/services/__tests__/share-image.service.test.ts`
- Modify: `packages/server/src/lib/storage.ts` (add `shareImageStorage` + `saveBuffer`)

**Interfaces:**
- Consumes: `verifyToken(token): Promise<VerificationResult | null>` and `PROGRAM_NAME` from `services/verification.service.ts`.
- Produces:
  - `getPublicProfile(slug)` — throws `AppError(404)` when missing or `active=false`; strips `id`/`active`/`createdAt`.
  - `getActiveDefaultProfile()` — null when missing/inactive (verify-page branding; never throws).
  - `getAdminProfile()` — throws 404 before first save.
  - `upsertProfile(input)` — upsert on `slug: 'default'`.
  - `buildShareSvg(result: VerificationResult, programName: string, academyName: string | null): string` — pure.
  - `renderShareImage(token: string): Promise<Buffer>` — verifyToken FIRST (404 on null), then 24h disk cache under `uploads/share/<token>.png`.

- [ ] **Step 1: Extend `lib/storage.ts`** — add to `LocalStorageAdapter`:

```ts
async saveBuffer(buf: Buffer, key: string): Promise<string> {
  await this.ensureDir();
  const destPath = this.resolveKey(key);
  await fs.writeFile(destPath, buf);
  return destPath;
}
```

and at the bottom:

```ts
export const shareImageStorage = new LocalStorageAdapter(path.join(process.cwd(), 'uploads', 'share'));
```

- [ ] **Step 2: Write the failing unit test** — `src/services/__tests__/share-image.service.test.ts`

```ts
import { buildShareSvg } from '../share-image.service';
import type { VerificationResult } from '../verification.service';

const cert: VerificationResult = {
  type: 'CERTIFICATE',
  studentName: 'Amina Yusuf',
  programName: 'Quran Review',
  issuedAt: new Date('2026-01-15'),
};

const ijazah: VerificationResult = {
  type: 'IJAZAH',
  studentName: 'Amina Yusuf',
  teacherName: 'Shaykh Ahmad',
  programName: 'Quran Review',
  scope: 'JUZ',
  surahNameEn: null,
  surahNameAr: null,
  juzNumber: 30,
  issuedAt: new Date('2026-01-15'),
};

describe('buildShareSvg', () => {
  it('is a 1200×630 SVG containing achievement, student, and program name', () => {
    const svg = buildShareSvg(cert, 'Quran Review', null);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('Amina Yusuf');
    expect(svg).toContain('Certificate of Completion');
    expect(svg).toContain('QURAN REVIEW');
  });

  it('includes the endorsing teacher, scope, and academy for an ijazah', () => {
    const svg = buildShareSvg(ijazah, 'Quran Review', 'Dar Al-Huda');
    expect(svg).toContain('Shaykh Ahmad');
    expect(svg).toContain('Juz 30');
    expect(svg).toContain('DAR AL-HUDA');
  });

  it('escapes XML-hostile characters in names (no injection surface)', () => {
    const svg = buildShareSvg({ ...cert, studentName: 'A<b>&"x"' }, 'P&Q', null);
    expect(svg).not.toContain('A<b>');
    expect(svg).toContain('A&lt;b&gt;&amp;&quot;x&quot;');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd packages/server && npm test -- --testPathPattern=share-image
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `share-image.service.ts`**

```ts
import fs from 'fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { AppError } from '../middleware/error.middleware';
import { shareImageStorage } from '../lib/storage';
import { verifyToken, VerificationResult } from './verification.service';
import { getActiveDefaultProfile } from './academy-profile.service';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function achievementLabel(r: VerificationResult): { title: string; subtitle: string } {
  if (r.type === 'CERTIFICATE') {
    return { title: 'Certificate of Completion', subtitle: 'The full Quran, memorized cover to cover' };
  }
  const scope =
    r.scope === 'FULL_QURAN'
      ? 'the full Quran'
      : r.scope === 'JUZ'
        ? `Juz ${r.juzNumber}`
        : (r.surahNameEn ?? 'a surah');
  return { title: 'Ijazah', subtitle: `Formally endorsed completion of ${scope}` };
}

/**
 * Pure 1200×630 SVG. Flat colors keep the rendered PNG far below the 200KB
 * budget. Only verify-page facts appear (AC8.4): achievement, student name,
 * endorsing teacher, dates, program/academy name.
 */
export function buildShareSvg(result: VerificationResult, programName: string, academyName: string | null): string {
  const { title, subtitle } = achievementLabel(result);
  const issued = result.issuedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const teacherLine = result.type === 'IJAZAH' ? `Endorsed by ${result.teacherName}` : '';
  const footer = academyName ? `${academyName} · ${programName}` : programName;
  const F = `font-family="Cairo, 'Noto Sans Arabic', sans-serif"`;
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#1B5E20"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="#FFFFFF"/>
  <rect x="40" y="40" width="1120" height="10" rx="5" fill="#FFC107"/>
  <text x="600" y="150" text-anchor="middle" ${F} font-size="28" letter-spacing="4" fill="#757575">${esc(footer.toUpperCase())}</text>
  <text x="600" y="250" text-anchor="middle" ${F} font-size="56" font-weight="bold" fill="#212121">${esc(title)}</text>
  <text x="600" y="310" text-anchor="middle" ${F} font-size="30" fill="#757575">${esc(subtitle)}</text>
  <text x="600" y="410" text-anchor="middle" ${F} font-size="44" font-weight="bold" fill="#1B5E20">${esc(result.studentName)}</text>
  ${teacherLine ? `<text x="600" y="465" text-anchor="middle" ${F} font-size="28" fill="#757575">${esc(teacherLine)}</text>` : ''}
  <text x="600" y="540" text-anchor="middle" ${F} font-size="24" fill="#9E9E9E">Issued ${esc(issued)} · Verified by ${esc(programName)}</text>
</svg>`;
}

/**
 * Token validity is checked BEFORE any cache read: a revoked/rotated token
 * 404s immediately (AC8.3). The disk cache only saves render cost.
 */
export async function renderShareImage(token: string): Promise<Buffer> {
  const result = await verifyToken(token);
  if (!result) throw new AppError(404, 'Not found');

  const key = `${token}.png`;
  if (await shareImageStorage.exists(key)) {
    const p = shareImageStorage.getLocalPath(key);
    const stat = await fs.stat(p);
    if (Date.now() - stat.mtimeMs < CACHE_TTL_MS) return fs.readFile(p);
  }

  const profile = await getActiveDefaultProfile();
  const svg = buildShareSvg(result, profile?.programName ?? result.programName, profile?.displayName ?? null);
  const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
  const buf = Buffer.from(png);

  // Best-effort cache write; failure must not break the response.
  try {
    await shareImageStorage.saveBuffer(buf, key);
  } catch {
    /* ignore */
  }
  return buf;
}
```

- [ ] **Step 5: Implement `academy-profile.service.ts`**

```ts
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import type { ZodUpsertAcademyProfileInput } from '@quran-review/shared';

export const DEFAULT_SLUG = 'default';

export const getPublicProfile = async (slug: string) => {
  const profile = await prisma.academyProfile.findUnique({ where: { slug } });
  if (!profile || !profile.active) throw new AppError(404, 'Academy not found');
  const { id: _id, active: _active, createdAt: _c, ...pub } = profile;
  return pub;
};

/** Branding lookup for verify page + share image — null (never throws) when unset/inactive. */
export const getActiveDefaultProfile = async () => {
  const profile = await prisma.academyProfile.findUnique({ where: { slug: DEFAULT_SLUG } });
  return profile?.active ? profile : null;
};

export const getAdminProfile = async () => {
  const profile = await prisma.academyProfile.findUnique({ where: { slug: DEFAULT_SLUG } });
  if (!profile) throw new AppError(404, 'Academy profile not set up yet');
  return profile;
};

export const upsertProfile = (input: ZodUpsertAcademyProfileInput) => {
  const data = {
    displayName: input.displayName,
    programName: input.programName,
    publicBio: input.publicBio ?? null,
    logoUrl: input.logoUrl ?? null,
    contactEmail: input.contactEmail ?? null,
    active: input.active ?? true,
  };
  return prisma.academyProfile.upsert({
    where: { slug: DEFAULT_SLUG },
    create: { slug: DEFAULT_SLUG, ...data },
    update: data,
  });
};
```

- [ ] **Step 6: Run the unit test to verify it passes**

```bash
cd packages/server && npm test -- --testPathPattern=share-image
```

Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/services packages/server/src/lib/storage.ts
git commit -m "feat(f8): academy-profile + share-image services (SVG→PNG via resvg)"
```

---

### Task 4: Public module + mount + manifest + integration tests

**Files:**
- Create: `packages/server/src/modules/public/public.module.ts`
- Modify: `packages/server/src/app.ts` (import + mount)
- Modify: `packages/server/src/__integration__/endpoint-manifest.ts` (2 public entries)
- Create: `packages/server/src/__integration__/public-surface.itest.ts`

**Interfaces:**
- Consumes: `publicContracts` from shared; `getPublicProfile`, `renderShareImage` from Task 3.
- Produces: `publicRouter` mounted at `/api/v1/public` with `standardLimiter` (no authenticate — contracts are `access: 'public'`).

- [ ] **Step 1: Write the failing itest** — `public-surface.itest.ts`

```ts
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const profileData = {
  slug: 'default',
  displayName: 'Dar Al-Huda',
  programName: 'Hifz Program',
  publicBio: 'A Quran memorization academy',
  active: true,
};

describe('GET /api/v1/public/academy/:slug', () => {
  it('returns the active profile without auth (AC8.5)', async () => {
    await prisma.academyProfile.create({ data: profileData });
    const res = await request(app).get('/api/v1/public/academy/default');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ slug: 'default', displayName: 'Dar Al-Huda', programName: 'Hifz Program' });
    expect(res.body.id).toBeUndefined();
    expect(res.body.active).toBeUndefined();
  });

  it('404s an inactive profile', async () => {
    await prisma.academyProfile.create({ data: { ...profileData, active: false } });
    const res = await request(app).get('/api/v1/public/academy/default');
    expect(res.status).toBe(404);
  });

  it('404s an unknown slug', async () => {
    const res = await request(app).get('/api/v1/public/academy/nope');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/public/verify/:token/share.png', () => {
  const pngParse = (r: any, cb: any) => {
    const chunks: Buffer[] = [];
    r.on('data', (c: Buffer) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  };

  it('returns a 1200×630 PNG ≤ 200KB for a valid certificate token (AC8.2)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    await prisma.user.update({ where: { id: student.id }, data: { firstName: 'Amina' } });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });

    const res = await request(app)
      .get(`/api/v1/public/verify/${cert.verificationToken}/share.png`)
      .buffer(true)
      .parse(pngParse);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    const buf = res.body as Buffer;
    // PNG signature + IHDR dimensions
    expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
    expect(buf.length).toBeLessThanOrEqual(200 * 1024);
  });

  it('404s an unknown token', async () => {
    const res = await request(app).get('/api/v1/public/verify/does-not-exist/share.png');
    expect(res.status).toBe(404);
  });

  it('404s immediately after the link is regenerated, even if the image was cached (AC8.3)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });
    const oldToken = cert.verificationToken;

    const warm = await request(app).get(`/api/v1/public/verify/${oldToken}/share.png`);
    expect(warm.status).toBe(200);

    const regen = await request(app)
      .patch(`/api/v1/certificates/${cert.id}/regenerate-link`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(regen.status).toBe(200);

    const stale = await request(app).get(`/api/v1/public/verify/${oldToken}/share.png`);
    expect(stale.status).toBe(404);
  });

  it('404s a revoked (active=false) token even with a warm cache', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });
    await request(app).get(`/api/v1/public/verify/${cert.verificationToken}/share.png`);
    await prisma.certificate.update({ where: { id: cert.id }, data: { active: false } });

    const res = await request(app).get(`/api/v1/public/verify/${cert.verificationToken}/share.png`);
    expect(res.status).toBe(404);
  });

  it('renders the ijazah variant (teacher in pipeline, no student email — AC8.4)', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const ijazah = await prisma.ijazah.create({
      data: { studentId: student.id, teacherId: teacher.id, scope: 'FULL_QURAN' },
    });
    const res = await request(app).get(`/api/v1/public/verify/${ijazah.verificationToken}/share.png`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });
});
```

- [ ] **Step 2: Run to verify it fails** (use the repo's actual integration script name from `packages/server/package.json`)

```bash
cd packages/server && npm run test:integration -- --testPathPattern=public-surface
```

Expected: FAIL — 404s from the app-level catch-all (module not mounted).

- [ ] **Step 3: Implement `public.module.ts`**

```ts
import { publicContracts } from '@quran-review/shared';
import { getPublicProfile } from '../../services/academy-profile.service';
import { renderShareImage } from '../../services/share-image.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const getAcademyProfile = defineRoute(publicContracts.getAcademyProfile, async ({ params }) => {
  const profile = await getPublicProfile(String(params.slug));
  return { status: 200 as const, body: profile };
});

const getShareImage = defineRoute(publicContracts.getShareImage, async ({ params, res }) => {
  const png = await renderShareImage(String(params.token));
  res.setHeader('Content-Type', 'image/png');
  // Public but short-lived: revocation must propagate fast (AC8.3).
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(png);
  return { status: 200 as const, handled: true as const };
});

export const publicRouter = buildContractRouter([getAcademyProfile, getShareImage], {
  mountPrefix: '/api/v1/public',
});
```

- [ ] **Step 4: Mount in `app.ts`** (next to the verify mount — public, rate-limited, no authenticate)

```ts
import { publicRouter } from './modules/public/public.module';
// ...
app.use('/api/v1/public', standardLimiter, publicRouter);
```

- [ ] **Step 5: Add manifest entries** in `endpoint-manifest.ts` (near the verify entry)

```ts
  // public surface (F8) — landing profile + share image, contract-routed
  { method: 'GET', path: '/api/v1/public/academy/:slug', access: 'public' },
  { method: 'GET', path: '/api/v1/public/verify/:token/share.png', access: 'public' },
```

- [ ] **Step 6: Run the new itest + completeness + authz matrix**

```bash
cd packages/server && npm run test:integration -- --testPathPattern="public-surface|completeness|authz-matrix"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/modules/public packages/server/src/app.ts packages/server/src/__integration__
git commit -m "feat(f8): public module — academy landing + share.png (cache-after-validate)"
```

---

### Task 5: Admin academy-profile endpoints

**Files:**
- Modify: `packages/server/src/modules/admin/admin.module.ts` (2 routes + audit log)
- Modify: `packages/server/src/__integration__/endpoint-manifest.ts` (2 ADMIN entries)
- Modify: `packages/server/src/__integration__/public-surface.itest.ts` (admin section appended)

**Interfaces:**
- Consumes: `adminContracts.getAcademyProfile` / `upsertAcademyProfile` (Task 2); `getAdminProfile`, `upsertProfile` (Task 3); existing `auditLog` from `lib/audit.ts`.

- [ ] **Step 1: Write the failing itest** (append to `public-surface.itest.ts`)

```ts
describe('admin academy-profile endpoints', () => {
  it('PUT creates then GET returns it; public reflects the change (AC3.1)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const put = await request(app)
      .put('/api/v1/admin/academy-profile')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ displayName: 'Dar Al-Huda', programName: 'Hifz Program', active: true });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ slug: 'default', displayName: 'Dar Al-Huda', active: true });

    const get = await request(app)
      .get('/api/v1/admin/academy-profile')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(get.status).toBe(200);

    const pub = await request(app).get('/api/v1/public/academy/default');
    expect(pub.status).toBe(200);
    expect(pub.body.displayName).toBe('Dar Al-Huda');
  });

  it('GET 404s before first save', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .get('/api/v1/admin/academy-profile')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it('rejects invalid body with 400', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .put('/api/v1/admin/academy-profile')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ displayName: '', programName: 'x' });
    expect(res.status).toBe(400);
  });
});
```

(Role rejection for non-admins is covered by the authz matrix automatically once the manifest entries land.)

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/server && npm run test:integration -- --testPathPattern=public-surface
```

Expected: FAIL (route not found).

- [ ] **Step 3: Add routes to `admin.module.ts`**

```ts
import * as academyProfileService from '../../services/academy-profile.service';

const getAcademyProfile = defineRoute(adminContracts.getAcademyProfile, async () => {
  const profile = await academyProfileService.getAdminProfile();
  return { status: 200 as const, body: profile };
});

const upsertAcademyProfile = defineRoute(adminContracts.upsertAcademyProfile, async ({ body, userId, req }) => {
  const profile = await academyProfileService.upsertProfile(body);
  await auditLog({
    userId: userId!,
    action: 'UPSERT_ACADEMY_PROFILE',
    resourceType: 'ACADEMY_PROFILE',
    resourceId: profile.id,
    details: body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return { status: 200 as const, body: profile };
});
```

Add both to the `buildContractRouter([...])` array.

- [ ] **Step 4: Add manifest entries**

```ts
  { method: 'GET', path: '/api/v1/admin/academy-profile', access: ['ADMIN'] },
  { method: 'PUT', path: '/api/v1/admin/academy-profile', access: ['ADMIN'] },
```

- [ ] **Step 5: Run itests (new + matrix + completeness)**

```bash
cd packages/server && npm run test:integration -- --testPathPattern="public-surface|completeness|authz-matrix"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/modules/admin packages/server/src/__integration__
git commit -m "feat(f8): admin academy-profile get/upsert with audit log"
```

---

### Task 6: Branded verify page + og:image

**Files:**
- Modify: `packages/server/src/routes/verify.routes.ts`
- Modify: `packages/server/src/__integration__/verification.itest.ts` (extend, don't replace)

**Interfaces:**
- Consumes: `getActiveDefaultProfile()` (Task 3).
- Produces: verify HTML shows academy `displayName`/`programName` when an active profile exists, and carries `og:image` → the share PNG + `og:title`/`og:description` so WhatsApp link previews render the image (AC8.1).

- [ ] **Step 1: Write the failing itest** (append to `verification.itest.ts`)

```ts
describe('verify page academy branding (F8)', () => {
  it('shows academy branding and og:image when an active profile exists', async () => {
    await prisma.academyProfile.create({
      data: { slug: 'default', displayName: 'Dar Al-Huda', programName: 'Hifz Program', active: true },
    });
    const student = await createUser({ role: Role.STUDENT });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });

    const res = await request(app).get(`/api/v1/verify/${cert.verificationToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Dar Al-Huda');
    expect(res.text).toContain('property="og:image"');
    expect(res.text).toContain(`/api/v1/public/verify/${cert.verificationToken}/share.png`);
  });

  it('falls back to the default program name with no active profile', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const cert = await prisma.certificate.create({ data: { studentId: student.id, pdfUrl: '/x.pdf' } });
    const res = await request(app).get(`/api/v1/verify/${cert.verificationToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Quran Review');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/server && npm run test:integration -- --testPathPattern=verification
```

Expected: the two new tests FAIL, existing ones PASS.

- [ ] **Step 3: Extend `verify.routes.ts`**

Change `page()` to accept optional meta:

```ts
interface PageMeta {
  ogImagePath?: string; // host-relative absolute path
  ogTitle?: string;
  ogDescription?: string;
}

function page(title: string, body: string, meta: PageMeta = {}): string {
  const og = [
    meta.ogTitle ? `<meta property="og:title" content="${escapeHtml(meta.ogTitle)}" />` : '',
    meta.ogDescription ? `<meta property="og:description" content="${escapeHtml(meta.ogDescription)}" />` : '',
    meta.ogImagePath ? `<meta property="og:image" content="${escapeHtml(meta.ogImagePath)}" />` : '',
    meta.ogImagePath
      ? `<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  // insert `${og}` in <head> right after the <title> line; rest of the template unchanged
}
```

In the handler:

```ts
import { getActiveDefaultProfile } from '../services/academy-profile.service';
// inside router.get('/:token', ...) before rendering:
const profile = await getActiveDefaultProfile();
const programName = profile?.programName ?? PROGRAM_NAME;
const academyName = profile?.displayName ?? null;
const brandLine = academyName ? `${academyName} — ${programName}` : programName;
const sharePath = `/api/v1/public/verify/${encodeURIComponent(req.params.token)}/share.png`;
```

- Replace `PROGRAM_NAME` / `result.programName` in the two success branches' HTML with `brandLine` (program `<p>`) and `programName` (footer "Verified by").
- Pass `{ ogImagePath: sharePath, ogTitle: 'Certificate of Completion' /* or 'Ijazah' */, ogDescription: `Verified by ${programName}` }` to `page()` for success branches only (not the 404).

- [ ] **Step 4: Run to verify all verification tests pass**

```bash
cd packages/server && npm run test:integration -- --testPathPattern=verification
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/verify.routes.ts packages/server/src/__integration__/verification.itest.ts
git commit -m "feat(f8): branded verify page + og:image share preview"
```

---

### Task 7: Mobile — public academy screen, admin editor, WhatsApp-first share

**Files:**
- Create: `mobile/src/api/public.ts`
- Create: `mobile/src/api/academyProfile.ts`
- Create: `mobile/src/hooks/useAcademyProfile.ts`
- Create: `mobile/app/(public)/academy/[slug].tsx`
- Create: `mobile/app/admin/academy-profile.tsx`
- Modify: `mobile/app/_layout.tsx` (register both screens)
- Modify: `mobile/app/admin/home.tsx` (link to the editor — mirror how Broadcast/Milestones are linked)
- Modify: `mobile/app/student/certificates.tsx` + `mobile/app/student/ijazahs.tsx` (WhatsApp-first share)
- Modify: `mobile/src/i18n/index.ts` (new keys, ar + en)
- Modify: `mobile/app.json` (iOS `LSApplicationQueriesSchemes: ["whatsapp"]`)

**Interfaces:**
- Consumes: `contractClient`, `expectStatus` from `mobile/src/api/contract.ts` — **copy the exact `contractClient` call signature from `mobile/src/api/certificates.ts`, do not assume it**; `publicContracts`, `adminContracts` from shared.
- Produces: `publicApi.getAcademyProfile(slug)`; `academyProfileApi.get()` / `.upsert(input)`; `useAcademyProfile()` hook.

- [ ] **Step 1: `mobile/src/api/public.ts`**

```ts
import { publicContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export const publicApi = {
  async getAcademyProfile(slug: string) {
    const res = await contractClient.call(publicContracts.getAcademyProfile, { params: { slug } });
    return expectStatus(res, 200).body;
  },
};
```

- [ ] **Step 2: `mobile/src/api/academyProfile.ts`**

```ts
import { adminContracts, ZodUpsertAcademyProfileInput } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export const academyProfileApi = {
  async get() {
    const res = await contractClient.call(adminContracts.getAcademyProfile, {});
    if (res.status === 404) return null;
    return expectStatus(res, 200).body;
  },
  async upsert(input: ZodUpsertAcademyProfileInput) {
    const res = await contractClient.call(adminContracts.upsertAcademyProfile, { body: input });
    return expectStatus(res, 200).body;
  },
};
```

- [ ] **Step 3: `mobile/src/hooks/useAcademyProfile.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { academyProfileApi } from '../api/academyProfile';
import type { ZodUpsertAcademyProfileInput } from '@quran-review/shared';

export function useAcademyProfile() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['academy-profile'], queryFn: academyProfileApi.get });
  const save = useMutation({
    mutationFn: (input: ZodUpsertAcademyProfileInput) => academyProfileApi.upsert(input),
    onSuccess: (data) => qc.setQueryData(['academy-profile'], data),
  });
  return { profile: query.data ?? null, isLoading: query.isLoading, error: query.error, save };
}
```

- [ ] **Step 4: Admin editor screen `mobile/app/admin/academy-profile.tsx`** — form fields displayName, programName, publicBio (multiline), contactEmail, active (Switch). Copy header/card/input styling from `admin/broadcast.tsx`; `AppCard`/`AppText`/`useTheme()`; save via `save.mutate` with `Alert.alert(t('saved'))` on success and `Alert.alert(t('error'))` on failure; loading → `ActivityIndicator`; all labels via `t()`; a11y labels + `hitSlop` per repo convention.

- [ ] **Step 5: Public screen `mobile/app/(public)/academy/[slug].tsx`**

```tsx
import React from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/src/api/public';
import { AppCard, AppText, EmptyState } from '@/src/components/design';
import { useTheme } from '@/src/hooks/useTheme';
import { SPACING } from '@/constants/theme';

export default function PublicAcademyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-academy', slug],
    queryFn: () => publicApi.getAcademyProfile(String(slug)),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl }} color={COLORS.primary} />
      ) : error || !data ? (
        <EmptyState icon="school-outline" title={t('academyNotFound')} description="" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          <AppCard>
            <AppText variant="headlineMedium">{data.displayName}</AppText>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>{data.programName}</AppText>
            {data.publicBio ? (
              <AppText variant="bodyMedium" style={{ marginTop: SPACING.md }}>{data.publicBio}</AppText>
            ) : null}
            {data.contactEmail ? (
              <AppText variant="bodySmall" color={COLORS.textSecondary} style={{ marginTop: SPACING.md }}>
                {data.contactEmail}
              </AppText>
            ) : null}
          </AppCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

(Adapt `AppText` variant/color prop names to the actual design-system API in `mobile/src/components/design.tsx` — check before writing.)

- [ ] **Step 6: Register screens in `_layout.tsx`** — `protectedRoots` does NOT include `(public)`, so the group is public by construction (AC8.5):

```tsx
<Stack.Screen name="(public)/academy/[slug]" />
<Stack.Screen name="admin/academy-profile" />
```

- [ ] **Step 7: WhatsApp-first share (AC8.1)** — in both `student/certificates.tsx` and `student/ijazahs.tsx`, replace the `handleShare` body (keep the existing "never share the token'd PDF URL" comment):

```ts
const handleShare = async (verificationToken: string) => {
  const url = getVerifyUrl(verificationToken);
  const message = t('shareAchievementMessage', { url });
  const wa = `whatsapp://send?text=${encodeURIComponent(message)}`;
  try {
    if (await Linking.canOpenURL(wa)) {
      await Linking.openURL(wa);
      return;
    }
  } catch {
    /* fall through to the generic sheet */
  }
  try {
    await Share.share({ message });
  } catch {
    Linking.openURL(url);
  }
};
```

- [ ] **Step 8: iOS query scheme** — in `mobile/app.json` under `expo.ios.infoPlist` (merge with existing keys):

```json
"LSApplicationQueriesSchemes": ["whatsapp"]
```

Note: querying `whatsapp://` needs a native rebuild to take effect (`npx expo run:ios`); until then `canOpenURL` returns false and the code falls back to the system share sheet — acceptable.

- [ ] **Step 9: i18n keys (both `ar` and `en`)** in `mobile/src/i18n/index.ts` (skip any key that already exists — check `saved`/`error` first):

| key | ar | en |
|---|---|---|
| `shareAchievementMessage` | `الحمد لله! تم توثيق هذا الإنجاز في حفظ القرآن الكريم — شاهد الشهادة: {{url}}` | `Alhamdulillah! This Quran memorization achievement is verified — view the certificate: {{url}}` |
| `academyProfile` | `ملف الأكاديمية` | `Academy Profile` |
| `academyNotFound` | `الأكاديمية غير موجودة` | `Academy not found` |
| `academyDisplayName` | `اسم الأكاديمية` | `Academy name` |
| `academyProgramName` | `اسم البرنامج` | `Program name` |
| `academyPublicBio` | `نبذة عامة` | `Public bio` |
| `academyContactEmail` | `البريد الإلكتروني للتواصل` | `Contact email` |
| `academyActive` | `الصفحة العامة مفعّلة` | `Public page active` |
| `saved` | `تم الحفظ` | `Saved` |

- [ ] **Step 10: Gates**

```bash
cd mobile && npx tsc --noEmit && npm run check-i18n
```

Expected: 0 errors, i18n OK.

- [ ] **Step 11: Simulator demo (integrated panel)** — with backend + Metro running and the app installed in the simulator:
  1. Log in as `admin@quran-review.com` / `Admin1234!` → Academy Profile → fill + save.
  2. Deep link `quran-review://academy/default` → public screen renders.
  3. Log in as `ali@quran-review.com` → certificates → share → WhatsApp-first flow (falls back to share sheet in sim).
  4. Safari in sim: `http://localhost:4000/api/v1/verify/<token>` shows branding; `.../api/v1/public/verify/<token>/share.png` shows the image.

- [ ] **Step 12: Commit**

```bash
git add mobile
git commit -m "feat(f8): public academy screen, admin profile editor, WhatsApp-first share"
```

---

### Task 8: Full gates, security review, close-out

**Files:**
- Modify: `tasks/todo.md` (H3/F8 entry with AC proof map)

- [ ] **Step 1: Full server regression**

```bash
cd packages/server && npm test && npm run test:integration
```

Expected: all suites green (unit ≥ 308, integration ≥ 910 + new).

- [ ] **Step 2: Typecheck everything**

```bash
cd packages/server && npx tsc --noEmit && cd ../shared && npx tsc --noEmit && cd ../../mobile && npx tsc --noEmit && npm run check-i18n
```

Expected: 0 errors everywhere.

- [ ] **Step 3: Security review** (required by spec for the public surface) — dispatch the `security-reviewer` agent over the diff (public module, share-image service, verify page changes, admin endpoints). Address any High findings before merge.

- [ ] **Step 4: Update `tasks/todo.md`** — add the F8 entry under a new "## H3" heading with the AC proof map (AC8.1–8.5, AC3.1/3.6/3.7 → test names), noting the resvg-instead-of-puppeteer deviation.

- [ ] **Step 5: Merge** (confirm with the user first, per repo convention)

```bash
git checkout main && git merge --no-ff feat/public-share-image -m "Merge feat/public-share-image: F8 public landing + certificate share image"
```

---

## Self-Review Notes

- **AC8.1** → Task 7 Step 7 (WhatsApp deep link first + tuned copy) + Task 6 (branded verify + og:image so the shared link previews the PNG in WhatsApp).
- **AC8.2** → Task 4 itest asserts PNG signature, 1200×630 IHDR, ≤ 200KB, `image/png`.
- **AC8.3** → `renderShareImage` validates the token before touching the cache; Task 4 has both the regenerate-rotation and `active=false` warm-cache tests.
- **AC8.4** → SVG builder only receives `VerificationResult` fields (already public) + academy fields; XML-escape unit test.
- **AC8.5** → public profile itest with no auth header; `(public)` route group is outside `protectedRoots`.
- **AC3.1/3.6** → Task 5 admin endpoints + itests; role rejections via the authz matrix.
- **Deviation (documented):** `@resvg/resvg-js` instead of `puppeteer-core` — no Chromium dependency; the spec's own risk table flagged Chromium availability. Arabic shaping handled by resvg's rustybuzz with system fonts (`loadSystemFonts: true`). If Arabic student names render poorly, bundle a static Arabic font via `font.fontFiles` — polish follow-up, not a blocker.
- **Type consistency:** `getVerifyUrl` exists on `useCertificates` (verified); verify the ijazahs hook exposes the same before editing. `contractClient.call` signature must be copied from `mobile/src/api/certificates.ts`, not assumed.
