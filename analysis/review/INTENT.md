# Modernization intent: review

- **Date:** 2026-09-29
- **System name:** review
- **Source:** `/home/haskhr/Documents/education-management` (the repo root; used via `--source`).
  No `legacy/review` symlink was created: it would point the repo at itself, and Expo SDK 54's
  Metro follows symlinks, so a self-loop risks breaking the mobile/web bundler.

## Goal
**understand**: "Understand it first (Recommended)"

Original request, word for word:
> review the codebase ,confirm the mobile app and web site is working fine and using the same database

## From → to
- From: npm-workspaces monorepo: `packages/server` (Express 4 + TypeScript + Prisma 6 + PostgreSQL),
  `packages/shared` (Zod validators, types, API-base resolver), `mobile` (Expo SDK 54 / React Native;
  the same codebase is exported as the website and published to GitHub Pages).
- To: not decided. The assessment recommends whether to uplift, transform or reimagine.

## What must stay true
- "Keep system running": the current app and website stay live during any change.

## Open items to confirm during review
1. Mobile and web share one database only through one API. Web gets `EXPO_PUBLIC_API_URL` from a
   GitHub repository variable (`.github/workflows/pages.yml`). The mobile production profile in
   `mobile/eas.json` still has the placeholder `https://api.your-domain.com/api/v1`. That is a divergence
   unless it is overridden at build time.
2. Confirm the deployed API (`render.yaml`, `DATABASE_URL`) is the one both clients point at.
3. Confirm server tests, mobile type-check and the web export all pass on the current working tree
   (which has many uncommitted changes).
