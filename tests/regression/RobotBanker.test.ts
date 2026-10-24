// The robot banker, wired into the real engine: the bank's card draw is answered by decide(), a refusal
// moves no money and counts, the second refusal sends the student straight to the investor, the schedule at
// the moment of the loan is stored next to the loan, and the finish settles against that schedule.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { bootstrapHeadlessServices, HeadlessServices } from '../ghost/bootstrapServices';

const BANK = 'BANK-FUND-REVIEW';
let s: HeadlessServices;
let pid: string;

async function atBank(opts: { daysUsed?: number; bankRefusals?: number; cash?: number } = {}) {
  s = await bootstrapHeadlessServices();
  s.stateService.addPlayer('Banker Test');
  pid = s.stateService.getAllPlayers()[0].id;
  s.stateService.setCurrentPlayer(pid);
  s.stateService.startGame();
  const w = s.dataService.getCardsByType('W').slice(0, 2).map(c => c.card_id);
  s.stateService.updatePlayer({
    id: pid, currentSpace: BANK, visitType: 'First', visitedSpaces: [BANK], hand: w,
    money: opts.cash ?? 100_000, moneySources: { ownerFunding: opts.cash ?? 100_000, bankLoans: 0, investmentDeals: 0, other: 0 },
    timeSpent: opts.daysUsed ?? 40, bankRefusals: opts.bankRefusals ?? 0,
  } as never);
  const rng = vi.spyOn(Math, 'random').mockReturnValue(0.99);
  try { await s.turnService.startTurn(pid); } finally { rng.mockRestore(); }
  s.stateService.updateTempState(pid, { timeSpent: opts.daysUsed ?? 40 });
}

const bigCard = () => s.dataService.getCardsByType('B').reduce((a, c) => (parseInt(c.loan_amount as string, 10) > parseInt(a.loan_amount as string, 10) ? c : a)).card_id;
const bCard = (amount: string, rate: string) =>
  s.dataService.getCardsByType('B').find(c => c.loan_amount === amount && c.loan_rate === rate)!.card_id;

afterEach(() => vi.restoreAllMocks());

describe('robot banker in the engine', () => {
  it('a comfortable loan is lent and its schedule is stored next to the loan record', async () => {
    await atBank({ cash: 260_000 });
    const before = s.stateService.getPlayer(pid)!.money;
    await s.cardService.applyCardEffects(pid, bCard('500000', '5'));
    const p = s.stateService.getPlayer(pid)!;
    expect(p.lastBankerDecision?.answer).not.toBe('refuse');
    expect(p.money).toBeGreaterThan(before - 1);
    const loan = p.loans[p.loans.length - 1];
    expect(loan.plannedDays).toBeGreaterThan(0);
    expect(loan.daysAtLoan).toBe(40);
    expect(loan.interest).toBeGreaterThan(0);
  });

  it('a refusal moves no money, takes no loan, and is counted', async () => {
    await atBank({ daysUsed: 5000 });
    const before = s.stateService.getPlayer(pid)!;
    await s.cardService.applyCardEffects(pid, bigCard());
    const p = s.stateService.getPlayer(pid)!;
    expect(p.lastBankerDecision?.answer).toBe('refuse');
    expect(p.lastBankerDecision?.reasons.length).toBeGreaterThan(0);
    expect(p.loans.length).toBe(before.loans.length);
    expect(p.money).toBe(before.money);
    expect(p.bankRefusals).toBe(1);
  });

  it('after the second refusal the only way on is the investor, who cannot refuse', async () => {
    await atBank({ daysUsed: 5000, bankRefusals: 1 });
    await s.cardService.applyCardEffects(pid, bigCard());
    const p = s.stateService.getPlayer(pid)!;
    expect(p.bankRefusals).toBe(2);
    expect(p.lastBankerDecision?.final).toBe(true);
    const moves = await s.movementService.getValidMoves(pid);
    expect(moves).toEqual(['INVESTOR-FUND-REVIEW']);
  });

  it('a push-back does not forget the refusals', async () => {
    await atBank({ daysUsed: 5000 });
    await s.cardService.applyCardEffects(pid, bigCard());
    await s.turnService.tryAgainOnSpace?.(pid).catch(() => undefined);
    expect(s.stateService.getPlayer(pid)!.bankRefusals).toBe(1);
  });

  async function finishWith(loans: unknown[]) {
    await atBank();
    s.stateService.updatePlayer({ id: pid, loans, currentSpace: 'FINISH', timeSpent: 700, money: 5_000_000 } as never);
    await s.turnService.endTurnWithMovement(true);
    return s.stateService.getPlayer(pid)!;
  }

  it('the finish settles against the schedule from the loan: more than twice the plan costs 2% of the loan', async () => {
    const without = await finishWith([]);
    const loan = { id: 'l1', principal: 1_000_000, interestRate: 0, startTurn: 1, plannedDays: 300, daysAtLoan: 40, interest: 100_000 };
    const withLoan = await finishWith([loan]);
    expect(withLoan.finishedAtTurn).toBeDefined();
    expect(withLoan.loans[0].settled).toBe(true);
    expect(without.money - withLoan.money).toBe(20_000);
  });
});
