import request from 'supertest';
import app from '../app';
import { Role } from '@prisma/client';
import { endpointManifest, EndpointSpec } from './endpoint-manifest';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

const FAKE_ID = '00000000-0000-0000-0000-000000000000';
const ROLES: Role[] = [Role.STUDENT, Role.TEACHER, Role.PARENT, Role.ADMIN];
type Identity = Role | 'anon';
const IDENTITIES: Identity[] = ['anon', ...ROLES];

const tokens: Partial<Record<Role, string>> = {};

// One shared server for all ~640 requests — a fresh ephemeral server per request
// (plain request(app)) starves connection setup and randomly times tests out.
const agent = request.agent(app);

beforeAll(async () => {
  await truncateAll();
  for (const role of ROLES) tokens[role] = (await createUser({ role })).token;
});
afterAll(disconnect);

const urlFor = (spec: EndpointSpec) => spec.path.replace(/:[A-Za-z]+/g, FAKE_ID);

function isAllowed(spec: EndpointSpec, id: Identity): boolean {
  if (spec.access === 'public') return true;
  if (id === 'anon') return false;
  if (spec.access === 'authenticated') return true;
  return (spec.access as string[]).includes(id);
}

describe('authorization matrix', () => {
  for (const spec of endpointManifest) {
    if (spec.skip) continue;
    for (const id of IDENTITIES) {
      const allowed = isAllowed(spec, id);
      it(`${spec.method} ${spec.path} — ${id}: ${allowed ? 'passes authz' : 'rejected'}`, async () => {
        const method = spec.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
        let req = agent[method](urlFor(spec));
        if (id !== 'anon') req = req.set('Authorization', `Bearer ${tokens[id as Role]}`);
        if (method !== 'get' && method !== 'delete') req = req.send({});
        const res = await req;
        if (!allowed) {
          if (id === 'anon') {
            expect(res.status).toBe(401);
          } else {
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Insufficient permissions');
          }
        } else {
          // Authz cleared: any downstream outcome (200/400/404/resource-level 403) is fine,
          // as long as it is not an auth failure or the role-gate rejection.
          expect(res.status).not.toBe(401);
          expect(res.status === 403 && res.body.error === 'Insufficient permissions').toBe(false);
        }
      });
    }
  }
});
