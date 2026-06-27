# UI Foundation Hardening — Stage 1

Stage 1 executes `docs/superpowers/plans/2026-06-25-ui-design-improvements.md`. Exit criteria: tsc clean, server tests green, no new deps, dashboards render correctly in ar+en.

- [ ] 1.1 Add AppText primitive and Cairo wiring
  - Add `fontFamily: 'Cairo'` to `TYPOGRAPHY` tokens.
  - Create `mobile/src/components/AppText.tsx` with RTL writingDirection/textAlign.
  - Replace `Text` in `design.tsx` with `AppText`.
  - Proof: `cd mobile && npx tsc --noEmit` clean.

- [ ] 1.2 forceRTL startup-only fix
  - Guard `I18nManager.forceRTL()` with `isRTL !== shouldBeRTL` check.
  - Trigger `Updates.reloadAsync()` (or DevSettings reload fallback).
  - Proof: tsc clean + `mobile/app/_layout.tsx` diff.

- [ ] 1.3 Font size / compactView settings wiring
  - Create `SettingsContext` exposing fontScale and spacingScale.
  - Wrap app in `SettingsProvider` in `_layout.tsx`.
  - Apply scales in `AppText` and `design.tsx`.
  - Proof: tsc clean.

- [ ] 1.4 Color token consolidation
  - Add `gradeOral`, `gradeQuiz`, `gradeExam`, `gradeAssignment`, `gradeParticipation`, `borderSubtle` to `getColors`.
  - Replace hardcoded hexes in `student/grades.tsx`, `admin/user-detail.tsx`, `student/teacher-change.tsx`, `admin/settings.tsx`, `design.tsx`, `BottomNav.tsx`.
  - Proof: tsc clean.

- [ ] 1.5 i18n dashboard sweep + a11y/touch targets
  - Grep `isAr ?` ternaries across dashboards; replace with `t()` keys in `i18n/index.ts`.
  - Default `IconButton` size 44 in `design.tsx`.
  - Add `hitSlop` on `SectionHeader` action.
  - Ensure `BottomNav` tabs are 44px min, have `accessibilityRole="tab"`, and RTL-aware back arrows.
  - Proof: tsc clean + server tests green.

- [ ] 1.6 Stage 1 commit and lessons update
  - Commit with message: `feat(mobile): Stage 1 UI foundation hardening`.
  - Append rules to `tasks/lessons.md` for any correction.
  - Proof: git log + tsc/test output.
