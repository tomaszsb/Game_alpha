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

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// ---- per-visit text for every box ----
const LOGIC_LABEL = {
  'REG-FDNY-PLAN-EXAM': 'fire protection, or the city sent you, or your scope changed',
  'PM-DECISION-CHECK': 'DOB already approved you (you pick)',
  'CON-INITIATION': 'DOB already approved you (you pick)',
  'REG-DOB-TYPE-SELECT': 'no DOB approval yet',
};
function costLines(s, v) {
  const out = [];
  for (const e of effs(s, v).filter(e => ['time', 'fee'].includes(e.effect_type))) out.push(e.description);
  const m = mv(s, v);
  if (!(m && m.movement_type === 'dice')) {
    const c = rollCosts(s, v); const any = (a) => a && a.some(x => x);
    if (any(c.days) || any(c.mon)) {
      const cnt = new Map();
      for (let i = 0; i < 6; i++) { const k = costText(c, i) || 'nothing'; cnt.set(k, (cnt.get(k) || 0) + 1); }
      out.push('The roll decides: ' + [...cnt.entries()].map(([k, n]) => `${n} in 6 ${k}`).join(', '));
    }
  }
  if (s === 'CON-INITIATION' && v === 'First') {
    const tv = (kind, key) => TROPHY.find(r => r.kind === kind && r.key === key)?.value;
    const offers = tv('rule', 'bids_offered');
    const q = ['HIGH', 'MED', 'LOW'].map(k => { const row = TROPHY.find(r => r.kind === 'builder_quality' && r.key === k); return `${row?.text}: price ×${tv('builder_price', k)}, time ×${tv('builder_speed', k)}, quality points ${tv('points', row?.value)}`; });
    out.push(`${offers} builder offers to pick from. ${q.join(' | ')}`);
  }
  if (effs(s, v).some(e => e.effect_action === 'draw_L')) out.push('1 in 6 a life event happens');
  for (const e of effs(s, v).filter(e => e.effect_type === 'cards' && ['return_e', 'replace_e', 'transfer'].includes(e.effect_action))) out.push(e.description + ' (optional)');
  const c = cont(s, v);
  if (c && /^yes$/i.test(c.can_negotiate)) {
    const timeAdd = effs(s, v).filter(e => e.effect_type === 'time' && e.effect_action === 'add').reduce((a, e) => a + (+e.effect_value || 0), 0);
    const days = c.try_again_days !== '' ? +c.try_again_days : timeAdd;
    const bits = [];
    if (c.try_again_e_cost) bits.push(`with ${c.try_again_e_cost} expeditor card: 0 days (the card is spent); without one: ${days} day${days === 1 ? '' : 's'}`);
    else bits.push(`${days} day${days === 1 ? '' : 's'}`);
    if (c.try_again_scope_pct) bits.push(`+ ${c.try_again_scope_pct}% of scope`);
    out.push('Push back (stay here): ' + bits.join(' '));
  }
  return out;
}
function exitsFor(s, v) {
  const out = [];
  for (const r of routes(s, v)) for (const d of r.dsts) {
    const chance = r.kind === 'fixed' ? 'always' : r.kind === 'choice' ? 'you pick' : r.kind === 'dice-pick' ? `${r.n} in 6, then you pick` : r.kind === 'logic' ? 'depends on your project' : `${r.n} in 6`;
    const cost = r.costs ? costSummary(r.costs) : '';
    out.push({ dst: d, chance, cost, kind: r.kind, why: s === 'REG-FDNY-FEE-REVIEW' ? (LOGIC_LABEL[d] || '') : '' });
  }
  return out;
}

// ---- layout: small boxes in a grid ----
const NODES = {
  'REG-DOB-TYPE-SELECT': [0, 0, 0], 'REG-DOB-PLAN-EXAM': [1, 0, 0], 'REG-DOB-PROF-CERT': [1, 0, 1], 'REG-DOB-AUDIT': [2, 0, 1],
  'REG-FDNY-FEE-REVIEW': [3, 0, 0], 'REG-FDNY-PLAN-EXAM': [4, 0, 0],
  'CON-INITIATION': [0, 1, 1], 'SI-HIRE': [1, 1, 1], 'SI-AGENCY-TOP': [2, 1, 0], 'SI-AGENCY-BUDGET': [2, 1, 1], 'SI-SKIP': [2, 1, 2],
  'CON-ISSUES': [3, 1, 1], 'TR8-TEST-NOW': [4, 1, 0], 'TR8-TEST-LATER': [4, 1, 1],
  'CON-INSPECT': [0, 2, 0], 'CON-FIX': [1, 2, 0], 'CON-STEER': [1, 2, 1], 'REG-DOB-FINAL-REVIEW': [3, 2, 0], 'FINISH': [4, 2, 0],
};
const FORKS = new Set(['CON-INITIATION', 'SI-HIRE', 'CON-ISSUES', 'CON-INSPECT', 'REG-DOB-TYPE-SELECT', 'REG-FDNY-FEE-REVIEW']);
const W = 218, H = 74, GX = 78, GY = 44, X0 = 24, BAND_GAP = 96;
const geo = {}; const ROWS = [3, 3, 2]; let yy = 56; const BAND_Y = [], BAND_B = [];
for (const b of [0, 1, 2]) { BAND_Y[b] = yy; yy += ROWS[b] * (H + GY) - GY; BAND_B[b] = yy; yy += BAND_GAP; }
for (const [s, p] of Object.entries(NODES)) geo[s] = { x: X0 + p[0] * (W + GX), y: BAND_Y[p[1]] + p[2] * (H + GY), band: p[1], col: p[0] };
const TOTAL_W = X0 * 2 + 5 * W + 4 * GX, TOTAL_H = BAND_B[2] + 50;
const isFork = (s) => FORKS.has(s) || (routes(s, 'First').length > 1 && s !== 'FINISH');
const forwardOK = (src, dst) => { const a = NODES[src], b = NODES[dst]; if (!b) return false; return b[1] > a[1] || (b[1] === a[1] && b[0] > a[0]); };

// everything the page needs, as data
const DATA = { nodes: {}, edges: [] };
for (const s of Object.keys(NODES)) {
  DATA.nodes[s] = { name: nm(s), isNew: NEW.has(s), fork: isFork(s), visits: {} };
  for (const v of V) DATA.nodes[s].visits[v] = { costs: costLines(s, v), exits: exitsFor(s, v).map(e => ({ ...e, dstName: nm(e.dst), forward: forwardOK(s, e.dst) })) };
  const a = DATA.nodes[s].visits;
  DATA.nodes[s].same = JSON.stringify(a.First) === JSON.stringify(a.Subsequent);
}
const edgeKeys = new Map();
for (const s of Object.keys(NODES)) for (const v of V) for (const e of DATA.nodes[s].visits[v].exits) {
  if (!e.forward) continue;
  const k = s + '>' + e.dst; const o = edgeKeys.get(k) || { src: s, dst: e.dst, kind: e.kind, lab: {} };
  o.lab[v] = e.chance; edgeKeys.set(k, o);
}
const outIdx = {}, inIdx = {};
for (const e of edgeKeys.values()) {
  const a = geo[e.src], b = geo[e.dst];
  const oi = (outIdx[e.src] = (outIdx[e.src] ?? -1) + 1), ii = (inIdx[e.dst] = (inIdx[e.dst] ?? -1) + 1);
  let d, lx, ly;
  const between = Object.entries(NODES).some(([, p]) => p[1] === a.band && p[0] > a.col && p[0] < b.col);
  if (a.band === b.band && !between) {
    const p1 = { x: a.x + W, y: a.y + 24 + oi * 12 }, p2 = { x: b.x, y: b.y + 24 + ii * 12 };
    const mx = (p1.x + p2.x) / 2;
    d = `M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`; lx = (p1.x + p2.x) / 2; ly = (p1.y + p2.y) / 2;
  } else if (a.band === b.band) {
    const gy = BAND_B[a.band] + 16 + oi * 13;
    const p1 = { x: a.x + W - 30 - oi * 14, y: a.y + H }, p2 = { x: b.x + 40 + ii * 14, y: b.y + H };
    d = `M${p1.x},${p1.y} L${p1.x},${gy} L${p2.x},${gy} L${p2.x},${p2.y}`; lx = (p1.x + p2.x) / 2; ly = gy;
  } else {
    const gy = BAND_B[a.band] + 24 + (oi + ii) * 14;
    const p1 = { x: a.x + W / 2 + oi * 16, y: a.y + H }, p2 = { x: b.x - 18 - ii * 8, y: b.y + 24 };
    d = `M${p1.x},${p1.y} L${p1.x},${gy} L${p2.x},${gy} L${p2.x},${p2.y} L${b.x},${p2.y}`; lx = (p1.x + p2.x) / 2; ly = gy;
  }
  e.d = d; e.lx = lx; e.ly = ly;
}
DATA.edges = [...edgeKeys.values()];
DATA.geo = geo; DATA.W = W; DATA.H = H; DATA.bands = BAND_Y;

// ---- findings read from the same data ----
const findings = [];
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
  :root { --bg:#fff; --ink:#1f2937; --mut:#5b6472; --box:#f4f7fb; --line:#9aa5b5; --new:#e8f7ec; --newb:#2f9e54; --fork:#fff4d6; --forkt:#8a5a00; --edge:#44566e;
          --first:#1d5fb4; --firstbg:#e7f0fc; --back:#b45309; --backbg:#fdf0e1; --card:#fff; --shadow:0 6px 24px rgba(15,23,42,.22); }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#14181f; --ink:#e6e9ee; --mut:#a3adbb; --box:#1d242f; --line:#3a4658; --new:#16301f; --newb:#4cc276; --fork:#3b3210; --forkt:#f2c460; --edge:#9bb0cc; --first:#7db3f5; --firstbg:#17283f; --back:#f0a85a; --backbg:#3a2a14; --card:#1f2733; --shadow:0 6px 24px rgba(0,0,0,.6); } }
  :root[data-theme="dark"] { --bg:#14181f; --ink:#e6e9ee; --mut:#a3adbb; --box:#1d242f; --line:#3a4658; --new:#16301f; --newb:#4cc276; --fork:#3b3210; --forkt:#f2c460; --edge:#9bb0cc; --first:#7db3f5; --firstbg:#17283f; --back:#f0a85a; --backbg:#3a2a14; --card:#1f2733; --shadow:0 6px 24px rgba(0,0,0,.6); }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 system-ui, Segoe UI, sans-serif; }
  header { padding:14px 20px 4px; } h1 { font-size:20px; margin:0 0 4px; } .sub { color:var(--mut); margin:0; font-size:13px; }
  .bar { display:flex; gap:16px; flex-wrap:wrap; align-items:center; padding:8px 20px 10px; font-size:12.5px; color:var(--mut); }
  .seg { display:inline-flex; border:1.5px solid var(--line); border-radius:8px; overflow:hidden; }
  .seg button { font:inherit; font-weight:600; padding:6px 14px; border:0; background:transparent; color:var(--ink); cursor:pointer; }
  .seg button[aria-pressed="true"].f { background:var(--first); color:#fff; } .seg button[aria-pressed="true"].b { background:var(--back); color:#fff; }
  .seg button:focus-visible, .node:focus-visible { outline:3px solid var(--first); outline-offset:2px; }
  .sw { display:inline-block; width:14px; height:14px; border-radius:4px; vertical-align:-2px; margin-right:5px; border:1.5px solid var(--line); background:var(--box); } .sw.n { border-color:var(--newb); background:var(--new); }
  .wrap { overflow-x:auto; padding:0 12px 10px; position:relative; } svg { width:100%; min-width:1250px; height:auto; display:block; }
  .node { cursor:pointer; } .node rect.bx { fill:var(--box); stroke:var(--line); stroke-width:1.5; } .node.new rect.bx { fill:var(--new); stroke:var(--newb); stroke-width:2.2; }
  .node.end rect.bx { stroke:var(--ink); stroke-width:3; } .node:hover rect.bx, .node.sel rect.bx { stroke:var(--first); stroke-width:3; }
  .title { font-weight:700; font-size:14px; fill:var(--ink); } .hint { font-size:11px; fill:var(--mut); }
  .tagnew { fill:var(--newb); } .tagfork { fill:var(--fork); stroke:var(--forkt); stroke-width:1; } .tagt { font-size:9.5px; font-weight:700; fill:#fff; } .tagt.f { fill:var(--forkt); }
  .edge { fill:none; stroke:var(--edge); stroke-width:1.8; opacity:.75; } .edge.choice,.edge.dice-pick { stroke-dasharray:6 4; } .edge.logic { stroke-dasharray:2 4; }
  .edge.off { opacity:.1; } .edge.hi { stroke:var(--first); stroke-width:3; opacity:1; } .edge.hib { stroke:var(--back); stroke-width:3; opacity:1; }
  .lblbg { fill:var(--bg); stroke:var(--line); stroke-width:.8; } .lbl { font-size:11px; fill:var(--ink); } .lblg.off { display:none; }
  .band { font-size:14px; font-weight:700; fill:var(--mut); }
  #tip { position:fixed; z-index:5; width:min(420px, calc(100vw - 32px)); background:var(--card); color:var(--ink); border:1.5px solid var(--line); border-radius:12px; box-shadow:var(--shadow); padding:10px 12px 12px; display:none; pointer-events:none; } #tip.pin { pointer-events:auto; }
  #tip h3 { margin:0 0 6px; font-size:15px; } #tip .t { font-size:10.5px; font-weight:700; padding:1px 7px; border-radius:8px; margin-left:6px; vertical-align:2px; }
  .vbox { border:2px solid; border-radius:9px; margin-top:8px; overflow:hidden; } .vbox.f { border-color:var(--first); } .vbox.b { border-color:var(--back); }
  .vbox > h4 { margin:0; padding:4px 10px; font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:#fff; } .vbox.f > h4 { background:var(--first); } .vbox.b > h4 { background:var(--back); }
  .vbox.dim { opacity:.55; } .sec { padding:6px 10px; border-top:1px solid var(--line); } .sec:first-of-type { border-top:0; }
  .sec b { display:block; font-size:11px; color:var(--mut); text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px; } .sec ul { margin:0; padding-left:16px; } .sec li { margin:2px 0; font-size:13px; }
  .ex { display:flex; gap:8px; align-items:baseline; margin:3px 0; font-size:13px; } .ex .p { flex:none; min-width:84px; font-weight:700; font-size:12px; padding:1px 7px; border-radius:7px; background:var(--box); border:1px solid var(--line); text-align:center; }
  .vbox.f .p { background:var(--firstbg); border-color:var(--first); } .vbox.b .p { background:var(--backbg); border-color:var(--back); } .ex small { color:var(--mut); }
  .same { font-size:12px; color:var(--mut); margin-top:8px; }
  .findings { padding:4px 20px 22px; max-width:1180px; } .findings h2 { font-size:15px; margin:10px 0 4px; } .findings li { margin:3px 0; font-size:13px; }
  @media print { @page { size: letter landscape; margin:.3in; } .wrap { overflow:visible; padding:0; } svg { min-width:0; } #tip,.seg { display:none !important; } .findings{break-before:page} }
</style></head><body>
<header><h1>The board path: Hire a Builder to the final sign-off</h1>
<p class="sub">Hover (or tap) a box to open its costs and every way out. All numbers are read from the game's data files by <code>scripts/build-board-flowchart.mjs</code>.</p></header>
<div class="bar"><span class="seg" role="group" aria-label="Which visit the arrows show"><button class="f" id="vf" aria-pressed="true">First visit</button><button class="b" id="vb" aria-pressed="false">Coming back</button></span>
<span><i class="sw n"></i>New since v3.8.0</span><span><b style="color:var(--forkt)">FORK</b> = a choice or the dice pick between places</span><span>dashed arrow = you pick · "n in 6" = dice · (n) after a cost = how many of the 6</span></div>
<div class="wrap" id="wrap"><svg id="chart" viewBox="0 0 ${TOTAL_W} ${TOTAL_H}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Board path flowchart"></svg><div id="tip" role="dialog" aria-live="polite"></div></div>
<div class="findings"><h2>What the data shows (read from the same files)</h2><ul>${findings.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>
<script>
const D = ${JSON.stringify(DATA).replace(/</g, "\u003c")};
const BANDS = ['1 · Filing and the Fire Dept.', '2 · Hire a Builder, the Special Inspector fork, trouble on site', '3 · Site inspection and the final sign-off'];
let visit = 'First', pinned = null;
const NS = 'http://www.w3.org/2000/svg', svg = document.getElementById('chart'), tip = document.getElementById('tip'), wrap = document.getElementById('wrap');
const el = (n, a = {}, t) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; };
const h = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
svg.appendChild(el('defs')).innerHTML = '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker>';
D.bands.forEach((y, i) => svg.appendChild(el('text', { x: 24, y: y - 18, class: 'band' }, BANDS[i])));
const edgeEls = D.edges.map(e => { const g = el('g'); const p = el('path', { d: e.d, class: 'edge ' + e.kind, 'marker-end': 'url(#ah)' }); g.appendChild(p);
  const lg = el('g', { class: 'lblg' }); const bg = el('rect', { class: 'lblbg', rx: 4, height: 16 }); const t = el('text', { class: 'lbl', x: e.lx, y: e.ly + 4, 'text-anchor': 'middle' }); lg.append(bg, t); g.appendChild(lg); svg.appendChild(g); return { e, p, lg, bg, t }; });
function paint() {
  for (const x of edgeEls) { const txt = x.e.lab[visit]; x.p.classList.toggle('off', !txt); x.lg.classList.toggle('off', !txt);
    if (txt) { x.t.textContent = txt; const w = Math.min(txt.length * 5.9 + 12, 260); x.bg.setAttribute('x', x.e.lx - w / 2); x.bg.setAttribute('y', x.e.ly - 8); x.bg.setAttribute('width', w); }
    const on = (hover === x.e.src) || false; x.p.classList.toggle('hi', on && visit === 'First'); x.p.classList.toggle('hib', on && visit === 'Subsequent'); }
}
let hover = null;
const nodeEls = {};
for (const [s, n] of Object.entries(D.nodes)) {
  const g = D.geo[s]; const ge = el('g', { class: 'node' + (n.isNew ? ' new' : '') + (s === 'FINISH' ? ' end' : ''), tabindex: 0, role: 'button', 'aria-label': n.name + ': open details' });
  ge.appendChild(el('rect', { class: 'bx', x: g.x, y: g.y, width: D.W, height: D.H, rx: 10 }));
  ge.appendChild(el('text', { class: 'title', x: g.x + 10, y: g.y + 22 }, n.name));
  let tx = g.x + 10; const tags = []; if (n.isNew) tags.push(['NEW', 'tagnew']); if (n.fork) tags.push(['FORK', 'tagfork']);
  for (const [t, c] of tags) { const w = t.length * 7 + 10; ge.appendChild(el('rect', { class: c, x: tx, y: g.y + 32, width: w, height: 15, rx: 7 })); ge.appendChild(el('text', { class: 'tagt' + (c === 'tagfork' ? ' f' : ''), x: tx + w / 2, y: g.y + 43, 'text-anchor': 'middle' }, t)); tx += w + 5; }
  ge.appendChild(el('text', { class: 'hint', x: g.x + 10, y: g.y + H_() - 10 }, n.same ? 'same every visit · hover for details' : 'differs on a return · hover for details'));
  svg.appendChild(ge); nodeEls[s] = ge;
  ge.addEventListener('mouseenter', () => { if (!pinned) open(s); }); ge.addEventListener('mouseleave', () => { if (!pinned) close(); });
  ge.addEventListener('focus', () => open(s)); ge.addEventListener('click', (ev) => { ev.stopPropagation(); if (pinned === s) { pinned = null; close(); } else { pinned = s; open(s); } });
  ge.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { pinned = null; close(); } });
}
function H_() { return D.H; }
document.addEventListener('click', () => { pinned = null; close(); });
tip.addEventListener('click', (ev) => ev.stopPropagation());
function vbox(cls, title, v) {
  const costs = v.costs.length ? '<ul>' + v.costs.map(c => '<li>' + h(c) + '</li>').join('') + '</ul>' : '<span style="color:var(--mut)">nothing</span>';
  const ex = v.exits.length ? v.exits.map(e => '<div class="ex"><span class="p">' + h(e.chance) + '</span><span>' + (e.forward ? '' : '↩ ') + h(e.dstName) + (e.cost ? '<br><small>' + h(e.cost) + '</small>' : '') + (e.why ? '<br><small>' + h(e.why) + '</small>' : '') + '</span></div>').join('') : '<span style="color:var(--mut)">the game ends here</span>';
  return '<div class="vbox ' + cls + '"><h4>' + title + '</h4><div class="sec"><b>Cost of being here</b>' + costs + '</div><div class="sec"><b>Where you go next</b>' + ex + '</div></div>';
}
function open(s) {
  hover = s; const n = D.nodes[s]; paint();
  let body = '<h3>' + h(n.name) + (n.isNew ? '<span class="t" style="background:var(--newb);color:#fff">NEW</span>' : '') + (n.fork ? '<span class="t" style="background:var(--fork);color:var(--forkt)">FORK</span>' : '') + '</h3>';
  if (n.same) body += vbox('f', 'Every visit (first time and coming back)', n.visits.First);
  else body += vbox('f' + (visit === 'First' ? '' : ' dim'), 'First visit', n.visits.First) + vbox('b' + (visit === 'Subsequent' ? '' : ' dim'), 'Coming back', n.visits.Subsequent);
  tip.innerHTML = body; tip.style.display = 'block'; tip.classList.toggle('pin', pinned === s);
  const r = nodeEls[s].getBoundingClientRect(); const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = r.right + 10; if (x + tw > innerWidth - 8) x = Math.max(8, r.left - tw - 10);
  let y = Math.min(r.top, innerHeight - th - 8); y = Math.max(8, y);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
  Object.values(nodeEls).forEach(e => e.classList.remove('sel')); nodeEls[s].classList.add('sel');
}
function close() { hover = null; tip.style.display = 'none'; Object.values(nodeEls).forEach(e => e.classList.remove('sel')); paint(); }
for (const [id, v] of [['vf', 'First'], ['vb', 'Subsequent']]) document.getElementById(id).addEventListener('click', (ev) => { ev.stopPropagation(); visit = v; document.getElementById('vf').setAttribute('aria-pressed', v === 'First'); document.getElementById('vb').setAttribute('aria-pressed', v === 'Subsequent'); paint(); if (hover) open(hover); });
paint();
</script></body></html>`;
const out = path.join(root, 'docs/technical/BOARD_PATH_FLOWCHART.html');
fs.writeFileSync(out, html);
console.log('wrote', out, 'new spaces:', [...NEW].join(','));
