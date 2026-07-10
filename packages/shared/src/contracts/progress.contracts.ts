import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';

const Ok = <T extends z.ZodType>(data: T) => z.looseObject({ success: z.literal(true), data });

const StreakRow = z.looseObject({
  userId: z.string(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastActiveDate: DateOut.nullable(),
});

const ParentLinkRow = z.looseObject({
  id: z.string(),
  parentId: z.string(),
  studentId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED']),
  reason: z.string().nullable(),
});

const MiniStudent = z.looseObject({ id: z.string(), firstName: z.string(), lastName: z.string(), email: z.string() });

export const progressContracts = {
  gamificationMe: defineContract({
    method: 'GET',
    path: '/api/v1/gamification/me',
    summary: 'Own streak (zero-default) + earned badges',
    access: 'authenticated',
    responses: {
      200: Ok(z.looseObject({ streak: StreakRow, badges: z.array(z.looseObject({ code: z.string() })) })),
      401: ErrorEnvelope,
    },
  }),
  leaderboard: defineContract({
    method: 'GET',
    path: '/api/v1/gamification/leaderboard',
    summary: "Streak leaderboard; ?scope=teacher:<id> filters to that teacher's ACCEPTED students; ?limit NaN→20",
    access: 'authenticated',
    responses: { 200: Ok(z.array(z.looseObject({ userId: z.string() }))), 401: ErrorEnvelope },
  }),
  adminAnalytics: defineContract({
    method: 'GET',
    path: '/api/v1/analytics',
    summary: 'Admin dashboard aggregates',
    access: [UserRole.ADMIN],
    responses: {
      200: Ok(
        z.looseObject({
          surahMissRates: z.array(z.unknown()),
          teacherLoad: z.array(z.unknown()),
          weeklyActiveStudents: z.unknown(),
        })
      ),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  requestParentLink: defineContract({
    method: 'POST',
    path: '/api/v1/parents/links',
    summary: 'Parent requests a PENDING link. Manual body validation (no validate()) — pinned messages',
    access: [UserRole.PARENT],
    responses: {
      201: Ok(ParentLinkRow),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  listParentLinks: defineContract({
    method: 'GET',
    path: '/api/v1/parents/links',
    summary: 'Parents: own links (student include). Admins: all (parent+student includes)',
    access: [UserRole.PARENT, UserRole.ADMIN],
    responses: { 200: Ok(z.array(ParentLinkRow)), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  parentChildren: defineContract({
    method: 'GET',
    path: '/api/v1/parents/children',
    summary: 'APPROVED children: {linkId, linkedAt, digestOptOut, guardianConsentStatus, student}',
    access: [UserRole.PARENT],
    responses: {
      200: Ok(z.array(z.looseObject({ linkId: z.string(), student: MiniStudent }))),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  parentStudentSearch: defineContract({
    method: 'GET',
    path: '/api/v1/parents/student-search',
    summary: '?email= exact match on ACTIVE students; missing/unknown ⇒ 404 Student not found',
    access: [UserRole.PARENT],
    responses: { 200: Ok(MiniStudent), 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  childDashboard: defineContract({
    method: 'GET',
    path: '/api/v1/parents/children/:studentId/dashboard',
    summary: 'Read-only child dashboard; requires APPROVED link (403 otherwise)',
    access: [UserRole.PARENT],
    responses: {
      200: Ok(
        z.looseObject({
          student: MiniStudent,
          memorization: z.array(z.unknown()),
          grades: z.array(z.unknown()),
          attendance: z.array(z.unknown()),
          upcomingAppointments: z.array(z.unknown()),
          pendingRevisions: z.array(z.unknown()),
        })
      ),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  decideParentLink: defineContract({
    method: 'PATCH',
    path: '/api/v1/parents/links/:id/decision',
    summary: 'APPROVE (idempotent, fires consent init + notification) or DENY; manual action validation — pinned',
    access: [UserRole.ADMIN],
    responses: {
      200: Ok(ParentLinkRow),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
};
