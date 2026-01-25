// src/components/player/mobile/DetailSheet.tsx
//
// Draggable bottom sheet with tabs for detailed information.
// Created: January 24, 2026

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IServiceContainer } from '../../../types/ServiceContracts';
import './DetailSheet.css';

export type DetailTab = 'finances' | 'time' | 'cards' | 'scope' | 'log';

export interface DetailSheetProps {
  gameServices: IServiceContainer;
  playerId: string;
  isOpen: boolean;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
  onOpen: () => void;
}

interface TabConfig {
  id: DetailTab;
  icon: string;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'finances', icon: '💰', label: 'Money' },
  { id: 'time', icon: '⏱️', label: 'Time' },
  { id: 'cards', icon: '🃏', label: 'Cards' },
  { id: 'scope', icon: '📐', label: 'Scope' },
  { id: 'log', icon: '📜', label: 'Log' }
];

// Snap points for the sheet height
const SNAP_COLLAPSED = 48;  // Just the tab bar visible
const SNAP_HALF = 250;      // Half expanded
const SNAP_FULL = 400;      // Fully expanded

/**
 * DetailSheet - Draggable bottom sheet with tabs.
 * Provides access to detailed player information.
 */
export const DetailSheet: React.FC<DetailSheetProps> = ({
  gameServices,
  playerId,
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  onOpen
}) => {
  const [sheetHeight, setSheetHeight] = useState(SNAP_COLLAPSED);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Get player data
  const player = gameServices.stateService.getPlayer(playerId);

  // Update height when isOpen changes
  useEffect(() => {
    setSheetHeight(isOpen ? SNAP_HALF : SNAP_COLLAPSED);
  }, [isOpen]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    dragStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartHeight.current = sheetHeight;
  }, [sheetHeight]);

  // Handle drag move
  const handleDragMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDragging) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragStartY.current - clientY;
    const newHeight = Math.max(SNAP_COLLAPSED, Math.min(SNAP_FULL, dragStartHeight.current + deltaY));
    setSheetHeight(newHeight);
  }, [isDragging]);

  // Handle drag end - snap to nearest point
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);

    // Find nearest snap point
    const snapPoints = [SNAP_COLLAPSED, SNAP_HALF, SNAP_FULL];
    const nearest = snapPoints.reduce((prev, curr) =>
      Math.abs(curr - sheetHeight) < Math.abs(prev - sheetHeight) ? curr : prev
    );

    setSheetHeight(nearest);

    // Update open state based on snap point
    if (nearest === SNAP_COLLAPSED) {
      onClose();
    } else {
      onOpen();
    }
  }, [sheetHeight, onClose, onOpen]);

  // Add/remove global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Handle tab click - also opens sheet if collapsed
  const handleTabClick = (tab: DetailTab) => {
    onTabChange(tab);
    if (sheetHeight === SNAP_COLLAPSED) {
      setSheetHeight(SNAP_HALF);
      onOpen();
    }
  };

  if (!player) return null;

  return (
    <div
      className={`detail-sheet ${isOpen ? 'detail-sheet--open' : ''}`}
      style={{ height: sheetHeight }}
    >
      {/* Drag Handle */}
      <div
        className="detail-sheet__handle"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="detail-sheet__handle-bar" />
      </div>

      {/* Tab Bar */}
      <div className="detail-sheet__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`detail-sheet__tab ${activeTab === tab.id ? 'detail-sheet__tab--active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            aria-selected={activeTab === tab.id}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="detail-sheet__content">
        {activeTab === 'finances' && (
          <FinancesContent player={player} />
        )}
        {activeTab === 'time' && (
          <TimeContent player={player} />
        )}
        {activeTab === 'cards' && (
          <CardsContent player={player} gameServices={gameServices} />
        )}
        {activeTab === 'scope' && (
          <ScopeContent player={player} gameServices={gameServices} />
        )}
        {activeTab === 'log' && (
          <LogContent player={player} gameServices={gameServices} />
        )}
      </div>
    </div>
  );
};

// ============================================================
// Content Components
// ============================================================

import { Player } from '../../../types/StateTypes';

interface ContentProps {
  player: Player;
  gameServices?: IServiceContainer;
}

const FinancesContent: React.FC<ContentProps> = ({ player }) => (
  <div className="detail-content finances-content">
    <div className="detail-row">
      <span className="detail-label">Cash</span>
      <span className={`detail-value ${player.money >= 0 ? 'positive' : 'negative'}`}>
        ${player.money.toLocaleString()}
      </span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Owner Funding</span>
      <span className="detail-value">
        ${(player.moneySources?.ownerFunding || 0).toLocaleString()}
      </span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Bank Loans</span>
      <span className="detail-value">
        ${(player.moneySources?.bankLoans || 0).toLocaleString()}
      </span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Investments</span>
      <span className="detail-value">
        ${(player.moneySources?.investmentDeals || 0).toLocaleString()}
      </span>
    </div>
    <div className="detail-divider" />
    <div className="detail-row">
      <span className="detail-label">Design Costs</span>
      <span className="detail-value negative">
        -${(player.expenditures?.design || 0).toLocaleString()}
      </span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Fees</span>
      <span className="detail-value negative">
        -${(player.expenditures?.fees || 0).toLocaleString()}
      </span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Construction</span>
      <span className="detail-value negative">
        -${(player.expenditures?.construction || 0).toLocaleString()}
      </span>
    </div>
  </div>
);

const TimeContent: React.FC<ContentProps> = ({ player }) => (
  <div className="detail-content time-content">
    <div className="detail-row">
      <span className="detail-label">Time Spent</span>
      <span className="detail-value">{player.timeSpent} weeks</span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Current Space</span>
      <span className="detail-value">{player.currentSpace}</span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Visit Type</span>
      <span className="detail-value">{player.visitType}</span>
    </div>
    {player.activeEffects && player.activeEffects.length > 0 && (
      <>
        <div className="detail-divider" />
        <div className="detail-section-title">Active Effects</div>
        {player.activeEffects.map((effect, idx) => (
          <div key={idx} className="detail-row">
            <span className="detail-label">{effect.description || effect.effectType}</span>
            <span className="detail-value">{effect.remainingDuration} turns</span>
          </div>
        ))}
      </>
    )}
  </div>
);

const CardsContent: React.FC<ContentProps> = ({ player, gameServices }) => {
  const cardsByType: Record<string, string[]> = {
    W: [], B: [], E: [], L: [], I: []
  };

  player.hand.forEach((cardId) => {
    const type = cardId.charAt(0);
    if (cardsByType[type]) {
      cardsByType[type].push(cardId);
    }
  });

  return (
    <div className="detail-content cards-content">
      <div className="detail-row">
        <span className="detail-label">Total Cards</span>
        <span className="detail-value">{player.hand.length}</span>
      </div>
      <div className="detail-divider" />
      {Object.entries(cardsByType).map(([type, cards]) => (
        <div key={type} className="detail-row">
          <span className="detail-label">{getCardTypeName(type)} ({type})</span>
          <span className="detail-value">{cards.length}</span>
        </div>
      ))}
    </div>
  );
};

const ScopeContent: React.FC<ContentProps> = ({ player, gameServices }) => {
  const workCards = player.hand.filter((id) => id.startsWith('W'));

  return (
    <div className="detail-content scope-content">
      <div className="detail-row">
        <span className="detail-label">Project Scope</span>
        <span className="detail-value">${(player.projectScope || 0).toLocaleString()}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Work Cards</span>
        <span className="detail-value">{workCards.length}</span>
      </div>
      {player.contractor && (
        <>
          <div className="detail-divider" />
          <div className="detail-section-title">Contractor</div>
          <div className="detail-row">
            <span className="detail-label">Quality</span>
            <span className="detail-value">{player.contractor.quality}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Cost Multiplier</span>
            <span className="detail-value">{player.contractor.multiplier}x</span>
          </div>
        </>
      )}
    </div>
  );
};

const LogContent: React.FC<ContentProps> = ({ player, gameServices }) => {
  const recentVisits = player.spaceVisitLog?.slice(-5).reverse() || [];

  return (
    <div className="detail-content log-content">
      <div className="detail-section-title">Recent Spaces</div>
      {recentVisits.length === 0 ? (
        <div className="detail-empty">No recent activity</div>
      ) : (
        recentVisits.map((visit, idx) => (
          <div key={idx} className="log-entry">
            <div className="log-space">{visit.spaceName}</div>
            <div className="log-details">
              {visit.daysSpent} days • Turn {visit.entryTurn}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

function getCardTypeName(type: string): string {
  switch (type) {
    case 'W': return 'Work';
    case 'B': return 'Bank';
    case 'E': return 'Expeditor';
    case 'L': return 'Life Event';
    case 'I': return 'Investor';
    default: return type;
  }
}
