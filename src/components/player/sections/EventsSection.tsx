import React, { useState } from 'react';
import { ExpandableSection } from '../ExpandableSection';
import { ActionButton } from '../ActionButton';
import { CardDisplay } from '../../common/CardDisplay';
import { IServiceContainer } from '../../../types/ServiceContracts';
import { CardDetailsModal } from '../../modals/CardDetailsModal';
import { formatManualEffectButton } from '../../../utils/buttonFormatting';

export interface EventsSectionProps {
  gameServices: IServiceContainer;
  playerId: string;
  onManualEffectResult?: (result: import('../../../types/StateTypes').TurnEffectResult) => void;
  completedActions?: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };
  isMyTurn?: boolean;
  renderMode?: 'accordion' | 'content';
}

export const EventsSection: React.FC<EventsSectionProps> = ({
  gameServices,
  playerId,
  onManualEffectResult,
  completedActions = { manualActions: {} },
  isMyTurn = true,
  renderMode = 'accordion'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedCardForDetails, setSelectedCardForDetails] = useState<string | null>(null);

  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  // Get L cards from player's hand
  const playerHand = player.hand || [];
  const lCards = playerHand
    .map(cardId => ({ id: cardId, card: gameServices.dataService.getCardById(cardId) }))
    .filter(item => item.card && item.card.card_type === 'L');

  // Get L card manual effects from current space
  const allSpaceEffects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType);
  const conditionFilteredEffects = gameServices.turnService.filterSpaceEffectsByCondition(allSpaceEffects, player) || [];
  const lCardManualEffects = conditionFilteredEffects.filter(
    effect => effect.trigger_type === 'manual' &&
              effect.effect_type === 'cards' &&
              effect.effect_action === 'draw_l'
  );

  const hasLCardActions = lCardManualEffects.length > 0;

  // Get active duration effects from L cards
  const activeLEffects = (player.activeCards || []).filter(ac => {
    const card = gameServices.dataService.getCardById(ac.cardId);
    return card && card.card_type === 'L';
  });

  const handleManualEffect = async (effectKey: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gameServices.turnService.triggerManualEffectWithFeedback(playerId, effectKey);
      if (onManualEffectResult && result) onManualEffectResult(result);
    } catch (err) {
      setError(`Failed to perform action. Please try again.`);
      console.error(`Manual effect error (${effectKey}):`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => setError(null);

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) newSet.delete(cardId);
      else newSet.add(cardId);
      return newSet;
    });
  };

  // Header actions for L card draws
  const headerActions = lCardManualEffects.length > 0 ? (
    <>
      {lCardManualEffects.map((effect, index) => {
        const effectKey = `${effect.effect_type}:${effect.effect_action}`;
        const completedKeys = Object.keys(completedActions.manualActions);
        const isEffectCompleted = completedKeys.some(key =>
          key === effectKey || key.toLowerCase() === effectKey.toLowerCase()
        );
        // Voice rule (v2.61.1 sweep extended 2026-05-23): real-life label
        // from formatManualEffectButton instead of effect.description.
        const lButtonText = formatManualEffectButton(effect).text || 'Life Event';
        return !isEffectCompleted && (
          <ActionButton
            key={`l-manual-${index}`}
            label={isMyTurn ? lButtonText : "Wait for your turn"}
            variant="primary"
            onClick={() => handleManualEffect(effectKey)}
            disabled={!isMyTurn || isLoading}
            isLoading={isLoading}
            ariaLabel={isMyTurn ? 'Trigger a life event' : 'Wait for your turn'}
          />
        );
      })}
    </>
  ) : undefined;

  const summary = (
    <span>{lCards.length} Life Event{lCards.length !== 1 ? 's' : ''}{activeLEffects.length > 0 ? ` | ${activeLEffects.length} active` : ''}</span>
  );

  const content = (
    <div className="events-content">
      {headerActions && <div className="section-header-actions">{headerActions}</div>}
      {error && <div className="section-error"><p>{error}</p><button onClick={handleRetry}>Retry</button></div>}

      {/* Active L card effects */}
      {activeLEffects.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#343a40', marginBottom: '6px' }}>
            Active Effects
          </div>
          {activeLEffects.map(ac => {
            const card = gameServices.dataService.getCardById(ac.cardId);
            if (!card) return null;
            return (
              <div key={ac.cardId} style={{
                padding: '6px 8px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                marginBottom: '4px',
                fontSize: '11px'
              }}>
                <div style={{ fontWeight: 'bold', color: '#343a40' }}>{card.card_name}</div>
                {card.description && <div style={{ color: '#495057', marginTop: '2px' }}>{card.description}</div>}
                {ac.expirationTurn !== undefined && (
                  <div style={{ color: '#856404', marginTop: '2px' }}>Expires turn {ac.expirationTurn}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* L cards in hand */}
      {lCards.length > 0 ? (
        <div className="card-list">
          {lCards.map(item => {
            if (!item.card) return null;
            const isCardExpanded = expandedCards.has(item.id);
            const cardActions = (
              <div className="card-action-row">
                <ActionButton
                  label="View Details"
                  variant="secondary"
                  onClick={() => setSelectedCardForDetails(item.id)}
                  disabled={isLoading}
                  ariaLabel={`View details for ${item.card.card_name}`}
                />
              </div>
            );
            return (
              <CardDisplay
                key={item.id}
                card={item.card}
                variant="detailed"
                isExpanded={isCardExpanded}
                onToggle={() => toggleCard(item.id)}
                highlight="none"
                actions={cardActions}
              />
            );
          })}
        </div>
      ) : (
        <div className="empty-state">No life events yet.</div>
      )}
    </div>
  );

  if (renderMode === 'content') {
    return (
      <>
        {content}
        {selectedCardForDetails && (
          <CardDetailsModal
            isOpen={true}
            onClose={() => setSelectedCardForDetails(null)}
            card={gameServices.dataService.getCardById(selectedCardForDetails) || null}
            currentPlayer={player}
            otherPlayers={gameServices.stateService.getAllPlayers().filter(p => p.id !== playerId)}
            cardService={gameServices.cardService}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ExpandableSection
        title="EVENTS"
        icon="🎲"
        hasAction={hasLCardActions}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        ariaControls="events-content"
        isLoading={isLoading}
        error={error || undefined}
        onRetry={error ? handleRetry : undefined}
        headerActions={headerActions}
        summary={summary}
      >
        {content}
      </ExpandableSection>
      {selectedCardForDetails && (
        <CardDetailsModal
          isOpen={true}
          onClose={() => setSelectedCardForDetails(null)}
          card={gameServices.dataService.getCardById(selectedCardForDetails) || null}
          currentPlayer={player}
          otherPlayers={gameServices.stateService.getAllPlayers().filter(p => p.id !== playerId)}
          cardService={gameServices.cardService}
        />
      )}
    </>
  );
};
