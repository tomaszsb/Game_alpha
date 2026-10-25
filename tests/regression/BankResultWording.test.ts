// What the bank's pop-up and log SAY about the loan must match what the bank did (Tom, 2026-10-25: "bank
// pop up shows fine but funding did not show or get added"). A refusal moved no money - correctly - but
// the result line still read "Secured a Bank Loan" and never named the amount.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { bootstrapHeadlessServices, HeadlessServices } from '../ghost/bootstrapServices';

const BANK = 'BANK-FUND-REVIEW';
let s: HeadlessServices;
let pid: string;

async function atBank(opts: { daysUsed?: number; cash?: number }) {
  s = await bootstrapHeadlessServices();
  s.stateService.addPlayer('Wording Test');
  pid = s.stateService.getAllPlayers()[0].id;
  s.stateService.setCurrentPlayer(pid);
  s.stateService.startGame();
  const w = s.dataService.getCardsByType('W').slice(0, 2).map(c => c.card_id);
  s.stateService.updatePlayer({
    id: pid, currentSpace: BANK, visitType: 'First', visitedSpaces: [BANK], hand: w,
    money: opts.cash ?? 100_000, moneySources: { ownerFunding: opts.cash ?? 100_000, bankLoans: 0, investmentDeals: 0, other: 0 },
    timeSpent: opts.daysUsed ?? 40, bankRefusals: 0,
  } as never);
  const rng = vi.spyOn(Math, 'random').mockReturnValue(0.99);
  try { await s.turnService.startTurn(pid); } finally { rng.mockRestore(); }
  s.stateService.updateTempState(pid, { timeSpent: opts.daysUsed ?? 40 });
}

afterEach(() => vi.restoreAllMocks());

describe('the bank result line tells what the bank did', () => {
  it('a refusal says no loan was made', async () => {
    await atBank({ daysUsed: 5000 });
    const r = await s.turnService.triggerManualEffectWithFeedback(pid, 'cards:draw_B');
    const p = s.stateService.getPlayer(pid)!;
    expect(p.lastBankerDecision?.answer).toBe('refuse');
    const line = r.effects.map(e => e.description).join(' | ');
    expect(line).not.toMatch(/Secured/);
    expect(line).toMatch(/no loan/i);
  });

  it('an approved loan names the money that arrived', async () => {
    await atBank({ cash: 260_000 });
    const before = s.stateService.getPlayer(pid)!.money;
    const r = await s.turnService.triggerManualEffectWithFeedback(pid, 'cards:draw_B');
    const p = s.stateService.getPlayer(pid)!;
    expect(p.lastBankerDecision?.answer).not.toBe('refuse');
    const gained = p.moneySources.bankLoans;
    expect(gained).toBeGreaterThan(0);
    expect(p.money).toBeGreaterThan(before);
    const line = r.effects.map(e => e.description).join(' | ');
    expect(line).toContain(`$${gained.toLocaleString()}`);
  });
});
