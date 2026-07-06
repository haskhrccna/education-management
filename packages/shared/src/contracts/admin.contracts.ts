import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';
import {
  CreateTeacherSchema,
  BroadcastMessageSchema,
  UpdateUserSchema,
  BulkApproveSchema,
  BulkDeactivateSchema,
} from '../validators/common';

const ADMIN = [UserRole.ADMIN];

const RoleEnum = z.enum(['STUDENT', 'TEACHER', 'ADMIN', 'PARENT']);
const StatusEnum = z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'BANNED']);

/** Raw prisma echo used by list/update (7 fields, with createdAt). */
const AdminUserRow = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: RoleEnum,
  status: StatusEnum,
  createdAt: DateOut,
});

/** Raw prisma echo used by createTeacher/approve/deactivate (6 fields, no createdAt). */
const AdminUserCard = AdminUserRow.omit({ createdAt: true });

export const PaginationMeta = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

const BulkResult = z.array(z.object({ id: z.string(), success: z.boolean(), reason: z.string().optional() }));

/** Detail endpoints echo deep prisma composites — loose: pins live in admin-flows.itest.ts. */
const UserDetail = z.object({ user: z.looseObject({ id: z.string() }), analytics: z.looseObject({}) });

const TeacherProgressRow = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  acceptedAppointments: z.number(),
  gradesGiven: z.number(),
  averageGrade: z.number(),
});

const StudentProgressRow = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  gradesReceived: z.number(),
  acceptedAppointments: z.number(),
  averageGrade: z.number(),
});

const BroadcastResult = z.union([
  z.object({ sent: z.literal(true), queued: z.literal(true), message: z.string() }),
  z.object({ sent: z.literal(true), recipients: z.number(), message: z.string() }),
]);

export const adminContracts = {
  listUsers: defineContract({
    method: 'GET',
    path: '/api/v1/admin/users',
    summary: 'Paginated user list, optional ?role= filter — {data, meta} (no success envelope)',
    access: ADMIN,
    request: {
      query: z.object({ role: z.string().optional(), page: z.string().optional(), limit: z.string().optional() }),
    },
    responses: {
      200: z.object({ data: z.array(AdminUserRow), meta: PaginationMeta }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  createTeacher: defineContract({
    method: 'POST',
    path: '/api/v1/admin/teachers',
    summary: 'Create an ACTIVE teacher account',
    access: ADMIN,
    request: { body: CreateTeacherSchema },
    responses: { 201: AdminUserCard, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 409: ErrorEnvelope },
  }),
  approveStudent: defineContract({
    method: 'PUT',
    path: '/api/v1/admin/users/:id/approve',
    summary: 'Approve a PENDING student → ACTIVE (sends approval email)',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: AdminUserCard, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  deactivateUser: defineContract({
    method: 'PUT',
    path: '/api/v1/admin/users/:id/deactivate',
    summary: 'Ban any user',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: AdminUserCard, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  getUserById: defineContract({
    method: 'GET',
    path: '/api/v1/admin/users/:id',
    summary: 'User detail composite {user, analytics}; deviceToken is never selected',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: UserDetail, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  updateUser: defineContract({
    method: 'PUT',
    path: '/api/v1/admin/users/:id',
    summary: 'Partial user update (service rejects role PARENT with 400 — pinned quirk)',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }), body: UpdateUserSchema },
    responses: {
      200: AdminUserRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  deleteUser: defineContract({
    method: 'DELETE',
    path: '/api/v1/admin/users/:id',
    summary: 'Soft-delete: anonymize PII, keep row for referential/audit integrity',
    access: ADMIN,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ id: z.string(), deleted: z.literal(true) }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  teacherProgress: defineContract({
    method: 'GET',
    path: '/api/v1/admin/progress/teachers',
    summary: 'Teacher KPI rows; ?teacherId= returns a raw prisma detail (null if unknown — pinned quirk)',
    access: ADMIN,
    request: { query: z.object({ teacherId: z.string().optional() }) },
    responses: {
      200: z.union([z.array(TeacherProgressRow), z.looseObject({ id: z.string() }), z.null()]),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  studentProgress: defineContract({
    method: 'GET',
    path: '/api/v1/admin/progress/students',
    summary: 'Student KPI rows; ?studentId= returns a raw prisma detail (null if unknown)',
    access: ADMIN,
    request: { query: z.object({ studentId: z.string().optional() }) },
    responses: {
      200: z.union([z.array(StudentProgressRow), z.looseObject({ id: z.string() }), z.null()]),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  broadcast: defineContract({
    method: 'POST',
    path: '/api/v1/admin/broadcast',
    summary: 'Broadcast to all users or one role; queued via Redis or sync fallback',
    access: ADMIN,
    request: { body: BroadcastMessageSchema },
    responses: { 200: BroadcastResult, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  bulkApprove: defineContract({
    method: 'POST',
    path: '/api/v1/admin/bulk/approve',
    summary: 'Approve up to 100 students; per-id result rows',
    access: ADMIN,
    request: { body: BulkApproveSchema },
    responses: { 200: BulkResult, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  bulkDeactivate: defineContract({
    method: 'POST',
    path: '/api/v1/admin/bulk/deactivate',
    summary: 'Ban up to 100 users; per-id result rows',
    access: ADMIN,
    request: { body: BulkDeactivateSchema },
    responses: { 200: BulkResult, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  auditLogs: defineContract({
    method: 'GET',
    path: '/api/v1/admin/audit-logs',
    summary: 'Paginated audit trail (newest first); filters: ?userId=, ?action=',
    access: ADMIN,
    request: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        userId: z.string().optional(),
        action: z.string().optional(),
      }),
    },
    responses: {
      200: z.object({
        data: z.array(
          z.object({
            id: z.string(),
            userId: z.string().nullable(),
            action: z.string(),
            resourceType: z.string(),
            resourceId: z.string().nullable(),
            details: z.unknown(),
            ipAddress: z.string().nullable(),
            userAgent: z.string().nullable(),
            createdAt: DateOut,
            user: z
              .object({ id: z.string(), firstName: z.string(), lastName: z.string(), email: z.string() })
              .nullable(),
          })
        ),
        meta: PaginationMeta,
      }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
};
