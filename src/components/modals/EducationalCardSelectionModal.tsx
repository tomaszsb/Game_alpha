// src/components/modals/EducationalCardSelectionModal.tsx
// Modal for selecting starting cards in Educational mode (Same Starting Point variant)

import React, { useState, useMemo } from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { CardDisplay } from '../common/CardDisplay';
import { IDataService } from '../../types/ServiceContracts';
import { Card, CardType } from '../../types/DataTypes';
import { colors, theme } from '../../styles/theme';

type CardTypeFilter = 'ALL' | 'W' | 'E';

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
  const [cardTypeFilter, setCardTypeFilter] = useState<CardTypeFilter>('ALL');
  const [workTypeFilter, setWorkTypeFilter] = useState<string>('ALL');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Get W and E cards (the types drawn at game start)
  const allCards = useMemo(() => {
    const wCards = dataService.getCardsByType('W' as CardType);
    const eCards = dataService.getCardsByType('E' as CardType);
    return [...wCards, ...eCards];
  }, [dataService]);

  // Get unique work types
  const workTypes = useMemo(() => {
    const types = new Set<string>();
    allCards.forEach(card => {
      if (card.work_type_restriction) {
        types.add(card.work_type_restriction);
      }
    });
    return Array.from(types).sort();
  }, [allCards]);

  // Filter cards based on current filters
  const filteredCards = useMemo(() => {
    let filtered = allCards;

    // Filter by card type (W/E)
    if (cardTypeFilter !== 'ALL') {
      filtered = filtered.filter(card => card.card_id.startsWith(cardTypeFilter));
    }

    // Filter by work type
    if (workTypeFilter !== 'ALL') {
      filtered = filtered.filter(card => card.work_type_restriction === workTypeFilter);
    }

    return filtered;
  }, [allCards, cardTypeFilter, workTypeFilter]);

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

  const handleCardClick = (cardId: string) => {
    // Toggle expanded view for this card
    setExpandedCardId(prev => prev === cardId ? null : cardId);
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
    marginBottom: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
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

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: '14px',
    border: `1px solid ${colors.secondary.border}`,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: colors.white,
    cursor: 'pointer',
    minHeight: theme.mobile.minTapTarget,
    minWidth: '180px',
  };

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
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

  const cardWrapperStyle = (isExpanded: boolean): React.CSSProperties => ({
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    transform: isExpanded ? 'scale(1.02)' : 'scale(1)',
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
      maxWidth="1000px"
      testId="educational-card-selection-modal"
    >
      {/* Card Type Filter tabs */}
      <div style={filterContainerStyle}>
        <button
          onClick={() => setCardTypeFilter('ALL')}
          style={filterButtonStyle(cardTypeFilter === 'ALL')}
        >
          All ({allCards.length})
        </button>
        <button
          onClick={() => setCardTypeFilter('W')}
          style={filterButtonStyle(cardTypeFilter === 'W')}
        >
          W Cards ({allCards.filter(c => c.card_id.startsWith('W')).length})
        </button>
        <button
          onClick={() => setCardTypeFilter('E')}
          style={filterButtonStyle(cardTypeFilter === 'E')}
        >
          E Cards ({allCards.filter(c => c.card_id.startsWith('E')).length})
        </button>
      </div>

      {/* Work Type Filter dropdown */}
      <div style={{ ...filterContainerStyle, marginBottom: '16px' }}>
        <label style={{ fontWeight: '500', color: colors.text.primary }}>
          Work Type:
        </label>
        <select
          value={workTypeFilter}
          onChange={(e) => setWorkTypeFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="ALL">All Work Types ({filteredCards.length} cards)</option>
          {workTypes.map(type => {
            const count = allCards.filter(c =>
              c.work_type_restriction === type &&
              (cardTypeFilter === 'ALL' || c.card_id.startsWith(cardTypeFilter))
            ).length;
            return (
              <option key={type} value={type}>
                {type} ({count})
              </option>
            );
          })}
        </select>
        <span style={{ fontSize: '13px', color: colors.text.secondary, marginLeft: '8px' }}>
          Click a card to see details
        </span>
      </div>

      {/* Card grid */}
      <div style={cardGridStyle}>
        {filteredCards.map(card => {
          const isExpanded = expandedCardId === card.card_id;
          return (
            <div
              key={card.card_id}
              style={cardWrapperStyle(isExpanded)}
              onClick={() => handleCardClick(card.card_id)}
            >
              <CardDisplay
                card={card}
                variant={isExpanded ? 'detailed' : 'compact'}
                isExpanded={isExpanded}
                selectable={true}
                isSelected={selectedCardIds.includes(card.card_id)}
                onSelect={() => handleCardToggle(card.card_id)}
              />
            </div>
          );
        })}
      </div>

      {filteredCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: colors.text.secondary }}>
          No cards found matching filters
        </div>
      )}
    </ModalBase>
  );
}

export default EducationalCardSelectionModal;
