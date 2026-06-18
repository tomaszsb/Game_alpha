// tests/server/instanceValidation.test.ts
// Phase 2 config validation — the hybrid confirm flow's engine. Pins:
// pass-through computation (single, transitive, ambiguous), explicit
// detour override, cycle rejection, protection tiers as save-time errors,
// copy integrity (slot rename forbidden, schema drift + staleness as
// warnings, never errors), and the PATH_CHOICE drift tripwire.

import { describe, it, expect } from 'vitest';
import { validateConfig, resolveDetours, inactiveSpaces } from '../../server/instanceValidation.js';

const HEADER =
  'space_name,visit_type,Title,Event,Outcome,space_1,space_2,pos_x,pos_y,' +
  'is_starting_space,is_ending_space,is_resume_hub,path_choice_memory_key,is_path_choice_lock_point';

const STOCK = [
  HEADER,
  'ALPHA-START,First,Start,You begin,Done,BETA-MIDDLE,,0,0,Yes,No,No,,No',
  'BETA-MIDDLE,First,Middle,Mid event,Done,GAMMA-FORK,,100,0,No,No,No,,No',
  'GAMMA-FORK,First,Fork,Pick a path,Done,DELTA-LEFT,EPSILON-RIGHT,200,0,No,No,No,,No',
  'DELTA-LEFT,First,Left,Left event,Done,ZETA-END,,300,0,No,No,No,,No',
  'EPSILON-RIGHT,First,Right,Right event,Done,ZETA-END,,300,100,No,No,No,,No',
  'PM-DECISION-CHECK,First,PM,PM event,Done,ZETA-END,,400,100,No,No,No,,No',
  'ZETA-END,First,End,The end,Done,,,500,0,No,Yes,No,,No',
].join('\n') + '\n';

function makeConfig(partial: Record<string, unknown> = {}) {
  return {
    meta: { id: 'classroom-1' },
    configVersion: 1,
    slots: {},
    teacherCopies: {},
    detours: {},
    ...partial,
  };
}

describe('inactiveSpaces', () => {
  it('collects only slots explicitly marked used:false', () => {
    const config = makeConfig({
      slots: {
        'BETA-MIDDLE': { used: false },
        'DELTA-LEFT': { used: true },
        'GAMMA-FORK': { pos_x: '1', pos_y: '2' }, // no used flag = in play
      },
    });
    expect([...inactiveSpaces(config)]).toEqual(['BETA-MIDDLE']);
  });
});

describe('resolveDetours', () => {
  it('computes the single-destination pass-through automatically', () => {
    const config = makeConfig({ slots: { 'BETA-MIDDLE': { used: false } } });
    const result = resolveDetours({ config, stockSpacesCsv: STOCK });
    expect(result.errors).toEqual([]);
    expect(result.detours).toEqual({ 'BETA-MIDDLE': 'GAMMA-FORK' });
    expect(result.suggestions['BETA-MIDDLE']).toEqual({ target: 'GAMMA-FORK', candidates: ['GAMMA-FORK'] });
  });

  it('resolves chains of off spaces transitively', () => {
    const config = makeConfig({
      slots: { 'BETA-MIDDLE': { used: false }, 'GAMMA-FORK': { used: false } },
      detours: { 'GAMMA-FORK': 'DELTA-LEFT' },
    });
    const result = resolveDetours({ config, stockSpacesCsv: STOCK });
    expect(result.errors).toEqual([]);
    // BETA passes through GAMMA (also off) which detours to DELTA.
    expect(result.detours).toEqual({
      'BETA-MIDDLE': 'DELTA-LEFT',
      'GAMMA-FORK': 'DELTA-LEFT',
    });
  });

  it('requires the teacher to choose when the pass-through is ambiguous', () => {
    const config = makeConfig({ slots: { 'GAMMA-FORK': { used: false } } });
    const result = resolveDetours({ config, stockSpacesCsv: STOCK });
    expect(result.errors).toMatchObject([
      { code: 'DETOUR_AMBIGUOUS', space: 'GAMMA-FORK', candidates: ['DELTA-LEFT', 'EPSILON-RIGHT'] },
    ]);
    expect(result.detours).toEqual({});
  });

  it('honors an explicit detour over the pass-through', () => {
    const config = makeConfig({
      slots: { 'GAMMA-FORK': { used: false } },
      detours: { 'GAMMA-FORK': 'EPSILON-RIGHT' },
    });
    const result = resolveDetours({ config, stockSpacesCsv: STOCK });
    expect(result.errors).toEqual([]);
    expect(result.detours).toEqual({ 'GAMMA-FORK': 'EPSILON-RIGHT' });
  });

  it('rejects detour cycles instead of crashing or auto-fixing', () => {
    const config = makeConfig({
      slots: { 'BETA-MIDDLE': { used: false }, 'GAMMA-FORK': { used: false } },
      detours: { 'BETA-MIDDLE': 'GAMMA-FORK', 'GAMMA-FORK': 'BETA-MIDDLE' },
    });
    const result = resolveDetours({ config, stockSpacesCsv: STOCK });
    expect(result.errors.some(e => e.code === 'DETOUR_CYCLE')).toBe(true);
  });

  it('rejects detours to spaces that do not exist', () => {
    const config = makeConfig({
      slots: { 'BETA-MIDDLE': { used: false } },
      detours: { 'BETA-MIDDLE': 'NARNIA-PORTAL' },
    });
    const result = resolveDetours({ config, stockSpacesCsv: STOCK });
    expect(result.errors).toMatchObject([{ code: 'DETOUR_TARGET_UNKNOWN', space: 'BETA-MIDDLE' }]);
  });
});

describe('validateConfig — protection tiers', () => {
  it('rejects switching off a structural space', () => {
    const report = validateConfig({
      config: makeConfig({ slots: { 'ALPHA-START': { used: false } } }),
      stockSpacesCsv: STOCK,
    });
    expect(report.ok).toBe(false);
    expect(report.errors).toMatchObject([{ code: 'PROTECTED_SPACE', space: 'ALPHA-START' }]);
    expect(report.errors[0].message).toContain('structural');
  });

  it('rejects switching off a semantic anchor (Phase 2 launch protection)', () => {
    const report = validateConfig({
      config: makeConfig({ slots: { 'PM-DECISION-CHECK': { used: false } } }),
      stockSpacesCsv: STOCK,
    });
    expect(report.ok).toBe(false);
    expect(report.errors[0].message).toContain('semantic');
  });

  it('rejects switching off a path-choice participant', () => {
    const pathChoiceCsv =
      'affected_space,memory_key,chosen_value,excluded_destination\n' +
      'GAMMA-FORK,fork_path,DELTA-LEFT,EPSILON-RIGHT\n';
    const report = validateConfig({
      config: makeConfig({
        slots: { 'DELTA-LEFT': { used: false } },
        detours: { 'DELTA-LEFT': 'ZETA-END' },
      }),
      stockSpacesCsv: STOCK,
      pathChoiceCsv,
    });
    expect(report.ok).toBe(false);
    expect(report.errors.some(e => e.code === 'PROTECTED_SPACE' && e.space === 'DELTA-LEFT')).toBe(true);
  });

  it('accepts a clean switch-off and returns the resolved detour', () => {
    const report = validateConfig({
      config: makeConfig({ slots: { 'BETA-MIDDLE': { used: false } } }),
      stockSpacesCsv: STOCK,
    });
    expect(report.ok).toBe(true);
    expect(report.detours).toEqual({ 'BETA-MIDDLE': 'GAMMA-FORK' });
  });
});

describe('validateConfig — teacher copies', () => {
  function copyConfig(copy: Record<string, unknown>, slotCard = 'beta_middle_copy_1') {
    return makeConfig({
      slots: { 'BETA-MIDDLE': { used: true, card: slotCard } },
      teacherCopies: { beta_middle_copy_1: copy },
    });
  }

  const fullRow = {
    space_name: 'BETA-MIDDLE', visit_type: 'First', Title: 'My middle', Event: 'Custom', Outcome: 'Done',
    space_1: 'GAMMA-FORK', space_2: '', pos_x: '100', pos_y: '0',
    is_starting_space: 'No', is_ending_space: 'No', is_resume_hub: 'No',
    path_choice_memory_key: '', is_path_choice_lock_point: 'No',
  };

  it('accepts a well-formed copy', () => {
    const report = validateConfig({
      config: copyConfig({ slot: 'BETA-MIDDLE', rows: { First: fullRow } }),
      stockSpacesCsv: STOCK,
    });
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([]);
  });

  it('errors when a copy renames its slot (slot names are the only identifiers)', () => {
    const report = validateConfig({
      config: copyConfig({ slot: 'BETA-MIDDLE', rows: { First: { ...fullRow, space_name: 'beta_middle_copy_1' } } }),
      stockSpacesCsv: STOCK,
    });
    expect(report.errors.some(e => e.code === 'COPY_RENAMES_SLOT')).toBe(true);
  });

  it('errors when a copy refers to an unknown space or a slot plays a missing card', () => {
    const ghost = validateConfig({
      config: copyConfig({ slot: 'GHOST-SPACE', rows: { First: fullRow } }),
      stockSpacesCsv: STOCK,
    });
    expect(ghost.errors.some(e => e.code === 'COPY_UNKNOWN_SLOT')).toBe(true);

    const missingCard = validateConfig({
      config: makeConfig({ slots: { 'BETA-MIDDLE': { used: true, card: 'nope_copy_9' } } }),
      stockSpacesCsv: STOCK,
    });
    expect(missingCard.errors.some(e => e.code === 'SLOT_UNKNOWN_CARD')).toBe(true);
  });

  it('warns (never errors) on schema drift — structure aligns at bake', () => {
    const { Outcome: _dropped, ...rowMissingColumn } = fullRow;
    const report = validateConfig({
      config: copyConfig({ slot: 'BETA-MIDDLE', rows: { First: rowMissingColumn } }),
      stockSpacesCsv: STOCK,
    });
    expect(report.ok).toBe(true);
    const drift = report.warnings.find(w => w.code === 'COPY_SCHEMA_DRIFT');
    expect(drift).toBeDefined();
    expect(drift!.message).toContain('Outcome');
  });

  it('warns when the stock card has been updated since the copy was made (staleness hint)', () => {
    const report = validateConfig({
      config: copyConfig({ slot: 'BETA-MIDDLE', copiedFromStockVersion: 'old-version', rows: { First: fullRow } }),
      stockSpacesCsv: STOCK,
      stockVersion: 'new-version',
    });
    expect(report.ok).toBe(true);
    expect(report.warnings.some(w => w.code === 'COPY_STOCK_UPDATED')).toBe(true);
  });
});

describe('validateConfig — PATH_CHOICE drift tripwire', () => {
  it('hard-errors if path-choice rules reference a switched-off space', () => {
    // Protection should make this unreachable; if rules and protection
    // drift apart, surface loudly rather than bake garbage. Simulate the
    // drift with a rules file referencing a non-protected space.
    const report = validateConfig({
      config: makeConfig({ slots: { 'BETA-MIDDLE': { used: false } } }),
      stockSpacesCsv: STOCK,
      pathChoiceCsv:
        'affected_space,memory_key,chosen_value,excluded_destination\n' +
        'ZETA-END,some_key,EPSILON-RIGHT,BETA-MIDDLE\n',
    });
    // BETA-MIDDLE is now path-choice protected (excluded_destination), so
    // both the protection error AND the tripwire fire.
    expect(report.errors.some(e => e.code === 'PROTECTED_SPACE')).toBe(true);
    expect(report.errors.some(e => e.code === 'PATH_CHOICE_REFERENCES_OFF_SPACE')).toBe(true);
  });
});

describe('validateConfig — insertions (Phase 4a)', () => {
  const ins = (over: Record<string, unknown>) => ({
    id: 'AUTH-CLASSROOM-1-1', displayName: 'Authored', story: '', ...over,
  });

  it('accepts an authored space on a real fixed edge', () => {
    const config = makeConfig({
      insertions: { 'AUTH-CLASSROOM-1-1': ins({ from: 'BETA-MIDDLE', to: 'GAMMA-FORK' }) },
    });
    const report = validateConfig({ config, stockSpacesCsv: STOCK });
    expect(report.errors.filter(e => e.code.startsWith('INSERT_'))).toEqual([]);
  });

  it('rejects a self-edge (from === to)', () => {
    const config = makeConfig({
      insertions: { 'AUTH-CLASSROOM-1-1': ins({ from: 'BETA-MIDDLE', to: 'BETA-MIDDLE' }) },
    });
    const report = validateConfig({ config, stockSpacesCsv: STOCK });
    expect(report.errors.some(e => e.code === 'INSERT_SELF_EDGE')).toBe(true);
  });

  it('rejects an authored id that collides with a stock space name', () => {
    const config = makeConfig({
      insertions: { 'ZETA-END': ins({ id: 'ZETA-END', from: 'BETA-MIDDLE', to: 'GAMMA-FORK' }) },
    });
    const report = validateConfig({ config, stockSpacesCsv: STOCK });
    expect(report.errors.some(e => e.code === 'INSERT_ID_COLLISION')).toBe(true);
  });

  it('rejects a non-existent A→B edge', () => {
    const config = makeConfig({
      insertions: { 'AUTH-CLASSROOM-1-1': ins({ from: 'ALPHA-START', to: 'GAMMA-FORK' }) },
    });
    const report = validateConfig({ config, stockSpacesCsv: STOCK });
    expect(report.errors.some(e => e.code === 'INSERT_EDGE_MISSING')).toBe(true);
  });

  it('rejects two insertions on the same edge (no chains in 4a)', () => {
    const config = makeConfig({
      insertions: {
        'AUTH-CLASSROOM-1-1': ins({ id: 'AUTH-CLASSROOM-1-1', from: 'BETA-MIDDLE', to: 'GAMMA-FORK' }),
        'AUTH-CLASSROOM-1-2': ins({ id: 'AUTH-CLASSROOM-1-2', from: 'BETA-MIDDLE', to: 'GAMMA-FORK' }),
      },
    });
    const report = validateConfig({ config, stockSpacesCsv: STOCK });
    expect(report.errors.some(e => e.code === 'INSERT_EDGE_OCCUPIED')).toBe(true);
  });
});
