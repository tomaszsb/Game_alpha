import React, { useState, useEffect } from 'react';
import { ExpandableSection } from '../ExpandableSection';
import { ActionButton } from '../ActionButton';
import { IServiceContainer } from '../../../types/ServiceContracts';
import { Choice } from '../../../types/CommonTypes';
import './CurrentCardSection.css';

/**
 * Props for the CurrentCardSection component
 */
export interface CurrentCardSectionProps {
  /** Game services container providing access to all game services */
  gameServices: IServiceContainer;

  /** ID of the player whose current space content to display */
  playerId: string;

  /** Whether the section is currently expanded */
  isExpanded: boolean;

  /** Callback fired when the section header is clicked */
  onToggle: () => void;
}

/**
 * Helper function to map choice labels to button variants
 *
 * Maps user-facing choice labels to semantic button colors:
 * - "Accept", "Yes" → primary (blue)
 * - "Reject", "No", "Decline" → danger (red)
 * - "Negotiate", "Maybe", etc. → secondary (gray)
 *
 * @param label - The choice option label text
 * @returns The appropriate button variant
 */
const getChoiceVariant = (label: string): 'primary' | 'secondary' | 'danger' => {
  const lowerLabel = label.toLowerCase();
  
  if (lowerLabel.includes('accept') || lowerLabel.includes('yes')) {
    return 'primary';
  }
  if (lowerLabel.includes('reject') || lowerLabel.includes('no') || lowerLabel.includes('decline')) {
    return 'danger';
  }
  // Default to secondary for negotiate, maybe, etc.
  return 'secondary';
};

/**
 * CurrentCardSection Component
 *
 * Displays the content of the player's current game board space and handles player choices.
 * Part of the mobile-first Player Panel UI redesign.
 *
 * **Displays:**
 * - Dynamic section title (based on space content title)
 * - Space story text (narrative description)
 * - Action required (what the player needs to do)
 * - Potential outcomes (possible results of actions)
 * - Player choice buttons (when awaiting decision)
 *
 * **Actions:**
 * - Choice buttons with smart variant mapping (Accept=primary, Reject=danger, Negotiate=secondary)
 * - Error handling with retry functionality
 * - Loading states during choice resolution
 *
 * **Features:**
 * - Real-time state subscription for choice updates
 * - Dynamic space content loading based on `currentSpace` and `visitType`
 * - Automatic action indicator when choices are available
 * - Defaults to expanded on desktop viewports for better UX
 * - Conditional rendering (hides if no space content available)
 * - Smart button color mapping based on choice semantics
 *
 * **State Management:**
 * - Subscribes to game state via `stateService.subscribe()`
 * - Tracks `awaitingChoice` for player-specific choices
 * - Dynamically loads space content when player moves
 * - Cleanup subscription on unmount
 *
 * **Integration:**
 * - Uses `resolveChoice` from ChoiceService for decision handling
 * - Uses `getSpaceContent` from DataService for space information
 * - Uses `getPlayer` from StateService for current space tracking
 * - Section title dynamically reflects space content (not static)
 *
 * @example
 * ```tsx
 * <CurrentCardSection
 *   gameServices={gameServices}
 *   playerId="player-1"
 *   isExpanded={isCurrentCardExpanded}
 *   onToggle={() => setIsCurrentCardExpanded(!isCurrentCardExpanded)}
 * />
 * ```
 */
export const CurrentCardSection: React.FC<CurrentCardSectionProps> = ({
  gameServices,
  playerId,
  isExpanded,
  onToggle
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingChoice, setAwaitingChoice] = useState<Choice | null>(null);
  const [spaceContent, setSpaceContent] = useState<{
    title: string;
    story: string;
    actionDescription: string;
    outcomeDescription: string;
  } | null>(null);

  // Subscribe to game state for choices and space content
  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribe((gameState) => {
      // Update awaiting choice
      if (gameState.awaitingChoice && gameState.awaitingChoice.playerId === playerId) {
        setAwaitingChoice(gameState.awaitingChoice);
      } else {
        setAwaitingChoice(null);
      }

      // Get current player's space content
      const player = gameServices.stateService.getPlayer(playerId);
      if (player) {
        const content = gameServices.dataService.getSpaceContent(
          player.currentSpace,
          player.visitType
        );
        
        if (content) {
          setSpaceContent({
            title: content.title,
            story: content.story,
            actionDescription: content.action_description,
            outcomeDescription: content.outcome_description
          });
        } else {
          setSpaceContent(null);
        }
      }
    });

    // Initialize with current state
    const gameState = gameServices.stateService.getGameState();
    if (gameState.awaitingChoice && gameState.awaitingChoice.playerId === playerId) {
      setAwaitingChoice(gameState.awaitingChoice);
    }

    const player = gameServices.stateService.getPlayer(playerId);
    if (player) {
      const content = gameServices.dataService.getSpaceContent(
        player.currentSpace,
        player.visitType
      );
      
      if (content) {
        setSpaceContent({
          title: content.title,
          story: content.story,
          actionDescription: content.action_description,
          outcomeDescription: content.outcome_description
        });
      }
    }

    return unsubscribe;
  }, [gameServices, playerId]);

  const handleChoice = async (choiceId: string, optionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const success = gameServices.choiceService.resolveChoice(choiceId, optionId);
      if (!success) {
        throw new Error('Failed to resolve choice');
      }
    } catch (err) {
      setError('Failed to process choice. Please try again.');
      console.error('Choice error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
  };

  // Determine if section has action (has active choices, excluding MOVEMENT which is handled elsewhere)
  const hasAction = awaitingChoice !== null &&
                    awaitingChoice.options.length > 0 &&
                    awaitingChoice.type !== 'MOVEMENT';

  // If no space content, don't render
  if (!spaceContent) {
    return null;
  }

  // Build consolidated text paragraph
  const consolidatedText = [
    spaceContent.story,
    spaceContent.actionDescription,
    spaceContent.outcomeDescription
  ]
    .filter(Boolean)
    .join(' ');

  // Summary content - always visible
  const summary = spaceContent ? <span>{spaceContent.title}</span> : null;

  return (
    <ExpandableSection
      title="On this space:"
      icon="📋"
      hasAction={hasAction}
      isExpanded={isExpanded}
      onToggle={onToggle}
      ariaControls="current-card-content"
      defaultExpandedOnDesktop={true}
      isLoading={isLoading}
      error={error || undefined}
      onRetry={error ? handleRetry : undefined}
      summary={summary}
    >
      <div className="current-card-content" id="current-card-content">
        {/* Consolidated Space Content */}
        {consolidatedText && (
          <div className="card-story">
            {consolidatedText}
          </div>
        )}

        {/* Choice Buttons (skip MOVEMENT type - handled by movement component) */}
        {awaitingChoice && awaitingChoice.options.length > 0 && awaitingChoice.type !== 'MOVEMENT' && (
          <div className="card-choices">
            {awaitingChoice.options.map((option) => (
              <ActionButton
                key={option.id}
                label={option.label}
                variant={getChoiceVariant(option.label)}
                onClick={() => handleChoice(awaitingChoice.id, option.id)}
                disabled={isLoading}
                isLoading={isLoading}
                ariaLabel={`Choose: ${option.label}`}
              />
            ))}
          </div>
        )}
      </div>
    </ExpandableSection>
  );
};
