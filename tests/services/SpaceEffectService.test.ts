import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpaceEffectService } from '../../src/services/SpaceEffectService';
import { DiceService } from '../../src/services/DiceService';
import { IStateService, ICardService, IResourceService, IGameRulesService } from '../../src/types/ServiceContracts';
import { DiceEffect, SpaceEffect } from '../../src/types/DataTypes';
import { GameState, Player } from '../../src/types/StateTypes';

describe('SpaceEffectService', () => {
  let spaceEffectService: SpaceEffectService;
  let mockStateService: IStateService;
  let mockCardService: ICardService;
  let mockResourceService: IResourceService;
  let mockGameRulesService: IGameRulesService;
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
      addTime: vi.fn().mockReturnValue(true),
      spendTime: vi.fn().mockReturnValue(true)
    } as unknown as IResourceService;

    mockGameRulesService = {
      calculateProjectScope: vi.fn().mockReturnValue(4000000)
    } as unknown as IGameRulesService;

    spaceEffectService = new SpaceEffectService(
      mockStateService,
      mockCardService,
      mockResourceService,
      mockGameRulesService,
      diceService
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
    it('should log quality effect and return game state', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      spaceEffectService.applyQualityEffect('player1', 'High');

      expect(consoleSpy).toHaveBeenCalledWith('Player player1 quality level: High');
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

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          money: 1005000 // 1000000 + 5000
        })
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

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          money: 997000 // 1000000 - 3000
        })
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

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          money: 900000 // 1000000 - 10%
        })
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
