import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { defineContract, ErrorEnvelope, UserRole } from '@quran-review/shared';
import { defineRoute, buildContractRouter } from '../lib/contract-router';
import { errorHandler } from '../middleware/error.middleware';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

const echo = defineContract({
  method: 'POST',
  path: '/api/v1/scratch/echo',
  summary: 'itest scratch route',
  access: [UserRole.ADMIN],
  request: { body: z.object({ n: z.number() }) },
  responses: { 200: z.object({ doubled: z.number() }), 401: ErrorEnvelope, 403: ErrorEnvelope, 400: ErrorEnvelope },
});

const open = defineContract({
  method: 'GET',
  path: '/api/v1/scratch/open',
  summary: 'itest public route',
  access: 'public',
  responses: { 200: z.object({ ok: z.literal(true) }) },
});

const broken = defineContract({
  method: 'GET',
  path: '/api/v1/scratch/broken',
  summary: 'itest response-schema violation',
  access: 'public',
  responses: { 200: z.object({ mustBe: z.literal('present') }) },
});

const app = express();
app.use(express.json());
app.use(
  '/api/v1/scratch',
  buildContractRouter(
    [
      defineRoute(echo, async ({ body }) => ({ status: 200 as const, body: { doubled: body.n * 2 } })),
      defineRoute(open, async () => ({ status: 200 as const, body: { ok: true as const } })),
      // deliberately violates its declared 200 schema:
      defineRoute(broken, async () => ({ status: 200 as const, body: {} as { mustBe: 'present' } })),
    ],
    { mountPrefix: '/api/v1/scratch' }
  )
);
app.use(errorHandler);

beforeAll(truncateAll);
afterAll(disconnect);

describe('buildContractRouter', () => {
  it('public route works without a token', async () => {
    const res = await request(app).get('/api/v1/scratch/open');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('anon on protected route → 401 (via real authenticate)', async () => {
    const res = await request(app).post('/api/v1/scratch/echo').send({ n: 1 });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('wrong role → 403 with the pinned role-gate body', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/scratch/echo')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ n: 1 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('invalid body → 400 in the pinned "Validation failed:" format (via real validate)', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app).post('/api/v1/scratch/echo').set('Authorization', `Bearer ${admin.token}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Validation failed: n:/);
  });

  it('valid request → typed handler result serialized as JSON', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .post('/api/v1/scratch/echo')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ n: 21 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ doubled: 42 });
  });

  it('response violating its declared schema → 500 in test env (fail loud)', async () => {
    const res = await request(app).get('/api/v1/scratch/broken');
    expect(res.status).toBe(500);
  });

  it('rejects a contract whose path does not start with the mount prefix', () => {
    expect(() =>
      buildContractRouter([defineRoute(open, async () => ({ status: 200 as const, body: { ok: true as const } }))], {
        mountPrefix: '/api/v1/other',
      })
    ).toThrow(/mountPrefix/);
  });
});
