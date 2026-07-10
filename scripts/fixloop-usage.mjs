#!/usr/bin/env node
// fixloop-usage.mjs — token-budget meter for the autonomous fix loop.
//
// Reads every Claude Code transcript on this machine (~/.claude/projects/**/*.jsonl),
// sums cost-weighted token usage since the plan's weekly reset, and reports it as a
// percent of the calibrated weekly budget, against the day-of-week cap schedule.
//
// Usage:
//   node scripts/fixloop-usage.mjs                      → status JSON
//   node scripts/fixloop-usage.mjs --set-reset <day> <hour24>   e.g. --set-reset thursday 9
//   node scripts/fixloop-usage.mjs --calibrate <pct>    → anchor: "the official /usage screen
//                                                         says <pct>% right now"; computes the
//                                                         weekly budget from receipts and saves it.
//
// Notes:
// - Absolute $ figures are estimates; calibration makes the *percentages* track the real plan.
// - Cloud work (ultrareview, remote agents) leaves no local receipts and is invisible here —
//   re-run --calibrate after heavy cloud use to re-anchor.

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

const CONFIG_PATH = path.join(process.cwd(), '.claude', 'fixloop', 'config.json');
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// $/MTok. Relative weights between models are what matter; calibration absorbs absolute error.
const PRICING = [
  { match: /fable/, in: 15, out: 75 },
  { match: /opus/, in: 5, out: 25 },
  { match: /sonnet/, in: 3, out: 15 },
  { match: /haiku/, in: 1, out: 5 },
];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
}

// Most recent weekly reset instant <= now, from configured day-of-week + local hour.
function lastReset(cfg, now = new Date()) {
  const targetDow = DAYS.indexOf(cfg.resetDay.toLowerCase());
  const d = new Date(now);
  d.setHours(cfg.resetHour, 0, 0, 0);
  while (d.getDay() !== targetDow || d > now) d.setDate(d.getDate() - 1);
  return d;
}

function priceFor(model) {
  for (const p of PRICING) if (p.match.test(model)) return p;
  return PRICING[2]; // unknown model → price as sonnet
}

function costOf(model, u) {
  const p = priceFor(model);
  const write5m = u.cache_creation?.ephemeral_5m_input_tokens ?? u.cache_creation_input_tokens ?? 0;
  const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  return (
    (u.input_tokens ?? 0) * p.in +
    (u.cache_read_input_tokens ?? 0) * p.in * 0.1 +
    write5m * p.in * 1.25 +
    write1h * p.in * 2 +
    (u.output_tokens ?? 0) * p.out
  ) / 1e6;
}

async function sumSince(resetAt) {
  const seen = new Map(); // message id → {model, usage}; streaming rewrites the same id, keep last
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.jsonl') && fs.statSync(full).mtime >= resetAt) files.push(full);
    }
  };
  walk(PROJECTS_DIR);

  for (const f of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
    for await (const line of rl) {
      let j; try { j = JSON.parse(line); } catch { continue; }
      const m = j.message;
      if (!m?.usage || !m.model || !j.timestamp) continue;
      if (new Date(j.timestamp) < resetAt) continue;
      seen.set(m.id ?? `${f}:${j.timestamp}`, { model: m.model, usage: m.usage });
    }
  }
  let total = 0;
  const byModel = {};
  for (const { model, usage } of seen.values()) {
    const c = costOf(model, usage);
    total += c;
    byModel[model] = (byModel[model] ?? 0) + c;
  }
  return { total, byModel, files: files.length, messages: seen.size };
}

const args = process.argv.slice(2);

if (args[0] === '--set-reset') {
  const cfg = loadConfig();
  const day = args[1]?.toLowerCase();
  const hour = parseInt(args[2], 10);
  if (!DAYS.includes(day) || isNaN(hour) || hour < 0 || hour > 23) {
    console.error('usage: --set-reset <sunday..saturday> <hour 0-23, local time>');
    process.exit(1);
  }
  cfg.resetDay = day; cfg.resetHour = hour;
  saveConfig(cfg);
  console.log(JSON.stringify({ ok: true, resetDay: day, resetHour: hour, lastReset: lastReset(cfg).toString() }));
  process.exit(0);
}

const cfg = loadConfig();
if (!cfg.resetDay) {
  console.log(JSON.stringify({ ok: false, reason: 'reset day not set — run: node scripts/fixloop-usage.mjs --set-reset <day> <hour>' }));
  process.exit(0);
}

const resetAt = lastReset(cfg);
const { total, byModel, files, messages } = await sumSince(resetAt);

if (args[0] === '--calibrate') {
  const pct = parseFloat(args[1]);
  if (isNaN(pct) || pct <= 0 || pct > 100) { console.error('usage: --calibrate <current official pct, e.g. 43.5>'); process.exit(1); }
  cfg.weeklyBudgetUsd = +(total / (pct / 100)).toFixed(2);
  cfg.calibratedAt = new Date().toISOString();
  cfg.calibratedPct = pct;
  saveConfig(cfg);
  console.log(JSON.stringify({ ok: true, usedUsdEstimate: +total.toFixed(2), officialPct: pct, weeklyBudgetUsd: cfg.weeklyBudgetUsd }));
  process.exit(0);
}

const dayIndex = Math.min(7, Math.floor((Date.now() - resetAt.getTime()) / 86400000) + 1);
const capPct = cfg.dailyCapsPct[dayIndex - 1];
const calibrated = !!cfg.weeklyBudgetUsd;
const usedPct = calibrated ? +((total / cfg.weeklyBudgetUsd) * 100).toFixed(2) : null;

console.log(JSON.stringify({
  ok: calibrated && usedPct < capPct,
  reason: !calibrated ? 'not calibrated — run --calibrate <pct> with the official /usage number' : (usedPct >= capPct ? 'daily cap reached' : 'within budget'),
  dayIndex, capPct, usedPct,
  headroomPct: calibrated ? +(capPct - usedPct).toFixed(2) : null,
  usedUsdEstimate: +total.toFixed(2),
  weeklyBudgetUsd: cfg.weeklyBudgetUsd ?? null,
  resetAt: resetAt.toString(),
  byModel: Object.fromEntries(Object.entries(byModel).map(([k, v]) => [k, +v.toFixed(2)])),
  scanned: { files, messages },
}, null, 2));
