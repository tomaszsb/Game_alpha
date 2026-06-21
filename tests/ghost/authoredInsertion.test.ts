// tests/ghost/authoredInsertion.test.ts
//
// Authored-insertion ghost fixture (TODO: Phase 4b safety net). The standing
// smart-bot gate runs the ghost over STOCK data, so it can't catch a soft-lock
// that only a teacher-authored space introduces — yet a teacher CAN now author
// a dice space whose faces cycle back on themselves, seeding an unwinnable loop.
//
// Two halves, both bake an authored insertion and run the ghost over the baked
// CLEAN_FILES with detectLoops armed:
//
//   1. REAL board + a benign pass-through authored space (card draw + flat fee)
//      on the start edge. The board must stay winnable and must NOT trip the
//      loop guard. This is the integration net: if a future change makes
//      authored insertions crash, break an invariant, or soft-lock the real
//      game, this fails. It also exercises the validator/engine dice-drift fix
//      end-to-end — the splice sits on OWNER-SCOPE-INITIATION, which carries
//      requires_dice_roll=Yes for its W Cards effect roll while moving along a
//      fixed edge (the case that used to be wrongly rejected).
//
//   2. MINIMAL synthetic board + an authored DICE space whose six faces all
//      route back to its source — an unavoidable, clean cycle. Proves the loop
//      guard actually catches an authored-space loop and names it. (A forced
//      loop on the full board is impractical — its hubs/effects let the bot
//      escape — so the teeth are shown on a board we fully control.)
//
// Runs are seeded (mulberry32 over Math.random) so the harness is deterministic
// and reproducible across machines.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bakeInstance, computeStockVersion, resolvedDir } from '../../server/instanceResolver.js';
import { createInstance, addInsertion } from '../../server/instanceStore.js';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { playOneGame, isHardFailure, type GhostGameResult, type GhostGameOptions } from './ghostPlayer';

const STOCK_DATA_DIR = path.join(process.cwd(), 'public', 'data');

// A two-space synthetic board: START (start) → END (finish). Splicing a dice
// space onto START→END and pointing every face back at START makes START's only
// exit a cycle the bot can never escape. Both START rows exist (First +
// Subsequent), so the authored space (which mirrors START) survives re-entry —
// the cycle is clean, not a dead-row invariant.
const SYNTH_SPACES_HEADER =
  'space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,' +
  'Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,' +
  'is_starting_space,is_ending_space,pos_x,pos_y';
const SYNTH_SPACES = [
  SYNTH_SPACES_HEADER,
  'START-SPACE,SETUP,First,Start,Begin,Go,Done,,,,,,1,0,END-SPACE,,,,,NO,NO,Main,Yes,No,0,0',
  'START-SPACE,SETUP,Subsequent,Start,Again,Go,Done,,,,,,1,0,END-SPACE,,,,,NO,NO,Main,Yes,No,0,0',
  'END-SPACE,CONSTRUCTION,First,End,Done,Go,Done,,,,,,1,0,,,,,,NO,NO,Main,No,Yes,100,0',
  'END-SPACE,CONSTRUCTION,Subsequent,End,Done,Go,Done,,,,,,1,0,,,,,,NO,NO,Main,No,Yes,100,0',
].join('\n') + '\n';

let tmp: string;
let benignCleanDir: string;
let loopCleanDir: string;

/** Same 4-line seeded PRNG the ghost batch runner uses (it isn't exported). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function runSeeded(cleanDir: string, seed: number, opts: GhostGameOptions): Promise<GhostGameResult> {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    const services = await bootstrapHeadlessServices(cleanDir);
    return await playOneGame(services, opts);
  } finally {
    Math.random = original;
  }
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-authored-'));
  const instancesRoot = path.join(tmp, 'instances');

  // (1) Benign pass-through on the real board's start edge: deals an E card and
  // charges a flat fee, then flows straight on to funding. Non-dice, can't cycle.
  const realVersion = computeStockVersion(STOCK_DATA_DIR);
  const benign = createInstance(instancesRoot, { id: 'benign' });
  addInsertion(benign, {
    from: 'OWNER-SCOPE-INITIATION',
    to: 'OWNER-FUND-INITIATION',
    displayName: 'Pre-Filing Orientation',
    story: 'A quick orientation before funding.',
    time: '1',
    fee: '1000',
    cardDraw: { type: 'E', count: 1 },
  });
  bakeInstance({ stockDataDir: STOCK_DATA_DIR, instancesRoot, config: benign, stockVersion: realVersion });
  benignCleanDir = path.join(resolvedDir(instancesRoot, 'benign'), 'CLEAN_FILES');

  // (2) Synthetic stock + a looping authored dice space. Write a minimal stock
  // (the curated CLEAN files the bootstrap reads, header-only — the bake copies
  // them and injects the authored dice rows), then bake the loop instance.
  const synthStock = path.join(tmp, 'synth-stock');
  fs.mkdirSync(path.join(synthStock, 'SOURCE_FILES'), { recursive: true });
  fs.mkdirSync(path.join(synthStock, 'CLEAN_FILES'), { recursive: true });
  fs.writeFileSync(path.join(synthStock, 'SOURCE_FILES', 'Spaces.csv'), SYNTH_SPACES);
  fs.writeFileSync(path.join(synthStock, 'SOURCE_FILES', 'DiceRoll Info.csv'), 'space_name,die_roll,visit_type,1,2,3,4,5,6\n');
  // Curated CLEAN files the headless DataService loads — header-only is enough;
  // the toy board draws no cards and asks no logic questions, and the bake
  // injects the authored space's DICE_OUTCOMES row.
  fs.writeFileSync(
    path.join(synthStock, 'CLEAN_FILES', 'CARDS_EXPANDED.csv'),
    'card_id,card_name,card_type,description,effects_on_play,cost,phase_restriction,duration,duration_count,turn_effect,activation_timing,loan_amount,loan_rate,investment_amount,work_cost,money_effect,tick_modifier,draw_cards,discard_cards,target,scope,work_type_restriction,card_mechanic,dice_range_1_min,dice_range_1_max,dice_range_1_time,dice_range_2_min,dice_range_2_max,dice_range_2_time,investor_payout,revokes_approval,affected_phase\n' +
    // One real card row — the parser requires ≥1 data row; the toy never draws it.
    'E001,Dummy,E,A dummy card.,Apply Card,0,Any,Immediate,0,,Player Controlled,0,0,0,0,,0,,,Self,Single,,,,,,,,,,,\n'
  );
  fs.writeFileSync(
    path.join(synthStock, 'CLEAN_FILES', 'LOGIC_QUESTIONS.csv'),
    'space_name,visit_type,question_id,question_text,yes_target,no_target,auto_answer_from,yes_reason,no_reason\n'
  );
  fs.writeFileSync(
    path.join(synthStock, 'CLEAN_FILES', 'DICE_OUTCOMES.csv'),
    'space_name,visit_type,roll_1,roll_2,roll_3,roll_4,roll_5,roll_6\n'
  );
  fs.writeFileSync(
    path.join(synthStock, 'CLEAN_FILES', 'PATH_CHOICE_RULES.csv'),
    'affected_space,memory_key,chosen_value,excluded_destination\n'
  );

  const synthVersion = computeStockVersion(synthStock);
  const loopy = createInstance(instancesRoot, { id: 'loopy' });
  addInsertion(loopy, {
    from: 'START-SPACE',
    to: 'END-SPACE',
    displayName: 'Inspection Limbo',
    story: 'Round and round you go.',
    diceOutcomes: Array(6).fill('START-SPACE'),
  });
  bakeInstance({ stockDataDir: synthStock, instancesRoot, config: loopy, stockVersion: synthVersion });
  loopCleanDir = path.join(resolvedDir(instancesRoot, 'loopy'), 'CLEAN_FILES');
}, 120000);

afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe('Ghost over a baked classroom with an authored insertion', () => {
  it('bakes the authored space into the served board', () => {
    const movement = fs.readFileSync(path.join(benignCleanDir, 'MOVEMENT.csv'), 'utf-8');
    expect(movement).toContain('AUTH-BENIGN-1');
  });

  it('plays the real board with a benign authored space (card draw + fee) to completion without a soft-lock', async () => {
    const results: GhostGameResult[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      results.push(await runSeeded(benignCleanDir, seed, { detectLoops: true, maxTurns: 200 }));
    }
    // No crashes, broken invariants, or false-positive loops on the benign board.
    const hard = results.filter(isHardFailure);
    expect(hard, hard.map(r => `${r.reason}: ${r.error}`).join('\n')).toEqual([]);
    // And the authored splice didn't make the board unwinnable.
    expect(results.some(r => r.reason === 'WIN')).toBe(true);
  }, 180000);

  it('catches an authored dice space that cycles back on itself as a LOOP (the safety net has teeth)', async () => {
    const result = await runSeeded(loopCleanDir, 1, { detectLoops: true, maxTurns: 60 });
    expect(result.reason, `${result.error}\n${result.trail.slice(-6).join('\n')}`).toBe('LOOP');
    expect(isHardFailure(result)).toBe(true);
    // The blamed cycle names the authored space — it's the splice, not incidental
    // bot cycling, that the net flags.
    expect(result.error).toContain('AUTH-LOOPY-1');
  }, 60000);
});
