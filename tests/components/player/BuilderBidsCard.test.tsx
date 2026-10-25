import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
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

/** Press and keep holding for `ms`, then let go (the Hire button signs only after a full hold). */
async function holdFor(el: Element, ms: number) {
  fireEvent.pointerDown(el);
  await act(async () => { await new Promise(r => setTimeout(r, ms)); });
  fireEvent.pointerUp(el);
}

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
    await holdFor(screen.getAllByTestId('builder-bid-hire')[1], 700);
    await waitFor(() => expect(hire).toHaveBeenCalledWith('p1', 'bid-2'));
  });

  it('warns on exactly the bids the cash cannot cover, before anything is signed', () => {
    const { gs } = services(atDesk({ money: 1_000_000 })); // covers $900K and $1.0M, not $1.2M
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    const warnings = screen.getAllByTestId('builder-bid-short');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].textContent).toBe('Not enough money: get more from the lender first.');
    expect(warnings[0].className).toContain('uc-red-pulse'); // pulses so it is noticed
  });

  it('the Sign button of a builder dearer than the cash is greyed out and cannot be pressed; the others stay live', async () => {
    const { gs, hire } = services(atDesk({ money: 1_000_000 }));
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    const buttons = screen.getAllByTestId('builder-bid-hire') as HTMLButtonElement[];
    const prices = screen.getAllByTestId('builder-bid').map((el) => Number(el.getAttribute('data-price')));
    buttons.forEach((b, i) => expect(b.disabled, `bid ${i} at $${prices[i]}`).toBe(prices[i] > 1_000_000));
    const dear = buttons[prices.findIndex((x) => x > 1_000_000)];
    fireEvent.click(dear);
    await holdFor(dear, 2500);
    expect(hire).not.toHaveBeenCalled();
  });

  it('says nothing when the cash covers every bid', () => {
    const { gs } = services(atDesk({ money: 5_000_000 }));
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    expect(screen.queryByTestId('builder-bid-short')).toBeNull();
  });

  it('a tap does not hire: it says what a hold would do', async () => {
    const { gs, hire } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    const btn = screen.getAllByTestId('builder-bid-hire')[0];
    fireEvent.click(btn);
    await holdFor(btn, 200); // released long before the hold is full
    expect(hire).not.toHaveBeenCalled();
    expect(screen.getByTestId('builder-bid-hold-hint').textContent).toContain('Not signed yet. Keep holding');
    expect(screen.getByTestId('builder-bid-hold-hint').textContent).toContain('Press and hold');
  });

  it('a press cut short by the pointer leaving or being cancelled says it is not signed yet', async () => {
    const { gs, hire } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    const btns = screen.getAllByTestId('builder-bid-hire');
    fireEvent.pointerDown(btns[0]);
    fireEvent.pointerLeave(btns[0]);
    expect(screen.getByTestId('builder-bid-hold-hint').textContent).toContain('Not signed yet. Keep holding');
    fireEvent.pointerDown(btns[1]);
    fireEvent.pointerCancel(btns[1]);
    expect(hire).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('builder-bid-hold-hint').length).toBeGreaterThan(0);
  });

  it('on a phone the button itself says to hold', () => {
    const real = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
    const { gs } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    window.matchMedia = real;
    expect(screen.getAllByTestId('builder-bid-hire')[0].textContent).toContain('Hold to hire');
  });

  it('holding Enter hires, like holding the button', async () => {
    const { gs, hire } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    const btn = screen.getAllByTestId('builder-bid-hire')[0];
    fireEvent.keyDown(btn, { key: 'Enter' });
    await act(async () => { await new Promise(r => setTimeout(r, 700)); });
    fireEvent.keyUp(btn, { key: 'Enter' });
    await waitFor(() => expect(hire).toHaveBeenCalledWith('p1', 'bid-1'));
  });

  it('says so plainly when the prices changed under the player', async () => {
    const { gs } = services(atDesk(), { hireBuilderBid: vi.fn().mockResolvedValue({ success: false, reason: 'bids_changed', message: 'Those prices changed while you were deciding. Look at the new bids.' }) });
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    await holdFor(screen.getAllByTestId('builder-bid-hire')[0], 700);
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
    expect(t).toContain('Builder hired');
    expect(screen.getByTestId('builder-hired-next').textContent).toBe('Next: hire a special inspector.');
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

describe('BuilderBidsCard: the way back to the lender', () => {
  // Tom, 2026-10-25: "It is not clear what to do if you do not have enough money and want to go back and get more money."
  it('offers a button that picks the lender as the next stop, leaving the bids on the table', () => {
    const onToggle = vi.fn();
    const { gs, hire } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct door={{ picked: false, enabled: true, onToggle }} />);
    const go = screen.getByTestId('builder-go-lender');
    expect(go.textContent).toMatch(/lender/i);
    fireEvent.click(go);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(hire).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('builder-bid')).toHaveLength(3);
  });

  it('says plainly that the lender is next once picked, and is greyed while the move list is locked', () => {
    const { gs } = services(atDesk());
    const { rerender } = render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct door={{ picked: true, enabled: true, onToggle: () => {} }} />);
    expect(screen.getByTestId('builder-go-lender').textContent).toMatch(/hold End Turn/);
    rerender(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct door={{ picked: false, enabled: false, onToggle: () => {} }} />);
    expect((screen.getByTestId('builder-go-lender') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the old one-line note when there is no door to offer', () => {
    const { gs } = services(atDesk());
    render(<BuilderBidsCard gameServices={gs} playerId="p1" palette={p} canAct />);
    expect(screen.queryByTestId('builder-go-lender')).toBeNull();
    expect(screen.getByTestId('builder-bids').textContent).toMatch(/lender/i);
  });
});
