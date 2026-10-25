// The filing rep's run round the plan-exam circle, in the real engine.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { bootstrapHeadlessServices, HeadlessServices } from '../ghost/bootstrapServices';
import { getRepDef, getRepRules, newHeldRep } from '../../src/utils/repRules';

let s: HeadlessServices;
let pid: string;

async function newGame(opts: { reps?: string[]; count?: number; mode?: 'ask' | 'auto' | 'never' } = {}) {
  s = await bootstrapHeadlessServices();
  s.repService.autoDecide = false;
  s.autoRunService.mode = opts.mode ?? 'ask';
  s.stateService.addPlayer('Run Test');
  pid = s.stateService.getAllPlayers()[0].id;
  s.stateService.setCurrentPlayer(pid);
  s.stateService.startGame();
  s.stateService.updatePlayer({
    id: pid, currentSpace: 'ARCH-INITIATION', visitType: 'Subsequent',
    visitedSpaces: ['ARCH-INITIATION'], money: 5_000_000, timeSpent: 100,
    moneySources: { ownerFunding: 5_000_000, bankLoans: 0, investmentDeals: 0, other: 0 },
    sendBackCount: opts.count ?? 2,
    reps: (opts.reps ?? []).map(id => newHeldRep(getRepDef(id)!, 100)),
  } as never);
  await s.cardService.drawCards(pid, 'W', 3);
}

async function waitChoice() {
  let c = s.stateService.getGameState().awaitingChoice;
  for (let i = 0; i < 400 && !c; i++) { await new Promise(r => setTimeout(r, 5)); c = s.stateService.getGameState().awaitingChoice; }
  expect(c, 'a pop-up should be waiting').toBeTruthy();
  return c!;
}

afterEach(() => vi.restoreAllMocks());

const goodRep = () => getRepRules().reps.find(r => r.sign === 'good')!.id;
const badRep = () => getRepRules().reps.find(r => r.sign === 'bad')!.id;
const reportLines = (c: { metadata?: unknown }) => (c.metadata as { lines: Array<{ label: string; text: string }> }).lines;

/** Starts the turn at the first stop, pins the arrival dice, and answers the offer with `pick`. */
async function startAndAnswer(pick: 'hand' | 'rep') {
  vi.spyOn(Math, 'random').mockReturnValue(0.99);
  const started = s.turnService.startTurn(pid);
  const offer = await waitChoice();
  s.choiceService.resolveChoice(offer.id, pick);
  return { started, offer };
}

describe('the send-back counter', () => {
  async function leave(from: string, to: string, opts: { skipAutoMove?: boolean } = {}) {
    s.stateService.updatePlayer({ id: pid, currentSpace: from, visitType: 'Subsequent', visitedSpaces: [from, to] } as never);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await s.turnService.startTurn(pid);
    s.stateService.setPlayerMoveIntent(pid, to);
    await s.turnService.endTurnWithMovement(true, opts.skipAutoMove ?? false);
  }
  it('goes up when the plan exam sends the student back, and the sending back is the real End Turn', async () => {
    await newGame({ count: 1, mode: 'never' });
    await leave('REG-DOB-PLAN-EXAM', 'ARCH-INITIATION');
    expect(s.stateService.getPlayer(pid)!.sendBackCount).toBe(2);
  });
  it('resets to zero on a pass', async () => {
    await newGame({ count: 3, mode: 'never' });
    await leave('REG-DOB-PLAN-EXAM', 'REG-FDNY-FEE-REVIEW');
    expect(s.stateService.getPlayer(pid)!.sendBackCount).toBe(0);
  });
  it('moving on round the circle does not change it', async () => {
    await newGame({ count: 2, mode: 'never' });
    await leave('ARCH-INITIATION', 'ARCH-FEE-REVIEW');
    expect(s.stateService.getPlayer(pid)!.sendBackCount).toBe(2);
  });
  it('a push-back stays put and is not a send-back', async () => {
    await newGame({ count: 2, mode: 'never' });
    await leave('REG-DOB-PLAN-EXAM', 'REG-DOB-PLAN-EXAM', { skipAutoMove: true });
    expect(s.stateService.getPlayer(pid)!.sendBackCount).toBe(2);
  });
  it('a save from before the counter has no field: no offer, no crash', async () => {
    await newGame({ mode: 'ask' });
    s.stateService.updatePlayer({ id: pid, sendBackCount: undefined } as never);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await s.turnService.startTurn(pid);
    expect(s.stateService.getGameState().awaitingChoice?.metadata?.kind).not.toBe('autorun_offer');
    expect(s.stateService.getPlayer(pid)!.sendBackCount ?? 0).toBe(0);
  });
});

describe('the offer', () => {
  it('the first two loops are always by hand: one send-back is not enough', async () => {
    await newGame({ count: 1, reps: [goodRep()] });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await s.turnService.startTurn(pid);
    expect(s.stateService.getGameState().awaitingChoice?.metadata?.kind).not.toBe('autorun_offer');
  });
  it('after two, with no rep held, the filing-rep button is greyed with "Needs a filing rep"', async () => {
    await newGame({ count: 2 });
    const { started, offer } = await startAndAnswer('hand');
    expect(offer.metadata?.kind).toBe('autorun_offer');
    const rep = offer.options.find(o => o.id === 'rep')!;
    expect(rep.disabled).toBe(true);
    expect(rep.hint).toBe('Needs a filing rep');
    expect(offer.options.find(o => o.id === 'hand')!.disabled).toBeFalsy();
    await started;
    expect(s.stateService.getPlayer(pid)!.currentSpace).toBe('ARCH-INITIATION'); // played by hand: nothing ran
  });
  it('with a rep held the button is live', async () => {
    await newGame({ count: 2, reps: [badRep()] });
    const { started, offer } = await startAndAnswer('hand');
    expect(offer.options.find(o => o.id === 'rep')!.disabled).toBeFalsy();
    await started;
  });
  it('declining costs nothing: no random number is drawn by the feature', async () => {
    await newGame({ count: 2 });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const rng = vi.fn(() => 0.5);
    s.autoRunService.rng = rng;
    const asked = s.autoRunService.maybeOffer(pid);
    const offer = await waitChoice();
    const before = spy.mock.calls.length;
    s.choiceService.resolveChoice(offer.id, 'hand');
    await asked;
    expect(spy.mock.calls.length).toBe(before);
    expect(rng).not.toHaveBeenCalled();
  });
});

describe('the run', () => {
  it('goes round the circle inside one turn, stops AT the plan exam, and reports once', async () => {
    await newGame({ count: 2, reps: [goodRep()] });
    const { started } = await startAndAnswer('rep');
    const report = await waitChoice();
    expect(report.metadata?.kind).toBe('autorun_report');
    expect(report.options.map(o => o.label)).toEqual(['OK']);
    const lines = reportLines(report);
    expect(lines[lines.length - 1].label).toBe('Total so far');
    expect(lines.some(l => /End Turn/.test(l.text))).toBe(true);
    s.choiceService.resolveChoice(report.id, 'ok');
    await started;
    const p = s.stateService.getPlayer(pid)!;
    expect(p.currentSpace).toBe('REG-DOB-PLAN-EXAM'); // still this player's turn; the verdict is theirs to take
    expect(s.stateService.getGameState().currentPlayerId).toBe(pid);
    expect(p.timeSpent).toBeGreaterThan(100);
  });

  it('writes History lines for every skipped space', async () => {
    await newGame({ count: 2, reps: [goodRep()] });
    const { started } = await startAndAnswer('rep');
    const report = await waitChoice();
    s.choiceService.resolveChoice(report.id, 'ok');
    await started;
    const log = s.stateService.getGameState().globalActionLog;
    const steps = log.filter(e => e.details?.action === 'autorun_step');
    expect(steps.length).toBeGreaterThanOrEqual(6);
    const arrivals = log.filter(e => e.details?.action === 'turn_start');
    expect(arrivals.length).toBeGreaterThanOrEqual(8); // every stop on the way wrote its own arrival
  });

  it('a GOOD rep rolls twice at the architect and engineer stops and keeps the better', async () => {
    await newGame({ count: 2, reps: [goodRep()] });
    const seq = [0, 0.99]; // a 1, then a 6, every time
    let i = 0;
    s.autoRunService.rng = () => seq[i++ % 2];
    const { started } = await startAndAnswer('rep');
    const report = await waitChoice();
    const twice = reportLines(report).filter(l => /rolled 1 and 6, kept the 1/.test(l.text));
    expect(twice.length).toBeGreaterThanOrEqual(2);
    s.choiceService.resolveChoice(report.id, 'ok');
    await started;
  });

  it('a BAD rep rolls once: no "rolled ... and ..." anywhere in the report', async () => {
    await newGame({ count: 2, reps: [badRep()] });
    const rng = vi.fn(() => 0.5);
    s.autoRunService.rng = rng;
    const { started } = await startAndAnswer('rep');
    const report = await waitChoice();
    expect(reportLines(report).some(l => /rolled \d and \d/.test(l.text))).toBe(false);
    expect(rng).not.toHaveBeenCalled();
    s.choiceService.resolveChoice(report.id, 'ok');
    await started;
  });

  it('a robot with a rep (mode auto) runs without any pop-up, and without one plays by hand', async () => {
    await newGame({ count: 2, reps: [goodRep()], mode: 'auto' });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await s.turnService.startTurn(pid);
    expect(s.stateService.getPlayer(pid)!.currentSpace).toBe('REG-DOB-PLAN-EXAM');
    expect(s.stateService.getGameState().awaitingChoice?.metadata?.kind).not.toBe('autorun_report');

    await newGame({ count: 2, mode: 'auto' });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await s.turnService.startTurn(pid);
    expect(s.stateService.getPlayer(pid)!.currentSpace).toBe('ARCH-INITIATION');
  });
});
