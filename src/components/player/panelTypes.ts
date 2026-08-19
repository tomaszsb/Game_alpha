// src/components/player/panelTypes.ts
//
// Shared player-panel types, extracted from the now-removed classic
// ActionCenterPanel when it was deleted (the redesign, PlayerPanelV2, is the
// only panel left — see docs/design/player-panel-redesign.md). Kept in their
// own file rather than folded into PlayerPanelV2.tsx since PlayerPanelWrapper,
// GameLayout, and relatedTab.ts all need them without importing the panel
// component itself.

import { IServiceContainer } from '../../types/ServiceContracts';

export type ReferenceTab = 'ledger' | 'money' | 'time' | 'expeditors' | 'events' | 'scope' | 'log' | null;

/**
 * One-shot request from a parent component to switch this panel's active
 * reference tab. Used to auto-open the related tab (Ledger / Expeditors /
 * Events) when a result modal appears, so when the player dismisses the
 * modal the panel is already showing the updated state. `id` is the
 * one-shot key — each new request must increment it. `playerId` scopes
 * the request to a single panel in multi-player layouts.
 */
export interface TabRequest {
  tab: NonNullable<ReferenceTab>;
  playerId: string;
  id: number;
}

export interface PlayerPanelProps {
  gameServices: IServiceContainer;
  playerId: string;
  onTryAgain?: (playerId: string) => Promise<void>;
  playerNotification?: string;
  onRollDice?: () => Promise<void>;
  onAutomaticFunding?: () => Promise<void>;
  onManualEffectResult?: (result: import('../../types/StateTypes').TurnEffectResult) => void;
  completedActions?: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };
  /** Parent-initiated one-shot tab switch (see TabRequest doc). */
  tabRequest?: TabRequest | null;
  /** Chronicle click-entry-to-replay-highlight (TODO P1 change-legibility) —
   *  called with the raw space id (not the shortName()-displayed label) when
   *  the player clicks a "What's happened" log entry or its turn-block
   *  header in PlayerChronicleV2. The parent (GameLayout) pans/highlights
   *  BoardCanvas to that space. Only meaningful where the board and this
   *  panel share the same screen (GameLayout's desktop view) — omitted on
   *  the phone/controller view, which has no board to pan. */
  onNavigateToSpace?: (spaceId: string) => void;
}
