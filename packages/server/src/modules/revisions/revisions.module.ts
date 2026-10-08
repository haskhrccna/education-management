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
  const revisions = await revisionService.getRevisions(userId!, userRole!, surahId);
  return { status: 200 as const, body: revisions };
});

const createRevision = defineRoute(learningContracts.createRevision, async ({ body, userId }) => {
  // Shape is guaranteed by the contract's Zod body (validate middleware), so a
  // malformed request is a 400 from one place instead of a hand-rolled 500.
  const revision = await revisionService.createRevision(
    userId!,
    body.studentId,
    body.surahId,
    new Date(body.scheduledFor)
  );
  return { status: 201 as const, body: revision };
});

const markRevision = defineRoute(learningContracts.markRevision, async ({ body, params, userId, userRole }) => {
  const revision = await revisionService.updateRevision(
    String(params.id),
    userId!,
    userRole as 'STUDENT' | 'TEACHER' | 'ADMIN',
    body.status as RevisionStatus
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
