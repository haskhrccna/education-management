import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../lib/logger';
import { templates } from './email-templates';

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

// Bilingual email helpers
export const sendWelcomeEmail = async (to: string, name: string, lang: 'ar' | 'en' = 'ar') => {
  await sendEmail({
    to,
    subject: lang === 'ar' ? 'مرحباً بك في منصة التعليم الإلكتروني' : 'Welcome to Electronic Education Platform',
    html: templates.welcome({ name }, lang),
    text:
      lang === 'ar'
        ? `مرحباً ${name}! تم إنشاء حسابك وهو قيد انتظار الموافقة.`
        : `Welcome, ${name}! Your account is pending approval.`,
  });
};

export const sendAccountApprovedEmail = async (to: string, name: string, lang: 'ar' | 'en' = 'ar') => {
  await sendEmail({
    to,
    subject: lang === 'ar' ? 'تمت الموافقة على حسابك' : 'Your account has been approved',
    html: templates.accountApproved({ name }, lang),
    text:
      lang === 'ar'
        ? `تهانينا ${name}! تمت الموافقة على حسابك.`
        : `Congratulations, ${name}! Your account has been approved.`,
  });
};

export const sendAppointmentNotification = async (
  to: string,
  name: string,
  status: string,
  date: string,
  time: string,
  lang: 'ar' | 'en' = 'ar'
) => {
  const subject =
    lang === 'ar'
      ? `تحديث الموعد — ${status === 'ACCEPTED' ? 'مقبول' : status === 'REJECTED' ? 'مرفوض' : 'محدث'}`
      : `Appointment ${status.toLowerCase()}`;
  await sendEmail({
    to,
    subject,
    html: templates.appointmentUpdate({ name, date, time, status }, lang),
    text: `Your appointment on ${date} at ${time} has been ${status.toLowerCase()}.`,
  });
};

export const sendNewGradeEmail = async (
  to: string,
  name: string,
  subject: string,
  grade: string,
  lang: 'ar' | 'en' = 'ar'
) => {
  await sendEmail({
    to,
    subject: lang === 'ar' ? `درجة جديدة: ${subject}` : `New grade: ${subject}`,
    html: templates.newGrade({ name, subject, grade }, lang),
    text: `Hi ${name}, a new grade has been posted for ${subject}: ${grade}`,
  });
};

export const sendPasswordChangedEmail = async (to: string, name: string, lang: 'ar' | 'en' = 'ar') => {
  await sendEmail({
    to,
    subject: lang === 'ar' ? 'تم تغيير كلمة المرور' : 'Password changed successfully',
    html: templates.passwordChanged({ name }, lang),
    text: `Hi ${name}, your password has been changed.`,
  });
};

export const sendPasswordResetEmail = async (to: string, name: string, token: string, lang: 'ar' | 'en' = 'ar') => {
  const subject = lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Password reset request';
  const body =
    lang === 'ar'
      ? `مرحباً ${name}،<br>استخدم الرمز التالي لإعادة تعيين كلمة مرورك (صالح لمدة ساعة):<br><br><strong>${token}</strong>`
      : `Hi ${name},<br>Use the token below to reset your password (valid for 1 hour):<br><br><strong>${token}</strong>`;
  await sendEmail({
    to,
    subject,
    html: `<div style="font-family:sans-serif;padding:24px">${body}</div>`,
    text: lang === 'ar' ? `رمز إعادة التعيين: ${token}` : `Password reset token: ${token}`,
  });
};
