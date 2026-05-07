import { prisma } from '../prisma/client';
import { logger } from './logger';

export interface AuditLogEntry {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    // Write to DB for compliance trail
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: entry.details || {},
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });

    // Also log to Pino for real-time monitoring
    logger.info(
      {
        audit: true,
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
      },
      `AUDIT: ${entry.action} ${entry.resourceType}`
    );
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log');
  }
}
