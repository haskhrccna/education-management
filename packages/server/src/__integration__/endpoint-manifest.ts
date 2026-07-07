export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Access = 'public' | 'authenticated' | ('STUDENT' | 'TEACHER' | 'ADMIN' | 'PARENT')[];

export interface EndpointSpec {
  method: HttpMethod;
  path: string;
  access: Access;
  /** Excluded from the authz matrix with a reason (still counted for completeness). */
  skip?: string;
}

const v1: EndpointSpec[] = [
  // auth
  { method: 'POST', path: '/api/v1/auth/register', access: 'public' },
  { method: 'POST', path: '/api/v1/auth/login', access: 'public' },
  { method: 'POST', path: '/api/v1/auth/refresh', access: 'public' },
  { method: 'POST', path: '/api/v1/auth/logout', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/auth/verify-email', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/auth/resend-verification', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/auth/forgot-password', access: 'public' },
  { method: 'POST', path: '/api/v1/auth/reset-password', access: 'public' },
  // users
  { method: 'GET', path: '/api/v1/users/profile', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/users/teachers', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/users/profile', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/users/change-password', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/users/device-token', access: 'authenticated' },
  // appointments
  { method: 'GET', path: '/api/v1/appointments', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/appointments', access: ['STUDENT'] },
  { method: 'PUT', path: '/api/v1/appointments/:id', access: ['TEACHER', 'ADMIN'] },
  { method: 'POST', path: '/api/v1/appointments/:id/attendance', access: ['TEACHER'] },
  // grades
  { method: 'GET', path: '/api/v1/grades', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/grades', access: ['TEACHER'] },
  { method: 'GET', path: '/api/v1/grades/student/:id', access: ['TEACHER', 'ADMIN'] },
  // recordings
  { method: 'POST', path: '/api/v1/recordings', access: ['STUDENT'] },
  { method: 'GET', path: '/api/v1/recordings', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/recordings/:id', access: ['TEACHER', 'ADMIN'] },
  { method: 'DELETE', path: '/api/v1/recordings/:id', access: ['TEACHER', 'ADMIN'] },
  // reports
  { method: 'POST', path: '/api/v1/reports', access: ['TEACHER'] },
  { method: 'GET', path: '/api/v1/reports', access: ['TEACHER', 'ADMIN', 'STUDENT'] },
  // admin (router.use(authorize(ADMIN)))
  { method: 'GET', path: '/api/v1/admin/users', access: ['ADMIN'] },
  { method: 'GET', path: '/api/v1/admin/audit-logs', access: ['ADMIN'] },
  { method: 'POST', path: '/api/v1/admin/teachers', access: ['ADMIN'] },
  { method: 'PUT', path: '/api/v1/admin/users/:id/approve', access: ['ADMIN'] },
  { method: 'PUT', path: '/api/v1/admin/users/:id/deactivate', access: ['ADMIN'] },
  { method: 'GET', path: '/api/v1/admin/users/:id', access: ['ADMIN'] },
  { method: 'PUT', path: '/api/v1/admin/users/:id', access: ['ADMIN'] },
  { method: 'DELETE', path: '/api/v1/admin/users/:id', access: ['ADMIN'] },
  { method: 'GET', path: '/api/v1/admin/progress/teachers', access: ['ADMIN'] },
  { method: 'GET', path: '/api/v1/admin/progress/students', access: ['ADMIN'] },
  { method: 'POST', path: '/api/v1/admin/broadcast', access: ['ADMIN'] },
  { method: 'POST', path: '/api/v1/admin/bulk/approve', access: ['ADMIN'] },
  { method: 'POST', path: '/api/v1/admin/bulk/deactivate', access: ['ADMIN'] },
  // messages
  { method: 'GET', path: '/api/v1/messages', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/messages', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/messages/:id/read', access: 'authenticated' },
  // surahs + memorization
  { method: 'GET', path: '/api/v1/surahs', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/memorization', access: 'authenticated' },
  { method: 'PUT', path: '/api/v1/memorization/:surahId', access: ['TEACHER'] },
  { method: 'GET', path: '/api/v1/mushaf/surahs/:id', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/mushaf/pages/:page', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/mushaf/log-memorization', access: 'authenticated' },
  // roster (new capability — teacher-only at-risk aggregation)
  { method: 'GET', path: '/api/v1/roster/health', access: ['TEACHER'] },
  // parent-links (new capability — weekly digest opt-out)
  { method: 'PATCH', path: '/api/v1/parent-links/:id/digest-preference', access: ['PARENT'] },
  // recurring-slots (new capability — standing weekly appointment slots)
  { method: 'POST', path: '/api/v1/recurring-slots', access: ['STUDENT'] },
  { method: 'GET', path: '/api/v1/recurring-slots', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/recurring-slots/:id', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/recurring-slots/:id/cancel', access: 'authenticated' },
  // weak-ayahs (new capability — per-ayah weak-spot drilling)
  { method: 'POST', path: '/api/v1/weak-ayahs', access: ['TEACHER'] },
  { method: 'GET', path: '/api/v1/weak-ayahs', access: 'authenticated' },
  // files (fileAuthenticate: Bearer header OR ?token=)
  { method: 'GET', path: '/api/v1/files/recordings/:id', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/files/reports/:id', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/files/certificates/:id', access: 'authenticated' },
  // exports
  { method: 'GET', path: '/api/v1/exports/grades', access: ['TEACHER', 'ADMIN'] },
  { method: 'GET', path: '/api/v1/exports/appointments', access: ['TEACHER', 'ADMIN'] },
  { method: 'GET', path: '/api/v1/exports/users', access: ['ADMIN'] },
  // teacher-changes
  { method: 'POST', path: '/api/v1/teacher-changes', access: ['STUDENT'] },
  { method: 'GET', path: '/api/v1/teacher-changes', access: ['ADMIN', 'TEACHER', 'STUDENT'] },
  { method: 'PATCH', path: '/api/v1/teacher-changes/:id', access: ['ADMIN'] },
  // revisions
  { method: 'GET', path: '/api/v1/revisions', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/revisions', access: ['TEACHER'] },
  { method: 'PUT', path: '/api/v1/revisions/:id', access: ['STUDENT', 'TEACHER'] },
  { method: 'DELETE', path: '/api/v1/revisions/:id', access: ['STUDENT', 'TEACHER', 'ADMIN'] },
  // notifications
  { method: 'GET', path: '/api/v1/notifications', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/notifications/read-all', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/notifications/unread-count', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/notifications/:id/read', access: 'authenticated' },
  // attendance
  { method: 'GET', path: '/api/v1/attendance', access: 'authenticated' },
  // parents
  { method: 'POST', path: '/api/v1/parents/links', access: ['PARENT'] },
  { method: 'GET', path: '/api/v1/parents/links', access: ['PARENT', 'ADMIN'] },
  { method: 'GET', path: '/api/v1/parents/children', access: ['PARENT'] },
  { method: 'GET', path: '/api/v1/parents/student-search', access: ['PARENT'] },
  { method: 'GET', path: '/api/v1/parents/children/:studentId/dashboard', access: ['PARENT'] },
  { method: 'PATCH', path: '/api/v1/parents/links/:id/decision', access: ['ADMIN'] },
  // gamification
  { method: 'GET', path: '/api/v1/gamification/me', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/gamification/leaderboard', access: 'authenticated' },
  // analytics (router.use(authorize(ADMIN)))
  { method: 'GET', path: '/api/v1/analytics', access: ['ADMIN'] },
  // certificates
  { method: 'GET', path: '/api/v1/certificates', access: 'authenticated' },
  // halaqa
  { method: 'GET', path: '/api/v1/halaqa', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/halaqa', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/halaqa/:id', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/halaqa/:id/start', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/halaqa/:id/end', access: 'authenticated' },
];

const topLevel: EndpointSpec[] = [
  { method: 'GET', path: '/api/health', access: 'public' },
  // NODE_ENV=test mounts docs behind authenticate+authorize(ADMIN) (public only in development)
  { method: 'GET', path: '/api/docs', access: ['ADMIN'] },
  { method: 'GET', path: '/metrics', access: ['ADMIN'] },
];

/** Legacy /api/* mounts in app.ts that mirror /api/v1/* with identical middleware. */
const LEGACY_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/users',
  '/api/v1/appointments',
  '/api/v1/grades',
  '/api/v1/recordings',
  '/api/v1/reports',
  '/api/v1/admin',
  '/api/v1/messages',
  '/api/v1/files',
  '/api/v1/exports',
];

const legacy: EndpointSpec[] = v1
  .filter((e) => LEGACY_PREFIXES.some((p) => e.path === p || e.path.startsWith(`${p}/`)))
  .map((e) => ({ ...e, path: e.path.replace('/api/v1/', '/api/') }));

export const endpointManifest: EndpointSpec[] = [...v1, ...topLevel, ...legacy];
