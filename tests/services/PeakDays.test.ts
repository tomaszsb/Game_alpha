import { describe, it, expect } from 'vitest';
import { StateService } from '../../src/services/StateService';
import { createMockDataService } from '../mocks/mockServices';

describe('peakDays', () => {
  it('remembers the most days a player has had and never goes down', () => {
    const data = createMockDataService();
    data.isLoaded.mockReturnValue(true);
    data.getGameConfig.mockReturnValue([{ space_name: 'OWNER-SCOPE-INITIATION', phase: 'SETUP', path_type: 'A', is_starting_space: true, is_ending_space: false, min_players: 1, max_players: 4, requires_dice_roll: false }]);
    data.getMovement.mockReturnValue(undefined);
    data.getCardsByType.mockReturnValue([]);
    const s = new StateService(data);
    s.addPlayer('Ann');
    const id = s.getAllPlayers()[0].id;
    expect(s.getPlayer(id)!.peakDays).toBeUndefined();
    s.updatePlayer({ id, timeSpent: 40 });
    expect(s.getPlayer(id)!.peakDays).toBe(40);
    s.updatePlayer({ id, timeSpent: 25 }); // a lucky event hands days back
    expect(s.getPlayer(id)!.timeSpent).toBe(25);
    expect(s.getPlayer(id)!.peakDays).toBe(40);
    s.updatePlayer({ id, timeSpent: 60, peakDays: 10 }); // an older value handed in does not lower it
    expect(s.getPlayer(id)!.peakDays).toBe(60);
    s.updatePlayer({ id, peakDays: 5 });
    expect(s.getPlayer(id)!.peakDays).toBe(60);
  });
});
