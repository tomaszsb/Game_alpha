import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChoiceService } from '../../src/services/ChoiceService';
import { IStateService } from '../../src/types/ServiceContracts';
import { Choice } from '../../src/types/CommonTypes';
import { createMockStateService } from '../mocks/mockServices';

describe('ChoiceService', () => {
  let choiceService: ChoiceService;
  let mockStateService: any;

  // Mock game state
  const mockGameState = {
    players: [
      { id: 'player1', name: 'Alice', money: 100, timeRemaining: 120 },
      { id: 'player2', name: 'Bob', money: 150, timeRemaining: 100 }
    ],
    currentPlayer: 'player1',
    gamePhase: 'PLAY',
    awaitingChoice: null
  };

  beforeEach(() => {
    // Create mock for IStateService
    mockStateService = createMockStateService();

    // Configure mockStateService to return our test game state
    mockStateService.getGameState.mockReturnValue(mockGameState);

    // Initialize the ChoiceService with mocked dependency
    choiceService = new ChoiceService(mockStateService);
  });

  describe('createChoice and resolveChoice integration', () => {
    it('should create a choice and resolve it with the selected option', async () => {
      // Arrange
      const playerId = 'player1';
      const type = 'MOVEMENT';
      const prompt = 'Choose your destination:';
      const options = [
        { id: 'option1', label: 'North Path' },
        { id: 'option2', label: 'South Path' },
        { id: 'option3', label: 'Stay Here' }
      ];

      // Step 1 (Create): Call createChoice and store the promise
      const choicePromise = choiceService.createChoice(playerId, type, prompt, options);

      // Step 2 (Verify Creation): Assert that setAwaitingChoice was called
      expect(mockStateService.setAwaitingChoice).toHaveBeenCalledTimes(1);

      // Capture the Choice object passed to setAwaitingChoice
      const choiceObject: Choice = mockStateService.setAwaitingChoice.mock.calls[0][0];
      expect(choiceObject).toMatchObject({
        playerId,
        type,
        prompt,
        options
      });
      expect(choiceObject.id).toBeDefined();
      expect(typeof choiceObject.id).toBe('string');

      const choiceId = choiceObject.id;

      // Mock getGameState to return the active choice
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        awaitingChoice: choiceObject
      });

      // Step 3 (Resolve): Call resolveChoice with a valid selection
      const resolveResult = choiceService.resolveChoice(choiceId, 'option2');
      expect(resolveResult).toBe(true);

      // Step 4 (Await and Verify): Await the promise and check the result
      const selectedOption = await choicePromise;
      expect(selectedOption).toBe('option2');

      // Step 5 (Cleanup): The service doesn't call clearAwaitingChoice in resolveChoice
      // but we can verify that the choice was processed correctly
      expect(mockStateService.setAwaitingChoice).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple concurrent choices correctly', async () => {
      // Arrange
      const choice1Options = [
        { id: 'move1', label: 'Move North' },
        { id: 'move2', label: 'Move South' }
      ];
      const choice2Options = [
        { id: 'target1', label: 'Target Alice' },
        { id: 'target2', label: 'Target Bob' }
      ];

      // Create first choice
      const choice1Promise = choiceService.createChoice('player1', 'MOVEMENT', 'Choose movement:', choice1Options);
      const choice1Object: Choice = mockStateService.setAwaitingChoice.mock.calls[0][0];

      // Create second choice (this should be a separate promise)
      const choice2Promise = choiceService.createChoice('player2', 'PLAYER_TARGET', 'Choose target:', choice2Options);
      const choice2Object: Choice = mockStateService.setAwaitingChoice.mock.calls[1][0];

      // Mock active choices for resolution
      mockStateService.getGameState
        .mockReturnValueOnce({ ...mockGameState, awaitingChoice: choice1Object })
        .mockReturnValueOnce({ ...mockGameState, awaitingChoice: choice2Object });

      // Resolve both choices
      const resolve1Result = choiceService.resolveChoice(choice1Object.id, 'move1');
      const resolve2Result = choiceService.resolveChoice(choice2Object.id, 'target2');

      expect(resolve1Result).toBe(true);
      expect(resolve2Result).toBe(true);

      // Verify both promises resolve correctly
      const [selection1, selection2] = await Promise.all([choice1Promise, choice2Promise]);
      expect(selection1).toBe('move1');
      expect(selection2).toBe('target2');
    });
  });

  describe('invalid selection handling', () => {
    it('should return false for an invalid selection', () => {
      // Arrange - Set up an active choice
      const activeChoice: Choice = {
        id: 'test-choice-123',
        playerId: 'player1',
        type: 'MOVEMENT',
        prompt: 'Choose your destination:',
        options: [
          { id: 'valid1', label: 'Option 1' },
          { id: 'valid2', label: 'Option 2' }
        ]
      };

      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        awaitingChoice: activeChoice
      });

      // Act - Try to resolve with an invalid selection
      const result = choiceService.resolveChoice('test-choice-123', 'invalid-option');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when no active choice exists', () => {
      // Arrange - No active choice
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        awaitingChoice: null
      });

      // Act
      const result = choiceService.resolveChoice('any-choice-id', 'any-selection');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for choice ID mismatch', () => {
      // Arrange - Set up an active choice with different ID
      const activeChoice: Choice = {
        id: 'correct-choice-id',
        playerId: 'player1',
        type: 'MOVEMENT',
        prompt: 'Choose your destination:',
        options: [{ id: 'option1', label: 'Option 1' }]
      };

      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        awaitingChoice: activeChoice
      });

      // Act - Try to resolve with wrong choice ID
      const result = choiceService.resolveChoice('wrong-choice-id', 'option1');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('createChoice validation', () => {
    it('should throw error for missing player ID', async () => {
      await expect(
        choiceService.createChoice('', 'MOVEMENT', 'Choose:', [{ id: '1', label: 'Option' }])
      ).rejects.toThrow('Player ID is required for choice creation');
    });

    it('should throw error for empty options', async () => {
      await expect(
        choiceService.createChoice('player1', 'MOVEMENT', 'Choose:', [])
      ).rejects.toThrow('At least one option is required for choice creation');
    });

    it('should throw error for invalid option format', async () => {
      await expect(
        choiceService.createChoice('player1', 'MOVEMENT', 'Choose:', [{ id: '', label: 'Bad Option' }])
      ).rejects.toThrow('All choice options must have both id and label properties');

      await expect(
        choiceService.createChoice('player1', 'MOVEMENT', 'Choose:', [{ id: 'good', label: '' }])
      ).rejects.toThrow('All choice options must have both id and label properties');
    });

    it('should create valid choice with all required properties', async () => {
      // Arrange
      const playerId = 'player1';
      const type = 'GENERAL';
      const prompt = 'Test prompt';
      const options = [{ id: 'test', label: 'Test Option' }];

      // Act - Start the choice creation
      const choicePromise = choiceService.createChoice(playerId, type, prompt, options);

      // Assert - Verify the choice was set correctly
      expect(mockStateService.setAwaitingChoice).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId,
          type,
          prompt,
          options,
          id: expect.any(String)
        })
      );

      // Clean up - resolve the choice to prevent hanging
      const choiceObject = mockStateService.setAwaitingChoice.mock.calls[0][0];
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        awaitingChoice: choiceObject
      });
      choiceService.resolveChoice(choiceObject.id, 'test');
      await choicePromise;
    });
  });

  describe('utility methods', () => {
    it('should correctly report active choice status', () => {
      // No active choice
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        awaitingChoice: null
      });
      expect(choiceService.hasActiveChoice()).toBe(false);
      expect(choiceService.getActiveChoice()).toBe(null);

      // With active choice
      const activeChoice: Choice = {
        id: 'test-choice',
        playerId: 'player1',
        type: 'MOVEMENT',
        prompt: 'Test',
        options: [{ id: 'opt1', label: 'Option 1' }]
      };
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        awaitingChoice: activeChoice
      });
      expect(choiceService.hasActiveChoice()).toBe(true);
      expect(choiceService.getActiveChoice()).toEqual(activeChoice);
    });

    it('should provide debugging information for pending choices', async () => {
      // Initially no pending choices
      expect(choiceService.getPendingChoicesInfo()).toEqual([]);

      // Create a choice
      const choicePromise = choiceService.createChoice('player1', 'MOVEMENT', 'Test', [
        { id: 'option1', label: 'Option 1' }
      ]);

      // Check pending choices info
      const pendingInfo = choiceService.getPendingChoicesInfo();
      expect(pendingInfo).toHaveLength(1);
      expect(pendingInfo[0].hasPromise).toBe(true);
      expect(typeof pendingInfo[0].choiceId).toBe('string');

      // Clean up
      const choiceObject = mockStateService.setAwaitingChoice.mock.calls[0][0];
      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        awaitingChoice: choiceObject
      });
      choiceService.resolveChoice(choiceObject.id, 'option1');
      await choicePromise;
    });

    it('should clear all pending choices', async () => {
      // Create multiple choices
      const promise1 = choiceService.createChoice('player1', 'MOVEMENT', 'Test 1', [
        { id: 'opt1', label: 'Option 1' }
      ]);
      const promise2 = choiceService.createChoice('player2', 'PLAYER_TARGET', 'Test 2', [
        { id: 'opt2', label: 'Option 2' }
      ]);

      // Verify pending choices exist
      expect(choiceService.getPendingChoicesInfo()).toHaveLength(2);

      // Clear all pending choices
      choiceService.clearAllPendingChoices();

      // Verify cleanup
      expect(choiceService.getPendingChoicesInfo()).toHaveLength(0);
      expect(mockStateService.clearAwaitingChoice).toHaveBeenCalledTimes(1);

      // Verify promises are rejected
      await expect(promise1).rejects.toThrow('Choice choice_');
      await expect(promise2).rejects.toThrow('Choice choice_');
    });
  });

  describe('error handling', () => {
    it('should handle promise resolution errors gracefully', () => {
      // Arrange - Create a choice
      const activeChoice: Choice = {
        id: 'test-choice',
        playerId: 'player1',
        type: 'MOVEMENT',
        prompt: 'Test',
        options: [{ id: 'option1', label: 'Option 1' }]
      };

      mockStateService.getGameState.mockReturnValue({
        ...mockGameState,
        awaitingChoice: activeChoice
      });

      // Manually add a choice to pending map but without proper setup
      // This simulates an error condition
      const choiceService2 = new ChoiceService(mockStateService);

      // Try to resolve a choice that doesn't have a pending promise
      const result = choiceService2.resolveChoice('test-choice', 'option1');
      expect(result).toBe(false);
    });
  });

  describe('choice types', () => {
    it('should handle all supported choice types', async () => {
      const choiceTypes: Choice['type'][] = [
        'MOVEMENT',
        'PLAYER_TARGET',
        'GENERAL',
        'TARGET_SELECTION',
        'CARD_REPLACEMENT'
      ];

      const options = [{ id: 'test', label: 'Test Option' }];
      const promises: Promise<string>[] = [];

      // Create choices of each type
      for (const type of choiceTypes) {
        const promise = choiceService.createChoice('player1', type, `Test ${type}`, options);
        promises.push(promise);
      }

      // Verify all choices were created
      expect(mockStateService.setAwaitingChoice).toHaveBeenCalledTimes(choiceTypes.length);

      // Resolve all choices
      for (let i = 0; i < choiceTypes.length; i++) {
        const choiceObject = mockStateService.setAwaitingChoice.mock.calls[i][0];
        mockStateService.getGameState.mockReturnValue({
          ...mockGameState,
          awaitingChoice: choiceObject
        });
        choiceService.resolveChoice(choiceObject.id, 'test');
      }

      // Wait for all promises to resolve
      const results = await Promise.all(promises);
      expect(results).toEqual(Array(choiceTypes.length).fill('test'));
    });
  });
});