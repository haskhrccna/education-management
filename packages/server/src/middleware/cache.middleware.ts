import { createHash } from 'crypto';
import { RequestHandler } from 'express';

/**
 * Strong ETag + Cache-Control for read-mostly Qur'an content endpoints
 * (/api/v1/surahs, /api/v1/mushaf/page/:page, /api/v1/mushaf/surahs/:id).
 *
 * Contract-router handlers produce the JSON body as an object; we hook the
 * response stream at the middleware layer so the router code stays untouched.
 * - Weak validators (ETag from body hash) so JSON key-order is stable.
 * - `private, max-age=…, must-revalidate`: content is per-user authenticated;
 *   shared proxies must not cache it, but the browser + SW may.
 */
export function withContentCache(maxAgeSeconds = 86400): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      try {
        const json = JSON.stringify(body);
        const etag = `"${createHash('sha1').update(json).digest('base64url')}"`;
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', `private, max-age=${maxAgeSeconds}, must-revalidate`);
        res.setHeader('Vary', 'Authorization, Accept-Encoding');
        // 304 short-circuit: compare against If-None-Match.
        const inm = req.headers['if-none-match'];
        if (
          inm &&
          String(inm)
            .split(',')
            .map((s) => s.trim())
            .includes(etag)
        ) {
          res.status(304).end();
          return res;
        }
      } catch {
        /* etag is best-effort; fall through and send the body */
      }
      return originalJson(body);
    }) as typeof res.json;
    next();
  };
}
