#!/usr/bin/env node
/**
 * Pull the full play-by-play for one or more game codes off the live server.
 *
 * Why this exists: the nightly Jarvis playtest texts a SUMMARY, and the text
 * gets trimmed to fit one message ("...trimmed to fit one message"). The real
 * move-by-move record is never in the text at all — it lives in the server's
 * saved game state (server/data/games.json, the globalActionLog per game).
 * This reads that and prints it as readable markdown.
 *
 * Usage:
 *   node scripts/playtest-transcript.mjs G-JMGQ-KNR3 G-DTQ4-7ZVV
 *   node scripts/playtest-transcript.mjs --today          # every game started today
 *   node scripts/playtest-transcript.mjs --list           # just show what's on the server
 *   node scripts/playtest-transcript.mjs --today > report.md
 *
 * Reads over `ssh unraid` by default (passwordless key, see memory). Point it
 * at a local file instead with:  --file path/to/games.json
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REMOTE = '/mnt/user/appdata/Game_alpha/server/data/games.json';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valOf = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const codes = args.filter((a) => /^G-/i.test(a)).map((a) => a.toUpperCase());

function loadGames() {
  const local = valOf('--file');
  if (local) return JSON.parse(fs.readFileSync(local, 'utf8'));
  // -o BatchMode=yes so a missing key fails fast instead of hanging on a prompt.
  const raw = execFileSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', 'unraid', `cat ${REMOTE}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(raw);
}

const data = loadGames();
const all = data.games || [];

if (flag('--list')) {
  const rows = all
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 40);
  console.log('Most recent games on the server:\n');
  for (const g of rows) {
    const n = g.state?.globalActionLog?.length || 0;
    console.log(`  ${g.id}  ${String(g.createdAt).replace('T', ' ').slice(0, 19)}  ${n} log entries`);
  }
  process.exit(0);
}

let picked;
if (flag('--today')) {
  const day = new Date().toISOString().slice(0, 10);
  picked = all.filter((g) => String(g.createdAt).startsWith(day));
} else if (codes.length) {
  picked = codes.map((c) => all.find((g) => g.id === c)).filter(Boolean);
  const missing = codes.filter((c) => !all.some((g) => g.id === c));
  if (missing.length) console.error(`# not found on server: ${missing.join(', ')}\n`);
} else {
  console.error('Give one or more game codes, or --today / --list. See header for usage.');
  process.exit(1);
}

if (!picked.length) {
  console.error('Nothing to show. Games expire, so an old code may already be cleaned up.');
  process.exit(1);
}

const clock = (s) => new Date(s).toISOString().slice(11, 19);
const out = [];
out.push(`# Playtest play-by-play (${picked.length} game${picked.length === 1 ? '' : 's'})`);
out.push('');
out.push('Pulled from the live server\'s saved game state — every move actually made.');
out.push('');

picked.forEach((g, n) => {
  const s = g.state || {};
  const p = s.players?.[0] || {};
  const log = s.globalActionLog || [];
  const secs = Math.round((new Date(g.lastActivity) - new Date(g.createdAt)) / 1000);
  out.push('---', '');
  out.push(`## Game ${n + 1} — ${g.id}`, '');
  out.push(
    `Started ${String(g.createdAt).replace('T', ' ').slice(0, 19)} UTC, ` +
      `last move ${String(g.lastActivity).replace('T', ' ').slice(0, 19)} UTC (${secs}s of play).`
  );
  out.push(
    `Ended on **${p.currentSpace}** (${p.visitType} visit) with ` +
      `$${(p.money || 0).toLocaleString()} and ${p.timeSpent} days spent. ${log.length} log entries.`
  );
  out.push('');
  out.push('| # | time | what happened | where | type |');
  out.push('|---|---|---|---|---|');
  log.forEach((e, i) => {
    const where = e.details?.spaceName || '';
    const desc = String(e.description || '').replace(/\|/g, '\|');
    out.push(`| ${i + 1} | ${clock(e.timestamp)} | ${desc} | ${where} | ${e.type} |`);
  });
  out.push('');
});

console.log(out.join('\n'));
