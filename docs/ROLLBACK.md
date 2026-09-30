# Rollback Runbook

## Scope

How to revert each deployable unit of this repo: the API (Render), the
database (Prisma migrations), the web site (GitHub Pages), and mobile builds
(EAS).

## 1. API rollback (Render)

The API is a Docker/Node service on Render. Every deploy is an image.

1. Render Dashboard → the API service → **Events** tab → find the last known
   good deploy → **Rollback to this deploy**. Render redeploys the previous
   image with the same env vars; downtime is seconds.
2. If the bad deploy is only failing at boot (config guard, bad env var), fix
   the env var and **Manual Deploy → Deploy latest commit** instead.
3. Verify after rollback: `GET /health` returns 200 and a login works from the
   web site.

Precondition for step 1: **Auto-deploy on push stays ON** so every commit maps
to an image you can roll back to. Do not squash-deploy manually built branches.

## 2. Database rollback (Prisma)

Migrations are forward-only in production (`prisma migrate deploy`).

1. **Preferred:** deploy a new commit containing a forward fix migration
   (`npx prisma migrate dev --name revert_<change>`), never
   `migrate resolve --rolled-back` on a live DB.
2. **Emergency (data corruption, bad migration):**
   - Stop writes: scale the API service to 0 on Render.
   - Restore: take the latest `pg_dump` (see DEPLOYMENT.md §7 backup policy),
     create a fresh database, `pg_restore` into it, then
     `npx prisma migrate deploy` and repoint `DATABASE_URL`.
   - If the provider supports point-in-time recovery (managed Postgres), use
     that instead of a dump — it loses at most the last few minutes.
3. Recover the secret material (`JWT_SECRET`, `STORAGE_SECRET_KEY`) from the
   secrets manager; a restored DB without them cannot validate sessions.

## 3. Web site rollback (GitHub Pages)

The Pages workflow builds from a commit. Roll back by re-running the workflow
on the previous good commit:

```
git revert <bad-commit>   # or: git push --force-with-lease origin <good-sha>:main
```

Then re-run **Actions → Deploy web** on the restored HEAD. The consistency
guard will refuse to publish if `EXPO_PUBLIC_API_URL`/`CLIENT_URL` don't match,
which is itself a useful rollback tripwire.

## 4. Mobile builds (EAS)

Expo keeps every EAS build. Roll back by republishing:

- OTA (JS-only changes): `eas update --rollback` (or republish the last good
  update channel revision).
- Native changes: bump the build number, rebuild from the good commit
  (`eas build --profile production`), resubmit to the stores. Store rollback
  is a new forward release, not a removal — plan for it.

## 5. Media layer

Enable **bucket versioning** on the S3-compatible bucket (DEPLOYMENT.md §7).
To undo a bad overwrite/delete, restore the previous object version — no API
rollback required.

## Drill

Run a rollback drill at least quarterly: roll the API back one deploy, verify
`/health` + login, roll forward again. Quarterly restore test of the DB dump is
documented in DEPLOYMENT.md §7.3.
