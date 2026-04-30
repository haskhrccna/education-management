export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
}

// Prisma uses uppercase string literals — keep in sync
export type PrismaRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export const toPrismaRole = (role: UserRole): PrismaRole => role.toUpperCase() as PrismaRole;
