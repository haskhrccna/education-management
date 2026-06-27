-- P0: Make AuditLog.userId nullable with SET NULL on user delete
-- Preserves audit trail when a user is soft-deleted (compliance requirement)

-- This migration originally depended on an existing audit_logs table.
-- In this branch the table is created by a later schema migration, so the
-- statement list below is intentionally left empty. Fresh databases will
-- get audit_logs from Prisma's generated DDL, and existing deployments that
-- already applied this migration keep their constraint.
SELECT 1;
