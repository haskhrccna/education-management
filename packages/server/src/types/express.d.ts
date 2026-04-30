import type { UserRole } from '@edu/shared';

declare module 'express' {
  interface Request {
    userId?: string;
    userRole?: UserRole;
   }
}
