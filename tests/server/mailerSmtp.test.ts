// tests/server/mailerSmtp.test.ts
//
// nodemailer 9 -> 10.0.13 (2026-09-30). The upgrade was deferred on 2026-09-18 because the
// only use (server/mailer.js: createTransport + sendMail for Reminder Hub emails, text
// reminders and the owner alert) "cannot be exercised without live credentials". It
// stopped being optional: every nodemailer up to 10.0.8 has four advisories (a high-
// severity cross-tenant SMTP credential leak, two parser DoS, a malformed-envelope bug).
//
// This drives the REAL mailer code through the REAL nodemailer SMTP client against a tiny
// in-process SMTP server, so a change in how 10.x connects, authenticates or builds a
// message shows up here instead of on the first real reminder.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import net from 'net';

interface Captured { authed: boolean; from: string; to: string[]; data: string }

let server: net.Server;
let port = 0;
let captured: Captured[] = [];

function startFakeSmtp(): Promise<void> {
  return new Promise((resolve) => {
    server = net.createServer((socket) => {
      let buf = '';
      let inData = false;
      let dataBuf = '';
      const cur: Captured = { authed: false, from: '', to: [], data: '' };
      const send = (s: string) => socket.write(s + '\r\n');
      send('220 fake.smtp ESMTP ready');
      socket.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        let idx: number;
        while ((idx = buf.indexOf('\r\n')) !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (inData) {
            if (line === '.') {
              inData = false;
              cur.data = dataBuf;
              captured.push({ ...cur, to: [...cur.to] });
              dataBuf = '';
              cur.to = [];
              send('250 2.0.0 queued');
            } else {
              dataBuf += (line.startsWith('..') ? line.slice(1) : line) + '\n';
            }
            continue;
          }
          const cmd = line.toUpperCase();
          if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) {
            socket.write('250-fake.smtp\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
          } else if (cmd.startsWith('AUTH PLAIN')) {
            const token = line.split(' ')[2] ?? '';
            const decoded = Buffer.from(token, 'base64').toString('utf8'); // \0user\0pass
            cur.authed = decoded === '\0sender@example.test\0app-password';
            send(cur.authed ? '235 2.7.0 ok' : '535 5.7.8 bad credentials');
          } else if (cmd.startsWith('MAIL FROM')) {
            cur.from = line;
            send('250 ok');
          } else if (cmd.startsWith('RCPT TO')) {
            cur.to.push(line);
            send('250 ok');
          } else if (cmd === 'DATA') {
            inData = true;
            send('354 go ahead');
          } else if (cmd === 'QUIT') {
            send('221 bye');
            socket.end();
          } else {
            send('250 ok');
          }
        }
      });
      socket.on('error', () => undefined);
    });
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as net.AddressInfo).port;
      resolve();
    });
  });
}

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'ALERT_PHONE', 'ALERT_CARRIER'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(async () => { await startFakeSmtp(); });
afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  captured = [];
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(port);
  process.env.SMTP_USER = 'sender@example.test';
  process.env.SMTP_PASS = 'app-password';
  process.env.SMTP_FROM = 'Unravel Codes <sender@example.test>';
  process.env.ALERT_PHONE = '(555) 010-2030';
  process.env.ALERT_CARRIER = 'verizon';
  vi.resetModules(); // mailer.js keeps a module-level transporter; build a fresh one per test
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('mailer.js through the real nodemailer SMTP client', () => {
  it('sends a reminder email: authenticates, addresses it, carries subject, text and HTML', async () => {
    const { sendReminder, isMailerConfigured } = await import('../../server/mailer.js');
    expect(isMailerConfigured()).toBe(true);
    await sendReminder({ method: 'email', email: 'player@example.test', whenLabel: 'tomorrow 3pm', campaignSource: 'reddit' });

    expect(captured).toHaveLength(1);
    const m = captured[0];
    expect(m.authed).toBe(true);
    expect(m.from).toMatch(/sender@example\.test/);
    expect(m.to.join(' ')).toMatch(/player@example\.test/);
    expect(m.data).toMatch(/Subject: Play Unravel Codes/);
    expect(m.data).toMatch(/Reminder to play Unravel Codes \(tomorrow 3pm\)/);
    expect(m.data).toMatch(/text\/html/);
    expect(m.data).toMatch(/src=reddit/);
  });

  it('sends a text reminder to the carrier gateway as plain text, without the tracking link', async () => {
    const { sendReminder } = await import('../../server/mailer.js');
    await sendReminder({ method: 'sms', phone: '555-010-2030', carrier: 'verizon', campaignSource: 'reddit' });

    const m = captured[0];
    expect(m.to.join(' ')).toMatch(/5550102030@vtext\.com/);
    expect(m.data).not.toMatch(/text\/html/);
    expect(m.data).not.toMatch(/src=reddit/);
  });

  it('sends the owner alert to the configured phone', async () => {
    const { sendOwnerAlert } = await import('../../server/mailer.js');
    await sendOwnerAlert('a game just started');

    const m = captured[0];
    expect(m.authed).toBe(true);
    expect(m.to.join(' ')).toMatch(/5550102030@vtext\.com/);
    expect(m.data).toMatch(/Subject: Unravel Codes alert/);
    expect(m.data).toMatch(/a game just started/);
  });

  it('a wrong password is an error, never a silent success', async () => {
    process.env.SMTP_PASS = 'wrong';
    const { sendReminder } = await import('../../server/mailer.js');
    await expect(sendReminder({ method: 'email', email: 'player@example.test' })).rejects.toThrow();
    expect(captured).toHaveLength(0);
  });

  it('with no SMTP settings it reports not configured and sends nothing', async () => {
    delete process.env.SMTP_HOST;
    const { sendReminder, isMailerConfigured } = await import('../../server/mailer.js');
    expect(isMailerConfigured()).toBe(false);
    await expect(sendReminder({ method: 'email', email: 'player@example.test' })).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
