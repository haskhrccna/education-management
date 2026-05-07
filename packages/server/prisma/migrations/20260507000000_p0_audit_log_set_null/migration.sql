-- P0: Make AuditLog.userId nullable with SET NULL on user delete
-- Preserves audit trail when a user is soft-deleted (compliance requirement)

ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
