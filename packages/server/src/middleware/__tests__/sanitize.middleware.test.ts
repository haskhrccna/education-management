import express, { Request, Response } from 'express';
import request from 'supertest';
import { sanitizeResponse } from '../sanitize.middleware';

const app = express();
app.use(sanitizeResponse);

app.get('/date', (_req: Request, res: Response) => {
  res.json({ createdAt: new Date('2024-01-15T08:30:00Z'), name: 'Test' });
});

app.get('/nested', (_req: Request, res: Response) => {
  res.json({
    user: {
      password: 'secret123',
      passwordHash: 'abc',
      tokenHash: 'xyz',
      email: 'a@b.com',
      passwordChangedAt: new Date('2024-01-15T08:30:00Z'),
    },
  });
});

app.get('/buffer', (_req: Request, res: Response) => {
  res.json({ data: Buffer.from('hello'), name: 'Test' });
});

app.get('/array', (_req: Request, res: Response) => {
  res.json({ items: [{ password: 'x', id: 1 }, { id: 2 }] });
});

describe('sanitizeResponse middleware', () => {
  it('leaves Date instances intact', async () => {
    const res = await request(app).get('/date');
    expect(res.status).toBe(200);
    expect(res.body.createdAt).toBe('2024-01-15T08:30:00.000Z');
    expect(res.body.name).toBe('Test');
  });

  it('redacts exact sensitive fields but preserves passwordChangedAt', async () => {
    const res = await request(app).get('/nested');
    expect(res.status).toBe(200);
    expect(res.body.user.password).toBe('[REDACTED]');
    expect(res.body.user.passwordHash).toBe('[REDACTED]');
    expect(res.body.user.tokenHash).toBe('[REDACTED]');
    expect(res.body.user.email).toBe('a@b.com');
    expect(res.body.user.passwordChangedAt).toBe('2024-01-15T08:30:00.000Z');
  });

  it('leaves Buffer instances intact', async () => {
    const res = await request(app).get('/buffer');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ type: 'Buffer', data: [104, 101, 108, 108, 111] });
    expect(res.body.name).toBe('Test');
  });

  it('redacts sensitive fields inside arrays', async () => {
    const res = await request(app).get('/array');
    expect(res.status).toBe(200);
    expect(res.body.items[0].password).toBe('[REDACTED]');
    expect(res.body.items[0].id).toBe(1);
    expect(res.body.items[1].id).toBe(2);
  });
});
