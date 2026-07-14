import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../prisma/client';
import { config } from '../config';

export interface TestUser {
  id: string;
  email: string;
  role: Role;
  token: string;
}

let seq = 0;

/** Mint a JWT exactly like auth.service.ts does: { userId, role } signed with config.jwtSecret. */
export function tokenFor(userId: string, role: Role): string {
  return jwt.sign({ userId, role }, config.jwtSecret, { expiresIn: '1h' });
}

export async function createUser(opts: {
  role: Role;
  status?: UserStatus;
  email?: string;
  password?: string;
  assignedTeacherId?: string;
}): Promise<TestUser> {
  const email = opts.email ?? `itest-${opts.role.toLowerCase()}-${++seq}-${Date.now()}@itest.local`;
  const passwordHash = await bcrypt.hash(opts.password ?? 'Test1234!', 4); // low cost: test speed
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: opts.role,
      firstName: 'Itest',
      lastName: opts.role,
      status: opts.status ?? UserStatus.ACTIVE,
      assignedTeacherId: opts.assignedTeacherId ?? null,
    },
  });
  return { id: user.id, email: user.email, role: user.role, token: tokenFor(user.id, user.role) };
}
