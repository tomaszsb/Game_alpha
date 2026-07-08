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

const CLEAN_URL = 'game.unravelcodes.com/challenge';
const BASE_URL = 'https://game.unravelcodes.com/challenge';

function buildReminderUrl(campaignSource) {
  return campaignSource ? `${BASE_URL}?src=${encodeURIComponent(campaignSource)}` : BASE_URL;
}

// Plain text (SMS, and email's fallback for clients that don't render HTML)
// has no way to show clean text while linking somewhere else — whatever
// string is sent is both what's read and what's tapped. For SMS specifically
// (the "optional secondary" channel per the PRD) we drop the tracking param
// entirely rather than show an ugly link; the email plain-text fallback
// keeps it, since almost every modern client renders the HTML version below
// instead, where the tracking is hidden behind clean anchor text.
function buildReminderText(whenLabel, campaignSource, method) {
  const url = method === 'sms' ? BASE_URL : buildReminderUrl(campaignSource);
  return (
    `Reminder to play Unravel Codes${whenLabel ? ` (${whenLabel})` : ''}.\n\n` +
    `Grab a PC, TV, or tablet and head to:\n${url}\n\n` +
    'See you there!'
  );
}

function buildReminderHtml(whenLabel, campaignSource) {
  const url = buildReminderUrl(campaignSource);
  return (
    `<p>Reminder to play Unravel Codes${whenLabel ? ` (${whenLabel})` : ''}.</p>` +
    `<p>Grab a PC, TV, or tablet and head to:<br>` +
    `<a href="${url}">${CLEAN_URL}</a></p>` +
    `<p>See you there!</p>`
  );
}

/**
 * Send a reminder email, or a text via a carrier's email-to-SMS gateway.
 * @param {{ method: 'email'|'sms', email?: string, phone?: string, carrier?: string, whenLabel?: string, campaignSource?: string }} opts
 */
// Validate the recipient and resolve the "to" address. Exported so a reminder
// can be validated up front (at schedule time) even though it's actually sent
// later — a bad address should be rejected while the visitor is still looking
// at the form, not silently dropped when the scheduler fires hours later.
// Throws a BAD_REQUEST-coded Error on invalid input.
export function resolveRecipient(opts) {
  if (opts.method === 'email') {
    if (!opts.email || typeof opts.email !== 'string') {
      throw Object.assign(new Error('email is required'), { code: 'BAD_REQUEST' });
    }
    return opts.email;
  }
  if (opts.method === 'sms') {
    const gateway = CARRIER_GATEWAYS[opts.carrier];
    const digits = typeof opts.phone === 'string' ? opts.phone.replace(/\D/g, '') : '';
    if (!digits || !gateway) {
      throw Object.assign(new Error('phone and a supported carrier are required'), { code: 'BAD_REQUEST' });
    }
    return `${digits}@${gateway}`;
  }
  throw Object.assign(new Error('method must be "email" or "sms"'), { code: 'BAD_REQUEST' });
}

/**
 * Send a short text to the maintainer's own phone via a carrier email-to-SMS
 * gateway (ALERT_PHONE/ALERT_CARRIER env vars), reusing the same transporter
 * and CARRIER_GATEWAYS map as player reminders. Separate from sendReminder()
 * because that function's copy/links are player-facing — this is a plain
 * operational ping (e.g. "a game just started"), so it sends the message
 * text as-is with no template.
 */
export async function sendOwnerAlert(message) {
  const t = getTransporter();
  if (!t) {
    throw Object.assign(new Error('Mailer not configured'), { code: 'NOT_CONFIGURED' });
  }

  const gateway = CARRIER_GATEWAYS[process.env.ALERT_CARRIER];
  const digits = typeof process.env.ALERT_PHONE === 'string' ? process.env.ALERT_PHONE.replace(/\D/g, '') : '';
  if (!digits || !gateway) {
    throw Object.assign(new Error('ALERT_PHONE and a supported ALERT_CARRIER are required'), { code: 'NOT_CONFIGURED' });
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: `${digits}@${gateway}`,
    subject: 'Unravel Codes alert',
    text: message,
  });
}

export async function sendReminder(opts) {
  const t = getTransporter();
  if (!t) {
    throw Object.assign(new Error('Mailer not configured'), { code: 'NOT_CONFIGURED' });
  }

  const to = resolveRecipient(opts);

  const mail = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Play Unravel Codes',
    text: buildReminderText(opts.whenLabel, opts.campaignSource, opts.method),
  };
  if (opts.method === 'email') {
    mail.html = buildReminderHtml(opts.whenLabel, opts.campaignSource);
  }
  await t.sendMail(mail);
}
