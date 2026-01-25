// src/components/player/PlayerPanelWrapper.tsx
//
// Responsive wrapper that switches between desktop and mobile player panels.
// Created: January 24, 2026

import React, { useState, useEffect, useMemo } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { PlayerPanel, PlayerPanelProps } from './PlayerPanel';
import { MobilePlayerPanel } from './mobile/MobilePlayerPanel';
import { DetailSheet, DetailTab } from './mobile/DetailSheet';
import { PlayerViewStateService } from '../../services/PlayerViewStateService';

// Breakpoint for mobile/desktop switch
const MOBILE_BREAKPOINT = 768;

export interface PlayerPanelWrapperProps extends PlayerPanelProps {
  /** Force mobile view regardless of screen size (for testing) */
  forceMobile?: boolean;

  /** Force desktop view regardless of screen size (for testing) */
  forceDesktop?: boolean;
}

/**
 * Custom hook to detect screen width changes.
 */
function useIsMobile(forceMobile?: boolean, forceDesktop?: boolean): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (forceMobile) return true;
    if (forceDesktop) return false;
    if (typeof window !== 'undefined') {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    return false;
  });

  useEffect(() => {
    if (forceMobile || forceDesktop) return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [forceMobile, forceDesktop]);

  if (forceMobile) return true;
  if (forceDesktop) return false;
  return isMobile;
}

/**
 * PlayerPanelWrapper - Responsive wrapper for player panels.
 *
 * Automatically switches between:
 * - Desktop: Full PlayerPanel with accordions
 * - Mobile: MobilePlayerPanel with context-aware views
 *
 * The mobile version uses PlayerViewStateService for state management.
 */
export const PlayerPanelWrapper: React.FC<PlayerPanelWrapperProps> = ({
  gameServices,
  playerId,
  forceMobile,
  forceDesktop,
  ...props
}) => {
  const isMobile = useIsMobile(forceMobile, forceDesktop);

  // Create PlayerViewStateService for mobile view (memoized)
  const viewStateService = useMemo(() => {
    if (!isMobile) return null;

    return new PlayerViewStateService(
      gameServices.stateService,
      gameServices.gameRulesService,
      gameServices.dataService
    );
  }, [isMobile, gameServices.stateService, gameServices.gameRulesService, gameServices.dataService]);

  // Clean up service when switching away from mobile
  useEffect(() => {
    return () => {
      viewStateService?.destroy();
    };
  }, [viewStateService]);

  // Mobile detail sheet state
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('finances');

  // Handle mobile-specific actions
  const handleStatTap = (stat: 'money' | 'time' | 'cards' | 'scope') => {
    const tabMap: Record<string, DetailTab> = {
      money: 'finances',
      time: 'time',
      cards: 'cards',
      scope: 'scope'
    };
    setActiveDetailTab(tabMap[stat]);
    setIsDetailSheetOpen(true);
  };

  const handleChoiceSelect = (choiceId: string) => {
    // Set move intent for the player
    gameServices.stateService.setPlayerMoveIntent(playerId, choiceId);
  };

  const handleChoiceConfirm = async () => {
    // Resolve the choice with the selected option
    const gameState = gameServices.stateService.getGameState();
    const player = gameServices.stateService.getPlayer(playerId);

    if (gameState.awaitingChoice && player?.moveIntent) {
      await gameServices.choiceService.resolveChoice(
        gameState.awaitingChoice.id,
        player.moveIntent
      );
    }
  };

  const handleEndTurn = async () => {
    await gameServices.turnService.endTurn();
  };

  // Render mobile version
  if (isMobile && viewStateService) {
    return (
      <div className="player-panel-wrapper player-panel-wrapper--mobile">
        <MobilePlayerPanel
          gameServices={gameServices}
          playerId={playerId}
          viewStateService={viewStateService}
          onRollDice={props.onRollDice}
          onEndTurn={handleEndTurn}
          onStatTap={handleStatTap}
          onChoiceSelect={handleChoiceSelect}
          onChoiceConfirm={handleChoiceConfirm}
          playerNotification={props.playerNotification}
        />
        <DetailSheet
          gameServices={gameServices}
          playerId={playerId}
          isOpen={isDetailSheetOpen}
          activeTab={activeDetailTab}
          onTabChange={setActiveDetailTab}
          onClose={() => setIsDetailSheetOpen(false)}
          onOpen={() => setIsDetailSheetOpen(true)}
        />
      </div>
    );
  }

  // Render desktop version (original PlayerPanel)
  return (
    <div className="player-panel-wrapper player-panel-wrapper--desktop">
      <PlayerPanel
        gameServices={gameServices}
        playerId={playerId}
        {...props}
      />
    </div>
  );
};
