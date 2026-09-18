/**
 * "Who is to my left / right?" has ONE vocabulary. The CSV `condition` column
 * says `to_left` / `to_right`; the card-transfer handler had grown its own
 * `left` / `right` / `next_player` / `prev_player`. A `to_left` row therefore
 * passed the condition evaluator and then handed the card to the wrong side.
 * These tests pin the shared resolver both now use.
 */
import { describe, it, expect } from 'vitest';
import { neighborDirection, neighborOf } from '../../src/utils/playerNeighbor';

describe('neighborDirection', () => {
  it('maps every spelling of "left" and "right"', () => {
    for (const d of ['to_left', 'left', 'prev_player', 'TO_LEFT', ' Left ']) {
      expect(neighborDirection(d)).toBe('left');
    }
    for (const d of ['to_right', 'right', 'next_player', 'TO_RIGHT', ' Right ']) {
      expect(neighborDirection(d)).toBe('right');
    }
  });

  it('returns null for anything that is not a neighbour directive', () => {
    for (const d of [undefined, null, '', 'always', 'dice_roll_3', 'scope_gt_4m', 'per_200k', 'left_field']) {
      expect(neighborDirection(d as string | undefined)).toBeNull();
    }
  });
});

describe('neighborOf', () => {
  const table = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('right is the next seat, left the previous, both wrapping', () => {
    expect(neighborOf(table, 'a', 'right')?.id).toBe('b');
    expect(neighborOf(table, 'c', 'right')?.id).toBe('a');
    expect(neighborOf(table, 'a', 'left')?.id).toBe('c');
    expect(neighborOf(table, 'b', 'left')?.id).toBe('a');
  });

  it('with two players, left and right are the same person', () => {
    const two = [{ id: 'a' }, { id: 'b' }];
    expect(neighborOf(two, 'a', 'left')?.id).toBe('b');
    expect(neighborOf(two, 'a', 'right')?.id).toBe('b');
  });

  it('a solo player has no neighbour — never themselves', () => {
    expect(neighborOf([{ id: 'a' }], 'a', 'right')).toBeNull();
    expect(neighborOf([{ id: 'a' }], 'a', 'left')).toBeNull();
  });

  it('an unseated player id has no neighbour', () => {
    expect(neighborOf(table, 'zzz', 'right')).toBeNull();
  });
});
