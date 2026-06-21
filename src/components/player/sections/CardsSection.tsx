import React, { useState } from 'react';
import { ExpandableSection } from '../ExpandableSection';
import { ActionButton } from '../ActionButton';
import { CardDisplay } from '../../common/CardDisplay';
import { IServiceContainer } from '../../../types/ServiceContracts';
import { Card, CardType } from '../../../types/DataTypes';
import { DiscardPileModal } from '../../modals/DiscardPileModal';
import { CardDetailsModal } from '../../modals/CardDetailsModal';
import { PHASE_COLORS } from '../../../utils/boardCommon';
import './CardsSection.css';

/**
 * Expeditor phase chip (fb:f8dc7c38). A player with many filing reps couldn't
 * tell which phase each serves; this maps an E card's `phase_restriction` to a
 * colored label + a sort order so same-phase expeditors cluster and duplicates
 * are easy to spot when deciding which to let go. Colors reuse the board's
 * PHASE_COLORS so the chip matches the tile/phase-bar palette (note E cards
 * spell it REGULATORY_REVIEW where the palette key is REGULATORY).
 */
const NEUTRAL_PHASE = { border: '#9e9e9e', text: '#616161' };
const EXPEDITOR_PHASES: Record<string, { label: string; colorKey: string; order: number }> = {
  FUNDING: { label: 'Funding', colorKey: 'FUNDING', order: 1 },
  DESIGN: { label: 'Design', colorKey: 'DESIGN', order: 2 },
  REGULATORY_REVIEW: { label: 'Regulatory', colorKey: 'REGULATORY', order: 3 },
  CONSTRUCTION: { label: 'Construction', colorKey: 'CONSTRUCTION', order: 4 },
};
function expeditorPhaseInfo(phaseRestriction?: string): { label: string; border: string; text: string; order: number } {
  const raw = (phaseRestriction || 'Any').toUpperCase();
  const known = EXPEDITOR_PHASES[raw];
  if (!known) return { label: 'Any phase', ...NEUTRAL_PHASE, order: 5 };
  const c = PHASE_COLORS[known.colorKey] || NEUTRAL_PHASE;
  return { label: known.label, border: c.border, text: c.text, order: known.order };
}
function PhaseChip({ phaseRestriction }: { phaseRestriction?: string }) {
  const p = expeditorPhaseInfo(phaseRestriction);
  return (
    <span
      title={`Works during the ${p.label} phase`}
      style={{
        marginLeft: '6px', padding: '1px 7px', borderRadius: '9px',
        fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap',
        color: p.text, border: `1px solid ${p.border}`, backgroundColor: `${p.border}1a`,
      }}
    >
      {p.label}
    </span>
  );
}

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
 * - "View Discarded" button (always visible - secondary action)
 *
 * Dice and manual effect buttons (draw_e, replace_e, roll_for_*) used to live
 * here but were lifted into ActionCenterPanel's YOUR ACTIONS section to avoid
 * duplication. CardsSection is now display-only for the player's E-card hand.
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
  // isRollingDice removed — dice roll buttons are now in ActionCenterPanel
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

  // v3.0.42: lowercase comparison — CSV stores DRAW actions as 'draw_E'
  // (uppercase suffix). Pre-fix the strict 'draw_e' check never matched,
  // so this section's `hasCardActions` was silently false and the EXPEDITORS
  // panel never got its "needs action" badge even when the player had a
  // pending draw. Same bug class as the v3.0.41 Owner Funding fix.
  const cardManualEffects = conditionFilteredEffects.filter(effect => {
    if (effect.trigger_type !== 'manual' || effect.effect_type !== 'cards') return false;
    const action = effect.effect_action?.toLowerCase() || '';
    return action === 'draw_e' || action === 'replace_e'
      || action === 'give_e' || action === 'return_e'
      || action === 'transfer';
  });

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

  // No action buttons here — all manual effects (draw_e, replace_e, etc.) and dice
  // effects are rendered in ActionCenterPanel's YOUR ACTIONS section to avoid duplication.
  const headerActions = undefined;

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

  // Check if an E card can be played based on phase restriction and effect applicability
  const canPlayCard = (card: Card): boolean => {
    if (card.card_type !== 'E') return false;

    // Check phase restriction
    if (card.phase_restriction && card.phase_restriction !== 'Any') {
      if (currentPhase?.toUpperCase() !== card.phase_restriction.toUpperCase()) return false;
    }

    // Block time-reduction-only cards when timeSpent is 0
    if (card.tick_modifier) {
      const tickVal = parseInt(card.tick_modifier, 10);
      if (!isNaN(tickVal) && tickVal < 0 && (player.timeSpent || 0) === 0) {
        const hasMoney = card.money_effect && parseInt(card.money_effect, 10) !== 0;
        const hasDraw = card.draw_cards && parseInt(card.draw_cards, 10) > 0;
        if (!hasMoney && !hasDraw) return false;
      }
    }

    // Block unaffordable cards — money_effect encodes the spend cost for
    // cards like E030 "Time Crunch" ($8k). card.cost covers fixed-cost cards
    // but E cards use money_effect for their activation spend.
    if (card.money_effect) {
      const moneyCost = parseInt(card.money_effect, 10);
      if (!isNaN(moneyCost) && moneyCost < 0 && player.money < Math.abs(moneyCost)) {
        return false;
      }
    }

    return true;
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
                  .filter(item => item.card && gameServices.cardService.getCardType(item.id) === cardType)
                  .sort((a, b) => {
                    const pa = expeditorPhaseInfo(a.card?.phase_restriction);
                    const pb = expeditorPhaseInfo(b.card?.phase_restriction);
                    return pa.order - pb.order || (a.card?.card_name || '').localeCompare(b.card?.card_name || '');
                  });
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
                          const cardMoneyCost = item.card.money_effect ? parseInt(item.card.money_effect, 10) : 0;
                          const isUnaffordable = !isNaN(cardMoneyCost) && cardMoneyCost < 0 && player.money < Math.abs(cardMoneyCost);
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
                              {item.card.card_type === 'E' && !isPlayable && isUnaffordable && (
                                <div className="card-restriction-message" style={{ color: '#dc3545' }}>
                                  💸 Not enough funds — costs ${Math.abs(cardMoneyCost).toLocaleString()}, you have ${player.money.toLocaleString()}
                                </div>
                              )}
                              {item.card.card_type === 'E' && !isPlayable && !isUnaffordable && item.card.phase_restriction !== 'Any' && (
                                <div className="card-restriction-message">Can only be activated during {item.card.phase_restriction} phase{currentPhase && ` (Current: ${currentPhase})`}</div>
                              )}
                            </>
                          );
                          return (
                            <CardDisplay key={item.id} card={item.card} variant="detailed" isExpanded={isCardExpanded} onToggle={() => toggleCard(item.id)} isPlayable={isPlayable} highlight={isPlayable ? 'playable' : 'none'} actions={cardActions} headerBadge={<PhaseChip phaseRestriction={item.card.phase_restriction} />} />
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
                .filter(item => item.card && gameServices.cardService.getCardType(item.id) === cardType)
                .sort((a, b) => {
                  const pa = expeditorPhaseInfo(a.card?.phase_restriction);
                  const pb = expeditorPhaseInfo(b.card?.phase_restriction);
                  return pa.order - pb.order || (a.card?.card_name || '').localeCompare(b.card?.card_name || '');
                });

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
                        const cardMoneyCost2 = item.card.money_effect ? parseInt(item.card.money_effect, 10) : 0;
                        const isUnaffordable2 = !isNaN(cardMoneyCost2) && cardMoneyCost2 < 0 && player.money < Math.abs(cardMoneyCost2);

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
                            {item.card.card_type === 'E' && !isPlayable && isUnaffordable2 && (
                              <div className="card-restriction-message" style={{ color: '#dc3545' }}>
                                💸 Not enough funds — costs ${Math.abs(cardMoneyCost2).toLocaleString()}, you have ${player.money.toLocaleString()}
                              </div>
                            )}
                            {item.card.card_type === 'E' && !isPlayable && !isUnaffordable2 && item.card.phase_restriction !== 'Any' && (
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
                            headerBadge={<PhaseChip phaseRestriction={item.card.phase_restriction} />}
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
