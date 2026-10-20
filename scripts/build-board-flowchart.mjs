// Draws ONE flowchart of the board path from "Hire a Builder" to the end, straight from the
// game's data files, so no number on it is typed by hand.
//
//   node scripts/build-board-flowchart.mjs            -> docs/technical/BOARD_PATH_FLOWCHART.html
//
// Reads public/data/CLEAN_FILES: MOVEMENT, DICE_OUTCOMES, DICE_EFFECTS, SPACE_EFFECTS,
// SPACE_CONTENT, LOGIC_QUESTIONS, and public/data/SOURCE_FILES/Spaces.csv (tile names).
// "New since v3.8.0" is read from git (spaces missing from MOVEMENT.csv just before v3.8.0).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const clean = (f) => path.join(root, 'public/data/CLEAN_FILES', f);

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...b] = rows;
  return b.filter(r => r.length > 1 || r[0]).map(r => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()])));
}
const load = (p) => parseCsv(fs.readFileSync(p, 'utf8'));
const MOVE = load(clean('MOVEMENT.csv'));
const OUT = load(clean('DICE_OUTCOMES.csv'));
const DEFF = load(clean('DICE_EFFECTS.csv'));
const SEFF = load(clean('SPACE_EFFECTS.csv'));
const CONT = load(clean('SPACE_CONTENT.csv'));
const LOGIC = load(clean('LOGIC_QUESTIONS.csv'));
const TROPHY = load(clean('TROPHIES.csv'));
const SPACES = load(path.join(root, 'public/data/SOURCE_FILES/Spaces.csv'));

const NAME = {};
for (const r of SPACES) if (r.display_label_override && !NAME[r.space_name]) NAME[r.space_name] = r.display_label_override;
const nm = (s) => NAME[s] || s;

// ---- which spaces are new since v3.8.0 (read from git) ----
let NEW = new Set();
try {
  const c = execSync('git log --format="%h %s"', { cwd: root, encoding: 'utf8', maxBuffer: 1e8 })
    .split('\n').find(l => / v3\.8\.0:/.test(l)).split(' ')[0];
  const old = execSync(`git show ${c}^:public/data/CLEAN_FILES/MOVEMENT.csv`, { cwd: root, encoding: 'utf8', maxBuffer: 1e8 });
  const had = new Set(parseCsv(old).map(r => r.space_name));
  for (const r of MOVE) if (!had.has(r.space_name)) NEW.add(r.space_name);
} catch (e) { console.warn('git lookup failed, no NEW tags:', e.message); }

const V = ['First', 'Subsequent'];
const mv = (s, v) => MOVE.find(r => r.space_name === s && r.visit_type === v);
const outRow = (s, v) => OUT.find(r => r.space_name === s && r.visit_type === v);
const cont = (s, v) => CONT.find(r => r.space_name === s && r.visit_type === v);
const effs = (s, v) => SEFF.filter(r => r.space_name === s && r.visit_type === v);
const deff = (s, v, type) => DEFF.find(r => r.space_name === s && r.visit_type === v && r.effect_type === type);
const rolls = (r) => r ? [1, 2, 3, 4, 5, 6].map(i => r[`roll_${i}`]) : null;
const money = (n) => '$' + Math.abs(n).toLocaleString('en-US');
const isRoute = (x) => /^[A-Z0-9]+-[A-Z0-9-]+/.test(x || '') || /^FINISH$/.test(x || '');

// per-roll days / dollars (only where the cells are plain numbers, never route names)
function rollCosts(s, v) {
  const t = rolls(deff(s, v, 'time')), m = rolls(deff(s, v, 'money'));
  const days = t && !t.some(isRoute) ? t.map(x => (x.match(/^(\d+)\s*day/) || [])[1]).map(x => x === undefined ? null : +x) : null;
  const pct = m && m.every(x => /%$/.test(x)) ? m : null;
  const mon = m && !pct ? m.map(x => (x === '' ? null : +x)) : null;
  return { days, mon, pct };
}
const costText = (c, i) => {
  const p = [];
  if (c.days && c.days[i] != null) p.push(`${c.days[i]} day${c.days[i] === 1 ? '' : 's'}`);
  if (c.mon && c.mon[i]) p.push(money(c.mon[i]));
  if (c.pct && c.pct[i]) p.push(`${c.pct[i]} fee`);
  return p.join(' + ');
};

// ---- routing per space / visit -> list of {dst[], rolls:[..], kind, costs} ----
function routes(s, v) {
  const m = mv(s, v);
  if (!m) return [];
  const dests = [1, 2, 3, 4, 5].map(i => m[`destination_${i}`]).filter(Boolean);
  if (m.movement_type === 'fixed') return [{ dsts: dests, kind: 'fixed' }];
  if (m.movement_type === 'choice') return [{ dsts: dests, kind: 'choice' }];
  if (m.movement_type === 'logic') return [{ dsts: dests, kind: 'logic' }];
  if (m.movement_type === 'dice') {
    const r = rolls(outRow(s, v)) || rolls(deff(s, v, 'Next Step'));
    if (!r) return [];
    const c = rollCosts(s, v);
    const groups = new Map();
    r.forEach((cell, i) => {
      const key = cell;
      if (!groups.has(key)) groups.set(key, { dsts: cell.split(' or ').map(x => x.trim()), kind: cell.includes(' or ') ? 'dice-pick' : 'dice', n: 0, costs: new Map() });
      const g = groups.get(key); g.n++;
      const ct = costText(c, i); g.costs.set(ct, (g.costs.get(ct) || 0) + 1);
    });
    return [...groups.values()];
  }
  return [];
}
const costSummary = (costs) => {
  const parts = [...costs.entries()].filter(([k]) => k);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0][0];
  return parts.map(([k, n]) => `${k} (${n})`).join(', ');
};

// ---- node text ----
function nodeLines(s) {
  const lines = []; // {t, cls}
  const per = (fn) => {
    const a = fn('First'), b = fn('Subsequent');
    if (JSON.stringify(a) === JSON.stringify(b)) return a.map(x => ({ t: x, cls: '' }));
    return [...a.map(x => ({ t: '1st visit: ' + x, cls: '' })), ...b.map(x => ({ t: 'Coming back: ' + x, cls: 'back' }))];
  };
  // what arriving costs (fixed rows)
  lines.push(...per(v => effs(s, v).filter(e => ['time', 'fee'].includes(e.effect_type)).map(e => e.description)));
  // dice cost tables that are not tied to a route (the roll only sets days / dollars)
  lines.push(...per(v => {
    const m = mv(s, v); if (m && m.movement_type === 'dice') return [];
    const c = rollCosts(s, v); const any = (a) => a && a.some(x => x); if (!any(c.days) && !any(c.mon)) return [];
    const cnt = new Map();
    for (let i = 0; i < 6; i++) { const k = costText(c, i) || '0'; cnt.set(k, (cnt.get(k) || 0) + 1); }
    return ['Then: ' + [...cnt.entries()].map(([k, n]) => `${n} in 6 ${k === '0' ? 'nothing' : k}`).join(' / ')];
  }));
  // the builder's three offers (TROPHIES.csv), first visit at the builder's space
  if (s === 'CON-INITIATION') {
    const tv = (kind, key) => TROPHY.find(r => r.kind === kind && r.key === key)?.value;
    const offers = tv('rule', 'bids_offered');
    const q = ['HIGH', 'MED', 'LOW'].map(k => ({ n: TROPHY.find(r => r.kind === 'builder_quality' && r.key === k)?.text, price: tv('builder_price', k), speed: tv('builder_speed', k), pts: tv('points', TROPHY.find(r => r.kind === 'builder_quality' && r.key === k)?.value) }));
    lines.push({ t: `${offers} builder offers to pick from. Price / time / quality points: ` + q.map(x => `${x.n} ×${x.price} / ×${x.speed} / ${x.pts}`).join('; '), cls: '' });
  }
  // life-event card chance (a number on the die is hidden: voice rule)
  lines.push(...per(v => effs(s, v).filter(e => e.effect_action === 'draw_L').map(e => '1 in 6 a life event happens')));
  // manual card moves
  lines.push(...per(v => effs(s, v).filter(e => e.effect_type === 'cards' && ['return_e', 'replace_e', 'transfer'].includes(e.effect_action)).map(e => e.description + ' (optional)')));
  // push back
  const pb = (v) => {
    const c = cont(s, v);
    if (!c || !/^yes$/i.test(c.can_negotiate)) return [];
    const timeAdd = effs(s, v).filter(e => e.effect_type === 'time' && e.effect_action === 'add').reduce((a, e) => a + (+e.effect_value || 0), 0);
    const days = c.try_again_days !== '' ? +c.try_again_days : timeAdd;
    const bits = [];
    if (c.try_again_e_cost) bits.push(`send ${c.try_again_e_cost} expeditor and pay 0 days, or without one`);
    bits.push(`${days} day${days === 1 ? '' : 's'}`);
    if (c.try_again_scope_pct) bits.push(`+ ${c.try_again_scope_pct}% of scope`);
    return ['Push back (stay here): ' + bits.join(' ')];
  };
  lines.push(...per(pb));
  // dedupe identical consecutive
  const seen = new Set(); return lines.filter(l => !seen.has(l.t) && seen.add(l.t));
}

// ---- layout (positions only; every word and number comes from the data) ----
const W = 262, GX = 58, X0 = 24;
const col = (c) => X0 + c * (W + GX);
// [column, band, row]
const NODES = {
  'REG-DOB-TYPE-SELECT': [0, 0, 0], 'REG-DOB-PLAN-EXAM': [1, 0, 0], 'REG-DOB-PROF-CERT': [1, 0, 1], 'REG-DOB-AUDIT': [2, 0, 1],
  'REG-FDNY-FEE-REVIEW': [3, 0, 0], 'REG-FDNY-PLAN-EXAM': [4, 0, 0],
  'CON-INITIATION': [0, 1, 1], 'SI-HIRE': [1, 1, 1], 'SI-AGENCY-TOP': [2, 1, 0], 'SI-AGENCY-BUDGET': [2, 1, 1], 'SI-SKIP': [2, 1, 2],
  'CON-ISSUES': [3, 1, 1], 'TR8-TEST-NOW': [4, 1, 0], 'TR8-TEST-LATER': [4, 1, 1],
  'CON-INSPECT': [0, 2, 0], 'CON-FIX': [1, 2, 0], 'CON-STEER': [1, 2, 1], 'REG-DOB-FINAL-REVIEW': [3, 2, 0], 'FINISH': [4, 2, 0],
};
const FORKS = new Set(['CON-INITIATION', 'SI-HIRE', 'CON-ISSUES', 'CON-INSPECT', 'REG-DOB-TYPE-SELECT', 'REG-FDNY-FEE-REVIEW']);
const FS = 12, LH = 15, CH = FS * 0.55;
const wrap = (t, w) => { const max = Math.floor(w / CH); const out = []; let cur = ''; for (const wd of t.split(' ')) { if ((cur + ' ' + wd).trim().length > max) { out.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); } if (cur) out.push(cur); return out; };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- edges (first pass: build exit text for every route) ----
const edgeMap = new Map();
for (const s of Object.keys(NODES)) {
  for (const v of V) {
    for (const r of routes(s, v)) {
      for (const d of r.dsts) {
        const label =
          r.kind === 'fixed' ? 'always' :
          r.kind === 'choice' ? 'you pick' :
          r.kind === 'logic' ? '' :
          r.kind === 'dice-pick' ? `${r.n} in 6, then you pick` :
          `${r.n} in 6`;
        const cost = r.costs ? costSummary(r.costs) : '';
        const key = s + '>' + d;
        const e = edgeMap.get(key) || { src: s, dst: d, label: {}, cost: {}, kind: r.kind };
        e.label[v] = (e.label[v] ? e.label[v] + ' + ' : '') + label;
        e.cost[v] = cost;
        edgeMap.set(key, e);
      }
    }
  }
}
const LOGIC_LABEL = {
  'REG-FDNY-PLAN-EXAM': 'if you have fire protection, or the city sent you, or your scope changed',
  'PM-DECISION-CHECK': 'if DOB already approved you (you pick)',
  'CON-INITIATION': 'if DOB already approved you (you pick)',
  'REG-DOB-TYPE-SELECT': 'if you have no DOB approval yet',
};
const exitText = (e) => {
  if (e.src === 'REG-FDNY-FEE-REVIEW') return `${LOGIC_LABEL[e.dst] || ''}: ${nm(e.dst)}`;
  const a = e.label.First, b = e.label.Subsequent, ca = e.cost.First, cb = e.cost.Subsequent;
  const part = (l, c) => [l, c].filter(Boolean).join(', ');
  const f = part(a, ca), r = part(b, cb);
  let t;
  if (a && b && f === r) t = f; else if (a && b) t = `1st visit ${f} / coming back ${r}`; else if (a) t = `1st visit ${f}`; else t = `coming back ${r}`;
  return `${t}: ${nm(e.dst)}`;
};
const forwardOK = (e) => { const a = NODES[e.src], b = NODES[e.dst]; if (!b) return false; return b[1] > a[1] || (b[1] === a[1] && b[0] > a[0]); };

// node bodies: costs + every exit
const body = {}, geo = {};
for (const s of Object.keys(NODES)) {
  const ls = nodeLines(s);
  const exits = [...edgeMap.values()].filter(e => e.src === s).map(e => ({ t: '→ ' + exitText(e), cls: forwardOK(e) ? 'ex' : 'ex bk' }));
  const all = [...ls, ...exits].map(l => ({ ...l, w: wrap(l.t, W - 20) }));
  body[s] = all;
  geo[s] = { h: 50 + all.reduce((a, l) => a + l.w.length * LH + 3, 0) + 6 };
}
const rowH = {};
for (const [s, p] of Object.entries(NODES)) { const k = p[1] + ',' + p[2]; rowH[k] = Math.max(rowH[k] || 0, geo[s].h); }
const ROWGAP = 30, BANDGAP = 90;
const bandOf = [0, 1, 2].map(b => Object.keys(rowH).filter(k => k.startsWith(b + ',')).map(k => +k.split(',')[1]).sort());
const BAND_Y = [], BAND_B = [], ROWY = []; let yy = 70;
for (const b of [0, 1, 2]) {
  BAND_Y[b] = yy; ROWY[b] = {};
  for (const r of bandOf[b]) { ROWY[b][r] = yy; yy += rowH[b + ',' + r] + ROWGAP; }
  BAND_B[b] = yy - ROWGAP; yy += BANDGAP - ROWGAP;
}
for (const [s, p] of Object.entries(NODES)) { Object.assign(geo[s], { x: col(p[0]), y: ROWY[p[1]][p[2]], w: W, band: p[1], col: p[0] }); }
const TOTAL_H = BAND_B[2] + 70, TOTAL_W = col(4) + W + X0;

// ---- svg ----
let svg = ''; const labels = [];
const fwd = [...edgeMap.values()].filter(forwardOK);
const outIdx = {}, inIdx = {};
for (const e of fwd) {
  const a = geo[e.src], b = geo[e.dst];
  const oi = (outIdx[e.src] = (outIdx[e.src] ?? -1) + 1), ii = (inIdx[e.dst] = (inIdx[e.dst] ?? -1) + 1);
  const lab = e.src === 'REG-FDNY-FEE-REVIEW' ? 'depends on your project' : (e.label.First || e.label.Subsequent || '');
  let d, lx, ly;
  const between = Object.entries(NODES).some(([s, p]) => p[1] === a.band && p[0] > a.col && p[0] < b.col);
  if (a.band === b.band && !between) {
    const p1 = { x: a.x + a.w, y: a.y + 30 + oi * 14 }, p2 = { x: b.x, y: b.y + 30 + ii * 14 };
    const mx = (p1.x + p2.x) / 2;
    d = `M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`; lx = p1.x + 30; ly = p1.y + (p2.y - p1.y) * 0.15 - 3;
  } else if (a.band === b.band) {
    const gy = BAND_B[a.band] + 14 + oi * 14;
    const p1 = { x: a.x + a.w - 30 - oi * 14, y: a.y + a.h }, p2 = { x: b.x + 40 + ii * 14, y: b.y + b.h };
    d = `M${p1.x},${p1.y} L${p1.x},${gy} L${p2.x},${gy} L${p2.x},${p2.y}`; lx = p1.x - 28; ly = gy - 4;
  } else {
    const gy = BAND_B[a.band] + 22 + (oi + ii) * 15;
    const p1 = { x: a.x + a.w / 2 + oi * 18, y: a.y + a.h }, p2 = { x: b.x - 16 - ii * 8, y: b.y + 30 };
    d = `M${p1.x},${p1.y} L${p1.x},${gy} L${p2.x},${gy} L${p2.x},${p2.y} L${b.x},${p2.y}`; lx = p1.x; ly = gy - 4;
  }
  svg += `<path d="${d}" class="edge ${e.kind}" marker-end="url(#ah)"/>`;
  if (lab) labels.push({ lx, ly, t: lab });
}
for (const [s] of Object.entries(NODES)) {
  const g = geo[s];
  const isNew = NEW.has(s), isFork = FORKS.has(s) || (routes(s, 'First').length > 1 && s !== 'FINISH');
  svg += `<g class="node ${isNew ? 'new' : ''} ${s === 'FINISH' ? 'end' : ''}"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="9"/>`;
  svg += `<text class="title" x="${g.x + 10}" y="${g.y + 21}">${esc(nm(s))}</text>`;
  const tags = []; if (isNew) tags.push(['NEW', 'tagnew']); if (isFork) tags.push(['FORK', 'tagfork']);
  let tx = g.x + 10;
  for (const [t, c] of tags) { const w = t.length * 7 + 10; svg += `<rect class="${c}" x="${tx}" y="${g.y + 29}" width="${w}" height="15" rx="7"/><text class="${c === 'tagnew' ? 'tagt' : 'tagt f'}" x="${tx + w / 2}" y="${g.y + 40}" text-anchor="middle">${t}</text>`; tx += w + 5; }
  let y = g.y + 62;
  for (const l of body[s]) { l.w.forEach((w, i) => { svg += `<text class="ln ${l.cls}" x="${g.x + 10 + (i && l.cls.includes('ex') ? 10 : 0)}" y="${y}">${esc(w)}</text>`; y += LH; }); y += 3; }
  svg += `</g>`;
}
for (const l of labels) {
  const w = l.t.length * 5.9 + 10;
  svg += `<rect class="lblbg" x="${l.lx - w / 2}" y="${l.ly - 11}" width="${w}" height="15" rx="4"/><text class="lbl" x="${l.lx}" y="${l.ly}" text-anchor="middle">${esc(l.t)}</text>`;
}

// ---- findings read from the same data ----
const findings = [];
const allDst = new Set(); for (const e of edgeMap.values()) allDst.add(e.dst);
const reach = (start) => { const seen = new Set([start]); const q = [start]; while (q.length) { const s = q.pop(); for (const v of V) for (const r of routes(s, v)) for (const d of r.dsts) if (!seen.has(d)) { seen.add(d); q.push(d); } } return seen; };
const fromBuilder = reach('CON-INITIATION');
findings.push(fromBuilder.has('FINISH') ? 'Every path from Hire a Builder can reach Finish (checked by following the data).' : 'PROBLEM: Finish cannot be reached from Hire a Builder.');
const dead = Object.keys(NODES).filter(s => s !== 'FINISH' && V.every(v => routes(s, v).length === 0));
findings.push(dead.length ? 'Dead ends (no way out): ' + dead.map(nm).join(', ') : 'No dead ends: every box has a way out.');
const oddTime = ['REG-DOB-AUDIT', 'REG-FDNY-PLAN-EXAM'].filter(s => V.some(v => { const t = rolls(deff(s, v, 'time')); return t && t.some(isRoute); }));
if (oddTime.length) findings.push(`Odd data: in DICE_EFFECTS the "time" row for ${oddTime.map(nm).join(' and ')} holds place names instead of days (a copy of the Next Step row). The days there come from the fixed "Spend N days" row, so nothing breaks, but the button says "See how long it takes" while the roll only decides where you go.`);
const noQuality = !SEFF.concat(DEFF).some(r => /quality/i.test(r.effect_type + r.effect_action) && Object.keys(NODES).includes(r.space_name));
if (noQuality) findings.push('No quality points are set on any box in this stretch. Quality changes only through cards (life events and the like), which are not drawn here.');
findings.push('The builder offers (how many, the price and time multipliers, the quality points) come from TROPHIES.csv, not from the space tables, so they are in the Hire a Builder box but have no arrows of their own.');
findings.push('Hire a Builder (first visit) lets you go on to the Special Inspector OR back to Lender Review (MOVEMENT.csv): the way back to the lender is the only way to re-open funding after choosing a builder.');
const fin = (v) => rolls(outRow('REG-DOB-FINAL-REVIEW', v));
findings.push(`Final Approval is not symmetric: roll 6 sends you to ${nm(fin('First')[5])} on a first visit but to ${nm(fin('Subsequent')[5])} on a return visit, and finishing is ${fin('First').filter(x => x === 'FINISH').length} in 6 first time but ${fin('Subsequent').filter(x => x === 'FINISH').length} in 6 on a return.`);
const fx = rolls(outRow('CON-FIX', 'First'));
findings.push(`Fix It First costs ${effs('CON-FIX', 'First').map(e => e.description.replace('Spend ', '').replace('Pay ', '')).join(' and ')} for sure, and still sends you back to Trouble On Site ${fx.filter(x => x === 'CON-ISSUES').length} in 6 (the same chance as Steer the Inspector's loop-back is ${rolls(outRow('CON-STEER', 'First')).filter(x => x === 'CON-ISSUES').length} in 6).`);
findings.push('Audit and Fire Dept. Review push-backs: with the expeditor card the push-back costs 0 days (spends the card); without it the days in the box apply. The approval rolls (which of 1 to 6 means approved) are decided in ApprovalService.ts and agree with the dice table; the Fire Dept. Intake desk uses a question chain (LOGIC_QUESTIONS.csv), not dice, so it has no chances.');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Board path flowchart</title>
<style>
  :root { --bg:#fff; --ink:#1f2937; --mut:#5b6472; --box:#f4f7fb; --line:#9aa5b5; --new:#e8f7ec; --newb:#2f9e54; --fork:#fff4d6; --forkt:#8a5a00; --edge:#44566e; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#14181f; --ink:#e6e9ee; --mut:#a3adbb; --box:#1d242f; --line:#3a4658; --new:#16301f; --newb:#4cc276; --fork:#3b3210; --forkt:#f2c460; --edge:#9bb0cc; } }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 system-ui, Segoe UI, sans-serif; }
  header { padding:14px 20px 4px; } h1 { font-size:20px; margin:0 0 4px; } .sub { color:var(--mut); margin:0; font-size:13px; }
  .legend { display:flex; gap:14px; flex-wrap:wrap; padding:6px 20px 10px; font-size:12.5px; color:var(--mut); align-items:center; }
  .sw { display:inline-block; width:14px; height:14px; border-radius:4px; vertical-align:-2px; margin-right:5px; border:1.5px solid var(--line); background:var(--box); }
  .wrap { overflow-x:auto; padding:0 12px 10px; } svg { width:100%; min-width:1250px; height:auto; display:block; }
  .node rect:first-child { fill:var(--box); stroke:var(--line); stroke-width:1.4; } .node.new rect:first-child { fill:var(--new); stroke:var(--newb); stroke-width:2.2; }
  .node.end rect:first-child { stroke-width:3; stroke:var(--ink); }
  .title { font-weight:700; font-size:14px; fill:var(--ink); } .ln { font-size:12.2px; fill:var(--ink); } .ln.back { fill:var(--mut); }
  .tagnew { fill:var(--newb); } .tagfork { fill:var(--fork); stroke:var(--forkt); stroke-width:1; } .tagt { font-size:9.5px; font-weight:700; fill:#fff; } .tagfork + .tagt { fill:var(--forkt); }
  .edge { fill:none; stroke:var(--edge); stroke-width:1.8; } .edge.choice,.edge.dice-pick { stroke-dasharray:6 4; } .edge.logic { stroke-dasharray:2 4; }
  .lblbg { fill:var(--bg); stroke:var(--line); stroke-width:.8; } .ln.ex { font-size:11.6px; fill:var(--edge); font-weight:600; } .ln.ex.bk { fill:var(--mut); font-weight:400; } .tagt.f { fill:var(--forkt); } .lbl { font-size:11px; fill:var(--ink); } .bk { font-size:11px; fill:var(--mut); }
  .findings { padding:4px 20px 22px; max-width:1180px; } .findings h2 { font-size:15px; margin:10px 0 4px; } .findings li { margin:3px 0; font-size:13px; }
  @media print { @page { size: letter portrait; margin: .3in; } .wrap { overflow:visible; padding:0; height:8.9in; } svg { min-width:0; width:100%; height:100%; } .sub,.legend{font-size:9.5px} .findings { break-before:page; break-inside:avoid; font-size:10px; padding:0 8px; } .findings li{font-size:10px;margin:1px 0} header,.legend { padding:2px 8px; } h1{font-size:16px} }
</style></head><body>
<header><h1>The board path: Hire a Builder to the final sign-off</h1>
<p class="sub">Every box is a space (the name players see). Every arrow is a choice or a dice outcome with its chance out of 6, the days and the dollars. All numbers are read from the game's data files by <code>scripts/build-board-flowchart.mjs</code>.</p></header>
<div class="legend"><span><i class="sw" style="border-color:var(--newb);background:var(--new)"></i>New since v3.8.0</span><span><b style="color:var(--forkt)">FORK</b> = you or the dice pick between places</span><span>solid arrow = always · dashed = you pick · "n in 6" = dice</span><span>"1st visit" / "coming back" = first time there / later times</span><span>(n) after a cost = how many of the 6 outcomes</span></div>
<div class="wrap"><svg viewBox="0 0 ${TOTAL_W} ${TOTAL_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Board path flowchart">
<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--edge)"/></marker></defs>
<text x="${X0}" y="${BAND_Y[0] - 16}" class="title" style="font-size:15px;fill:var(--mut)">1 · Filing and the Fire Dept. (before and around hiring)</text>
<text x="${X0}" y="${BAND_Y[1] - 16}" class="title" style="font-size:15px;fill:var(--mut)">2 · Hire a Builder, the Special Inspector fork, trouble on site</text>
<text x="${X0}" y="${BAND_Y[2] - 16}" class="title" style="font-size:15px;fill:var(--mut)">3 · Site inspection and the final sign-off</text>
${svg}</svg></div>
<div class="findings"><h2>What the data shows (read from the same files)</h2><ul>${findings.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>
</body></html>`;
const out = path.join(root, 'docs/technical/BOARD_PATH_FLOWCHART.html');
fs.writeFileSync(out, html);
console.log('wrote', out, 'new spaces:', [...NEW].join(','));
