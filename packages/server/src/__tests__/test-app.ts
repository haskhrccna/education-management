import request from 'supertest';
import express from 'express';
import { UserRole } from '@edu/shared';

// Create a test app with overrideable auth
export function createTestApp(userOverride?: { userId: string; userRole: UserRole }) {
  // Reset modules to get fresh app instance
  jest.resetModules();

  // Mock auth middleware before importing app
  jest.doMock('../middleware/auth.middleware', () => ({
    authenticate: (req: any, _res: any, next: any) => {
      if (userOverride) {
        req.userId = userOverride.userId;
        req.userRole = userOverride.userRole;
      }
      next();
    },
    authorize: (...roles: UserRole[]) => {
      return (req: any, res: any, next: any) => {
        if (!userOverride) return res.status(401).json({ error: 'Unauthorized' });
        if (!roles.includes(userOverride.userRole)) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        next();
      };
    },
  }));

  const { default: app } = require('../app');
  return request(app);
}

export const testUsers = {
  admin: { userId: 'admin-1', userRole: UserRole.ADMIN },
  teacher: { userId: 'teacher-1', userRole: UserRole.TEACHER },
  student: { userId: 'student-1', userRole: UserRole.STUDENT },
  teacher2: { userId: 'teacher-2', userRole: UserRole.TEACHER },
  student2: { userId: 'student-2', userRole: UserRole.STUDENT },
};
