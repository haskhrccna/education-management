# F10b: Parent UX Rethink — Design Spec

**Date:** 2026-07-27
**Scope:** Mobile (`mobile/app/parent/*`) only. No server changes — all required data already exists via `progressContracts` and `parentLinksContracts`.
**Cluster:** Parent (2 real screens: `home.tsx`, `link-request.tsx`) — one of three F10 specs (Admin / Parent / Shared). Carried from `docs/superpowers/specs/2026-07-14-10x-value-stage-2-design.md` §Stage 5, AC5.3.

---

## Goal

Turn `parent/home.tsx` from a child-selector-plus-single-detail-panel screen into a stack of self-contained per-child summary cards, per AC5.3's literal requirement: "One card per linked child with: today's session (or 'no session'), last grade, current streak, action chips ('View report,' 'View recordings,' 'Send message')." The guardian-consent toggle (M4.1) stays inline per card.

## Current State (confirmed by code audit)

`mobile/app/parent/home.tsx` (488 lines) already fetches per-child data via `useParent()` (children, dashboard, `selectChild`, `toggleDigest`, `decideConsent`) plus separate `mushafPagesApi.getMyPages` / `revisionQueueApi.getQueue` calls (403-tolerant) for the *currently selected* child. It renders: child-selector chips (only shown if >1 child) → one big detail panel for whichever child is selected (avatar/name/email, pages-memorized, revision-adherence, status badge, digest toggle) → guardian-consent card → progress `MetricTile`s → grades list (top 3) → attendance `MetricTile`s → upcoming appointments → pending revisions → read-only banner → two achievement shortcut tiles.

This satisfies most of AC5.3's *data* requirements already (session/grade/attendance data is fetched) but not its *structure* (single-panel-with-picker, not "one card per child") or its *actions* (no "View report" / "View recordings" / "Send message" chips exist anywhere on this screen today).

`mobile/app/parent/link-request.tsx` is a single-purpose form (request a link to a child by email) — confirmed to already do one job; visual polish only.

## Architecture

### `parent/home.tsx` — restructure to stacked per-child cards

Replace child-selector-chips + single-detail-panel with **N self-contained cards**, one per linked child (from `useParent().children`), stacked vertically in the scroll view. Each card contains, in order:

1. **Header row**: avatar, name, status badge (color + icon, not color alone).
2. **Today's session**: today's session summary if one exists for that child, else an explicit "No session today" empty-state line (never a blank space) — sourced from that child's `upcomingAppointments`/attendance data, scoped to today's date.
3. **Last grade**: most recent grade entry (subject/score/date) — sourced from that child's `grades` array (top 1, not top 3 — AC5.3 asks for "last grade" singular; the fuller grades list moves to an expandable "more" section within the card, not the page).
4. **Current streak**: gold-tone metric tile — this is a genuinely-earned value, the one place gold is correct in this cluster.
5. **Guardian-consent toggle (M4.1)**: inline, using the existing `decideConsent` action — unchanged behavior, just relocated into the per-child card instead of a separate page-level card.
6. **Digest toggle**: existing `toggleDigest` action, inline.
7. **Action chips row**: **View report**, **View recordings**, **Send message** — per child:
   - *View report* → navigates to the student's reports view scoped to this child (existing `reports` list API, filtered by `studentId`; confirm during planning whether a parent-scoped reports read path already exists or needs a small addition — `listReports`'s contract summary says student/teacher/admin scoping only, so a parent viewing a specific child's reports needs verification, not assumed).
   - *View recordings* → same pattern via `listRecordings`, scoped to the child.
   - *Send message* → routes to `/messages/conversation?partnerId=<child's teacher>`. The child's assigned teacher id is not present in the current `childDashboard`/`parentChildren` contract shapes (`MiniStudent` = id/firstName/lastName/email only) — resolving it (likely via the child's `upcomingAppointments` entries or the student's `assignedTeacherId`) is a planning-time confirmation, not assumed here.
8. **Progress detail** (moved inside the card, collapsed/expandable rather than always-expanded): surahs-in-progress, page-progress, revision-adherence, attendance present/absent, pending revisions. This is what makes the screen "the child's summary, not a navigation menu" — a parent scanning past a card sees the headline facts; expanding it gives the depth that used to be page-level sections.

Page-level (outside any card, unchanged in spirit): read-only banner (if applicable), and the two achievement shortcut tiles (gamification, certificates) as a footer — these are cross-child, not per-child, so they don't belong inside a card.

If a parent has zero linked children, the existing empty-state pattern (per DESIGN.md's Empty State component) applies, prompting toward `link-request.tsx`.

### `parent/link-request.tsx`

Visual polish only per the DESIGN.md audit below — no structural change.

## Visual pass (applies to both screens)

Card visual language matches DESIGN.md: hairline border + `sm` shadow, 16px padding, `rounded.md` corners. Status badges pair color with icon (a child's account status, consent status). Streak stays the one gold element per card — everything else (session, grades, attendance, action chips) uses primary green / neutral ink, per the Rationed Gold Rule. Action chips are text-action style (inline green label) or tonal icon-buttons, not three additional filled primary buttons competing with each other — DESIGN.md's "one primary action per screen" principle argues against three equally-weighted solid buttons per card.

## Files Changed

| File | Action |
|---|---|
| `mobile/app/parent/home.tsx` | Restructure: per-child cards replacing selector+panel; add three action chips; nest existing detail sections inside each card |
| `mobile/app/parent/link-request.tsx` | Visual polish only |
| `mobile/src/api/*` | Possible small addition if parent-scoped report/recording reads need a new filter param — confirmed during planning |
| `mobile/src/i18n/index.ts` | New keys for action chip labels, "No session today" empty state (both `ar` and `en`) |

## Out of Scope

- Full parent scheduling/appointment-booking capability — per the original spec's risk table: "Fence parent actions to messaging + page view + opt-in nudges; do not build full parent scheduling until after core loop is green."
- A separate `parent/child-dashboard.tsx` route — deliberately rejected during brainstorming in favor of expandable in-card sections, to avoid adding navigation depth for the common 1-3 child case.
- Changing `decideConsent`/`toggleDigest` server behavior — only their UI placement changes.

## Testing

1. Parent with 1 child: single card renders with all seven elements (header, today's session or empty state, last grade, streak, consent toggle, digest toggle, action chips).
2. Parent with 3+ children: cards stack correctly, each independently expandable, no cross-child data bleed (verify each card's action chips route with the correct `studentId`/`partnerId`).
3. Parent with 0 children: empty state renders, links to `link-request.tsx`.
4. "No session today" renders explicit empty-state text, never a blank card region.
5. Consent/digest toggles still call the correct existing mutation for the correct child when multiple cards are present (regression check for the restructure).
6. Both screens pass the mobile gates (contrast, i18n completeness, `AppText` scale) per AC5.5.
