import { describe, it, expect } from 'vitest';
import { StateService } from '../../src/services/StateService';
import { todayIso } from '../../src/utils/gameClock';

describe('game start date', () => {
  it('is stored once, as today, when the game goes to PLAY', () => {
    const s = new StateService({ getGameConfig: () => [], getCards: () => [] } as never, {} as never);
    expect(s.getGameState().gameStartDate).toBeUndefined();
    s.setGamePhase('PLAY');
    expect(s.getGameState().gameStartDate).toBe(todayIso());
  });
});
