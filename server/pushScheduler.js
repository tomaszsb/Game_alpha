// server/pushScheduler.js
//
// Persistent, minute-granularity scheduler for browser push reminders
// (the Reminder Hub's "Browser Notification" option). Unlike the setTimeout
// approach the original placeholder text warned about, this survives a
// closed tab AND a container restart: pending sends live in a JSON file
// (same file-based pattern as the rest of this server, e.g. logVisitor),
// and a periodic check fires anything due.
//
// VAPID keys are a local cryptographic keypair, not a third-party account —
// generate with: node -e "console.log(require('web-push').generateVAPIDKeys())"

import fs from 'fs';
import path from 'path';
import webpush from 'web-push';

let PENDING_FILE = null;
let vapidConfigured = false;

export function initPushScheduler(dataDir) {
  PENDING_FILE = path.join(dataDir, 'scheduled-push.json');

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

export function schedulePush(subscription, sendAt, campaignSource) {
  const list = readPending();
  list.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subscription,
    sendAt,
    campaignSource: campaignSource || null,
    sent: false,
  });
  writePending(list);
}

function buildReminderUrl(campaignSource) {
  const base = 'https://game.unravelcodes.com/challenge';
  return campaignSource ? `${base}?src=${encodeURIComponent(campaignSource)}` : base;
}

async function checkAndSend() {
  if (!vapidConfigured || !PENDING_FILE) return;
  const list = readPending();
  const now = Date.now();
  let changed = false;

  for (const item of list) {
    if (item.sent) continue;
    if (new Date(item.sendAt).getTime() > now) continue;

    try {
      await webpush.sendNotification(
        item.subscription,
        JSON.stringify({
          title: 'Unravel Codes',
          body: 'Ready to play? Grab a PC, TV, or tablet.',
          url: buildReminderUrl(item.campaignSource),
        })
      );
    } catch (err) {
      console.error('Push send failed:', err && err.message);
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
