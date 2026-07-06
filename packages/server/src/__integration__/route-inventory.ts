import fs from 'fs';
import path from 'path';
import { contractRegistry } from '@quran-review/shared';

export interface DiscoveredEndpoint {
  method: string; // UPPERCASE
  path: string; // full URL path, params as :name
}

const ROUTES_DIR = path.join(__dirname, '../routes');
const APP_FILE = path.join(__dirname, '../app.ts');

/** Endpoint definitions per router variable inside one route file. */
function parseRouteFile(file: string): Record<string, { method: string; sub: string }[]> {
  const src = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
  const byRouter: Record<string, { method: string; sub: string }[]> = {};
  const re = /(\w+)\.(get|post|put|patch|delete)\s*\(\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const [, routerVar, method, sub] = m;
    (byRouter[routerVar] ??= []).push({ method, sub });
  }
  return byRouter;
}

export function discoverEndpoints(): DiscoveredEndpoint[] {
  const appSrc = fs.readFileSync(APP_FILE, 'utf8');

  // Map import identifier -> route file ("authRoutes" -> "auth.routes.ts"; named imports too).
  const importMap: Record<string, string> = {};
  const importRe = /import\s+(?:(\w+)|\{([^}]+)\})\s+from\s+'\.\/routes\/([\w.]+)'/g;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(appSrc))) {
    const [, def, named, file] = im;
    if (def) importMap[def] = `${file}.ts`;
    if (named) for (const n of named.split(',').map((s) => s.trim())) importMap[n] = `${file}.ts`;
  }

  const endpoints: DiscoveredEndpoint[] = [];

  // Mounted routers: app.use('<mount>', ...middleware, <routerVar>);
  const mountRe = /app\.use\(\s*'([^']+)'\s*,[^;]*?(\w+)\s*\);/g;
  let mm: RegExpExecArray | null;
  while ((mm = mountRe.exec(appSrc))) {
    const [, mount, routerVar] = mm;
    const file = importMap[routerVar];
    if (!file) continue; // app.use with inline handler or bare middleware
    const byRouter = parseRouteFile(file);
    // Default-export files declare `const router = Router()`; named exports match the import name.
    const defs = byRouter[routerVar] ?? byRouter['router'] ?? [];
    for (const d of defs) {
      endpoints.push({ method: d.method.toUpperCase(), path: mount + (d.sub === '/' ? '' : d.sub) });
    }
  }

  // Inline app-level endpoints (e.g. GET /api/health).
  const inlineRe = /app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
  let il: RegExpExecArray | null;
  while ((il = inlineRe.exec(appSrc))) {
    endpoints.push({ method: il[1].toUpperCase(), path: il[2] });
  }

  // Contract-mounted routes are invisible to static source parsing —
  // union the registry (dedup below absorbs endpoints that exist in both).
  // Legacy /api/* mounts mirror /api/v1/* (same manifest convention). If a
  // mirror mount is ever removed from app.ts, the authz-matrix itest hits a
  // live 404 and fails — this map cannot silently drift.
  const CONTRACT_MIRRORS: Record<string, string> = {
    '/api/v1/auth': '/api/auth',
    '/api/v1/users': '/api/users',
    '/api/v1/admin': '/api/admin',
    '/api/v1/appointments': '/api/appointments',
  };
  for (const c of contractRegistry) {
    endpoints.push({ method: c.method, path: c.path });
    for (const [canonical, mirror] of Object.entries(CONTRACT_MIRRORS)) {
      // Match the manifest's LEGACY_PREFIXES semantics: the prefix itself
      // (root-level GET/POST) mirrors too, not only subpaths.
      if (c.path === canonical || c.path.startsWith(`${canonical}/`)) {
        endpoints.push({ method: c.method, path: mirror + c.path.slice(canonical.length) });
      }
    }
  }

  // Dedup (docs router is mounted in both branches of an env conditional).
  const seen = new Set<string>();
  return endpoints
    .filter((e) => {
      const k = `${e.method} ${e.path}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}
