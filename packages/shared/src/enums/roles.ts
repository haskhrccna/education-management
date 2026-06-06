export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
  PARENT = 'PARENT',
}

// Prisma uses uppercase string literals — keep in sync
export type PrismaRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'PARENT';

export const toPrismaRole = (role: UserRole): PrismaRole => role as PrismaRole;
