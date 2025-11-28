import React, { useState, useEffect } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { Card } from '../../types/DataTypes';
import { ActionButton } from '../common/ActionButton';
import { colors } from '../../styles/theme';

/**
 * Props for the DiscardPileModal component.
 */
interface DiscardPileModalProps {
  /** Game services container providing access to all game services. */
  gameServices: IServiceContainer;
  /** The ID of the player whose discard pile is being displayed. */
  playerId: string;
  /** Boolean indicating whether the modal is currently open. */
  isOpen: boolean;
  /** Callback function to close the modal. */
  onClose: () => void;
}

/**
 * DiscardPileModal Component
 *
 * Displays a modal showing the discarded cards for a specific player.
 * Allows filtering by card type and sorting by card name or type.
 *
 * @param {DiscardPileModalProps} props - The props for the component.
 * @returns {JSX.Element} The rendered DiscardPileModal component.
 */
export function DiscardPileModal({ gameServices, playerId, isOpen, onClose }: DiscardPileModalProps) {
  const [discardedCards, setDiscardedCards] = useState<Card[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'W' | 'B' | 'E' | 'L' | 'I'>('all');
  const [sortBy, setSortBy] = useState<'type' | 'name' | 'turn'>('turn');

  useEffect(() => {
    if (!isOpen) return;

    const fetchDiscardedCards = () => {
      const allDiscardedCardIds: string[] = [];
      const gameState = gameServices.stateService.getGameState();
      
      // Collect all discarded cards from global discard piles
      for (const cardType of ['W', 'B', 'E', 'L', 'I']) {
        allDiscardedCardIds.push(...(gameState.discardPiles[cardType as keyof typeof gameState.discardPiles] || []));
      }

      // Filter cards that belong to this specific player (based on log or previous ownership)
      // For now, we'll assume all cards in global discard are relevant for display.
      // A more robust implementation might track player-specific discards in a log.
      const playerSpecificDiscardedCardIds = allDiscardedCardIds; // Simplification for now

      const cards = playerSpecificDiscardedCardIds
        .map(cardId => gameServices.dataService.getCardById(cardId))
        .filter((card): card is Card => card !== undefined); // Filter out undefined cards

      setDiscardedCards(cards);
    };

    fetchDiscardedCards();

    // Subscribe to state changes to keep the discarded pile up-to-date
    const unsubscribe = gameServices.stateService.subscribe(() => {
      fetchDiscardedCards();
    });

    return unsubscribe;
  }, [isOpen, gameServices, playerId]);

  const filteredCards = discardedCards.filter(card => 
    filterType === 'all' || card.card_type === filterType
  );

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === 'type') return a.card_type.localeCompare(b.card_type);
    if (sortBy === 'name') return a.card_name.localeCompare(b.card_name);
    // 'turn' requires tracking the turn of discard, which is not currently in Card type
    // For now, default to name sort if 'turn' is selected without actual turn data
    return a.card_name.localeCompare(b.card_name);
  });

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1001,
    }}>
      <div style={{
        backgroundColor: colors.white,
        borderRadius: '8px',
        padding: '20px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90%',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: colors.primary.main,
          marginBottom: '15px',
          borderBottom: `1px solid ${colors.secondary.border}`,
          paddingBottom: '10px',
          textAlign: 'center',
        }}>
          Discard Pile for {gameServices.stateService.getPlayer(playerId)?.name}
        </h2>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'center' }}>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}
            style={{ padding: '8px', borderRadius: '4px', border: `1px solid ${colors.secondary.border}` }}
            aria-label="Filter cards by type" // Added aria-label
          >
            <option value="all">All Types</option>
            <option value="W">Work</option>
            <option value="B">Bank Loan</option>
            <option value="E">Expeditor</option>
            <option value="L">Life Event</option>
            <option value="I">Investor</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
            style={{ padding: '8px', borderRadius: '4px', border: `1px solid ${colors.secondary.border}` }}
            aria-label="Sort cards by" // Added aria-label
          >
            <option value="name">Sort by Name</option>
            <option value="type">Sort by Type</option>
            {/* <option value="turn">Sort by Turn</option> */}
          </select>
        </div>

        {sortedCards.length === 0 ? (
          <p style={{ textAlign: 'center', color: colors.text.secondary }}>Discard pile is empty.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, flexGrow: 1 }}>
            {sortedCards.map(card => (
              <li key={card.card_id} style={{
                backgroundColor: colors.secondary.light,
                borderRadius: '6px',
                padding: '10px 15px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: `1px solid ${colors.secondary.border}`,
              }}>
                <span style={{ fontWeight: 'bold', color: colors.text.primary }}>{card.card_name}</span>
                <span style={{ 
                  backgroundColor: colors.info.light, 
                  color: colors.info.dark, 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  fontSize: '0.8rem' 
                }}>{card.card_type}</span>
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
          <ActionButton
            label="Close"
            variant="secondary"
            onClick={onClose}
            disabled={false}
            ariaLabel="Close discard pile modal"
          />
        </div>
      </div>
    </div>
  );
}
