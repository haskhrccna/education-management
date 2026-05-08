# Bundle 1: Grades & Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full academic loop — teacher grades students, students view grades, student home shows real memorization data from the DB instead of hardcoded mocks.

**Architecture:** Three new backend endpoints (surahs list, memorization progress CRUD) backed by existing Prisma models. Five mobile screens (3 new, 2 updated) wired to those endpoints via a new `memorizationApi` module and `useMemorization` hook.

**Tech Stack:** Express + Prisma 6 (backend) · Expo Router + Zustand + Axios (mobile) · Jest + supertest (tests)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/server/src/services/memorization.service.ts` | Create | DB logic for surahs + memorization progress |
| `packages/server/src/controllers/memorization.controller.ts` | Create | HTTP handlers (thin, delegates to service) |
| `packages/server/src/routes/memorization.routes.ts` | Create | Route + middleware wiring |
| `packages/server/src/controllers/__tests__/memorization.controller.test.ts` | Create | Controller unit tests |
| `packages/server/src/app.ts` | Modify | Register new routes |
| `mobile/src/api/memorization.ts` | Create | Typed Axios calls for memorization + surahs |
| `mobile/src/api/index.ts` | Modify | Re-export new API + types |
| `mobile/src/hooks/useMemorization.ts` | Create | React hook wrapping memorizationApi |
| `mobile/app/teacher/grade-form.tsx` | Create | Teacher grade entry form |
| `mobile/app/student/grades.tsx` | Create | Student grades list |
| `mobile/app/teacher/student-detail.tsx` | Create | Teacher view of one student's grades + progress |
| `mobile/app/student/home.tsx` | Modify | Replace mock surah data with useMemorization |
| `mobile/app/teacher/home.tsx` | Modify | Fix nav links, make student cards tappable |

---

## Task 1: Memorization Service

**Files:**
- Create: `packages/server/src/services/memorization.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
// packages/server/src/services/memorization.service.ts
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export const getSurahs = async () => {
  return prisma.surah.findMany({ orderBy: { number: 'asc' } });
};

export const getProgress = async (callerId: string, callerRole: string, studentId?: string) => {
  const targetId = callerRole === 'STUDENT' ? callerId : studentId;
  if (!targetId) throw new AppError(400, 'studentId query param is required');
  return prisma.memorizationProgress.findMany({
    where: { userId: targetId },
    include: { surah: true },
    orderBy: { surah: { number: 'asc' } },
  });
};

export const updateProgress = async (
  teacherId: string,
  surahId: number,
  studentId: string,
  memorizedAyahs: number,
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
) => {
  const appointment = await prisma.appointment.findFirst({
    where: { teacherId, studentId, status: 'ACCEPTED' },
  });
  if (!appointment) throw new AppError(403, 'No accepted appointment with this student');

  const surah = await prisma.surah.findUnique({ where: { id: surahId } });
  if (!surah) throw new AppError(404, 'Surah not found');

  const resolvedStatus =
    status ??
    (memorizedAyahs >= surah.ayahCount
      ? 'COMPLETE'
      : memorizedAyahs > 0
        ? 'IN_PROGRESS'
        : 'NOT_STARTED');

  return prisma.memorizationProgress.upsert({
    where: { userId_surahId: { userId: studentId, surahId } },
    create: { userId: studentId, surahId, memorizedAyahs, status: resolvedStatus },
    update: { memorizedAyahs, status: resolvedStatus, lastRecitedAt: new Date() },
    include: { surah: true },
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/services/memorization.service.ts
git commit -m "feat(memorization): add memorization service"
```

---

## Task 2: Memorization Controller

**Files:**
- Create: `packages/server/src/controllers/memorization.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// packages/server/src/controllers/memorization.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as memorizationService from '../services/memorization.service';
import { AppError } from '../middleware/error.middleware';

export const listSurahs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const surahs = await memorizationService.getSurahs();
    res.json(surahs);
  } catch (err) {
    next(err);
  }
};

export const getProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.query.studentId as string | undefined;
    const progress = await memorizationService.getProgress(req.userId!, req.userRole!, studentId);
    res.json(progress);
  } catch (err) {
    next(err);
  }
};

export const updateProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const surahId = parseInt(req.params.surahId, 10);
    if (isNaN(surahId)) throw new AppError(400, 'Invalid surahId');
    const { studentId, memorizedAyahs, status } = req.body;
    if (!studentId) throw new AppError(400, 'studentId is required');
    if (typeof memorizedAyahs !== 'number') throw new AppError(400, 'memorizedAyahs must be a number');
    const result = await memorizationService.updateProgress(
      req.userId!, surahId, studentId, memorizedAyahs, status
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/controllers/memorization.controller.ts
git commit -m "feat(memorization): add memorization controller"
```

---

## Task 3: Routes + Controller Tests

**Files:**
- Create: `packages/server/src/routes/memorization.routes.ts`
- Create: `packages/server/src/controllers/__tests__/memorization.controller.test.ts`

- [ ] **Step 1: Create the routes file**

```typescript
// packages/server/src/routes/memorization.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@quran-review/shared';
import * as memorizationController from '../controllers/memorization.controller';

export const surahRouter = Router();
surahRouter.use(authenticate);
surahRouter.get('/', memorizationController.listSurahs);

export const memorizationRouter = Router();
memorizationRouter.use(authenticate);
memorizationRouter.get('/', memorizationController.getProgress);
memorizationRouter.put('/:surahId', authorize(UserRole.TEACHER), memorizationController.updateProgress);
```

- [ ] **Step 2: Write the controller tests**

```typescript
// packages/server/src/controllers/__tests__/memorization.controller.test.ts
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../middleware/error.middleware';

jest.mock('../../services/memorization.service', () => ({
  getSurahs: jest.fn(),
  getProgress: jest.fn(),
  updateProgress: jest.fn(),
}));

import * as memorizationService from '../../services/memorization.service';
import { listSurahs, getProgress, updateProgress } from '../memorization.controller';

const mockedService = memorizationService as jest.Mocked<typeof memorizationService>;

function makeApp(userId = 'user-1', userRole = 'STUDENT') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.get('/surahs', listSurahs);
  app.get('/memorization', getProgress);
  app.put('/memorization/:surahId', updateProgress);
  app.use(errorHandler);
  return app;
}

describe('memorization.controller', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /surahs', () => {
    it('should return surah list', async () => {
      mockedService.getSurahs.mockResolvedValue([{ id: 1, nameAr: 'الفاتحة' }] as any);
      const res = await request(makeApp()).get('/surahs');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /memorization', () => {
    it('should return student own progress', async () => {
      mockedService.getProgress.mockResolvedValue([{ surahId: 1, memorizedAyahs: 7 }] as any);
      const res = await request(makeApp('student-1', 'STUDENT')).get('/memorization');
      expect(res.status).toBe(200);
      expect(mockedService.getProgress).toHaveBeenCalledWith('student-1', 'STUDENT', undefined);
    });

    it('should pass studentId query param for teacher', async () => {
      mockedService.getProgress.mockResolvedValue([{ surahId: 1, memorizedAyahs: 3 }] as any);
      const res = await request(makeApp('teacher-1', 'TEACHER')).get('/memorization?studentId=student-1');
      expect(res.status).toBe(200);
      expect(mockedService.getProgress).toHaveBeenCalledWith('teacher-1', 'TEACHER', 'student-1');
    });
  });

  describe('PUT /memorization/:surahId', () => {
    it('should update progress', async () => {
      mockedService.updateProgress.mockResolvedValue({ surahId: 1, memorizedAyahs: 50 } as any);
      const res = await request(makeApp('teacher-1', 'TEACHER'))
        .put('/memorization/1')
        .send({ studentId: 'student-1', memorizedAyahs: 50 });
      expect(res.status).toBe(200);
      expect(mockedService.updateProgress).toHaveBeenCalledWith('teacher-1', 1, 'student-1', 50, undefined);
    });

    it('should return 400 for non-numeric surahId', async () => {
      const res = await request(makeApp('teacher-1', 'TEACHER'))
        .put('/memorization/abc')
        .send({ studentId: 'student-1', memorizedAyahs: 10 });
      expect(res.status).toBe(400);
    });

    it('should return 400 when studentId missing', async () => {
      const res = await request(makeApp('teacher-1', 'TEACHER'))
        .put('/memorization/1')
        .send({ memorizedAyahs: 10 });
      expect(res.status).toBe(400);
    });

    it('should propagate 403 from service', async () => {
      mockedService.updateProgress.mockRejectedValue(
        Object.assign(new Error('No accepted appointment'), { statusCode: 403 })
      );
      const res = await request(makeApp('teacher-1', 'TEACHER'))
        .put('/memorization/1')
        .send({ studentId: 'student-1', memorizedAyahs: 10 });
      expect(res.status).toBe(403);
    });
  });
});
```

- [ ] **Step 3: Run tests and verify they pass**

```bash
cd packages/server && npx jest --testPathPattern=memorization.controller --no-coverage
```

Expected: 6 tests passing, 0 failing.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/memorization.routes.ts \
        packages/server/src/controllers/__tests__/memorization.controller.test.ts
git commit -m "feat(memorization): add routes and controller tests"
```

---

## Task 4: Register Routes in app.ts

**Files:**
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Add import after the existing route imports (after line 14)**

```typescript
import { surahRouter, memorizationRouter } from './routes/memorization.routes';
```

- [ ] **Step 2: Register routes after the messages route (after `app.use('/api/v1/messages', messageRoutes)`)**

```typescript
app.use('/api/v1/surahs', surahRouter);
app.use('/api/v1/memorization', memorizationRouter);
```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

```bash
cd packages/server && npm test -- --no-coverage
```

Expected: all pre-existing tests pass plus the 6 new memorization tests.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/app.ts
git commit -m "feat(memorization): register surah and memorization routes in app"
```

---

## Task 5: Mobile API Module

**Files:**
- Create: `mobile/src/api/memorization.ts`
- Modify: `mobile/src/api/index.ts`

- [ ] **Step 1: Create the API module**

```typescript
// mobile/src/api/memorization.ts
import apiClient from './client';

export interface MemorizationEntry {
  surahId: number;
  memorizedAyahs: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  lastRecitedAt?: string;
  surah: { number: number; nameAr: string; nameEn: string; ayahCount: number; juz: number };
}

export interface Surah {
  id: number;
  number: number;
  nameAr: string;
  nameEn: string;
  ayahCount: number;
  juz: number;
}

export const memorizationApi = {
  getMine: async (): Promise<MemorizationEntry[]> => {
    const res = await apiClient.get('/memorization');
    return res.data;
  },

  getStudentProgress: async (studentId: string): Promise<MemorizationEntry[]> => {
    const res = await apiClient.get('/memorization', { params: { studentId } });
    return res.data;
  },

  updateProgress: async (
    surahId: number,
    studentId: string,
    memorizedAyahs: number,
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
  ): Promise<MemorizationEntry> => {
    const res = await apiClient.put(`/memorization/${surahId}`, { studentId, memorizedAyahs, status });
    return res.data;
  },

  getSurahs: async (): Promise<Surah[]> => {
    const res = await apiClient.get('/surahs');
    return res.data;
  },
};
```

- [ ] **Step 2: Add two lines to `mobile/src/api/index.ts` after the existing exports**

```typescript
export { memorizationApi } from './memorization';
export type { MemorizationEntry, Surah } from './memorization';
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/api/memorization.ts mobile/src/api/index.ts
git commit -m "feat(mobile): add memorization API module"
```

---

## Task 6: useMemorization Hook

**Files:**
- Create: `mobile/src/hooks/useMemorization.ts`

- [ ] **Step 1: Create the hook**

```typescript
// mobile/src/hooks/useMemorization.ts
import { useCallback, useState } from 'react';
import { memorizationApi, MemorizationEntry, Surah } from '../api';

export function useMemorization() {
  const [progress, setProgress] = useState<MemorizationEntry[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [progressData, surahsData] = await Promise.all([
        memorizationApi.getMine(),
        memorizationApi.getSurahs(),
      ]);
      setProgress(progressData);
      setSurahs(surahsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { progress, surahs, isLoading, error, fetchProgress };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/hooks/useMemorization.ts
git commit -m "feat(mobile): add useMemorization hook"
```

---

## Task 7: Teacher Grade Form Screen

**Files:**
- Create: `mobile/app/teacher/grade-form.tsx`

- [ ] **Step 1: Create the screen**

```typescript
// mobile/app/teacher/grade-form.tsx
import React, { useState, useEffect } from 'react';
import {
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity,
  View, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appointmentsApi, gradesApi } from '@/src/api';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

const GRADE_TYPES = ['QUIZ', 'ASSIGNMENT', 'EXAM', 'ORAL', 'PARTICIPATION'] as const;
type GradeType = (typeof GRADE_TYPES)[number];

interface Student { id: string; firstName: string; lastName: string }

export default function GradeFormScreen() {
  const router = useRouter();
  const { studentId: prefillId } = useLocalSearchParams<{ studentId?: string }>();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(prefillId ?? '');
  const [subject, setSubject] = useState('');
  const [score, setScore] = useState('');
  const [type, setType] = useState<GradeType>('ORAL');
  const [notes, setNotes] = useState('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    appointmentsApi.getMine()
      .then((appts) => {
        const accepted = appts
          .filter((a) => a.status === 'ACCEPTED' && a.student)
          .map((a) => ({ id: a.student!.id, firstName: a.student!.firstName, lastName: a.student!.lastName }));
        const unique = accepted.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
        setStudents(unique);
        if (!prefillId && unique.length > 0) setSelectedStudentId(unique[0].id);
      })
      .catch(() => {})
      .finally(() => setIsLoadingStudents(false));
  }, []);

  const canSubmit = !!selectedStudentId && subject.trim().length > 0 && score.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await gradesApi.create({
        studentId: selectedStudentId,
        subject: subject.trim(),
        grade: score.trim(),
        type,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Grade submitted', 'The grade has been recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to submit grade');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Grade</Text>
          <Text style={styles.subtitle}>Assess a student's recitation</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Student</Text>
          {isLoadingStudents ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : students.length === 0 ? (
            <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>No accepted students yet</Text>
          ) : (
            <View style={styles.chipRow}>
              {students.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, { borderColor: COLORS.primary }, selectedStudentId === s.id && { backgroundColor: COLORS.primary }]}
                  onPress={() => setSelectedStudentId(s.id)}
                >
                  <Text style={[styles.chipText, { color: selectedStudentId === s.id ? '#fff' : COLORS.textPrimary }]}>
                    {s.firstName} {s.lastName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Subject</Text>
          <TextInput
            style={[styles.input, { backgroundColor: COLORS.surface, color: COLORS.textPrimary }]}
            placeholder="e.g. Al-Baqarah ayahs 1–50"
            placeholderTextColor={COLORS.textMuted}
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Score</Text>
          <TextInput
            style={[styles.input, { backgroundColor: COLORS.surface, color: COLORS.textPrimary }]}
            placeholder="e.g. 87"
            placeholderTextColor={COLORS.textMuted}
            value={score}
            onChangeText={setScore}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Type</Text>
          <View style={styles.chipRow}>
            {GRADE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, { borderColor: COLORS.primary }, type === t && { backgroundColor: COLORS.primary }]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.chipText, { color: type === t ? '#fff' : COLORS.textPrimary }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: COLORS.textSecondary }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: COLORS.surface, color: COLORS.textPrimary }]}
            placeholder="Any observations..."
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: canSubmit ? COLORS.primary : (COLORS.textMuted ?? '#9ca3af') }]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>Submit Grade</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: COLORS.surface }]} onPress={() => router.back()}>
            <Text style={[styles.cancelText, { color: COLORS.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  header: { padding: SPACING.xl, paddingTop: SPACING.lg, borderBottomLeftRadius: RADIUS['2xl'], borderBottomRightRadius: RADIUS['2xl'], ...SHADOWS.lg, marginBottom: SPACING.xl },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: SPACING.sm },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  form: { paddingHorizontal: SPACING.xl, gap: SPACING.xs },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: RADIUS.lg, padding: SPACING.md, fontSize: 15, marginTop: SPACING.xs },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  submitBtn: { marginTop: SPACING.xl, borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', ...SHADOWS.sm },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { marginTop: SPACING.sm, borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/teacher/grade-form.tsx
git commit -m "feat(mobile): add teacher grade form screen"
```

---

## Task 8: Student Grades Screen

**Files:**
- Create: `mobile/app/student/grades.tsx`

- [ ] **Step 1: Create the screen**

```typescript
// mobile/app/student/grades.tsx
import React, { useEffect } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGrades } from '@/src/hooks/useGrades';
import { Grade } from '@/src/api';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

const TYPE_COLORS: Record<string, string> = {
  ORAL: '#3b82f6', QUIZ: '#22c55e', EXAM: '#ef4444',
  ASSIGNMENT: '#f59e0b', PARTICIPATION: '#8b5cf6',
};

function avgScore(grades: Grade[]): string {
  const nums = grades.map((g) => parseFloat(g.grade)).filter((n) => !isNaN(n));
  if (nums.length === 0) return '—';
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length).toString();
}

export default function StudentGradesScreen() {
  const router = useRouter();
  const { grades, isLoading, error, fetchGrades } = useGrades();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);

  useEffect(() => { fetchGrades(); }, []);

  const renderGrade = ({ item }: { item: Grade }) => (
    <View style={[styles.card, { backgroundColor: COLORS.surface, borderLeftColor: TYPE_COLORS[item.type] ?? COLORS.primary }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={[styles.badge, { backgroundColor: (TYPE_COLORS[item.type] ?? COLORS.primary) + '22' }]}>
            <Text style={[styles.badgeText, { color: TYPE_COLORS[item.type] ?? COLORS.primary }]}>{item.type}</Text>
          </View>
          <Text style={[styles.subject, { color: COLORS.textPrimary }]}>{item.subject}</Text>
          <Text style={[styles.meta, { color: COLORS.textSecondary }]}>
            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <Text style={[styles.score, { color: TYPE_COLORS[item.type] ?? COLORS.primary }]}>{item.grade}</Text>
      </View>
      {item.notes ? <Text style={[styles.notes, { color: COLORS.textSecondary }]}>{item.notes}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Grades</Text>
        {!isLoading && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{avgScore(grades)}</Text>
              <Text style={styles.statLbl}>Avg Score</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{grades.length}</Text>
              <Text style={styles.statLbl}>Total</Text>
            </View>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.textSecondary }}>{error}</Text>
          <TouchableOpacity onPress={fetchGrades} style={{ marginTop: SPACING.md }}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={grades}
          keyExtractor={(g) => g.id}
          renderItem={renderGrade}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchGrades} />}
          ListEmptyComponent={
            isLoading
              ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
              : (
                <View style={styles.center}>
                  <Text style={{ fontSize: 36, marginBottom: 12 }}>📋</Text>
                  <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>No grades yet</Text>
                  <Text style={{ color: COLORS.textSecondary, textAlign: 'center' }}>
                    Your teacher hasn't recorded any grades yet.
                  </Text>
                </View>
              )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: SPACING.xl, paddingTop: SPACING.lg, borderBottomLeftRadius: RADIUS['2xl'], borderBottomRightRadius: RADIUS['2xl'], ...SHADOWS.lg, marginBottom: SPACING.md },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: SPACING.sm },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: SPACING.md },
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  stat: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', minWidth: 72 },
  statVal: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  list: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: SPACING['4xl'] },
  card: { borderRadius: RADIUS.xl, padding: SPACING.lg, borderLeftWidth: 4, ...SHADOWS.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm, marginBottom: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  subject: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  meta: { fontSize: 12 },
  score: { fontSize: 28, fontWeight: '800' },
  notes: { fontSize: 13, marginTop: SPACING.sm, fontStyle: 'italic' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['3xl'] },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.sm },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/student/grades.tsx
git commit -m "feat(mobile): add student grades screen"
```

---

## Task 9: Teacher Student Detail Screen

**Files:**
- Create: `mobile/app/teacher/student-detail.tsx`

- [ ] **Step 1: Create the screen**

```typescript
// mobile/app/teacher/student-detail.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { gradesApi, memorizationApi, Grade, MemorizationEntry } from '@/src/api';
import { getColors, SHADOWS, RADIUS, SPACING } from '@/constants/theme';
import { useSettingsStore } from '@/src/settings/store';

const TYPE_COLORS: Record<string, string> = {
  ORAL: '#3b82f6', QUIZ: '#22c55e', EXAM: '#ef4444',
  ASSIGNMENT: '#f59e0b', PARTICIPATION: '#8b5cf6',
};

function avgScore(grades: Grade[]): string {
  const nums = grades.map((g) => parseFloat(g.grade)).filter((n) => !isNaN(n));
  if (nums.length === 0) return '—';
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length).toString();
}

function memPct(entries: MemorizationEntry[]): string {
  const total = entries.reduce((s, e) => s + e.surah.ayahCount, 0);
  const done = entries.reduce((s, e) => s + e.memorizedAyahs, 0);
  if (total === 0) return '—';
  return Math.round((done / total) * 100) + '%';
}

export default function TeacherStudentDetailScreen() {
  const router = useRouter();
  const { id: studentId, name: studentName } = useLocalSearchParams<{ id: string; name?: string }>();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);

  const [grades, setGrades] = useState<Grade[]>([]);
  const [memorization, setMemorization] = useState<MemorizationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    Promise.all([
      gradesApi.getStudentGrades(studentId),
      memorizationApi.getStudentProgress(studentId),
    ])
      .then(([g, m]) => { setGrades(g); setMemorization(m); })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [studentId]);

  const displayName = studentName ?? 'Student';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: SPACING['4xl'] }}>
        <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{displayName}</Text>
          {!isLoading && (
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statVal}>{avgScore(grades)}</Text><Text style={styles.statLbl}>Avg</Text></View>
              <View style={styles.stat}><Text style={styles.statVal}>{grades.length}</Text><Text style={styles.statLbl}>Grades</Text></View>
              <View style={styles.stat}><Text style={styles.statVal}>{memPct(memorization)}</Text><Text style={styles.statLbl}>Memorized</Text></View>
            </View>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : error ? (
          <View style={styles.center}><Text style={{ color: COLORS.textSecondary }}>{error}</Text></View>
        ) : (
          <View style={{ paddingHorizontal: SPACING.xl, gap: SPACING.md, marginTop: SPACING.lg }}>
            <Text style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>Recent Grades</Text>
            {grades.length === 0 ? (
              <Text style={{ color: COLORS.textSecondary }}>No grades recorded yet.</Text>
            ) : (
              grades.slice(0, 5).map((g) => (
                <View key={g.id} style={[styles.gradeCard, { backgroundColor: COLORS.surface, borderLeftColor: TYPE_COLORS[g.type] ?? COLORS.primary }]}>
                  <View style={styles.gradeCardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.badge, { backgroundColor: (TYPE_COLORS[g.type] ?? COLORS.primary) + '22' }]}>
                        <Text style={[styles.badgeText, { color: TYPE_COLORS[g.type] ?? COLORS.primary }]}>{g.type}</Text>
                      </View>
                      <Text style={[styles.subject, { color: COLORS.textPrimary }]}>{g.subject}</Text>
                      <Text style={[styles.meta, { color: COLORS.textSecondary }]}>
                        {new Date(g.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <Text style={[styles.score, { color: TYPE_COLORS[g.type] ?? COLORS.primary }]}>{g.grade}</Text>
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push(`/teacher/grade-form?studentId=${studentId}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ Add Grade for {displayName}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: SPACING.xl, paddingTop: SPACING.lg, borderBottomLeftRadius: RADIUS['2xl'], borderBottomRightRadius: RADIUS['2xl'], ...SHADOWS.lg, marginBottom: SPACING.md },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: SPACING.sm },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: SPACING.md },
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  stat: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', flex: 1 },
  statVal: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  center: { alignItems: 'center', padding: SPACING['3xl'] },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  gradeCard: { borderRadius: RADIUS.xl, padding: SPACING.lg, borderLeftWidth: 4, ...SHADOWS.sm },
  gradeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm, marginBottom: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  subject: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  meta: { fontSize: 12 },
  score: { fontSize: 26, fontWeight: '800' },
  addBtn: { borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', ...SHADOWS.sm, marginTop: SPACING.md },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/teacher/student-detail.tsx
git commit -m "feat(mobile): add teacher student detail screen"
```

---

## Task 10: Update Student Home (Real Memorization Data)

**Files:**
- Modify: `mobile/app/student/home.tsx`

- [ ] **Step 1: Add import for useMemorization and ActivityIndicator**

At the top of `mobile/app/student/home.tsx`, add:
```typescript
import { useMemorization } from '@/src/hooks/useMemorization';
```
Also add `ActivityIndicator` to the `react-native` import list.

- [ ] **Step 2: Remove the hardcoded mock constants**

Delete the entire `SURAH_DATA` array (lines declaring the const and all 10 surah entries) and the entire `REVISION_SCHEDULE` array from the module level.

- [ ] **Step 3: Replace static derived values inside `StudentHomeScreen` with real data**

Remove the four hardcoded derivations and replace the body of the component (after the existing state/hook declarations) with:

```typescript
const { progress, surahs: apiSurahs, isLoading: isLoadingProgress, fetchProgress } = useMemorization();

React.useEffect(() => { fetchProgress(); }, []);

// Map API data into the shape existing tabs already consume
const SURAH_DATA: Surah[] = apiSurahs.map((s) => {
  const entry = progress.find((e) => e.surahId === s.id);
  return {
    id: s.id,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    ayahCount: s.ayahCount,
    memorizedAyahs: entry?.memorizedAyahs ?? 0,
    juz: s.juz,
  };
});

// Schedule tab stays empty (RevisionSchedule API is Bundle 3 scope)
const REVISION_SCHEDULE: Array<{ id: string; surahId: number; surahName: string; date: string; status: 'DUE' | 'UPCOMING' }> = [];

const completedSurahs = SURAH_DATA.filter((s) => s.memorizedAyahs >= s.ayahCount).length;
const totalMemorized = SURAH_DATA.reduce((sum, s) => sum + s.memorizedAyahs, 0);
const totalAyahsAll = SURAH_DATA.reduce((sum, s) => sum + s.ayahCount, 0);
const currentJuz = getProgressingJuz(SURAH_DATA);
```

- [ ] **Step 4: Add "My Grades" button in the header**

Inside the `headerTop` View, replace the lone logout `TouchableOpacity` with a row containing both buttons:

```typescript
<View style={{ flexDirection: 'row', gap: SPACING.sm }}>
  <TouchableOpacity onPress={() => router.push('/student/grades')} style={[styles.logoutBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
    <Text style={styles.logoutText}>My Grades</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
    <Text style={styles.logoutText}>{t('logout')}</Text>
  </TouchableOpacity>
</View>
```

- [ ] **Step 5: Show loading spinner in Surahs tab while fetching**

In the ScrollView content area, change the Surahs tab render:

```typescript
{activeTab === 'surahs' && (
  isLoadingProgress && SURAH_DATA.length === 0
    ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
    : <SurahsTab surahData={SURAH_DATA} activeJuz={currentJuz} styles={styles} />
)}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/app/student/home.tsx
git commit -m "feat(mobile): connect student home to real memorization API"
```

---

## Task 11: Update Teacher Home

**Files:**
- Modify: `mobile/app/teacher/home.tsx`

- [ ] **Step 1: Make student cards tappable**

Inside `MyStudentsTab`, add `const router = useRouter();` at the top of the function. Then wrap each `Animated.View` student card in a `TouchableOpacity`:

```typescript
<TouchableOpacity
  key={a.id}
  activeOpacity={0.85}
  onPress={() =>
    router.push(
      `/teacher/student-detail?id=${a.student?.id}&name=${encodeURIComponent(
        `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim()
      )}`
    )
  }
>
  <Animated.View entering={FadeInUp.duration(400).delay(index * 80)} style={styles.studentCard}>
    {/* leave all existing card content exactly as-is */}
  </Animated.View>
</TouchableOpacity>
```

Remove `key={a.id}` from the inner `Animated.View` since it now belongs on the outer `TouchableOpacity`.

- [ ] **Step 2: Fix the broken grade navigation**

In `AssignmentsTab`, change the first button's `onPress`:

```typescript
// Find this line:
onPress={() => router.push('/teacher/grades')}
// Replace with:
onPress={() => router.push('/teacher/grade-form')}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/teacher/home.tsx
git commit -m "feat(mobile): fix teacher nav — student detail tap + grade form route"
```

---

## Task 12: Smoke Test on Simulator

- [ ] **Step 1: Confirm server is running**

```bash
curl -s http://localhost:4000/health | grep -o '"status":"ok"'
```

Expected output: `"status":"ok"`

- [ ] **Step 2: Run full backend test suite**

```bash
cd packages/server && npm test -- --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Verify new endpoints via curl (get a token first)**

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@education.com","password":"Admin1234!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

curl -s http://localhost:4000/api/v1/surahs \
  -H "Authorization: Bearer $TOKEN" | head -c 200
```

Expected: JSON array starting with Al-Fatiha (if DB is seeded with surahs).

- [ ] **Step 4: Test each mobile flow on simulator**

| Flow | Expected result |
|------|----------------|
| Student logs in → Surahs tab | Spinner then real data (or empty state if DB not seeded) |
| Student taps "My Grades" | Grades screen opens, shows empty state or real grades |
| Teacher logs in → taps student card | Student detail screen opens with stats |
| Teacher → Assignments → "Add Review Task" | Grade form opens (no crash) |
| Fill grade form → Submit | Success alert → back to teacher home |
| Tap "Add Grade for [name]" in student detail | Grade form opens with student pre-filled |

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Bundle 1 complete — grades & progress full academic loop"
```
