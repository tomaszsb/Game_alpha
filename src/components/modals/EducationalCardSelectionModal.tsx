// src/components/modals/EducationalCardSelectionModal.tsx
// Modal for selecting starting cards in Educational mode (Same Starting Point variant)

import React, { useState, useMemo } from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { CardDisplay } from '../common/CardDisplay';
import { IDataService } from '../../types/ServiceContracts';
import { Card, CardType } from '../../types/DataTypes';
import { colors, theme } from '../../styles/theme';

type FilterType = 'ALL' | 'W' | 'E';

interface EducationalCardSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedCardIds: string[]) => void;
  initialSelection?: string[];
  dataService: IDataService;
}

export function EducationalCardSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  initialSelection = [],
  dataService,
}: EducationalCardSelectionModalProps): JSX.Element | null {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(initialSelection);
  const [filter, setFilter] = useState<FilterType>('ALL');

  // Get W and E cards (the types drawn at game start)
  const allCards = useMemo(() => {
    const wCards = dataService.getCardsByType('W' as CardType);
    const eCards = dataService.getCardsByType('E' as CardType);
    return [...wCards, ...eCards];
  }, [dataService]);

  // Filter cards based on current filter
  const filteredCards = useMemo(() => {
    if (filter === 'ALL') return allCards;
    return allCards.filter(card => card.card_id.startsWith(filter));
  }, [allCards, filter]);

  // Count selected by type
  const selectionCounts = useMemo(() => {
    const wCount = selectedCardIds.filter(id => id.startsWith('W')).length;
    const eCount = selectedCardIds.filter(id => id.startsWith('E')).length;
    return { w: wCount, e: eCount, total: wCount + eCount };
  }, [selectedCardIds]);

  const handleCardToggle = (cardId: string) => {
    setSelectedCardIds(prev => {
      const isSelected = prev.includes(cardId);
      if (isSelected) {
        return prev.filter(id => id !== cardId);
      } else {
        return [...prev, cardId];
      }
    });
  };

  const handleConfirm = () => {
    onConfirm(selectedCardIds);
  };

  const handleClearSelection = () => {
    setSelectedCardIds([]);
  };

  // Styles
  const filterContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  };

  const filterButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: isActive ? '600' : '500',
    color: isActive ? colors.white : colors.text.primary,
    backgroundColor: isActive ? colors.primary.main : colors.secondary.light,
    border: `1px solid ${isActive ? colors.primary.main : colors.secondary.border}`,
    borderRadius: theme.borderRadius.sm,
    cursor: 'pointer',
    transition: theme.transitions.fast,
    minHeight: theme.mobile.minTapTarget,
  });

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
    maxHeight: '50vh',
    overflowY: 'auto',
    padding: '4px',
  };

  const selectionSummaryStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flex: 1,
    flexWrap: 'wrap',
  };

  const countBadgeStyle = (type: 'W' | 'E'): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: '13px',
    fontWeight: '500',
    backgroundColor: type === 'W' ? colors.warning.light : colors.info.light,
    color: type === 'W' ? colors.warning.dark : colors.info.dark,
    borderRadius: theme.borderRadius.sm,
  });

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
      <div style={selectionSummaryStyle}>
        <span style={{ fontWeight: '500' }}>
          {selectionCounts.total} card{selectionCounts.total !== 1 ? 's' : ''} selected
        </span>
        {selectionCounts.w > 0 && (
          <span style={countBadgeStyle('W')}>{selectionCounts.w} W</span>
        )}
        {selectionCounts.e > 0 && (
          <span style={countBadgeStyle('E')}>{selectionCounts.e} E</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {selectedCardIds.length > 0 && (
          <button
            onClick={handleClearSelection}
            style={modalButtonStyles.secondary}
          >
            Clear
          </button>
        )}
        <button
          onClick={onClose}
          style={modalButtonStyles.secondary}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          style={modalButtonStyles.primary}
        >
          Confirm
        </button>
      </div>
    </div>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Select Starting Cards"
      emoji="📚"
      footer={footer}
      maxWidth="900px"
      testId="educational-card-selection-modal"
    >
      {/* Filter tabs */}
      <div style={filterContainerStyle}>
        <button
          onClick={() => setFilter('ALL')}
          style={filterButtonStyle(filter === 'ALL')}
        >
          All Cards ({allCards.length})
        </button>
        <button
          onClick={() => setFilter('W')}
          style={filterButtonStyle(filter === 'W')}
        >
          W Cards ({allCards.filter(c => c.card_id.startsWith('W')).length})
        </button>
        <button
          onClick={() => setFilter('E')}
          style={filterButtonStyle(filter === 'E')}
        >
          E Cards ({allCards.filter(c => c.card_id.startsWith('E')).length})
        </button>
      </div>

      {/* Card grid */}
      <div style={cardGridStyle}>
        {filteredCards.map(card => (
          <CardDisplay
            key={card.card_id}
            card={card}
            variant="compact"
            selectable={true}
            isSelected={selectedCardIds.includes(card.card_id)}
            onSelect={() => handleCardToggle(card.card_id)}
          />
        ))}
      </div>

      {filteredCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: colors.text.secondary }}>
          No cards found
        </div>
      )}
    </ModalBase>
  );
}

export default EducationalCardSelectionModal;
