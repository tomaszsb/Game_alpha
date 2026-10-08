import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BuilderBidsCard, BuilderMoneyLine, isShoppingForBuilder } from '../../../src/components/player/BuilderBidsCard';
import { panelPalettes } from '../../../src/components/player/panelTheme';
import type { BuilderBidSet } from '../../../src/utils/builderBids';

afterEach(cleanup);

const p = panelPalettes.light;

function bidSet(over: Partial<BuilderBidSet> = {}): BuilderBidSet {
  return {
    planKey: 'k',
    nextId: 4,
    lapsed: [],
    bids: [
      { id: 'bid-1', quality: 'HIGH', roll: 2, price: 1_200_000, days: 16, guaranteeDays: 100, expiresDay: 180 },
      { id: 'bid-2', quality: 'LOW', roll: 5, price: 900_000, days: 65, guaranteeDays: 150, expiresDay: 230 },
      { id: 'bid-3', quality: 'MED', roll: 3, price: 1_000_000, days: 30, guaranteeDays: 120, expiresDay: 200 },
    ],
    ...over,
  };
}

function services(player: any, over: any = {}) {
  const hire = vi.fn().mockResolvedValue({ success: true });
  const ensure = vi.fn();
  return {
    hire, ensure,
    gs: {
      stateService: { getPlayer: () => player },
      gameRulesService: { calculateProjectScope: () => 1_000_000, calculateTotalWorkCost: () => 1_000_000 },
      turnService: { ensureBuilderBids: ensure, hireBuilderBid: hire, ...over },
    } as any,
  };
}

const atDesk = (extra: any = {}) => ({ id: 'p1', currentSpace: 'CON-INITIATION', visitType: 'First', timeSpent: 80, builderBids: bidSet(), ...extra });

describe('BuilderBidsCard', () => {
  it('shows one card per bid with its exact price and days, and keeps the quality out of sight', () => {
    const { gs } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    const cards = screen.getAllByTestId('builder-bid');
    expect(cards).toHaveLength(3);
    expect(cards[0].getAttribute('data-price')).toBe('1200000');
    expect(cards[0].getAttribute('data-days')).toBe('16');
    expect(cards[0].getAttribute('data-guarantee-days')).toBe('100');
    expect(cards[0].textContent).toContain('$1,200,000');
    expect(cards[0].textContent).toContain('16 days of work');
    expect(cards[0].textContent).toContain('through day 180');
    expect(cards[0].textContent).toContain('100 more days');
    // quality stays hidden until someone is hired
    expect(screen.getByTestId('builder-bids').textContent).not.toMatch(/\b(high|medium|low)\b/i);
    expect(screen.getAllByTestId('builder-bid-hire')).toHaveLength(3);
  });

  it('asks the engine to bring the bids up to date when it is the player\'s turn', async () => {
    const { gs, ensure } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    await waitFor(() => expect(ensure).toHaveBeenCalledWith('p1'));
  });

  it('never writes for someone who is only looking', () => {
    const { gs, ensure } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct={false} />);
    expect(ensure).not.toHaveBeenCalled();
    for (const b of screen.getAllByTestId('builder-bid-hire')) expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it('hiring sends the clicked bid\'s id', async () => {
    const { gs, hire } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    fireEvent.click(screen.getAllByTestId('builder-bid-hire')[1]);
    await waitFor(() => expect(hire).toHaveBeenCalledWith('p1', 'bid-2'));
  });

  it('says so plainly when the prices changed under the player', async () => {
    const { gs } = services(atDesk(), { hireBuilderBid: vi.fn().mockResolvedValue({ success: false, reason: 'bids_changed', message: 'Those prices changed while you were deciding. Look at the new bids.' }) });
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    fireEvent.click(screen.getAllByTestId('builder-bid-hire')[0]);
    expect((await screen.findByTestId('builder-bids-error')).textContent).toContain('prices changed');
  });

  it('says which price ran out, and why the new builder is there', () => {
    const lapsed = [{ reason: 'expired' as const, guaranteeDays: 100, price: 750_000, day: 80 }];
    const { gs } = services(atDesk({ builderBids: bidSet({ lapsed }) }));
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    const note = screen.getByTestId('builder-bids-lapsed').textContent!;
    expect(note).toContain('$750,000');
    expect(note).toContain('ran out after 100 days');
  });

  it('says when a changed plan voided the prices', () => {
    const lapsed = [1, 2, 3].map(() => ({ reason: 'plan_changed' as const, guaranteeDays: 100, price: 1, day: 80 }));
    const { gs } = services(atDesk({ builderBids: bidSet({ lapsed }) }));
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    expect(screen.getByTestId('builder-bids-lapsed').textContent).toContain('Your plan changed');
  });

  it('after the hire, reveals the quality and the deal', () => {
    const { gs } = services(atDesk({ contractor: { quality: 'LOW', multiplier: 5 }, builderBids: bidSet({ hiredId: 'bid-2' }) }));
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    const t = screen.getByTestId('builder-hired').textContent!;
    expect(t).toContain('$900,000');
    expect(t).toContain('65 days of work');
    expect(t).toContain('Low quality');
    expect(screen.queryByTestId('builder-bids')).toBeNull();
  });

  it('does not recap the hire on a later (change-order) visit', () => {
    const { gs } = services(atDesk({ visitType: 'Subsequent', contractor: { quality: 'LOW', multiplier: 5 }, builderBids: bidSet({ hiredId: 'bid-2' }) }));
    const { container } = render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    expect(container.textContent).toBe('');
  });

  it('shows nothing when every price has run out (the engine is about to replace them)', () => {
    const { gs } = services(atDesk({ timeSpent: 999 }));
    const { container } = render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    expect(container.textContent).toBe('');
  });
});

describe('isShoppingForBuilder', () => {
  it('is true only at the desk with nobody hired', () => {
    expect(isShoppingForBuilder(services(atDesk()).gs, 'p1')).toBe(true);
    expect(isShoppingForBuilder(services(atDesk({ contractor: { quality: 'MED', multiplier: 1 } })).gs, 'p1')).toBe(false);
    expect(isShoppingForBuilder(services(atDesk({ currentSpace: 'PM-DECISION-CHECK' })).gs, 'p1')).toBe(false);
  });
});

describe('BuilderMoneyLine (the line at the lender)', () => {
  const at = (space: string, extra: any = {}) => atDesk({ currentSpace: space, ...extra });

  it('names the cheapest price still held, its days and the day it stays good through', () => {
    const { gs } = services(at('LEND-SCOPE-CHECK'));
    render(<BuilderMoneyLine gameServices={gs} playerId="p1" palette={p} />);
    const t = screen.getByTestId('bank-bid-line').textContent!;
    expect(t).toContain('$900,000');
    expect(t).toContain('65 days of work');
    expect(t).toContain('through day 230');
    expect(t).toContain('you are on day 80');
    expect(t).toContain('if your plan stays the same');
  });

  it('with no bids yet, gives a rough figure that says it is a guess', () => {
    const { gs } = services(at('BANK-FUND-REVIEW', { builderBids: undefined }));
    render(<BuilderMoneyLine gameServices={gs} playerId="p1" palette={p} />);
    const t = screen.getByTestId('bank-bid-line').textContent!;
    expect(t).toContain('about $1,000,000');
    expect(t).toContain('rough guess');
  });

  it('is not shown away from the money stops, or once a builder is hired', () => {
    render(<BuilderMoneyLine gameServices={services(at('ARCH-INITIATION')).gs} playerId="p1" palette={p} />);
    expect(screen.queryByTestId('bank-bid-line')).toBeNull();
    cleanup();
    render(<BuilderMoneyLine gameServices={services(at('LEND-SCOPE-CHECK', { contractor: { quality: 'MED', multiplier: 1 } })).gs} playerId="p1" palette={p} />);
    expect(screen.queryByTestId('bank-bid-line')).toBeNull();
  });
});
