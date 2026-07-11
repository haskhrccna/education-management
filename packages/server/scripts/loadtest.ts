/**
 * In-process load test with local perf budgets (M13).
 * Runs against the docker TEST database (5433) — never the dev DB.
 * Usage: npm run perf   (requires `docker compose -f docker-compose.test.yml up -d`)
 */
import '../src/__integration__/env';
import http from 'http';
import { AddressInfo } from 'net';
import autocannon from 'autocannon';
import { Role } from '@prisma/client';
import app from '../src/app';
import { createUser } from '../src/__integration__/factory';
import { truncateAll, disconnect } from '../src/__integration__/db';

// LOCAL baselines, not SLOs: generous enough to be stable across dev machines.
const BUDGETS = { healthP95: 150, readP95: 400 }; // ms

async function run() {
  await truncateAll();
  const student = await createUser({ role: Role.STUDENT });
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const health = await autocannon({ url: `${origin}/api/health`, duration: 10, connections: 20 });
  const reads = await autocannon({
    url: `${origin}/api/v1/grades`,
    duration: 10,
    connections: 20,
    headers: { Authorization: `Bearer ${student.token}` },
  });

  // autocannon exposes p2_5/p50/p97_5/p99 — p97_5 is our p95 proxy.
  const p95 = (r: autocannon.Result) => r.latency.p97_5 ?? r.latency.p99;
  console.log(
    `health: p95≈${p95(health)}ms avg=${health.latency.average}ms rps=${Math.round(health.requests.average)} errors=${health.errors}`
  );
  console.log(
    `grades: p95≈${p95(reads)}ms avg=${reads.latency.average}ms rps=${Math.round(reads.requests.average)} errors=${reads.errors}`
  );

  const failures: string[] = [];
  if (health.errors > 0 || reads.errors > 0) failures.push('non-zero error count');
  if (p95(health) > BUDGETS.healthP95) failures.push(`health p95 > ${BUDGETS.healthP95}ms`);
  if (p95(reads) > BUDGETS.readP95) failures.push(`read p95 > ${BUDGETS.readP95}ms`);

  await new Promise<void>((r) => server.close(() => r()));
  await disconnect();
  if (failures.length) {
    console.error('PERF BUDGET FAILURES:', failures.join('; '));
    process.exit(1);
  }
  console.log('perf budgets: OK');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
