# i18n Integrity — Design Spec

**Date:** 2026-07-28
**Scope:** Mobile string layer (`mobile/app/**`, `mobile/src/**`, `mobile/src/i18n/index.ts`, `mobile/scripts/check-i18n.js`), plus one server-side item called out separately.
**Status:** Recorded from a live device walkthrough. Deliberately **not** folded into F10 — see "Relationship to F10".

---

## Goal

Make the Arabic string layer verifiable. Today a large share of user-facing text bypasses `i18next` entirely, which means the CI i18n gate cannot see it, translations cannot be pluralised, and duplicate Arabic labels reach production. This spec covers closing that gap; it does not cover visual or layout work.

## Evidence (all reproduced on device, 2026-07-28)

Logged into the running iOS build as the seeded admin and teacher and walked the admin, teacher, messages, and notification screens.

| Defect | Location | What the user sees |
|---|---|---|
| Two different cards share one Arabic title | `app/teacher/home.tsx:224` (`'Reviews'` → `/teacher/recordings`) and `:240` (`'Revisions'` → `/teacher/revisions`) — both `'المراجعات'` in Arabic | Two identically-titled cards on teacher home leading to different screens |
| No plural forms anywhere | `app/teacher/home.tsx:377`, `app/admin/home.tsx:203`, teacher onboarding | **"1 طلاب"** — plural noun with a count of 1 |
| Singular/plural collapsed onto one string | `'آية'` used for both `"Ayah"` and `"ayahs"` | Ayah counts read wrong at every count |
| Tab labelled differently per language | `src/components/BottomNav.tsx` `ADMIN_TABS`: `labelAr: 'إشعارات'` (Notifications) vs `labelEn: 'Broadcast'` | Arabic admins tap "Notifications" and get the broadcast composer |

### Root cause

Two parallel string mechanisms exist. Measured counts:

| Mechanism | Count |
|---|---|
| `t('key')` — visible to the gate | 587 call sites, 321 distinct keys |
| Inline `isAr ? 'عربي' : 'English'` ternaries — invisible to the gate | **260**, across 15 files |

`scripts/check-i18n.js` matched only `/[^A-Za-z.]t\(\s*'([A-Za-z][A-Za-z0-9_]*)'/` and asserted those keys exist in both `arTranslations` and `enTranslations`. It was structurally blind to all 260 inline ternaries, so it reported **OK** while roughly a third of user-facing strings went unchecked — and every defect above lives in that unchecked third.

Inline ternaries also make pluralisation impossible in principle: there is no `count` to switch on, and `src/i18n/index.ts` contains **zero** `_zero`/`_one`/`_two`/`_few`/`_many`/`_other` forms. Arabic uses all six CLDR categories, so a bare plural noun is wrong at counts of 1 and 2 and again from 11 upward.

## Work

### 1. Gate hardening — **done 2026-07-28**

`scripts/check-i18n.js` now additionally counts inline ternaries and detects Arabic strings mapped to more than one English string, ratcheted against recorded baselines (`TERNARY_BASELINE = 260`, `COLLISION_BASELINE = 5`). It fails when either rises, prints the ambiguous labels either way, and keeps the original missing-key check unchanged.

Baselines are a debt ledger: **lower them as strings migrate, never raise them.** Verified both directions — passes at current baseline, and fails with an actionable message when either is exceeded.

The five ambiguous labels it currently reports:

| Arabic | English variants | Verdict |
|---|---|---|
| `المراجعات` | "Revisions" / "Reviews" | **Real bug** — duplicate card titles, fix in F10-adjacent teacher work |
| `آية` | "Ayah" / "ayahs" | **Real bug** — missing plural form |
| `خطط الحفظ` | "Plans" / "Curriculum plans" | Benign; unify the English |
| `طلب تغيير المعلم` | "Request a teacher change" / "Request teacher change" | Benign; unify the English |
| `احجز موعدك القادم` | "Book your next session" / "Book your next appointment" | Benign; unify the English |

### 2. Add plural support

Introduce i18next plural keys for every count-bearing noun (students, ayahs, pages, sessions, recordings, requests). Arabic needs all six categories; English needs `_one`/`_other`. Every call site rendering "<number> <noun>" must pass `{ count }` rather than concatenating.

Acceptance: a student count of 1, 2, 3, and 11 each render grammatically correct Arabic.

### 3. Migrate inline ternaries to `t()`

Move the 260 inline ternaries into `src/i18n/index.ts`, deduplicating as they go, and lower both baselines to zero. Best done per screen cluster rather than as one sweep, so each migration is reviewable against the screen it affects.

Fix the two real collisions as part of this: give the recordings card its own key (its subtitle and mic icon say "التسجيلات", not "المراجعات"), and split `'آية'` into singular/plural forms.

### 4. Correct `BottomNav` `labelAr`

Already captured in the F10 admin spec; listed here so the i18n picture is complete.

### 5. Localise server-generated notification text — **server-side, needs its own decision**

`packages/server/src/services/notification.service.ts` builds notification `title`/`body` as English template literals (e.g. ``title: `New message from ${message.sender?.firstName}` ``). The Arabic notification centre renders them verbatim — observed as "New message from Ahmad" / "Received" inside an otherwise fully-Arabic screen.

This is **not** a mobile string-layer fix and should not be bundled with items 2–3. It requires choosing where localisation happens:

- **Store a key + params** on `Notification.data` and translate at render time on the client. Keeps all copy in one place and follows the device locale, but changes the notification payload contract and leaves FCM push text (composed server-side, rendered by the OS while the app is closed) still needing a server-side answer.
- **Translate server-side** against a stored user locale. Fixes in-app and push together, but puts a second copy of the string catalogue on the server and requires persisting a locale per user, which no column currently holds.

Recommendation: decide this alongside whatever push-notification work comes next, since both options hinge on the push path.

## Relationship to F10

All three F10 specs list "i18n completeness" under the AC5.5 gate. Before the hardening in item 1, that gate could not detect the class of defect actually present, so an F10 cluster could have passed it while shipping duplicate Arabic labels. Item 1 closes that hole and is already in place.

Items 2, 3, and 5 are **out of F10 scope**. Folding a 260-string migration plus a server-side localisation decision into a UX-polish cluster would balloon it well past its one-day estimate. F10 clusters should fix only the strings in the screens they touch, and lower the baselines accordingly.

## Out of Scope

- Adding new languages. This is about the correctness of the existing `ar`/`en` pair.
- RTL layout and bidi rendering (for example the `0Sarah Khalil` teacher-load row) — that is layout, tracked in the F10 admin spec.
- Numeral-system consistency (Arabic-Indic `١٤٤٨` on Academy Health vs Western `1` on metric tiles). Worth deciding, but it is a formatting policy question, not a string-integrity one.

## Testing

1. `npm run check-i18n --workspace=mobile` passes at the recorded baselines and prints the ambiguous-label report.
2. Adding one new inline `isAr ? 'x' : 'y'` ternary fails the gate with the ratchet message. (Verified 2026-07-28 by lowering the baseline against a copy.)
3. Introducing a new Arabic string that maps to a second English string fails the collision check.
4. After item 2: student counts of 1, 2, 3, and 11 render grammatically correct Arabic on teacher home and admin home.
5. After item 3: both baselines are zero and the gate still passes.
