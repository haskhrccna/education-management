-- Phase 1 — Notification Center
-- Durable feed: every event from notifyUser() also persists a row here.
-- Read at the feed endpoint, marked read by the user.

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_userId_readAt_createdAt_idx"
    ON "notifications"("userId", "readAt", "createdAt");

CREATE INDEX "notifications_userId_createdAt_idx"
    ON "notifications"("userId", "createdAt");

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    ON UPDATE CASCADE;
