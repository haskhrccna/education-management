# F10a: Admin UX Rethink — Design Spec

**Date:** 2026-07-27
**Scope:** Mobile (`mobile/app/admin/*`) + small server contract addition for audit-log filters.
**Cluster:** Admin (7 screens) — one of three F10 specs (Admin / Parent / Shared). Carried from `docs/superpowers/specs/2026-07-14-10x-value-stage-2-design.md` §Stage 5, AC5.1 and AC5.2.

---

## Goal

Restructure the admin section from "one-pager with a flat button row + a teacher-change-only queue" into a genuine one-pager whose sub-screens are logically grouped, and close the two real functional gaps: parent-link requests are invisible to admins today, and there is no audit-log viewer on mobile at all.

## Current State (confirmed by code audit)

| Screen | Status | Notes |
|---|---|---|
| `admin/home.tsx` | Exists (340 lines) | Hero + filter chips + `MetricTile` row + flat action-button row (Broadcast/Milestones/Academy Profile/Academy Health) + approval-queue list (student approvals only) |
| `admin/change-requests.tsx` | Exists | Teacher-change requests only — confirmed via grep, no `parent-links` import |
| `admin/broadcast.tsx` | Exists | Visual polish only, no IA change |
| `admin/milestones.tsx` | Exists | Visual polish only, no IA change |
| `admin/academy-health.tsx` | Exists (F9) | Visual polish only |
| `admin/academy-profile.tsx` | Exists | Visual polish only |
| `admin/audit-logs.tsx` | **Does not exist** | Net-new screen |

**Backend reality check (confirmed by reading contracts/modules directly — this corrects the original 2026-07-14 spec's assumption that these are net-new):**

- Parent-link requests are **fully built server-side already**: `progressContracts.listParentLinks` (`GET /api/v1/parents/links`, admin sees all with parent+student includes) and `progressContracts.decideParentLink` (`PATCH /api/v1/parents/links/:id/decision`, ADMIN-only, `APPROVE`/`DENY`) both exist and work. The gap is **100% mobile-side** — no server changes needed for this part.
- Audit logs are **partially built server-side**: `adminContracts.auditLogs` (`GET /api/v1/admin/audit-logs`) exists with pagination, `?userId=` (actor) and `?action=` filters, and returns `resourceType`/`resourceId`/`createdAt` per row. It is **missing** date-range and target-entity (`resourceType`) query filters, which AC5.2 requires. This needs a small, additive contract + module change before the mobile screen can be built against it.

## Architecture

### `admin/home.tsx` — restructure to true one-pager

Three zones, replacing the current hero+chips+metrics+flat-buttons+queue stack:

1. **Hero** (unchanged): title/subtitle, notification/messages/settings/account/logout icons.
2. **Unified approvals summary**: one card showing a combined pending count — student approvals + teacher-change requests + parent-link requests — with a single "Review approvals" action that routes to the generalized Approvals screen (see below). Replaces the current inline approval-queue list and the teacher-change banner.
3. **MetricTile row** (unchanged: students/teachers/pending — pending now reflects the combined count).
4. **Academy section**: a nav-card grid (2 columns) replacing the flat button row — Academy Health, Academy Profile, Milestones, Broadcast, **Audit Log** (new entry). Each card: icon, title, one-line description. No functional change to the four existing destinations, just grouped presentation.

`BottomNav role="admin" active="home"` unchanged.

### `admin/change-requests.tsx` → generalized "Approvals"

Same file, expanded scope (not a new route — this screen already owns "things needing an admin decision"):

- Add a data source: `progressApi.listParentLinks()` (new mobile API client function, filtered client-side or via existing endpoint to `status=PENDING`... **note:** confirm during planning whether `listParentLinks` supports a status query param server-side, or whether the mobile client filters the full list to `PENDING` — the endpoint returns "all" links with no documented status filter, so this likely needs a client-side filter unless the endpoint gains one).
- Filter chips: **All / Teacher-Change / Parent-Link / Student-Accounts**, mirroring the existing filter-chip pattern already used on `admin/home.tsx`.
- **Decision-flow isolation (risk called out during design review):** teacher-change and parent-link approvals have different decision shapes (teacher-change resolves to `newTeacherId` selection per `decideTeacherChangeRequest`'s side effects documented in CLAUDE.md; parent-link resolves to a plain `APPROVE`/`DENY` with optional `note`). The list must render type-appropriate decision UI per row — a single generic "Approve/Reject" button pair is only safe for parent-link and student-account rows; teacher-change rows keep their existing teacher-picker flow. Do not collapse these into one generic action component.
- Student-account approvals move here too (currently live inline on `admin/home.tsx`), completing the "one place for all pending approvals" goal.

### `admin/audit-logs.tsx` — new screen

- **Server change first:** extend `adminContracts.auditLogs` query schema with `dateFrom`/`dateTo` (ISO date strings) and `resourceType` (string). Extend the module's `where` clause construction in `admin.module.ts` (`auditLogs` route, `packages/server/src/modules/admin/admin.module.ts:149-170`) to apply them (`createdAt: { gte, lte }`, `resourceType: query.resourceType`). Additive only — existing `userId`/`action` filters and pagination keep working unchanged.
- **Mobile:** new `mobile/src/api/auditLogs.ts` client (`getAuditLogs({ page, limit, userId, action, resourceType, dateFrom, dateTo })`) and `mobile/src/hooks/useAuditLogs.ts`, following the project's one-file-per-resource convention.
- **Screen:** filter row (actor search-by-name-or-email, action dropdown/chips, resource-type dropdown, date-range picker), paginated list (reuse the existing pagination UI pattern from other paginated admin screens), each row showing actor, action, resource type + id, timestamp, and a tap-to-expand for `details`/`ipAddress`/`userAgent`. AC5.2 requires this to "work on 10k+ rows without a hitch" — this is satisfied by the existing server-side pagination (already `paginate(20, 100)`-bounded); no client-side full-list loading.

## Visual pass (applies to all 7 screens)

Audit against `mobile/DESIGN.md` rather than introducing new patterns: Rationed Gold (the combined-approvals count and audit-log entries are operational, never gold — gold stays reserved for milestones/streaks elsewhere in the app), Status-Is-Not-Only-Color on every status pill (PENDING/APPROVED/DENIED, REQUESTED/ACCEPTED), hairline-border cards + `sm` shadow only, `AppText` scale honored (no raw `<Text>` font sizes), ≥44pt tap targets on all nav-cards and filter chips.

## Files Changed

| File | Action |
|---|---|
| `packages/shared/src/contracts/admin.contracts.ts` | Extend `auditLogs` query schema: `dateFrom`, `dateTo`, `resourceType` |
| `packages/server/src/modules/admin/admin.module.ts` | Extend `auditLogs` route's `where` construction |
| `mobile/app/admin/home.tsx` | Restructure: unified approvals summary card, Academy nav-card grid, remove inline queue + flat buttons |
| `mobile/app/admin/change-requests.tsx` | Generalize to Approvals: add parent-link + student-account sources, filter chips, type-aware decision UI |
| `mobile/app/admin/audit-logs.tsx` | **New** |
| `mobile/src/api/auditLogs.ts` | **New** |
| `mobile/src/hooks/useAuditLogs.ts` | **New** |
| `mobile/app/admin/broadcast.tsx`, `milestones.tsx`, `academy-health.tsx`, `academy-profile.tsx` | Visual polish only per DESIGN.md audit — no structural change |
| `mobile/src/i18n/index.ts` | New keys for Approvals filter chips, audit-log screen (both `ar` and `en`) |

## Out of Scope

- Any change to the `decideTeacherChangeRequest` side-effect logic (CLAUDE.md-documented behavior — unchanged, only its UI location/grouping moves).
- Bulk-decide UI for parent-link/student-account rows (server supports `bulkApprove`/`bulkDeactivate` for users only, not parent-links — no bulk parent-link endpoint exists, so no bulk UI for that row type).
- Exporting audit logs to CSV (only `exportUsers`/`exportGrades`/`exportAppointments` exist; audit-log export is not part of AC5.2).

## Testing

1. Admin home renders the combined approvals count correctly with a mix of pending student/teacher-change/parent-link items (mock all three sources).
2. Approvals screen: filter chips correctly scope the list; a teacher-change row shows the teacher-picker flow, a parent-link row shows Approve/Deny, and deciding one does not affect the other's rendering.
3. Audit-logs screen: filter by actor, action, date range, and resource type independently and combined; verify pagination controls fetch the next page rather than loading everything client-side.
4. Server: `auditLogs` route unit/integration test extended to cover `dateFrom`/`dateTo`/`resourceType` filters, confirming existing `userId`/`action` filter tests still pass unchanged.
5. All 7 screens pass the mobile gates (contrast, i18n completeness, `AppText` scale) per AC5.5.
