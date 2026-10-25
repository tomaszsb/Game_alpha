// The reps you hold, in the real engine: hire and fire, shorter and longer visits in the rep's own area, the salary at
// End Turn (whole weeks, in the Team line, counted toward On budget), the 1-in-20 roll (raise or quit, stop work order),
// a player who cannot pay picking who goes, and saves from before reps still loading.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { bootstrapHeadlessServices, HeadlessServices } from '../ghost/bootstrapServices';
import { computeProjectFinances } from '../../src/utils/projectFinances';
import { getRepDef, newHeldRep } from '../../src/utils/repRules';

let s: HeldServices;
type HeldServices = HeadlessServices;
let pid: string;

async function newGame(opts: { space?: string; visit?: 'First' | 'Subsequent'; cash?: number; day?: number; reps?: string[]; repDay?: number } = {}) {
  s = await bootstrapHeadlessServices();
  s.repService.autoDecide = false; // answered below, as a player would
  s.stateService.addPlayer('Rep Test');
  pid = s.stateService.getAllPlayers()[0].id;
  s.stateService.setCurrentPlayer(pid);
  s.stateService.startGame();
  const day = opts.day ?? 100;
  s.stateService.updatePlayer({
    id: pid, currentSpace: opts.space ?? 'PM-DECISION-CHECK', visitType: opts.visit ?? 'First',
    visitedSpaces: [opts.space ?? 'PM-DECISION-CHECK'], money: opts.cash ?? 200_000, timeSpent: day,
    moneySources: { ownerFunding: opts.cash ?? 200_000, bankLoans: 0, investmentDeals: 0, other: 0 },
    reps: (opts.reps ?? []).map(id => newHeldRep(getRepDef(id)!, opts.repDay ?? day)),
  } as never);
}

/** Starts the turn at the player's space with no random life card and no rep roll. */
async function arrive(rngValue = 0.99) {
  const rng = vi.spyOn(Math, 'random').mockReturnValue(rngValue);
  const prev = s.repService.rng;
  s.repService.rng = () => 0.99;
  try { await s.turnService.startTurn(pid); } finally { rng.mockRestore(); s.repService.rng = prev; }
}

/** Answers pop-ups one by one with the given picks (by option id), waiting for each to appear. */
async function answerAll(picks: Array<string | ((ids: string[]) => string)>): Promise<string[]> {
  const seen: string[] = [];
  for (const pick of picks) {
    let choice = s.stateService.getGameState().awaitingChoice;
    for (let i = 0; i < 200 && !choice; i++) { await new Promise(r => setTimeout(r, 5)); choice = s.stateService.getGameState().awaitingChoice; }
    expect(choice, 'a pop-up should be waiting').toBeTruthy();
    seen.push(choice!.prompt);
    const id = typeof pick === 'function' ? pick(choice!.options.map(o => o.id)) : pick;
    s.choiceService.resolveChoice(choice!.id, id);
    await new Promise(r => setTimeout(r, 0));
  }
  return seen;
}

afterEach(() => vi.restoreAllMocks());

describe('hiring and letting go', () => {
  it('shows three people one at a time; you keep the ones you pick, and the clock starts today', async () => {
    await newGame({ day: 120 });
    const done = s.repService.hire(pid);
    const prompts = await answerAll(['hire', 'pass', 'hire']);
    const hired = await done;
    expect(prompts.length).toBe(3);
    expect(hired.length).toBe(2);
    const reps = s.stateService.getPlayer(pid)!.reps!;
    expect(reps.length).toBe(2);
    for (const r of reps) {
      expect(r.salaryBilledThroughDay).toBe(120); // no back pay
      expect(r.hiredDay).toBe(120);
    }
  });

  it('a hire offer never has more than one bad rep', async () => {
    await newGame();
    const { getRepRules } = await import('../../src/utils/repRules');
    const bad = new Set(getRepRules().reps.filter(r => r.sign === 'bad').map(r => r.name));
    for (let i = 0; i < 25; i++) {
      const done = s.repService.hire(pid);
      const prompts = await answerAll(['pass', 'pass', 'pass']);
      await done;
      expect(prompts.filter(pr => [...bad].some(n => pr.includes(n))).length).toBeLessThanOrEqual(1);
    }
    expect(s.stateService.getPlayer(pid)!.reps ?? []).toEqual([]);
  });

  it('letting a rep go pays them up to today and removes them', async () => {
    await newGame({ reps: ['CODE-1'], repDay: 95, day: 100 });
    const before = s.stateService.getPlayer(pid)!.money;
    expect(await s.repService.fire(pid, 'CODE-1')).toBe(true);
    const p = s.stateService.getPlayer(pid)!;
    expect(p.reps).toEqual([]);
    expect(before - p.money).toBe(Math.round(5 * 500 / 7)); // 5 days of a 500-a-week rep
    expect(p.expenditures?.team).toBe(before - p.money);
  });

  it('with several reps, the player picks who goes', async () => {
    await newGame({ reps: ['CODE-1', 'PERMITS-1'] });
    const done = s.repService.fire(pid);
    await answerAll([ids => ids.find(i => i === 'PERMITS-1')!]);
    expect(await done).toBe(true);
    expect(s.stateService.getPlayer(pid)!.reps!.map(r => r.id)).toEqual(['CODE-1']);
  });
});

describe('visits in the rep\'s own area', () => {
  const daysAt = async (space: string, reps: string[]) => {
    await newGame({ space, reps, day: 100 });
    await arrive();
    return s.stateService.getPlayer(pid)!.timeSpent;
  };

  it('a good Code rep makes a Code stop 3 days shorter, a bad one 3 days longer', async () => {
    const plain = await daysAt('ARCH-FEE-REVIEW', []);
    expect(await daysAt('ARCH-FEE-REVIEW', ['CODE-1'])).toBe(plain - 3);
    expect(await daysAt('ARCH-FEE-REVIEW', ['CODE-4'])).toBe(plain + 3);
  });

  it('does nothing at a stop in another area, or at the office', async () => {
    const plain = await daysAt('ARCH-FEE-REVIEW', []);
    expect(await daysAt('ARCH-FEE-REVIEW', ['PERMITS-1'])).toBe(plain);
    const office = await daysAt('PM-DECISION-CHECK', []);
    expect(await daysAt('PM-DECISION-CHECK', ['CODE-1'])).toBe(office);
  });

  it('never takes a stop below zero days', async () => {
    const plain = await daysAt('ARCH-INITIATION', []); // a 5-day stop
    expect(await daysAt('ARCH-INITIATION', ['CODE-1', 'CODE-2', 'CODE-3'])).toBe(plain - 5);
  });
});

describe('the salary at End Turn', () => {
  it('takes whole weeks only, puts them in the Team line, and counts toward On budget', async () => {
    await newGame({ reps: ['CODE-1'], repDay: 100, day: 114 });
    const before = s.stateService.getPlayer(pid)!;
    const finBefore = computeProjectFinances(before, id => s.dataService.getCardById(id));
    const taken = await s.repService.settleAtEndTurn(pid);
    expect(taken).toBe(1000); // two whole weeks
    const p = s.stateService.getPlayer(pid)!;
    expect(before.money - p.money).toBe(1000);
    expect(p.expenditures?.team).toBe(1000);
    expect(p.reps![0].salaryBilledThroughDay).toBe(114);
    const fin = computeProjectFinances(p, id => s.dataService.getCardById(id));
    expect(fin.team.spent).toBe(1000);
    expect(fin.spent - finBefore.spent).toBe(1000);
  });

  it('a turn of 3 days owes nothing, and the 3 days are carried to the next bill', async () => {
    await newGame({ reps: ['CODE-1'], repDay: 100, day: 103 });
    expect(await s.repService.settleAtEndTurn(pid)).toBe(0);
    expect(s.stateService.getPlayer(pid)!.reps![0].salaryBilledThroughDay).toBe(100);
    s.stateService.updateTempState(pid, { timeSpent: 107 });
    expect(await s.repService.settleAtEndTurn(pid)).toBe(500);
  });

  it('End Turn takes the pay (the wiring, not just the method)', async () => {
    await newGame({ space: 'PM-DECISION-CHECK', reps: ['CODE-1'], repDay: 100, day: 100 });
    await arrive();
    s.stateService.updateTempState(pid, { timeSpent: 121 });
    const spy = vi.spyOn(s.repService, 'settleAtEndTurn');
    s.stateService.setPlayerMoveIntent(pid, 'ARCH-INITIATION');
    await s.turnService.endTurnWithMovement(true);
    expect(spy).toHaveBeenCalledWith(pid);
    expect(s.stateService.getPlayer(pid)!.expenditures?.team).toBe(1500);
  });

  it('a player who cannot pay picks who goes; the one let go is not paid and nobody goes bankrupt over salary', async () => {
    await newGame({ reps: ['CODE-1', 'PERMITS-1'], repDay: 100, day: 107, cash: 600 });
    const done = s.repService.settleAtEndTurn(pid);
    await answerAll(['PERMITS-1']);
    const taken = await done;
    expect(taken).toBe(500);
    const p = s.stateService.getPlayer(pid)!;
    expect(p.reps!.map(r => r.id)).toEqual(['CODE-1']);
    expect(p.money).toBe(100);
    expect(p.outReason).toBeUndefined();
  });

  it('with no cash at all every rep goes, unpaid, and the money does not go below zero from salary', async () => {
    await newGame({ reps: ['CODE-1', 'PERMITS-1'], repDay: 100, day: 107, cash: 0 });
    const done = s.repService.settleAtEndTurn(pid);
    await answerAll([ids => ids[0], ids => ids[0]]);
    expect(await done).toBe(0);
    const p = s.stateService.getPlayer(pid)!;
    expect(p.reps).toEqual([]);
    expect(p.money).toBe(0);
  });
});

describe('the 1-in-20 roll', () => {
  const arriveWithRoll = async (rngSeq: number[]) => {
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const q = [...rngSeq];
    s.repService.rng = () => (q.length ? q.shift()! : 0.99);
    const turn = s.turnService.startTurn(pid);
    return { turn, restore: () => rng.mockRestore() };
  };

  it('a good rep who is about to quit: a raise accepted keeps them at the new pay', async () => {
    await newGame({ space: 'ARCH-FEE-REVIEW', reps: ['CODE-1'], day: 100 });
    const { turn, restore } = await arriveWithRoll([0, 0]); // the roll hits, the raise is accepted
    const prompts = await answerAll(['raise30', 'ok']);
    await turn; restore();
    expect(prompts[0]).toContain('Priya Nair');
    expect(prompts[1]).toContain('said yes');
    const r = s.stateService.getPlayer(pid)!.reps!;
    expect(r.length).toBe(1);
    expect(r[0].salary).toBe(650);
    expect(r[0].lastRollDay).toBeDefined();
  });

  it('a raise refused: the rep leaves for good', async () => {
    await newGame({ space: 'ARCH-FEE-REVIEW', reps: ['CODE-1'], day: 100 });
    const { turn, restore } = await arriveWithRoll([0, 0.99]);
    const prompts = await answerAll(['raise10', 'ok']);
    await turn; restore();
    expect(prompts[1]).toContain('said no and left');
    expect(s.stateService.getPlayer(pid)!.reps).toEqual([]);
  });

  it('letting a quitting good rep go ends their time on the team', async () => {
    await newGame({ space: 'ARCH-FEE-REVIEW', reps: ['CODE-1'], day: 100 });
    const { turn, restore } = await arriveWithRoll([0]);
    await answerAll(['letgo']);
    await turn; restore();
    expect(s.stateService.getPlayer(pid)!.reps).toEqual([]);
  });

  it('a bad rep causes a stop work order: do it yourself costs $5,000 and 15 days, and the bad rep stays', async () => {
    await newGame({ space: 'ARCH-FEE-REVIEW', reps: ['CODE-4'], day: 100, cash: 200_000 });
    await arrive(); // learn the plain days first
    const plainDays = s.stateService.getPlayer(pid)!.timeSpent;
    const cash = s.stateService.getPlayer(pid)!.money;
    await newGame({ space: 'ARCH-FEE-REVIEW', reps: ['CODE-4'], day: 100, cash: 200_000 });
    const { turn, restore } = await arriveWithRoll([0]);
    const prompts = await answerAll(['c']);
    await turn; restore();
    expect(prompts[0]).toContain('design error');
    const p = s.stateService.getPlayer(pid)!;
    expect(p.timeSpent).toBe(plainDays + 15);
    expect(cash - p.money).toBe(5000);
    expect(p.expenditures?.team).toBe(5000);
    expect(p.reps!.map(r => r.id)).toEqual(['CODE-4']); // a bad rep stays bad and can be let go free
  });

  // Tom, 2026-10-25: the bad rep's mistake is worded by phase; same three ways out and prices in every phase.
  describe.each([
    { phase: 'design', space: 'ARCH-FEE-REVIEW', rep: 'CODE-4', ask: ['wrong records', 'design error', 'delayed your project'], done: 'Design error fixed', not: 'Stop work' },
    { phase: 'city filing', space: 'REG-DOB-FEE-REVIEW', rep: 'PERMITS-4', ask: ['upset a city official', 'audit'], done: 'Audit settled', not: 'Stop work' },
    { phase: 'inspection', space: 'SI-HIRE', rep: 'INSPECT-4', ask: ['Stop work order'], done: 'Stop work order lifted', not: 'audit' },
  ])('the mistake in $phase', ({ space, rep, ask, done, not }) => {
    it('is worded for the phase in the pop-up, the result line and the cost, with the same prices', async () => {
      await newGame({ space, reps: [rep], day: 100, cash: 200_000 });
      const lines: string[] = [];
      const log = vi.spyOn(s.loggingService, 'info').mockImplementation((m: string) => { lines.push(m); });
      const before = s.stateService.getPlayer(pid)!.money;
      const { turn, restore } = await arriveWithRoll([0]);
      const prompts = await answerAll(['c']);
      await turn; restore(); log.mockRestore();
      for (const w of ask) expect(prompts[0]).toContain(w);
      expect(prompts[0]).not.toContain(not);
      expect(lines.some(l => l.startsWith(`${done}: $5,000 and 15 days`))).toBe(true);
      expect(before - s.stateService.getPlayer(pid)!.money).toBeGreaterThanOrEqual(5000);
    });
  });

  it('the good-rep way out is offered only when a good rep in that area is held', async () => {
    await newGame({ space: 'ARCH-FEE-REVIEW', reps: ['CODE-4'], day: 100 });
    let { turn, restore } = await arriveWithRoll([0]);
    let ids: string[] = [];
    await answerAll([o => { ids = o; return 'c'; }]);
    await turn; restore();
    expect(ids).toEqual(['b', 'c']);
    await newGame({ space: 'ARCH-FEE-REVIEW', reps: ['CODE-4', 'CODE-1'], day: 100 });
    ({ turn, restore } = await arriveWithRoll([0, 0.99]));
    await answerAll([o => { ids = o; return 'a'; }]);
    await turn; restore();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('is made at most once per rep per 7 days', async () => {
    await newGame({ space: 'ARCH-FEE-REVIEW', reps: ['CODE-4'], day: 100 });
    s.repService.rng = () => 0; // always hits
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const first = s.turnService.startTurn(pid);
    await answerAll(['c']);
    await first;
    rng.mockRestore();
    const rolled = s.stateService.getPlayer(pid)!.reps![0].lastRollDay!;
    expect(rolled).toBeDefined();
    // Straight away again (a few days on): the roll is not made, so no second pop-up opens and nothing waits.
    expect(s.stateService.getGameState().awaitingChoice).toBeFalsy();
    const lines = await s.repService.onArrival(pid);
    expect(lines.some(l => l.includes('Stop work'))).toBe(false);
    expect(s.stateService.getGameState().awaitingChoice).toBeFalsy();
  });
});

describe('older saves and robots', () => {
  it('a player with no reps field costs nothing and rolls nothing', async () => {
    await newGame({ space: 'ARCH-FEE-REVIEW' });
    s.stateService.updatePlayer({ id: pid, reps: undefined } as never);
    const rng = vi.spyOn(Math, 'random');
    await arrive();
    expect(await s.repService.settleAtEndTurn(pid)).toBe(0);
    expect(s.repService.describe(pid)).toEqual([]);
    rng.mockRestore();
  });

  it('a robot (autoDecide) answers the stop work order by the rules and the hire offer by passing', async () => {
    await newGame({ space: 'ARCH-FEE-REVIEW', reps: ['CODE-4', 'CODE-1'], day: 100, cash: 200_000 });
    s.repService.autoDecide = true;
    expect(await s.repService.hire(pid)).toEqual([]);
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const q = [0, 0.99];
    s.repService.rng = () => (q.length ? q.shift()! : 0.99);
    await s.turnService.startTurn(pid); // would hang if it waited for a click
    rng.mockRestore();
    expect(s.stateService.getPlayer(pid)!.expenditures?.team).toBe(15000); // a good rep in the area: option (a)
  });
});
