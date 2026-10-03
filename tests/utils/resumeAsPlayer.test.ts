// Picker ordering behind "Resume as <name>": the remembered player is first only when the game's
// roster still has them; gone player / no memory leaves the picker exactly as it was.
import { describe, it, expect } from 'vitest';
import { orderPickerPlayers, isRememberedPlayer, type JoinPickerPlayer } from '../../src/utils/joinGameFlow';

const roster = (): JoinPickerPlayer[] => [
  { id: 'p1', shortId: 'aa11', name: 'Ann' },
  { id: 'p2', shortId: 'bb22', name: 'Bo' },
  { id: 'p3', shortId: 'cc33', name: 'Cy' },
] as JoinPickerPlayer[];

describe('orderPickerPlayers', () => {
  it('puts the remembered player first, others keep their order', () => {
    const out = orderPickerPlayers(roster(), 'cc33');
    expect(out.map(p => p.name)).toEqual(['Cy', 'Ann', 'Bo']);
    expect(isRememberedPlayer(roster(), 'cc33', roster()[2])).toBe(true);
  });
  it('remembered player gone from the game: picker unchanged', () => {
    expect(orderPickerPlayers(roster(), 'zz99').map(p => p.name)).toEqual(['Ann', 'Bo', 'Cy']);
    expect(roster().some(p => isRememberedPlayer(roster(), 'zz99', p))).toBe(false);
  });
  it('no remembered player: picker unchanged', () => {
    expect(orderPickerPlayers(roster(), undefined).map(p => p.name)).toEqual(['Ann', 'Bo', 'Cy']);
  });
});
