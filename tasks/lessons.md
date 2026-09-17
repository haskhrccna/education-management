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

## Web export (added 2026-09-17)

- React Native libraries that poll the network are not safe to run on web.
  `@react-native-community/netinfo` probes `HEAD /` on web; on a GitHub Pages
  *project* site that is a permanent 404, which wedges React Query's
  `onlineManager` into offline and pauses every query and mutation. Gate
  NetInfo behind `Platform.OS !== 'web'` and let the browser's own
  `online`/`offline` events drive it.
- The Expo web export emits **no** `<base>` tag. Anything that needs the deploy
  base path must read `process.env.EXPO_BASE_URL` (inlined from app.json
  `experiments.baseUrl`), never a `<base href>` lookup.
- Expo's static renderer always emits an empty `<title data-rh="true">` from
  react-helmet, and browsers honour the FIRST title element — a title set in
  `+html.tsx` alone is dead on arrival. Strip the empty one at export time and
  re-assert `document.title` on navigation.
- A "successful" export proves nothing about the deployed page. Assert the
  release-critical facts (title, description, manifest, sw.js, base path) in
  `scripts/prepare-github-pages.js` so the build fails instead of the site.
- Test a Pages build against a server that 404s the site root and serves under
  the base path — a plain `python3 -m http.server` at the root hides both the
  offline wedge and every base-path bug.

## Deployment

- A build-time env var that falls back to `localhost` must be enforced in the
  workflow, not documented. An unset `EXPO_PUBLIC_API_URL` published a site
  pointing at the visitor's own machine, and the CI consistency check skipped
  itself in exactly that case.
- Files the database references and cannot regenerate (report PDFs,
  certificates) need object storage before the first real deploy; a render
  cache (share images) does not.
- Anything the server refuses to boot without must be in the image or mounted
  by the compose file — the Mushaf pages were documented but neither.

## Tooling (added 2026-09-17)

- lint-staged v16 spawns commands **without a shell** and appends staged paths
  to each one: `cd x && y` fails with ENOENT, and `tsc -p` fails with TS5042.
  Use a function entry in `lint-staged.config.js` for whole-project commands.
