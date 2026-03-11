/**
 * Direct email sender using nodemailer + Gmail SMTP.
 * Used for password reset emails (replacing the broken Redis queue).
 */
import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from './logger.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.emailUser,
      pass: config.emailPass, // Gmail App Password (not your account password)
    },
  });

  return transporter;
};

/**
 * Send a plain-text email directly via Gmail SMTP.
 * Throws if EMAIL_USER / EMAIL_PASS are not configured.
 */
export const sendEmail = async ({ to, subject, body }) => {
  if (!config.emailUser || !config.emailPass) {
    throw new Error('Email service not configured. Set EMAIL_USER and EMAIL_PASS in .env');
  }

  const t = getTransporter();

  const info = await t.sendMail({
    from: `"NotesMitra" <${config.emailUser}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  });

  logger.info('Email sent', { messageId: info.messageId, to });
  return info;
};
