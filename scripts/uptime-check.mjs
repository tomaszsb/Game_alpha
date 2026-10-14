// scripts/uptime-check.mjs
// Outside uptime check: asks https://game.unravelcodes.com/health whether the game is answering, and texts the owner
// (server/mailer.js sendOwnerAlert, the same path as the foreign-game alert) after 3 misses in a row, and once more when
// it is back. Run it from a machine that is NOT the server, every 5 minutes (Windows Task Scheduler on the maintainer's
// PC; see docs/technical/ARCHITECTURE.md "Uptime check"). Decision logic: server/uptimeMonitor.js.
//
//   node scripts/uptime-check.mjs            one check (what the scheduler runs)
//   node scripts/uptime-check.mjs --dry-run  one check, prints what it WOULD text, sends nothing, remembers nothing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideUptime } from '../server/uptimeMonitor.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_TO_CHECK = process.env.UPTIME_URL || 'https://game.unravelcodes.com/health';
const STATE_FILE = path.join(root, '.claude', 'tmp', 'uptime-state.json');
const LOG_FILE = path.join(root, '.claude', 'tmp', 'uptime.log');
const dryRun = process.argv.includes('--dry-run');

try { process.loadEnvFile(path.join(root, '.env')); } catch { /* no .env: the alert will say the mailer is not configured */ }

async function check() {
  try {
    const res = await fetch(URL_TO_CHECK, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.status === 'ok';
  } catch {
    return false;
  }
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}

function log(line) {
  const text = `${new Date().toISOString()} ${line}\n`;
  if (dryRun) { process.stdout.write(text); return; }
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, text);
}

const ok = await check();
const { state, alert } = decideUptime(readState(), ok, new Date().toISOString());
log(`${ok ? 'up' : 'MISS'} fails=${state.fails}${alert ? ` alert="${alert}"` : ''}`);
// (no process.exit: on Windows it can trip a libuv assertion right after a timed-out fetch)
if (!dryRun) {
  let sent = true;
  if (alert) {
    try {
      const { sendOwnerAlert } = await import('../server/mailer.js');
      await sendOwnerAlert(alert);
    } catch (err) {
      sent = false;
      log(`alert NOT sent: ${err.message}`);
    }
  }
  // A failed send keeps the old state, so the next run tries the same alert again instead of going quiet.
  if (sent) {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  }
}
