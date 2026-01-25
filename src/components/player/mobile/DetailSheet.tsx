// src/components/player/mobile/DetailSheet.tsx
//
// Draggable bottom sheet with tabs for detailed information.
// Created: January 24, 2026
// Updated: January 25, 2026 - Refactored with framer-motion for spring physics

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { IServiceContainer } from '../../../types/ServiceContracts';
import { Player } from '../../../types/StateTypes';
import { haptics } from '../../../utils/haptics';
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
const SNAP_COLLAPSED = 56;  // Just the tab bar visible (Material Design 56dp)
const SNAP_HALF = 280;      // Half expanded
const SNAP_FULL = 420;      // Fully expanded

// Spring animation config for native-feeling drag
const springConfig = {
  type: 'spring' as const,
  damping: 30,
  stiffness: 300
};

/**
 * DetailSheet - Draggable bottom sheet with tabs.
 * Uses framer-motion for native-feeling spring physics.
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

  // Motion value for tracking drag
  const y = useMotionValue(0);

  // Transform for backdrop opacity (0 when collapsed, 0.4 when fully expanded)
  const backdropOpacity = useTransform(
    y,
    [0, -(SNAP_FULL - SNAP_COLLAPSED)],
    [0, 0.4]
  );

  // Get player data
  const player = gameServices.stateService.getPlayer(playerId);

  // Update height when isOpen changes externally
  useEffect(() => {
    setSheetHeight(isOpen ? SNAP_HALF : SNAP_COLLAPSED);
  }, [isOpen]);

  // Handle drag end - snap to nearest point
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const currentHeight = sheetHeight - info.offset.y;
    const velocity = info.velocity.y;

    // Use velocity to determine snap direction if moving fast
    let targetHeight: number;
    if (Math.abs(velocity) > 500) {
      // Fast swipe - go in the direction of velocity
      targetHeight = velocity < 0 ? SNAP_FULL : SNAP_COLLAPSED;
    } else {
      // Slow drag - snap to nearest
      const snapPoints = [SNAP_COLLAPSED, SNAP_HALF, SNAP_FULL];
      targetHeight = snapPoints.reduce((prev, curr) =>
        Math.abs(curr - currentHeight) < Math.abs(prev - currentHeight) ? curr : prev
      );
    }

    setSheetHeight(targetHeight);

    // Haptic feedback on snap
    haptics.mediumTap();

    // Update open state based on snap point
    if (targetHeight === SNAP_COLLAPSED) {
      onClose();
    } else {
      onOpen();
    }
  };

  // Handle tab click - also opens sheet if collapsed
  const handleTabClick = (tab: DetailTab) => {
    haptics.lightTap();
    onTabChange(tab);
    if (sheetHeight === SNAP_COLLAPSED) {
      setSheetHeight(SNAP_HALF);
      onOpen();
    }
  };

  // Handle backdrop click - close sheet
  const handleBackdropClick = () => {
    setSheetHeight(SNAP_COLLAPSED);
    onClose();
  };

  if (!player) return null;

  const isExpanded = sheetHeight > SNAP_COLLAPSED;

  return (
    <>
      {/* Backdrop - dims game board when sheet is expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="detail-sheet__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: '#000',
              zIndex: 199,
              touchAction: 'none'
            }}
            data-testid="detail-sheet-backdrop"
          />
        )}
      </AnimatePresence>

      {/* Sheet */}
      <motion.div
        className={`detail-sheet ${isOpen ? 'detail-sheet--open' : ''}`}
        initial={{ height: SNAP_COLLAPSED }}
        animate={{ height: sheetHeight }}
        transition={springConfig}
        drag="y"
        dragConstraints={{ top: -(SNAP_FULL - SNAP_COLLAPSED), bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ y }}
        data-testid="detail-sheet"
      >
        {/* Drag Handle */}
        <div className="detail-sheet__handle" data-testid="drag-handle">
          <div className="detail-sheet__handle-bar" />
        </div>

        {/* Tab Bar */}
        <div className="detail-sheet__tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`detail-sheet__tab ${activeTab === tab.id ? 'detail-sheet__tab--active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area with tab transitions */}
        <div className="detail-sheet__content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'finances' && <FinancesContent player={player} />}
              {activeTab === 'time' && <TimeContent player={player} />}
              {activeTab === 'cards' && <CardsContent player={player} />}
              {activeTab === 'scope' && <ScopeContent player={player} />}
              {activeTab === 'log' && <LogContent player={player} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};

// ============================================================
// Content Components
// ============================================================

interface ContentProps {
  player: Player;
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

const CardsContent: React.FC<ContentProps> = ({ player }) => {
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

const ScopeContent: React.FC<ContentProps> = ({ player }) => {
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

const LogContent: React.FC<ContentProps> = ({ player }) => {
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
