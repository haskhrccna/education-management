# M9 Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (session precedent: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the typed contract client into the mobile API layer (with a working pilot domain), retire the per-screen `getColors` theming pattern in favor of `useTheme()`, and close the 63-key i18n gap with a permanent guard script.

**Architecture:** Three independent foundation strands, each mechanical and tsc-gated. (1) A fetch-based `contractClient` configured for React Native (secure-storage token injection + single-flight 401 refresh in a custom `fetchImpl`) with `gamification` migrated as the pilot — full adoption happens cluster-by-cluster in M10–M12. (2) A sweep of the 46 files still deriving palettes via `getColors(theme, darkMode)` onto the memoized `useTheme()` hook built in the earlier interceptor refactor. (3) All 63 t()-keys missing from BOTH languages get real ar+en strings, and a `check-i18n` script makes the gap class un-reintroducible.

**Tech Stack:** Expo SDK 54 · React Native · `@quran-review/shared` (workspace symlink; already imported type-only by mushaf files — Metro resolves hoisted workspace packages) · TanStack Query 5 (persister/offline already consolidated by roadmap 4.3: netinfo-backed `onlineManager`, mutation persistence, `OfflineBanner` — M9 verifies, does not rebuild).

## Context

Spec §5: M9 = "Mobile foundation — generated client, TanStack persister/offline, theming/i18n cleanup". Spec §6 fences M10–M12's UX rethink into "per-cluster mini-brainstorms with the user, not open-ended" — so M9 deliberately contains only objective foundation work; the cluster milestones will do typed-client adoption + design-system conformance mechanically and surface UX decisions to the user.

Measured debt (2026-07-10): 46 files call `getColors` directly; 63 translation keys are used by screens but missing from BOTH `ar` and `en` (notifications, halaqa, certificates, parent, and analytics screens render raw camelCase — Arabic-first users see untranslated English-ish tokens, violating PRODUCT.md's register).

## Global Constraints

- Gate: `cd mobile && npx tsc --noEmit` → **0 errors** after every task. Server suites untouched.
- i18n rule (CLAUDE.md): every key exists in BOTH `ar` and `en`. Arabic is the primary register (PRODUCT.md) — no transliterated English filler.
- Design tokens only — no new hex colors; `useTheme().colors` is the single palette source for screens.
- Public API of every `src/api/*` module and every hook stays identical — screens must not need changes in M9.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; never pair `git commit` with `-n`-bearing commands. Branch `feat/rebuild-m9` off `main`.

## File Structure

**Create**
- `mobile/src/api/contract.ts` — configured `contractClient` + RN auth `fetchImpl`
- `mobile/scripts/check-i18n.js` — fails when a used key is missing from ar or en

**Modify**
- `mobile/src/api/gamification.ts` — pilot migration to `contractClient` (exported signatures unchanged)
- ~46 screen/component files — `getColors(theme, darkMode)` → `useTheme()`
- `mobile/src/i18n/index.ts` — +63 keys in each language
- `mobile/package.json` — `"check-i18n": "node scripts/check-i18n.js"` script
- `tasks/todo.md`

---

### Task 0: Branch + plan doc

- [ ] `git checkout -b feat/rebuild-m9`; commit this plan: `docs(m9): mobile foundation implementation plan`

### Task 1: Typed contract client + gamification pilot

**Files:** Create `mobile/src/api/contract.ts`; modify `mobile/src/api/gamification.ts`
**Interfaces:** Consumes `createContractClient`, `progressContracts` from `@quran-review/shared`; `secureStorage` from `../storage/secureStorage`. Produces `contractClient` (a `createContractClient` instance whose `call(contract, args)` returns `{status, body}`) and `expectStatus(res, status)` for M10–M12 adoption.

- [ ] **Step 1: contract.ts**

```ts
import { Platform } from 'react-native';
import { createContractClient } from '@quran-review/shared';
import { secureStorage } from '../storage/secureStorage';

/**
 * Contract paths are full canonical ('/api/v1/...'), so the client needs the
 * ORIGIN only — strip the /api/v1 suffix the axios base includes.
 */
function getOrigin(): string {
  const base =
    process.env.EXPO_PUBLIC_API_URL ??
    (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api/v1' : 'http://localhost:4000/api/v1');
  return base.replace(/\/api\/v1\/?$/, '');
}

const ORIGIN = getOrigin();

// Single-flight refresh shared across concurrent 401s (mirrors the axios
// installAuthRefreshInterceptor; logout redirect stays with the axios path
// until the auth store adopts the contract client in M10–M12).
let refreshPromise: Promise<string | null> | null = null;

async function refreshAuthToken(): Promise<string | null> {
  try {
    const refreshToken = await secureStorage.getItem('refresh_token');
    if (!refreshToken) return null;
    const res = await fetch(`${ORIGIN}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token: string; refreshToken: string };
    await secureStorage.setItem('auth_token', data.token);
    await secureStorage.setItem('refresh_token', data.refreshToken);
    return data.token;
  } catch {
    return null;
  }
}

/** fetch with bearer injection + one 401 retry after a shared refresh. */
const authFetch: typeof fetch = async (input, init) => {
  const token = await secureStorage.getItem('auth_token');
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const doFetch = () => fetch(input, { ...init, headers });

  let res = await doFetch();
  if (res.status === 401 && !String(input).includes('/api/v1/auth/')) {
    if (!refreshPromise) {
      refreshPromise = refreshAuthToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await doFetch();
    }
  }
  return res;
};

export const contractClient = createContractClient({ baseUrl: ORIGIN, fetchImpl: authFetch });

/** Uniform error surface: throw the server's `error` string like the axios path does. */
export function expectStatus<T extends { status: number; body: unknown }>(res: T, status: number): T {
  if (res.status !== status) {
    const message =
      typeof res.body === 'object' && res.body !== null && 'error' in res.body
        ? String((res.body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res;
}
```

- [ ] **Step 2: pilot — gamification.ts.** Keep the exported interfaces (`Streak`, `BadgeAward`, `MyGamification`, `LeaderboardEntry`) and `gamificationApi` shape untouched; only the transport changes:

```ts
import { progressContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';
// (interfaces unchanged)

export const gamificationApi = {
  getMine: async (): Promise<MyGamification> => {
    const res = expectStatus(await contractClient.call(progressContracts.gamificationMe), 200);
    return (res.body as { data: MyGamification }).data;
  },
  getLeaderboard: async (scope?: string, limit = 20): Promise<LeaderboardEntry[]> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.leaderboard, { query: { scope, limit } }),
      200
    );
    return (res.body as { data: LeaderboardEntry[] }).data;
  },
};
```

- [ ] **Step 3:** `cd mobile && npx tsc --noEmit` → 0 errors.
- [ ] **Step 4: Commit** `feat(m9): typed contract client for mobile + gamification pilot`

### Task 2: Theming sweep — getColors → useTheme (46 files)

**Files:** Every file matched by `grep -rl "getColors" mobile/app mobile/src --include='*.tsx' --include='*.ts'` EXCEPT `mobile/constants/theme.ts` (definition) and `mobile/src/hooks/useTheme.ts` (the wrapper).
**Interfaces:** Consumes `useTheme()` → `{ colors, isRTL, theme, darkMode }` (memoized).

- [ ] **Step 1:** The repeating pattern (apply per file; representative example `app/student/certificates.tsx`):

```diff
-import { getColors } from '@/constants/theme';
-import { useThemeSettings } from '@/src/settings/store';
+import { useTheme } from '@/src/hooks/useTheme';
 ...
-  const { theme, darkMode } = useThemeSettings();
-  const colors = getColors(theme, darkMode);
+  const { colors } = useTheme();
```

Variants to handle: files that also use `theme`/`darkMode`/`isRTL` elsewhere keep them via the same hook (`const { colors, isRTL } = useTheme()`); files that pass `colors` into a `createStyles(colors)` factory are unchanged beyond the derivation; import specifiers vary (`@/constants/theme` vs relative) — remove `getColors` from the import, keep other named imports (spacing, typography) if present.
- [ ] **Step 2:** After the sweep: `grep -rl "getColors" mobile/app mobile/src --include='*.tsx' --include='*.ts'` must list ONLY `mobile/src/hooks/useTheme.ts` (and nothing under app/). `getColors` stays exported from `constants/theme.ts`.
- [ ] **Step 3:** `cd mobile && npx tsc --noEmit` → 0 errors (catches dropped-but-still-used `theme`/`darkMode` locals).
- [ ] **Step 4: Commit** `refactor(m9): adopt useTheme() across all screens; retire per-screen getColors`

### Task 3: i18n completeness + guard

**Files:** Modify `mobile/src/i18n/index.ts`; create `mobile/scripts/check-i18n.js`; modify `mobile/package.json`
**Interfaces:** Produces `npm run check-i18n` (exit 1 listing missing keys).

- [ ] **Step 1:** Add these 63 keys to BOTH `arTranslations` and `enTranslations`, grouped under comment headers matching their screens (notifications, halaqa, certificates, parent, analytics, misc). Author real copy: Arabic first (natural register, matching existing entries — e.g. `notifications: 'الإشعارات'`, `markAllRead: 'تعليم الكل كمقروء'`), English secondary. Full key list:

```
absent, achievements, activeRate, analytics, certificate, certificateIssuedAt, certificates,
childAppointments, childAttendance, childEmail, childEmailPlaceholder, childGrades, childProgress,
childRevisions, connected, connecting, createRoom, downloadCertificate, endRoom,
failedToSubmitRequest, goBack, gradesLast30d, halaqa, halaqaRooms, leaveRoom, linkPending,
linkRequestInstructions, linkRequested, liveNow, markAllRead, muted, noCertificates,
noChildrenYet, noChildrenYetDesc, noData, noHalaqaRooms, noNotifications, noNotificationsDesc,
notFound, notifications, parentDashboard, participant, participants, present, readOnlyNote,
reasonPlaceholder, requestChildLink, requestReason, revision, roomTitlePlaceholder, searchStudent,
sessionsLast30d, shareCertificate, startRoom, studentNotFound, studentNotFoundDesc, surahMissRates,
surahsInProgress, teacher, teacherLoad, unsupportedRole, weeklyActiveStudents, you
```

- [ ] **Step 2: scripts/check-i18n.js** (the scanner used to measure the gap, made permanent):

```js
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
```

- [ ] **Step 3:** `package.json` scripts: `"check-i18n": "node scripts/check-i18n.js"`.
- [ ] **Step 4:** `cd mobile && npm run check-i18n` → OK; `npx tsc --noEmit` → 0.
- [ ] **Step 5: Commit** `feat(m9): close 63-key i18n gap (ar+en) + check-i18n guard`

### Task 4: Close out M9

- [ ] **Step 1:** Verify the offline stack is intact (no changes expected): `grep -c "onlineManager\|resumePausedMutations" mobile/app/_layout.tsx` ≥ 1 and `OfflineBanner` still mounted.
- [ ] **Step 2:** `tasks/todo.md`: mark M9 done (counts: mobile tsc 0, check-i18n OK, getColors call sites 46→0); next line: `[ ] M10 mobile student cluster — typed-client adoption + design-system conformance for the 10 student screens; per spec §6 the UX-rethink portion needs a user mini-brainstorm first. Next: superpowers:writing-plans for M10.`
- [ ] **Step 3: Commit** `docs(m9): mark M9 complete`; finishing-a-development-branch → merge to `main`, no push.

## Verification

- `cd mobile && npx tsc --noEmit` → 0 after each task (the only automated mobile gate).
- `npm run check-i18n` → OK and becomes the permanent regression guard.
- `grep -rl getColors mobile/app` → empty.
- Server untouched: `git diff --stat main -- packages/` empty at merge time.

## Self-review notes

- "Generated client" spec item: satisfied by wiring + pilot; wholesale transport swap of 27 API modules is deliberately spread across M10–M12 where each cluster's screens are already being touched — swapping a working app's transport in one shot without device testing would be reckless.
- "TanStack persister/offline" was completed by roadmap feature 4.3 (netinfo onlineManager, mutation persistence, OfflineBanner) — M9 verifies rather than duplicates (Task 4 Step 1).
- Residual risk: runtime (Metro) resolution of `@quran-review/shared` value imports is exercised for the first time by the pilot — tsc proves types; a device smoke test is the user's follow-up before release.
