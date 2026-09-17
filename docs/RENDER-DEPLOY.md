# Deploying the API on Render

The goal of this page: one database, reached by both the mobile app and the web
site, so that `ali@quran-review.com` can sign in on either. Nothing here is
optional except where it says so.

Budget: Render's free tier works for a first run, but the free Postgres expires
after 30 days and the free web service sleeps when idle (the first request after
a sleep takes ~30s). Before real users, move both to a paid instance — about
$7/month each at the time of writing.

---

## 1. Create the service and the database (5 minutes)

1. Render dashboard → **New → Blueprint**.
2. Connect `haskhrccna/education-management` and pick the `main` branch.
3. Render reads `render.yaml` at the repo root and proposes one web service
   (`quran-review-api`) and one Postgres database (`quran-review-db`).
4. It will prompt for the values marked `sync: false`. **Leave them blank for
   now** except the email ones if you already have SMTP — you will fill in
   `PUBLIC_API_URL` in the next step, once the URL exists.
5. Apply. The first build takes a few minutes (it builds the Dockerfile).

Migrations run automatically at startup (`prisma migrate deploy` in the
service's start command), so the schema is created on the first boot.

## 2. Check that it is alive

Nothing to configure here: the server reads Render's own `RENDER_EXTERNAL_URL`
for its public origin, so the first deploy boots on its own. Set
`PUBLIC_API_URL` explicitly only when the API moves to a custom domain.

Open `https://<your-service>.onrender.com/api/health`. It should return JSON
with `"status": "healthy"` — or `"degraded"`, which only means Redis is absent
and is expected here.

If the service refuses to start, read the log line before the crash. The two
designed-in refusals are a missing `CLIENT_URL`/`PUBLIC_API_URL` in production
and an incomplete Mushaf page set — all three are already handled by the
blueprint.

## 3. Create the accounts

The seed script refuses to run in production with the documented default
passwords, so choose your own. From your Mac, using the database's **External
Database URL** (Render dashboard → the database → Connections):

```bash
cd "Github projects/education-managment/packages/server"
DATABASE_URL="<external database url>" \
SEED_ADMIN_PASSWORD='<choose>' \
SEED_TEACHER_PASSWORD='<choose>' \
SEED_STUDENT_PASSWORD='<choose>' \
npx prisma db seed
```

That creates the demo roster (admin, two teachers, three students, with an
accepted Ali↔Ahmad pairing). For a real academy, seed **one** admin this way and
create everyone else through the app's own approval flow.

## 4. Connect the web site to it

In GitHub → the repo → **Settings → Secrets and variables → Actions →
Variables** (not Secrets — the value is baked into a public bundle and is not a
secret):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://<your-service>.onrender.com/api/v1` |
| `CLIENT_URL` | `https://haskhrccna.github.io` |

Then re-run the **Deploy GitHub Pages** workflow (Actions → the workflow → Run
workflow). The URL is compiled into the bundle at build time, so the site must
be rebuilt for it to take effect — and CI fails if only one of the two
variables is set, because a mismatch between them is exactly what CORS rejects.

## 5. Connect the mobile app to it

`mobile/eas.json` → `build.production.env.EXPO_PUBLIC_API_URL` — the same value
as above. The app and the site then share one database by construction.

## 6. Before real users

- **Object storage.** Until `STORAGE_*` is set, recitation recordings, report
  PDFs and certificates are written to the container's disk, which Render wipes
  on every deploy. Cloudflare R2 or Backblaze B2 both work; set
  `STORAGE_ENABLED=1`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`,
  `STORAGE_SECRET_KEY`, and keep `STORAGE_BUCKET`.
- **Paid instances.** The free database expires after 30 days, and expiry means
  the data is gone.
- **Backups.** Render's paid Postgres includes daily backups; verify a restore
  once rather than trusting it.
- **Mushaf pages.** The Quran reader stays dark until the 604 page images are
  available — see `docs/DEPLOYMENT.md` §12. Serving them from the same bucket
  is the least painful route on a platform without persistent disks.
- **SMTP.** Password reset and approval notifications silently do nothing until
  `EMAIL_*` is configured.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Site loads, login does nothing, console says "No server is configured" | `EXPO_PUBLIC_API_URL` is unset, or Pages has not been rebuilt since it was set |
| Login fails with a CORS error in the console | Server `CLIENT_URL` does not exactly match the site origin |
| First request after a quiet period takes ~30s | Free-tier spin-down; upgrade the instance |
| `/api/health` returns `degraded` | Redis absent — expected, the queue runs synchronously |
| Deploy log ends at `mushaf-pages incomplete` | `ALLOW_MISSING_MUSHAF_PAGES` was removed from the environment |
| Build fails at `npm ci` with `sh: 1: husky: not found` | Fixed in this repo. The root `prepare` script ran husky, which is a root devDependency the image does not install; `prepare` is now tolerant of it being absent |
| Deploy exits 127 with `sh: <long command>: not found`, then "no open ports detected" | Fixed in this repo. A multi-command start string in the platform's command field is passed to `sh` as a single command name; startup now lives in `packages/server/docker-entrypoint.sh`, which the image runs as its CMD |
