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
  // parent-links consent (new capability — guardian consent, roadmap 4.1)
  { method: 'PATCH', path: '/api/v1/parent-links/:id/consent', access: ['PARENT'] },
  // account (new capability — self-service data export + deletion, roadmap 4.2)
  { method: 'GET', path: '/api/v1/account/data-export', access: 'authenticated' },
  {
    method: 'DELETE',
    path: '/api/v1/account',
    access: 'authenticated',
    skip: 'self-deletes the calling identity, which would break every subsequent matrix request for that role — covered by its own itest instead',
  },
  // recurring-slots (new capability — standing weekly appointment slots)
  { method: 'POST', path: '/api/v1/recurring-slots', access: ['STUDENT'] },
  { method: 'GET', path: '/api/v1/recurring-slots', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/recurring-slots/:id', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/recurring-slots/:id/cancel', access: 'authenticated' },
  // weak-ayahs (new capability — per-ayah weak-spot drilling)
  { method: 'POST', path: '/api/v1/weak-ayahs', access: ['TEACHER'] },
  { method: 'GET', path: '/api/v1/weak-ayahs', access: 'authenticated' },
  // curriculum-plans (new capability — structured memorization plans with pace)
  { method: 'POST', path: '/api/v1/curriculum-plans', access: ['TEACHER'] },
  { method: 'GET', path: '/api/v1/curriculum-plans', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/curriculum-plans/:id', access: 'authenticated' },
  // milestones (new capability — admin-managed milestone catalog)
  { method: 'POST', path: '/api/v1/milestones', access: ['ADMIN'] },
  { method: 'GET', path: '/api/v1/milestones', access: ['ADMIN'] },
  // ijazahs (new capability — sanad/chain-of-transmission tracking)
  { method: 'POST', path: '/api/v1/ijazahs', access: ['TEACHER'] },
  { method: 'GET', path: '/api/v1/ijazahs', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/ijazahs/:id', access: 'authenticated' },
  { method: 'PATCH', path: '/api/v1/ijazahs/:id/regenerate-link', access: ['STUDENT'] },
  // certificates regenerate-link (new capability — shareable verified certificates)
  { method: 'PATCH', path: '/api/v1/certificates/:id/regenerate-link', access: ['STUDENT'] },
  // verify (new capability — public, no-login verification page; not a JSON contract)
  { method: 'GET', path: '/api/v1/verify/:token', access: 'public' },
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
  // halaqa groups (new capability — collective attendance streak, roadmap 3.4)
  { method: 'GET', path: '/api/v1/halaqa/groups', access: 'authenticated' },
  { method: 'POST', path: '/api/v1/halaqa/groups', access: 'authenticated' },
  { method: 'GET', path: '/api/v1/halaqa/groups/:id', access: 'authenticated' },
];

const topLevel: EndpointSpec[] = [
  { method: 'GET', path: '/api/health', access: 'public' },
  // NODE_ENV=test mounts docs behind authenticate+authorize(ADMIN) (public only in development)
  { method: 'GET', path: '/api/docs', access: ['ADMIN'] },
  { method: 'GET', path: '/metrics', access: ['ADMIN'] },
];

// Legacy /api/* mirrors were retired in M13 — mobile is fully on /api/v1.
export const endpointManifest: EndpointSpec[] = [...v1, ...topLevel];
