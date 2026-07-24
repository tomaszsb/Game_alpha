// src/services/TurnEffectsOrchestrator.ts
// Extracted from TurnService (2026-07-16) — converts a space's CSV effect rows
// (space entry, dice roll, space exit) into Effect objects and runs them
// through the EffectEngine. Bodies moved verbatim from TurnService; the only
// changes are dependency plumbing (spaceArrivalProcessor for condition
// filtering, diceService for extra roll-group rolls).

import { IDataService, IStateService, IEffectEngineService, IDiceService } from '../types/ServiceContracts';
import { SpaceArrivalProcessor } from './SpaceArrivalProcessor';
import { GameState } from '../types/StateTypes';
import { VisitType } from '../types/DataTypes';
import { EffectFactory } from '../utils/EffectFactory';
import { EffectContext, Effect } from '../types/EffectTypes';
import { friendlySpaceName } from '../utils/logFormatting';
import { debugWarn } from '../utils/debugLog';

export class TurnEffectsOrchestrator {
  private effectEngineService?: IEffectEngineService;

  constructor(
    private readonly dataService: IDataService,
    private readonly stateService: IStateService,
    private readonly diceService: IDiceService,
    private readonly spaceArrivalProcessor: SpaceArrivalProcessor,
    effectEngineService?: IEffectEngineService
  ) {
    this.effectEngineService = effectEngineService;
  }

  /**
   * Set the EffectEngineService after construction (circular dependency handling)
   */
  public setEffectEngineService(effectEngineService: IEffectEngineService): void {
    this.effectEngineService = effectEngineService;
  }

  async processTurnEffects(playerId: string, diceRoll: number): Promise<GameState> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    try {
      // Get space effect data from DataService
      const spaceEffectsData = this.dataService.getSpaceEffects(
        currentPlayer.currentSpace,
        currentPlayer.visitType
      );

      // Filter space effects based on conditions (e.g., scope_le_4M, scope_gt_4M)
      const conditionFilteredEffects = this.spaceArrivalProcessor.filterSpaceEffectsByCondition(spaceEffectsData, currentPlayer);

      // Filter out manual effects and time effects - manual effects are triggered by buttons, time effects on leaving space
      const filteredSpaceEffects = conditionFilteredEffects.filter(effect =>
        effect.trigger_type !== 'manual' && effect.effect_type !== 'time'
      );

      // Get dice effect data from DataService
      const diceEffectsData = this.dataService.getDiceEffects(
        currentPlayer.currentSpace,
        currentPlayer.visitType
      );

      // Get space configuration for action processing
      const spaceConfig = this.dataService.getGameConfigBySpace(currentPlayer.currentSpace);

      // Generate all effects from space entry using EffectFactory
      const friendlySpace = friendlySpaceName(this.dataService, currentPlayer.currentSpace);
      const spaceEffects = EffectFactory.createEffectsFromSpaceEntry(
        filteredSpaceEffects,
        playerId,
        currentPlayer.currentSpace,
        currentPlayer.visitType,
        spaceConfig || undefined,
        currentPlayer.name,
        false,
        friendlySpace
      );

      // Generate all effects from dice roll using EffectFactory
      const diceEffects = EffectFactory.createEffectsFromDiceRoll(
        diceEffectsData,
        playerId,
        currentPlayer.currentSpace,
        diceRoll,
        currentPlayer.name,
        friendlySpace
      );

      // Add user messaging when funding is auto-applied (paired with shouldAutoApplyFunding).
      // Workstream 6 #3: lifted from `=== 'OWNER-FUND-INITIATION'`.
      if (this.dataService.shouldAutoApplyFunding(currentPlayer.currentSpace)) {
        spaceEffects.push({
          effectType: 'LOG',
          payload: {
            message: `Reviewing project scope for funding level...`,
            level: 'INFO',
            source: `space:${currentPlayer.currentSpace}:${currentPlayer.visitType}`,
            action: 'space_effect'
          }
        });
      }

      // Combine all effects for unified processing
      const allEffects = [...spaceEffects, ...diceEffects];

      if (allEffects.length > 0) {
        if (!this.effectEngineService) {
          console.error(`❌ EffectEngineService not available - cannot process ${allEffects.length} effects`);
          throw new Error('EffectEngineService not initialized - effects cannot be processed');
        }

        // Create effect processing context
        const effectContext: EffectContext = {
          source: 'turn_effects:space_entry',
          playerId: playerId,
          triggerEvent: 'SPACE_ENTRY',
          metadata: {
            spaceName: currentPlayer.currentSpace,
            visitType: currentPlayer.visitType,
            diceRoll: diceRoll,
            playerName: currentPlayer.name
          }
        };

        // Process all effects through the unified Effect Engine
        const processingResult = await this.effectEngineService.processEffects(allEffects, effectContext);

        if (!processingResult.success) {
          console.error(`❌ Failed to process some space/dice effects: ${processingResult.errors.join(', ')}`);
          // Log errors but don't throw - some effects may have succeeded
        }
      }

      return this.stateService.getGameState();

    } catch (error) {
      console.error(`❌ Error processing turn effects:`, error);
      throw new Error(`Failed to process turn effects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process ONLY dice effects (not space effects) for a dice roll
   * Returns the effects that were generated for feedback purposes and the processing results
   */
  async processDiceRollEffects(playerId: string, diceRoll: number): Promise<{ gameState: GameState, generatedEffects: Effect[], effectResults?: import('../types/EffectTypes').BatchEffectResult, rollGroups?: Array<{ rollGroup: string; diceValue: number; effectCount: number }> }> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    try {
      // Get ONLY dice effect data from DataService
      const diceEffectsData = this.dataService.getDiceEffects(
        currentPlayer.currentSpace,
        currentPlayer.visitType
      );

      if (diceEffectsData.length === 0) {
        return { gameState: this.stateService.getGameState(), generatedEffects: [], effectResults: undefined };
      }

      // Group dice effects by roll_group. Empty/undefined roll_group all share one roll.
      const groups = new Map<string, typeof diceEffectsData>();
      for (const effect of diceEffectsData) {
        const key = effect.roll_group || '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(effect);
      }

      // Roll separately for each group. The first/default group uses the passed-in diceRoll.
      const allDiceEffects: Effect[] = [];
      const rollGroupResults: Array<{ rollGroup: string; diceValue: number; effectCount: number }> = [];
      let isFirstGroup = true;

      for (const [groupKey, groupEffects] of groups) {
        const groupDiceRoll = isFirstGroup ? diceRoll : this.diceService.rollDice();
        isFirstGroup = false;

        const effects = EffectFactory.createEffectsFromDiceRoll(
          groupEffects,
          playerId,
          currentPlayer.currentSpace,
          groupDiceRoll,
          currentPlayer.name,
          friendlySpaceName(this.dataService, currentPlayer.currentSpace)
        );
        allDiceEffects.push(...effects);
        rollGroupResults.push({ rollGroup: groupKey, diceValue: groupDiceRoll, effectCount: effects.length });
      }

      if (allDiceEffects.length > 0) {
        if (!this.effectEngineService) {
          console.error(`❌ EffectEngineService not available - cannot process ${allDiceEffects.length} dice effects`);
          throw new Error('EffectEngineService not initialized - dice effects cannot be processed');
        }

        // Create effect processing context for dice effects only
        const effectContext: EffectContext = {
          source: 'dice_roll',
          playerId: playerId,
          triggerEvent: 'DICE_ROLL',
          metadata: {
            spaceName: currentPlayer.currentSpace,
            visitType: currentPlayer.visitType,
            diceRoll: diceRoll,
            playerName: currentPlayer.name
          }
        };

        // Process ALL dice effects through the Effect Engine
        const processingResult = await this.effectEngineService.processEffects(allDiceEffects, effectContext);

        if (!processingResult.success) {
          console.error(`❌ Failed to process some dice effects: ${processingResult.errors.join(', ')}`);
        }

        // Only include rollGroups when there are multiple groups
        const rollGroups = rollGroupResults.length > 1 ? rollGroupResults : undefined;
        return { gameState: this.stateService.getGameState(), generatedEffects: allDiceEffects, effectResults: processingResult, rollGroups };
      }

      return { gameState: this.stateService.getGameState(), generatedEffects: allDiceEffects, effectResults: undefined };
    } catch (error) {
      console.error(`❌ Error processing dice effects for ${currentPlayer.name}:`, error);
      throw error;
    }
  }

  /**
   * Process time effects for a player when leaving a space
   * Time effects represent the time spent working on activities at that space
   * and should be applied when the player finishes their work and leaves
   */
  async processLeavingSpaceEffects(playerId: string, spaceName: string, visitType: VisitType): Promise<void> {
    const currentPlayer = this.stateService.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error(`Player ${playerId} not found`);
    }

    try {
      // Get space effect data from DataService for the current space
      const spaceEffectsData = this.dataService.getSpaceEffects(spaceName, visitType);

      // Filter space effects based on conditions and only get time effects
      const conditionFilteredEffects = this.spaceArrivalProcessor.filterSpaceEffectsByCondition(spaceEffectsData, currentPlayer);
      const timeEffects = conditionFilteredEffects.filter(effect =>
        effect.effect_type === 'time' && effect.trigger_type !== 'manual'
      );

      if (timeEffects.length === 0) {
        return;
      }

      // Generate effects from leaving space using EffectFactory.
      // skipLogging: true — this call only ever carries 'time' effects for the
      // space the player is LEAVING (see the filter above). The "entered X
      // (visit)" LOG effect that createEffectsFromSpaceEntry pushes when
      // skipLogging is false was already emitted once for this exact
      // space+visit by SpaceArrivalProcessor at turn start (arrival). Letting
      // it fire again here duplicated that log line with a second, later
      // timestamp (fb: "⚡ entered PM Check (first visit)" appearing twice)
      // every time the space had an auto time effect — and the message was
      // wrong either way, since the player is leaving, not entering. The
      // actual time-spent effect (e.g. "Spend 5 days") still logs on its own
      // via FinancialEffectHandler when the RESOURCE_CHANGE effect below is
      // processed, so suppressing this LOG effect loses nothing.
      const leavingEffects = EffectFactory.createEffectsFromSpaceEntry(
        timeEffects,
        playerId,
        spaceName,
        visitType,
        undefined,
        currentPlayer?.name,
        true,
        friendlySpaceName(this.dataService, spaceName)
      );

      if (leavingEffects.length === 0) {
        return;
      }

      // Create effect context for leaving space
      const effectContext = {
        source: 'space_leaving',
        playerId,
        triggerEvent: 'SPACE_EXIT' as const,
        metadata: {
          spaceName,
          visitType,
          playerName: currentPlayer.name
        }
      };

      // Process effects using EffectEngine
      if (this.effectEngineService) {
        const result = await this.effectEngineService.processEffects(leavingEffects, effectContext);
        if (!result.success) {
          debugWarn(`⚠️ Some time effects failed for leaving ${spaceName}:`, result.errors);
        }
      } else {
        debugWarn(`⚠️ EffectEngineService not available - skipping time effects for leaving ${spaceName}`);
      }
    } catch (error) {
      console.error(`❌ Error processing leaving space time effects for ${spaceName}:`, error);
    }
  }
}
