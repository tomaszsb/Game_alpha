import React, { useState } from 'react';
import { ExpandableSection } from '../ExpandableSection';
import { ActionButton } from '../ActionButton';
import { IServiceContainer } from '../../../types/ServiceContracts';
import './ProjectScopeSection.css';

/**
 * Props for the ProjectScopeSection component
 */
export interface ProjectScopeSectionProps {
  /** Game services container providing access to all game services */
  gameServices: IServiceContainer;

  /** ID of the player whose project scope to display */
  playerId: string;

  /** Whether the section is currently expanded */
  isExpanded: boolean;

  /** Callback fired when the section header is clicked */
  onToggle: () => void;

  /** Callback to handle dice roll action */
  onRollDice?: () => Promise<void>;

  /** Completed actions tracking */
  completedActions?: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };
}

/**
 * ProjectScopeSection Component
 *
 * Displays the player's project scope information including total scope value,
 * work types being added, and associated costs.
 *
 * **Displays:**
 * - Total project scope value (calculated from W cards)
 * - List of work types from W cards in hand
 * - Costs breakdown from W cards
 *
 * **Features:**
 * - Calculates scope from W cards (work cards)
 * - Shows work type restrictions from cards
 * - Displays work costs
 * - Formatted money display
 *
 * @example
 * ```tsx
 * <ProjectScopeSection
 *   gameServices={gameServices}
 *   playerId="player-1"
 *   isExpanded={isScopeExpanded}
 *   onToggle={() => setIsScopeExpanded(!isScopeExpanded)}
 * />
 * ```
 */
export const ProjectScopeSection: React.FC<ProjectScopeSectionProps> = ({
  gameServices,
  playerId,
  isExpanded,
  onToggle,
  onRollDice,
  completedActions = { manualActions: {} }
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [expandedWorkTypes, setExpandedWorkTypes] = useState<Set<string>>(new Set());

  // Get player state
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) {
    return null;
  }

  // Get W card manual effects ONLY from current space
  const allSpaceEffects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType);
  const wCardManualEffects = allSpaceEffects.filter(
    effect => effect.trigger_type === 'manual' &&
              effect.effect_type === 'cards' &&
              (effect.effect_action === 'draw_w' || effect.effect_action?.toLowerCase().includes('work'))
  );

  // Get dice effects for W cards (dice roll outcomes)
  const allDiceEffects = gameServices.dataService.getDiceEffects(player.currentSpace, player.visitType);
  const wCardDiceEffects = allDiceEffects.filter(
    effect => effect.effect_type === 'cards' && effect.card_type === 'W'
  );

  // Check if there are any W card actions available (manual or dice)
  const hasWCardActions = wCardManualEffects.length > 0 || wCardDiceEffects.length > 0;

  // Get W cards (work cards) from player's hand
  const playerHand = player.hand || [];
  const wCards = playerHand
    .map(cardId => gameServices.dataService.getCardById(cardId))
    .filter(card => card && card.card_type === 'W');

  // Group W cards by work type
  interface WorkTypeGroup {
    workType: string;
    cards: Array<{
      id: string;
      name: string;
      cost: number;
      description?: string;
    }>;
    subtotal: number;
  }

  const workTypeGroups: WorkTypeGroup[] = [];
  const workTypeMap = new Map<string, WorkTypeGroup>();

  wCards.forEach(card => {
    if (card) {
      const workType = card.work_type_restriction || 'General';
      const cost = typeof card.work_cost === 'string' ? parseFloat(card.work_cost) : (card.work_cost || 0);

      if (!workTypeMap.has(workType)) {
        workTypeMap.set(workType, {
          workType,
          cards: [],
          subtotal: 0
        });
      }

      const group = workTypeMap.get(workType)!;
      group.cards.push({
        id: card.card_id,
        name: card.card_name || card.card_id,
        cost: isNaN(cost) ? 0 : cost,
        description: card.description
      });
      group.subtotal += isNaN(cost) ? 0 : cost;
    }
  });

  // Convert map to array for rendering
  workTypeMap.forEach(group => workTypeGroups.push(group));

  // Calculate total project scope from W cards (single source of truth)
  const projectScope = gameServices.gameRulesService.calculateProjectScope(playerId);
  const totalCosts = workTypeGroups.reduce((sum, group) => sum + group.subtotal, 0);

  // Format money
  const formatMoney = (amount: number | undefined) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '$0';
    }
    return `$${amount.toLocaleString()}`;
  };

  // Handler for manual effects
  const handleManualEffect = async (effectType: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await gameServices.turnService.triggerManualEffectWithFeedback(playerId, effectType);
    } catch (err) {
      setError(`Failed to perform ${effectType} action. Please try again.`);
      console.error(`Manual effect error (${effectType}):`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
  };

  const toggleWorkType = (workType: string) => {
    setExpandedWorkTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workType)) {
        newSet.delete(workType);
      } else {
        newSet.add(workType);
      }
      return newSet;
    });
  };

  // Handler for dice roll
  const handleDiceRoll = async () => {
    if (!onRollDice) return;

    setIsRollingDice(true);
    setError(null);

    try {
      await onRollDice();
    } catch (err) {
      setError('Failed to roll dice. Please try again.');
      console.error('Dice roll error:', err);
    } finally {
      setIsRollingDice(false);
    }
  };

  // Helper to format button label from manual effect
  const getManualEffectButtonLabel = (effect: any): string => {
    if (effect.description) return effect.description;
    if (effect.card_type === 'W') return 'Get W Cards';
    if (effect.effect_type === 'cards') return 'Get Cards';
    return effect.effect_type;
  };

  // Create header actions (action buttons always visible)
  const headerActions = (wCardManualEffects.length > 0 || wCardDiceEffects.length > 0) ? (
    <>
      {/* Dice roll buttons for W cards */}
      {(() => {
        const isDiceCompleted = completedActions.diceRoll !== undefined;
        return wCardDiceEffects.length > 0 && onRollDice && !isDiceCompleted && (
          <ActionButton
            label="Roll for W Cards"
            variant="primary"
            onClick={handleDiceRoll}
            disabled={isLoading || isRollingDice}
            isLoading={isRollingDice}
            ariaLabel="Roll dice to gain W type work cards"
          />
        );
      })()}

      {/* Manual effect buttons for W cards only */}
      {wCardManualEffects.map((effect, index) => {
        const isEffectCompleted = completedActions.manualActions[effect.effect_type] !== undefined;
        return !isEffectCompleted && (
          <ActionButton
            key={`manual-${index}`}
            label={getManualEffectButtonLabel(effect)}
            variant="primary"
            onClick={() => handleManualEffect(effect.effect_type)}
            disabled={isLoading}
            isLoading={isLoading}
            ariaLabel="Get W type work cards"
          />
        );
      })}
    </>
  ) : undefined;

  // Summary content - always visible
  const summary = (
    <span>
      Total: {formatMoney(projectScope)} | W: {wCards.length}
    </span>
  );

  return (
    <ExpandableSection
      title="PROJECT SCOPE"
      icon="📐"
      hasAction={hasWCardActions}
      isExpanded={isExpanded}
      onToggle={onToggle}
      ariaControls="project-scope-content"
      isLoading={isLoading}
      error={error || undefined}
      onRetry={error ? handleRetry : undefined}
      headerActions={headerActions}
      summary={summary}
    >
      <div className="project-scope-content" id="project-scope-content">

        {/* Work Type Groups with expandable cards */}
        {workTypeGroups.length > 0 ? (
          <div className="work-types-section">
            {workTypeGroups.map((group, groupIndex) => {
              const isExpanded = expandedWorkTypes.has(group.workType);
              const hasMultipleCards = group.cards.length > 1;

              return (
                <div key={groupIndex} className="work-type-group">
                  <button
                    className="work-type-header"
                    onClick={() => toggleWorkType(group.workType)}
                  >
                    <span className="work-type-info">
                      <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                      <span className="work-type-name">
                        {group.workType} ({group.cards.length})
                      </span>
                    </span>
                    <span className="work-type-subtotal">{formatMoney(group.subtotal)}</span>
                  </button>

                  {/* Show individual cards only when expanded */}
                  {isExpanded && (
                    <div className="work-type-cards">
                      {group.cards.map((card, cardIndex) => (
                        <div key={cardIndex} className="work-card-item">
                          <div className="card-name">{card.name}</div>
                          <div className="card-cost">{formatMoney(card.cost)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total Project Scope - at the bottom inside work-types-section */}
            <div className="project-scope-total">
              <span className="total-label">Total Project Scope:</span>
              <span className="total-value">{formatMoney(projectScope)}</span>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            No work cards yet. Draw W cards to build project scope.
          </div>
        )}
      </div>
    </ExpandableSection>
  );
};
