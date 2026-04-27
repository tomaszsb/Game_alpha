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
    turn: 1,
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

  describe('applyDiceEffect', () => {
    it('should apply card effect for cards type', () => {
      const effect: DiceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        card_type: 'W',
        roll_1: 'Draw 2',
        roll_2: 'Draw 1',
        roll_3: 'No change',
        roll_4: 'Draw 1',
        roll_5: 'Draw 2',
        roll_6: 'Draw 3'
      };

      spaceEffectService.applyDiceEffect('player1', effect, 1, createMockGameState());

      expect(mockCardService.drawCards).toHaveBeenCalledWith(
        'player1',
        'W',
        2,
        'turn_effect',
        expect.any(String)
      );
    });

    it('should apply money effect for money type', () => {
      const effect: DiceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'money',
        roll_1: '500',
        roll_2: '1000',
        roll_3: 'No change',
        roll_4: '1500',
        roll_5: '2000',
        roll_6: '2500'
      };

      spaceEffectService.applyDiceEffect('player1', effect, 2, createMockGameState());

      expect(mockResourceService.addMoney).toHaveBeenCalledWith(
        'player1',
        1000,
        'turn_effect',
        expect.any(String),
        'other'
      );
    });

    it('should return current state for "No change" effect', () => {
      const effect: DiceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'money',
        roll_1: 'No change',
        roll_2: 'No change',
        roll_3: 'No change',
        roll_4: 'No change',
        roll_5: 'No change',
        roll_6: 'No change'
      };

      const initialState = createMockGameState();
      const result = spaceEffectService.applyDiceEffect('player1', effect, 3, initialState);

      expect(result).toBe(initialState);
      expect(mockResourceService.addMoney).not.toHaveBeenCalled();
    });
  });

  describe('applyCardEffect', () => {
    it('should draw cards for "Draw X" effect', () => {
      spaceEffectService.applyCardEffect('player1', 'W', 'Draw 3');

      expect(mockCardService.drawCards).toHaveBeenCalledWith(
        'player1',
        'W',
        3,
        'turn_effect',
        'Draw 3 W cards from space effect'
      );
    });

    it('should discard cards for "Remove X" effect', () => {
      spaceEffectService.applyCardEffect('player1', 'B', 'Remove 2');

      expect(mockCardService.discardCards).toHaveBeenCalledWith(
        'player1',
        ['card1', 'card2'],
        'turn_effect',
        expect.any(String)
      );
    });

    it('should replace cards for "Replace X" effect', () => {
      spaceEffectService.applyCardEffect('player1', 'E', 'Replace 1');

      expect(mockCardService.discardCards).toHaveBeenCalled();
      expect(mockCardService.drawCards).toHaveBeenCalled();
    });

    it('should throw error for non-existent player', () => {
      vi.mocked(mockStateService.getPlayer).mockReturnValue(null as any);

      expect(() => spaceEffectService.applyCardEffect('invalid', 'W', 'Draw 1'))
        .toThrow('Player invalid not found');
    });
  });

  describe('applyMoneyEffect', () => {
    it('should add money for positive fixed amount', () => {
      spaceEffectService.applyMoneyEffect('player1', '5000');

      expect(mockResourceService.addMoney).toHaveBeenCalledWith(
        'player1',
        5000,
        'turn_effect',
        expect.any(String),
        'other'
      );
    });

    it('should spend money for negative amount', () => {
      spaceEffectService.applyMoneyEffect('player1', '-3000');

      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1',
        3000,
        'turn_effect',
        expect.any(String)
      );
    });

    it('should calculate percentage of money for percentage effects', () => {
      const player = createMockPlayer({ money: 100000 });
      vi.mocked(mockStateService.getPlayer).mockReturnValue(player);

      spaceEffectService.applyMoneyEffect('player1', '10%');

      expect(mockResourceService.addMoney).toHaveBeenCalledWith(
        'player1',
        10000, // 10% of 100000
        'turn_effect',
        expect.any(String),
        'other'
      );
    });

    it('should calculate design fee based on project scope for fee spaces', () => {
      const player = createMockPlayer({ currentSpace: 'ARCH-FEE-REVIEW' });
      vi.mocked(mockStateService.getPlayer).mockReturnValue(player);
      vi.mocked(mockGameRulesService.calculateProjectScope).mockReturnValue(2000000);

      spaceEffectService.applyMoneyEffect('player1', '5%');

      // 5% of 2,000,000 = 100,000 (negative since it's a fee)
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1',
        100000,
        'turn_effect',
        expect.any(String)
      );
    });
  });

  describe('applyTimeEffect', () => {
    it('should add time for positive value', () => {
      spaceEffectService.applyTimeEffect('player1', '5');

      expect(mockResourceService.addTime).toHaveBeenCalledWith(
        'player1',
        5,
        'turn_effect',
        expect.any(String)
      );
    });

    it('should spend time for negative value', () => {
      spaceEffectService.applyTimeEffect('player1', '-3');

      expect(mockResourceService.spendTime).toHaveBeenCalledWith(
        'player1',
        3,
        'turn_effect',
        expect.any(String)
      );
    });
  });

  describe('applyQualityEffect', () => {
    it('should store contractor quality on player and return updated game state', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      spaceEffectService.applyQualityEffect('player1', 'HIGH');

      // Should update player with contractor info
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          contractor: expect.objectContaining({
            quality: 'HIGH'
          })
        })
      );
      consoleSpy.mockRestore();
    });

    it('should normalize quality values (MED, MEDIUM)', () => {
      spaceEffectService.applyQualityEffect('player1', 'medium');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          contractor: expect.objectContaining({
            quality: 'MED'
          })
        })
      );
    });

    it('should default to MED for unknown quality values', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      spaceEffectService.applyQualityEffect('player1', 'UNKNOWN');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          contractor: expect.objectContaining({
            quality: 'MED'
          })
        })
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('applyMultiplierEffect', () => {
    beforeEach(() => {
      // Mock gameRulesService.calculateTotalWorkCost to return a value
      mockGameRulesService.calculateTotalWorkCost = vi.fn().mockReturnValue(100000);
    });

    it('should store contractor multiplier on player', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      spaceEffectService.applyMultiplierEffect('player1', '3');

      // Should update player with contractor multiplier
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          contractor: expect.objectContaining({
            multiplier: 3
          })
        })
      );
      consoleSpy.mockRestore();
    });

    it('should default to multiplier 3 for invalid values', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      spaceEffectService.applyMultiplierEffect('player1', 'invalid');

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          contractor: expect.objectContaining({
            multiplier: 3
          })
        })
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should calculate and deduct construction costs', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock getPlayer to return player with contractor info after update
      const playerWithContractor = createMockPlayer({
        contractor: { quality: 'MED', multiplier: 4, hiredAt: 'TEST-SPACE' },
        expenditures: { design: 0, fees: 0, construction: 0 }
      });
      (mockStateService.getPlayer as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createMockPlayer()) // First call in applyMultiplierEffect
        .mockReturnValueOnce(playerWithContractor) // Call in calculateAndDeductConstructionCost
        .mockReturnValueOnce(playerWithContractor); // Call for updating expenditures

      spaceEffectService.applyMultiplierEffect('player1', '4');

      // Should call spendMoney from resourceService
      expect(mockResourceService.spendMoney).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('applySpaceMoneyEffect', () => {
    it('should add money for add action', () => {
      const effect: SpaceEffect = {
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
      const effect: SpaceEffect = {
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

      const effect: SpaceEffect = {
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
      const effect: SpaceEffect = {
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
      const effect: SpaceEffect = {
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
