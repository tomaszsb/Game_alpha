/**
 * CardEffectService.test.ts
 *
 * Tests for the CardEffectService which handles card-related space effects
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CardEffectService } from '../../src/services/CardEffectService';
import { ICardService, IStateService, IDataService, IChoiceService } from '../../src/types/ServiceContracts';
import { SpaceEffect } from '../../src/types/DataTypes';
import { Player, GameState } from '../../src/types/StateTypes';

describe('CardEffectService', () => {
  let cardEffectService: CardEffectService;
  let mockCardService: any;
  let mockStateService: any;
  let mockDataService: any;
  let mockChoiceService: any;
  let mockPlayer: Player;

  beforeEach(() => {
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'TEST-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 0,
      projectScope: 0,
      score: 0,
      color: '#007bff',
      avatar: '👤',
      hand: [],
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    };

    mockCardService = {
      drawCards: vi.fn().mockReturnValue(['card1', 'card2']),
      discardCards: vi.fn().mockReturnValue(true),
      replaceCard: vi.fn().mockReturnValue({} as GameState),
      transferCard: vi.fn().mockReturnValue({} as GameState),
      getPlayerCards: vi.fn().mockReturnValue([]),
      applyCardEffects: vi.fn().mockResolvedValue({} as GameState),
      finalizePlayedCard: vi.fn()
    };

    mockStateService = {
      getPlayer: vi.fn().mockReturnValue(mockPlayer),
      getGameState: vi.fn().mockReturnValue({
        players: [mockPlayer],
        currentPlayerId: 'player1',
        gamePhase: 'PLAY'
      } as GameState),
      clearAwaitingChoice: vi.fn()
    };

    mockDataService = {
      getCardById: vi.fn().mockReturnValue({ card_name: 'Test Card' })
    };

    mockChoiceService = {
      createChoice: vi.fn().mockResolvedValue('selected-card')
    };

    cardEffectService = new CardEffectService(
      mockCardService as ICardService,
      mockStateService as IStateService,
      mockDataService as IDataService,
      mockChoiceService as IChoiceService
    );
  });

  describe('isCardAction', () => {
    it('should return true for draw actions', () => {
      expect(cardEffectService.isCardAction('draw_w')).toBe(true);
      expect(cardEffectService.isCardAction('draw_b')).toBe(true);
      expect(cardEffectService.isCardAction('draw_e')).toBe(true);
      expect(cardEffectService.isCardAction('draw_l')).toBe(true);
      expect(cardEffectService.isCardAction('draw_i')).toBe(true);
    });

    it('should return true for replace actions', () => {
      expect(cardEffectService.isCardAction('replace_e')).toBe(true);
      expect(cardEffectService.isCardAction('replace_l')).toBe(true);
    });

    it('should return true for return actions', () => {
      expect(cardEffectService.isCardAction('return_e')).toBe(true);
      expect(cardEffectService.isCardAction('return_l')).toBe(true);
    });

    it('should return true for give and transfer actions', () => {
      expect(cardEffectService.isCardAction('give_e')).toBe(true);
      expect(cardEffectService.isCardAction('transfer')).toBe(true);
    });

    it('should return false for non-card actions', () => {
      expect(cardEffectService.isCardAction('add_money')).toBe(false);
      expect(cardEffectService.isCardAction('add_time')).toBe(false);
      expect(cardEffectService.isCardAction('unknown')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(cardEffectService.isCardAction('DRAW_W')).toBe(true);
      expect(cardEffectService.isCardAction('Draw_B')).toBe(true);
    });
  });

  describe('executeCardEffect - draw operations', () => {
    it('should draw W cards successfully', async () => {
      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_w',
        effect_value: '2',
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('player1', effect, 'cards:draw_w');

      expect(result.success).toBe(true);
      expect(mockCardService.drawCards).toHaveBeenCalledWith(
        'player1',
        'W',
        2,
        'manual_effect',
        'Manual action: Draw 2 W cards'
      );
    });

    it('should draw single card with correct pluralization', async () => {
      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_e',
        effect_value: '1',
        is_manual: false
      };

      await cardEffectService.executeCardEffect('player1', effect, 'cards:draw_e');

      expect(mockCardService.drawCards).toHaveBeenCalledWith(
        'player1',
        'E',
        1,
        'manual_effect',
        'Manual action: Draw 1 E card'
      );
    });

    it('should auto-play B cards at OWNER-FUND-INITIATION', async () => {
      mockPlayer.currentSpace = 'OWNER-FUND-INITIATION';
      mockCardService.drawCards.mockReturnValue(['fund-card-1']);

      const effect: SpaceEffect = {
        space_name: 'OWNER-FUND-INITIATION',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_b',
        effect_value: '1',
        is_manual: false
      };

      await cardEffectService.executeCardEffect('player1', effect, 'cards:draw_b');

      expect(mockCardService.applyCardEffects).toHaveBeenCalledWith('player1', 'fund-card-1');
      expect(mockCardService.finalizePlayedCard).toHaveBeenCalledWith('player1', 'fund-card-1');
    });

    it('should auto-play I cards at OWNER-FUND-INITIATION', async () => {
      mockPlayer.currentSpace = 'OWNER-FUND-INITIATION';
      mockCardService.drawCards.mockReturnValue(['invest-card-1']);

      const effect: SpaceEffect = {
        space_name: 'OWNER-FUND-INITIATION',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_i',
        effect_value: '1',
        is_manual: false
      };

      await cardEffectService.executeCardEffect('player1', effect, 'cards:draw_i');

      expect(mockCardService.applyCardEffects).toHaveBeenCalledWith('player1', 'invest-card-1');
      expect(mockCardService.finalizePlayedCard).toHaveBeenCalledWith('player1', 'invest-card-1');
    });
  });

  describe('executeCardEffect - replace operations', () => {
    it('should replace all cards when player has exactly the required amount', async () => {
      mockCardService.getPlayerCards.mockReturnValue(['e-card-1', 'e-card-2']);

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'replace_e',
        effect_value: '2',
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('player1', effect, 'cards:replace_e');

      expect(result.success).toBe(true);
      expect(mockCardService.discardCards).toHaveBeenCalled();
      expect(mockCardService.drawCards).toHaveBeenCalledWith(
        'player1',
        'E',
        2,
        'manual_effect',
        'Manual action: Replace 2 E cards - adding new cards'
      );
    });

    it('should create choice when player has multiple cards to choose from', async () => {
      mockCardService.getPlayerCards.mockReturnValue(['e-card-1', 'e-card-2', 'e-card-3']);

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'replace_e',
        effect_value: '1',
        is_manual: false
      };

      await cardEffectService.executeCardEffect('player1', effect, 'cards:replace_e');

      expect(mockChoiceService.createChoice).toHaveBeenCalledWith(
        'player1',
        'CARD_REPLACEMENT',
        'Choose 1 Expeditor to replace:',
        expect.any(Array),
        { newCardType: 'E', replaceCount: 1 }
      );
    });

    it('should return success with message when no cards to replace', async () => {
      mockCardService.getPlayerCards.mockReturnValue([]);

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'replace_e',
        effect_value: '1',
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('player1', effect, 'cards:replace_e');

      expect(result.success).toBe(true);
      expect(result.message).toBe('No E cards to replace');
    });
  });

  describe('executeCardEffect - return operations', () => {
    it('should return card directly when player has only one', async () => {
      mockCardService.getPlayerCards.mockReturnValue(['l-card-1']);

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'return_l',
        effect_value: '1',
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('player1', effect, 'cards:return_l');

      expect(result.success).toBe(true);
      expect(mockCardService.discardCards).toHaveBeenCalledWith(
        'player1',
        ['l-card-1'],
        'manual_effect',
        'Manual action: Return 1 L card'
      );
    });

    it('should create choice when returning from multiple cards', async () => {
      mockCardService.getPlayerCards.mockReturnValue(['e-card-1', 'e-card-2', 'e-card-3']);

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'return_e',
        effect_value: '1',
        is_manual: false
      };

      await cardEffectService.executeCardEffect('player1', effect, 'cards:return_e');

      expect(mockChoiceService.createChoice).toHaveBeenCalledWith(
        'player1',
        'CARD_SELECTION',
        'Select Expeditor to return (1 of 1):',
        expect.any(Array)
      );
    });
  });

  describe('executeCardEffect - give operations', () => {
    it('should give card to next player', async () => {
      const player2: Player = { ...mockPlayer, id: 'player2', name: 'Player 2' };
      mockStateService.getGameState.mockReturnValue({
        players: [mockPlayer, player2],
        currentPlayerId: 'player1',
        gamePhase: 'PLAY'
      });
      mockCardService.getPlayerCards.mockReturnValue(['e-card-1']);

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'give_e',
        effect_value: '1',
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('player1', effect, 'cards:give_e');

      expect(result.success).toBe(true);
      expect(mockCardService.transferCard).toHaveBeenCalledWith(
        'player1',
        'player2',
        'e-card-1',
        'manual_effect',
        'Manual action: Give E card to Player 2'
      );
    });

    it('should handle single player game gracefully', async () => {
      mockStateService.getGameState.mockReturnValue({
        players: [mockPlayer],
        currentPlayerId: 'player1',
        gamePhase: 'PLAY'
      });

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'give_e',
        effect_value: '1',
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('player1', effect, 'cards:give_e');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Cannot give card to self');
      expect(mockCardService.transferCard).not.toHaveBeenCalled();
    });
  });

  describe('executeCardEffect - transfer operations', () => {
    it('should transfer E card to target player based on direction', async () => {
      const player2: Player = { ...mockPlayer, id: 'player2', name: 'Player 2' };
      mockStateService.getGameState.mockReturnValue({
        players: [mockPlayer, player2],
        currentPlayerId: 'player1',
        gamePhase: 'PLAY'
      });

      // Player has E cards (transfer now specifically targets E cards)
      mockCardService.getPlayerCards.mockReturnValue(['e-card-1']);

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'transfer',
        effect_value: '1',
        condition: 'right', // Transfer to player on right
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('player1', effect, 'cards:transfer');

      expect(result.success).toBe(true);
      expect(mockCardService.getPlayerCards).toHaveBeenCalledWith('player1', 'E');
      expect(mockCardService.transferCard).toHaveBeenCalledWith(
        'player1',
        'player2',
        'e-card-1',
        'manual_effect',
        'Manual action: Transfer E card to Player 2'
      );
    });

    it('should return success with message when no E cards to transfer', async () => {
      const player2: Player = { ...mockPlayer, id: 'player2', name: 'Player 2' };
      mockStateService.getGameState.mockReturnValue({
        players: [mockPlayer, player2],
        currentPlayerId: 'player1',
        gamePhase: 'PLAY'
      });

      // Player has no E cards
      mockCardService.getPlayerCards.mockReturnValue([]);

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'transfer',
        effect_value: '1',
        condition: 'left',
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('player1', effect, 'cards:transfer');

      expect(result.success).toBe(true);
      expect(result.message).toBe('No E cards to transfer');
      expect(mockCardService.transferCard).not.toHaveBeenCalled();
    });
  });

  describe('executeCardEffect - error handling', () => {
    it('should return failure when player not found', async () => {
      mockStateService.getPlayer.mockReturnValue(null);

      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_w',
        effect_value: '1',
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('unknown', effect, 'cards:draw_w');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Player unknown not found');
    });

    it('should return failure for unknown action', async () => {
      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'unknown_action',
        effect_value: '1',
        is_manual: false
      };

      const result = await cardEffectService.executeCardEffect('player1', effect, 'cards:unknown');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown card action: unknown_action');
    });
  });

  describe('effect value parsing', () => {
    it('should parse numeric string value', async () => {
      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_w',
        effect_value: '3',
        is_manual: false
      };

      await cardEffectService.executeCardEffect('player1', effect, 'cards:draw_w');

      expect(mockCardService.drawCards).toHaveBeenCalledWith(
        'player1',
        'W',
        3,
        expect.any(String),
        expect.any(String)
      );
    });

    it('should parse descriptive string value like "Draw 2"', async () => {
      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_e',
        effect_value: 'Draw 2',
        is_manual: false
      };

      await cardEffectService.executeCardEffect('player1', effect, 'cards:draw_e');

      expect(mockCardService.drawCards).toHaveBeenCalledWith(
        'player1',
        'E',
        2,
        expect.any(String),
        expect.any(String)
      );
    });

    it('should handle numeric type value directly', async () => {
      const effect: SpaceEffect = {
        space_name: 'TEST',
        visit_type: 'First',
        effect_type: 'cards',
        effect_action: 'draw_l',
        effect_value: 4 as any,  // Numeric value
        is_manual: false
      };

      await cardEffectService.executeCardEffect('player1', effect, 'cards:draw_l');

      expect(mockCardService.drawCards).toHaveBeenCalledWith(
        'player1',
        'L',
        4,
        expect.any(String),
        expect.any(String)
      );
    });
  });
});
