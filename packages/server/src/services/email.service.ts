import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../lib/logger';

const transporter = nodemailer.createTransport({
  host: config.emailHost,
  port: config.emailPort,
  secure: config.emailPort === 465,
  auth: config.emailUser ? { user: config.emailUser, pass: config.emailPass } : undefined,
});

let isEmailEnabled = false;

export const verifyEmailConnection = async () => {
  if (!config.emailHost) {
    logger.warn('Email not configured — set EMAIL_HOST env var');
    return false;
  }
  try {
    await transporter.verify();
    isEmailEnabled = true;
    logger.info('Email service connected');
    return true;
  } catch (err) {
    logger.error({ err }, 'Email service connection failed');
    return false;
  }
};

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!isEmailEnabled) {
    logger.debug({ to: options.to, subject: options.subject }, 'Email skipped (not configured)');
    return;
  }
  try {
    await transporter.sendMail({
      from: config.emailFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    logger.info({ to: options.to, subject: options.subject }, 'Email sent');
  } catch (err) {
    logger.error({ err, to: options.to }, 'Email send failed');
  }
};

// Email templates
export const sendWelcomeEmail = async (to: string, name: string) => {
  await sendEmail({
    to,
    subject: 'Welcome to Electronic Education Platform',
    html: `<h1>Welcome, ${name}!</h1><p>Your account has been created and is pending admin approval.</p>`,
    text: `Welcome, ${name}! Your account has been created and is pending admin approval.`,
  });
};

export const sendAccountApprovedEmail = async (to: string, name: string) => {
  await sendEmail({
    to,
    subject: 'Your account has been approved',
    html: `<h1>Congratulations, ${name}!</h1><p>Your account has been approved by the admin. You can now log in.</p>`,
    text: `Congratulations, ${name}! Your account has been approved. You can now log in.`,
  });
};

export const sendAppointmentNotification = async (to: string, status: string, date: string, time: string) => {
  const statusText = status === 'ACCEPTED' ? 'accepted' : status === 'REJECTED' ? 'rejected' : 'updated';
  await sendEmail({
    to,
    subject: `Appointment ${statusText}`,
    html: `<p>Your appointment on ${date} at ${time} has been ${statusText}.</p>`,
    text: `Your appointment on ${date} at ${time} has been ${statusText}.`,
  });
};

export const sendNewGradeEmail = async (to: string, subject: string, grade: string) => {
  await sendEmail({
    to,
    subject: `New grade posted: ${subject}`,
    html: `<p>A new grade has been posted for ${subject}: <strong>${grade}</strong></p>`,
    text: `A new grade has been posted for ${subject}: ${grade}`,
  });
};

export const sendPasswordChangedEmail = async (to: string) => {
  await sendEmail({
    to,
    subject: 'Password changed successfully',
    html: `<p>Your password has been changed. If you did not make this change, please contact support immediately.</p>`,
    text: `Your password has been changed. If you did not make this change, please contact support immediately.`,
  });
};
