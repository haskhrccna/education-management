import { z } from 'zod';
import { defineContract, ErrorEnvelope, UserRole, rawResponse, isRawResponse } from '@quran-review/shared';
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

  it('raw responses: rawResponse marker discriminates and yields the handled variant', () => {
    const csv = defineContract({
      method: 'GET',
      path: '/api/v1/csv',
      summary: 'raw test contract',
      access: 'authenticated',
      authVia: 'headerOrQueryToken',
      responses: { 200: rawResponse('text/csv'), 401: ErrorEnvelope },
    });
    expect(isRawResponse(csv.responses[200])).toBe(true);
    expect(isRawResponse(csv.responses[401])).toBe(false);
    expect(csv.responses[200].contentType).toBe('text/csv');
    expect(csv.authVia).toBe('headerOrQueryToken');
    const handled: ContractResponse<typeof csv> = { status: 200, handled: true };
    const err: ContractResponse<typeof csv> = {
      status: 401,
      body: { success: false, error: 'Authentication required' },
    };
    expect(handled.status).toBe(200);
    expect(err.status).toBe(401);
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
