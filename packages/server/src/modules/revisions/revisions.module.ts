import { learningContracts } from '@quran-review/shared';
import * as revisionService from '../../services/revision.service';
import type { RevisionStatus } from '../../services/revision.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listRevisions = defineRoute(learningContracts.listRevisions, async ({ query, userId, userRole }) => {
  const surahId = query.surahId ? parseInt(String(query.surahId), 10) : undefined;
  if (surahId !== undefined && isNaN(surahId)) {
    // Legacy parity: hand-built envelope WITHOUT meta. Returned as the body
    // here (not written via res directly) so the contract-router remains the
    // single writer of the response — no double-send.
    return { status: 400 as const, body: { success: false as const, error: 'Invalid surahId' } };
  }
  const revisions = await revisionService.getRevisions(userId!, userRole as 'STUDENT' | 'TEACHER', surahId);
  return { status: 200 as const, body: revisions };
});

const createRevision = defineRoute(learningContracts.createRevision, async ({ userId, req }) => {
  const { studentId, surahId, scheduledFor } = (req.body ?? {}) as {
    studentId?: string;
    surahId?: unknown;
    scheduledFor?: string;
  };
  // Legacy parity: plain Error throws → 500 via errorHandler (pinned quirk).
  if (!studentId) throw new Error('studentId is required');
  if (!surahId || typeof surahId !== 'number') throw new Error('surahId is required');
  if (!scheduledFor) throw new Error('scheduledFor is required');
  const revision = await revisionService.createRevision(userId!, studentId, surahId, new Date(scheduledFor));
  return { status: 201 as const, body: revision };
});

const markRevision = defineRoute(learningContracts.markRevision, async ({ params, userId, userRole, req }) => {
  const status = (req.body ?? {}).status as RevisionStatus;
  if (!status) throw new Error('status is required');
  const revision = await revisionService.updateRevision(
    String(params.id),
    userId!,
    userRole as 'STUDENT' | 'TEACHER' | 'ADMIN',
    status
  );
  return { status: 200 as const, body: revision };
});

const deleteRevision = defineRoute(learningContracts.deleteRevision, async ({ params, userId, userRole }) => {
  const result = await revisionService.deleteRevision(
    String(params.id),
    userId!,
    userRole as 'STUDENT' | 'TEACHER' | 'ADMIN'
  );
  return { status: 200 as const, body: result as { success: true } };
});

export const revisionsRouter = buildContractRouter([listRevisions, createRevision, markRevision, deleteRevision], {
  mountPrefix: '/api/v1/revisions',
});
