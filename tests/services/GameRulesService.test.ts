// tests/services/GameRulesService.test.ts

import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameRulesService } from '../../src/services/GameRulesService';
import { IDataService, IStateService } from '../../src/types/ServiceContracts';
import { GameState, Player } from '../../src/types/StateTypes';
import { Movement, DiceOutcome, CardType, GameConfig } from '../../src/types/DataTypes';
import { createMockDataService, createMockStateService } from '../mocks/mockServices';

// Mock implementations using centralized creators
const mockDataService: any = createMockDataService();
const mockStateService: any = createMockStateService();

describe('GameRulesService', () => {
  let gameRulesService: GameRulesService;
  let mockPlayer: any;
  let mockGameState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    gameRulesService = new GameRulesService(mockDataService, mockStateService);
    
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'START-SPACE',
      visitType: 'First',
      money: 1000,
      timeSpent: 100,
      projectScope: 0,
    score: 0,
      hand: ['W_001', 'W_002', 'B_001', 'L_001'], // Combined cards from old availableCards
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    };

    mockGameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      isGameOver: false,
      requiredActions: 0,
      completedActions: 0,
      availableActionTypes: [],
      hasCompletedManualActions: false,
      activeNegotiation: null,
      globalActionLog: [],
      preSpaceEffectState: null,
      // New stateful deck properties
      decks: {
        W: ['W_003', 'W_004', 'W_005'],
        B: ['B_002', 'B_003'],
        E: ['E_001', 'E_002', 'E_003'],
        L: ['L_002', 'L_003'],
        I: ['I_001', 'I_002']
      },
      discardPiles: {
        W: [],
        B: [],
        E: [],
        L: [],
        I: []
      }
    };
  });

  describe('isMoveValid', () => {
    it('should return true for valid moves', () => {
      const mockMovement: Movement = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'VALID-DESTINATION',
        destination_2: 'ANOTHER-DESTINATION'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = gameRulesService.isMoveValid('player1', 'VALID-DESTINATION');

      expect(result).toBe(true);
    });

    it('should return false for invalid destinations', () => {
      const mockMovement: Movement = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        movement_type: 'fixed',
        destination_1: 'VALID-DESTINATION'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = gameRulesService.isMoveValid('player1', 'INVALID-DESTINATION');

      expect(result).toBe(false);
    });

    it('should return false when game is not in progress', () => {
      const inactiveGameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(inactiveGameState);

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should return false for non-existent players', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(undefined);

      const result = gameRulesService.isMoveValid('nonexistent', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should return false when no movement data exists', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(undefined);

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should handle dice movement type', () => {
      const mockMovement: Movement = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        movement_type: 'dice'
      };

      const mockDiceOutcome: DiceOutcome = {
        space_name: 'START-SPACE',
        visit_type: 'First',
        roll_1: 'DICE-DEST-1',
        roll_2: 'DICE-DEST-2',
        roll_3: 'DICE-DEST-1'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      const result = gameRulesService.isMoveValid('player1', 'DICE-DEST-1');

      expect(result).toBe(true);
    });

    it('should return empty destinations for none movement type', () => {
      const mockMovement: Movement = {
        space_name: 'END-SPACE',
        visit_type: 'First',
        movement_type: 'none'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should handle exceptions gracefully', () => {
      mockStateService.getGameState.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });
  });

  describe('canPlayCard', () => {
    it('should return true when all conditions are met', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayCard('player1', 'W_001');

      expect(result).toBe(true);
    });

    it('should return false when game is not in progress', () => {
      const inactiveGameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(inactiveGameState);

      const result = gameRulesService.canPlayCard('player1', 'W_001');

      expect(result).toBe(false);
    });

    it('should return false for non-existent players', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(undefined);

      const result = gameRulesService.canPlayCard('nonexistent', 'W_001');

      expect(result).toBe(false);
    });

    it('should return false when player does not own the card', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayCard('player1', 'W_999');

      expect(result).toBe(false);
    });

    it('should return false when card ID has invalid format', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayCard('player1', 'INVALID_CARD');

      expect(result).toBe(false);
    });

    it('should return false when not player turn (for cards requiring turn)', () => {
      const gameStateNotPlayerTurn = { ...mockGameState, currentPlayerId: 'player2' };
      mockStateService.getGameState.mockReturnValue(gameStateNotPlayerTurn);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayCard('player1', 'W_001');

      expect(result).toBe(false);
    });

    it('should handle different card types', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      expect(gameRulesService.canPlayCard('player1', 'B_001')).toBe(true);
      expect(gameRulesService.canPlayCard('player1', 'L_001')).toBe(true);
    });

    // fb:58277eca — E030 "Time Crunch" costs $8K via money_effect=-8000.
    // Before this check the Play button rendered, click silently failed.
    describe('affordability check (fb:58277eca)', () => {
      it('returns false when the card requires more money than the player has', () => {
        mockStateService.getGameState.mockReturnValue(mockGameState);
        const poorPlayer = { ...mockPlayer, money: 5000, hand: ['E_001'] };
        mockStateService.getPlayer.mockReturnValue(poorPlayer);
        mockDataService.getCardById.mockReturnValue({
          card_id: 'E_001',
          card_type: 'E',
          card_name: 'Time Crunch',
          money_effect: '-8000',
        } as any);

        expect(gameRulesService.canPlayCard('player1', 'E_001')).toBe(false);
      });

      it('returns true when the player has exactly enough money', () => {
        mockStateService.getGameState.mockReturnValue(mockGameState);
        const exactPlayer = { ...mockPlayer, money: 8000, hand: ['E_001'] };
        mockStateService.getPlayer.mockReturnValue(exactPlayer);
        mockDataService.getCardById.mockReturnValue({
          card_id: 'E_001',
          card_type: 'E',
          card_name: 'Time Crunch',
          money_effect: '-8000',
        } as any);

        expect(gameRulesService.canPlayCard('player1', 'E_001')).toBe(true);
      });

      it('returns true for cards with positive money_effect regardless of player balance', () => {
        mockStateService.getGameState.mockReturnValue(mockGameState);
        const brokePlayer = { ...mockPlayer, money: 0, hand: ['B_001'] };
        mockStateService.getPlayer.mockReturnValue(brokePlayer);
        mockDataService.getCardById.mockReturnValue({
          card_id: 'B_001',
          card_type: 'B',
          card_name: 'Bank Loan',
          money_effect: '50000',
        } as any);

        expect(gameRulesService.canPlayCard('player1', 'B_001')).toBe(true);
      });
    });

    // A phase-restricted expeditor must NOT be playable outside its work phase —
    // including during the SETUP / OWNER / END stages, which earlier returned
    // `null` ("allow any") from getCurrentActivityPhase. This makes the shared
    // rule match the classic panel's long-standing local gate ("Can only be
    // activated during X phase"); no card is ever restricted to SETUP/OWNER/END,
    // so blocking phase-restricted cards there is exactly "use it in its phase".
    describe('phase restriction gating (setup/owner/end block phase-restricted cards)', () => {
      const fundingExpeditor = {
        card_id: 'E_FUND', card_type: 'E', card_name: 'Funding Rep', phase_restriction: 'FUNDING',
      };
      const anyExpeditor = {
        card_id: 'E_ANY', card_type: 'E', card_name: 'Generalist', phase_restriction: 'Any',
      };
      const playerWith = (cardId: string) => ({ ...mockPlayer, hand: [cardId] });

      it('blocks a FUNDING expeditor during the SETUP / owner stage', () => {
        mockStateService.getGameState.mockReturnValue(mockGameState);
        mockStateService.getPlayer.mockReturnValue(playerWith('E_FUND'));
        mockDataService.getCardById.mockReturnValue(fundingExpeditor as any);
        mockDataService.getGameConfigBySpace.mockReturnValue({ space_name: 'OWNER-SCOPE-INITIATION', phase: 'SETUP' } as any);

        expect(gameRulesService.canPlayCard('player1', 'E_FUND')).toBe(false);
      });

      it('allows the same FUNDING expeditor once on a FUNDING-phase space', () => {
        mockStateService.getGameState.mockReturnValue(mockGameState);
        mockStateService.getPlayer.mockReturnValue(playerWith('E_FUND'));
        mockDataService.getCardById.mockReturnValue(fundingExpeditor as any);
        mockDataService.getGameConfigBySpace.mockReturnValue({ space_name: 'BANK-FUND-REVIEW', phase: 'FUNDING' } as any);

        expect(gameRulesService.canPlayCard('player1', 'E_FUND')).toBe(true);
      });

      it('always allows an "Any"-phase card, even during the setup stage', () => {
        mockStateService.getGameState.mockReturnValue(mockGameState);
        mockStateService.getPlayer.mockReturnValue(playerWith('E_ANY'));
        mockDataService.getCardById.mockReturnValue(anyExpeditor as any);
        mockDataService.getGameConfigBySpace.mockReturnValue({ space_name: 'OWNER-SCOPE-INITIATION', phase: 'SETUP' } as any);

        expect(gameRulesService.canPlayCard('player1', 'E_ANY')).toBe(true);
      });
    });

    // fb:73318276 — "how does this card work?" E024 "Return to Sender"
    // cancels any player's currently-active Expeditor effect
    // (CardService.handleReturnToSender). With nobody's Expeditor currently
    // active, the button used to activate anyway and silently no-op — same
    // "button does nothing" class as fb:58277eca above.
    describe('E024 "Return to Sender" target check (fb:73318276)', () => {
      const returnToSender = { card_id: 'E024', card_type: 'E', card_name: 'Return to Sender', phase_restriction: 'Any', card_mechanic: 'return_to_sender' as const };

      it('blocks activation when no player has an active Expeditor', () => {
        const player = { ...mockPlayer, hand: ['E024'], activeCards: [] };
        mockStateService.getPlayer.mockReturnValue(player);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [player] });
        mockDataService.getCardById.mockImplementation((id: string) =>
          id === 'E024' ? returnToSender : undefined,
        );

        expect(gameRulesService.canPlayCard('player1', 'E024')).toBe(false);
      });

      it('allows activation when the activating player has an active Expeditor', () => {
        const player = { ...mockPlayer, hand: ['E024'], activeCards: [{ cardId: 'E_ACTIVE' }] };
        mockStateService.getPlayer.mockReturnValue(player);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [player] });
        mockDataService.getCardById.mockImplementation((id: string) => {
          if (id === 'E024') return returnToSender;
          if (id === 'E_ACTIVE') return { card_id: 'E_ACTIVE', card_type: 'E', card_name: 'Some Expeditor' };
          return undefined;
        });

        expect(gameRulesService.canPlayCard('player1', 'E024')).toBe(true);
      });

      it('allows activation when an OPPONENT (not the activating player) has an active Expeditor', () => {
        const player = { ...mockPlayer, hand: ['E024'], activeCards: [] };
        const opponent = { ...mockPlayer, id: 'player2', activeCards: [{ cardId: 'E_ACTIVE' }] };
        mockStateService.getPlayer.mockReturnValue(player);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [player, opponent] });
        mockDataService.getCardById.mockImplementation((id: string) => {
          if (id === 'E024') return returnToSender;
          if (id === 'E_ACTIVE') return { card_id: 'E_ACTIVE', card_type: 'E', card_name: 'Some Expeditor' };
          return undefined;
        });

        expect(gameRulesService.canPlayCard('player1', 'E024')).toBe(true);
      });

      it('ignores an active card that is not an Expeditor (e.g. a held Work Package)', () => {
        const player = { ...mockPlayer, hand: ['E024'], activeCards: [{ cardId: 'W_ACTIVE' }] };
        mockStateService.getPlayer.mockReturnValue(player);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [player] });
        mockDataService.getCardById.mockImplementation((id: string) => {
          if (id === 'E024') return returnToSender;
          if (id === 'W_ACTIVE') return { card_id: 'W_ACTIVE', card_type: 'W', card_name: 'Some Work Package' };
          return undefined;
        });

        expect(gameRulesService.canPlayCard('player1', 'E024')).toBe(false);
      });

      // 2026-08-10: reskin item 1 (Workstream 6 audit, TODO.md) — this gate
      // used to be `card?.card_id === 'E024'`. Proves the fix follows the
      // CSV-driven card_mechanic tag instead of the literal id.
      it('a renumbered card keeps the gate if it keeps the return_to_sender tag', () => {
        const renamed = { ...returnToSender, card_id: 'DND-CANCEL-01' };
        const player = { ...mockPlayer, hand: ['DND-CANCEL-01'], activeCards: [] };
        mockStateService.getPlayer.mockReturnValue(player);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [player] });
        mockDataService.getCardById.mockImplementation((id: string) =>
          id === 'DND-CANCEL-01' ? renamed : undefined,
        );

        expect(gameRulesService.canPlayCard('player1', 'DND-CANCEL-01')).toBe(false);
      });

      it('reusing the literal id E024 for an unrelated card no longer applies this gate', () => {
        const unrelated = { card_id: 'E024', card_type: 'E', card_name: 'Totally Different Card', phase_restriction: 'Any' };
        const player = { ...mockPlayer, hand: ['E024'], activeCards: [] };
        mockStateService.getPlayer.mockReturnValue(player);
        mockStateService.getGameState.mockReturnValue({ ...mockGameState, players: [player] });
        mockDataService.getCardById.mockImplementation((id: string) =>
          id === 'E024' ? unrelated : undefined,
        );

        // No active Expeditors anywhere (same setup as the "blocks" case
        // above), but without the tag this gate must not apply — the card
        // is just an ordinary card as far as canPlayCard is concerned.
        expect(gameRulesService.canPlayCard('player1', 'E024')).toBe(true);
      });
    });
  });

  describe('canPlayerAfford', () => {
    it('should return true when player has sufficient money', () => {
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerAfford('player1', 500);

      expect(result).toBe(true);
    });

    it('should return false when player has insufficient money', () => {
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerAfford('player1', 1500);

      expect(result).toBe(false);
    });

    it('should return true when cost equals player money', () => {
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerAfford('player1', 1000);

      expect(result).toBe(true);
    });

    it('should return false for non-existent players', () => {
      mockStateService.getPlayer.mockReturnValue(undefined);

      const result = gameRulesService.canPlayerAfford('nonexistent', 100);

      expect(result).toBe(false);
    });
  });

  describe('isPlayerTurn', () => {
    it('should return true when it is the player turn', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);

      const result = gameRulesService.isPlayerTurn('player1');

      expect(result).toBe(true);
    });

    it('should return false when it is not the player turn', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);

      const result = gameRulesService.isPlayerTurn('player2');

      expect(result).toBe(false);
    });

    it('should return false when no current player is set', () => {
      const gameStateNoCurrentPlayer = { ...mockGameState, currentPlayerId: null };
      mockStateService.getGameState.mockReturnValue(gameStateNoCurrentPlayer);

      const result = gameRulesService.isPlayerTurn('player1');

      expect(result).toBe(false);
    });
  });

  describe('isGameInProgress', () => {
    it('should return true when game phase is PLAY', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);

      const result = gameRulesService.isGameInProgress();

      expect(result).toBe(true);
    });

    it('should return false when game phase is SETUP', () => {
      const setupGameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(setupGameState);

      const result = gameRulesService.isGameInProgress();

      expect(result).toBe(false);
    });

    it('should return false when game phase is END', () => {
      const endGameState = { ...mockGameState, gamePhase: 'END' as const };
      mockStateService.getGameState.mockReturnValue(endGameState);

      const result = gameRulesService.isGameInProgress();

      expect(result).toBe(false);
    });
  });

  describe('canPlayerTakeAction', () => {
    it('should return true when game is in progress and it is player turn', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerTakeAction('player1');

      expect(result).toBe(true);
    });

    it('should return false when game is not in progress', () => {
      const inactiveGameState = { ...mockGameState, gamePhase: 'SETUP' as const };
      mockStateService.getGameState.mockReturnValue(inactiveGameState);

      const result = gameRulesService.canPlayerTakeAction('player1');

      expect(result).toBe(false);
    });

    it('should return false for non-existent players', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(undefined);

      const result = gameRulesService.canPlayerTakeAction('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when it is not the player turn', () => {
      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      const result = gameRulesService.canPlayerTakeAction('player2');

      expect(result).toBe(false);
    });
  });

  // TODO.md bug (2026-07-11 blind review): `player.moveIntent !== undefined` was
  // always true once a MOVEMENT choice existed, because moveIntent is explicitly
  // cleared to `null` (not left `undefined`) by StateService.clearTurnActions /
  // clearPlayerMoveIntent. That made the "only if a destination is picked"
  // exception a no-op. Fixed to a truthy check (`!!player.moveIntent`).
  describe('canEndTurn (MOVEMENT moveIntent guard)', () => {
    const movementChoice = {
      id: 'choice1',
      playerId: 'player1',
      type: 'MOVEMENT' as const,
      prompt: 'Pick a destination',
      options: [{ id: 'DEST-A', label: 'Destination A' }],
    };

    it('returns false when a MOVEMENT choice is awaiting and moveIntent is null (no destination picked)', () => {
      const playerNoIntent = { ...mockPlayer, moveIntent: null };
      const gameStateAwaiting = {
        ...mockGameState,
        players: [playerNoIntent],
        awaitingChoice: movementChoice,
        requiredActions: 1,
        completedActionCount: 1, // required actions satisfied; guard alone must block
      };
      mockStateService.getGameState.mockReturnValue(gameStateAwaiting);
      mockStateService.getPlayer.mockReturnValue(playerNoIntent);

      expect(gameRulesService.canEndTurn('player1')).toBe(false);
    });

    it('returns false when a MOVEMENT choice is awaiting and moveIntent was never set (undefined)', () => {
      const playerUndefinedIntent = { ...mockPlayer };
      delete (playerUndefinedIntent as any).moveIntent;
      const gameStateAwaiting = {
        ...mockGameState,
        players: [playerUndefinedIntent],
        awaitingChoice: movementChoice,
        requiredActions: 1,
        completedActionCount: 1,
      };
      mockStateService.getGameState.mockReturnValue(gameStateAwaiting);
      mockStateService.getPlayer.mockReturnValue(playerUndefinedIntent);

      expect(gameRulesService.canEndTurn('player1')).toBe(false);
    });

    it('returns true when a MOVEMENT choice is awaiting and moveIntent holds a real destination (required actions satisfied)', () => {
      const playerWithIntent = { ...mockPlayer, moveIntent: 'DEST-A' };
      const gameStateAwaiting = {
        ...mockGameState,
        players: [playerWithIntent],
        awaitingChoice: movementChoice,
        requiredActions: 1,
        completedActionCount: 1,
      };
      mockStateService.getGameState.mockReturnValue(gameStateAwaiting);
      mockStateService.getPlayer.mockReturnValue(playerWithIntent);

      expect(gameRulesService.canEndTurn('player1')).toBe(true);
    });

    it('returns false when a MOVEMENT choice is awaiting, moveIntent is set, but required actions are not yet complete', () => {
      const playerWithIntent = { ...mockPlayer, moveIntent: 'DEST-A' };
      const gameStateAwaiting = {
        ...mockGameState,
        players: [playerWithIntent],
        awaitingChoice: movementChoice,
        requiredActions: 2,
        completedActionCount: 1,
      };
      mockStateService.getGameState.mockReturnValue(gameStateAwaiting);
      mockStateService.getPlayer.mockReturnValue(playerWithIntent);

      expect(gameRulesService.canEndTurn('player1')).toBe(false);
    });

    it('returns false for a non-MOVEMENT awaiting choice even when moveIntent holds a destination', () => {
      const playerWithIntent = { ...mockPlayer, moveIntent: 'DEST-A' };
      const gameStateAwaiting = {
        ...mockGameState,
        players: [playerWithIntent],
        awaitingChoice: { ...movementChoice, type: 'GENERAL' as const },
        requiredActions: 1,
        completedActionCount: 1,
      };
      mockStateService.getGameState.mockReturnValue(gameStateAwaiting);
      mockStateService.getPlayer.mockReturnValue(playerWithIntent);

      expect(gameRulesService.canEndTurn('player1')).toBe(false);
    });

    it('returns true when there is no awaiting choice and required actions are complete', () => {
      const gameStateNoChoice = {
        ...mockGameState,
        awaitingChoice: null,
        requiredActions: 1,
        completedActionCount: 1,
      };
      mockStateService.getGameState.mockReturnValue(gameStateNoChoice);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      expect(gameRulesService.canEndTurn('player1')).toBe(true);
    });
  });

  describe('edge cases and private method coverage', () => {
    it('should handle dice movement with no dice outcome', () => {
      const mockMovement: Movement = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        movement_type: 'dice'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getDiceOutcome.mockReturnValue(undefined);

      const result = gameRulesService.isMoveValid('player1', 'ANY-DESTINATION');

      expect(result).toBe(false);
    });

    it('should handle movement with all destination fields', () => {
      const mockMovement: Movement = {
        space_name: 'MULTI-DEST',
        visit_type: 'First',
        movement_type: 'choice',
        destination_1: 'DEST-1',
        destination_2: 'DEST-2',
        destination_3: 'DEST-3',
        destination_4: 'DEST-4',
        destination_5: 'DEST-5'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);

      expect(gameRulesService.isMoveValid('player1', 'DEST-3')).toBe(true);
      expect(gameRulesService.isMoveValid('player1', 'DEST-5')).toBe(true);
    });

    it('should filter empty destinations and remove duplicates', () => {
      const mockDiceOutcome: DiceOutcome = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        roll_1: 'DEST-A',
        roll_2: '',
        roll_3: 'DEST-A', // duplicate
        roll_4: 'DEST-B',
        roll_5: undefined,
        roll_6: '   ' // whitespace
      };

      const mockMovement: Movement = {
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        movement_type: 'dice'
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getMovement.mockReturnValue(mockMovement);
      mockDataService.getDiceOutcome.mockReturnValue(mockDiceOutcome);

      expect(gameRulesService.isMoveValid('player1', 'DEST-A')).toBe(true);
      expect(gameRulesService.isMoveValid('player1', 'DEST-B')).toBe(true);
    });
  });

  describe('checkWinCondition', () => {
    it('should return true when player is on an ending space', async () => {
      // Arrange
      const endingSpaceConfig = {
        space_name: 'END-SPACE',
        phase: 'END',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: true,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false
      };

      const playerOnEndingSpace = { ...mockPlayer, currentSpace: 'END-SPACE' };
      mockStateService.getPlayer.mockReturnValue(playerOnEndingSpace);
      mockDataService.getGameConfigBySpace.mockReturnValue(endingSpaceConfig);

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(true);
      expect(mockStateService.getPlayer).toHaveBeenCalledWith('player1');
      expect(mockDataService.getGameConfigBySpace).toHaveBeenCalledWith('END-SPACE');
    });

    it('should return false when player is not on an ending space', async () => {
      // Arrange
      const normalSpaceConfig = {
        space_name: 'NORMAL-SPACE',
        phase: 'PLAY',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getGameConfigBySpace.mockReturnValue(normalSpaceConfig);

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when player does not exist', async () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(undefined);

      // Act
      const result = await gameRulesService.checkWinCondition('nonexistent');

      // Assert
      expect(result).toBe(false);
      expect(mockStateService.getPlayer).toHaveBeenCalledWith('nonexistent');
      expect(mockDataService.getGameConfigBySpace).not.toHaveBeenCalled();
    });

    it('should return false when space configuration is not found', async () => {
      // Arrange
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getGameConfigBySpace.mockReturnValue(undefined);

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(false);
      expect(mockDataService.getGameConfigBySpace).toHaveBeenCalledWith('START-SPACE');
    });

    it('should return false and log error when an exception occurs', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockStateService.getPlayer.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ [WIN CHECK] Error checking win condition for player player1:',
        expect.any(Error)
      );

      // Cleanup
      consoleSpy.mockRestore();
    });

    it('should handle space config with is_ending_space as false', async () => {
      // Arrange
      const nonEndingSpaceConfig = {
        space_name: 'MIDDLE-SPACE',
        phase: 'PLAY',
        path_type: 'main',
        is_starting_space: false,
        is_ending_space: false,
        min_players: 1,
        max_players: 4,
        requires_dice_roll: false
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockDataService.getGameConfigBySpace.mockReturnValue(nonEndingSpaceConfig);

      // Act
      const result = await gameRulesService.checkWinCondition('player1');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Scoring System', () => {
    describe('calculatePlayerScore', () => {
      it('should calculate score based on money, project scope, loans, and time', () => {
        // Arrange
        const playerWithAssets: any = {
          ...mockPlayer,
          money: 10000,
          timeSpent: 5,
          loans: [
            { id: 'loan1', principal: 5000, interestRate: 0.1, startTurn: 1 },
            { id: 'loan2', principal: 3000, interestRate: 0.15, startTurn: 2 }
          ]
        };

        mockStateService.getPlayer.mockReturnValue(playerWithAssets);
        
        // Mock calculateProjectScope to return a known value
        vi.spyOn(gameRulesService, 'calculateProjectScope').mockReturnValue(15000);

        // Act
        const score = gameRulesService.calculatePlayerScore('player1');

        // Assert
        // Score = Money(10000) + ProjectScope(15000) - Loans(2*5000) - Time(5*1000)
        // Score = 10000 + 15000 - 10000 - 5000 = 10000
        expect(score).toBe(10000);
      });

      it('should return 0 for non-existent player', () => {
        // Arrange
        mockStateService.getPlayer.mockReturnValue(undefined);

        // Act
        const score = gameRulesService.calculatePlayerScore('nonexistent');

        // Assert
        expect(score).toBe(0);
      });

      it('should ensure score does not go negative', () => {
        // Arrange
        const playerWithDebts: any = {
          ...mockPlayer,
          money: 1000,
          timeSpent: 10,
          loans: [
            { id: 'loan1', principal: 5000, interestRate: 0.1, startTurn: 1 },
            { id: 'loan2', principal: 5000, interestRate: 0.1, startTurn: 2 },
            { id: 'loan3', principal: 5000, interestRate: 0.1, startTurn: 3 }
          ]
        };

        mockStateService.getPlayer.mockReturnValue(playerWithDebts);
        vi.spyOn(gameRulesService, 'calculateProjectScope').mockReturnValue(2000);

        // Act
        const score = gameRulesService.calculatePlayerScore('player1');

        // Assert
        // Score = Money(1000) + ProjectScope(2000) - Loans(3*5000) - Time(10*1000)
        // Score = 1000 + 2000 - 15000 - 10000 = -22000, but clamped to 0
        expect(score).toBe(0);
      });
    });

    describe('determineWinner', () => {
      it('should determine winner by highest score', () => {
        // Arrange
        const player1: any = { ...mockPlayer, id: 'player1', name: 'Alice', score: 0 };
        const player2: any = { ...mockPlayer, id: 'player2', name: 'Bob', score: 0 };
        const player3: any = { ...mockPlayer, id: 'player3', name: 'Charlie', score: 0 };

        const mockGameStateWithPlayers = {
          ...mockGameState,
          players: [player1, player2, player3]
        };

        mockStateService.getGameState.mockReturnValue(mockGameStateWithPlayers);

        // Mock calculatePlayerScore to return different scores
        vi.spyOn(gameRulesService, 'calculatePlayerScore')
          .mockReturnValueOnce(5000)  // player1
          .mockReturnValueOnce(15000) // player2 (highest)
          .mockReturnValueOnce(8000); // player3

        // Act
        const winnerId = gameRulesService.determineWinner();

        // Assert
        expect(winnerId).toBe('player2');
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({ id: 'player1', score: 5000 });
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({ id: 'player2', score: 15000 });
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({ id: 'player3', score: 8000 });
      });

      it('should return null when no players exist', () => {
        // Arrange
        const emptyGameState = { ...mockGameState, players: [] };
        mockStateService.getGameState.mockReturnValue(emptyGameState);

        // Act
        const winnerId = gameRulesService.determineWinner();

        // Assert
        expect(winnerId).toBeNull();
      });
    });
  });

  describe('Enhanced Win Conditions', () => {
    // checkTurnLimit and the turn_limit branch of checkGameEndConditions were
    // removed per maintainer ruling (2026-07-11): there is no turn limit.
    describe('checkGameEndConditions', () => {
      it('should return win condition when player reaches ending space', async () => {
        // Arrange
        const endingSpaceConfig: GameConfig = {
          space_name: 'ENDING-SPACE',
          phase: 'play',
          is_starting_space: false,
          is_ending_space: true,
          path_type: 'linear',
          min_players: 1,
          max_players: 4,
          requires_dice_roll: true
        };

        mockStateService.getPlayer.mockReturnValue(mockPlayer);
        mockDataService.getGameConfigBySpace.mockReturnValue(endingSpaceConfig);
        mockStateService.getGameState.mockReturnValue(mockGameState);

        // Act
        const result = await gameRulesService.checkGameEndConditions('player1');

        // Assert
        expect(result.shouldEnd).toBe(true);
        expect(result.reason).toBe('win');
        expect(result.winnerId).toBe('player1');
      });

      it('should return no end condition when game should continue', async () => {
        // Arrange
        const nonEndingSpaceConfig: GameConfig = {
          space_name: 'REGULAR-SPACE',
          phase: 'play',
          is_starting_space: false,
          is_ending_space: false,
          path_type: 'linear',
          min_players: 1,
          max_players: 4,
          requires_dice_roll: true
        };

        mockStateService.getPlayer.mockReturnValue(mockPlayer);
        mockDataService.getGameConfigBySpace.mockReturnValue(nonEndingSpaceConfig);
        mockStateService.getGameState.mockReturnValue(mockGameState);

        // Act
        const result = await gameRulesService.checkGameEndConditions('player1');

        // Assert
        expect(result.shouldEnd).toBe(false);
        expect(result.reason).toBeNull();
        expect(result.winnerId).toBeUndefined();
      });
    });
  });

  describe('Bug Regression Tests', () => {
    describe('Bug #3: Infinite loop prevention (evaluateCondition)', () => {
      it('should not update projectScope when value has not changed', () => {
        // Arrange - player already has correct projectScope
        const playerWithScope: any = {
          ...mockPlayer,
          projectScope: 5000000, // Already $5M
          hand: [] // No E cards, so calculateProjectScope will return 0
        };

        // Mock getPlayer to return player with projectScope already set
        let getPlayerCallCount = 0;
        mockStateService.getPlayer.mockImplementation(() => {
          getPlayerCallCount++;
          // Return same player state both times it's called
          return playerWithScope;
        });
        mockStateService.updatePlayer.mockClear();

        // Mock calculateProjectScope by spying before evaluateCondition is called
        const calculateSpy = vi.spyOn(gameRulesService, 'calculateProjectScope');
        calculateSpy.mockReturnValue(5000000); // Same as current value

        // Act
        const result = gameRulesService.evaluateCondition('player1', 'scope_gt_4M');

        // Assert
        expect(result).toBe(true); // 5M > 4M
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled(); // Should NOT update

        // Cleanup
        calculateSpy.mockRestore();
      });

      it('should evaluate condition without updating state (pure function)', () => {
        // Arrange - player has outdated projectScope, but evaluateCondition should not update it
        const playerWithScope: any = {
          ...mockPlayer,
          projectScope: 3000000, // Old value: $3M
          hand: [] // No E cards
        };

        mockStateService.getPlayer.mockReturnValue(playerWithScope);
        mockStateService.updatePlayer.mockClear();

        // Mock calculateProjectScope to return DIFFERENT value
        const calculateSpy = vi.spyOn(gameRulesService, 'calculateProjectScope');
        calculateSpy.mockReturnValue(6000000); // Different from current 3M

        // Act
        const result = gameRulesService.evaluateCondition('player1', 'scope_gt_4M');

        // Assert - should use calculated value for evaluation but NOT update state
        expect(result).toBe(true); // 6M > 4M (uses calculated, not stored)
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled(); // Pure function - no side effects

        // Cleanup
        calculateSpy.mockRestore();
      });

      it('should not update projectScope when evaluating scope_le_4M and value unchanged', () => {
        // Arrange
        const playerWithScope: any = {
          ...mockPlayer,
          projectScope: 2000000, // Already $2M
          hand: []
        };

        mockStateService.getPlayer.mockReturnValue(playerWithScope);
        mockStateService.updatePlayer.mockClear();

        // Mock calculateProjectScope to return SAME value
        const calculateSpy = vi.spyOn(gameRulesService, 'calculateProjectScope');
        calculateSpy.mockReturnValue(2000000); // Same as current

        // Act
        const result = gameRulesService.evaluateCondition('player1', 'scope_le_4M');

        // Assert
        expect(result).toBe(true); // 2M <= 4M
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();

        // Cleanup
        calculateSpy.mockRestore();
      });
    });
  });
});