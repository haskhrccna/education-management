# Lessons Learned — 8-Stage Delivery

## Mobile

- Always use `marginStart`/`marginEnd` and `paddingStart`/`paddingEnd` instead of physical `Left`/`Right` for RTL layouts.
- Keep `forceRTL` behind a guard that checks `I18nManager.isRTL !== shouldBeRTL` to avoid unnecessary reloads.
- Use `AppText` (or another design-system primitive) instead of raw `Text` so font scale and theme colors propagate consistently.
- When adding a new screen, import `AppText` first; do not rely on local `Text` if you plan to use `t()` translation strings from the `useTranslation` hook.
- Verify `react-native-mmkv` major-version API: `react-native-mmkv@4` uses `createMMKV()`, not `new MMKV()`.
- Add `accessibilityRole` and `accessibilityLabel` to every `TouchableOpacity` used as a button, and ensure tap targets are at least 44×44 or have a `hitSlop`.

## Server

- Keep migrations idempotent with `IF NOT EXISTS` guards so fresh databases and shadow DBs can apply them cleanly.
- Patched migrations must be reconciled with `prisma migrate resolve` and then validated with `prisma migrate deploy` or `prisma db push`.
- When adding a new Prisma model referenced by existing models, include the inverse relation field immediately to avoid validation errors.
- Use mocked unit tests for new services that call the real Prisma client to avoid flakiness from shared test database state; import `mockDeep` from `jest-mock-extended`.
- Mount all new route groups in `app.ts` with both `authenticate` and `standardLimiter` (or the appropriate rate limiter) unless they are intentionally public.

## Tooling

- Run `cd mobile && npx tsc --noEmit` before committing any mobile changes.
- Run `npm run test:server` before committing server changes.
- For TypeScript seed scripts, use a dedicated config (`tsconfig.seed.json`) with strict mode disabled, isolated from the main build.

## Process

- Use Plan Mode for any multi-stage build and keep the plan artifact under `~/.hermes/plans/`.
- Update `tasks/todo.md` and create `tasks/lessons.md` at the end of each multi-stage delivery.
- Never commit debug scripts or temporary files; remove them before the final commit.
