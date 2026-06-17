const nodemailer = require('nodemailer');
const logger = require('./logger');

const createTransporter = () => {
  if (!process.env.SMTP_HOST) {
    logger.warn('SMTP non configuré — emails désactivés');
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
};

const sendMail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  if (!transporter) return { skipped: true, reason: 'SMTP non configuré' };
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'Novexa'}" <${process.env.SMTP_USER}>`,
      to, subject, html
    });
    logger.info('Email envoyé', { to, subject, messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error('Erreur envoi email', { to, subject, error: err.message });
    return { success: false, error: err.message };
  }
};

module.exports = { sendMail };
