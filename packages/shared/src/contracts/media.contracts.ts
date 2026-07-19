import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut, rawResponse } from './types';
import { UserRole } from '../enums/roles';
import { CreateRecordingSchema, GenerateReportSchema } from '../validators/common';

/** Raw Prisma Recording echo (list adds a `student` include — looseObject tolerates it). */
const RecordingRow = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  url: z.string(),
  fileName: z.string(),
  fileSizeBytes: z.number(),
  contentType: z.string(),
  reviewNotes: z.string().nullable(),
  approvedAt: DateOut.nullable(),
  rejectedAt: DateOut.nullable(),
  createdAt: DateOut,
  // Recite-from-the-page (F2): mushaf page / surah the recitation covers.
  page: z.number().nullable().optional(),
  surahId: z.number().nullable().optional(),
});

const ReportRow = z.looseObject({
  id: z.string(),
  teacherId: z.string(),
  studentId: z.string(),
  pdfUrl: z.string(),
  summary: z.string(),
  generatedAt: DateOut,
});

export const mediaContracts = {
  uploadRecording: defineContract({
    method: 'POST',
    path: '/api/v1/recordings',
    summary: 'Student uploads a recitation (multipart; multer runs in pre, before validate) — 201 raw Recording',
    access: [UserRole.STUDENT],
    request: { body: CreateRecordingSchema },
    responses: {
      201: RecordingRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      413: ErrorEnvelope,
    },
  }),
  listRecordings: defineContract({
    method: 'GET',
    path: '/api/v1/recordings',
    summary: 'Role-scoped raw array: student own, teacher accepted-appointment students, admin all',
    access: 'authenticated',
    responses: { 200: z.array(RecordingRow), 401: ErrorEnvelope },
  }),
  reviewRecording: defineContract({
    method: 'PUT',
    path: '/api/v1/recordings/:id',
    summary: 'Teacher/admin review. Body unvalidated by design (pinned): missing approved ⇒ rejectedAt set',
    access: [UserRole.TEACHER, UserRole.ADMIN],
    responses: { 200: RecordingRow, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  deleteRecording: defineContract({
    method: 'DELETE',
    path: '/api/v1/recordings/:id',
    summary: 'Teacher/admin delete (relationship-guarded); removes the stored file',
    access: [UserRole.TEACHER, UserRole.ADMIN],
    responses: {
      200: z.object({ message: z.literal('Recording deleted') }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),

  generateReport: defineContract({
    method: 'POST',
    path: '/api/v1/reports',
    summary: 'Teacher generates a PDF report for a linked student — 201 raw Report',
    access: [UserRole.TEACHER],
    request: { body: GenerateReportSchema },
    responses: { 201: ReportRow, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  listReports: defineContract({
    method: 'GET',
    path: '/api/v1/reports',
    summary: 'Raw array: student ⇒ own (studentId), teacher/admin ⇒ authored (teacherId) — pinned as-is',
    access: [UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT],
    responses: { 200: z.array(ReportRow), 401: ErrorEnvelope },
  }),

  downloadRecordingFile: defineContract({
    method: 'GET',
    path: '/api/v1/files/recordings/:id',
    summary: 'Attachment stream; owner/admin/relationship-guarded teacher. ?token= auth pinned',
    access: 'authenticated',
    authVia: 'headerOrQueryToken',
    responses: {
      200: rawResponse('application/octet-stream'),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  downloadReportFile: defineContract({
    method: 'GET',
    path: '/api/v1/files/reports/:id',
    summary: 'Attachment stream; owner/admin/relationship-guarded teacher. ?token= auth pinned',
    access: 'authenticated',
    authVia: 'headerOrQueryToken',
    responses: {
      200: rawResponse('application/octet-stream'),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  downloadCertificateFile: defineContract({
    method: 'GET',
    path: '/api/v1/files/certificates/:id',
    summary: 'Attachment stream; owner/admin only (no teacher path). ?token= auth pinned',
    access: 'authenticated',
    authVia: 'headerOrQueryToken',
    responses: {
      200: rawResponse('application/octet-stream'),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),

  exportGrades: defineContract({
    method: 'GET',
    path: '/api/v1/exports/grades',
    summary: 'CSV attachment "grades.csv"; optional ?studentId=&teacherId= filters',
    access: [UserRole.TEACHER, UserRole.ADMIN],
    responses: { 200: rawResponse('text/csv'), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  exportAppointments: defineContract({
    method: 'GET',
    path: '/api/v1/exports/appointments',
    summary: 'CSV attachment "appointments.csv"',
    access: [UserRole.TEACHER, UserRole.ADMIN],
    responses: { 200: rawResponse('text/csv'), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  exportUsers: defineContract({
    method: 'GET',
    path: '/api/v1/exports/users',
    summary: 'CSV attachment "users.csv"; optional ?role= filter',
    access: [UserRole.ADMIN],
    responses: { 200: rawResponse('text/csv'), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
};
