# App Review Notes — مراجعة القرآن (Quran Review)

**Bundle ID / Package:** `com.quranreview.app`
**Version:** 1.0.0
**Backend:** `https://api.<YOUR_DOMAIN>/api/v1` (production)

---

## Critical: Admin-Approval Gating (the #1 rejection risk)

Students cannot self-register into a usable state. The flow is:

1. **Admin** creates the academy, teachers, and students in the production backend.
2. **Teacher** is approved by the admin before they can grade or assign lessons.
3. **Student** account exists but is **gated** until a teacher approves them. Until approved, the student sees only an onboarding/approval-pending screen.
4. **Parent** accounts link to their child(ren) via a teacher/admin-mediated process.

Because of this, App Store and Play Store reviewers **cannot self-register and use the app**. You MUST provide demo accounts in the "App Review Information" / review notes.

---

## Demo Accounts for Reviewers

Provide one pre-approved account per role, pointing at the **production** backend:

| Role | Email | Password | What the reviewer can do |
|---|---|---|---|
| Admin | `review-admin@quranreview.app` | `SEED_REVIEW_ADMIN_PASSWORD` | Create academy, approve teachers, create students |
| Teacher | `review-teacher@quranreview.app` | `SEED_REVIEW_TEACHER_PASSWORD` | Approve students, assign lessons, grade recordings, view reports |
| Student | `review-student@quranreview.app` | `SEED_REVIEW_STUDENT_PASSWORD` | View approved lessons, submit recordings, see own progress |
| Parent | `review-parent@quranreview.app` | `SEED_REVIEW_PARENT_PASSWORD` | Link to child, view child's progress |

**Demo-account walkthrough:**
1. Sign in as the **teacher** demo account.
2. Confirm the student demo account is approved and visible in the teacher's roster.
3. Navigate to a halaqa (recitation circle), assign a surah/ayah range.
4. Sign in as the **student** demo account, record and submit a recitation.
5. Return as the **teacher**, grade the submission, add feedback.
6. Sign in as the **parent** demo account, confirm the child's progress is visible.

Passwords are set via environment variables (`SEED_REVIEW_ADMIN_PASSWORD`, etc.) when running the `seed:review` script — **never** hardcode them in the review notes.

On the production stack the script runs inside the API container, from the compiled build (`npm run seed:review` needs `ts-node`, which the production image does not ship). It runs the base seed first, so the three `SEED_*_PASSWORD` variables are required as well — the seed refuses to run in production without them:

```bash
docker compose -f deploy/docker-compose.prod.yml exec \
  -e SEED_ADMIN_PASSWORD=… -e SEED_TEACHER_PASSWORD=… -e SEED_STUDENT_PASSWORD=… \
  -e SEED_REVIEW_ADMIN_PASSWORD=… -e SEED_REVIEW_TEACHER_PASSWORD=… \
  -e SEED_REVIEW_STUDENT_PASSWORD=… -e SEED_REVIEW_PARENT_PASSWORD=… \
  api node dist/prisma/seed-review.js
```

The script prints the review passwords to the terminal when it finishes; clear the scrollback afterwards.

---

## Developer account type

The app is submitted from an **Individual** Apple Developer account. Risk: App Review guideline 5.1.1(ix) may ask for apps handling minors' data to be submitted by an organization. If Apple rejects for that reason, the fallback is to migrate the app to an Organization account later.

---

## Account Deletion (Apple 5.1.1(v))

Settings → Delete Account permanently removes the account, recordings, grades, progress, and profile data. Tested and working.

---

## No Social Sign-In (Apple 4.8)

Email/password only. No "Sign in with Apple" is required (no third-party login providers are integrated).

---

## Encryption

`ITSAppUsesNonExemptEncryption: false` — the app uses only standard HTTPS/TLS and exempt cryptography. No export compliance restrictions apply.

---

## Push Notifications

The app requests notification permission. APNs is configured via Firebase (APNs Auth Key .p8 uploaded to Firebase Cloud Messaging). Push works on real devices (TestFlight), not the simulator.

---

## Content Rights

Quran text, mushaf page images, and recitation audio are either public-domain or used under appropriate licence (see `docs/store/content-rights.md` or the Content Rights checklist in Phase 5).

---
*The developer must fill in the real demo account credentials and verify they work against the live production backend before submitting for review.*
