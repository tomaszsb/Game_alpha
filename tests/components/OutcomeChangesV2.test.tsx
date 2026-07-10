/**
 * OutcomeChangesV2.test.tsx
 *
 * The new-view "what just happened" before→after block. Covers the pure
 * builders (numeric rows + named card changes) and a render smoke test.
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import {
  buildResourceRows,
  buildCardChanges,
  buildCardChangesFromSnapshot,
  filterLedgerCardChanges,
  OutcomeChangesV2,
  type ResolveCard,
} from '../../src/components/player/OutcomeChangesV2';
import type { ResourceSnapshot, DiceResultEffect } from '../../src/types/StateTypes';

const snap = (over: Partial<ResourceSnapshot> = {}): ResourceSnapshot => ({
  money: 0,
  projectScope: 0,
  timeSpent: 0,
  handCount: 0,
  cardCountsByType: { W: 0, B: 0, E: 0, I: 0, L: 0 },
  ...over,
});

const cards: Record<string, { name: string; type: string }> = {
  E1: { name: 'Zoning Expeditor', type: 'E' },
  E2: { name: 'Sprinkler Expeditor', type: 'E' },
  W1: { name: 'Water Mains', type: 'W' },
};
const resolveCard: ResolveCard = (id) => cards[id] ?? null;

afterEach(() => cleanup());

describe('buildResourceRows', () => {
  it('emits only the figures that changed', () => {
    const rows = buildResourceRows(snap({ money: 120000 }), snap({ money: 80000 }));
    expect(rows.map((r) => r.key)).toEqual(['money']);
    const [m] = rows;
    expect(m.beforeText).toBe('$120K');
    expect(m.afterText).toBe('$80K');
    expect(m.deltaText).toBe('−$40K');
    expect(m.isGain).toBe(false);
  });

  it('marks money going up as a gain, scope as neutral', () => {
    const [money] = buildResourceRows(snap({ money: 0 }), snap({ money: 50000 }));
    expect(money.isGain).toBe(true);
    const [scope] = buildResourceRows(snap({ projectScope: 0 }), snap({ projectScope: 50000 }));
    expect(scope.isGain).toBe(false); // more work taken on ≠ good news
  });

  it('treats fewer days as the gain direction (time up is bad)', () => {
    const [up] = buildResourceRows(snap({ timeSpent: 10 }), snap({ timeSpent: 14 }));
    expect(up.deltaText).toBe('+4 days');
    expect(up.isGain).toBe(false);
    const [down] = buildResourceRows(snap({ timeSpent: 14 }), snap({ timeSpent: 13 }));
    expect(down.deltaText).toBe('−1 day');
    expect(down.isGain).toBe(true);
  });

  it('returns nothing when no figure changed', () => {
    expect(buildResourceRows(snap({ money: 100 }), snap({ money: 100 }))).toEqual([]);
  });
});

describe('buildCardChanges', () => {
  it('names the exact cards lost from the effect payload (the "which one?" ask)', () => {
    const effects: DiceResultEffect[] = [
      { type: 'cards', description: 'lost two expeditors', cardAction: 'remove', cardCount: 2, cardType: 'E', cardIds: ['E1', 'E2'] },
    ];
    const changes = buildCardChanges(effects, resolveCard);
    expect(changes).toEqual([
      { action: 'lost', type: 'E', name: 'Zoning Expeditor', count: 1 },
      { action: 'lost', type: 'E', name: 'Sprinkler Expeditor', count: 1 },
    ]);
  });

  it('maps give/return to lost and draw to gained and replace to swapped', () => {
    const effects: DiceResultEffect[] = [
      { type: 'cards', description: 'drew', cardAction: 'draw', cardIds: ['W1'] },
      { type: 'cards', description: 'gave', cardAction: 'give', cardIds: ['E1'] },
      { type: 'cards', description: 'swapped', cardAction: 'replace', cardIds: ['E2'] },
    ];
    expect(buildCardChanges(effects, resolveCard).map((c) => c.action)).toEqual([
      'gained',
      'lost',
      'swapped',
    ]);
  });

  it('degrades to a generic count row when the payload carries no ids', () => {
    const effects: DiceResultEffect[] = [
      { type: 'cards', description: 'lost', cardAction: 'remove', cardCount: 2, cardType: 'E', cardIds: [] },
    ];
    expect(buildCardChanges(effects, resolveCard)).toEqual([
      { action: 'lost', type: 'E', name: null, count: 2 },
    ]);
  });

  it('ignores non-card effects and returns [] for undefined', () => {
    const effects: DiceResultEffect[] = [
      { type: 'money', description: 'paid', value: -100 },
      { type: 'choice', description: 'pick' },
    ];
    expect(buildCardChanges(effects, resolveCard)).toEqual([]);
    expect(buildCardChanges(undefined, resolveCard)).toEqual([]);
  });
});

describe('buildCardChangesFromSnapshot (legacy fallback)', () => {
  it('diffs per-type counts into generic gained/lost rows', () => {
    const before = snap({ cardCountsByType: { W: 1, B: 0, E: 3, I: 0, L: 0 } });
    const after = snap({ cardCountsByType: { W: 2, B: 0, E: 1, I: 0, L: 0 } });
    expect(buildCardChangesFromSnapshot(before, after)).toEqual([
      { action: 'gained', type: 'W', name: null, count: 1 },
      { action: 'lost', type: 'E', name: null, count: 2 },
    ]);
  });
});

describe('filterLedgerCardChanges', () => {
  it('drops named gains but keeps unnamed gains and all losses/swaps', () => {
    const changes = [
      { action: 'gained' as const, type: 'W', name: 'Water Mains', count: 1 },
      { action: 'gained' as const, type: 'E', name: null, count: 2 },
      { action: 'lost' as const, type: 'E', name: 'Zoning Expeditor', count: 1 },
      { action: 'swapped' as const, type: 'I', name: 'Bond', count: 1 },
    ];
    expect(filterLedgerCardChanges(changes)).toEqual([
      { action: 'gained', type: 'E', name: null, count: 2 },
      { action: 'lost', type: 'E', name: 'Zoning Expeditor', count: 1 },
      { action: 'swapped', type: 'I', name: 'Bond', count: 1 },
    ]);
  });
});

describe('OutcomeChangesV2 render', () => {
  it('renders nothing when both snapshots are absent', () => {
    const { container } = render(
      <OutcomeChangesV2 before={undefined} after={undefined} resolveCard={resolveCard} mode="light" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the numeric delta and names the lost expeditor', () => {
    render(
      <OutcomeChangesV2
        before={snap({ money: 120000, cardCountsByType: { W: 0, B: 0, E: 2, I: 0, L: 0 } })}
        after={snap({ money: 80000, cardCountsByType: { W: 0, B: 0, E: 1, I: 0, L: 0 } })}
        effects={[
          { type: 'cards', description: 'lost one', cardAction: 'remove', cardCount: 1, cardType: 'E', cardIds: ['E1'] },
        ]}
        resolveCard={resolveCard}
        mode="light"
      />,
    );
    expect(screen.getByTestId('outcome-changes-v2')).toBeInTheDocument();
    expect(screen.getByText('Cash on hand')).toBeInTheDocument();
    expect(screen.getByText('−$40K')).toBeInTheDocument();
    expect(screen.getByText('Lost:')).toBeInTheDocument();
    expect(screen.getByText('Zoning Expeditor')).toBeInTheDocument();
  });

  it('does not repeat a named gained card in the ledger (already named by the effect-row chip above it)', () => {
    render(
      <OutcomeChangesV2
        before={snap({ money: 120000, cardCountsByType: { W: 0, B: 0, E: 0, I: 0, L: 0 } })}
        after={snap({ money: 80000, cardCountsByType: { W: 1, B: 0, E: 0, I: 0, L: 0 } })}
        effects={[
          { type: 'cards', description: 'drew one', cardAction: 'draw', cardCount: 1, cardType: 'W', cardIds: ['W1'] },
        ]}
        resolveCard={resolveCard}
        mode="light"
      />,
    );
    // The resource delta still shows...
    expect(screen.getByText('Cash on hand')).toBeInTheDocument();
    // ...but the named gain does not get a second "Gained:" ledger line.
    expect(screen.queryByText('Gained:')).not.toBeInTheDocument();
    expect(screen.queryByText('Water Mains')).not.toBeInTheDocument();
  });

  it('still shows a generic (unnamed) gained count in the ledger — it has no effect-row chip to duplicate', () => {
    render(
      <OutcomeChangesV2
        before={snap({ money: 120000 })}
        after={snap({ money: 80000 })}
        effects={[
          { type: 'cards', description: 'drew two', cardAction: 'draw', cardCount: 2, cardType: 'E', cardIds: [] },
        ]}
        resolveCard={resolveCard}
        mode="light"
      />,
    );
    expect(screen.getByText('Gained:')).toBeInTheDocument();
    expect(screen.getByText('2 Expeditors')).toBeInTheDocument();
  });

  it('renders nothing when the only change is a named gain and no resource figure moved (fully covered by the effect row above)', () => {
    const { container } = render(
      <OutcomeChangesV2
        before={snap({ cardCountsByType: { W: 0, B: 0, E: 0, I: 0, L: 0 } })}
        after={snap({ cardCountsByType: { W: 0, B: 0, E: 1, I: 0, L: 0 } })}
        effects={[
          { type: 'cards', description: 'hired one', cardAction: 'draw', cardCount: 1, cardType: 'E', cardIds: ['E1'] },
        ]}
        resolveCard={resolveCard}
        mode="light"
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
