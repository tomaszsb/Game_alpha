import React, { useState } from 'react';
import { ExpandableSection } from '../ExpandableSection';
import { ActionButton } from '../ActionButton';
import { IServiceContainer } from '../../../types/ServiceContracts';
import './TimeSection.css';

/**
 * Props for the TimeSection component
 */
export interface TimeSectionProps {
  /** Game services container providing access to all game services */
  gameServices: IServiceContainer;

  /** ID of the player whose time information to display */
  playerId: string;

  /** Whether the section is currently expanded */
  isExpanded: boolean;

  /** Callback fired when the section header is clicked */
  onToggle: () => void;

  /** Completed actions tracking */
  completedActions?: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };
}

/**
 * TimeSection Component
 *
 * Displays the player's time tracking information and provides actions for gaining time.
 * Part of the mobile-first Player Panel UI redesign.
 *
 * **Displays:**
 * - Elapsed time (days spent in the game)
 * - Cost (days required for current action - currently placeholder)
 *
 * **Actions:**
 * - "Roll for Time" button (appears when `ROLL_FOR_TIME` is in available actions)
 *
 * **Features:**
 * - Automatically detects available actions from game state
 * - Error handling with retry functionality
 * - Loading states during action execution
 * - Conditional rendering of action buttons and cost display
 *
 * **Integration:**
 * - Uses `triggerManualEffectWithFeedback` from TurnService
 * - Subscribes to state changes via ExpandableSection
 * - Shows action indicator (🔴) when "Roll for Time" is available
 *
 * @example
 * ```tsx
 * <TimeSection
 *   gameServices={gameServices}
 *   playerId="player-1"
 *   isExpanded={isTimeExpanded}
 *   onToggle={() => setIsTimeExpanded(!isTimeExpanded)}
 * />
 * ```
 */
export const TimeSection: React.FC<TimeSectionProps> = ({
  gameServices,
  playerId,
  isExpanded,
  onToggle,
  completedActions = { manualActions: {} }
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get player state
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) {
    return null;
  }

  // Get ALL manual effects for time from current space
  const allSpaceEffects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType);
  const timeManualEffects = allSpaceEffects.filter(
    effect => effect.trigger_type === 'manual' && effect.effect_type === 'time'
  );

  // Check if there are any time manual actions available
  const hasTimeActions = timeManualEffects.length > 0;

  // Calculate cost (days required for current action) - may need to be implemented
  const cost = 0; // TODO: Implement cost calculation if needed
  const elapsed = player.timeSpent;

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

  // Helper to format button label from effect
  const getButtonLabel = (effect: any): string => {
    if (effect.description) return effect.description;
    if (effect.effect_type === 'time') return 'Roll for Time';
    return effect.effect_type;
  };

  // Create header actions (action buttons always visible)
  const headerActions = timeManualEffects.length > 0 ? (
    <>
      {timeManualEffects.map((effect, index) => {
        const isEffectCompleted = completedActions.manualActions[effect.effect_type] !== undefined;
        return !isEffectCompleted && (
          <ActionButton
            key={index}
            label={getButtonLabel(effect)}
            variant="primary"
            onClick={() => handleManualEffect(effect.effect_type)}
            disabled={isLoading}
            isLoading={isLoading}
            ariaLabel={`Perform ${effect.effect_type} action`}
          />
        );
      })}
    </>
  ) : undefined;

  // Summary content - always visible
  const summary = <span>{`Elapsed: ${elapsed}d`}</span>;

  return (
    <ExpandableSection
      title="TIME"
      icon="⏱️"
      hasAction={hasTimeActions}
      isExpanded={isExpanded}
      onToggle={onToggle}
      ariaControls="time-content"
      isLoading={isLoading}
      error={error || undefined}
      onRetry={error ? handleRetry : undefined}
      headerActions={headerActions}
      summary={summary}
    >
      <div className="time-content" id="time-content">
        {/* Visited Spaces Timeline */}
        {player.visitedSpaces && player.visitedSpaces.length > 0 ? (
          <div className="visited-spaces-timeline">
            <div className="timeline-header">Journey Timeline</div>
            <div className="timeline-list">
              {player.visitedSpaces.map((spaceName, index) => {
                const isCurrent = spaceName === player.currentSpace;
                return (
                  <div
                    key={`${spaceName}-${index}`}
                    className={`timeline-item ${isCurrent ? 'timeline-item--current' : ''}`}
                  >
                    <div className="timeline-marker">
                      {isCurrent ? '📍' : '✓'}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-space-name">{spaceName}</div>
                      {isCurrent && (
                        <div className="timeline-badge">Current</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            Journey has not started yet.
          </div>
        )}

        {/* Cost info if applicable */}
        {cost > 0 && (
          <div className="stat-line">
            <span className="stat-label">Upcoming Cost:</span>
            <span className="stat-value">{cost}d</span>
          </div>
        )}
      </div>
    </ExpandableSection>
  );
};
