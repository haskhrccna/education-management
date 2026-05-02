import { Prisma } from '@prisma/client';
import { logger } from '../lib/logger';

const AUDIT_MODELS = ['User', 'Appointment', 'Grade', 'Recording', 'Message', 'Report'];
const AUDIT_ACTIONS: Record<string, string> = {
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
  deleteMany: 'DELETE',
  updateMany: 'UPDATE',
};

export const auditExtension = Prisma.defineExtension({
  name: 'auditLog',
  query: {
    $allModels: {
      async create({ model, operation, args, query }) {
        const result = await query(args);
        if (AUDIT_MODELS.includes(model)) {
          logAudit(model, AUDIT_ACTIONS[operation] || operation, result?.id, args.data);
        }
        return result;
      },
      async update({ model, operation, args, query }) {
        const result = await query(args);
        if (AUDIT_MODELS.includes(model)) {
          logAudit(model, AUDIT_ACTIONS[operation] || operation, args.where?.id, args.data);
        }
        return result;
      },
      async delete({ model, operation, args, query }) {
        const result = await query(args);
        if (AUDIT_MODELS.includes(model)) {
          logAudit(model, AUDIT_ACTIONS[operation] || operation, args.where?.id, null);
        }
        return result;
      },
      async updateMany({ model, operation, args, query }) {
        const result = await query(args);
        if (AUDIT_MODELS.includes(model)) {
          logAudit(model, AUDIT_ACTIONS[operation] || operation, null, args.data);
        }
        return result;
      },
      async deleteMany({ model, operation, args, query }) {
        const result = await query(args);
        if (AUDIT_MODELS.includes(model)) {
          logAudit(model, AUDIT_ACTIONS[operation] || operation, null, args.where);
        }
        return result;
      },
    },
  },
});

function logAudit(model: string, action: string, resourceId: string | null | undefined, details: any) {
  logger.info({
    audit: true,
    action: `${action}_${model.toUpperCase()}`,
    resourceType: model,
    resourceId,
    details: details ? sanitizeForAudit(details) : null,
  }, `AUDIT: ${action}_${model.toUpperCase()}`);
}

function sanitizeForAudit(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForAudit(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
