import React, { useState } from 'react';
import { ExpandableSection } from '../ExpandableSection';
import { ActionButton } from '../ActionButton';
import { CardDisplay } from '../../common/CardDisplay';
import { IServiceContainer } from '../../../types/ServiceContracts';
import { CardType } from '../../../types/DataTypes';
import { DiscardPileModal } from '../../modals/DiscardPileModal';
import { CardDetailsModal } from '../../modals/CardDetailsModal';
import './CardsSection.css';

/**
 * Props for the CardsSection component
 */
export interface CardsSectionProps {
  /** Game services container providing access to all game services */
  gameServices: IServiceContainer;

  /** ID of the player whose card portfolio to display */
  playerId: string;

  /** Callback to handle dice roll action */
  onRollDice?: () => Promise<void>;

  /** Callback to handle manual effect results (to show modal) */
  onManualEffectResult?: (result: import('../../../types/StateTypes').TurnEffectResult) => void;

  /** Completed actions tracking */
  completedActions?: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };

  /** Whether it's this player's turn */
  isMyTurn?: boolean;

  /** Render mode: 'accordion' wraps in ExpandableSection, 'content' renders inner content only */
  renderMode?: 'accordion' | 'content';
}

/**
 * CardsSection Component
 *
 * Displays the player's card portfolio summary and provides actions for acquiring cards.
 * Part of the mobile-first Player Panel UI redesign.
 *
 * **Displays:**
 * - Total cards in hand
 * - Card type breakdown (W, B, etc. with counts)
 *
 * **Actions:**
 * - "Roll for W Cards" button (appears when `ROLL_FOR_CARDS_W` is available)
 * - "Roll for B Cards" button (appears when `ROLL_FOR_CARDS_B` is available)
 * - "View Discarded" button (always visible - secondary action)
 *
 * **Features:**
 * - Automatically detects available card actions from game state
 * - Dynamic card type counting with CardService integration
 * - Error handling with retry functionality for roll actions
 * - Loading states during action execution
 * - Conditional rendering of roll action buttons
 * - Multiple simultaneous action buttons with proper spacing
 *
 * **Integration:**
 * - Uses `triggerManualEffectWithFeedback` from TurnService for roll actions
 * - Uses `getCardType` from CardService for portfolio analysis
 * - Subscribes to state changes via ExpandableSection
 * - Shows action indicator (🔴) when any card action is available
 *
 * @example
 * ```tsx
 * <CardsSection
 *   gameServices={gameServices}
 *   playerId="player-1"
 *   isExpanded={isCardsExpanded}
 *   onToggle={() => setIsCardsExpanded(!isCardsExpanded)}
 * />
 * ```
 */
export const CardsSection: React.FC<CardsSectionProps> = ({
  gameServices,
  playerId,
  onRollDice,
  onManualEffectResult,
  completedActions = { manualActions: {} },
  isMyTurn = true,
  renderMode = 'accordion'
}) => {
  const [isExpanded, setIsExpanded] = useState(false); // Internal state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandedCardType, setExpandedCardType] = useState<CardType | null>(null);
  const [showDiscardedModal, setShowDiscardedModal] = useState(false);
  const [selectedCardForDetails, setSelectedCardForDetails] = useState<string | null>(null);

  // Get player state
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) {
    return null;
  }

  // Get current space phase for E card validation
  const currentSpaceConfig = gameServices.dataService.getGameConfigBySpace(player.currentSpace);
  const currentPhase = currentSpaceConfig?.phase;

  // Get E card manual effects only from current space (B/I in Finances, W in Scope, L in Events)
  const allSpaceEffects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType);
  const conditionFilteredEffects = gameServices.turnService.filterSpaceEffectsByCondition(allSpaceEffects, player) || [];

  const cardManualEffects = conditionFilteredEffects.filter(
    effect => effect.trigger_type === 'manual' &&
              effect.effect_type === 'cards' &&
              (effect.effect_action === 'draw_e' || effect.effect_action === 'replace_e' ||
               effect.effect_action === 'give_e' || effect.effect_action === 'return_e' ||
               effect.effect_action === 'transfer')
  );

  // Get dice effects for E cards only
  const allDiceEffects = gameServices.dataService.getDiceEffects(player.currentSpace, player.visitType);
  const cardDiceEffects = allDiceEffects.filter(
    effect => effect.effect_type === 'cards' && effect.card_type === 'E'
  );

  // Check if there are any E card actions available (manual or dice)
  const hasCardActions = cardManualEffects.length > 0 || cardDiceEffects.length > 0;

  // Filter to E cards only (other types shown in their respective tabs)
  const playerHand = (player.hand || []).filter(cardId => {
    const cardType = gameServices.cardService.getCardType(cardId);
    return cardType === 'E';
  });
  const totalCards = playerHand.length;

  // All cards here are E type
  const cardCounts: { [key in CardType]?: number } = {};
  if (totalCards > 0) {
    cardCounts['E'] = totalCards;
  }

  // Count playable E cards (cards that can be played in current phase)
  const playableECards = playerHand.filter(cardId => {
    const card = gameServices.dataService.getCardById(cardId);
    if (!card || card.card_type !== 'E') return false;
    // If no phase restriction or "Any", always playable
    if (!card.phase_restriction || card.phase_restriction === 'Any') return true;
    // Otherwise check if current phase matches
    return currentPhase?.toUpperCase() === card.phase_restriction.toUpperCase();
  });
  const playableCount = playableECards.length;

  const handleManualEffect = async (effectType: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await gameServices.turnService.triggerManualEffectWithFeedback(playerId, effectType);

      // Trigger the onManualEffectResult callback if provided
      if (onManualEffectResult && result) {
        onManualEffectResult(result);
      }
    } catch (err) {
      setError(`Failed to perform ${effectType} action. Please try again.`);
      console.error(`Manual effect error (${effectType}):`, err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for dice roll
  const handleDiceRoll = async () => {
    if (!onRollDice) return;

    setIsRollingDice(true);
    setError(null);

    try {
      await onRollDice();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Dice roll error:', err);
    } finally {
      setIsRollingDice(false);
    }
  };

  // Helper to format button label from manual effect
  const getManualEffectButtonLabel = (effect: any): string => {
    if (effect.description) return effect.description;
    const action = effect.effect_action?.toLowerCase();
    if (action === 'draw_e') return 'Hire Expeditor';
    if (action === 'replace_e') return 'Change Expeditor';
    if (action === 'give_e') return 'Fire Expeditor';
    if (action === 'return_e') return 'Expeditor Left';
    if (action === 'transfer') return 'Expeditor Reassigned';
    return 'Expeditor Action';
  };

  // Helper to format dice button label
  const getDiceButtonLabel = (cardType: string): string => {
    return 'Hire Expeditors';
  };

  // Create header actions (action buttons always visible)
  const headerActions = (cardManualEffects.length > 0 || cardDiceEffects.length > 0) ? (
    <>
      {/* Dice roll buttons for cards (excluding W which is in Project Scope) */}
      {cardDiceEffects.map((effect, index) => {
        // Check if dice roll is completed
        const isDiceCompleted = completedActions.diceRoll !== undefined;

        return onRollDice && !isDiceCompleted && (
          <ActionButton
            key={`dice-${index}`}
            label={isMyTurn ? getDiceButtonLabel(effect.card_type || '') : "⏳ Wait for your turn"}
            variant="primary"
            onClick={handleDiceRoll}
            disabled={!isMyTurn || isLoading || isRollingDice}
            isLoading={isRollingDice}
            ariaLabel={isMyTurn ? `Roll to gain ${effect.card_type} type resources` : "Wait for your turn"}
          />
        );
      })}

      {/* Manual effect buttons */}
      {cardManualEffects.map((effect, index) => {
        // Use compound key (e.g., "cards:replace_E") for specific effect identification
        const effectKey = effect.effect_action
          ? `${effect.effect_type}:${effect.effect_action}`
          : effect.effect_type;

        // Check if this specific manual effect is completed using compound key OR simple key
        // Support case-insensitive matching for robustness
        const completedKeys = Object.keys(completedActions.manualActions);
        const isEffectCompleted = completedKeys.some(key =>
          key === effectKey ||
          key === effect.effect_type ||
          key.toLowerCase() === effectKey.toLowerCase() ||
          key.toLowerCase() === effect.effect_type.toLowerCase()
        );

        return !isEffectCompleted && (
          <ActionButton
            key={`manual-${index}`}
            label={isMyTurn ? getManualEffectButtonLabel(effect) : "⏳ Wait for your turn"}
            variant="primary"
            onClick={() => handleManualEffect(effectKey)}
            disabled={!isMyTurn || isLoading}
            isLoading={isLoading}
            ariaLabel={isMyTurn ? `Perform ${effect.effect_action} action` : "Wait for your turn"}
          />
        );
      })}
    </>
  ) : undefined;

  const handleViewDiscarded = () => {
    setShowDiscardedModal(true);
  };

  const handleCardDetailsOpen = (cardId: string) => {
    setSelectedCardForDetails(cardId);
  };

  const handleCardDetailsClose = () => {
    setSelectedCardForDetails(null);
  };

  const handleRetry = () => {
    setError(null);
  };

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const toggleCardType = (cardType: CardType) => {
    if (expandedCardType === cardType) {
      setExpandedCardType(null);
    } else {
      setExpandedCardType(cardType);
    }
  };

  // Check if an E card can be played based on phase restriction
  const canPlayCard = (card: any): boolean => {
    if (card.card_type !== 'E') return false;

    // If no phase restriction or restriction is "Any", card can always be played
    if (!card.phase_restriction || card.phase_restriction === 'Any') return true;

    // Otherwise, check if current phase matches the restriction
    return currentPhase?.toUpperCase() === card.phase_restriction.toUpperCase();
  };

  // Handle playing a card
  const handlePlayCard = async (cardId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await gameServices.cardService.playCard(playerId, cardId);
    } catch (err: any) {
      setError(err.message || 'Failed to activate. Please try again.');
      console.error(`Card play error:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  // Summary content - always visible
  const summary = (
    <span>
      {totalCards} Expeditor{totalCards !== 1 ? 's' : ''}
      {playableCount > 0 && (
        <span style={{
          marginLeft: '8px',
          padding: '2px 6px',
          backgroundColor: '#22c55e',
          color: 'white',
          borderRadius: '10px',
          fontSize: '10px',
          fontWeight: 'bold',
          animation: 'pulse 2s infinite'
        }}>
          ⚡ {playableCount} available
        </span>
      )}
    </span>
  );

  if (renderMode === 'content') {
    return (
      <>
        <div className="cards-content">
          {headerActions && <div className="section-header-actions">{headerActions}</div>}
          {error && <div className="section-error"><p>{error}</p>{handleRetry && <button onClick={handleRetry}>Retry</button>}</div>}
          {playerHand.length > 0 ? (
            <div className="card-list">
              {(Object.keys(cardCounts) as CardType[]).map((cardType) => {
                const cardsOfType = playerHand
                  .map(cardId => ({ id: cardId, card: gameServices.dataService.getCardById(cardId) }))
                  .filter(item => item.card && gameServices.cardService.getCardType(item.id) === cardType);
                const isTypeExpanded = expandedCardType === cardType;
                const playableInGroup = cardType === 'E' ? cardsOfType.filter(item => item.card && canPlayCard(item.card)).length : 0;
                return (
                  <div key={cardType} className="card-type-group">
                    <button className="card-type-header" onClick={() => toggleCardType(cardType)}
                      style={playableInGroup > 0 ? { backgroundColor: '#dcfce7', borderColor: '#22c55e' } : undefined}>
                      <span className="card-type-info">
                        <span className="expand-icon">{isTypeExpanded ? '▼' : '▶'}</span>
                        <span className="card-type-name">Expeditors ({cardsOfType.length})</span>
                        {playableInGroup > 0 && (
                          <span style={{ marginLeft: '8px', padding: '1px 6px', backgroundColor: '#22c55e', color: 'white', borderRadius: '8px', fontSize: '9px', fontWeight: 'bold' }}>
                            ⚡ {playableInGroup} available
                          </span>
                        )}
                      </span>
                    </button>
                    {isTypeExpanded && (
                      <div className="cards-list">
                        {cardsOfType.map((item) => {
                          if (!item.card) return null;
                          const isCardExpanded = expandedCards.has(item.id);
                          const isPlayable = item.card.card_type === 'E' && canPlayCard(item.card);
                          const cardActions = (
                            <>
                              <div className="card-action-row">
                                <ActionButton label="View Details" variant="secondary" onClick={() => handleCardDetailsOpen(item.id)} disabled={isLoading} ariaLabel={`View details for ${item.card.card_name}`} />
                              </div>
                              {item.card.card_type === 'E' && isPlayable && (
                                <div className="card-action-row">
                                  <ActionButton label="Activate Expeditor" variant="primary" onClick={() => handlePlayCard(item.id)} disabled={isLoading} isLoading={isLoading} ariaLabel={`Activate ${item.card.card_name}`} />
                                </div>
                              )}
                              {item.card.card_type === 'E' && !isPlayable && item.card.phase_restriction !== 'Any' && (
                                <div className="card-restriction-message">Can only be activated during {item.card.phase_restriction} phase{currentPhase && ` (Current: ${currentPhase})`}</div>
                              )}
                            </>
                          );
                          return (
                            <CardDisplay key={item.id} card={item.card} variant="detailed" isExpanded={isCardExpanded} onToggle={() => toggleCard(item.id)} isPlayable={isPlayable} highlight={isPlayable ? 'playable' : 'none'} actions={cardActions} />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">No expeditors hired yet.</div>
          )}
          <div className="card-actions">
            <ActionButton label="View History" variant="secondary" onClick={handleViewDiscarded} disabled={isLoading} ariaLabel="View resource history" />
          </div>
        </div>
        <DiscardPileModal isOpen={showDiscardedModal} onClose={() => setShowDiscardedModal(false)} onOpenCardDetailsModal={handleCardDetailsOpen} />
        {selectedCardForDetails && (
          <CardDetailsModal isOpen={true} onClose={handleCardDetailsClose} card={gameServices.dataService.getCardById(selectedCardForDetails) || null} currentPlayer={player} otherPlayers={gameServices.stateService.getAllPlayers().filter(p => p.id !== playerId)} cardService={gameServices.cardService} />
        )}
      </>
    );
  }

  return (
    <>
      <ExpandableSection
        title="EXPEDITORS"
        icon="⚡"
        hasAction={hasCardActions}
              isExpanded={isExpanded}
              onToggle={() => setIsExpanded(!isExpanded)}        ariaControls="cards-content"
        isLoading={isLoading}
        error={error || undefined}
        onRetry={error ? handleRetry : undefined}
        headerActions={headerActions}
        summary={summary}
      >
      <div className="cards-content" id="cards-content">

        {/* Card List - grouped by type */}
        {playerHand.length > 0 ? (
          <div className="card-list">
            {(Object.keys(cardCounts) as CardType[]).map((cardType) => {
              // Get all cards of this type
              const cardsOfType = playerHand
                .map(cardId => ({
                  id: cardId,
                  card: gameServices.dataService.getCardById(cardId)
                }))
                .filter(item => item.card && gameServices.cardService.getCardType(item.id) === cardType);

              const isTypeExpanded = expandedCardType === cardType;

              // Count playable cards in this type group
              const playableInGroup = cardType === 'E'
                ? cardsOfType.filter(item => item.card && canPlayCard(item.card)).length
                : 0;

              return (
                <div key={cardType} className="card-type-group">
                  <button
                    className="card-type-header"
                    onClick={() => toggleCardType(cardType)}
                    style={playableInGroup > 0 ? {
                      backgroundColor: '#dcfce7',
                      borderColor: '#22c55e'
                    } : undefined}
                  >
                    <span className="card-type-info">
                      <span className="expand-icon">{isTypeExpanded ? '▼' : '▶'}</span>
                      <span className="card-type-name">Expeditors ({cardsOfType.length})</span>
                      {/* Show playable badge for E cards */}
                      {playableInGroup > 0 && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '1px 6px',
                          backgroundColor: '#22c55e',
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '9px',
                          fontWeight: 'bold'
                        }}>
                          ⚡ {playableInGroup} available
                        </span>
                      )}
                    </span>
                  </button>

                  {isTypeExpanded && (
                    <div className="cards-list">
                      {cardsOfType.map((item) => {
                        if (!item.card) return null;
                        const isCardExpanded = expandedCards.has(item.id);
                        const isPlayable = item.card.card_type === 'E' && canPlayCard(item.card);

                        // Build action buttons for this card
                        const cardActions = (
                          <>
                            <div className="card-action-row">
                              <ActionButton
                                label="View Details"
                                variant="secondary"
                                onClick={() => handleCardDetailsOpen(item.id)}
                                disabled={isLoading}
                                ariaLabel={`View details for ${item.card.card_name}`}
                              />
                            </div>
                            {item.card.card_type === 'E' && isPlayable && (
                              <div className="card-action-row">
                                <ActionButton
                                  label="Activate Expeditor"
                                  variant="primary"
                                  onClick={() => handlePlayCard(item.id)}
                                  disabled={isLoading}
                                  isLoading={isLoading}
                                  ariaLabel={`Activate ${item.card.card_name}`}
                                />
                              </div>
                            )}
                            {item.card.card_type === 'E' && !isPlayable && item.card.phase_restriction !== 'Any' && (
                              <div className="card-restriction-message">
                                Can only be activated during {item.card.phase_restriction} phase
                                {currentPhase && ` (Current: ${currentPhase})`}
                              </div>
                            )}
                          </>
                        );

                        return (
                          <CardDisplay
                            key={item.id}
                            card={item.card}
                            variant="detailed"
                            isExpanded={isCardExpanded}
                            onToggle={() => toggleCard(item.id)}
                            isPlayable={isPlayable}
                            highlight={isPlayable ? 'playable' : 'none'}
                            actions={cardActions}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            No expeditors hired yet.
          </div>
        )}

        <div className="card-actions">
          <ActionButton
            label="View History"
            variant="secondary"
            onClick={handleViewDiscarded}
            disabled={isLoading}
            ariaLabel="View resource history"
          />
        </div>
      </div>
      </ExpandableSection>

      {/* Discarded Cards Modal */}
      <DiscardPileModal
        isOpen={showDiscardedModal}
        onClose={() => setShowDiscardedModal(false)}
        onOpenCardDetailsModal={handleCardDetailsOpen}
      />

      {/* Card Details Modal */}
      {selectedCardForDetails && (
        <CardDetailsModal
          isOpen={true}
          onClose={handleCardDetailsClose}
          card={gameServices.dataService.getCardById(selectedCardForDetails) || null}
          currentPlayer={player}
          otherPlayers={gameServices.stateService.getAllPlayers().filter(p => p.id !== playerId)}
          cardService={gameServices.cardService}
        />
      )}
    </>
  );
};
