import { z } from 'zod';
import { defineContract, ErrorEnvelope, UserRole } from '@quran-review/shared';
import type { ContractResponse } from '@quran-review/shared';

describe('contract DSL', () => {
  const ping = defineContract({
    method: 'POST',
    path: '/api/v1/ping/:id',
    summary: 'test contract',
    access: [UserRole.ADMIN],
    request: { body: z.object({ n: z.number() }) },
    responses: { 200: z.object({ doubled: z.number() }), 403: ErrorEnvelope },
  });

  it('defineContract returns its input unchanged (identity with inference)', () => {
    expect(ping.method).toBe('POST');
    expect(ping.path).toBe('/api/v1/ping/:id');
    expect(ping.access).toEqual([UserRole.ADMIN]);
  });

  it('response union types are usable (compile-time check exercised at runtime)', () => {
    const ok: ContractResponse<typeof ping> = { status: 200, body: { doubled: 4 } };
    const denied: ContractResponse<typeof ping> = {
      status: 403,
      body: { success: false, error: 'Insufficient permissions' },
    };
    expect(ok.status).toBe(200);
    expect(denied.status).toBe(403);
  });

  it('ErrorEnvelope matches the pinned error shape', () => {
    expect(ErrorEnvelope.parse({ success: false, error: 'Not found' })).toEqual({
      success: false,
      error: 'Not found',
    });
    expect(ErrorEnvelope.parse({ success: false, error: 'x', meta: { requestId: 'r-1' } }).meta).toEqual({
      requestId: 'r-1',
    });
  });
});
