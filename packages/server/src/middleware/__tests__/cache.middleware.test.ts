import express from 'express';
import request from 'supertest';
import { withContentCache } from '../cache.middleware';

describe('withContentCache (ETag + Cache-Control for stable content)', () => {
  const buildApp = () => {
    const app = express();
    app.use(withContentCache(86400));
    app.get('/x', (_req, res) => res.json({ stable: true, n: 42 }));
    return app;
  };

  it('sets ETag and Cache-Control on JSON GET responses', async () => {
    const res = await request(buildApp()).get('/x');
    expect(res.status).toBe(200);
    expect(res.headers.etag).toMatch(/^".+"$/);
    expect(res.headers['cache-control']).toContain('max-age=86400');
    expect(res.headers['cache-control']).toContain('must-revalidate');
  });

  it('returns 304 with an empty body when If-None-Match hits', async () => {
    const app = buildApp();
    const first = await request(app).get('/x');
    const etag = first.headers.etag as string;

    const second = await request(app).get('/x').set('If-None-Match', etag);
    expect(second.status).toBe(304);
    expect(second.text).toBe('');
    expect(second.headers.etag).toBe(etag);
  });

  it('does not 200→304 a different body under the same route', async () => {
    const app = express();
    let body: Record<string, unknown> = { v: 1 };
    app.use(withContentCache(60));
    app.get('/y', (_req, res) => res.json(body));
    const first = await request(app).get('/y');
    body = { v: 2 };
    const second = await request(app)
      .get('/y')
      .set('If-None-Match', first.headers.etag as string);
    expect(second.status).toBe(200);
    expect(second.body.v).toBe(2);
  });
});
