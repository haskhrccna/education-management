import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';
import { CreateGradeSchema } from '../validators/common';

const SurahRow = z.looseObject({
  id: z.number(),
  number: z.number(),
  nameAr: z.string(),
  nameEn: z.string(),
  ayahCount: z.number(),
  juz: z.number(),
});

const GradeRow = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  teacherId: z.string(),
  surahId: z.number().nullable(),
  grade: z.string(),
  type: z.enum(['QUIZ', 'ASSIGNMENT', 'EXAM', 'ORAL', 'PARTICIPATION']),
  createdAt: DateOut,
});

const MemorizationRow = z.looseObject({
  userId: z.string(),
  surahId: z.number(),
  memorizedAyahs: z.number(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE']),
});

const RevisionRow = z.looseObject({
  id: z.string(),
  userId: z.string(),
  surahId: z.number(),
  scheduledFor: DateOut,
  status: z.enum(['PENDING', 'COMPLETED', 'MISSED']),
  interval: z.number(),
  easeFactor: z.number(),
  repetitions: z.number(),
});

export const learningContracts = {
  listGrades: defineContract({
    method: 'GET',
    path: '/api/v1/grades',
    summary: 'Own grades (student) — RAW array with surah include',
    access: 'authenticated',
    responses: { 200: z.array(GradeRow), 401: ErrorEnvelope },
  }),
  createGrade: defineContract({
    method: 'POST',
    path: '/api/v1/grades',
    summary: 'Teacher grades a linked student; audits CREATE_GRADE',
    access: [UserRole.TEACHER],
    request: { body: CreateGradeSchema },
    responses: { 201: GradeRow, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  studentGrades: defineContract({
    method: 'GET',
    path: '/api/v1/grades/student/:id',
    summary: 'Grades of one student — teacher needs the ACCEPTED-appointment link, admin is free',
    access: [UserRole.TEACHER, UserRole.ADMIN],
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: z.array(GradeRow), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  listSurahs: defineContract({
    method: 'GET',
    path: '/api/v1/surahs',
    summary: 'All 114 surahs ordered by number (RAW array)',
    access: 'authenticated',
    responses: { 200: z.array(SurahRow), 401: ErrorEnvelope },
  }),
  getMemorization: defineContract({
    method: 'GET',
    path: '/api/v1/memorization',
    summary: 'Memorization progress; student=self, teacher/admin need ?studentId',
    access: 'authenticated',
    request: { query: z.object({ studentId: z.string().optional() }) },
    responses: { 200: z.array(MemorizationRow), 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  updateMemorization: defineContract({
    method: 'PUT',
    path: '/api/v1/memorization/:surahId',
    summary:
      'Teacher upserts progress; transition into COMPLETE seeds the first SM-2 revision (NO Zod body — legacy hand-validation pinned)',
    access: [UserRole.TEACHER],
    request: { params: z.object({ surahId: z.string() }) },
    responses: {
      200: MemorizationRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  listRevisions: defineContract({
    method: 'GET',
    path: '/api/v1/revisions',
    summary: 'Revision schedule; ?surahId filter (invalid → bare {success:false} 400 without meta — pinned quirk)',
    access: 'authenticated',
    request: { query: z.object({ surahId: z.string().optional() }) },
    responses: { 200: z.array(RevisionRow), 400: ErrorEnvelope, 401: ErrorEnvelope },
  }),
  createRevision: defineContract({
    method: 'POST',
    path: '/api/v1/revisions',
    summary: 'Teacher schedules a revision (NO Zod body — plain-Error 500 quirk pinned)',
    access: [UserRole.TEACHER],
    responses: {
      201: RevisionRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      500: ErrorEnvelope,
    },
  }),
  markRevision: defineContract({
    method: 'PUT',
    path: '/api/v1/revisions/:id',
    summary:
      'Close a card (COMPLETED/MISSED); SM-2 schedules the next PENDING card. ADMIN is 403 (legacy authorize quirk)',
    access: [UserRole.STUDENT, UserRole.TEACHER],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: RevisionRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      500: ErrorEnvelope,
    },
  }),
  deleteRevision: defineContract({
    method: 'DELETE',
    path: '/api/v1/revisions/:id',
    summary: 'Delete a card (never COMPLETED ones); students own-only',
    access: [UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ success: z.literal(true) }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
};
