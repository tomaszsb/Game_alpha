import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpaceEffectService } from '../../src/services/SpaceEffectService';
import { DiceService } from '../../src/services/DiceService';
import { IStateService, ICardService, IResourceService, IGameRulesService, IDataService } from '../../src/types/ServiceContracts';
import { DiceEffect, SpaceEffect } from '../../src/types/DataTypes';
import { GameState, Player } from '../../src/types/StateTypes';

// Make debug functions always call through to console (bypass debug gate)
vi.mock('../../src/utils/debugLog', () => ({
  debugLog: (...args: unknown[]) => console.log(...args),
  debugWarn: (...args: unknown[]) => console.warn(...args),
  debugDebug: (...args: unknown[]) => console.debug(...args),
  resetDebugCache: () => {},
}));

describe('SpaceEffectService', () => {
  let spaceEffectService: SpaceEffectService;
  let mockStateService: IStateService;
  let mockCardService: ICardService;
  let mockResourceService: IResourceService;
  let mockGameRulesService: IGameRulesService;
  let mockDataService: IDataService;
  let diceService: DiceService;

  const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
    id: 'player1',
    name: 'Test Player',
    money: 1000000,
    timeSpent: 10,
    currentSpace: 'TEST-SPACE',
    visitType: 'First',
    cards: { W: [], B: [], E: [], L: [], I: [] },
    ...overrides
  } as Player);

  const createMockGameState = (players: Player[] = []): GameState => ({
    players: players.length > 0 ? players : [createMockPlayer()],
    currentPlayerId: 'player1',
    gamePhase: 'PLAY',
    globalTurnCount: 1,
    hasPlayerMovedThisTurn: false,
    hasPlayerRolledDice: false,
    playerTurnCounts: {}
  } as GameState);

  beforeEach(() => {
    diceService = new DiceService();

    mockStateService = {
      getPlayer: vi.fn().mockReturnValue(createMockPlayer()),
      getGameState: vi.fn().mockReturnValue(createMockGameState()),
      updatePlayer: vi.fn().mockReturnValue(createMockGameState())
    } as unknown as IStateService;

    mockCardService = {
      drawCards: vi.fn().mockReturnValue(['card1']),
      getPlayerCards: vi.fn().mockReturnValue(['card1', 'card2']),
      discardCards: vi.fn()
    } as unknown as ICardService;

    mockResourceService = {
      addMoney: vi.fn().mockReturnValue(true),
      spendMoney: vi.fn().mockReturnValue(true),
      canAfford: vi.fn().mockReturnValue(true),
      addTime: vi.fn().mockReturnValue(true),
      spendTime: vi.fn().mockReturnValue(true)
    } as unknown as IResourceService;

    mockGameRulesService = {
      calculateProjectScope: vi.fn().mockReturnValue(4000000),
      calculateTotalWorkCost: vi.fn().mockReturnValue(100000)
    } as unknown as IGameRulesService;

    // Workstream 6 #7: data-driven design fee detection. The "design fee
    // space" tests use ARCH-FEE-REVIEW; mock the helpers to return that
    // space's flagged values, default flat for everything else.
    mockDataService = {
      getFeeCalculationMethod: vi.fn((spaceName: string) =>
        spaceName === 'ARCH-FEE-REVIEW' || spaceName === 'ENG-FEE-REVIEW'
          ? 'percentage_of_scope'
          : 'flat'
      ),
      getFeeLabel: vi.fn((spaceName: string) =>
        spaceName === 'ARCH-FEE-REVIEW' ? 'Architect'
          : spaceName === 'ENG-FEE-REVIEW' ? 'Engineer'
          : ''
      ),
    } as unknown as IDataService;

    spaceEffectService = new SpaceEffectService(
      mockStateService,
      mockCardService,
      mockResourceService,
      mockGameRulesService,
      diceService,
      mockDataService
    );
  });


  describe('applySpaceMoneyEffect', () => {
    it('should add money for add action', () => {
      const effect: any = {
        space_name: 'TEST',
        visit_type: 'First',
        trigger_type: 'auto',
        effect_type: 'money',
        effect_action: 'add',
        effect_value: 5000
      };

      spaceEffectService.applySpaceMoneyEffect('player1', effect);

      expect(mockResourceService.addMoney).toHaveBeenCalledWith(
        'player1', 5000, 'space_effect', expect.any(String)
      );
    });

    it('should subtract money for subtract action', () => {
      const effect: any = {
        space_name: 'TEST',
        visit_type: 'First',
        trigger_type: 'auto',
        effect_type: 'money',
        effect_action: 'subtract',
        effect_value: 3000
      };

      spaceEffectService.applySpaceMoneyEffect('player1', effect);

      expect(mockResourceService.canAfford).toHaveBeenCalledWith('player1', 3000);
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1', 3000, 'space_effect', expect.any(String)
      );
    });

    it('should spend remaining balance when subtract exceeds funds', () => {
      const poorPlayer = createMockPlayer({ money: 500 });
      (mockStateService.getPlayer as ReturnType<typeof vi.fn>).mockReturnValue(poorPlayer);
      (mockResourceService.canAfford as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const effect: any = {
        space_name: 'TEST',
        visit_type: 'First',
        trigger_type: 'auto',
        effect_type: 'money',
        effect_action: 'subtract',
        effect_value: 3000
      };

      spaceEffectService.applySpaceMoneyEffect('player1', effect);

      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1', 500, 'space_effect', expect.any(String)
      );
    });

    it('should apply percentage fee for fee_percent action', () => {
      const effect: any = {
        space_name: 'TEST',
        visit_type: 'First',
        trigger_type: 'auto',
        effect_type: 'money',
        effect_action: 'fee_percent',
        effect_value: 10
      };

      spaceEffectService.applySpaceMoneyEffect('player1', effect);

      // 10% of 1,000,000 = 100,000
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1', 100000, 'space_effect', expect.any(String)
      );
    });
  });

  describe('applySpaceTimeEffect', () => {
    it('should add time for add action', () => {
      const effect: any = {
        space_name: 'TEST',
        visit_type: 'First',
        trigger_type: 'auto',
        effect_type: 'time',
        effect_action: 'add',
        effect_value: 5
      };

      spaceEffectService.applySpaceTimeEffect('player1', effect);

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          timeSpent: 15 // 10 + 5
        })
      );
    });
  });

  describe('getTargetPlayer', () => {
    it('should return player to the right for to_right condition', () => {
      const players = [
        createMockPlayer({ id: 'player1', name: 'Player 1' }),
        createMockPlayer({ id: 'player2', name: 'Player 2' }),
        createMockPlayer({ id: 'player3', name: 'Player 3' })
      ];
      vi.mocked(mockStateService.getGameState).mockReturnValue(createMockGameState(players));

      const target = spaceEffectService.getTargetPlayer('player1', 'to_right');

      expect(target?.id).toBe('player2');
    });

    it('should return player to the left for to_left condition', () => {
      const players = [
        createMockPlayer({ id: 'player1', name: 'Player 1' }),
        createMockPlayer({ id: 'player2', name: 'Player 2' }),
        createMockPlayer({ id: 'player3', name: 'Player 3' })
      ];
      vi.mocked(mockStateService.getGameState).mockReturnValue(createMockGameState(players));

      const target = spaceEffectService.getTargetPlayer('player1', 'to_left');

      expect(target?.id).toBe('player3'); // Wraps around
    });

    it('should wrap around for to_right at end of list', () => {
      const players = [
        createMockPlayer({ id: 'player1', name: 'Player 1' }),
        createMockPlayer({ id: 'player2', name: 'Player 2' }),
        createMockPlayer({ id: 'player3', name: 'Player 3' })
      ];
      vi.mocked(mockStateService.getGameState).mockReturnValue(createMockGameState(players));

      const target = spaceEffectService.getTargetPlayer('player3', 'to_right');

      expect(target?.id).toBe('player1'); // Wraps to first player
    });

    it('should return null for unknown condition', () => {
      const target = spaceEffectService.getTargetPlayer('player1', 'unknown');

      expect(target).toBeNull();
    });

    it('should return null for non-existent player', () => {
      const target = spaceEffectService.getTargetPlayer('invalid', 'to_right');

      expect(target).toBeNull();
    });
  });
});
