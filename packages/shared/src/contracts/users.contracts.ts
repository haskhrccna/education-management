import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UpdateProfileSchema, ChangePasswordSchema } from '../validators/common';
import { DeviceTokenSchema } from '../validators/auth';

const NameCard = z.object({ id: z.string(), firstName: z.string(), lastName: z.string() });

/** RAW response (no success envelope) — M0-pinned surprise. Role/status lowercased for mobile. */
const Profile = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['student', 'teacher', 'admin', 'parent']),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(['pending', 'approved', 'active', 'banned']),
  emailVerifiedAt: DateOut.nullable(),
  createdAt: DateOut,
  assignedTeacher: NameCard.nullable(),
  assignedStudents: z.array(NameCard),
});

const UpdatedProfile = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['student', 'teacher', 'admin', 'parent']),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(['pending', 'approved', 'active', 'banned']),
  createdAt: DateOut,
});

export const usersContracts = {
  getProfile: defineContract({
    method: 'GET',
    path: '/api/v1/users/profile',
    summary: 'Own profile — RAW object, lowercase role/status, teacher/student relations',
    access: 'authenticated',
    responses: { 200: Profile, 401: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  listTeachers: defineContract({
    method: 'GET',
    path: '/api/v1/users/teachers',
    summary: 'ACTIVE teachers as a RAW array of {id,firstName,lastName}, firstName asc',
    access: 'authenticated',
    responses: { 200: z.array(NameCard), 401: ErrorEnvelope },
  }),
  updateProfile: defineContract({
    method: 'PUT',
    path: '/api/v1/users/profile',
    summary: 'Update own first/last name',
    access: 'authenticated',
    request: { body: UpdateProfileSchema },
    responses: { 200: UpdatedProfile, 400: ErrorEnvelope, 401: ErrorEnvelope },
  }),
  changePassword: defineContract({
    method: 'PUT',
    path: '/api/v1/users/change-password',
    summary: 'Change own password (verifies current password)',
    access: 'authenticated',
    request: { body: ChangePasswordSchema },
    responses: {
      200: z.object({ message: z.string() }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  saveDeviceToken: defineContract({
    method: 'POST',
    path: '/api/v1/users/device-token',
    summary: 'Store the FCM/Expo push token on the user row',
    access: 'authenticated',
    request: { body: DeviceTokenSchema },
    responses: { 200: z.object({ saved: z.literal(true) }), 400: ErrorEnvelope, 401: ErrorEnvelope },
  }),
};
