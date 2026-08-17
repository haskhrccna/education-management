# App Store Release Plan — مراجعة القرآن (Quran Review)

**Verdict: NOT READY to upload yet.** The iOS *binary configuration* is ~70% done and in good shape, but there are hard blockers outside the app bundle — no production backend, local-disk file storage, no Apple Developer linkage, and no legal/privacy assets. None are exotic; this is a normal 3–5 week path to a first submission (mostly infrastructure + store paperwork, not app code).

_Date: 2026-08-17 · Bundle ID: `com.quranreview.app` · Version 1.0.0 (build 1) · Expo SDK 54 / New Architecture_

---

## 1. Readiness scorecard

| Area | Status | Notes |
|---|---|---|
| iOS app identity (name, bundle ID, version, build no.) | ✅ Ready | `app.json` complete; Arabic display name "مراجعة القرآن". |
| App icon (1024×1024) & splash | ✅ Ready | Real `icon.png` 1024² (not a placeholder); splash on brand green `#1B5E20`. |
| iOS permission usage strings | ✅ Ready | Face ID, Microphone, Documents — all present, in Arabic. |
| Expo config plugins | ✅ Ready | local-authentication, av (mic), notifications, secure-store, document-picker, localization. |
| In-app account deletion (Apple 5.1.1(v)) | ✅ Ready | `account.tsx` has a full "delete account permanently" flow — clears the most common rejection. |
| Email/password auth only (no social login) | ✅ Ready | So **Sign in with Apple is NOT required** (Guideline 4.8 only triggers on third-party login). |
| EAS build profiles | 🟡 Partial | `eas.json` has dev/preview/production, but prod `EXPO_PUBLIC_API_URL` is the placeholder `https://api.your-domain.com`. |
| **Production backend deployment** | ❌ **Blocker** | API defaults to `localhost:4000`. No hosted server, DB, or Redis. |
| **Persistent file storage** | ❌ **Blocker** | Recordings/report PDFs/share images use `LocalStorageAdapter` (local disk) — lost on any ephemeral/redeployed host. |
| **Apple Developer Program + App Store Connect** | ❌ **Blocker** | `eas.json` submit profile has empty `appleId`/`ascAppId`/`appleTeamId`. Needs the $99/yr account + an app record. |
| **Push notifications (APNs)** | ❌ Blocker (if push is a launch feature) | Server uses FCM (`fcm.service.ts`), currently a graceful no-op. Needs Firebase project + APNs auth key. |
| **Privacy policy + App Privacy "nutrition label"** | ❌ **Blocker** | None in repo. Required; app collects name, email, audio recordings, grades — and serves **minors** (students). |
| App Store metadata (screenshots, description, age rating, review demo account) | ❌ Missing | None prepared. Reviewers also need a pre-approved login (students are gated behind admin approval). |
| Encryption compliance flag | 🟡 One-liner | `ITSAppUsesNonExemptEncryption` not set → App Store Connect prompts every submission. |
| Content licensing (Quran text / mushaf images / audio) | ⚠️ Verify | Confirm rights/public-domain sources for any bundled or served Quran assets. |
| Dark mode declaration | 🟡 Minor | `userInterfaceStyle: "light"` but the app supports dark mode (DESIGN.md). Consider `"automatic"`. |

---

## 2. Critical path (the blockers, in dependency order)

```
Apple Developer acct ─┐
                      ├─► App Store Connect app record ─► EAS submit creds ─┐
Production backend ───┤                                                     ├─► TestFlight ─► Review ─► Release
   + object storage   │                                                     │
   + APNs/FCM push ───┘                                                     │
Privacy policy + App Privacy answers + screenshots ────────────────────────┘
```

Everything below the app binary is the real work. The app code itself needs only small changes (env wiring, encryption flag, a storage adapter swap on the server, optional dark-mode tweak).

---

## 3. Phase 0 — Accounts & prerequisites  _(½ day + Apple approval wait)_

- [ ] Enrol in the **Apple Developer Program** ($99/yr). Business entity? Use an Organization account (needs a D-U-N-S number, can take days) vs Individual (faster, shows your personal name as seller).
- [ ] In **App Store Connect**, create the app record: name, primary language (Arabic), bundle ID `com.quranreview.app`, SKU.
- [ ] Capture the three IDs EAS needs and fill `mobile/eas.json` → `submit.production.ios`: `appleId` (your Apple ID email), `appleTeamId` (Membership → Team ID), `ascAppId` (the app's numeric ID in App Store Connect).
- [ ] Decide the **public domain** (e.g. `api.quranreview.app`) — used by the backend; the deep-link scheme is already `quran-review://` and does not need a domain.

## 4. Phase 1 — Production backend  _(3–5 days) — biggest blocker_

The server is a standard Express + Prisma/Postgres + Redis app with a `Dockerfile`; it just needs a home.

- [ ] **Pick a host.** Recommendation: a managed platform to avoid ops — Render, Railway, or Fly.io for the Node service; managed Postgres (same provider or Neon/Supabase); managed Redis (Upstash) — Redis is optional (queue degrades gracefully) but recommended for broadcasts/digests.
- [ ] Provision **Postgres** (production, backed up) and set `DATABASE_URL`.
- [ ] Set all production secrets from `packages/server/src/config`: `JWT_SECRET`/refresh secrets (fresh, strong), `DATABASE_URL`, `REDIS_URL`, SMTP creds (real email — password reset & approvals depend on it), FCM creds (Phase 4).
- [ ] Run migrations against prod: `npx prisma migrate deploy` (never `db push`).
- [ ] Seed **one real admin** (not the demo seed) via a one-off script / `SEED_ADMIN_PASSWORD`; rotate off the documented default passwords.
- [ ] Put the API behind **HTTPS + a domain** (`https://api.quranreview.app`). Confirm CORS allows the app origin and that rate-limiters run in production (they do — `NODE_ENV !== 'test'`).
- [ ] Health check + logging + error monitoring (e.g. Sentry) + automated DB backups.
- [ ] Update `eas.json` `production.env.EXPO_PUBLIC_API_URL` → `https://api.quranreview.app/api/v1` (and `preview` → staging).

## 5. Phase 2 — Persistent file storage  _(1–2 days) — code change on the server_

`LocalStorageAdapter` writes to `uploads/`, `reports/`, `uploads/share/` on local disk. On most cloud hosts that disk is ephemeral (wiped on deploy/restart) — every recitation recording, report PDF, and share image would vanish.

- [ ] Add an **S3-compatible adapter** (AWS S3, Cloudflare R2, or Backblaze B2) implementing the existing `StorageAdapter` interface in `packages/server/src/lib/storage.ts` — a contained change; the interface is already abstracted.
- [ ] Keep the auth model on downloads (the `?token=` query-param fallback for `/files/recordings/:id` and `/files/reports/:id` must survive — it's documented as load-bearing).
- [ ] Alternative if staying on a single VM: attach a **persistent volume** and keep `LocalStorageAdapter`. Simpler now, but doesn't scale horizontally.

## 6. Phase 3 — Mobile release configuration  _(½ day)_

- [ ] Add to `app.json` → `ios.infoPlist`: `"ITSAppUsesNonExemptEncryption": false` (app uses only standard HTTPS/exempt crypto) to skip the export-compliance prompt each submission.
- [ ] Consider `userInterfaceStyle: "automatic"` so dark mode (already built) is honored — or leave `light` deliberately; just make it a decision.
- [ ] Confirm no `localhost` leaks into a production build — the base URL comes only from `EXPO_PUBLIC_API_URL` (set per-profile in `eas.json`), and `android.usesCleartextTraffic:false` + iOS ATS will block plain-HTTP anyway once the API is HTTPS.
- [ ] Bump `version`/`buildNumber` policy: EAS can auto-increment `buildNumber`; keep `version` = marketing version.

## 7. Phase 4 — Push notifications  _(1 day; skip only if you cut push from v1)_

Server-side FCM exists but is a no-op until configured.

- [ ] Create a **Firebase project**; add an iOS app with bundle ID `com.quranreview.app`.
- [ ] Generate an **APNs Auth Key (.p8)** in the Apple Developer portal and upload it to Firebase (Cloud Messaging → Apple app config).
- [ ] `npm install firebase-admin` in the server and set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- [ ] Verify the client registers a device token and the server persists it; test a real push to a TestFlight build (push does **not** work in the simulator).
- [ ] _Option:_ if FCM is more setup than you want for v1, switch the client to Expo push tokens + the Expo push service, or ship v1 with in-app notifications only (they already persist to `/notifications`).

## 8. Phase 5 — Legal, privacy & minors  _(2–4 days; start early, it gates submission)_

This app handles **children's data** (students, likely under 18/13) plus audio recordings and academic records — Apple scrutinizes this.

- [ ] Publish a **Privacy Policy** and **Terms of Service** at public URLs (host on the GitHub Pages web build or the marketing site). Must state what's collected (name, email, audio, grades), why, retention, and deletion (link the in-app delete flow).
- [ ] Complete the **App Privacy "nutrition label"** in App Store Connect: declare Contact Info (name, email), User Content (audio recordings), and any identifiers; disclose whether data is linked to identity (it is) and used for tracking (it should not be).
- [ ] **Minors / Kids decision:** decide whether to use Apple's **Kids Category** (strict — no third-party analytics/ads, verifiable parental consent, COPPA/GDPR-K compliance) or keep it a general "Education" app that is *used by* children under institutional/parental oversight (the parent-link + admin-approval model supports this framing). Most institutional apps choose the latter; document the reasoning. Consult the relevant regulations for your target markets (COPPA in the US, GDPR-K in the EU, and local rules).
- [ ] **Content rights:** confirm licensing/public-domain provenance for any Quran text, mushaf page images, and audio you bundle or serve.
- [ ] Set the **age rating** questionnaire honestly.

## 9. Phase 6 — App Store Connect setup & metadata  _(1–2 days)_

- [ ] **Screenshots** for required device sizes: 6.7" iPhone and 6.5" iPhone are effectively required; add iPad (13"/12.9") because `supportsTablet: true`. Capture Arabic-first UI; show the illuminated-manuscript aesthetic.
- [ ] Description, keywords, subtitle, promotional text (Arabic primary; add English localization if targeting both).
- [ ] Support URL + marketing URL.
- [ ] **App Review demo account (critical):** students are gated behind admin approval and teacher/parent/admin roles differ, so reviewers cannot self-register into a usable state. Provide a **pre-approved account per role** (or at least a student with data + a teacher) in the "App Review Information" notes, plus a short walkthrough. Point the demo account at the **production** backend.
- [ ] Export compliance answers (matches the `ITSAppUsesNonExemptEncryption:false` flag).

## 10. Phase 7 — Build, TestFlight, submit  _(1–2 days + review wait)_

- [ ] Production build: `cd mobile && eas build --platform ios --profile production` (EAS manages signing certs & provisioning; let it create them).
- [ ] Submit to TestFlight: `eas submit --platform ios --profile production` (uses the IDs from Phase 0).
- [ ] **Internal + external TestFlight beta** against the production backend: exercise register→approve, booking, grading, recording upload/playback, reports, plans/ijazahs, push, biometric login, account deletion. Fix anything real-world (esp. file upload/download over HTTPS, push on device).
- [ ] Submit for **App Review**. First reviews take ~24–48h; budget for one rejection round (demo-account or privacy clarifications are the usual causes).
- [ ] Release (manual or phased) once approved.

## 11. Phase 8 — Post-launch  _(ongoing)_

- [ ] Crash/error monitoring (Sentry client + server) and uptime alerts on the API.
- [ ] EAS Update (OTA) channels are already declared (`preview`/`production`) — wire `runtimeVersion` to ship JS-only fixes without a full resubmission.
- [ ] Versioning discipline: bump `version` for store releases, auto-increment `buildNumber`.
- [ ] DB backup verification + a restore drill.

---

## 12. Rejection hotspots to pre-empt

1. **Demo account that doesn't work** against the live backend — the #1 avoidable rejection here given the approval gating. Test the exact credentials you submit.
2. **Privacy**: missing/weak policy, or an App Privacy label that under-declares audio/user content.
3. **Minors**: unclear how children's data is handled and how parents consent (lean on the existing parent-link + admin-approval model in the review notes).
4. **Broken core flow on a real device**: recording upload/playback and report/PDF download over HTTPS — verify on TestFlight, not just the simulator.
5. **Push entitlement mismatch** if APNs isn't fully wired but the app requests notification permission.
6. **Placeholder content / template leftovers** (there are `react-logo*.png` files in `assets/` — harmless but clean them up).

## 13. Rough timeline & cost

- **Cost:** Apple Developer $99/yr · backend hosting ~$20–50/mo (managed Node + Postgres + Redis + object storage) · domain ~$10–15/yr.
- **Timeline (serial):** ~**3–5 weeks** to first submission — dominated by backend deployment (Phase 1–2) and legal/privacy (Phase 5), which can run in parallel. The app-binary work (Phases 3, 6, 7) is a few days.

## 14. What's genuinely already done

Real credit: the app binary is close. Valid bundle ID + versioning, a real 1024² icon, all iOS permission strings, correctly configured native plugins, **in-app account deletion**, no forced Sign-in-with-Apple dependency, EAS profiles scaffolded, a working `Dockerfile`, and a fully E2E-tested feature set (teacher/admin/student/parent flows all green). The remaining work is overwhelmingly *deployment and store paperwork*, not app development.
