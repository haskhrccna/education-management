import { Queue, Worker } from 'bullmq';
import { logger } from './logger';

const connection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10) };

let isRedisAvailable = false;

function createQueue<T>(name: string) {
  try {
    const queue = new Queue<T>(name, { connection });
    isRedisAvailable = true;
    return queue;
  } catch {
    logger.warn(`Redis not available — ${name} queue disabled`);
    return null;
  }
}

export const broadcastQueue = createQueue<{ message: string; targetRole?: string }>('broadcast');
export const reportQueue = createQueue<{ teacherId: string; studentId: string; summary: string }>('report');
export const emailQueue = createQueue<{ to: string; subject: string; html: string; text?: string }>('email');
export const notificationQueue = createQueue<{ userId: string; event: string; data: Record<string, any> }>('notification');

export async function addBroadcastJob(message: string, targetRole?: string) {
  if (!broadcastQueue) return null;
  return broadcastQueue.add('broadcast', { message, targetRole });
}

export async function addReportJob(teacherId: string, studentId: string, summary: string) {
  if (!reportQueue) return null;
  return reportQueue.add('generate-report', { teacherId, studentId, summary });
}

export async function addEmailJob(to: string, subject: string, html: string, text?: string) {
  if (!emailQueue) return null;
  return emailQueue.add('send-email', { to, subject, html, text });
}

// Workers only initialize if explicitly enabled (avoid in test env)
if (process.env.ENABLE_WORKERS === 'true') {
  if (broadcastQueue) {
    new Worker('broadcast', async (job) => {
      const { sendToUser } = await import('../services/socket.service');
      const { prisma } = await import('../prisma/client');
      const { message, targetRole } = job.data;
      const where = targetRole ? { role: targetRole.toUpperCase() as any } : {};
      const users = await prisma.user.findMany({ where, select: { id: true } });
      for (const user of users) {
        sendToUser(user.id, 'broadcast', { message, sentAt: new Date().toISOString() });
      }
      logger.info({ recipients: users.length }, 'Broadcast job completed');
    }, { connection });
  }

  if (emailQueue) {
    new Worker('email', async (job) => {
      const { sendEmail } = await import('../services/email.service');
      const { to, subject, html, text } = job.data;
      await sendEmail({ to, subject, html, text });
      logger.info({ to, subject }, 'Email job completed');
    }, { connection });
  }

  if (notificationQueue) {
    new Worker('notification', async (job) => {
      const { notifyUser } = await import('../services/notification.service');
      await notifyUser(job.data);
      logger.info({ userId: job.data.userId, event: job.data.event }, 'Notification job completed');
    }, { connection });
  }
}
