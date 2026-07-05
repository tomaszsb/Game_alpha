// server/reminderScheduler.js
//
// Persistent, minute-granularity scheduler for playtest reminders — the one
// place that fires a reminder at its chosen time, whichever channel it uses:
//   - kind 'push'          -> Web Push (VAPID) to a browser subscription
//   - kind 'email' / 'sms' -> SMTP via mailer.sendReminder (sms = carrier
//                             email-to-text gateway)
//
// Unlike a setTimeout, this survives a closed tab AND a container restart:
// pending sends live in a JSON file (same file-based pattern as the rest of
// this server, e.g. logVisitor), and a periodic check fires anything due.
//
// VAPID keys are a local cryptographic keypair, not a third-party account —
// generate with: node -e "console.log(require('web-push').generateVAPIDKeys())"

import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import { sendReminder } from './mailer.js';

let PENDING_FILE = null;
let vapidConfigured = false;

export function initReminderScheduler(dataDir) {
  PENDING_FILE = path.join(dataDir, 'scheduled-reminders.json');

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      VAPID_SUBJECT || 'mailto:admin@unravelcodes.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
  }

  setInterval(checkAndSend, 60 * 1000);
}

export function isPushConfigured() {
  return vapidConfigured;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function readPending() {
  try {
    if (!fs.existsSync(PENDING_FILE)) return [];
    return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writePending(list) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(list, null, 2));
}

function addPending(entry) {
  const list = readPending();
  list.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sent: false,
    ...entry,
  });
  writePending(list);
}

export function schedulePush(subscription, sendAt, campaignSource) {
  addPending({ kind: 'push', subscription, sendAt, campaignSource: campaignSource || null });
}

// opts: { method: 'email'|'sms', email?, phone?, carrier?, whenLabel? }
export function scheduleMail(opts, sendAt, campaignSource) {
  addPending({
    kind: opts.method === 'sms' ? 'sms' : 'email',
    method: opts.method,
    email: opts.email || null,
    phone: opts.phone || null,
    carrier: opts.carrier || null,
    whenLabel: opts.whenLabel || null,
    sendAt,
    campaignSource: campaignSource || null,
  });
}

function buildReminderUrl(campaignSource) {
  const base = 'https://game.unravelcodes.com/challenge';
  return campaignSource ? `${base}?src=${encodeURIComponent(campaignSource)}` : base;
}

async function fireOne(item) {
  if (item.kind === 'push') {
    if (!vapidConfigured) return;
    await webpush.sendNotification(
      item.subscription,
      JSON.stringify({
        title: 'Unravel Codes',
        body: 'Ready to play? Grab a PC, TV, or tablet.',
        url: buildReminderUrl(item.campaignSource),
      })
    );
    return;
  }
  // email / sms both go through the mailer.
  await sendReminder({
    method: item.method,
    email: item.email,
    phone: item.phone,
    carrier: item.carrier,
    whenLabel: item.whenLabel,
    campaignSource: item.campaignSource,
  });
}

async function checkAndSend() {
  if (!PENDING_FILE) return;
  const list = readPending();
  const now = Date.now();
  let changed = false;

  for (const item of list) {
    if (item.sent) continue;
    if (new Date(item.sendAt).getTime() > now) continue;

    try {
      await fireOne(item);
    } catch (err) {
      // Mark sent anyway (below) so a permanently-bad entry — dead push
      // subscription, SMTP down, blocked carrier gateway — can't retry
      // forever. A missed playtest reminder is low-stakes; an infinite loop
      // isn't.
      console.error(`Reminder send failed (${item.kind}):`, err && err.message);
    }
    item.sent = true;
    changed = true;
  }

  if (changed) {
    // Drop sent entries older than 7 days so the file doesn't grow forever.
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const pruned = list.filter(i => !i.sent || new Date(i.sendAt).getTime() > cutoff);
    writePending(pruned);
  }
}
