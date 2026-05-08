# Bundle B: Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three confirmed security gaps — recording review missing role check, no password reset flow, grade/recording mutations not in audit log.

**Architecture:** Backend-only fixes except for one new mobile screen (forgot-password). No new DB models, only two new User fields.

**Tech Stack:** Express, Prisma 6, bcrypt, Node crypto, Zod, Expo Router.

---

## Task 1: Fix Recording Review Authorization (CRITICAL)

**Files:**
- Modify: `packages/server/src/routes/recording.routes.ts`

- [ ] **Step 1: Read the recording routes file**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/packages/server/src/routes/recording.routes.ts
```

Find the route that calls `reviewRecording`. Note whether `authorize` and `UserRole` are already imported.

- [ ] **Step 2: Add authorize middleware to the review route**

The review route currently looks something like:
```typescript
router.put('/:id/review', authenticate, recordingController.reviewRecording);
```

Change it to:
```typescript
router.put('/:id/review', authenticate, authorize(UserRole.TEACHER, UserRole.ADMIN), recordingController.reviewRecording);
```

Import `authorize` and `UserRole` if not already present — follow the pattern from `appointment.routes.ts` or any other routes file that uses `authorize`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/recording.routes.ts
git commit -m "fix(security): restrict recording review to TEACHER and ADMIN roles"
```

---

## Task 2: Password Reset — Schema + Validators

**Files:**
- Modify: `packages/server/prisma/schema.prisma`
- Create or modify: `packages/shared/src/validators/auth.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add reset token fields to User model in schema.prisma**

Find the User model. Add these two optional fields after the existing `refreshTokenHash` field:

```prisma
  passwordResetToken  String?
  passwordResetExpiry DateTime?
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server && npx prisma migrate dev --name add_password_reset_fields 2>&1 | tail -15
```

Expected: migration created and applied, "Your database is now in sync with your schema."

- [ ] **Step 3: Check if shared validators/auth.ts already exists**

```bash
ls /Users/haskhr/Documents/opencode/education_management/packages/shared/src/validators/
```

- [ ] **Step 4: Add ForgotPasswordSchema and ResetPasswordSchema**

If `auth.ts` exists in that directory, add to it. If not, create it:

```typescript
import { z } from 'zod';

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});
```

- [ ] **Step 5: Ensure re-export from shared index**

Check `packages/shared/src/index.ts`. If a new `auth.ts` was created, add:
```typescript
export * from './validators/auth';
```

If the file already existed, verify the new exports are reachable.

- [ ] **Step 6: Verify shared TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/shared && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add packages/server/prisma/schema.prisma packages/server/prisma/migrations/ packages/shared/src/validators/ packages/shared/src/index.ts
git commit -m "feat(security): add password reset fields to User and shared validators"
```

---

## Task 3: Password Reset — Service Logic

**Files:**
- Modify: `packages/server/src/services/auth.service.ts`

- [ ] **Step 1: Read the current auth service**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/packages/server/src/services/auth.service.ts
```

Note: how `prisma` is imported, how `AppError` is used, how bcrypt is imported (top-level import vs require), what bcrypt rounds are used, how crypto is used for the refresh token (follow same pattern).

- [ ] **Step 2: Add forgotPassword function**

Add after the existing exported functions:

```typescript
export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    select: { id: true },
  });

  if (!user) return { token: null };

  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiry = new Date(Date.now() + 3_600_000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: hash, passwordResetExpiry: expiry },
  });

  return { token };
};
```

If `crypto` is not already imported at the top of the file, add `import crypto from 'crypto';`.

- [ ] **Step 3: Add resetPassword function**

```typescript
export const resetPassword = async (token: string, newPassword: string) => {
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hash,
      passwordResetExpiry: { gt: new Date() },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!user) throw new AppError(400, 'Invalid or expired reset token');

  // Use same bcrypt import pattern and rounds already in this file
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
      refreshTokenHash: null,
    },
  });

  return { message: 'Password reset successfully' };
};
```

Adjust the bcrypt import reference and rounds number to match what is already in the file.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server && npx tsc --noEmit 2>&1 | head -20
```

Fix any errors before committing.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/auth.service.ts
git commit -m "feat(security): add forgotPassword and resetPassword service functions"
```

---

## Task 4: Password Reset — Controller + Routes

**Files:**
- Modify: `packages/server/src/controllers/auth.controller.ts`
- Modify: `packages/server/src/routes/auth.routes.ts`

- [ ] **Step 1: Read auth.controller.ts to match the handler pattern**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/packages/server/src/controllers/auth.controller.ts
```

Note the try/catch/next pattern and how `authService` functions are called.

- [ ] **Step 2: Add two handlers to auth.controller.ts**

```typescript
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json({
      message: 'If that email is registered, a reset token was generated',
      token: result.token,
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 3: Read auth.routes.ts**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/packages/server/src/routes/auth.routes.ts
```

Note: how schemas are imported from `@quran-review/shared`, how `validate` is applied.

- [ ] **Step 4: Add two public routes to auth.routes.ts**

Add imports for the new schemas and controller functions, then the routes (no `authenticate` — these are public):

```typescript
// Add to imports:
import { ForgotPasswordSchema, ResetPasswordSchema } from '@quran-review/shared';
// Add to controller imports:
// forgotPassword, resetPassword

// Add routes:
router.post('/forgot-password', validate(ForgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(ResetPasswordSchema), authController.resetPassword);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/controllers/auth.controller.ts packages/server/src/routes/auth.routes.ts
git commit -m "feat(security): add forgot-password and reset-password endpoints"
```

---

## Task 5: Audit Logging for Grade + Recording Mutations

**Files:**
- Modify: `packages/server/src/controllers/grade.controller.ts`
- Modify: `packages/server/src/controllers/recording.controller.ts`

- [ ] **Step 1: Read the audit helper signature**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/packages/server/src/lib/audit.ts
```

Note the exact function name, parameter shape, and what `action` strings look like.

- [ ] **Step 2: Read how admin.controller.ts uses the audit function**

```bash
grep -n "audit\|auditLog\|createAudit" /Users/haskhr/Documents/opencode/education_management/packages/server/src/controllers/admin.controller.ts | head -10
```

Note the import line and call pattern exactly.

- [ ] **Step 3: Read grade.controller.ts**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/packages/server/src/controllers/grade.controller.ts
```

Identify all mutation handlers (createGrade, and any updateGrade/deleteGrade if they exist).

- [ ] **Step 4: Add audit log calls to grade.controller.ts**

Import the audit function (same import as admin.controller.ts). After each successful mutation service call, add:

For `createGrade`:
```typescript
await auditLog({
  userId: req.userId!,
  action: 'CREATE_GRADE',
  metadata: { studentId: req.body.studentId, subject: req.body.subject, type: req.body.type },
});
```

For `updateGrade` (if it exists):
```typescript
await auditLog({ userId: req.userId!, action: 'UPDATE_GRADE', metadata: { gradeId: req.params.id } });
```

For `deleteGrade` (if it exists):
```typescript
await auditLog({ userId: req.userId!, action: 'DELETE_GRADE', metadata: { gradeId: req.params.id } });
```

Adapt the `metadata` shape and `auditLog` call signature to exactly match what `audit.ts` expects.

- [ ] **Step 5: Read recording.controller.ts**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/packages/server/src/controllers/recording.controller.ts
```

Find `reviewRecording` and `deleteRecording` handlers.

- [ ] **Step 6: Add audit log calls to recording.controller.ts**

After `reviewRecording` service call succeeds:
```typescript
await auditLog({ userId: req.userId!, action: 'REVIEW_RECORDING', metadata: { recordingId: req.params.id } });
```

After `deleteRecording` service call succeeds:
```typescript
await auditLog({ userId: req.userId!, action: 'DELETE_RECORDING', metadata: { recordingId: req.params.id } });
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/controllers/grade.controller.ts packages/server/src/controllers/recording.controller.ts
git commit -m "feat(security): add audit logging for grade and recording mutations"
```

---

## Task 6: Mobile — i18n Keys + Forgot Password Screen + Login Link

**Files:**
- Modify: `mobile/src/i18n/index.ts`
- Create: `mobile/app/forgot-password.tsx`
- Modify: `mobile/app/index.tsx`

- [ ] **Step 1: Add 5 i18n keys**

Add to `arTranslations`:
```typescript
forgotPassword: 'نسيت كلمة المرور؟',
enterYourEmail: 'أدخل بريدك الإلكتروني',
resetTokenGenerated: 'تم إنشاء رمز إعادة التعيين',
shareTokenWithUser: 'شارك هذا الرمز مع المستخدم',
resetLinkSent: 'إذا كان البريد مسجلاً، فقد تم إنشاء رمز',
```

Add to `enTranslations`:
```typescript
forgotPassword: 'Forgot Password?',
enterYourEmail: 'Enter your email',
resetTokenGenerated: 'Reset token generated',
shareTokenWithUser: 'Share this token with the user',
resetLinkSent: 'If that email is registered, a reset token was generated',
```

- [ ] **Step 2: Read mobile/constants/theme.ts to confirm COLORS/SPACING/RADIUS fields**

```bash
grep -n "textPrimary\|textSecondary\|surface\|primary\|background\|SPACING\|RADIUS" /Users/haskhr/Documents/opencode/education_management/mobile/constants/theme.ts | head -20
```

- [ ] **Step 3: Create mobile/app/forgot-password.tsx**

```typescript
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { apiClient } from '@/src/api/client';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setResetToken(res.data.token ?? null);
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    backBtn: { marginRight: SPACING.sm, padding: 4 },
    backText: { fontSize: 20, color: COLORS.primary },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    body: { padding: SPACING.md, gap: SPACING.md },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
    input: {
      backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
      padding: SPACING.sm, color: COLORS.textPrimary, fontSize: 15,
      borderWidth: 1, borderColor: '#e5e7eb',
    },
    btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    errorText: { color: '#ef4444', fontSize: 13 },
    successCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md },
    successTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
    successDesc: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.sm },
    tokenBox: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: '#e5e7eb' },
    tokenText: { fontSize: 12, color: COLORS.textPrimary },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('forgotPassword')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {submitted ? (
          <View style={styles.successCard}>
            {resetToken ? (
              <>
                <Text style={styles.successTitle}>🔑 {t('resetTokenGenerated')}</Text>
                <Text style={styles.successDesc}>{t('shareTokenWithUser')}</Text>
                <View style={styles.tokenBox}>
                  <Text style={styles.tokenText} selectable>{resetToken}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.successTitle}>✓ {t('resetLinkSent')}</Text>
            )}
          </View>
        ) : (
          <>
            <View>
              <Text style={styles.label}>{t('enterYourEmail')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[styles.btn, { opacity: email.trim() && !isLoading ? 1 : 0.5 }]}
              onPress={handleSubmit}
              disabled={!email.trim() || isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('forgotPassword')}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

Adapt any COLORS/RADIUS fields that don't exist to what does (from Step 2).

- [ ] **Step 4: Add "Forgot Password?" link to login screen**

Read `mobile/app/index.tsx`:
```bash
grep -n "TouchableOpacity\|submit\|button\|login\|router\|SPACING\|COLORS" /Users/haskhr/Documents/opencode/education_management/mobile/app/index.tsx | head -30
```

Find the login submit button. Directly below it, add:
```tsx
<TouchableOpacity
  style={{ marginTop: SPACING.sm, alignItems: 'center' }}
  onPress={() => router.push('/forgot-password')}
>
  <Text style={{ fontSize: 13, color: COLORS.primary }}>{t('forgotPassword')}</Text>
</TouchableOpacity>
```

Use whatever SPACING/COLORS variable names are already used in the file.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

Fix any errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/i18n/index.ts mobile/app/forgot-password.tsx mobile/app/index.tsx
git commit -m "feat(security): add forgot password screen and login link"
```

---

## Self-Review Checklist

After all tasks complete, verify:

1. **Spec coverage:**
   - [ ] Recording review route has `authorize(TEACHER, ADMIN)` — students would get 403
   - [ ] `passwordResetToken` and `passwordResetExpiry` fields in User model, migration applied
   - [ ] `ForgotPasswordSchema` and `ResetPasswordSchema` in shared validators, re-exported
   - [ ] `POST /auth/forgot-password` returns token when email found, null when not
   - [ ] `POST /auth/reset-password` updates password, clears token and refreshTokenHash
   - [ ] Grade mutations (`createGrade`, plus any update/delete) have audit log calls
   - [ ] Recording `reviewRecording` and `deleteRecording` have audit log calls
   - [ ] `forgot-password.tsx` shows selectable token when returned, generic message when null
   - [ ] Login screen has "Forgot Password?" link navigating to `/forgot-password`
   - [ ] 5 i18n keys in AR + EN
