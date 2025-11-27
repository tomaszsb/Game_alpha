
/**
 * E2E-MultiPathMovement.test.tsx
 *
 * Test suite for verifying the multi-path movement bug fixes using real services.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { TurnControlsWithActions } from '../../src/components/game/TurnControlsWithActions';
import { GameContext } from '../../src/context/GameContext';
import { GamePhase } from '../../src/types/StateTypes';
import { StateService } from '../../src/services/StateService';
import { DataService } from '../../src/services/DataService';
import { CardService } from '../../src/services/CardService';
import { LoggingService } from '../../src/services/LoggingService';
import { ChoiceService } from '../../src/services/ChoiceService';
import { EffectEngineService } from '../../src/services/EffectEngineService';
import { GameRulesService } from '../../src/services/GameRulesService';
import { MovementService } from '../../src/services/MovementService';
import { ResourceService } from '../../src/services/ResourceService';
import { TurnService } from '../../src/services/TurnService';
import { NegotiationService } from '../../src/services/NegotiationService';
import { ITurnService } from '../../src/types/ServiceContracts';
import { readFileSync } from 'fs';
import { join } from 'path';

// Node.js compatible DataService for E2E testing
class NodeDataService extends DataService {
  async loadData(): Promise<void> {
    if ((this as any).loaded) return;
    try {
      const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
      const gameConfigCsv = readFileSync(join(dataDir, 'GAME_CONFIG.csv'), 'utf-8');
      const movementCsv = readFileSync(join(dataDir, 'MOVEMENT.csv'), 'utf-8');
      const diceOutcomesCsv = readFileSync(join(dataDir, 'DICE_OUTCOMES.csv'), 'utf-8');
      const spaceEffectsCsv = readFileSync(join(dataDir, 'SPACE_EFFECTS.csv'), 'utf-8');
      const diceEffectsCsv = readFileSync(join(dataDir, 'DICE_EFFECTS.csv'), 'utf-8');
      const spaceContentsCsv = readFileSync(join(dataDir, 'SPACE_CONTENT.csv'), 'utf-8');
      const cardsCsv = readFileSync(join(dataDir, 'CARDS_EXPANDED.csv'), 'utf-8');
      (this as any).gameConfigs = (this as any).parseGameConfigCsv(gameConfigCsv);
      (this as any).movements = (this as any).parseMovementCsv(movementCsv);
      (this as any).diceOutcomes = (this as any).parseDiceOutcomesCsv(diceOutcomesCsv);
      (this as any).spaceEffects = (this as any).parseSpaceEffectsCsv(spaceEffectsCsv);
      (this as any).diceEffects = (this as any).parseDiceEffectsCsv(diceEffectsCsv);
      (this as any).spaceContents = (this as any).parseSpaceContentCsv(spaceContentsCsv);
      (this as any).cards = (this as any).parseCardsCsv(cardsCsv);
      (this as any).buildSpaces();
      (this as any).loaded = true;
    } catch (error) {
      console.error('Error loading CSV data from filesystem:', error);
      throw new Error('Failed to load game data from filesystem');
    }
  }
}

describe('E2E Feature: Multi-Path Movement with Real Services', () => {
  let services: any;

  beforeAll(async () => {
    const dataService = new NodeDataService();
    await dataService.loadData();
    const stateService = new StateService(dataService);
    const loggingService = new LoggingService(stateService);
    const resourceService = new ResourceService(stateService);
    const choiceService = new ChoiceService(stateService);
    const gameRulesService = new GameRulesService(dataService, stateService);
    const cardService = new CardService(dataService, stateService, resourceService, loggingService);
    const movementService = new MovementService(dataService, stateService, choiceService, loggingService);
    const effectEngineService = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, {} as ITurnService, gameRulesService, {} as any);
    const negotiationService = new NegotiationService(stateService, effectEngineService);
    const turnService = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService);
    turnService.setEffectEngineService(effectEngineService);
    effectEngineService.setTurnService(turnService);

    services = { dataService, stateService, turnService, choiceService, movementService };
  });

  it('should handle multi-path movement flow correctly', async () => {
    // 1. Setup Game State - Use PM-DECISION-CHECK which has real choice movement
    services.stateService.addPlayer('Test Player');
    services.stateService.startGame();
    const player = services.stateService.getGameState().players[0];
    services.stateService.updatePlayer({ id: player.id, currentSpace: 'PM-DECISION-CHECK', visitType: 'First' });
    services.stateService.setPlayerHasRolledDice();

    // 2. Render the component
    const mockProps = {
        currentPlayer: player,
        gamePhase: 'PLAY' as GamePhase,
        isProcessingTurn: false,
        isProcessingArrival: false,
        hasPlayerMovedThisTurn: false,
        hasPlayerRolledDice: true,
        hasCompletedManualActions: true,
        awaitingChoice: false, // Initially false
        actionCounts: { required: 1, completed: 1 },
        completedActions: { diceRoll: '🎲 Rolled 4', manualActions: {} },
        feedbackMessage: '',
        buttonFeedback: {},
        onRollDice: vi.fn(),
        onEndTurn: () => services.turnService.endTurnWithMovement(),
        onManualEffect: vi.fn(),
        onNegotiate: vi.fn(),
        onOpenNegotiationModal: vi.fn(),
        playerId: player.id,
        playerName: player.name,
      };

    render(
      <GameContext.Provider value={services}>
        <TurnControlsWithActions {...mockProps} />
      </GameContext.Provider>
    );

    // 3. Trigger the state change that shows the movement choice (real destinations from CSV)
    services.stateService.setAwaitingChoice({
        id: 'movement-choice-123',
        type: 'MOVEMENT',
        playerId: player.id,
        prompt: 'Choose your destination',
        options: [
          { id: 'LEND-SCOPE-CHECK', label: 'LEND-SCOPE-CHECK' },
          { id: 'ARCH-INITIATION', label: 'ARCH-INITIATION' },
          { id: 'CHEAT-BYPASS', label: 'CHEAT-BYPASS' },
        ],
      });

    // 4. Wait for the component to update and show the buttons
    await waitFor(() => {
      expect(screen.getByText('🎯 LEND-SCOPE-CHECK')).toBeInTheDocument();
    });

    // 5. Simulate user actions - select LEND-SCOPE-CHECK
    const destinationButton = screen.getByText('🎯 LEND-SCOPE-CHECK');
    fireEvent.click(destinationButton);

    const endTurnButton = screen.getByRole('button', { name: /End Turn/ });
    fireEvent.click(endTurnButton);

    // 6. Assert the results - player should move to LEND-SCOPE-CHECK
    await waitFor(() => {
        const updatedPlayer = services.stateService.getPlayer(player.id);
        expect(updatedPlayer.currentSpace).toBe('LEND-SCOPE-CHECK');
    });
  });
});
