import * as z from 'zod';
import { GradeType } from '../enums/gradeType';
import { MessageType } from '../enums/messageType';

export const uuidSchema = z.string().uuid();
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must not exceed 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
export const emailSchema = z.string().email().max(255);
export const nameSchema = z.string().min(1).max(100);
export const fileNameSchema = z.string().min(1).max(255);
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)');
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['student', 'teacher']),
  firstName: nameSchema,
  lastName: nameSchema,
});

export const CreateAppointmentSchema = z.object({
  teacherId: uuidSchema,
  requestedDate: dateSchema,
  requestedTime: timeSchema,
  durationMinutes: z.number().int().min(15).max(240).default(60),
});

export const ManageAppointmentSchema = z.object({
  action: z.enum(['ACCEPTED', 'AMENDED', 'REJECTED']),
  amendedNote: z.string().max(1000).optional(),
});

export const CreateGradeSchema = z.object({
  studentId: uuidSchema,
  // Quran-only: every grade is tied to a Surah. The Surah picker in the
  // mobile form populates this; null is allowed for "overall" assessments
  // that don't pin to a specific surah (e.g. end-of-term recital).
  surahId: z.number().int().positive().nullable(),
  grade: z.string().max(10),
  type: z.nativeEnum(GradeType),
  notes: z.string().max(500).optional(),
});

export const SendMessageSchema = z.object({
  receiverId: uuidSchema,
  content: z.string().min(1).max(2000),
  type: z.enum([MessageType.TEXT, MessageType.FILE]).optional(),
});

export const CreateRecordingSchema = z.object({
  fileName: fileNameSchema,
  fileSizeBytes: z.coerce.number().int().min(0),
  contentType: z.string().min(1).max(100),
});

export const GenerateReportSchema = z.object({
  studentId: uuidSchema,
  summary: z.string().max(2000),
});

export const BroadcastMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  targetRole: z.enum(['student', 'teacher', 'admin', 'parent']).optional(),
});

export const CreateTeacherSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});

export const UpdateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(32, 'Refresh token must be at least 32 characters'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const UpdateUserSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: emailSchema.optional(),
  status: z.enum(['ACTIVE', 'PENDING', 'BANNED']).optional(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN', 'PARENT']).optional(),
});

export const BulkApproveSchema = z.object({
  studentIds: z.array(uuidSchema).min(1).max(100),
});

export const BulkDeactivateSchema = z.object({
  userIds: z.array(uuidSchema).min(1).max(100),
});

export type ZodLoginInput = z.infer<typeof LoginSchema>;
export type ZodRegisterInput = z.infer<typeof RegisterSchema>;
export type ZodCreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type ZodManageAppointmentInput = z.infer<typeof ManageAppointmentSchema>;
export type ZodCreateGradeInput = z.infer<typeof CreateGradeSchema>;
export type ZodSendMessageInput = z.infer<typeof SendMessageSchema>;
export type ZodCreateRecordingInput = z.infer<typeof CreateRecordingSchema>;
export type ZodGenerateReportInput = z.infer<typeof GenerateReportSchema>;
export type ZodBroadcastMessageInput = z.infer<typeof BroadcastMessageSchema>;
export type ZodCreateTeacherInput = z.infer<typeof CreateTeacherSchema>;
export type ZodUpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ZodRefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ZodChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ZodUpdateUserInput = z.infer<typeof UpdateUserSchema>;
