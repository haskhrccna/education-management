export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
}

// Prisma uses uppercase string literals — keep in sync
export type PrismaRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export const toPrismaRole = (role: UserRole): PrismaRole => role as PrismaRole;
