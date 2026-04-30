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
    // For high-volume systems, this could be queued via BullMQ
    // For now, we log to Pino and optionally to DB
    logger.info({
      audit: true,
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      details: entry.details,
      ip: entry.ipAddress,
    }, `AUDIT: ${entry.action} ${entry.resourceType}`);
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log');
  }
}
