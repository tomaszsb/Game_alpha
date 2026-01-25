// tests/services/PlayerViewStateService.test.ts
//
// Tests for PlayerViewStateService - the state machine for mobile UI views.
// Created: January 24, 2026

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PlayerViewStateService,
  PlayerViewState,
  ViewStateContext
} from '../../src/services/PlayerViewStateService';
import { IStateService, IGameRulesService, IDataService } from '../../src/types/ServiceContracts';
import { GameState, Player } from '../../src/types/StateTypes';
import { SpaceContent, SpaceEffect, Movement } from '../../src/types/DataTypes';
import { Choice } from '../../src/types/CommonTypes';

// Helper to create a mock player
const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 'player-1',
  name: 'Test Player',
  currentSpace: 'START',
  visitType: 'First',
  visitedSpaces: ['START'],
  spaceVisitLog: [],
  money: 10000,
  timeSpent: 0,
  projectScope: 0,
  hand: [],
  activeCards: [],
  activeEffects: [],
  loans: [],
  score: 0,
  moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 },
  expenditures: { design: 0, fees: 0, construction: 0 },
  costHistory: [],
  fundingHistory: [],
  costs: {
    bank: 0, investor: 0, expeditor: 0, architectural: 0,
    engineering: 0, regulatory: 0, investmentFee: 0, miscellaneous: 0, total: 0
  },
  avatar: '🎮',
  color: '#2196f3',
  ...overrides
});

// Helper to create mock game state
const createMockGameState = (overrides: Partial<GameState> = {}): GameState => ({
  players: [createMockPlayer()],
  currentPlayerId: 'player-1',
  gamePhase: 'PLAY',
  turn: 1,
  gameRound: 1,
  turnWithinRound: 1,
  globalTurnCount: 1,
  playerTurnCounts: { 'player-1': 1 },
  activeModal: null,
  awaitingChoice: null,
  hasPlayerMovedThisTurn: false,
  hasPlayerRolledDice: false,
  isGameOver: false,
  isMoving: false,
  isProcessingArrival: false,
  isInitialized: true,
  currentExplorationSessionId: null,
  requiredActions: 0,
  completedActionCount: 0,
  availableActionTypes: [],
  completedActions: { diceRoll: undefined, manualActions: {} },
  activeNegotiation: null,
  selectedDestination: null,
  globalActionLog: [],
  playerSnapshots: {},
  decks: { W: [], B: [], E: [], L: [], I: [] },
  discardPiles: { W: [], B: [], E: [], L: [], I: [] },
  gameMode: 'BATTLE_ROYALE',
  ...overrides
});

describe('PlayerViewStateService', () => {
  let service: PlayerViewStateService;
  let mockStateService: IStateService;
  let mockGameRulesService: IGameRulesService;
  let mockDataService: IDataService;
  let stateSubscribeCallback: ((state: GameState) => void) | null = null;

  beforeEach(() => {
    // Reset callback
    stateSubscribeCallback = null;

    // Create mock services
    mockStateService = {
      getGameState: vi.fn(() => createMockGameState()),
      getPlayer: vi.fn((id: string) => createMockPlayer({ id })),
      subscribe: vi.fn((callback) => {
        stateSubscribeCallback = callback;
        return () => { stateSubscribeCallback = null; };
      }),
      updateState: vi.fn(),
      updatePlayer: vi.fn(),
      setPlayerMoveIntent: vi.fn(),
      replaceState: vi.fn(),
      loadStateFromServer: vi.fn(),
      saveStateToServer: vi.fn()
    } as unknown as IStateService;

    mockGameRulesService = {
      isPlayerTurn: vi.fn(() => true),
      canEndTurn: vi.fn(() => false),
      isGameInProgress: vi.fn(() => true),
      calculateProjectScope: vi.fn(() => 0)
    } as unknown as IGameRulesService;

    mockDataService = {
      getSpaceContent: vi.fn(() => ({
        space_name: 'START',
        visit_type: 'First',
        title: 'Starting Space',
        story: 'Your journey begins here.',
        action_description: 'Roll dice to proceed.',
        outcome_description: '',
        can_negotiate: false
      } as SpaceContent)),
      getSpaceEffects: vi.fn(() => []),
      getMovement: vi.fn(() => ({
        space_name: 'START',
        visit_type: 'First',
        movement_type: 'fixed',
        destination_1: 'NEXT-SPACE'
      } as Movement))
    } as unknown as IDataService;

    service = new PlayerViewStateService(
      mockStateService,
      mockGameRulesService,
      mockDataService
    );
  });

  afterEach(() => {
    service.destroy();
  });

  describe('deriveViewState', () => {
    it('returns WAITING_MODE when not player turn', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(false);

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('WAITING_MODE');
      expect(context.isMyTurn).toBe(false);
    });

    it('returns STORY_MODE when player has unread story', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue({
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        title: 'Test Space',
        story: 'This is the story.',
        action_description: '',
        outcome_description: '',
        can_negotiate: false
      });

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('STORY_MODE');
      expect(context.storyContent).toContain('This is the story.');
    });

    it('returns ACTION_MODE after story read when manual actions pending', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceEffects).mockReturnValue([{
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        effect_type: 'money',
        effect_action: 'add',
        effect_value: 100,
        condition: '',
        description: 'Roll for money',
        trigger_type: 'manual'
      }]);

      // First, mark story as read
      service.markStoryRead('player-1');

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('ACTION_MODE');
      expect(context.actionPrompt).toBeDefined();
      expect(context.actionPrompt?.type).toBe('manual_effect');
    });

    it('returns DECISION_MODE when awaiting choice', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue(null);

      const choice: Choice = {
        id: 'choice-1',
        playerId: 'player-1',
        type: 'MOVEMENT',
        prompt: 'Choose destination',
        options: [
          { id: 'DEST-A', label: 'Destination A' },
          { id: 'DEST-B', label: 'Destination B' }
        ]
      };

      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({ awaitingChoice: choice })
      );

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('DECISION_MODE');
      expect(context.choices).toHaveLength(2);
      expect(context.choiceType).toBe('MOVEMENT');
    });

    it('returns SUMMARY_MODE when can end turn and no pending actions', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockGameRulesService.canEndTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue(null);
      vi.mocked(mockDataService.getSpaceEffects).mockReturnValue([]);

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('SUMMARY_MODE');
      expect(context.canEndTurn).toBe(true);
    });

    it('returns WAITING_MODE during processing', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue(null);
      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({ isProcessingArrival: true })
      );

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('WAITING_MODE');
      expect(context.waitingMessage).toContain('Processing');
    });
  });

  describe('markStoryRead', () => {
    it('transitions from STORY_MODE to next state', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockGameRulesService.canEndTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue({
        space_name: 'TEST-SPACE',
        visit_type: 'First',
        title: 'Test Space',
        story: 'Story content',
        action_description: '',
        outcome_description: '',
        can_negotiate: false
      });

      // Before marking read - should be STORY_MODE
      let context = service.deriveViewState('player-1');
      expect(context.state).toBe('STORY_MODE');

      // Mark story as read
      service.markStoryRead('player-1');

      // After marking read - should transition to SUMMARY_MODE (since canEndTurn is true)
      context = service.deriveViewState('player-1');
      expect(context.state).toBe('SUMMARY_MODE');
    });

    it('resets read state when player moves to new space', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue({
        space_name: 'SPACE-A',
        visit_type: 'First',
        title: 'Space A',
        story: 'Story for Space A',
        action_description: '',
        outcome_description: '',
        can_negotiate: false
      });

      // Mark story read on first space
      service.markStoryRead('player-1');
      let context = service.deriveViewState('player-1');
      expect(context.state).not.toBe('STORY_MODE');

      // Now player moves to a new space
      vi.mocked(mockStateService.getPlayer).mockReturnValue(
        createMockPlayer({ currentSpace: 'SPACE-B' })
      );
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue({
        space_name: 'SPACE-B',
        visit_type: 'First',
        title: 'Space B',
        story: 'Story for Space B',
        action_description: '',
        outcome_description: '',
        can_negotiate: false
      });

      // Should be back in STORY_MODE for the new space
      context = service.deriveViewState('player-1');
      expect(context.state).toBe('STORY_MODE');
      expect(context.storyContent).toContain('Story for Space B');
    });
  });

  describe('subscribe', () => {
    it('calls callback immediately with current state', () => {
      const callback = vi.fn();

      service.subscribe('player-1', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'player-1' })
      );
    });

    it('calls callback when game state changes', () => {
      const callback = vi.fn();
      service.subscribe('player-1', callback);

      // Reset call count after initial call
      callback.mockClear();

      // Simulate game state change
      if (stateSubscribeCallback) {
        stateSubscribeCallback(createMockGameState());
      }

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = service.subscribe('player-1', callback);

      // Reset call count after initial call
      callback.mockClear();

      // Unsubscribe
      unsubscribe();

      // Simulate game state change
      if (stateSubscribeCallback) {
        stateSubscribeCallback(createMockGameState());
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('context data', () => {
    it('includes player stats', () => {
      vi.mocked(mockStateService.getPlayer).mockReturnValue(
        createMockPlayer({
          money: 50000,
          timeSpent: 30,
          hand: ['W001', 'B001', 'E001'],
          projectScope: 100000
        })
      );

      const context = service.deriveViewState('player-1');

      expect(context.stats.money).toBe(50000);
      expect(context.stats.timeSpent).toBe(30);
      expect(context.stats.cardCount).toBe(3);
      expect(context.stats.projectScope).toBe(100000);
    });

    it('includes space information', () => {
      vi.mocked(mockStateService.getPlayer).mockReturnValue(
        createMockPlayer({ currentSpace: 'ARCH-FEE', visitType: 'Subsequent' })
      );
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue({
        space_name: 'ARCH-FEE',
        visit_type: 'Subsequent',
        title: 'Architect Fee Review',
        story: '',
        action_description: '',
        outcome_description: '',
        can_negotiate: false
      });

      const context = service.deriveViewState('player-1');

      expect(context.spaceName).toBe('ARCH-FEE');
      expect(context.spaceTitle).toBe('Architect Fee Review');
      expect(context.visitType).toBe('Subsequent');
    });

    it('includes turn state flags', () => {
      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({
          hasPlayerMovedThisTurn: true,
          hasPlayerRolledDice: true
        })
      );
      vi.mocked(mockGameRulesService.canEndTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue(null);

      const context = service.deriveViewState('player-1');

      expect(context.hasMovedThisTurn).toBe(true);
      expect(context.hasRolledDice).toBe(true);
      expect(context.canEndTurn).toBe(true);
    });
  });

  describe('ACTION_MODE prompts', () => {
    beforeEach(() => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue(null);
    });

    it('creates dice roll prompt for dice-movement spaces', () => {
      service.markStoryRead('player-1');
      vi.mocked(mockDataService.getMovement).mockReturnValue({
        space_name: 'CHEAT-BYPASS',
        visit_type: 'First',
        movement_type: 'dice'
      } as Movement);
      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({ hasPlayerRolledDice: false })
      );

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('ACTION_MODE');
      expect(context.actionPrompt?.type).toBe('dice_roll');
      expect(context.actionPrompt?.label).toBe('Roll Dice');
    });

    it('creates manual effect prompt for money effects', () => {
      service.markStoryRead('player-1');
      vi.mocked(mockDataService.getSpaceEffects).mockReturnValue([{
        space_name: 'OWNER-FUND',
        visit_type: 'First',
        effect_type: 'money',
        effect_action: 'add',
        effect_value: 1000,
        condition: '',
        description: 'Roll for owner funding',
        trigger_type: 'manual'
      }]);

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('ACTION_MODE');
      expect(context.actionPrompt?.type).toBe('manual_effect');
      expect(context.actionPrompt?.label).toBe('Roll for Money');
    });

    it('creates manual effect prompt for time effects', () => {
      service.markStoryRead('player-1');
      vi.mocked(mockDataService.getSpaceEffects).mockReturnValue([{
        space_name: 'TIME-SPACE',
        visit_type: 'First',
        effect_type: 'time',
        effect_action: 'add',
        effect_value: 5,
        condition: '',
        description: 'Roll for time',
        trigger_type: 'manual'
      }]);

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('ACTION_MODE');
      expect(context.actionPrompt?.type).toBe('manual_effect');
      expect(context.actionPrompt?.label).toBe('Roll for Time');
    });
  });

  describe('DECISION_MODE choices', () => {
    beforeEach(() => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue(null);
    });

    it('maps movement choices correctly', () => {
      const choice: Choice = {
        id: 'move-1',
        playerId: 'player-1',
        type: 'MOVEMENT',
        prompt: 'Choose your path',
        options: [
          { id: 'PATH-A', label: 'Path A - Fast but risky' },
          { id: 'PATH-B', label: 'Path B - Safe but slow' }
        ]
      };

      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({ awaitingChoice: choice })
      );

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('DECISION_MODE');
      expect(context.choices).toEqual([
        { id: 'PATH-A', label: 'Path A - Fast but risky', isSelected: false },
        { id: 'PATH-B', label: 'Path B - Safe but slow', isSelected: false }
      ]);
    });

    it('marks selected choice based on moveIntent', () => {
      vi.mocked(mockStateService.getPlayer).mockReturnValue(
        createMockPlayer({ moveIntent: 'PATH-A' })
      );

      const choice: Choice = {
        id: 'move-1',
        playerId: 'player-1',
        type: 'MOVEMENT',
        prompt: 'Choose your path',
        options: [
          { id: 'PATH-A', label: 'Path A' },
          { id: 'PATH-B', label: 'Path B' }
        ]
      };

      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({ awaitingChoice: choice })
      );

      const context = service.deriveViewState('player-1');

      expect(context.choices?.[0].isSelected).toBe(true);
      expect(context.choices?.[1].isSelected).toBe(false);
      expect(context.selectedChoiceId).toBe('PATH-A');
    });

    it('handles card selection choices', () => {
      const choice: Choice = {
        id: 'card-1',
        playerId: 'player-1',
        type: 'CARD_SELECTION',
        prompt: 'Choose a card to play',
        options: [
          { id: 'W001', label: 'Work Card 1' },
          { id: 'W002', label: 'Work Card 2' }
        ]
      };

      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({ awaitingChoice: choice })
      );

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('DECISION_MODE');
      expect(context.choiceType).toBe('CARD_SELECTION');
    });
  });

  describe('WAITING_MODE messages', () => {
    it('shows other player name when waiting for their turn', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(false);
      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({
          currentPlayerId: 'player-2',
          players: [
            createMockPlayer({ id: 'player-1' }),
            createMockPlayer({ id: 'player-2', name: 'Alice' })
          ]
        })
      );

      const context = service.deriveViewState('player-1');

      expect(context.state).toBe('WAITING_MODE');
      expect(context.waitingMessage).toContain('Alice');
    });

    it('shows processing message during arrival', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue(null);
      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({ isProcessingArrival: true })
      );

      const context = service.deriveViewState('player-1');

      expect(context.waitingMessage).toContain('Processing arrival');
    });

    it('shows moving message during movement', () => {
      vi.mocked(mockGameRulesService.isPlayerTurn).mockReturnValue(true);
      vi.mocked(mockDataService.getSpaceContent).mockReturnValue(null);
      vi.mocked(mockStateService.getGameState).mockReturnValue(
        createMockGameState({ isMoving: true })
      );

      const context = service.deriveViewState('player-1');

      expect(context.waitingMessage).toContain('Moving');
    });
  });

  describe('error handling', () => {
    it('returns error context for non-existent player', () => {
      vi.mocked(mockStateService.getPlayer).mockReturnValue(undefined as unknown as Player);

      const context = service.deriveViewState('invalid-player');

      expect(context.state).toBe('WAITING_MODE');
      expect(context.waitingMessage).toContain('not found');
    });

    it('handles subscriber errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const workingCallback = vi.fn();

      // Both subscribe - error one first
      service.subscribe('player-1', errorCallback);
      service.subscribe('player-1', workingCallback);

      // Clear initial calls
      errorCallback.mockClear();
      workingCallback.mockClear();

      // Trigger state change - should not crash
      if (stateSubscribeCallback) {
        expect(() => stateSubscribeCallback!(createMockGameState())).not.toThrow();
      }

      // Working callback should still be called
      expect(workingCallback).toHaveBeenCalled();
    });
  });
});
