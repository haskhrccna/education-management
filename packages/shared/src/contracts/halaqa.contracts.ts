import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';

const Ok = <T extends z.ZodType>(data: T) => z.looseObject({ success: z.literal(true), data });

const GroupRow = z.looseObject({
  id: z.string(),
  teacherId: z.string(),
  title: z.string(),
  attendanceThreshold: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
});

const RoomRow = z.looseObject({
  id: z.string(),
  teacherId: z.string(),
  title: z.string(),
  status: z.enum(['WAITING', 'LIVE', 'ENDED']),
  groupId: z.string().nullable(),
  startedAt: DateOut.nullable(),
  endedAt: DateOut.nullable(),
});

export const halaqaContracts = {
  listGroups: defineContract({
    method: 'GET',
    path: '/api/v1/halaqa/groups',
    summary: "Teacher's own groups, createdAt desc",
    access: 'authenticated',
    responses: { 200: Ok(z.array(GroupRow)), 401: ErrorEnvelope },
  }),
  createGroup: defineContract({
    method: 'POST',
    path: '/api/v1/halaqa/groups',
    summary: 'Handler-gated TEACHER/ADMIN; manual body validation (pinned messages)',
    access: 'authenticated',
    responses: { 201: Ok(GroupRow), 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  getGroup: defineContract({
    method: 'GET',
    path: '/api/v1/halaqa/groups/:id',
    summary: 'Owner/admin/attendee; others get 404 (not-yours-is-not-found, pinned)',
    access: 'authenticated',
    responses: { 200: Ok(GroupRow), 401: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  listRooms: defineContract({
    method: 'GET',
    path: '/api/v1/halaqa',
    summary: 'Default WAITING+LIVE; ?status= filter; teacher include + _count.participants',
    access: 'authenticated',
    responses: { 200: Ok(z.array(RoomRow)), 401: ErrorEnvelope },
  }),
  createRoom: defineContract({
    method: 'POST',
    path: '/api/v1/halaqa',
    summary: 'Handler-gated TEACHER/ADMIN; title trimmed; optional groupId must be own group',
    access: 'authenticated',
    responses: { 201: Ok(RoomRow), 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  getRoom: defineContract({
    method: 'GET',
    path: '/api/v1/halaqa/:id',
    summary: 'Room with active participants (leftAt null) + user includes',
    access: 'authenticated',
    responses: { 200: Ok(RoomRow), 401: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  startRoom: defineContract({
    method: 'PATCH',
    path: '/api/v1/halaqa/:id/start',
    summary: 'Owner-only; WAITING→LIVE once (409 otherwise)',
    access: 'authenticated',
    responses: { 200: Ok(RoomRow), 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
  }),
  endRoom: defineContract({
    method: 'PATCH',
    path: '/api/v1/halaqa/:id/end',
    summary: 'Owner-or-admin; closes participants; best-effort group streak recompute; 409 if already ended',
    access: 'authenticated',
    responses: { 200: Ok(RoomRow), 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
  }),
};
