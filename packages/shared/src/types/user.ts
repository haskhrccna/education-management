import { UserRole } from '../enums/roles';

export enum UserStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ACTIVE = 'active',
  BANNED = 'banned',
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}
