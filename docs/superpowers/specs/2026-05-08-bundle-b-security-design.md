# Bundle B: Security Hardening — Design Spec
**Date:** 2026-05-08
**Scope:** Backend only (plus one new mobile screen). Three security gaps identified in audit.

---

## Goal

Close three confirmed security gaps: a missing role check on the recording review endpoint, no password self-recovery flow, and grade/recording mutations missing from the audit trail.

Soft-delete (users) and JWT refresh token rotation are already correctly implemented — no work needed there.

---

## Fix 1 — Recording Review: Missing Role Check (CRITICAL)

**File:** `packages/server/src/routes/recording.routes.ts`

**Problem:** The `reviewRecording` handler does not verify the caller is a TEACHER or ADMIN. Any authenticated user (including students) can call this endpoint and mark recordings as reviewed.

**Fix:** Add `authorize(UserRole.TEACHER, UserRole.ADMIN)` to the review route. Read the current recording routes file to find the exact route definition and insert the middleware. No service-layer changes needed.

---

## Fix 2 — Password Reset Flow

**Problem:** Users who forget their password have no self-service recovery path. An admin must manually update their account.

**Design:** Token-based reset. The server generates a cryptographically secure reset token, stores its SHA-256 hash in the DB with a 1-hour TTL. The token is returned in the API response (since no email infrastructure is configured — acceptable for a school app where the admin relays the token, and easily upgradeable to email later).

### Backend Changes

**Schema addition (`packages/server/prisma/schema.prisma`):**

Add two optional fields to the User model:
```prisma
  passwordResetToken  String?
  passwordResetExpiry DateTime?
```

**New validators (`packages/shared/src/validators/`):**

Check if `auth.ts` exists in that directory. If yes, add to it; if no, create it:

```typescript
export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});
```

Re-export from `packages/shared/src/index.ts` if a new file is created.

**New endpoints (add to `packages/server/src/routes/auth.routes.ts`):**

```
POST /api/v1/auth/forgot-password   — public (no auth required)
POST /api/v1/auth/reset-password    — public (no auth required)
```

**Service logic (`packages/server/src/services/auth.service.ts`):**

`forgotPassword(email: string)`:
1. Find user by email (case-insensitive). If not found — return `{ token: null }` silently.
2. Generate token: `crypto.randomBytes(32).toString('hex')`
3. Compute hash: `crypto.createHash('sha256').update(token).digest('hex')`
4. Store `passwordResetToken = hash`, `passwordResetExpiry = new Date(Date.now() + 3600_000)` (1 hour)
5. Return the plaintext token (for admin relay)

`resetPassword(token: string, newPassword: string)`:
1. Compute hash of provided token
2. Find user where `passwordResetToken = hash` AND `passwordResetExpiry > now`
3. If not found → throw `AppError(400, 'Invalid or expired reset token')`
4. Hash new password with bcrypt (same rounds as existing login)
5. Update user: `password = newHash`, `passwordResetToken = null`, `passwordResetExpiry = null`, `refreshTokenHash = null` (force re-login)

**Controller + routes** follow the existing pattern from `auth.controller.ts`.

### Mobile Changes

**New screen: `mobile/app/forgot-password.tsx`**

- Header: back arrow + title `t('forgotPassword')`
- Email `TextInput`
- Submit button → calls `POST /auth/forgot-password`
- On success: if token returned, show it in a copiable `Text` block with `t('shareTokenWithUser')` instruction; if no token (email not found), show `t('resetLinkSent')` (generic — don't leak existence)
- Admin can copy the token and relay it to the user

**Modify: `mobile/app/index.tsx` (login screen)**

Add a "Forgot Password?" `TouchableOpacity` below the login button, navigating to `/forgot-password`.

**No Reset Password screen needed on mobile** — the admin-relay flow means the admin uses the token via a direct API call or the admin panel. Keeps scope minimal.

**i18n keys:**

| Key | Arabic | English |
|-----|--------|---------|
| `forgotPassword` | `نسيت كلمة المرور؟` | `Forgot Password?` |
| `enterYourEmail` | `أدخل بريدك الإلكتروني` | `Enter your email` |
| `resetTokenGenerated` | `تم إنشاء رمز إعادة التعيين` | `Reset token generated` |
| `shareTokenWithUser` | `شارك هذا الرمز مع المستخدم` | `Share this token with the user` |
| `resetLinkSent` | `إذا كان البريد مسجلاً، فقد تم إنشاء رمز` | `If that email is registered, a reset token was generated` |

---

## Fix 3 — Audit Logging for Grade + Recording Mutations

**Problem:** Grade create and recording review/delete are not logged. Admin audit trail is incomplete.

**Files:**
- `packages/server/src/controllers/grade.controller.ts`
- `packages/server/src/controllers/recording.controller.ts`

**Action:** Add `auditLog(...)` calls after successful mutations. Read `packages/server/src/lib/audit.ts` first to get the exact function signature. Follow the existing pattern from `admin.controller.ts` exactly.

### Grade Actions to Log

In `grade.controller.ts`, after the service call succeeds in each handler:
- `createGrade` → log action `'CREATE_GRADE'` with metadata `{ studentId, subject, type }`
- `updateGrade` (if endpoint exists) → log `'UPDATE_GRADE'` with `{ gradeId }`
- `deleteGrade` (if endpoint exists) → log `'DELETE_GRADE'` with `{ gradeId }`

### Recording Actions to Log

In `recording.controller.ts`:
- `reviewRecording` → log `'REVIEW_RECORDING'` with `{ recordingId }`
- `deleteRecording` → log `'DELETE_RECORDING'` with `{ recordingId }`

---

## Files Changed

| File | Action |
|------|--------|
| `packages/server/src/routes/recording.routes.ts` | Add `authorize(TEACHER, ADMIN)` to review route |
| `packages/server/prisma/schema.prisma` | Add `passwordResetToken?`, `passwordResetExpiry?` to User |
| `packages/server/prisma/migrations/` | Auto-generated |
| `packages/shared/src/validators/auth.ts` | Add `ForgotPasswordSchema`, `ResetPasswordSchema` (create if not exists) |
| `packages/shared/src/index.ts` | Re-export if new file |
| `packages/server/src/services/auth.service.ts` | Add `forgotPassword`, `resetPassword` |
| `packages/server/src/controllers/auth.controller.ts` | Add handlers for two new routes |
| `packages/server/src/routes/auth.routes.ts` | Add two public routes |
| `packages/server/src/controllers/grade.controller.ts` | Add audit log calls to mutations |
| `packages/server/src/controllers/recording.controller.ts` | Add audit log calls + role fix |
| `mobile/app/forgot-password.tsx` | **New** — forgot password screen |
| `mobile/app/index.tsx` | Add "Forgot Password?" link |
| `mobile/src/i18n/index.ts` | Add 5 new keys |

---

## Error Handling

- `POST /forgot-password` with unknown email: return `200 { message: '...', token: null }` — never 404
- `POST /reset-password` with expired/invalid token: return `400 'Invalid or expired reset token'`
- `POST /reset-password` with weak password: Zod validation → 400 before service call

---

## Testing

1. `POST /api/v1/auth/forgot-password` with `admin@education.com` → 200, token in response
2. `POST /api/v1/auth/reset-password` with that token + new password → 200; login with new password → works; same token again → 400
3. `PUT /api/v1/recordings/:id/review` as student → 403 (was previously allowed)
4. Create grade as teacher → check `audit_log` table has `CREATE_GRADE` row
5. Review recording as teacher → check `audit_log` has `REVIEW_RECORDING` row
