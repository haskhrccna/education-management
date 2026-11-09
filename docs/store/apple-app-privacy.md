# App Privacy "Nutrition Label" — مراجعة القرآن (Quran Review)

**Bundle ID:** `com.quranreview.app`
**App name:** مراجعة القرآن
**Developer:** haskhrccna

---

## Data Collected

| Data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Contact info: name, email | ✅ Yes | ✅ Yes | ❌ No | Account creation, sign-in, password reset, notifications |
| User content: audio recordings (Quran recitation) | ✅ Yes | ✅ Yes | ❌ No | Teacher review, tajweed assessment, progress tracking |
| Health & fitness: none | ❌ No | — | — | — |
| Financial info: none | ❌ No | — | — | — |
| Location: none | ❌ No | — | — | — |
| Search history: none | ❌ No | — | — | — |
| Browsing history: none | ❌ No | — | — | — |
| Identifiers: device ID, push token | ✅ Yes | ✅ Yes | ❌ No | Push notifications, device management |
| Usage data: app interactions, feature usage | ✅ Yes | ✅ Yes | ❌ No | App improvement, analytics (internal only) |
| Diagnostics: crash logs, performance | ✅ Yes | ❌ No | ❌ No | App stability |
| Other user content: grades, progress, ijazah scores | ✅ Yes | ✅ Yes | ❌ No | Progress tracking, report generation |

---

## Data Not Collected

- No precise location
- No contacts
- No browsing history
- No purchase history
- No financial info
- No health data (beyond biometric authentication stored locally on device)

---

## Children's Data

The app serves students including minors (under 13). Children's data is processed under guardian/teacher oversight. The app does **not** use Apple's Kids Category; it is a general Education app used by children under institutional/parental oversight (parent-link + admin-approval model).

No third-party analytics or advertising SDKs are integrated. Data is not shared with third parties for marketing.

---

## Account Deletion

Users can permanently delete their account and all associated data from within the app (Settings → Delete Account). Deletion removes recordings, grades, progress, and profile data.

---

## Data Security

- Encryption at rest and in transit
- Audio recordings stored in a private object bucket, served only through auth-checked signed URLs
- JWT session tokens with expiration and refresh
- Biometric templates (Face ID / fingerprint) stored locally on the device only — never uploaded

---

## App Store Connect Answers

**Does your app collect user data?** Yes
**Is all data linked to the user's identity?** Yes (contact info, recordings, grades are linked to the account)
**Is any data used for tracking?** No
**Is the app designed primarily for children under 13?** No — it is a general Education app used by children under guardian/teacher oversight
**Does the app use the Kids Category?** No

---
*Draft for App Store Connect "App Privacy" section. The developer must paste these answers into App Store Connect before submission.*
