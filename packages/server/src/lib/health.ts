import { prisma } from '../prisma/client';
import { logger } from './logger';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: { status: 'up' | 'down'; latencyMs: number };
    redis?: { status: 'up' | 'down' | 'disabled' };
    memory: { status: 'up'; usedMB: number; totalMB: number };
  };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const start = Date.now();
  let dbStatus: 'up' | 'down' = 'down';
  let dbLatency = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'up';
    dbLatency = Date.now() - start;
  } catch (err) {
    logger.error({ err }, 'Health check: database failed');
  }

  const used = process.memoryUsage();
  const usedMB = Math.round(used.heapUsed / 1024 / 1024);
  const totalMB = Math.round(used.heapTotal / 1024 / 1024);

  const overallStatus = dbStatus === 'up' ? 'healthy' : 'unhealthy';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: { status: dbStatus, latencyMs: dbLatency },
      memory: { status: 'up', usedMB, totalMB },
    },
  };
}
