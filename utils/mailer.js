const nodemailer = require('nodemailer');
const logger = require('./logger');

// ── Resend (API HTTP — une seule variable : RESEND_API_KEY) ──
const sendViaResend = async ({ to, subject, html, from }) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: from || `Novexa <${process.env.RESEND_FROM || 'noreply@resend.dev'}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return { success: true, messageId: data.id };
};

// ── SMTP classique (Gmail, Brevo, etc.) ──
const sendViaSMTP = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  const info = await transporter.sendMail({
    from: `"${process.env.APP_NAME || 'Novexa'}" <${process.env.SMTP_USER}>`,
    to, subject, html
  });
  return { success: true, messageId: info.messageId };
};

const sendMail = async ({ to, subject, html }) => {
  try {
    if (process.env.RESEND_API_KEY) {
      const result = await sendViaResend({ to, subject, html });
      logger.info('Email envoyé via Resend', { to, subject, messageId: result.messageId });
      return result;
    }

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const result = await sendViaSMTP({ to, subject, html });
      logger.info('Email envoyé via SMTP', { to, subject, messageId: result.messageId });
      return result;
    }

    logger.warn('Email ignoré — ni RESEND_API_KEY ni SMTP_HOST configuré', { to, subject });
    return { skipped: true, reason: 'Aucun service email configuré. Ajoutez RESEND_API_KEY ou SMTP_HOST dans les variables Render.' };
  } catch (err) {
    logger.error('Erreur envoi email', { to, subject, error: err.message });
    return { success: false, error: err.message };
  }
};

module.exports = { sendMail };
