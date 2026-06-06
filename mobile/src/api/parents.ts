/**
 * Phase 3 (Parent role) — Mobile API client stub.
 *
 * Backend at GET /api/v1/parents, POST /api/v1/parents/links, etc. is ready
 * (see packages/server/src/services/parent.service.ts). Mobile wiring is
 * intentionally deferred until the apiClient issue documented in
 * tasks/todo.md Phase 1 is resolved.
 *
 * Expected endpoints (typed stubs):
 *   GET    /api/v1/parents/links
 *   POST   /api/v1/parents/links          { studentId, reason? }
 *   PATCH  /api/v1/parents/links/:id/decision   { action: 'APPROVE'|'DENY', note? }  (admin)
 *   GET    /api/v1/parents/children
 *   GET    /api/v1/parents/children/:studentId/dashboard
 */

export type ParentLinkStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface ParentLink {
  id: string;
  parentId: string;
  studentId: string;
  status: ParentLinkStatus;
  reason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface ChildSummary {
  linkId: string;
  linkedAt: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
}

export interface ChildDashboard {
  student: { id: string; firstName: string; lastName: string; email: string; status: string; createdAt: string };
  memorization: unknown[];
  grades: unknown[];
  attendance: unknown[];
  upcomingAppointments: unknown[];
  pendingRevisions: unknown[];
}

// TODO(Phase 3): wire to apiClient once the broken-typed-client issue (Phase 1
// task 1/2) is resolved. Until then this file exports the contract only.
