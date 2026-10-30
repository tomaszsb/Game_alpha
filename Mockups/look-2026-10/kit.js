// kit.js - shared data + drawing helpers for the round-2 style mock-ups (A/B/C). Mock-ups only.
// Scope lines and NPC words come from the game's data (CARDS_EXPANDED + SCOPE_WORDING, SPACE_CONTENT).
const K = {};
K.q = new URLSearchParams(window.__Q || location.search);
K.view = K.q.get('view') || 'tv';
K.players = [
  { id: 'maya', name: 'Maya', c: '#2f7fe0', day: 27, where: 'at her site' },
  { id: 'dev',  name: 'Dev',  c: '#2e9e57', day: 24, where: 'Buildings Department' },
  { id: 'rosa', name: 'Rosa', c: '#e0464f', day: 30, where: 'Bank' },
  { id: 'theo', name: 'Theo', c: '#f08a24', day: 21, where: "Architect's studio" },
];
// status: built = done, now = being built (floors 1-3 done), paper = still only on the drawings
K.scope = [
  { id: 'shed',  code: 'W078', trade: 'Sidewalk Shed',        icon: '🚧', c: '#1f8a4c', cost: 95000,   status: 'built', text: 'Custom-designed sidewalk shed that keeps the apartment building visible during construction' },
  { id: 'struct',code: 'W167', trade: 'Structural',           icon: '🔩', c: '#9a4f1e', cost: 750000,  status: 'built', text: 'Structural modifications to support a green roof on the apartment building' },
  { id: 'plumb', code: 'W029', trade: 'Plumbing',             icon: '🚿', c: '#2563eb', cost: 200000,  status: 'now',   text: 'Replacement of the corroded plumbing stack in the apartment building' },
  { id: 'spk',   code: 'W053', trade: 'Sprinklers',           icon: '🧯', c: '#e11d48', cost: 1200000, status: 'now',   text: 'Retrofit of the apartment building with a new NFPA 13R sprinkler system' },
  { id: 'mech',  code: 'W042', trade: 'Mechanical Systems',   icon: '🌬️', c: '#0d9488', cost: 75000,   status: 'paper', text: 'Installation of a heat recovery ventilation system in the apartment building' },
  { id: 'elev',  code: 'W124', trade: 'Elevator',             icon: '🛗', c: '#7c3aed', cost: 1200000, status: 'paper', text: 'Installation of a destination dispatch elevator system in the apartment building' },
  { id: 'roof',  code: 'W011', trade: 'General Construction', icon: '🪴', c: '#d97706', cost: 600000,  status: 'paper', text: 'Construction of a rooftop amenity space for the apartment building' },
];
K.statusWord = { built: 'Built', now: 'Building now', paper: 'On the drawings' };
K.statusMore = { built: 'Done and signed off', now: 'Floors 1 to 3 done, 4 to 6 to go', paper: 'Not started yet' };
K.total = K.scope.reduce((a, s) => a + s.cost, 0);
K.money = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : '$' + Math.round(n / 1000) + 'K';
// NPC talk: SPACE_CONTENT.csv, CON-INSPECT (first visit), spoken by the Contractor
K.npc = {
  who: 'Frank', role: 'Your contractor', title: 'Inspector just walked in',
  say: 'Boss — inspector just walked onto the site. There’s a safety violation by the southwest corner. We fix it before they see it, or I steer them somewhere else. Your call.',
  story: 'Fix the violation first, or let me steer the inspector away.',
  a: 'Fix the violation first', b: 'Steer the inspector away',
};
// Growth stages, boiled down from the flipbook's 21 (The Lot ... Handover)
K.stagesNew = ['The lot', 'Digging + foundations', 'Frame goes up', 'Walls + windows', 'Pipes, wires + air', 'Ready to open'];
K.stagesReno = ['Fence + shed up', 'Opening up', 'Structure fixed', 'Pipes, wires + air', 'Finishes', 'Ready to open'];
K.sites = { maya: { kind: 'reno', stage: 4 }, dev: { kind: 'new', stage: 3 }, rosa: { kind: 'new', stage: 2 }, theo: { kind: 'reno', stage: 1 } };

// ---------- round town layout (shared by A, B, C) ----------
// 7 shared buildings in a ring in the middle (Ribbon cutting nearest the viewer), each player owns a quarter
// of the outer ring with 4 lots: renovation site, Owner's house, Your office, new building site.
K.shared = [
  ['finish', 'Ribbon cutting'], ['eng', "Engineer's office"], ['arch', "Architect's studio"], ['dob', 'Buildings Department'],
  ['fire', 'Firehouse'], ['inv', 'Investor'], ['bank', 'Bank'],
];
K.quarters = { maya: 90, theo: 0, rosa: -90, dev: 180 };
K.layout = function ({ cx, cy, R, sq, inner = 0.36, outer = 0.8, spread = [-38, -13, 13, 38] }) {
  const pt = (a, r) => ({ x: cx + r * R * Math.cos(a * Math.PI / 180), y: cy + r * R * Math.sin(a * Math.PI / 180) * sq, a });
  const shared = K.shared.map(([id, name], i) => ({ id, name, ...pt(90 + i * 360 / 7, inner) }));
  const lots = [];
  K.players.forEach(p => {
    const f = K.quarters[p.id];
    ['site', 'owner', 'office', 'site_new'].forEach((kind, i) => lots.push({ kind, p, ...pt(f + spread[i], outer) }));
  });
  return { shared, lots, pt };
};

// ---------- cutaway of Maya's building (section through a 6-storey walk-up + cellar) ----------
// model units: x = depth from the street facade (0) to the rear wall (14); z = height (floor f sits on z = 3(f-1)).
K.cutaway = function (T) {
  const s = T.s, X = x => +(T.ox + x * s).toFixed(1), Y = z => +(T.oy - z * s).toFixed(1);
  const R = (x0, z0, x1, z1, a = '') => `<rect x="${X(x0)}" y="${Y(z1)}" width="${+((x1 - x0) * s).toFixed(1)}" height="${+((z1 - z0) * s).toFixed(1)}" ${a}/>`;
  const L = (p, a = '') => `<polyline points="${p.map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}" fill="none" ${a}/>`;
  const C = (x, z, r, a = '') => `<circle cx="${X(x)}" cy="${Y(z)}" r="${r}" ${a}/>`;
  const P = (p, a = '') => `<path d="M${p.map(q => X(q[0]) + ' ' + Y(q[1])).join('L')}Z" ${a}/>`;
  const ink = T.ink, lw = T.lw;
  const sys = Object.fromEntries(K.scope.map(x => [x.id, x]));
  const solid = (id, f) => sys[id].status === 'built' || (sys[id].status === 'now' && f <= 3);
  const G = (id, f, inner) => `<g class="sys" data-sys="${id}"${solid(id, f) ? '' : ` stroke-dasharray="${T.dash || '7 6'}" fill-opacity="${T.paperFill ?? .18}" opacity="${T.paperOp ?? .85}"`}>${inner}</g>`;
  const sk = (id, w) => `stroke="${sys[id].c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  let base = '', o = '';
  // ground, street, cellar
  base += R(-6.5, -4.6, 17.2, 0, `fill="${T.earth}"`) + R(0, -3, 14, 0, `fill="${T.cellar}"`);
  base += R(-6.5, -0.25, -4.1, 0, `fill="${T.road}"`) + R(-4.1, -0.25, 0, 0.12, `fill="${T.walk}" stroke="${ink}" stroke-width="${lw * .6}"`);
  base += R(14, -0.2, 17.2, 0.1, `fill="${T.yard}"`);
  base += `<path d="M${X(-6.5)} ${Y(0)}H${X(17.2)}" stroke="${ink}" stroke-width="${lw}"/>`;
  base += R(-5.2, -2.95, -4.2, -2.2, `fill="${T.cellar}" stroke="${ink}" stroke-width="${lw * .6}"`); // sewer
  // rooms
  for (let f = 1; f <= 6; f++) {
    const b = 3 * (f - 1);
    base += R(0.45, b, 13.55, b + 2.65, `fill="${T.rooms[f % T.rooms.length]}"`);
    if (T.persp) base += T.persp(X, Y, s, b);
    // partitions with door gaps
    [5.2, 8.0, 10.7].forEach(px => base += R(px - .08, b + 2.1, px + .08, b + 2.65, `fill="${T.part}"`));
    [5.2, 10.7].forEach(px => base += R(px - .08, b, px + .08, b + .25, `fill="${T.part}"`));
    // windows in the cut walls
    [0, 13.55].forEach(wx => base += R(wx, b + .9, wx + .45, b + 2.3, `fill="${T.glass}" stroke="${ink}" stroke-width="${lw * .5}"`));
    if (T.furn) base += T.furn(X, Y, s, b, f);
    // bath fixtures (base, not part of the scope)
    base += R(8.35, b + .55, 9.0, b + .75, `fill="${T.fixture}" stroke="${ink}" stroke-width="${lw * .5}"`) + R(8.6, b, 8.75, b + .55, `fill="${T.fixture}"`);
    base += P([[9.3, b], [9.9, b], [9.95, b + .5], [9.25, b + .5]], `fill="${T.fixture}" stroke="${ink}" stroke-width="${lw * .5}"`) + R(9.75, b + .5, 10.0, b + 1.15, `fill="${T.fixture}" stroke="${ink}" stroke-width="${lw * .5}"`);
  }
  // slabs + walls (cut, drawn solid)
  for (let k = 0; k <= 6; k++) base += R(0, 3 * k - .35, 14, 3 * k, `fill="${T.cut}" stroke="${ink}" stroke-width="${lw * .5}"`);
  base += R(0, -3.35, 14, -3, `fill="${T.cut}"`);
  base += R(0, -3, .45, 19.2, `fill="${T.cut}" stroke="${ink}" stroke-width="${lw * .6}"`) + R(13.55, -3, 14, 19.2, `fill="${T.cut}" stroke="${ink}" stroke-width="${lw * .6}"`);
  base += R(-.15, 19.2, .6, 19.45, `fill="${T.cut}"`) + R(13.4, 19.2, 14.15, 19.45, `fill="${T.cut}"`);
  for (let f = 1; f <= 6; f++) { const b = 3 * (f - 1); [0, 13.55].forEach(wx => base += R(wx, b + .9, wx + .45, b + 2.3, `fill="${T.glass}" stroke="${ink}" stroke-width="${lw * .5}"`)); }
  base += R(-.05, 0, .5, 2.2, `fill="${T.door}" stroke="${ink}" stroke-width="${lw * .6}"`); // front door
  if (T.levels) base += T.levels(X, Y, s);
  o += `<g class="base">${base}</g>`;

  // 1 sidewalk shed (outside, on the sidewalk)
  o += G('shed', 1, L([[-3.7, 0], [-3.7, 3.2]], sk('shed', lw * 1.6)) + L([[-0.45, 0], [-0.45, 3.2]], sk('shed', lw * 1.6)) + R(-4.15, 3.2, 0, 3.7, `fill="${sys.shed.c}" stroke="${ink}" stroke-width="${lw * .6}"`) + R(-4.15, 3.7, -3.95, 4.7, `fill="${sys.shed.c}"`) + C(-2.9, 3.05, 3.5, `fill="#ffe58a"`) + C(-1.3, 3.05, 3.5, `fill="#ffe58a"`));
  // 2 structural: new roof beam + posts on the top floor
  o += G('struct', 6, R(.45, 17.1, 13.55, 17.65, `fill="${sys.struct.c}" stroke="${ink}" stroke-width="${lw * .5}"`) + [4.7, 10.95].map(px => R(px - .14, 15, px + .14, 17.1, `fill="${sys.struct.c}"`) + R(px - .35, 15, px + .35, 15.12, `fill="${sys.struct.c}"`)).join(''));
  // 3 plumbing stack, branches and the house drain
  for (let f = 0; f <= 6; f++) {
    const b = 3 * (f - 1), z0 = f === 0 ? -2.45 : b, z1 = f === 6 ? 19.9 : 3 * f;
    let g = L([[10.35, z0], [10.35, z1]], sk('plumb', lw * 1.7));
    if (f === 0) g += L([[10.35, -2.45], [-4.7, -2.75]], sk('plumb', lw * 1.7));
    else g += L([[8.7, b + .5], [8.7, b + .3], [10.35, b + .18]], sk('plumb', lw)) + L([[9.95, b + .3], [10.35, b + .3]], sk('plumb', lw));
    if (f === 6) g += R(10.15, 19.9, 10.55, 20.15, `fill="${sys.plumb.c}"`);
    o += G('plumb', Math.max(f, 1), g);
  }
  // 4 sprinklers: riser by the front wall, fire department connection, a branch line with heads on every ceiling
  for (let f = 0; f <= 6; f++) {
    const top = f === 0 ? -.4 : 3 * f - .7, b = f === 0 ? -2.6 : 3 * (f - 1);
    let g = L([[.95, b], [.95, Math.min(top, 17.3)]], sk('spk', lw * 1.5));
    if (f === 0) g += C(.95, -1.6, s * .18, `fill="${sys.spk.c}"`);
    if (f === 1) g += L([[.95, .9], [-.55, .9]], sk('spk', lw * 1.3)) + C(-.75, 1.05, s * .14, `fill="${sys.spk.c}"`) + C(-.75, .75, s * .14, `fill="${sys.spk.c}"`);
    if (f >= 1) {
      g += L([[.95, top], [5.05, top]], sk('spk', lw)) + L([[8.15, top], [13.3, top]], sk('spk', lw));
      [2.5, 4.3, 9.4, 11.4, 13.0].forEach(hx => g += L([[hx, top], [hx, top - .3]], sk('spk', lw * .8)) + P([[hx - .2, top - .38], [hx + .2, top - .38], [hx, top - .25]], `fill="${sys.spk.c}"`));
    }
    o += G('spk', Math.max(f, 1), g);
  }
  // 5 mechanical: heat recovery unit on the roof, riser duct at the back, ceiling ducts to bath + bedroom
  for (let f = 1; f <= 6; f++) {
    const c = 3 * f - .35;
    let g = R(12.8, 3 * (f - 1) + .6, 13.35, 3 * f, `fill="${sys.mech.c}" stroke="${sys.mech.c}" stroke-width="${lw * .5}"`);
    g += R(8.15, c - .75, 12.8, c - .4, `fill="${sys.mech.c}" stroke="${sys.mech.c}" stroke-width="${lw * .5}"`);
    [9.1, 11.9].forEach(dx => g += P([[dx - .3, c - .75], [dx + .3, c - .75], [dx + .45, c - .95], [dx - .45, c - .95]], `fill="${sys.mech.c}"`));
    if (f === 6) g += R(10.7, 18.05, 13.4, 19.7, `fill="${sys.mech.c}" stroke="${ink}" stroke-width="${lw * .6}"`) + C(11.6, 18.88, s * .45, `fill="none" stroke="#fff" stroke-width="${lw * .8}"`) + [12.3, 12.6, 12.9].map(lx => L([[lx, 18.4], [lx, 19.4]], `stroke="#fff" stroke-width="${lw * .6}"`)).join('');
    o += G('mech', f, g);
  }
  // 6 elevator: shaft, machine bulkhead on the roof, cab waiting on floor 3
  for (let f = 0; f <= 6; f++) {
    const z0 = f === 0 ? -3 : 3 * (f - 1), z1 = f === 6 ? 18 : 3 * f;
    let g = R(5.4, z0, 7.9, z1, `fill="${sys.elev.c}" fill-opacity=".12"`) + L([[5.45, z0], [5.45, z1]], sk('elev', lw * 1.2)) + L([[7.85, z0], [7.85, z1]], sk('elev', lw * 1.2));
    if (f === 3) g += R(5.75, 6.1, 7.55, 8.45, `fill="${sys.elev.c}" stroke="${ink}" stroke-width="${lw * .6}"`) + L([[6.65, 6.1], [6.65, 8.45]], `stroke="#fff" stroke-width="${lw * .6}"`) + L([[6.4, 8.45], [6.4, 20.2]], sk('elev', lw * .5)) + L([[6.9, 8.45], [6.9, 20.2]], sk('elev', lw * .5));
    if (f === 6) g += R(5.3, 18, 8.0, 20.6, `fill="${sys.elev.c}" fill-opacity=".35" stroke="${sys.elev.c}" stroke-width="${lw * 1.2}"`);
    o += G('elev', Math.max(f, 1), g);
  }
  // 7 general construction: roof deck, rail, pergola, planters for the green roof
  {
    const c = sys.roof.c;
    let g = R(.6, 18, 5.25, 18.28, `fill="${c}"`) + R(8.1, 18, 10.6, 18.28, `fill="${c}"`);
    g += L([[.75, 18.28], [.75, 19.5], [5.1, 19.5]], sk('roof', lw)) + [1.4, 4.6].map(px => L([[px, 18.28], [px, 20.8]], sk('roof', lw * 1.2))).join('') + L([[1.0, 20.8], [5.1, 20.8]], sk('roof', lw * 1.4));
    [1.6, 2.2, 2.8, 3.4, 4.0].forEach(px => g += L([[px, 20.65], [px, 20.95]], sk('roof', lw * .9)));
    g += R(2.2, 18.28, 3.6, 18.7, `fill="${c}" fill-opacity=".6"`) + R(8.3, 18.28, 10.4, 18.85, `fill="${c}" stroke="${ink}" stroke-width="${lw * .5}"`);
    [8.7, 9.3, 9.9].forEach(px => g += C(px, 19.15, s * .3, `fill="${T.leaf}" stroke="${ink}" stroke-width="${lw * .4}"`));
    o += G('roof', 6, g);
  }
  // tags (shown when a system is picked)
  const tags = { shed: [-2, 3.7, -6.3, 6.4], struct: [7, 17.4, 14.6, 16.6], plumb: [10.35, 9, 14.6, 10.4], spk: [3, 11.3, -6.3, 13.2], mech: [12, 19.6, 14.6, 21.4], elev: [6.65, 7.3, -6.3, 8.6], roof: [3, 20.8, -6.3, 22.4] };
  let t = '';
  K.scope.forEach(x => {
    let [ax, az, tx, tz] = tags[x.id]; if (T.tagLeft !== undefined) tx = T.tagLeft; const w = (x.trade.length * T.tagFs * .62 + 60) | 0, left = tx < 0;
    const bx = left ? X(tx) : X(tx), by = Y(tz) - T.tagFs;
    t += `<g class="tag" data-sys="${x.id}"><line x1="${X(ax)}" y1="${Y(az)}" x2="${left ? bx + w : bx}" y2="${by + T.tagFs}" stroke="${x.c}" stroke-width="${lw}" stroke-dasharray="4 4"/>` +
      `<circle cx="${X(ax)}" cy="${Y(az)}" r="${s * .55}" fill="none" stroke="${x.c}" stroke-width="${lw * 1.2}" class="pulse"/>` +
      `<rect x="${bx}" y="${by}" width="${w}" height="${T.tagFs * 2}" rx="${T.tagR ?? T.tagFs}" fill="${x.c}" stroke="${ink}" stroke-width="${lw * .6}"/>` +
      `<text x="${bx + w / 2}" y="${by + T.tagFs * 1.36}" text-anchor="middle" font-size="${T.tagFs}" font-weight="700" fill="#fff" font-family="Poppins">${x.icon} ${x.trade}</text></g>`;
  });
  o += t;
  return o;
};
K.cutCSS = `.cut .sys,.cut .base{transition:opacity .25s,filter .25s}.cut[data-focus] .sys{opacity:.1!important}.cut[data-focus] .base{opacity:.62}.cut .tag{opacity:0;transition:opacity .2s;pointer-events:none}
.pulse{animation:pulse 1.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes pulse{50%{transform:scale(1.35);opacity:.4}}` +
  K.scope.map(x => `.cut[data-focus="${x.id}"] .sys[data-sys="${x.id}"]{opacity:1!important;filter:url(#hl)}.cut[data-focus="${x.id}"] .tag[data-sys="${x.id}"]{opacity:1}`).join('');
K.hlFilter = (halo = '#ffffff') => `<filter id="hl" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="d"/><feFlood flood-color="${halo}"/><feComposite in2="d" operator="in" result="h"/><feGaussianBlur in="h" stdDeviation="1.5" result="hb"/><feMerge><feMergeNode in="hb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

// hover a scope line -> that system lights up in the cutaway; hover the system -> its line lights up.
// Remote: up / down walks the list (the TV has no mouse), OK pins it, back clears.
K.wire = function (root) {
  const cuts = [...root.querySelectorAll('.cut')], cut = { set dataset_focus(v) {} }, items = [...root.querySelectorAll('.scope [data-sys]')];
  let pinned = null;
  const set = id => {
    cuts.forEach(c => { if (id) c.dataset.focus = id; else delete c.dataset.focus; });
    items.forEach(i => i.classList.toggle('on', i.dataset.sys === id));
  };
  items.forEach(it => {
    it.tabIndex = 0;
    it.addEventListener('mouseenter', () => set(it.dataset.sys));
    it.addEventListener('focus', () => set(it.dataset.sys));
    it.addEventListener('click', () => { pinned = pinned === it.dataset.sys ? null : it.dataset.sys; set(pinned || it.dataset.sys); });
  });
  root.querySelector('.scope').addEventListener('mouseleave', () => set(pinned));
  root.querySelectorAll('.cut .sys').forEach(g => { g.style.cursor = 'pointer'; g.addEventListener('mouseenter', () => set(g.dataset.sys)); g.addEventListener('mouseleave', () => set(pinned)); });
  document.addEventListener('keydown', e => {
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = i < 0 ? 0 : (i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; items[n].focus(); }
    if (e.key === 'Escape' || e.key === 'Backspace') { pinned = null; document.activeElement.blur(); set(null); }
  });
  const pre = K.q.get('sys');
  if (pre) { const it = items.find(i => i.dataset.sys === pre); if (it) { it.classList.add('remote'); set(pre); } }
};
