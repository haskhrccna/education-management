---
target: app/student/gamification.tsx
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-06-30T18-16-10Z
slug: mobile-app-student-gamification-tsx
---
Method: ⚠️ DEGRADED: single-context (harness policy — subagents not spawned without explicit user request; detector ran, browser N/A for native RN)

# Critique (re-run) — app/student/gamification.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Leaderboard now has loading/empty/error; pull-to-refresh still refreshes only the top stats |
| 2 | Match System / Real World | 3 | i18n now resolves (was raw camelCase); Arabic-first restored |
| 3 | User Control and Freedom | 3 | Back, scope toggle, retry on both sections |
| 4 | Consistency and Standards | 3 | Tones corrected, SkeletonCard reused; scope chips still hand-rolled vs a shared chip |
| 5 | Error Prevention | 3 | Leaderboard errors surfaced, not swallowed |
| 6 | Recognition Rather Than Recall | 3 | Back button now labeled |
| 7 | Flexibility and Efficiency | 2 | Scope toggle only accelerator (fine for the screen) |
| 8 | Aesthetic and Minimalist | 4 | Hero numbers legible; gold rationed correctly to the live streak |
| 9 | Error Recovery | 3 | Per-section retry; top-level still shows raw `err.message` |
| 10 | Help and Documentation | 3 | Empty states now teach (first badge / no rankings) |
| **Total** | | **30/40** | **Good — solid foundation, minor polish remains** |

## Anti-Patterns Verdict
**LLM:** On-brand, no slop. Reward semantics now match DESIGN.md's Rationed-Gold rule.
**Deterministic scan:** `detect.mjs` → `[]` (0 findings, exit 0). Real attempt.
**Visual overlays:** N/A — native RN target.

## What's Working (now)
- **Legible, correctly-colored hero.** Streak value contrast 1.53:1 → **15.16:1**; current streak carries the gold (live achievement), longest is quiet primary.
- **Honest leaderboard.** Loading (SkeletonCard) → empty → error+retry; fetch errors no longer swallowed.
- **Real Arabic.** 13 previously-missing keys added (ar+en); the screen no longer leaks English camelCase.
- **Teaching empty states.** Zero-badge students get a "how to earn your first badge" path.

## Remaining Issues (all P2/P3)
- **[P3] Pull-to-refresh scope.** RefreshControl refreshes top stats but not the leaderboard the user is viewing. Fix: also call `fetchLeaderboard(scope)` on refresh.
- **[P3] Top-level error shows raw `err.message`.** Map to a friendly string.
- **[P3] Scope chips are a one-off pattern.** Could fold into a shared segmented/chip component for consistency.
- **[P3] Badge date `toLocaleDateString()`.** Verify Arabic numerals/calendar.
- **[P2] Flexibility.** Inherent to a display screen; no action needed.

## Persona Red Flags (resolved)
- **Sam (a11y):** hero contrast now 15:1; back button labeled; badge date 4.61:1; chips ≥44pt. Clear.
- **Casey (mobile):** chips thumb-sized; leaderboard never blanks silently.
- **Yusuf (student):** the streak is now the proudest, gold-lit number; empty wall tells him how to start.

## Questions to Consider
- Should pull-to-refresh refresh everything on screen, not just the top?
- Is a shared segmented-control worth extracting for the scope toggle (reused elsewhere)?
