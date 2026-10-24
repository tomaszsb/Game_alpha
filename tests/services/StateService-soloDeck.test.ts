// v3.8.57: a SOLO game's expeditor deck leaves out the cards that ADD days (Tom, 2026-10-23, TODO "Decisions
// waiting on Tom" 2b). A group game keeps the full deck. Only the deck changes.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateService, addsDays } from '../../src/services/StateService';
import { createMockDataService } from '../mocks/mockServices';

const E = [
  { card_id: 'E001', card_type: 'E', tick_modifier: '-3' },
  { card_id: 'E002', card_type: 'E', tick_modifier: '2' },   // adds days
  { card_id: 'E003', card_type: 'E', tick_modifier: '-1' },
  { card_id: 'E004', card_type: 'E', tick_modifier: '' },    // no day effect: stays
  { card_id: 'E005', card_type: 'E', tick_modifier: '5' },   // adds days
];
const W = [{ card_id: 'W001', card_type: 'W' }, { card_id: 'W002', card_type: 'W' }];

function makeService(players: number, mode?: 'BATTLE_ROYALE' | 'SAME_START') {
  const data: any = createMockDataService();
  data.isLoaded.mockReturnValue(true);
  data.getGameConfig.mockReturnValue([{ space_name: 'OWNER-SCOPE-INITIATION', is_starting_space: true, min_players: 1, max_players: 4 }] as any);
  data.getMovement.mockReturnValue(undefined);
  data.getCardsByType.mockImplementation((t: string) => (t === 'E' ? E : t === 'W' ? W : []));
  const s = new StateService(data);
  for (let i = 1; i <= players; i++) s.addPlayer(`P${i}`);
  return s.startGame(mode ? { gameMode: mode } as any : undefined);
}

describe('solo expeditor deck', () => {
  it('addsDays reads the card\'s own tick_modifier', () => {
    expect(addsDays({ tick_modifier: '2' })).toBe(true);
    expect(addsDays({ tick_modifier: '-3' })).toBe(false);
    expect(addsDays({ tick_modifier: '' })).toBe(false);
    expect(addsDays({})).toBe(false);
  });

  it('a one-player game has none of the day-adding expeditors in the deck, and keeps the rest', () => {
    const state = makeService(1);
    expect([...state.decks.E].sort()).toEqual(['E001', 'E003', 'E004']);
    expect([...state.decks.W].sort()).toEqual(['W001', 'W002']); // other decks untouched
  });

  it('a two-player game still has all of them', () => {
    const state = makeService(2);
    expect([...state.decks.E].sort()).toEqual(['E001', 'E002', 'E003', 'E004', 'E005']);
  });

  it('same-start mode: the solo player\'s own deck leaves them out, a group player\'s deck keeps them', () => {
    const solo = makeService(1, 'SAME_START');
    const only = Object.values(solo.playerDecks!)[0];
    expect([...only.E].sort()).toEqual(['E001', 'E003', 'E004']);
    const group = makeService(3, 'SAME_START');
    for (const d of Object.values(group.playerDecks!)) expect([...d.E].sort()).toEqual(['E001', 'E002', 'E003', 'E004', 'E005']);
  });
});
