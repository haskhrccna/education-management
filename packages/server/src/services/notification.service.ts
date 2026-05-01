import { prisma } from '../prisma/client';
import { logger } from '../lib/logger';

// Unified notification service: Email + Socket + Push
export const notifyUser = async (options: {
  userId: string;
  event: string;
  data: Record<string, any>;
  email?: { subject: string; body: string };
  push?: { title: string; body: string };
}) => {
  const { userId, event, data, email, push } = options;

  // 1. Real-time via Socket.IO
  try {
    const { sendToUser } = await import('./socket.service');
    sendToUser(userId, event, data);
  } catch (err) {
    logger.error({ err, userId }, 'Socket notification failed');
  }

  // 2. Email notification
  if (email) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
      if (user?.email) {
        const { sendEmail } = await import('./email.service');
        await sendEmail({ to: user.email, subject: email.subject, html: email.body });
      }
    } catch (err) {
      logger.error({ err, userId }, 'Email notification failed');
    }
  }

  // 3. Push notification (FCM)
  if (push) {
    try {
      // TODO: Fetch device token from DB and send via FCM
      logger.debug({ userId, push }, 'Push notification queued');
    } catch (err) {
      logger.error({ err, userId }, 'Push notification failed');
    }
  }
};

export const notifyAppointmentUpdate = async (studentId: string, appointment: any) => {
  const statusText = appointment.status === 'ACCEPTED' ? 'accepted' :
                     appointment.status === 'REJECTED' ? 'rejected' : 'updated';
  const date = new Date(appointment.requestedDate).toLocaleDateString('en-US');

  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { firstName: true, email: true } });
  const name = user?.firstName || '';

  await notifyUser({
    userId: studentId,
    event: 'appointment_update',
    data: appointment,
    email: {
      subject: `Appointment ${statusText}`,
      body: `<p>Your appointment on ${date} at ${appointment.requestedTime} has been ${statusText}.</p>`,
    },
    push: {
      title: `Appointment ${statusText}`,
      body: `Your appointment on ${date} at ${appointment.requestedTime} has been ${statusText}.`,
    },
  });
};

export const notifyNewGrade = async (studentId: string, grade: any) => {
  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { firstName: true, email: true } });
  const name = user?.firstName || '';

  await notifyUser({
    userId: studentId,
    event: 'new_grade',
    data: grade,
    email: {
      subject: `New grade: ${grade.subject}`,
      body: `<p>A new grade has been posted for <strong>${grade.subject}</strong>: ${grade.grade}</p>`,
    },
    push: {
      title: `New grade: ${grade.subject}`,
      body: `You received ${grade.grade} in ${grade.subject}`,
    },
  });
};

export const notifyNewMessage = async (receiverId: string, message: any) => {
  await notifyUser({
    userId: receiverId,
    event: 'new_message',
    data: message,
    push: {
      title: `New message from ${message.sender?.firstName || 'Someone'}`,
      body: message.content.substring(0, 100),
    },
  });
};
