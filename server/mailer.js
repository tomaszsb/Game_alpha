// server/mailer.js
// SMTP-based reminder sending for the playtester-acquisition Reminder Hub
// ("Email me" / "Text me"). Configured entirely via env vars
// (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM); if unset,
// sendReminder() throws a NOT_CONFIGURED error so the endpoint can fail
// closed with a clear message instead of a confusing SMTP stack trace.
//
// Text messages go out via a carrier's email-to-SMS gateway (phone@gateway),
// not a real SMS API — no extra service needed beyond SMTP, but delivery is
// not guaranteed: most US carriers throttle or silently drop gateway mail as
// an anti-spam measure (this has gotten worse since ~2022).

import nodemailer from 'nodemailer';

export const CARRIER_GATEWAYS = {
  att: 'txt.att.net',
  verizon: 'vtext.com',
  tmobile: 'tmomail.net',
  sprint: 'messaging.sprintpcs.com',
  boost: 'sms.myboostmobile.com',
  cricket: 'sms.cricketwireless.net',
  metropcs: 'mymetropcs.com',
  uscellular: 'email.uscc.net',
  googlefi: 'msg.fi.google.com',
};

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export function isMailerConfigured() {
  return getTransporter() !== null;
}

function buildReminderBody(whenLabel) {
  return (
    `Reminder to play Unravel Codes${whenLabel ? ` (${whenLabel})` : ''}.\n\n` +
    'Grab a PC, TV, or tablet and head to:\nhttps://game.unravelcodes.com/challenge\n\n' +
    'See you there!'
  );
}

/**
 * Send a reminder email, or a text via a carrier's email-to-SMS gateway.
 * @param {{ method: 'email'|'sms', email?: string, phone?: string, carrier?: string, whenLabel?: string }} opts
 */
export async function sendReminder(opts) {
  const t = getTransporter();
  if (!t) {
    throw Object.assign(new Error('Mailer not configured'), { code: 'NOT_CONFIGURED' });
  }

  let to;
  if (opts.method === 'email') {
    if (!opts.email || typeof opts.email !== 'string') {
      throw Object.assign(new Error('email is required'), { code: 'BAD_REQUEST' });
    }
    to = opts.email;
  } else if (opts.method === 'sms') {
    const gateway = CARRIER_GATEWAYS[opts.carrier];
    const digits = typeof opts.phone === 'string' ? opts.phone.replace(/\D/g, '') : '';
    if (!digits || !gateway) {
      throw Object.assign(new Error('phone and a supported carrier are required'), { code: 'BAD_REQUEST' });
    }
    to = `${digits}@${gateway}`;
  } else {
    throw Object.assign(new Error('method must be "email" or "sms"'), { code: 'BAD_REQUEST' });
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Play Unravel Codes',
    text: buildReminderBody(opts.whenLabel),
  });
}
