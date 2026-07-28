import { adminContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface AuditLogRow {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resourceType?: string;
  /** ISO-8601. The server 400s on anything it cannot parse. */
  dateFrom?: string;
  dateTo?: string;
}

export interface AuditLogPage {
  data: AuditLogRow[];
  meta: { page: number; limit: number; total: number };
}

export const auditLogsApi = {
  async list(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
    // The contract client skips undefined values, so unset filters are simply
    // absent from the query string rather than sent as "undefined".
    const res = await contractClient.call(adminContracts.auditLogs, {
      query: {
        page: filters.page,
        limit: filters.limit,
        userId: filters.userId,
        action: filters.action,
        resourceType: filters.resourceType,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      } as never,
    });
    return expectStatus(res, 200).body as unknown as AuditLogPage;
  },
};
