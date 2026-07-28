# F10a Admin UX Rethink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the admin section into a true one-pager with grouped sub-screens, give admins a filterable audit-log viewer, and surface parent-link requests (invisible today) alongside teacher-change and student-account approvals.

**Architecture:** Server first — `adminContracts.auditLogs` gains `resourceType`/`dateFrom`/`dateTo` filters (additive; existing filters untouched). Then a typed mobile client + hook for audit logs, then the new audit-log screen. Then `change-requests.tsx` generalises into an Approvals screen fed by three sources with type-appropriate decision UI per row. Then `home.tsx` restructures into hero → unified approvals summary → metrics → Academy nav-card grid. A final visual pass fixes confirmed DESIGN.md violations.

**Tech Stack:** Express 5 + Zod contracts + Prisma (server); Expo SDK 54 / React Native / expo-router, TanStack Query, i18next (mobile); Jest + supertest (server integration tests).

## Global Constraints

- **Role case:** DB/JWT/`authorize()` use UPPERCASE (`ADMIN`); mobile auth store uses lowercase. Never compare roles with lowercase strings in server code.
- **Errors:** throw `new AppError(statusCode, message)` — never raw errors. The centralised `errorHandler` in `app.ts` handles all errors.
- **Pagination:** list endpoints use `paginate()` middleware and return `paginatedResponse(items, total, page, limit)`. Response envelope is exactly `{ data, meta }`.
- **Response unwrapping (mobile):** `GET /api/v1/admin/users` returns `{ data: User[], meta }`. `res.data` **is** that envelope, so rows are `res.data.data` — one level, not two. No axios interceptor unwraps responses (both are `(response) => response`).
- **i18n:** every new key must exist in **both** `arTranslations` and `enTranslations` in `mobile/src/i18n/index.ts`. Arabic is the primary language.
- **New user-facing strings must go through `t('key')`.** `mobile/scripts/check-i18n.js` ratchets inline `isAr ? 'ar' : 'en'` ternaries at `TERNARY_BASELINE = 260` and fails if the count rises. Adding an inline ternary breaks CI.
- **DESIGN.md — Rationed Gold:** gold marks earned achievement only. `MetricTile tone="gold"` is reserved for streaks/certificates. Operational counts use `primary`/`info`/`success`/`warning`.
- **DESIGN.md — Status-Is-Not-Only-Color:** status must pair colour with **an icon *or* a label**. `StatusPill` already renders a label, so it is compliant as-is — do **not** add icon work to it.
- **Tap targets:** ≥44pt, with `hitSlop` where the visual target is smaller.
- **Typography:** use `AppText` variants — no raw `<Text>` with hard-coded `fontSize`.

## Known-Correct Facts (verified against the running system — do not re-derive)

| Fact | Evidence |
|---|---|
| `parent.service.listLinks()` for ADMIN returns **all** links, no status filter | `packages/server/src/services/parent.service.ts:103-120` |
| ⇒ the Approvals screen must filter to `PENDING` **client-side** | follows from the above |
| `parentsApi.listLinks()` already exists mobile-side | `mobile/src/api/parents.ts` |
| `parentsApi` has **no** `decideLink` — must be added | same file; only `decideConsent` exists |
| `progressContracts.decideParentLink` is `PATCH /api/v1/parents/links/:id/decision`, ADMIN-only, body `{ action: 'APPROVE'\|'DENY', note?: string }`, manual validation | `packages/shared/src/contracts/progress.contracts.ts:119-132`, `packages/server/src/modules/parents/parents.module.ts` |
| **The contract router does NOT validate query params** — `query: req.query as never` | `packages/server/src/lib/contract-router.ts:73` |
| ⇒ bad `dateFrom` would reach `new Date()` → Invalid Date → Prisma 500. Must be guarded in the handler with `AppError(400, …)` | follows from the above |
| `goldMuted` and `warningLight` are the **same hex** (`#FFF8E1` light / `#33260A` dark) | `mobile/constants/theme.ts:96,114` and `:48,66` |
| ⇒ gold and warning tiles are visually indistinguishable | follows from the above |
| Only **one** confirmed Rationed-Gold violation on admin home: the *Teachers* tile is `tone="gold"`. *Pending* is `tone="warning"` and the teacher-change banner uses `COLORS.warning` — both legitimate | `mobile/app/admin/home.tsx:204,205,215` |
| i18next runs `compatibilityJSON: 'v4'` — plural keys use `_zero/_one/_two/_few/_many/_other` and need `Intl.PluralRules` | `mobile/src/i18n/index.ts:902` |
| `check-i18n.js` records a used key as the bare name, so `t('k', {count})` with only `k_one`/`k_other` defined **fails** the gate | `mobile/scripts/check-i18n.js` used-key regex |
| `arTranslations` closes at line 449; `enTranslations` closes at line 897 | `mobile/src/i18n/index.ts` |
| `change-requests.tsx` is **100% hard-coded Arabic** — no `t()`, no `isAr` ternaries | `mobile/app/admin/change-requests.tsx` |

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/contracts/admin.contracts.ts` | **Modify** — add `resourceType`/`dateFrom`/`dateTo` to the `auditLogs` query schema |
| `packages/server/src/modules/admin/admin.module.ts` | **Modify** — build the `where` clause from the new filters; 400 on unparseable dates |
| `packages/server/src/__integration__/audit-log.itest.ts` | **Modify** — cover the new filters and the 400 path; existing tests must still pass |
| `mobile/src/api/auditLogs.ts` | **New** — typed audit-log client (the only admin resource with a typed client; the rest still use raw `apiClient`) |
| `mobile/src/hooks/useAuditLogs.ts` | **New** — TanStack Query hook owning filter + page state |
| `mobile/app/admin/audit-logs.tsx` | **New** — filter row + paginated list + expandable row detail |
| `mobile/src/api/parents.ts` | **Modify** — add `decideLink`; widen `ParentLink` with the admin-only `parent`/`student` includes |
| `mobile/app/admin/change-requests.tsx` | **Modify** — generalise to Approvals: three sources, filter chips, per-type decision UI, full i18n |
| `mobile/app/admin/home.tsx` | **Modify** — unified approvals summary, Academy nav-card grid, drop inline queue + flat buttons, fix gold tile |
| `mobile/src/components/BottomNav.tsx` | **Modify** — correct the admin broadcast `labelAr` |
| `mobile/app/admin/academy-health.tsx` | **Modify** — fix the bidi teacher-load row |
| `mobile/src/i18n/index.ts` | **Modify** — new keys in both languages, including plural forms |
| `mobile/scripts/check-i18n.js` | **Modify** — treat `k_one`/`k_other`/… as satisfying a `t('k')` usage |

---

### Task 1: Server — audit-log filters

**Files:**
- Modify: `packages/shared/src/contracts/admin.contracts.ts:225-232`
- Modify: `packages/server/src/modules/admin/admin.module.ts:149-170`
- Test: `packages/server/src/__integration__/audit-log.itest.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `GET /api/v1/admin/audit-logs` accepting `?userId=&action=&resourceType=&dateFrom=&dateTo=&page=&limit=`. `dateFrom`/`dateTo` are ISO-8601 strings; unparseable values return **400** `{ error: 'dateFrom must be an ISO-8601 date string' }`. Response envelope unchanged: `{ data: AuditLogRow[], meta: { page, limit, total } }`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/server/src/__integration__/audit-log.itest.ts`, inside the existing `describe`:

```ts
  it('filters by resourceType', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    await request(app)
      .put(`/api/v1/admin/users/${s.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);

    const hit = await request(app)
      .get('/api/v1/admin/audit-logs?resourceType=USER')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(hit.status).toBe(200);
    expect(hit.body.meta.total).toBe(1);

    const miss = await request(app)
      .get('/api/v1/admin/audit-logs?resourceType=MESSAGE')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(miss.body.meta.total).toBe(0);
  });

  it('filters by dateFrom/dateTo window', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    await request(app)
      .put(`/api/v1/admin/users/${s.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);

    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();

    const inWindow = await request(app)
      .get(`/api/v1/admin/audit-logs?dateFrom=${past}&dateTo=${future}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(inWindow.body.meta.total).toBe(1);

    const beforeWindow = await request(app)
      .get(`/api/v1/admin/audit-logs?dateTo=${past}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(beforeWindow.body.meta.total).toBe(0);
  });

  it('combines filters (action + resourceType + window)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    await request(app)
      .put(`/api/v1/admin/users/${s.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`);
    await request(app)
      .put(`/api/v1/admin/users/${s.id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`);

    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await request(app)
      .get(`/api/v1/admin/audit-logs?action=APPROVE_STUDENT&resourceType=USER&dateTo=${future}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].action).toBe('APPROVE_STUDENT');
  });

  it('400s on an unparseable date rather than 500ing through Prisma', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .get('/api/v1/admin/audit-logs?dateFrom=not-a-date')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/dateFrom/);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/server && npm test -- --testPathPattern=audit-log`
Expected: the four new tests FAIL — the filter tests return the unfiltered total, and the bad-date test returns 500 (or 200), not 400.

- [ ] **Step 3: Extend the contract query schema**

In `packages/shared/src/contracts/admin.contracts.ts`, replace the `auditLogs` `request.query` object and refresh its `summary`:

```ts
    summary:
      'Paginated audit trail (newest first); filters: ?userId=, ?action=, ?resourceType=, ?dateFrom=, ?dateTo= (ISO-8601)',
    access: ADMIN,
    request: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        userId: z.string().optional(),
        action: z.string().optional(),
        resourceType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    },
```

Add `400: ErrorEnvelope,` to the `auditLogs` `responses` map, above `401`.

- [ ] **Step 4: Build the where clause in the module**

In `packages/server/src/modules/admin/admin.module.ts`, replace the body of the `auditLogs` route handler (currently lines 149-170). Note the explicit date guard — the contract router does **not** validate query params, so an unparseable date would otherwise reach Prisma as `Invalid Date` and 500:

```ts
const parseFilterDate = (raw: unknown, field: 'dateFrom' | 'dateTo'): Date | undefined => {
  if (raw === undefined || raw === '') return undefined;
  const parsed = new Date(String(raw));
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, `${field} must be an ISO-8601 date string`);
  }
  return parsed;
};

const auditLogs = defineRoute(
  adminContracts.auditLogs,
  async ({ query, req }) => {
    const { page = 1, limit = 20, skip = 0 } = (req as PaginatedRequest).pagination || {};
    const gte = parseFilterDate(query.dateFrom, 'dateFrom');
    const lte = parseFilterDate(query.dateTo, 'dateTo');
    const where = {
      ...(query.userId ? { userId: String(query.userId) } : {}),
      ...(query.action ? { action: String(query.action) } : {}),
      ...(query.resourceType ? { resourceType: String(query.resourceType) } : {}),
      ...(gte || lte ? { createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { status: 200 as const, body: paginatedResponse(rows, total, page, limit) };
  },
  { pre: [paginate(20, 100)] }
);
```

Ensure `AppError` is imported at the top of the file: `import { AppError } from '../../middleware/error.middleware';` (add only if not already present).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/server && npm test -- --testPathPattern=audit-log`
Expected: PASS — all six tests (two pre-existing + four new).

- [ ] **Step 6: Verify nothing else regressed**

Run: `cd packages/server && npm test`
Expected: PASS, with no new failures.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/contracts/admin.contracts.ts packages/server/src/modules/admin/admin.module.ts packages/server/src/__integration__/audit-log.itest.ts
git commit -m "feat(audit-log): filter by resourceType and date range

AC5.2 requires the audit log be filterable by actor, action, date range and
target entity. userId and action already worked; resourceType and the date
window are new.

The contract router passes req.query straight through without validating it
against the zod schema, so an unparseable date would reach Prisma as an
Invalid Date and surface as a 500. Guarded explicitly with AppError(400)."
```

---

### Task 2: Mobile — typed audit-log client and hook

**Files:**
- Create: `mobile/src/api/auditLogs.ts`
- Create: `mobile/src/hooks/useAuditLogs.ts`
- Modify: `mobile/src/api/index.ts`

**Interfaces:**
- Consumes: `adminContracts.auditLogs` from Task 1, including the new query fields.
- Produces:
  - `auditLogsApi.list(filters: AuditLogFilters): Promise<AuditLogPage>`
  - `interface AuditLogFilters { page?: number; limit?: number; userId?: string; action?: string; resourceType?: string; dateFrom?: string; dateTo?: string }`
  - `interface AuditLogRow { id: string; userId: string | null; action: string; resourceType: string; resourceId: string | null; details: unknown; ipAddress: string | null; userAgent: string | null; createdAt: string; user: { id: string; firstName: string; lastName: string; email: string } | null }`
  - `interface AuditLogPage { data: AuditLogRow[]; meta: { page: number; limit: number; total: number } }`
  - `useAuditLogs()` returning `{ rows, meta, totalPages, isLoading, error, filters, setFilters, page, setPage, refresh }`

- [ ] **Step 1: Write the client**

Create `mobile/src/api/auditLogs.ts`:

```ts
import { adminContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface AuditLogRow {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resourceType?: string;
  /** ISO-8601. The server 400s on anything it cannot parse. */
  dateFrom?: string;
  dateTo?: string;
}

export interface AuditLogPage {
  data: AuditLogRow[];
  meta: { page: number; limit: number; total: number };
}

export const auditLogsApi = {
  async list(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
    // The contract client skips undefined values, so unset filters are simply
    // absent from the query string rather than sent as "undefined".
    const res = await contractClient.call(adminContracts.auditLogs, {
      query: {
        page: filters.page,
        limit: filters.limit,
        userId: filters.userId,
        action: filters.action,
        resourceType: filters.resourceType,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      } as never,
    });
    return expectStatus(res, 200).body as unknown as AuditLogPage;
  },
};
```

- [ ] **Step 2: Export it from the API barrel**

In `mobile/src/api/index.ts`, add alongside the other exports:

```ts
export { auditLogsApi } from './auditLogs';
export type { AuditLogRow, AuditLogFilters, AuditLogPage } from './auditLogs';
```

- [ ] **Step 3: Write the hook**

Create `mobile/src/hooks/useAuditLogs.ts`:

```ts
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auditLogsApi, type AuditLogFilters, type AuditLogPage } from '../api/auditLogs';

const PAGE_SIZE = 20;

export function useAuditLogs() {
  const qc = useQueryClient();
  const [filters, setFiltersState] = useState<AuditLogFilters>({});
  const [page, setPage] = useState(1);

  const q = useQuery<AuditLogPage>({
    queryKey: ['auditLogs', filters, page],
    queryFn: () => auditLogsApi.list({ ...filters, page, limit: PAGE_SIZE }),
  });

  // Changing a filter must reset to page 1 — otherwise a narrower filter can
  // land the user on a page that no longer exists and render an empty list.
  const setFilters = useCallback((next: AuditLogFilters) => {
    setFiltersState(next);
    setPage(1);
  }, []);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['auditLogs'] });
  }, [qc]);

  const meta = q.data?.meta ?? { page, limit: PAGE_SIZE, total: 0 };
  return {
    rows: q.data?.data ?? [],
    meta,
    totalPages: Math.max(1, Math.ceil(meta.total / PAGE_SIZE)),
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    filters,
    setFilters,
    page,
    setPage,
    refresh,
  };
}
```

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/api/auditLogs.ts mobile/src/hooks/useAuditLogs.ts mobile/src/api/index.ts
git commit -m "feat(audit-log): typed mobile client and hook

Follows the one-file-per-resource convention. Filter changes reset to page 1
so a narrowed filter cannot strand the user on a now-empty page."
```

---

### Task 3: Mobile — i18n keys, plural support, and the gate fix

**Files:**
- Modify: `mobile/src/i18n/index.ts` (insert before the `};` at line 449 for `ar`, and before the `};` at line 897 for `en`)
- Modify: `mobile/scripts/check-i18n.js`

**Interfaces:**
- Consumes: nothing.
- Produces: the translation keys used by Tasks 5-7, in both languages. Notably `approvalsPendingCount` is a **plural key** — call it as `t('approvalsPendingCount', { count })`.

This task comes before the screens so they can be written against real keys rather than placeholders.

- [ ] **Step 1: Fix the gate so plural keys are recognised**

`check-i18n.js` records a used key by its bare name. A plural key defined only as `approvalsPendingCount_one` / `_other` would therefore be reported as missing and fail CI. Register the base name for any suffixed plural key.

In `mobile/scripts/check-i18n.js`, replace the `grab` function:

```js
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const grab = (block) => {
  const keys = new Set();
  const re = /^\s\s([A-Za-z][A-Za-z0-9_]*):\s/gm;
  let m;
  while ((m = re.exec(block))) {
    const key = m[1];
    keys.add(key);
    // i18next v4 plural keys are `base_one`, `base_other`, … but callers write
    // t('base', { count }). Register the base so the used-key check resolves.
    const underscore = key.lastIndexOf('_');
    if (underscore > 0 && PLURAL_SUFFIXES.includes(key.slice(underscore + 1))) {
      keys.add(key.slice(0, underscore));
    }
  }
  return keys;
};
```

- [ ] **Step 2: Add the Arabic keys**

Insert immediately before the `};` that closes `arTranslations` (line 449):

```ts
  // ── F10a: admin one-pager, approvals, audit log ──
  academySection: 'الأكاديمية',
  auditLog: 'سجل التدقيق',
  auditLogSubtitle: 'من فعل ماذا ومتى',
  auditLogFilterActor: 'المستخدم',
  auditLogFilterAction: 'الإجراء',
  auditLogFilterEntity: 'النوع',
  auditLogFilterFrom: 'من تاريخ',
  auditLogFilterTo: 'إلى تاريخ',
  auditLogClearFilters: 'مسح الفلاتر',
  auditLogEmpty: 'لا توجد سجلات مطابقة',
  auditLogLoadFailed: 'تعذر تحميل سجل التدقيق',
  auditLogPrev: 'السابق',
  auditLogNext: 'التالي',
  auditLogPageOf: 'صفحة {{page}} من {{total}}',
  auditLogIpAddress: 'عنوان IP',
  auditLogUserAgent: 'المتصفح',
  auditLogDetails: 'التفاصيل',
  auditLogUnknownActor: 'مستخدم محذوف',
  approvalsTitle: 'الموافقات',
  approvalsReview: 'راجع الموافقات',
  approvalsEmpty: 'لا توجد طلبات بانتظار الموافقة',
  approvalsFilterAll: 'الكل',
  approvalsFilterTeacherChange: 'تغيير معلم',
  approvalsFilterParentLink: 'ربط ولي أمر',
  approvalsFilterStudentAccount: 'حسابات الطلاب',
  approvalsApprove: 'موافقة',
  approvalsDeny: 'رفض',
  approvalsAssignTeacher: 'تعيين معلم',
  approvalsNoteLabel: 'ملاحظة الإدارة (اختياري)',
  approvalsNotePlaceholder: 'اكتب ملاحظة...',
  approvalsDecideFailed: 'فشل معالجة الطلب',
  approvalsParentLinkSub: 'يطلب ربط حسابه بالطالب',
  approvalsStudentAccountSub: 'حساب طالب بانتظار التفعيل',
  approvalsPendingCount_zero: 'لا طلبات بانتظار الموافقة',
  approvalsPendingCount_one: 'طلب واحد بانتظار الموافقة',
  approvalsPendingCount_two: 'طلبان بانتظار الموافقة',
  approvalsPendingCount_few: '{{count}} طلبات بانتظار الموافقة',
  approvalsPendingCount_many: '{{count}} طلباً بانتظار الموافقة',
  approvalsPendingCount_other: '{{count}} طلب بانتظار الموافقة',
```

- [ ] **Step 3: Add the English keys**

Insert immediately before the `};` that closes `enTranslations` (line 897):

```ts
  // ── F10a: admin one-pager, approvals, audit log ──
  academySection: 'Academy',
  auditLog: 'Audit log',
  auditLogSubtitle: 'Who did what, and when',
  auditLogFilterActor: 'Actor',
  auditLogFilterAction: 'Action',
  auditLogFilterEntity: 'Entity',
  auditLogFilterFrom: 'From',
  auditLogFilterTo: 'To',
  auditLogClearFilters: 'Clear filters',
  auditLogEmpty: 'No matching entries',
  auditLogLoadFailed: 'Could not load the audit log',
  auditLogPrev: 'Previous',
  auditLogNext: 'Next',
  auditLogPageOf: 'Page {{page}} of {{total}}',
  auditLogIpAddress: 'IP address',
  auditLogUserAgent: 'User agent',
  auditLogDetails: 'Details',
  auditLogUnknownActor: 'Deleted user',
  approvalsTitle: 'Approvals',
  approvalsReview: 'Review approvals',
  approvalsEmpty: 'Nothing waiting for approval',
  approvalsFilterAll: 'All',
  approvalsFilterTeacherChange: 'Teacher change',
  approvalsFilterParentLink: 'Parent link',
  approvalsFilterStudentAccount: 'Student accounts',
  approvalsApprove: 'Approve',
  approvalsDeny: 'Deny',
  approvalsAssignTeacher: 'Assign teacher',
  approvalsNoteLabel: 'Admin note (optional)',
  approvalsNotePlaceholder: 'Write a note...',
  approvalsDecideFailed: 'Could not process the request',
  approvalsParentLinkSub: 'Requesting to link to this student',
  approvalsStudentAccountSub: 'Student account awaiting activation',
  approvalsPendingCount_one: '{{count}} approval pending',
  approvalsPendingCount_other: '{{count}} approvals pending',
```

- [ ] **Step 4: Run the i18n gate**

Run: `npm run check-i18n --workspace=mobile`
Expected: `check-i18n: OK (...)` — the ternary count must still read **260** and ambiguous labels **5**. If either rose, a new inline ternary was introduced; convert it to `t()`.

- [ ] **Step 5: Verify Arabic plural categories resolve on device**

i18next is configured `compatibilityJSON: 'v4'`, which resolves plural categories through `Intl.PluralRules`. Hermes ships Intl on RN 0.81, but confirm rather than assume — a missing `Intl.PluralRules` silently falls back to `_other` for every count, which would reintroduce exactly the "1 طلاب" bug this key exists to avoid.

Add a temporary probe to `mobile/app/admin/home.tsx` inside the component body, run the app, read the Metro log, then remove it:

```ts
console.log(
  '[plural probe]',
  typeof Intl !== 'undefined' && 'PluralRules' in Intl ? new Intl.PluralRules('ar').select(1) : 'NO Intl.PluralRules',
  typeof Intl !== 'undefined' && 'PluralRules' in Intl ? new Intl.PluralRules('ar').select(2) : '',
  typeof Intl !== 'undefined' && 'PluralRules' in Intl ? new Intl.PluralRules('ar').select(3) : ''
);
```

Expected: `[plural probe] one two few`. If it prints `NO Intl.PluralRules`, stop and report — the plural keys need a polyfill, which is a scope change.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/i18n/index.ts mobile/scripts/check-i18n.js
git commit -m "feat(i18n): F10a keys with Arabic plural forms; teach the gate about plurals

approvalsPendingCount ships all six Arabic CLDR categories so the new admin
summary never renders '1 طلبات'. check-i18n recorded used keys by bare name,
so a key defined only as base_one/base_other read as missing — it now
registers the base name for plural-suffixed keys."
```

---

### Task 4: Mobile — parent-link decision API

**Files:**
- Modify: `mobile/src/api/parents.ts`

**Interfaces:**
- Consumes: `progressContracts.decideParentLink`.
- Produces:
  - `parentsApi.decideLink(linkId: string, action: 'APPROVE' | 'DENY', note?: string): Promise<ParentLink>`
  - `ParentLink` widened with optional `parent` and `student` objects (present only on the admin listing).

- [ ] **Step 1: Widen the ParentLink interface**

In `mobile/src/api/parents.ts`, replace the `ParentLink` interface. The admin listing includes `parent` and `student`; the parent-scoped listing includes only `student` — both are therefore optional:

```ts
export interface ParentLinkPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ParentLink {
  id: string;
  parentId: string;
  studentId: string;
  status: ParentLinkStatus;
  reason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  /** Present on the admin listing only (service includes parent+student for ADMIN). */
  parent?: ParentLinkPerson;
  /** Present on both listings. */
  student?: ParentLinkPerson;
}
```

- [ ] **Step 2: Add decideLink**

Add to the `parentsApi` object, after `listLinks`:

```ts
  /**
   * ADMIN-only. The server validates `action` manually (not via zod), so an
   * invalid action returns 400 with a pinned message.
   */
  decideLink: async (linkId: string, action: 'APPROVE' | 'DENY', note?: string): Promise<ParentLink> => {
    const res = expectStatus(
      await contractClient.call(progressContracts.decideParentLink, {
        params: { id: linkId },
        body: { action, note } as never,
      }),
      200
    );
    return (res.body as unknown as { data: ParentLink }).data;
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/api/parents.ts
git commit -m "feat(parents): admin decideLink + admin-only parent/student includes

Parent-link requests have been fully implemented server-side but unreachable
from the app. This is the client half."
```

---

### Task 5: Mobile — audit-log screen

**Files:**
- Create: `mobile/app/admin/audit-logs.tsx`

**Interfaces:**
- Consumes: `useAuditLogs()` (Task 2), i18n keys (Task 3).
- Produces: route `/admin/audit-logs`, linked from the home Academy grid in Task 7.

- [ ] **Step 1: Write the screen**

Create `mobile/app/admin/audit-logs.tsx`:

```tsx
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { AppText } from '@/src/components/AppText';
import { AppCard, EmptyState, StatusPill } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { BottomNav } from '@/src/components/BottomNav';
import { useAuditLogs } from '@/src/hooks/useAuditLogs';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

export default function AuditLogsScreen() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);
  const { rows, totalPages, isLoading, error, filters, setFilters, page, setPage, refresh } = useAuditLogs();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  const actorName = (row: (typeof rows)[number]) =>
    row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : t('auditLogUnknownActor');

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.appBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.appBarText}>
          <AppText variant="titleLarge" style={{ color: COLORS.textPrimary }}>
            {t('auditLog')}
          </AppText>
          <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
            {t('auditLogSubtitle')}
          </AppText>
        </View>
      </View>

      <View style={s.filterCard}>
        <TextInput
          style={s.input}
          value={filters.action ?? ''}
          onChangeText={(v) => setFilters({ ...filters, action: v || undefined })}
          placeholder={t('auditLogFilterAction')}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
        />
        <TextInput
          style={s.input}
          value={filters.resourceType ?? ''}
          onChangeText={(v) => setFilters({ ...filters, resourceType: v || undefined })}
          placeholder={t('auditLogFilterEntity')}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
        />
        <View style={s.dateRow}>
          <TextInput
            style={[s.input, s.dateInput]}
            value={filters.dateFrom ?? ''}
            onChangeText={(v) => setFilters({ ...filters, dateFrom: v || undefined })}
            placeholder={`${t('auditLogFilterFrom')} (YYYY-MM-DD)`}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
          />
          <TextInput
            style={[s.input, s.dateInput]}
            value={filters.dateTo ?? ''}
            onChangeText={(v) => setFilters({ ...filters, dateTo: v || undefined })}
            placeholder={`${t('auditLogFilterTo')} (YYYY-MM-DD)`}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
          />
        </View>
        {hasFilters ? (
          <TouchableOpacity onPress={() => setFilters({})} accessibilityRole="button" style={s.clearBtn}>
            <AppText variant="labelLarge" style={{ color: COLORS.primary }}>
              {t('auditLogClearFilters')}
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={COLORS.primary} />}
      >
        {error ? (
          <TouchableOpacity onPress={refresh} style={s.errorBanner} accessibilityRole="button">
            <AppText variant="bodyMedium" style={{ color: COLORS.error, textAlign: 'center' }}>
              {t('auditLogLoadFailed')}
            </AppText>
          </TouchableOpacity>
        ) : null}

        {isLoading ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </>
        ) : rows.length === 0 ? (
          <EmptyState colors={COLORS} icon="document-text-outline" title={t('auditLogEmpty')} />
        ) : (
          rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <TouchableOpacity
                key={row.id}
                activeOpacity={0.85}
                onPress={() => setExpandedId(expanded ? null : row.id)}
                accessibilityRole="button"
              >
                <AppCard colors={COLORS} style={s.row}>
                  <View style={s.rowTop}>
                    <AppText variant="titleMedium" style={{ color: COLORS.textPrimary, flex: 1 }} numberOfLines={1}>
                      {actorName(row)}
                    </AppText>
                    <StatusPill colors={COLORS} label={row.action} status="info" />
                  </View>
                  <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                    {row.resourceType}
                    {row.resourceId ? ` · ${row.resourceId}` : ''}
                  </AppText>
                  <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                    {new Date(row.createdAt).toLocaleString(isAr ? 'ar' : 'en')}
                  </AppText>

                  {expanded ? (
                    <View style={s.detail}>
                      <AppText variant="labelLarge" style={{ color: COLORS.textSecondary }}>
                        {t('auditLogIpAddress')}
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: COLORS.textPrimary }}>
                        {row.ipAddress ?? '—'}
                      </AppText>
                      <AppText variant="labelLarge" style={{ color: COLORS.textSecondary }}>
                        {t('auditLogUserAgent')}
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: COLORS.textPrimary }}>
                        {row.userAgent ?? '—'}
                      </AppText>
                      <AppText variant="labelLarge" style={{ color: COLORS.textSecondary }}>
                        {t('auditLogDetails')}
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: COLORS.textPrimary }}>
                        {row.details ? JSON.stringify(row.details, null, 2) : '—'}
                      </AppText>
                    </View>
                  ) : null}
                </AppCard>
              </TouchableOpacity>
            );
          })
        )}

        {totalPages > 1 ? (
          <View style={s.pager}>
            <TouchableOpacity
              disabled={page <= 1}
              onPress={() => setPage(page - 1)}
              style={[s.pagerBtn, page <= 1 && s.pagerBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('auditLogPrev')}
            >
              <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                {t('auditLogPrev')}
              </AppText>
            </TouchableOpacity>
            <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
              {t('auditLogPageOf', { page, total: totalPages })}
            </AppText>
            <TouchableOpacity
              disabled={page >= totalPages}
              onPress={() => setPage(page + 1)}
              style={[s.pagerBtn, page >= totalPages && s.pagerBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('auditLogNext')}
            >
              <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                {t('auditLogNext')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
      <BottomNav role="admin" active="home" />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    appBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
    appBarText: { flex: 1 },
    filterCard: {
      backgroundColor: COLORS.surface,
      marginHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
    input: {
      backgroundColor: COLORS.background,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      minHeight: 44,
      color: COLORS.textPrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
    dateRow: { flexDirection: 'row', gap: SPACING.sm },
    dateInput: { flex: 1 },
    clearBtn: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
    row: { gap: 4 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    detail: {
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.borderSubtle,
      gap: 2,
    },
    errorBanner: {
      backgroundColor: COLORS.errorLight,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.md,
      gap: SPACING.sm,
    },
    pagerBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: RADIUS.md,
      minHeight: 44,
      paddingHorizontal: SPACING.md,
      justifyContent: 'center',
    },
    pagerBtnDisabled: { opacity: 0.4 },
  });
```

- [ ] **Step 2: Confirm the `back` key exists**

Run: `grep -n "^  back:" mobile/src/i18n/index.ts`
Expected: two hits (ar and en). If absent, add `back: 'رجوع'` / `back: 'Back'` alongside the Task 3 keys.

- [ ] **Step 3: Typecheck and run the i18n gate**

Run: `cd mobile && npx tsc --noEmit && npm run check-i18n`
Expected: exit 0; ternary count still 260.

- [ ] **Step 4: Verify on device**

With Metro and the API running, log in as `admin@quran-review.com` / `Admin1234!`, navigate to `/admin/audit-logs`, and confirm: entries render, typing `APPROVE_STUDENT` into the Action filter narrows the list, an invalid date such as `nope` surfaces the error banner rather than crashing, and paging works when more than 20 entries exist.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/admin/audit-logs.tsx
git commit -m "feat(admin): filterable, paginated audit-log viewer (AC5.2)

Filters by actor, action, entity and date range. Paging is server-side, so
10k+ rows never load client-side."
```

---

### Task 6: Mobile — Approvals screen (generalise change-requests)

**Files:**
- Modify: `mobile/app/admin/change-requests.tsx` (full rewrite — the current file is 375 lines of hard-coded Arabic with no i18n)

**Interfaces:**
- Consumes: `useTeacherChange()`, `parentsApi.listLinks/decideLink` (Task 4), `apiClient` for student approval, i18n keys (Task 3).
- Produces: route `/admin/change-requests` rendering all three approval types behind filter chips.

**Critical constraint — do not collapse decision flows.** Teacher-change approval requires picking a `newTeacherId` (it reassigns appointments and creates one if none exists — see CLAUDE.md). Parent-link and student-account approvals are plain approve/deny. A single generic Approve button applied to a teacher-change row would silently skip teacher assignment. Render per-type action rows.

- [ ] **Step 1: Define the unified row type and sources**

Replace the top of `mobile/app/admin/change-requests.tsx` (imports through the component's data wiring):

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '@/constants/theme';
import { apiClient } from '@/src/api';
import { parentsApi, type ParentLink } from '@/src/api/parents';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';
import { AppText } from '@/src/components/AppText';
import { AppCard, Avatar, EmptyState, StatusPill } from '@/src/components/design';
import { SkeletonCard } from '@/src/components/SkeletonCard';
import { BottomNav } from '@/src/components/BottomNav';
import { useTheme, type ThemeColors } from '@/src/hooks/useTheme';

type ApprovalKind = 'TEACHER_CHANGE' | 'PARENT_LINK' | 'STUDENT_ACCOUNT';
type FilterKey = 'ALL' | ApprovalKind;

interface PendingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

interface ApprovalRow {
  id: string;
  kind: ApprovalKind;
  title: string;
  subtitle: string;
  /** Teacher-change and parent-link only — the free-text reason given. */
  reason?: string;
}

export default function ApprovalsScreen() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const s = createStyles(COLORS);

  const { requests, isLoading: loadingChanges, fetchRequests, decideRequest, fetchTeachers } = useTeacherChange();
  const [links, setLinks] = useState<ParentLink[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingRest, setLoadingRest] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);

  const loadRest = useCallback(async () => {
    setLoadingRest(true);
    try {
      // listLinks returns every link for an admin — the service applies no
      // status filter — so PENDING is selected here.
      const [allLinks, usersRes] = await Promise.all([parentsApi.listLinks(), apiClient.get('/admin/users')]);
      setLinks(allLinks.filter((l) => l.status === 'PENDING'));
      // Envelope is { data, meta }; res.data IS that envelope.
      const rows: PendingUser[] = usersRes.data?.data ?? [];
      setPendingUsers(rows.filter((u) => u.status === 'PENDING' && u.role === 'STUDENT'));
    } finally {
      setLoadingRest(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    loadRest();
  }, [loadRest]);

  const isLoading = loadingChanges || loadingRest;

  const rows: ApprovalRow[] = useMemo(() => {
    const changeRows: ApprovalRow[] = requests
      .filter((r: any) => r.status === 'PENDING')
      .map((r: any) => ({
        id: r.id,
        kind: 'TEACHER_CHANGE' as const,
        title: `${r.student?.firstName ?? ''} ${r.student?.lastName ?? ''}`.trim(),
        subtitle: `${r.currentTeacher?.firstName ?? ''} ${r.currentTeacher?.lastName ?? ''}`.trim(),
        reason: r.reason ?? undefined,
      }));
    const linkRows: ApprovalRow[] = links.map((l) => ({
      id: l.id,
      kind: 'PARENT_LINK' as const,
      title: `${l.parent?.firstName ?? ''} ${l.parent?.lastName ?? ''}`.trim() || l.parentId,
      subtitle: `${t('approvalsParentLinkSub')} ${`${l.student?.firstName ?? ''} ${l.student?.lastName ?? ''}`.trim()}`,
      reason: l.reason ?? undefined,
    }));
    const userRows: ApprovalRow[] = pendingUsers.map((u) => ({
      id: u.id,
      kind: 'STUDENT_ACCOUNT' as const,
      title: `${u.firstName} ${u.lastName}`.trim(),
      subtitle: t('approvalsStudentAccountSub'),
    }));
    const all = [...changeRows, ...linkRows, ...userRows];
    return filter === 'ALL' ? all : all.filter((r) => r.kind === filter);
  }, [requests, links, pendingUsers, filter, t]);
```

- [ ] **Step 2: Add the per-type decision handlers**

Continue inside the component:

```tsx
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchRequests(), loadRest()]);
  }, [fetchRequests, loadRest]);

  const finish = async () => {
    setExpandedId(null);
    setAdminNote('');
    await refreshAll();
  };

  const decideTeacherChange = async (id: string, action: 'APPROVE' | 'DENY', newTeacherId?: string) => {
    setDeciding(true);
    try {
      await decideRequest(id, action, adminNote.trim() || undefined, newTeacherId);
      await finish();
    } catch {
      Alert.alert(t('error'), t('approvalsDecideFailed'));
    } finally {
      setDeciding(false);
    }
  };

  const decideParentLink = async (id: string, action: 'APPROVE' | 'DENY') => {
    setDeciding(true);
    try {
      await parentsApi.decideLink(id, action, adminNote.trim() || undefined);
      await finish();
    } catch {
      Alert.alert(t('error'), t('approvalsDecideFailed'));
    } finally {
      setDeciding(false);
    }
  };

  const approveStudentAccount = async (id: string) => {
    setDeciding(true);
    try {
      await apiClient.put(`/admin/users/${id}/approve`);
      await finish();
    } catch {
      Alert.alert(t('error'), t('approvalsDecideFailed'));
    } finally {
      setDeciding(false);
    }
  };

  const openTeacherPicker = async (requestId: string) => {
    setTargetRequestId(requestId);
    if (teachers.length === 0) setTeachers(await fetchTeachers());
    setShowTeacherModal(true);
  };

  const filters: { key: FilterKey; labelKey: string }[] = [
    { key: 'ALL', labelKey: 'approvalsFilterAll' },
    { key: 'TEACHER_CHANGE', labelKey: 'approvalsFilterTeacherChange' },
    { key: 'PARENT_LINK', labelKey: 'approvalsFilterParentLink' },
    { key: 'STUDENT_ACCOUNT', labelKey: 'approvalsFilterStudentAccount' },
  ];
```

- [ ] **Step 3: Render rows with type-appropriate actions**

Replace the render body. The teacher-change branch keeps the picker; the other two get plain approve/deny:

```tsx
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.appBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <AppText variant="titleLarge" style={{ color: COLORS.textPrimary, flex: 1 }}>
          {t('approvalsTitle')}
        </AppText>
      </View>

      <View style={s.chips}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            accessibilityRole="button"
            style={[s.chip, filter === f.key && s.chipActive]}
          >
            <AppText
              variant="labelLarge"
              style={{ color: filter === f.key ? COLORS.textOnPrimary : COLORS.textPrimary }}
            >
              {t(f.labelKey)}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshAll} tintColor={COLORS.primary} />}
      >
        {isLoading ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </>
        ) : rows.length === 0 ? (
          <EmptyState colors={COLORS} icon="checkmark-circle-outline" title={t('approvalsEmpty')} />
        ) : (
          rows.map((row) => {
            const expanded = expandedId === `${row.kind}:${row.id}`;
            return (
              <TouchableOpacity
                key={`${row.kind}:${row.id}`}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={() => {
                  setExpandedId(expanded ? null : `${row.kind}:${row.id}`);
                  setAdminNote('');
                }}
              >
                <AppCard colors={COLORS} style={s.card}>
                  <View style={s.cardTop}>
                    <Avatar colors={COLORS} label={row.title} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="titleMedium" style={{ color: COLORS.textPrimary }}>
                        {row.title}
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }} numberOfLines={2}>
                        {row.subtitle}
                      </AppText>
                    </View>
                    <StatusPill
                      colors={COLORS}
                      label={t(
                        row.kind === 'TEACHER_CHANGE'
                          ? 'approvalsFilterTeacherChange'
                          : row.kind === 'PARENT_LINK'
                            ? 'approvalsFilterParentLink'
                            : 'approvalsFilterStudentAccount'
                      )}
                      status={row.kind === 'TEACHER_CHANGE' ? 'warning' : 'info'}
                    />
                  </View>

                  {expanded ? (
                    <View style={s.expanded}>
                      {row.reason ? (
                        <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
                          {row.reason}
                        </AppText>
                      ) : null}
                      {row.kind !== 'STUDENT_ACCOUNT' ? (
                        <>
                          <AppText variant="labelLarge" style={{ color: COLORS.textSecondary }}>
                            {t('approvalsNoteLabel')}
                          </AppText>
                          <TextInput
                            style={s.noteInput}
                            value={adminNote}
                            onChangeText={setAdminNote}
                            placeholder={t('approvalsNotePlaceholder')}
                            placeholderTextColor={COLORS.textSecondary}
                            multiline
                          />
                        </>
                      ) : null}

                      {row.kind === 'TEACHER_CHANGE' ? (
                        // Approving a teacher change REQUIRES choosing the new
                        // teacher — it reassigns appointments. Never a bare Approve.
                        <View style={s.btnRow}>
                          <TouchableOpacity
                            style={[s.btn, s.primaryBtn, { flex: 2 }, deciding && s.btnDisabled]}
                            disabled={deciding}
                            accessibilityRole="button"
                            onPress={() => openTeacherPicker(row.id)}
                          >
                            <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                              {t('approvalsAssignTeacher')}
                            </AppText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.btn, s.denyBtn, deciding && s.btnDisabled]}
                            disabled={deciding}
                            accessibilityRole="button"
                            onPress={() => decideTeacherChange(row.id, 'DENY')}
                          >
                            <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                              {t('approvalsDeny')}
                            </AppText>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={s.btnRow}>
                          <TouchableOpacity
                            style={[s.btn, s.approveBtn, deciding && s.btnDisabled]}
                            disabled={deciding}
                            accessibilityRole="button"
                            onPress={() =>
                              row.kind === 'PARENT_LINK'
                                ? decideParentLink(row.id, 'APPROVE')
                                : approveStudentAccount(row.id)
                            }
                          >
                            <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                              {t('approvalsApprove')}
                            </AppText>
                          </TouchableOpacity>
                          {row.kind === 'PARENT_LINK' ? (
                            <TouchableOpacity
                              style={[s.btn, s.denyBtn, deciding && s.btnDisabled]}
                              disabled={deciding}
                              accessibilityRole="button"
                              onPress={() => decideParentLink(row.id, 'DENY')}
                            >
                              <AppText variant="labelLarge" style={{ color: COLORS.textOnPrimary }}>
                                {t('approvalsDeny')}
                              </AppText>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      )}
                    </View>
                  ) : null}
                </AppCard>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showTeacherModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeacherModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <AppText variant="titleMedium" style={{ flex: 1, color: COLORS.textPrimary }}>
                {t('approvalsAssignTeacher')}
              </AppText>
              <TouchableOpacity onPress={() => setShowTeacherModal(false)} accessibilityRole="button">
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {teachers.map((tc) => (
                <TouchableOpacity
                  key={tc.id}
                  style={s.teacherRow}
                  accessibilityRole="button"
                  onPress={() => {
                    setShowTeacherModal(false);
                    if (targetRequestId) decideTeacherChange(targetRequestId, 'APPROVE', tc.id);
                  }}
                >
                  <Avatar colors={COLORS} label={`${tc.firstName} ${tc.lastName}`} size={38} />
                  <AppText variant="bodyMedium" style={{ color: COLORS.textPrimary }}>
                    {`${tc.firstName} ${tc.lastName}`}
                  </AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BottomNav role="admin" active="requests" />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    appBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, paddingHorizontal: SPACING.md },
    chip: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
      borderRadius: 99,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
    card: { gap: SPACING.sm },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    expanded: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.borderSubtle,
      paddingTop: SPACING.sm,
      gap: SPACING.sm,
    },
    noteInput: {
      backgroundColor: COLORS.background,
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
      minHeight: 64,
      textAlignVertical: 'top',
      color: COLORS.textPrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
    btnRow: { flexDirection: 'row', gap: SPACING.sm },
    btn: { flex: 1, minHeight: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    btnDisabled: { opacity: 0.5 },
    primaryBtn: { backgroundColor: COLORS.primary },
    approveBtn: { backgroundColor: COLORS.success },
    denyBtn: { backgroundColor: COLORS.error },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: COLORS.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '75%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.borderSubtle,
    },
    teacherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      minHeight: 44,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.borderSubtle,
    },
  });
```

- [ ] **Step 4: Confirm the `error` key exists**

Run: `grep -n "^  error:" mobile/src/i18n/index.ts`
Expected: two hits. If absent, add `error: 'خطأ'` / `error: 'Error'` alongside the Task 3 keys.

- [ ] **Step 5: Typecheck and gate**

Run: `cd mobile && npx tsc --noEmit && npm run check-i18n`
Expected: exit 0. The ternary count should now be **below** 260 — this rewrite removes the screen's hard-coded strings. Lower `TERNARY_BASELINE` in `check-i18n.js` to the new number and note it in the commit.

- [ ] **Step 6: Verify on device**

As admin: the All chip lists the pending student (Fatima Hassan) plus any teacher-change/parent-link rows; each chip narrows correctly; a teacher-change row opens the teacher picker (never a bare Approve); a student-account row approves and disappears from the list.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/admin/change-requests.tsx mobile/scripts/check-i18n.js
git commit -m "feat(admin): one Approvals screen for all three request types (AC5.1)

Parent-link requests were fully built server-side but unreachable from the
app; student-account approvals lived inline on home. Both now sit alongside
teacher-change requests behind filter chips.

Decision UI stays per-type: approving a teacher change requires picking the
new teacher because it reassigns appointments, so it must never render as a
bare Approve button.

The screen was 100% hard-coded Arabic with no i18n; it now goes through t(),
which lowers the inline-ternary baseline."
```

---

### Task 7: Mobile — admin home restructure + BottomNav label fix

**Files:**
- Modify: `mobile/app/admin/home.tsx`
- Modify: `mobile/src/components/BottomNav.tsx:154-161`

**Interfaces:**
- Consumes: the Approvals route (Task 6), the audit-log route (Task 5), i18n keys (Task 3), `parentsApi.listLinks` (Task 4).
- Produces: the finished admin one-pager.

- [ ] **Step 1: Fix the mislabelled tab**

In `mobile/src/components/BottomNav.tsx`, the admin broadcast tab reads `labelAr: 'إشعارات'` ("Notifications") while `labelEn` reads "Broadcast" — the two languages name the same destination differently, and Arabic names the wrong one. Change only the Arabic label:

```ts
  {
    id: 'broadcast',
    icon: 'megaphone-outline',
    iconActive: 'megaphone',
    labelAr: 'إشعار عام',
    labelEn: 'Broadcast',
    route: '/admin/broadcast',
  },
```

Leave the tab count at seven. Reducing it touches every admin screen's `active` prop and belongs in its own change.

- [ ] **Step 2: Add the supporting values**

Add inside the component, after the existing `stats` memo:

```tsx
  const [pendingLinkCount, setPendingLinkCount] = useState(0);
  useEffect(() => {
    // listLinks has no server-side status filter, so PENDING is counted here.
    parentsApi
      .listLinks()
      .then((all) => setPendingLinkCount(all.filter((l) => l.status === 'PENDING').length))
      .catch(() => setPendingLinkCount(0));
  }, []);

  const totalPending = stats.pending + pendingChangeCount + pendingLinkCount;

  const academyCards: { route: string; icon: keyof typeof Ionicons.glyphMap; title: string }[] = [
    { route: '/admin/academy-health', icon: 'stats-chart-outline', title: t('academyHealth') },
    { route: '/admin/academy-profile', icon: 'business-outline', title: t('academyProfile') },
    { route: '/admin/milestones', icon: 'trophy-outline', title: isAr ? 'الإنجازات' : 'Milestones' },
    { route: '/admin/broadcast', icon: 'megaphone-outline', title: isAr ? 'إشعار عام' : 'Broadcast' },
    { route: '/admin/audit-logs', icon: 'document-text-outline', title: t('auditLog') },
  ];
```

Add `import { parentsApi } from '@/src/api/parents';` and `import { AppText } from '@/src/components/AppText';` to the imports.

- [ ] **Step 3: Replace the metrics + action rows with a summary card and Academy grid**

Replace everything from `<View style={styles.metricsRow}>` through the closing `</View>` of `styles.actionRow` (currently lines 202-268) with:

```tsx
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          style={styles.approvalsSummary}
          onPress={() => router.push('/admin/change-requests')}
        >
          <View style={styles.approvalsIcon}>
            <Ionicons name="checkmark-done-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="titleMedium" style={{ color: COLORS.textPrimary }}>
              {t('approvalsPendingCount', { count: totalPending })}
            </AppText>
            <AppText variant="bodySmall" style={{ color: COLORS.textSecondary }}>
              {t('approvalsReview')}
            </AppText>
          </View>
          <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.metricsRow}>
          <MetricTile colors={COLORS} value={stats.students} label={isAr ? 'طلاب' : 'Students'} />
          {/* Teachers was tone="gold". Gold marks earned achievement only, and a
              headcount is not one — DESIGN.md Rationed Gold Rule. */}
          <MetricTile colors={COLORS} value={stats.teachers} label={isAr ? 'معلمون' : 'Teachers'} tone="info" />
          <MetricTile colors={COLORS} value={stats.pending} label={isAr ? 'معلق' : 'Pending'} tone="warning" />
        </View>

        <SectionHeader title={t('academySection')} colors={COLORS} />
        <View style={styles.academyGrid}>
          {academyCards.map((card) => (
            <TouchableOpacity
              key={card.route}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={styles.academyCard}
              onPress={() => router.push(card.route as never)}
            >
              <Ionicons name={card.icon} size={22} color={COLORS.primary} />
              <AppText variant="titleMedium" style={{ color: COLORS.textPrimary }} numberOfLines={1}>
                {card.title}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>
```

- [ ] **Step 4: Remove the inline approval queue and its now-dead helpers**

Delete the `SectionHeader` + queue block (currently lines 276-337) — that list now lives on the Approvals screen. Keep the `fetchError` banner above it. Also delete the now-unused `filters` array, `activeFilter` state, `users` memo, the `getFilteredUsers`, `roleLabel` and `statusLabel` helpers, `approveStudent`, the `filterRow` markup in the hero, and the corresponding entries in `createStyles` (`filterRow`, `filterChip`, `filterChipActive`, `filterText`, `filterTextActive`, `userCard`, `userInfo`, `userName`, `userEmail`, `pillRow`, `approveButton`, `listStack`, `emptyText`, `actionRow`, `actionBanner`, `actionIcon`, `actionInfo`, `actionTitle`, `actionMeta`, `broadcastButton`, `broadcastText`).

Also drop the now-unused imports: `AppCard`, `Avatar`, `StatusPill`, `SkeletonCard`, and `FilterType`.

- [ ] **Step 5: Add the new styles**

Add to `createStyles`:

```ts
    approvalsSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      minHeight: 44,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
      marginBottom: SPACING.md,
    },
    approvalsIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryMuted,
    },
    academyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    academyCard: {
      flexGrow: 1,
      flexBasis: '47%',
      minHeight: 88,
      justifyContent: 'center',
      gap: SPACING.xs,
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderSubtle,
    },
```

- [ ] **Step 6: Typecheck, lint, gate**

Run: `cd mobile && npx tsc --noEmit && npm run lint && npm run check-i18n`
Expected: exit 0 on all three. Lower `TERNARY_BASELINE` again if the count dropped.

- [ ] **Step 7: Verify on device**

As admin: the summary card reads the combined pending count and reaches Approvals; all five Academy cards navigate correctly; the Teachers tile is no longer cream/gold; the Arabic bottom-nav tab now reads "إشعار عام".

- [ ] **Step 8: Commit**

```bash
git add mobile/app/admin/home.tsx mobile/src/components/BottomNav.tsx mobile/scripts/check-i18n.js
git commit -m "feat(admin): true one-pager — approvals summary + Academy grid (AC5.1)

Replaces the inline approval queue and the flat button row with a single
combined-pending summary card and a grouped Academy nav grid that also
carries the new audit-log entry.

Drops tone=gold from the Teachers headcount tile: gold marks earned
achievement only. Note goldMuted and warningLight are the same hex, so the
gold and warning tiles were visually identical — worth resolving in the
palette separately.

Corrects the admin broadcast tab's Arabic label, which said 'Notifications'
while English said 'Broadcast'."
```

---

### Task 8: Visual pass and full gates

**Files:**
- Modify: `mobile/app/admin/academy-health.tsx` (teacher-load row)
- Verify only: `mobile/app/admin/broadcast.tsx`, `milestones.tsx`, `academy-profile.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: a green branch ready for review.

- [ ] **Step 1: Fix the bidi teacher-load row**

The rows render as `0Sarah Khalil` — a Latin name inside an RTL row resolves its own direction to LTR and hugs the left edge of its flex box, landing flush against the count. The markup is already structurally correct, so fix the alignment, not the layout. In `mobile/app/admin/academy-health.tsx`, give the name explicit start-alignment and the count a reserved slot:

```tsx
              <AppCard key={row.teacherId} colors={COLORS} style={styles.teacherRow}>
                <AppText
                  variant="titleMedium"
                  color={COLORS.textPrimary}
                  style={{ flex: 1, textAlign: I18nManager.isRTL ? 'right' : 'left' }}
                >
                  {fullName(row)}
                </AppText>
                <AppText
                  variant="headlineSmall"
                  color={COLORS.textPrimary}
                  style={{ minWidth: 32, textAlign: 'center' }}
                >
                  {row.activeStudents}
                </AppText>
              </AppCard>
```

Add `I18nManager` to the existing `react-native` import. `I18nManager.isRTL` reflects the app's layout direction rather than the string's own script, so a Latin name aligns to the row's start in Arabic and in English alike — which is why this is not hard-coded to `'right'`.

- [ ] **Step 2: Verify the fix on device in both directions**

Run the app as admin, open Academy Health, and confirm the rows read as name-at-start / count-at-end with clear separation. Then switch the app language to English in settings and confirm the row still reads correctly.

- [ ] **Step 3: Audit the three untouched screens for gold misuse**

Run: `grep -n "tone=\"gold\"\|goldMuted\|COLORS.gold" mobile/app/admin/broadcast.tsx mobile/app/admin/milestones.tsx mobile/app/admin/academy-profile.tsx`
Expected: hits only in `milestones.tsx`, where gold is correct (milestones are earned achievement). Any hit in `broadcast.tsx` or `academy-profile.tsx` is a Rationed Gold violation — change it to `info` or `primary`.

- [ ] **Step 4: Run every gate**

```bash
cd /Users/haskhr/Documents/opencode/education_management
npm run test:server
cd mobile && npx tsc --noEmit && npm run lint && npm run check-i18n
```

Expected: server tests PASS; typecheck exit 0; lint clean; `check-i18n: OK` with the ternary baseline at or below its recorded value.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/admin/academy-health.tsx
git commit -m "fix(academy-health): teacher-load rows read '0Sarah Khalil'

A Latin name inside an RTL row resolves LTR and hugs the left edge of its
flex box, landing flush against the count. Aligned to the layout direction
rather than the string's own script, so it reads correctly in both."
```

- [ ] **Step 6: Record the close-out**

Append an F10a entry to `tasks/todo.md` mapping each acceptance criterion to its proof:

- **AC5.1** (admin home is a one-pager: pending approvals, active user counts by role, broadcast composer, Academy Health link) — Task 7 summary card + metrics + Academy grid; Task 6 puts all three approval types on one screen.
- **AC5.2** (audit-log viewer filterable by actor, action, date range, target entity; pagination works on 10k+ rows) — Task 1 server filters + tests; Tasks 2/5 client, hook and screen; paging is server-side and `paginate(20, 100)`-bounded.
- **AC5.5** (all screens pass the mobile gates) — Task 8 Step 4.

Note explicitly which items were **not** in this cluster: the parent (F10b) and shared (F10c) clusters, the 260-ternary migration and plural rollout (tracked in `docs/superpowers/specs/2026-07-28-i18n-integrity-design.md`), and the `goldMuted`/`warningLight` palette collision surfaced in Task 7.

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: home restructure → Task 7; Approvals generalisation → Task 6; audit-log server change → Task 1; audit-log client/hook/screen → Tasks 2/5; `BottomNav` `labelAr` → Task 7 Step 1; visual pass and the academy-health bidi fix → Task 8; i18n keys → Task 3. The spec's explicit "confirm during planning" question — whether `listParentLinks` supports a status filter — is answered in Known-Correct Facts (it does not; filter client-side) and applied in Tasks 6 and 7.

**Corrections to the spec, made deliberately.** Three of its claims did not survive checking, and the plan follows the code rather than the spec:

1. The spec implies Status-Is-Not-Only-Color work on status pills. DESIGN.md requires colour paired with "an icon **or label**", and `StatusPill` already renders a label — so it is compliant and no work is planned.
2. The spec lists three Rationed-Gold violations on admin home (pending tile, teachers tile, teacher-change banner). Only the Teachers tile is actually `tone="gold"`; pending is `tone="warning"` and the banner uses `COLORS.warning`, both legitimate. Only the real one is fixed.
3. The reason all three *looked* gold is that `goldMuted` and `warningLight` are the same hex — recorded as a finding for the palette rather than silently worked around.

**Placeholder scan.** No TBD/TODO; every code step carries complete code; the two "confirm the key exists" steps give the exact `grep` and the exact fallback content.

**Type consistency.** `AuditLogRow`/`AuditLogFilters`/`AuditLogPage` are defined in Task 2 and consumed unchanged in Task 5. `ParentLink` gains optional `parent`/`student` in Task 4 before Tasks 6 and 7 read them. `parentsApi.decideLink(linkId, action, note?)` is defined once and called with that signature in both places. `ApprovalKind`/`ApprovalRow` are local to Task 6. `useAuditLogs()` returns `totalPages`, which Task 5 uses for the pager.

**Ordering check.** Task 4 (`decideLink`, widened `ParentLink`) precedes Tasks 6 and 7, which consume both. Task 3 (i18n keys) precedes every screen task. Task 1 (server filters) precedes Task 2 (client typed against them).

**Two integration hazards caught while planning, both handled in the plan:** the contract router does not validate query params, so dates are guarded explicitly with `AppError(400)` (Task 1 Step 4); and `check-i18n` resolves used keys by bare name, so plural-only keys would fail CI until the gate learns about plural suffixes (Task 3 Step 1).
