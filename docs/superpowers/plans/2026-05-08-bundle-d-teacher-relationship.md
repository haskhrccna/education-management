# Bundle D: Teacher Relationship Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students see their assigned teacher and request a change; admins process requests; teachers see pending change requests from their students.

**Architecture:** New `TeacherChangeRequest` Prisma model + 3 backend endpoints + shared Zod validators + mobile API layer + hook + 2 new screens + updates to 3 existing screens + 12 i18n keys.

**Tech Stack:** Prisma 6, Express, Zod (shared validators), Expo Router, react-i18next, existing `useAppointments` hook pattern.

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `packages/server/prisma/schema.prisma`
- Auto-generated: `packages/server/prisma/migrations/`

- [ ] **Step 1: Add TeacherChangeStatus enum to schema.prisma**

Open `packages/server/prisma/schema.prisma`. Find the existing enums section (near the top, where `AppointmentStatus` is defined). Add after it:

```prisma
enum TeacherChangeStatus {
  PENDING
  APPROVED
  DENIED
}
```

- [ ] **Step 2: Add TeacherChangeRequest model to schema.prisma**

At the end of the file (after the last model), add:

```prisma
model TeacherChangeRequest {
  id               String              @id @default(cuid())
  studentId        String
  currentTeacherId String
  reason           String
  status           TeacherChangeStatus @default(PENDING)
  adminNote        String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  student        User @relation("StudentChangeRequests", fields: [studentId], references: [id], onDelete: Cascade)
  currentTeacher User @relation("TeacherChangeRequests", fields: [currentTeacherId], references: [id], onDelete: Cascade)

  @@index([studentId])
  @@index([currentTeacherId])
  @@index([status])
}
```

- [ ] **Step 3: Add relation fields to the User model**

In the `User` model, find the block of relation fields. Add two new lines:

```prisma
  teacherChangeRequestsAsStudent  TeacherChangeRequest[] @relation("StudentChangeRequests")
  teacherChangeRequestsAsTeacher  TeacherChangeRequest[] @relation("TeacherChangeRequests")
```

- [ ] **Step 4: Run prisma generate to validate the schema**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server && npx prisma generate 2>&1 | tail -10
```

Expected: "Generated Prisma Client" — no errors.

- [ ] **Step 5: Create and apply the migration**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server && npx prisma migrate dev --name teacher_change_request 2>&1 | tail -20
```

Expected: migration file created and applied, "Your database is now in sync with your schema."

- [ ] **Step 6: Commit**

```bash
git add packages/server/prisma/schema.prisma packages/server/prisma/migrations/
git commit -m "feat(db): add TeacherChangeRequest model and migration"
```

---

## Task 2: Shared Validators

**Files:**
- Create: `packages/shared/src/validators/teacherChange.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Read the shared package index to understand re-export pattern**

```bash
grep -n "export\|validator\|Schema" /Users/haskhr/Documents/opencode/education_management/packages/shared/src/index.ts | head -20
```

- [ ] **Step 2: Create teacherChange.ts validator file**

```typescript
import { z } from 'zod';

export const SubmitTeacherChangeSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

export const DecideTeacherChangeSchema = z.object({
  action: z.enum(['APPROVE', 'DENY']),
  adminNote: z.string().max(500).optional(),
});
```

- [ ] **Step 3: Re-export from shared index**

In `packages/shared/src/index.ts`, add following the existing export pattern:

```typescript
export * from './validators/teacherChange';
```

- [ ] **Step 4: Verify TypeScript compiles in shared package**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/shared && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/validators/teacherChange.ts packages/shared/src/index.ts
git commit -m "feat(shared): add TeacherChange Zod validators"
```

---

## Task 3: Backend Service

**Files:**
- Create: `packages/server/src/services/teacherChange.service.ts`

- [ ] **Step 1: Read appointment.service.ts to match patterns**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/packages/server/src/services/appointment.service.ts
```

Note: how `prisma` is imported, how `AppError` is used, how role strings are compared.

- [ ] **Step 2: Create teacherChange.service.ts**

```typescript
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export const submitTeacherChangeRequest = async (studentId: string, reason: string) => {
  const appointment = await prisma.appointment.findFirst({
    where: { studentId, status: 'ACCEPTED' },
    select: { teacherId: true },
  });
  if (!appointment) throw new AppError(400, 'You have no assigned teacher');

  const existing = await prisma.teacherChangeRequest.findFirst({
    where: { studentId, status: 'PENDING' },
    select: { id: true },
  });
  if (existing) throw new AppError(409, 'You already have a pending request');

  return await prisma.teacherChangeRequest.create({
    data: {
      studentId,
      currentTeacherId: appointment.teacherId,
      reason,
      status: 'PENDING',
    },
    include: {
      currentTeacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};

export const getTeacherChangeRequests = async (userId: string, userRole: string, statusFilter?: string) => {
  if (userRole === 'STUDENT') {
    return await prisma.teacherChangeRequest.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        currentTeacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  if (userRole === 'TEACHER') {
    return await prisma.teacherChangeRequest.findMany({
      where: { currentTeacherId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  // ADMIN: all requests, optional status filter
  const where = statusFilter ? { status: statusFilter as 'PENDING' | 'APPROVED' | 'DENIED' } : {};
  return await prisma.teacherChangeRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      currentTeacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};

export const decideTeacherChangeRequest = async (
  id: string,
  action: 'APPROVE' | 'DENY',
  adminNote?: string
) => {
  const request = await prisma.teacherChangeRequest.findUnique({ where: { id } });
  if (!request) throw new AppError(404, 'Request not found');
  if (request.status !== 'PENDING') throw new AppError(409, 'Request already decided');

  return await prisma.teacherChangeRequest.update({
    where: { id },
    data: {
      status: action === 'APPROVE' ? 'APPROVED' : 'DENIED',
      adminNote: adminNote ?? null,
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      currentTeacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/services/teacherChange.service.ts
git commit -m "feat(server): add TeacherChange service"
```

---

## Task 4: Backend Controller + Routes + App Mount

**Files:**
- Create: `packages/server/src/controllers/teacherChange.controller.ts`
- Create: `packages/server/src/routes/teacherChange.routes.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Read appointment.controller.ts to match patterns**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/packages/server/src/controllers/appointment.controller.ts
```

Note: how `req.userId`, `req.userRole`, `next` are used.

- [ ] **Step 2: Create teacherChange.controller.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import * as teacherChangeService from '../services/teacherChange.service';

export const submitRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await teacherChangeService.submitTeacherChangeRequest(req.userId!, req.body.reason);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const getRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
    const result = await teacherChangeService.getTeacherChangeRequests(req.userId!, req.userRole!, statusFilter);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const decideRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { action, adminNote } = req.body;
    const result = await teacherChangeService.decideTeacherChangeRequest(req.params.id, action, adminNote);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 3: Create teacherChange.routes.ts**

```typescript
import { Router } from 'express';
import * as teacherChangeController from '../controllers/teacherChange.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '@quran-review/shared';
import { SubmitTeacherChangeSchema, DecideTeacherChangeSchema } from '@quran-review/shared';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(UserRole.STUDENT),
  validate(SubmitTeacherChangeSchema),
  teacherChangeController.submitRequest
);

router.get('/', teacherChangeController.getRequests);

router.patch(
  '/:id',
  authorize(UserRole.ADMIN),
  validate(DecideTeacherChangeSchema),
  teacherChangeController.decideRequest
);

export default router;
```

- [ ] **Step 4: Mount route in app.ts**

Read `packages/server/src/app.ts` to find where routes are mounted. Add import and mount:

```typescript
import teacherChangeRoutes from './routes/teacherChange.routes';
// in the routes section:
app.use('/api/v1/teacher-changes', teacherChangeRoutes);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/packages/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/controllers/teacherChange.controller.ts packages/server/src/routes/teacherChange.routes.ts packages/server/src/app.ts
git commit -m "feat(server): add TeacherChange controller, routes, and app mount"
```

---

## Task 5: i18n Keys

**Files:**
- Modify: `mobile/src/i18n/index.ts`

- [ ] **Step 1: Add 12 keys to arTranslations**

Find `const arTranslations = {` and add:

```typescript
yourTeacher: 'معلمك',
noTeacherAssigned: 'لم يُعيّن لك معلم بعد',
requestTeacherChange: 'طلب تغيير المعلم',
changeReason: 'سبب الطلب',
changeReasonPlaceholder: 'اشرح سبب رغبتك في تغيير المعلم...',
requestSubmitted: 'تم إرسال طلبك بنجاح',
pendingRequest: 'طلب قيد المراجعة',
requestApproved: 'تمت الموافقة على طلبك',
requestDenied: 'تم رفض طلبك',
teacherChangeRequests: 'طلبات تغيير المعلم',
noChangeRequests: 'لا توجد طلبات تغيير',
studentsPendingChange: 'طالب طلب تغيير المعلم',
```

- [ ] **Step 2: Add same 12 keys to enTranslations**

```typescript
yourTeacher: 'Your Teacher',
noTeacherAssigned: 'No teacher assigned yet',
requestTeacherChange: 'Request Teacher Change',
changeReason: 'Reason for Change',
changeReasonPlaceholder: 'Explain why you want a teacher change...',
requestSubmitted: 'Request submitted successfully',
pendingRequest: 'Request Pending Review',
requestApproved: 'Your request was approved',
requestDenied: 'Your request was denied',
teacherChangeRequests: 'Teacher Change Requests',
noChangeRequests: 'No change requests',
studentsPendingChange: 'student(s) requested a change',
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/i18n/index.ts
git commit -m "feat(i18n): add teacher change request translation keys (Bundle D)"
```

---

## Task 6: Mobile API + Hook

**Files:**
- Create: `mobile/src/api/teacherChange.ts`
- Create: `mobile/src/hooks/useTeacherChange.ts`

- [ ] **Step 1: Confirm apiClient import path**

```bash
head -5 /Users/haskhr/Documents/opencode/education_management/mobile/src/api/messages.ts
```

- [ ] **Step 2: Create mobile/src/api/teacherChange.ts**

```typescript
import { apiClient } from './client';

export const teacherChangeApi = {
  submit: async (reason: string) => {
    const res = await apiClient.post('/teacher-changes', { reason });
    return res.data;
  },
  list: async (status?: 'PENDING') => {
    const res = await apiClient.get('/teacher-changes', { params: status ? { status } : {} });
    return res.data;
  },
  decide: async (id: string, action: 'APPROVE' | 'DENY', adminNote?: string) => {
    const res = await apiClient.patch(`/teacher-changes/${id}`, { action, adminNote });
    return res.data;
  },
};
```

- [ ] **Step 3: Create mobile/src/hooks/useTeacherChange.ts**

```typescript
import { useState, useCallback } from 'react';
import { teacherChangeApi } from '../api/teacherChange';

export function useTeacherChange() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async (status?: 'PENDING') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teacherChangeApi.list(status);
      setRequests(data);
    } catch {
      setError('Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitRequest = useCallback(async (reason: string) => {
    await teacherChangeApi.submit(reason);
  }, []);

  const decideRequest = useCallback(async (id: string, action: 'APPROVE' | 'DENY', adminNote?: string) => {
    await teacherChangeApi.decide(id, action, adminNote);
    await fetchRequests();
  }, [fetchRequests]);

  return { requests, isLoading, error, fetchRequests, submitRequest, decideRequest };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/api/teacherChange.ts mobile/src/hooks/useTeacherChange.ts
git commit -m "feat(mobile): add teacherChange API client and hook"
```

---

## Task 7: Student Home — Teacher Name Display

**Files:**
- Modify: `mobile/app/student/home.tsx`

- [ ] **Step 1: Read student home to understand appointments usage and header structure**

```bash
grep -n "appointment\|teacher\|useAppointments\|ACCEPTED\|header\|greeting\|COLORS\|SPACING" /Users/haskhr/Documents/opencode/education_management/mobile/app/student/home.tsx | head -40
```

- [ ] **Step 2: Derive assignedTeacher from appointments**

Inside the component body (appointments are already available via the existing hook call), add:

```typescript
const assignedTeacher = appointments?.find((a: any) => a.status === 'ACCEPTED')?.teacher;
```

- [ ] **Step 3: Add teacher card to JSX**

Below the header greeting (but before tabs), insert:

```tsx
<View style={styles.teacherCard}>
  {assignedTeacher ? (
    <View style={styles.teacherRow}>
      <Text style={styles.teacherLabel}>
        {t('yourTeacher')}: {assignedTeacher.firstName} {assignedTeacher.lastName}
      </Text>
      <TouchableOpacity onPress={() => router.push('/student/teacher-change')}>
        <Text style={styles.changeLink}>{t('requestTeacherChange')}</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <Text style={styles.teacherLabel}>{t('noTeacherAssigned')}</Text>
  )}
</View>
```

- [ ] **Step 4: Add styles** (verify COLORS field names against what the file already uses before adding):

```typescript
teacherCard: {
  paddingHorizontal: SPACING.md,
  paddingVertical: SPACING.xs,
  backgroundColor: COLORS.surface,
},
teacherRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
teacherLabel: { fontSize: 13, color: COLORS.textSecondary },
changeLink: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add mobile/app/student/home.tsx
git commit -m "feat(student): show assigned teacher name on home screen"
```

---

## Task 8: New Screen — Student Teacher Change Request

**Files:**
- Create: `mobile/app/student/teacher-change.tsx`

- [ ] **Step 1: Verify COLORS fields available**

```bash
grep -n "textPrimary\|textSecondary\|surface\|primary\|background" /Users/haskhr/Documents/opencode/education_management/mobile/constants/theme.ts | head -15
```

- [ ] **Step 2: Create teacher-change.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';

export default function TeacherChangeScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { requests, isLoading, fetchRequests, submitRequest } = useTeacherChange();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { fetchRequests(); }, []);

  const pendingRequest = requests.find((r: any) => r.status === 'PENDING');
  const decidedRequest = requests.find((r: any) => r.status === 'APPROVED' || r.status === 'DENIED');

  const handleSubmit = async () => {
    if (reason.trim().length < 10) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitRequest(reason.trim());
      Alert.alert(t('requestSubmitted'), '', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
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
    statusCard: {
      backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
      padding: SPACING.md,
    },
    statusTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
    statusDesc: { fontSize: 14, color: COLORS.textSecondary },
    adminNote: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: SPACING.xs },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
    textInput: {
      backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
      padding: SPACING.sm, color: COLORS.textPrimary, fontSize: 15,
      minHeight: 120, textAlignVertical: 'top',
      borderWidth: 1, borderColor: '#e5e7eb',
    },
    charCount: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4 },
    submitBtn: {
      backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
      padding: SPACING.sm, alignItems: 'center',
    },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    errorText: { color: '#ef4444', fontSize: 13 },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('requestTeacherChange')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : pendingRequest ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>⏳ {t('pendingRequest')}</Text>
            <Text style={styles.statusDesc}>{pendingRequest.reason}</Text>
          </View>
        ) : decidedRequest ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>
              {decidedRequest.status === 'APPROVED'
                ? `✅ ${t('requestApproved')}`
                : `❌ ${t('requestDenied')}`}
            </Text>
            <Text style={styles.statusDesc}>{decidedRequest.reason}</Text>
            {decidedRequest.adminNote && (
              <Text style={styles.adminNote}>{decidedRequest.adminNote}</Text>
            )}
          </View>
        ) : (
          <>
            <View>
              <Text style={styles.label}>{t('changeReason')}</Text>
              <TextInput
                style={styles.textInput}
                value={reason}
                onChangeText={setReason}
                placeholder={t('changeReasonPlaceholder')}
                placeholderTextColor={COLORS.textSecondary}
                multiline
              />
              <Text style={styles.charCount}>{reason.trim().length}/500</Text>
            </View>
            {submitError && <Text style={styles.errorText}>{submitError}</Text>}
            <TouchableOpacity
              style={[styles.submitBtn, { opacity: reason.trim().length >= 10 && !isSubmitting ? 1 : 0.5 }]}
              onPress={handleSubmit}
              disabled={reason.trim().length < 10 || isSubmitting}
            >
              {isSubmitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{t('requestTeacherChange')}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/student/teacher-change.tsx
git commit -m "feat(student): add teacher change request screen"
```

---

## Task 9: New Screen — Admin Change Requests

**Files:**
- Create: `mobile/app/admin/change-requests.tsx`
- Modify: `mobile/app/admin/home.tsx` (add 📋 navigation icon)

- [ ] **Step 1: Read admin home to match patterns**

```bash
grep -n "COLORS\|getColors\|SPACING\|RADIUS\|header\|msgIconBtn\|msgIconText" /Users/haskhr/Documents/opencode/education_management/mobile/app/admin/home.tsx | head -25
```

- [ ] **Step 2: Create change-requests.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, FlatList, TouchableOpacity, Text, View,
  TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { useTeacherChange } from '@/src/hooks/useTeacherChange';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'DENIED';

export default function ChangeRequestsScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { requests, isLoading, fetchRequests, decideRequest } = useTeacherChange();
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [deciding, setDeciding] = useState(false);

  useEffect(() => { fetchRequests(); }, []);

  const filtered = filter === 'ALL' ? requests : requests.filter((r: any) => r.status === filter);

  const handleDecide = async (id: string, action: 'APPROVE' | 'DENY') => {
    setDeciding(true);
    try {
      await decideRequest(id, action, adminNote.trim() || undefined);
      setExpandedId(null);
      setAdminNote('');
    } catch {
      Alert.alert('Error', 'Failed to process request');
    } finally {
      setDeciding(false);
    }
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'DENIED', label: 'Denied' },
  ];

  const statusColor = (status: string) => {
    if (status === 'PENDING') return '#f59e0b';
    if (status === 'APPROVED') return '#10b981';
    return '#ef4444';
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
    chips: { flexDirection: 'row', gap: SPACING.xs, padding: SPACING.sm, flexWrap: 'wrap' },
    chip: {
      paddingHorizontal: SPACING.sm, paddingVertical: 5,
      borderRadius: 99, borderWidth: 1.5, borderColor: '#e5e7eb',
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 12, color: COLORS.textPrimary },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    row: {
      backgroundColor: COLORS.surface, marginHorizontal: SPACING.sm,
      marginBottom: SPACING.xs, borderRadius: RADIUS.md, overflow: 'hidden',
    },
    rowHeader: {
      flexDirection: 'row', alignItems: 'flex-start',
      padding: SPACING.sm, gap: SPACING.sm,
    },
    rowInfo: { flex: 1 },
    rowName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    rowSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    rowReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    expanded: { padding: SPACING.sm, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
    noteInput: {
      backgroundColor: COLORS.background, borderRadius: RADIUS.md,
      padding: SPACING.sm, color: COLORS.textPrimary, fontSize: 14,
      minHeight: 60, textAlignVertical: 'top',
      borderWidth: 1, borderColor: '#e5e7eb', marginBottom: SPACING.sm,
    },
    btnRow: { flexDirection: 'row', gap: SPACING.sm },
    approveBtn: {
      flex: 1, backgroundColor: '#10b981', borderRadius: RADIUS.md,
      padding: SPACING.sm, alignItems: 'center',
    },
    denyBtn: {
      flex: 1, backgroundColor: '#ef4444', borderRadius: RADIUS.md,
      padding: SPACING.sm, alignItems: 'center',
    },
    btnText: { color: '#fff', fontWeight: '700' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
    emptyTitle: { fontSize: 16, color: COLORS.textSecondary },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('teacherChangeRequests')}</Text>
      </View>
      <View style={styles.chips}>
        {statusFilters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>{t('noChangeRequests')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isExpanded = expandedId === item.id;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  setExpandedId(isExpanded ? null : item.id);
                  setAdminNote('');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.rowHeader}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>
                      {item.student?.firstName} {item.student?.lastName}
                    </Text>
                    <Text style={styles.rowSub}>
                      → {item.currentTeacher?.firstName} {item.currentTeacher?.lastName}
                    </Text>
                    <Text style={styles.rowReason} numberOfLines={isExpanded ? undefined : 1}>
                      {item.reason}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                {isExpanded && item.status === 'PENDING' && (
                  <View style={styles.expanded}>
                    <TextInput
                      style={styles.noteInput}
                      value={adminNote}
                      onChangeText={setAdminNote}
                      placeholder="Admin note (optional)"
                      placeholderTextColor={COLORS.textSecondary}
                      multiline
                    />
                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={[styles.approveBtn, { opacity: deciding ? 0.5 : 1 }]}
                        onPress={() => handleDecide(item.id, 'APPROVE')}
                        disabled={deciding}
                      >
                        <Text style={styles.btnText}>✓ Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.denyBtn, { opacity: deciding ? 0.5 : 1 }]}
                        onPress={() => handleDecide(item.id, 'DENY')}
                        disabled={deciding}
                      >
                        <Text style={styles.btnText}>✗ Deny</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Add 📋 icon to admin home header**

In `mobile/app/admin/home.tsx`, find the header icons row (where 💬 and 📢 buttons are). Add a 📋 button before them:

```tsx
<TouchableOpacity style={styles.msgIconBtn} onPress={() => router.push('/admin/change-requests')}>
  <Text style={styles.msgIconText}>📋</Text>
</TouchableOpacity>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add mobile/app/admin/change-requests.tsx mobile/app/admin/home.tsx
git commit -m "feat(admin): add teacher change requests management screen"
```

---

## Task 10: Teacher Home — Pending Change Requests Banner

**Files:**
- Modify: `mobile/app/teacher/home.tsx`

- [ ] **Step 1: Read teacher home — Students tab structure**

```bash
grep -n "appointment\|student\|tab\|Tab\|ACCEPTED\|useTeacherChange\|banner\|Students" /Users/haskhr/Documents/opencode/education_management/mobile/app/teacher/home.tsx | head -40
```

- [ ] **Step 2: Add useTeacherChange import**

```typescript
import { useTeacherChange } from '@/src/hooks/useTeacherChange';
```

- [ ] **Step 3: Add hook call and derived state inside component**

```typescript
const { requests: changeRequests, fetchRequests: fetchChangeRequests } = useTeacherChange();
const pendingChanges = changeRequests.filter((r: any) => r.status === 'PENDING');
```

- [ ] **Step 4: Call fetchChangeRequests on mount**

Find the existing `useEffect` on mount and add `fetchChangeRequests()` inside it. If there are multiple effects, add a dedicated one:

```typescript
useEffect(() => { fetchChangeRequests(); }, []);
```

- [ ] **Step 5: Add banner to Students tab**

Find the Students tab render area (the JSX that renders the student cards/appointments). At the very top of that content area, add:

```tsx
{pendingChanges.length > 0 && (
  <View style={styles.changeRequestBanner}>
    <Text style={styles.changeRequestText}>
      ⚠️ {pendingChanges.length} {t('studentsPendingChange')}
    </Text>
  </View>
)}
```

- [ ] **Step 6: Add banner styles** (check COLORS fields first — use `textPrimary`/`textSecondary`, not `text`):

```typescript
changeRequestBanner: {
  backgroundColor: '#fef3c7',
  borderLeftWidth: 4,
  borderLeftColor: '#f59e0b',
  padding: SPACING.sm,
  marginBottom: SPACING.sm,
  borderRadius: RADIUS.sm ?? 6,
},
changeRequestText: { fontSize: 13, color: '#92400e', fontWeight: '600' },
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
git add mobile/app/teacher/home.tsx
git commit -m "feat(teacher): show pending teacher change request banner on home"
```

---

## Self-Review Checklist

After all tasks complete, verify:

1. **Spec coverage:**
   - [ ] `TeacherChangeRequest` model in schema with all fields + migration applied
   - [ ] `SubmitTeacherChangeSchema` and `DecideTeacherChangeSchema` in shared package
   - [ ] POST `/teacher-changes` — validates reason, checks ACCEPTED appointment, prevents duplicate PENDING
   - [ ] GET `/teacher-changes` — returns role-scoped results
   - [ ] PATCH `/teacher-changes/:id` — ADMIN only, prevents double-decide
   - [ ] Route mounted in `app.ts` at `/api/v1/teacher-changes`
   - [ ] 12 i18n keys in AR + EN
   - [ ] `teacherChangeApi` + `useTeacherChange` hook created
   - [ ] Student home shows assigned teacher name + link
   - [ ] `student/teacher-change.tsx` — shows form OR pending OR decided state
   - [ ] `admin/change-requests.tsx` — list with filter chips, inline expand, approve/deny
   - [ ] Admin home has 📋 navigation icon
   - [ ] Teacher home shows pending change request banner in Students tab
