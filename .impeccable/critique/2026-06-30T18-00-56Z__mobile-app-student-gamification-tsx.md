---
target: app/student/gamification.tsx
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-06-30T18-00-56Z
slug: mobile-app-student-gamification-tsx
---
Method: ⚠️ DEGRADED: single-context (harness policy — subagents not spawned without explicit user request; detector ran, browser N/A for native RN)

# Critique — app/student/gamification.tsx (Student Gamification)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Leaderboard has no loading/empty feedback; pull-to-refresh only refreshes the top stats, not the board |
| 2 | Match System / Real World | 3 | Streak/badge/rank metaphors are natural and clear |
| 3 | User Control and Freedom | 3 | Back, scope toggle, retry all present |
| 4 | Consistency and Standards | 3 | Uses design-system primitives, but scope chips are hand-rolled and metric tones are semantically inverted |
| 5 | Error Prevention | 2 | Leaderboard errors swallowed silently |
| 6 | Recognition Rather Than Recall | 3 | Sections labeled; badge names shown; back button icon-only/unlabeled |
| 7 | Flexibility and Efficiency | 2 | Scope toggle is the only accelerator (fine for scope) |
| 8 | Aesthetic and Minimalist | 3 | Clean, sectioned, breathing room — but the hero metric is undercut |
| 9 | Error Recovery | 2 | Top-level retry good; raw `err.message`; leaderboard has no recovery |
| 10 | Help and Documentation | 1 | No "how do I earn a streak/badge?" anywhere; empty-state description is blank |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict
**LLM assessment:** Does not look like generic AI slop — it correctly reuses the project's own primitives (AppCard, MetricTile, SectionHeader, EmptyState), no gradient text, no glassmorphism, no eyebrow scaffolding. The failures are domain/contrast bugs, not template slop.
**Deterministic scan:** `detect.mjs` → `[]` (0 findings, exit 0). Expected: the bundled detector targets HTML/CSS; a React-Native `.tsx` with `StyleSheet` yields no signal. Real attempt made.
**Visual overlays:** Not applicable — native React Native target, no DOM/localhost page to inject into.

## Overall Impression
The skeleton is right — streak → badges → leaderboard is the correct motivational arc, and it's built from the design system. But the single most important thing on a reward screen — the streak numbers — is **unreadable in the default theme**, and the color semantics are inverted (the live streak is painted in the *warning* color). The screen quietly defeats its own purpose. Biggest opportunity: fix the MetricTile contrast and make the current streak the dignified, legible hero it should be.

## What's Working
- **Right information architecture.** Streak (peak) → Badge Wall → Leaderboard is the natural motivational sequence; SectionHeaders make it scannable.
- **Design-system discipline.** AppCard/MetricTile/EmptyState reuse keeps it on-brand and RTL-aware (`marginStart`, direction-aware back arrow).
- **Rank is not color-alone.** Top-3 get a tint *and* the `#N` numeral — passes the Status-Is-Not-Only-Color rule.

## Priority Issues

- **[P1] Hero streak numbers are unreadable (WCAG fail).** `MetricTile` renders the value in the accent color on a tint of the *same* hue. Measured: gold value on gold tile = **1.53:1**, warning value on warn tile = **1.92:1** (need ≥3:1 for large bold, 4.5:1 ideal). The two streak numbers — the entire point of the screen — are nearly invisible in light mode. (Dark mode passes at 10.5:1, so it's light-theme-specific and component-wide.) **Fix:** in MetricTile, render the value in `textPrimary` (or a darkened accent) on the tint, reserving the accent for the small label or an icon. Verify across all four themes. *Borders on P0 for this screen's purpose.*
  - **Suggested command:** /impeccable colorize

- **[P1] Reward color semantics are inverted.** `currentStreak` uses `tone="warning"` (amber = "something's wrong") and `tone="gold"` sits on `longestStreak` (a past record). Per DESIGN.md's Rationed-Gold rule, gold marks *live earned achievement* — that's the current streak. **Fix:** current streak → `gold` (the illumination), longest streak → `primary` or a quiet neutral tone. Never paint a positive metric in the warning color.
  - **Suggested command:** /impeccable colorize

- **[P1] The activation moment is blank.** Empty Badge Wall passes `description=""`, so a student with zero badges sees "No badges yet" and nothing else — the one moment that should teach *how to earn the first badge*. This is the reward loop failing at the exact point motivation matters most. **Fix:** add an encouraging description ("Keep a 3-day streak to earn your first badge") and consider a "next badge" target.
  - **Suggested command:** /impeccable onboard

- **[P2] Leaderboard fails silently.** `fetchLeaderboard` swallows errors into `[]`; the screen then renders the "Leaderboard" header + scope chips + nothing — no loading, no empty state, no error. Switching scope gives zero feedback while the request is in flight. **Fix:** add per-section loading (SkeletonCard exists, unused) and an empty/error state; don't swallow the error.
  - **Suggested command:** /impeccable harden

- **[P2] Scope chips miss the 44pt tap target.** `paddingVertical: SPACING.xs` (4) + `bodySmall` (12px) ≈ ~20pt tall, shrinking further at the 0.85 font scale. Below the 44pt minimum and the elder-friendly contract. **Fix:** raise to ≥44pt (padding + min-height); bump chip text to `label`/`labelLarge`.
  - **Suggested command:** /impeccable adapt

## Persona Red Flags

**Sam (Accessibility-dependent):** Streak values fail contrast (1.5–1.9:1) — invisible at low vision. Back button is `accessibilityRole="button"` with **no `accessibilityLabel`** — screen reader announces "button," not "back." Badge date in `textMuted` = **2.68:1**, fails. Scope chips below 44pt.

**Casey (Distracted mobile):** Scope chips too small for a thumb. Leaderboard can render blank with no explanation after a scope tap on a flaky connection — looks broken. Pull-to-refresh refreshes stats but not the board the user is looking at.

**Yusuf (11-year-old student, project persona):** The number that makes him come back — his streak — is the faintest thing on screen. With no badges yet, the wall is an empty void with no "here's how." The amber "warning" color on his streak reads as *you did something wrong*, not *well done*.

## Minor Observations
- Badge date uses `toLocaleDateString()` (device locale) — verify it renders Arabic-Hijri/numerals consistently with the rest of the app.
- Loading uses a bare `ActivityIndicator`; SkeletonCard would match the design system and feel faster.
- Confirm the `t()` keys (`badgeWall`, `currentStreak`, `noBadgesYet`, …) all exist in both `ar` and `en` — a missing key renders the raw key string.
- `err.message` shown directly can surface technical text; map to a friendly string.

## Questions to Consider
- What would the streak look like if it were the *proudest* element on the screen instead of the faintest?
- Should an empty Badge Wall show the *next* badge to chase rather than just "none yet"?
- Is "warning amber" ever the right color for a thing the student is succeeding at?
