import { prisma } from '../prisma/client';
import { logger } from '../lib/logger';

// Unified notification service: Email + Socket + Push
export const notifyUser = async (options: {
  userId: string;
  event: string;
  data: Record<string, unknown>;
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
      const { sendPushToUser } = await import('./fcm.service');
      // FCM requires data values to be strings — coerce non-string entries
      const stringData: Record<string, string> = { event };
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null) {
          stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
      }
      await sendPushToUser(userId, push.title, push.body, stringData);
    } catch (err) {
      logger.error({ err, userId }, 'Push notification failed');
    }
  }
};

interface AppointmentSummary extends Record<string, unknown> {
  status?: string;
  requestedDate?: string | number | Date;
  requestedTime?: string;
}

export const notifyAppointmentUpdate = async (studentId: string, appointment: AppointmentSummary) => {
  const statusText =
    appointment.status === 'ACCEPTED' ? 'accepted' : appointment.status === 'REJECTED' ? 'rejected' : 'updated';
  const date = new Date(appointment.requestedDate ?? '').toLocaleDateString('en-US');

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

interface GradeSummary extends Record<string, unknown> {
  subject?: string;
  grade?: string;
}

export const notifyNewGrade = async (studentId: string, grade: GradeSummary) => {
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

interface MessageSummary extends Record<string, unknown> {
  sender?: { firstName?: string };
  content?: string;
}

export const notifyNewMessage = async (receiverId: string, message: MessageSummary) => {
  await notifyUser({
    userId: receiverId,
    event: 'new_message',
    data: message,
    push: {
      title: `New message from ${message.sender?.firstName || 'Someone'}`,
      body: message.content?.substring(0, 100) ?? '',
    },
  });
};

interface TeacherChangeSummary extends Record<string, unknown> {
  status?: string;
  adminNote?: string | null;
}

export const notifyTeacherChangeDecision = async (studentId: string, request: TeacherChangeSummary) => {
  const decision = request.status === 'APPROVED' ? 'approved' : 'denied';
  await notifyUser({
    userId: studentId,
    event: 'teacher_change_decision',
    data: request,
    email: {
      subject: `Teacher change request ${decision}`,
      body: `<p>Your teacher change request has been <strong>${decision}</strong>.</p>${
        request.adminNote ? `<p>Note: ${request.adminNote}</p>` : ''
      }`,
    },
    push: {
      title: `Teacher change request ${decision}`,
      body: request.adminNote
        ? `${decision[0].toUpperCase() + decision.slice(1)}: ${request.adminNote}`
        : `Your teacher change request has been ${decision}.`,
    },
  });
};
