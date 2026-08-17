import { Queue, Worker } from 'bullmq';
import { logger } from './logger';

const redisAddress = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10) };

// Producer-side (Queue) connection: bounded retries + no offline command
// queueing, so an absent Redis fails each `.add()` fast instead of retrying
// forever in the background (previously left zombie reconnect timers running
// well past process/test-suite teardown — "Cannot log after tests are done").
const connection = {
  ...redisAddress,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => (times > 2 ? null : Math.min(times * 200, 1000)),
};

// Worker-side connection: BullMQ requires maxRetriesPerRequest: null for the
// blocking commands a Worker issues. Workers only ever construct when
// ENABLE_WORKERS=true, where Redis is expected to be present.
const workerConnection = { ...redisAddress, maxRetriesPerRequest: null };

const workers: Worker[] = [];

function createQueue<T>(name: string) {
  try {
    const queue = new Queue<T>(name, { connection });
    // Bounded retries mean a genuinely absent Redis now reaches a terminal
    // failure instead of retrying indefinitely — an unhandled 'error' listener
    // on an EventEmitter throws, so this keeps that terminal state a log line.
    queue.on('error', (err) => logger.warn({ err, queue: name }, 'Queue connection error'));
    return queue;
  } catch {
    logger.warn(`Redis not available — ${name} queue disabled`);
    return null;
  }
}

export const broadcastQueue = createQueue<{ message: string; targetRole?: string }>('broadcast');
export const reportQueue = createQueue<{ teacherId: string; studentId: string; summary: string }>('report');
export const emailQueue = createQueue<{ to: string; subject: string; html: string; text?: string }>('email');
export const notificationQueue = createQueue<{ userId: string; event: string; data: Record<string, any> }>(
  'notification'
);
export const digestQueue = createQueue<Record<string, never>>('weekly-digest');
export const streakNudgeQueue = createQueue<Record<string, never>>('streak-nudge');
export const scoringQueue = createQueue<{ recordingId: string }>('recitation-scoring');
export const recurringSlotsQueue = createQueue<Record<string, never>>('recurring-slots-extend');

export async function addScoringJob(recordingId: string) {
  if (!scoringQueue) return null;
  try {
    return await scoringQueue.add('score-recording', { recordingId });
  } catch (err) {
    logger.warn({ err }, 'scoring queue add failed — Redis unavailable, falling back');
    return null;
  }
}

export async function addBroadcastJob(message: string, targetRole?: string) {
  if (!broadcastQueue) return null;
  try {
    return await broadcastQueue.add('broadcast', { message, targetRole });
  } catch (err) {
    logger.warn({ err }, 'broadcast queue add failed — Redis unavailable, falling back');
    return null;
  }
}

export async function addReportJob(teacherId: string, studentId: string, summary: string) {
  if (!reportQueue) return null;
  try {
    return await reportQueue.add('generate-report', { teacherId, studentId, summary });
  } catch (err) {
    logger.warn({ err }, 'report queue add failed — Redis unavailable, falling back');
    return null;
  }
}

export async function addEmailJob(to: string, subject: string, html: string, text?: string) {
  if (!emailQueue) return null;
  try {
    return await emailQueue.add('send-email', { to, subject, html, text });
  } catch (err) {
    logger.warn({ err }, 'email queue add failed — Redis unavailable, falling back');
    return null;
  }
}

export const closeQueues = async (): Promise<void> => {
  const allQueues = [
    broadcastQueue,
    reportQueue,
    emailQueue,
    notificationQueue,
    digestQueue,
    streakNudgeQueue,
    scoringQueue,
    recurringSlotsQueue,
  ].filter(Boolean) as Queue[];
  await Promise.all(allQueues.map((q) => q.close()));

  for (const worker of workers) {
    await worker.close();
  }
  logger.info('BullMQ queues and workers closed');
};

// Workers only initialize if explicitly enabled (avoid in test env)
if (process.env.ENABLE_WORKERS === 'true') {
  if (broadcastQueue) {
    workers.push(
      new Worker(
        'broadcast',
        async (job) => {
          const { notifyUser } = await import('../services/notification.service');
          const { prisma } = await import('../prisma/client');
          const { message, targetRole } = job.data;
          const where = targetRole ? { role: targetRole.toUpperCase() as any } : {};
          const users = await prisma.user.findMany({ where, select: { id: true } });
          const sentAt = new Date().toISOString();
          // Persist a durable notification per recipient (notifyUser also emits
          // the socket event + best-effort push) so broadcasts land in the
          // /notifications feed, not just as an ephemeral socket event.
          await Promise.all(
            users.map((user) =>
              notifyUser({
                userId: user.id,
                event: 'broadcast',
                data: { message, sentAt },
                push: { title: 'Broadcast', body: message },
              })
            )
          );
          logger.info({ recipients: users.length }, 'Broadcast job completed');
        },
        { connection: workerConnection }
      )
    );
  }

  if (emailQueue) {
    workers.push(
      new Worker(
        'email',
        async (job) => {
          const { sendEmail } = await import('../services/email.service');
          const { to, subject, html, text } = job.data;
          await sendEmail({ to, subject, html, text });
          logger.info({ to, subject }, 'Email job completed');
        },
        { connection: workerConnection }
      )
    );
  }

  if (notificationQueue) {
    workers.push(
      new Worker(
        'notification',
        async (job) => {
          const { notifyUser } = await import('../services/notification.service');
          await notifyUser(job.data);
          logger.info({ userId: job.data.userId, event: job.data.event }, 'Notification job completed');
        },
        { connection: workerConnection }
      )
    );
  }

  if (digestQueue) {
    workers.push(
      new Worker(
        'weekly-digest',
        async () => {
          const { sendWeeklyDigests } = await import('../services/digest.service');
          const sent = await sendWeeklyDigests();
          logger.info({ sent }, 'Weekly digest job completed');
        },
        { connection: workerConnection }
      )
    );
    // Registers the recurring trigger once at startup. BullMQ dedupes
    // repeatable jobs by their repeat key, so re-registering on every server
    // restart does not create duplicate schedules. Sunday 08:00 — the exact
    // day/time is not yet admin-configurable (follow-up, not built).
    digestQueue.add('trigger', {}, { repeat: { pattern: '0 8 * * 0' } }).catch((err) => {
      logger.error({ err }, 'Failed to schedule the weekly digest job');
    });
  }

  if (streakNudgeQueue) {
    workers.push(
      new Worker(
        'streak-nudge',
        async () => {
          const { sendStreakNudges } = await import('../services/streak-nudge.service');
          const sent = await sendStreakNudges();
          logger.info({ sent }, 'Streak nudge job completed');
        },
        { connection: workerConnection }
      )
    );
    // Daily 20:00 server-local (F7): evening streak-risk reminder. Same
    // dedupe-by-repeat-key behavior as the digest above.
    streakNudgeQueue.add('trigger', {}, { repeat: { pattern: '0 20 * * *' } }).catch((err) => {
      logger.error({ err }, 'Failed to schedule the streak nudge job');
    });
  }

  if (scoringQueue) {
    workers.push(
      new Worker(
        'recitation-scoring',
        async (job) => {
          const { scoreRecording } = await import('../services/recitation-scorer.service');
          await scoreRecording(job.data.recordingId);
          logger.info({ recordingId: job.data.recordingId }, 'Recitation scoring job completed');
        },
        { connection: workerConnection }
      )
    );
  }

  if (recurringSlotsQueue) {
    workers.push(
      new Worker(
        'recurring-slots-extend',
        async () => {
          const { extendActiveRecurringSlots } = await import('../services/recurring-slot.service');
          const generated = await extendActiveRecurringSlots();
          logger.info({ generated }, 'Recurring slots extension job completed');
        },
        { connection: workerConnection }
      )
    );
    // Weekly Monday 06:00 — extends every active slot's rolling window by
    // one more occurrence. Same idempotent-repeat-registration pattern as
    // the weekly digest job above.
    recurringSlotsQueue.add('trigger', {}, { repeat: { pattern: '0 6 * * 1' } }).catch((err) => {
      logger.error({ err }, 'Failed to schedule the recurring-slots extension job');
    });
  }
}
