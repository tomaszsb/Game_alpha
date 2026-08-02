// src/components/layout/GameLayout.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconBug } from '../icons/SetupIcons';
import { colors } from '../../styles/theme';
import { CardDetailsModal } from '../modals/CardDetailsModal';
import { ChoiceModal } from '../modals/ChoiceModal';
import { DiceResultModal } from '../modals/DiceResultModal';
import { LifeEventModal, type LifeEventModalData } from '../modals/LifeEventModal';
import { RoutingExplanationModal } from '../modals/RoutingExplanationModal';
import { friendlySpaceName } from '../../utils/logFormatting';
import { EndGameModal } from '../modals/EndGameModal';
import { NegotiationModal } from '../modals/NegotiationModal';
import { RulesModal } from '../modals/RulesModal';
import { PlayerSetup } from '../setup/PlayerSetup';
import { ClassroomBadge } from '../classroom/ClassroomBadge';
import { PlayerPanelWrapper } from '../player/PlayerPanelWrapper';
import { ProjectProgress } from '../game/ProjectProgress';
import { SpaceExplorerPanel } from '../game/SpaceExplorerPanel';
import { GameLog } from '../game/GameLog';
import { BoardCanvas } from '../board/BoardCanvas';
import { BoardToggle } from '../board/BoardToggle';
import { GameDisplaySettings } from '../settings/GameDisplaySettings';
import { useGameContext } from '../../context/GameContext';
import { pickRelatedTab } from '../../utils/relatedTab';
import { NotificationUtils } from '../../utils/NotificationUtils';
import { TurnEffectResult } from '../../types/StateTypes';
import { Card } from '../../types/DataTypes';
import { GameEvent } from '../../types/GameEvents';
import { haptics, primeAudio } from '../../utils/haptics';
import { getWebSocketService, ConnectionState } from '../../services/WebSocketSyncService';
import { pushNotifications } from '../../utils/pushNotifications';
import { PullToRefresh } from '../common/PullToRefresh';
import { useDictionaryPanel } from '../../dictionary/context/DictionaryContext';
import { useModalQueue } from '../../hooks/useModalQueue';
import { useSyncedGameState } from '../../hooks/useSyncedGameState';
import { DictionaryHint } from '../../dictionary';
import { PlayerDebug } from '../debug/PlayerDebug';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { ShutdownNotice } from '../common/ShutdownNotice';
import { isAdminAuthenticated } from '../../utils/adminAuth';
import { isTeacherLoggedIn } from '../../utils/teacherAuth';
import { getCurrentGameId } from '../../utils/networkDetection';
import { trackPlaytestEvent } from '../../playtest/playtestAnalytics';

interface GameLayoutProps {
  viewPlayerId?: string;
  initialPreview?: { action: string; id: string } | null;
  onPreviewConsumed?: () => void;
}

/**
 * GameLayout component replicates the high-level structure of the legacy FixedApp.js
 * This provides the main grid-based layout for the game application.
 */
export function GameLayout({ viewPlayerId, initialPreview, onPreviewConsumed }: GameLayoutProps = {}): JSX.Element {
  const {
    stateService,
    dataService,
    cardService,
    turnService,
    movementService,
    notificationService,
    choiceService,
    effectEngineService,
    loggingService,
    negotiationService,
    gameRulesService,
    resourceService
  } = useGameContext();

  // Create service container for ActionCenterPanel
  const gameServices = {
    stateService,
    dataService,
    cardService,
    turnService,
    movementService,
    notificationService,
    choiceService,
    effectEngineService,
    loggingService,
    negotiationService,
    gameRulesService,
    resourceService
  };
  // Dictionary panel control
  const { isOpen: isDictionaryOpen, openPanel: openDictionary, closePanel: closeDictionary } = useDictionaryPanel();

  const syncedGameState = useSyncedGameState(stateService);
  const gamePhase = syncedGameState.gamePhase;
  const players = syncedGameState.players;
  const currentPlayerId = syncedGameState.currentPlayerId;
  const turnNumber = syncedGameState.globalTurnCount;
  const gameStateCompletedActions = syncedGameState.completedActions;
  const tvDarkMode = syncedGameState.tvDarkMode ?? false;

  // gamePhase/players/currentPlayerId/turnNumber/gameStateCompletedActions/
  // tvDarkMode all come straight from the synced game state below — see the
  // useSyncedGameState call after gameServices.
  // Shared TV theme (GameState.tvDarkMode) — read here so the remote-control
  // button rendered in ProjectProgress's toolbar reflects the current synced
  // value and can flip it via stateService.setTVDarkMode(). This device's own
  // dark/light preference (PlayerPanelWrapper/usePanelMode) is unrelated and
  // untouched by this.
  // The shared TV screen is a group display, not a personal preference — same
  // reasoning as G160's board-edges toggle (2026-07-26 correction). Only an
  // admin or a logged-in teacher gets the remote-control button; a regular
  // player sees nothing (ProjectProgress hides it when these props are
  // undefined). Re-checked on every render, same pattern as BoardToggle.
  const canControlTVDisplay = isAdminAuthenticated() || isTeacherLoggedIn();

  // v3.0.0 — BoardV3 retired. Previously this section managed a boardImpl
  // toggle (v3 vs canvas) that lived in localStorage; now BoardCanvas is the
  // only renderer so the toggle and its persistence keys are gone. The
  // remaining board state (edit mode, edges visibility, per-edge hides) is
  // still wired to BoardCanvas's admin features below.
  const [boardEditMode, setBoardEditModeState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('unravel:boardEditMode') === '1';
    } catch { return false; }
  });
  const setBoardEditMode = useCallback((v: boolean) => {
    setBoardEditModeState(v);
    try { window.localStorage.setItem('unravel:boardEditMode', v ? '1' : '0'); } catch { /* ignored */ }
  }, []);
  // Global edges-visible toggle (default on). Persisted per-session.
  const [boardEdgesVisible, setBoardEdgesVisibleState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = window.localStorage.getItem('unravel:boardEdgesVisible');
      return v === null ? true : v === '1';
    } catch { return true; }
  });
  const setBoardEdgesVisible = useCallback((v: boolean) => {
    setBoardEdgesVisibleState(v);
    try { window.localStorage.setItem('unravel:boardEdgesVisible', v ? '1' : '0'); } catch { /* ignored */ }
  }, []);
  // Per-edge hide set. Edge IDs are `${source}__${target}`. Persisted
  // as JSON. Cleared by the toggle's "restore" button.
  const [hiddenEdgeIds, setHiddenEdgeIdsState] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem('unravel:boardHiddenEdges');
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });
  const setHiddenEdgeIds = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setHiddenEdgeIdsState(prev => {
      const next = updater(prev);
      try {
        window.localStorage.setItem('unravel:boardHiddenEdges', JSON.stringify([...next]));
      } catch { /* ignored */ }
      return next;
    });
  }, []);
  const onHideEdge = useCallback((edgeId: string) => {
    setHiddenEdgeIds(prev => {
      const next = new Set(prev);
      next.add(edgeId);
      return next;
    });
  }, [setHiddenEdgeIds]);
  const onClearHiddenEdges = useCallback(() => {
    setHiddenEdgeIds(() => new Set());
  }, [setHiddenEdgeIds]);
  // Per-edge waypoint redirect (G160, 2026-08-02) — same per-device
  // localStorage tier as hiddenEdgeIds above (a redirect is a display fix
  // for a badly auto-routed connector, not real game data). One waypoint
  // per edge id; dragging again overwrites it, double-clicking the handle
  // clears it. See TODO.md's G160 scope note.
  const [edgeWaypoints, setEdgeWaypointsState] = useState<Record<string, { x: number; y: number }>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem('unravel:boardEdgeWaypoints');
      if (raw) return JSON.parse(raw) as Record<string, { x: number; y: number }>;
    } catch { /* ignore */ }
    return {};
  });
  const setEdgeWaypoints = useCallback((updater: (prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>) => {
    setEdgeWaypointsState(prev => {
      const next = updater(prev);
      try {
        window.localStorage.setItem('unravel:boardEdgeWaypoints', JSON.stringify(next));
      } catch { /* ignored */ }
      return next;
    });
  }, []);
  const onSetEdgeWaypoint = useCallback((edgeId: string, point: { x: number; y: number }) => {
    setEdgeWaypoints(prev => ({ ...prev, [edgeId]: point }));
  }, [setEdgeWaypoints]);
  const onClearEdgeWaypoint = useCallback((edgeId: string) => {
    setEdgeWaypoints(prev => {
      const next = { ...prev };
      delete next[edgeId];
      return next;
    });
  }, [setEdgeWaypoints]);
  const onClearAllEdgeWaypoints = useCallback(() => {
    setEdgeWaypoints(() => ({}));
  }, [setEdgeWaypoints]);
  const [isNegotiationModalOpen, setIsNegotiationModalOpen] = useState<boolean>(false);
  const [negotiationPartnerId, setNegotiationPartnerId] = useState<string | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);
  const [isCardDetailsModalOpen, setIsCardDetailsModalOpen] = useState<boolean>(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isSpaceExplorerVisible, setIsSpaceExplorerVisible] = useState<boolean>(false);
  const [previewSpaceId, setPreviewSpaceId] = useState<string | null>(null);
  const [isGameLogVisible, setIsGameLogVisible] = useState<boolean>(false);
  // Life event queue — set when a `life_event` AutoAction fires; opens its own
  // dedicated modal once the regular dice modal closes (or immediately if none
  // was open). Replaces the v3.0.8-and-earlier behavior of stomping diceResult.
  // fb:dfdeaf1c.
  const [pendingLifeEvent, setPendingLifeEvent] = useState<LifeEventModalData | null>(null);
  const [isLifeEventModalOpen, setIsLifeEventModalOpen] = useState<boolean>(false);
  // Routing explanation (fb:f1bc011b) — queued like the life event so it never
  // stomps the dice modal; shown after the FDNY logic chain routes the player.
  const [pendingRouting, setPendingRouting] = useState<{ message: string; toSpaceLabel: string } | null>(null);
  const [isRoutingModalOpen, setIsRoutingModalOpen] = useState<boolean>(false);
  // Result-modal queue (fb:ac29b623) — the shared DiceResultModal used to be
  // a synchronous open/close toggle, so clicking the next action fast enough
  // re-opened it DURING the previous exit animation and the in-flight close
  // swallowed the new modal (it flashed and vanished). Results now queue and
  // only open once the previous modal has fully animated out. Same pattern
  // as the life-event queue above. Blocked while the LifeEventModal is up so
  // the two never stack.
  const diceResultQueue = useModalQueue<TurnEffectResult>({ blocked: isLifeEventModalOpen });
  const { current: diceResult, isOpen: isDiceResultModalOpen } = diceResultQueue;
  // Per-player one-shot request to switch the panel's active reference tab.
  // Set when a result modal opens so the matching tab (Ledger / Expeditors /
  // Events) auto-opens and stays open after the player dismisses the modal —
  // they don't have to hunt for what changed.
  // Playtest reports 2026-05-15: feedback-1778864436652-7692dba5 (money
  // changes invisible), feedback-1778864258379-5ce94e05 (scope changes
  // invisible) — both asking for "at a glance" feedback.
  const [tabRequest, setTabRequest] = useState<import('../player/panelTypes').TabRequest | null>(null);
  // When the result modal opens, derive the matching tab and broadcast a
  // one-shot tabRequest. ActionCenterPanel consumes it (scoped by playerId
  // so opponents' panels don't jump). Skips if currentPlayerId is null
  // (defensive — shouldn't happen during a player's turn) or if the effects
  // don't map to any tab (movement-only, info-only).
  // Deliberately stays an effect (react-hooks/set-state-in-effect 'warn',
  // not fixed like the sibling sites in this file): `id: Date.now()` makes
  // this an event broadcast, not a derived value — it needs a fresh id on
  // every qualifying dice result so ActionCenterPanel re-triggers even when
  // the same tab is picked twice in a row, which isn't expressible as a
  // pure render-time computation (Date.now() during render would be an
  // impure read, a different anti-pattern).
  useEffect(() => {
    if (!isDiceResultModalOpen || !diceResult || !currentPlayerId) return;
    const tab = pickRelatedTab(diceResult.effects);
    if (!tab) return;
    setTabRequest({ tab, playerId: currentPlayerId, id: Date.now() });
  }, [isDiceResultModalOpen, diceResult, currentPlayerId]);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState<boolean>(false);
  const [isProgressCollapsed, setIsProgressCollapsed] = useState<boolean>(false);
  const [visiblePanels, setVisiblePanels] = useState<Record<string, boolean>>(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem('game-display-settings');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Failed to load display settings:', error);
      return {};
    }
  });

  const hasRequestedNotificationsRef = useRef(false);

  // Request notification permission when game starts (only once).
  // The granted/denied result is deliberately not stored: nothing in this
  // component renders it, and pushNotifications keeps its own permission
  // state (pushNotifications.getPermission()) for callers that need it.
  useEffect(() => {
    if (gamePhase === 'PLAY' && !hasRequestedNotificationsRef.current) {
      hasRequestedNotificationsRef.current = true;
      // Request permission after a short delay so it doesn't disrupt the game start experience
      const timer = setTimeout(() => {
        void pushNotifications.requestPermission();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gamePhase]);

  // In-game engagement tracking (TODO.md, decided 2026-08-02) — "how far
  // players get." Fires once per (player, space) this client observes;
  // deduped again at aggregation time since multiple connected devices
  // (e.g. a TV plus several phones in Phones+TV mode) can each
  // independently observe the same real arrival (see engagementStats.js).
  // Pseudonymous gameId/playerId only, never the player's display name.
  const trackedSpaceReachedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (gamePhase !== 'PLAY') return;
    const gameId = getCurrentGameId();
    if (!gameId) return;
    for (const player of players) {
      if (!player.currentSpace) continue;
      const key = `${player.id}|${player.currentSpace}`;
      if (trackedSpaceReachedRef.current.has(key)) continue;
      trackedSpaceReachedRef.current.add(key);
      trackPlaytestEvent('space_reached', { gameId, playerId: player.id, spaceId: player.currentSpace });
    }
  }, [gamePhase, players]);

  // Handle initial preview request
  useEffect(() => {
    if (!initialPreview) return;


    if (initialPreview.action === 'preview_card') {
      const card = dataService.getCardById(initialPreview.id);
      if (card) {
        setSelectedCard(card);
        setIsCardDetailsModalOpen(true);
      } else {
        notificationService.notify(
          NotificationUtils.createErrorNotification('Preview', `Card "${initialPreview.id}" not found`, 'System'),
          { playerId: 'system', playerName: 'System', actionType: 'preview_error' }
        );
      }
    } else if (initialPreview.action === 'preview_space') {
      const spaceExists = dataService.getAllSpaces().some(s => s.name === initialPreview.id);
      if (spaceExists) {
        setPreviewSpaceId(initialPreview.id);
        setIsSpaceExplorerVisible(true);
      } else {
        notificationService.notify(
          NotificationUtils.createErrorNotification('Preview', `Space "${initialPreview.id}" not found`, 'System'),
          { playerId: 'system', playerName: 'System', actionType: 'preview_error' }
        );
      }
    }

    onPreviewConsumed?.();
  }, [initialPreview, dataService, notificationService, onPreviewConsumed]);

  // State tracking for processing and notifications.
  // NOTE: an isProcessingTurn flag used to be set around every async action
  // here. Nothing ever read it (the classic panel's busy indicator is gone —
  // PlayerPanelV2 tracks its own), so each action was paying two no-op
  // re-renders of this component. Removed rather than renamed.
  // (turnNumber/gameStateCompletedActions now come from the synced game
  // state declared above, not local state.)
  // NOTE: a justUsedTryAgain flag lived here and was passed to
  // endTurnWithMovement's skipAutoMove argument. Its only reader was the
  // classic end-turn handler above; PlayerPanelV2 owns that flow now and does
  // not consult this component's state, so the flag was being set and never
  // read. Removed.

  // Unified notification system - driven by NotificationService.
  // The button-feedback channel is still subscribed (NotificationService pushes
  // per-action button labels into it) but nothing in this component renders it,
  // so only the setter is bound — the value is intentionally discarded.
  const [, setButtonFeedback] = useState<{ [actionType: string]: string }>({});
  const [playerNotifications, setPlayerNotifications] = useState<{ [playerId: string]: string }>({});
  // Separate from playerNotifications above (v3.0.99): that slot is shared
  // with every notificationService.notify() call, including the generic
  // dice-roll-completion toast — which fires moments after an approval
  // revoke triggered by the SAME roll (e.g. a W-card draw) and silently
  // overwrites it before a player could ever read it. Its own channel can't
  // lose that race.
  const [approvalRevokeNotice, setApprovalRevokeNotice] = useState<{ [playerId: string]: string }>({});

  // Smart layout adaptation - track view mode for mobile players.
  // Use prop if provided, otherwise check URL params. Read once on mount and
  // never updated — useState here is the compute-once idiom, not mutable state,
  // so no setter is bound.
  const [viewPlayerIdFromState] = useState<string | null>(() => {
    if (viewPlayerId) {
      return viewPlayerId;
    }
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('playerId');
  });

  // fb:6e1e8ac4 — one-time tap gate when a player joins via QR on their
  // phone. The tap satisfies the browser's user-gesture requirement for
  // navigator.vibrate(), unlocking haptics for the rest of the session.
  // Without this, the very first turn-start vibrate is silently blocked
  // by Chrome/Comet/Edge (the player reports "phone didn't buzz").
  // Skipped when not in phone-view (no viewPlayerId), and only shown
  // once per session (sessionStorage flag survives reloads).
  //
  // v3.0.51 — sessionStorage access wrapped in try/catch: in restricted
  // contexts (private/incognito, some embedded webviews, sandboxed iframes,
  // and some Comet/TV browser modes) sessionStorage access can throw a
  // SecurityError. Without the guard the throw inside useState's initializer
  // crashes the whole component on mount → white screen on phone-join.
  const phoneViewKey = viewPlayerId ? `unravel.haptics.primed.${viewPlayerId}` : null;
  const safeSessionGet = (key: string): string | null => {
    try { return sessionStorage.getItem(key); } catch { return null; }
  };
  const safeSessionSet = (key: string, value: string): void => {
    try { sessionStorage.setItem(key, value); } catch { /* swallow — gate just reappears next reload, no harm */ }
  };
  const [needsHapticPrime, setNeedsHapticPrime] = useState<boolean>(() => {
    if (!phoneViewKey) return false;
    return safeSessionGet(phoneViewKey) !== 'yes';
  });
  const handleEnterGame = () => {
    // Prime vibration in the same execution as the user tap — this is
    // what registers the gesture and unlocks subsequent vibrates.
    try { haptics.lightTap(); } catch { /* haptics is best-effort, never block the tap */ }
    // Prime Web Audio in the same gesture so playTurnChime() is unlocked for
    // the rest of the session. No-ops on browsers without AudioContext.
    primeAudio();
    if (phoneViewKey) safeSessionSet(phoneViewKey, 'yes');
    // Request fullscreen to push browser chrome (address bar / nav bar) off
    // screen — best-effort: denied silently on iPadOS split-view, secure
    // iframes, and browsers that don't support the API. fb:05a8b722.
    try {
      if (document.documentElement.requestFullscreen) {
        void document.documentElement.requestFullscreen();
      }
    } catch { /* fullscreen is best-effort, never block the tap */ }
    setNeedsHapticPrime(false);
  };

  // Use prop if provided, otherwise use state
  const effectiveViewPlayerId = viewPlayerId || viewPlayerIdFromState;

  // Phone-view: track WebSocket connection state so we can show a
  // "Reconnecting…" banner when the phone loses the server. Only
  // relevant in phone view (effectiveViewPlayerId set). fb:TODO-216.
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    () => getWebSocketService().connectionState
  );
  useEffect(() => {
    if (!effectiveViewPlayerId) return; // PC/TV mode — no reconnect banner needed
    return getWebSocketService().onConnectionChange(setConnectionState);
  }, [effectiveViewPlayerId]);

  // Use actual game state completed actions for UI display
  const completedActions = gameStateCompletedActions;

  // Vibrate the phone when this player's turn starts. Only fires on the
  // per-player mobile view (effectiveViewPlayerId is set) and only on the
  // transition into "your turn" — not on every re-render or other state
  // changes during your turn. Gracefully no-ops on browsers without the
  // Vibration API (haptics.turnNotification handles the feature check).
  // <!-- fb:feedback-1779567746328-5ca98777 -->
  const prevTurnPlayerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveViewPlayerId) {
      prevTurnPlayerRef.current = currentPlayerId;
      return;
    }
    const becameMyTurn =
      currentPlayerId === effectiveViewPlayerId &&
      prevTurnPlayerRef.current !== effectiveViewPlayerId;
    if (becameMyTurn) {
      haptics.turnNotification();
    }
    prevTurnPlayerRef.current = currentPlayerId;
  }, [currentPlayerId, effectiveViewPlayerId]);

  // Subscribe to NotificationService updates
  useEffect(() => {
    notificationService.setUpdateCallbacks(
      (buttonFeedback) => {
        setButtonFeedback(buttonFeedback);
      },
      (playerNotifications) => {
        setPlayerNotifications(playerNotifications);
      }
    );
  }, [notificationService]);

  // Subscribe to game events — show modals for life events
  useEffect(() => {
    const unsubscribe = stateService.subscribeToGameEvents((event: GameEvent) => {
      // Movement failure — surface error to player
      if (event.type === 'movement' && event.success === false) {
        notificationService.notify(
          NotificationUtils.createErrorNotification('movement', event.message || 'Movement could not be resolved', event.playerName),
          { playerId: event.playerId, playerName: event.playerName, actionType: 'movement_error' }
        );
        return;
      }
      if (event.type === 'approval_revoked') {
        // Scope changes (W-card draws) and revokes_approval-flagged life
        // events (L003/L020) can silently invalidate a prior DOB/FDNY
        // approval — before this, the only sign was the badge in the panel
        // header quietly flipping, with nothing calling out that it just
        // happened (v3.0.99). Its own state slot, not notificationService —
        // see the approvalRevokeNotice declaration for why.
        setApprovalRevokeNotice((prev) => ({ ...prev, [event.playerId]: event.message }));
        setTimeout(() => {
          setApprovalRevokeNotice((prev) => {
            if (prev[event.playerId] !== event.message) return prev; // a newer notice replaced it
            const next = { ...prev };
            delete next[event.playerId];
            return next;
          });
        }, 5000);
        return;
      }
      if ((event.type === 'seed_money' || event.type === 'auto_dice_roll') && event.turnEffectResult) {
        // Owner seed money (TurnService.handleAutomaticFunding) and the
        // REGULATORY-phase auto-roll (DOB/FDNY plan exam — "the examiner
        // decides") both fire from inside startTurn on every turn
        // transition — including the internal endTurn → startTurn path,
        // which has no React caller to enqueue a result itself. This event
        // is the only way either reaches the modal queue; without it the
        // player got no confirmation at all beyond a badge quietly changing
        // in the panel header (v3.0.99).
        diceResultQueue.enqueue(event.turnEffectResult);
        return;
      }
      if (event.type === 'routing_explanation' && event.toSpace && event.message) {
        // Queue the "why am I here" modal (fb:f1bc011b) so it waits behind any
        // dice result, same as the life event below.
        setPendingRouting({ message: event.message, toSpaceLabel: friendlySpaceName(dataService, event.toSpace) });
        return;
      }
      if (event.type === 'life_event' && event.cardId) {
        // Queue the life event for its OWN dedicated modal instead of stomping
        // the dice modal state. fb:dfdeaf1c — life events used to look like a
        // continuation of the originating space's roll outcome; now they pop a
        // distinct newspaper-style LifeEventModal once the dice modal closes (or
        // immediately, if no dice modal is currently open). v3.0.68 reframed the
        // old red "disturbance" banner as a tone-aware bulletin.
        const card = dataService.getCardById(event.cardId);
        if (card) {
          // Dateline for the newspaper masthead — the project's elapsed days.
          const days = stateService.getPlayer(event.playerId)?.timeSpent;
          setPendingLifeEvent({
            card,
            diceValue: event.diceValue,
            spaceName: event.spaceName,
            dayLabel: typeof days === 'number' ? `Day ${days}` : undefined,
            effectsSummary: event.effectsSummary,
          });
        }
        return;
      }
      if (event.type === 'negotiation_requested') {
        // Opens NegotiationModal on the INITIATOR's own device, pre-seeded
        // with the partner they chose. The partner's own accept/decline
        // happens separately via ChoiceModal, not through this modal.
        setNegotiationPartnerId(event.partnerId);
        setIsNegotiationModalOpen(true);
        return;
      }
    });

    return () => {
      unsubscribe();
    };
    // exhaustive-deps wants `diceResultQueue` and `notificationService` here.
    // Deliberately omitted: this subscribes to the GameEvent bus, and
    // useModalQueue returns a NEW object literal on every render
    // (useModalQueue.ts:89), so listing diceResultQueue would unsubscribe and
    // resubscribe on every render — churn, plus a window in which an event
    // could land with no listener attached. This effect is meant to subscribe
    // once for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateService, dataService]);

  // Life-event queue flush. Open the LifeEventModal when (a) we have a queued
  // event, (b) the LifeEventModal isn't already showing, and (c) the regular
  // dice modal isn't visible, exiting, or holding queued results (so the
  // player handles one outcome at a time — dice/action results first, then
  // the life event). fb:dfdeaf1c; queue-awareness added with fb:ac29b623.
  useEffect(() => {
    if (
      pendingLifeEvent &&
      !isLifeEventModalOpen &&
      !isDiceResultModalOpen &&
      !diceResultQueue.isExiting &&
      diceResultQueue.pendingCount === 0
    ) {
      setIsLifeEventModalOpen(true);
    }
  }, [pendingLifeEvent, isLifeEventModalOpen, isDiceResultModalOpen, diceResultQueue.isExiting, diceResultQueue.pendingCount]);

  // Routing-explanation queue flush (fb:f1bc011b). Same one-at-a-time rule as
  // the life event, and it also waits behind the life event so the player
  // reads the event first, then learns where they're being routed.
  useEffect(() => {
    if (
      pendingRouting &&
      !isRoutingModalOpen &&
      !isLifeEventModalOpen &&
      !pendingLifeEvent &&
      !isDiceResultModalOpen &&
      !diceResultQueue.isExiting &&
      diceResultQueue.pendingCount === 0
    ) {
      setIsRoutingModalOpen(true);
    }
  }, [pendingRouting, isRoutingModalOpen, isLifeEventModalOpen, pendingLifeEvent, isDiceResultModalOpen, diceResultQueue.isExiting, diceResultQueue.pendingCount]);

  // Persist visiblePanels to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('game-display-settings', JSON.stringify(visiblePanels));
    } catch (error) {
      console.error('Failed to save display settings:', error);
    }
  }, [visiblePanels]);

  // Back-button modal interception
  const historyPushedRef = useRef(false);
  const anyModalOpen = isRulesModalOpen || isNegotiationModalOpen || isCardDetailsModalOpen ||
    isDiceResultModalOpen || isLifeEventModalOpen || isRoutingModalOpen || isSpaceExplorerVisible || isGameLogVisible || isDictionaryOpen;

  useEffect(() => {
    if (anyModalOpen && !historyPushedRef.current) {
      window.history.pushState({ modalOpen: true }, '');
      historyPushedRef.current = true;
    }
    if (!anyModalOpen) {
      historyPushedRef.current = false;
    }
  }, [anyModalOpen]);

  // Pull the queue's `close` out as a standalone value: it is a stable
  // useCallback (useModalQueue.ts:63), unlike the queue OBJECT around it, which
  // is a fresh literal every render. Depending on the function instead of the
  // object lets the popstate effect below list its dependencies honestly
  // without re-attaching the listener on every render.
  const closeDiceResultModal = diceResultQueue.close;

  useEffect(() => {
    const handlePopState = (_e: PopStateEvent) => {
      // Close the topmost modal in priority order
      if (isRoutingModalOpen) {
        setIsRoutingModalOpen(false);
        setPendingRouting(null);
      } else if (isDiceResultModalOpen) {
        closeDiceResultModal();
      } else if (isCardDetailsModalOpen) {
        setIsCardDetailsModalOpen(false);
        setSelectedCard(null);
      } else if (isNegotiationModalOpen) {
        setIsNegotiationModalOpen(false);
      } else if (isRulesModalOpen) {
        setIsRulesModalOpen(false);
      } else if (isDictionaryOpen) {
        closeDictionary();
      } else if (isSpaceExplorerVisible) {
        setIsSpaceExplorerVisible(false);
      } else if (isGameLogVisible) {
        setIsGameLogVisible(false);
      } else {
        // No modal was open, let the browser handle it normally
        return;
      }
      // Reset ref so next open pushes a fresh entry
      historyPushedRef.current = false;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // `isRoutingModalOpen` was genuinely missing here, not a false positive: the
    // handler checks it FIRST, so while it was absent the listener could hold a
    // stale `false` and let a Back press fall through to close some other modal
    // (or navigate away) while the routing-explanation modal was on screen.
  }, [isRoutingModalOpen, isDiceResultModalOpen, isCardDetailsModalOpen, isNegotiationModalOpen, isRulesModalOpen, isDictionaryOpen, isSpaceExplorerVisible, isGameLogVisible, closeDictionary, closeDiceResultModal]);

  // Helper function to determine if a player panel should be shown
  const shouldShowPlayerPanel = (playerId: string): boolean => {
    // In mobile view mode, don't show any panels in the main area
    if (effectiveViewPlayerId) return false;

    // Check user's display settings first (explicit visibility toggle)
    // visiblePanels[playerId] === false means user explicitly hid it
    // visiblePanels[playerId] === true means user explicitly showed it
    // visiblePanels[playerId] === undefined means use default behavior
    if (visiblePanels[playerId] === false) {
      return false; // User explicitly hid this panel
    }
    if (visiblePanels[playerId] === true) {
      return true; // User explicitly showed this panel
    }

    // Default behavior: hide panels for ANY connected players (mobile or desktop)
    // Only show panels for players who haven't connected to their own view
    const player = players.find(p => p.id === playerId);
    return !player?.deviceType; // Show only if deviceType is undefined (not connected)
  };

  // Check if any player panels should be shown
  const shouldShowAnyPanel = !effectiveViewPlayerId && players.length > 0 &&
    players.some(p => shouldShowPlayerPanel(p.id));

  // If no panels should be shown, hide the entire panel column
  // This includes PLAY phase when all players are connected on their own devices
  const hidePanelColumn = !effectiveViewPlayerId && !shouldShowAnyPanel;

  // Add responsive CSS styles to document head
  React.useEffect(() => {
    const styleId = 'game-layout-responsive';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .game-interface-responsive {
          display: grid;
          grid-template-columns: minmax(340px, 480px) 1fr;
          grid-template-rows: auto 1fr;
          column-gap: 8px;
          row-gap: 4px;
          height: 100vh;
          width: 100vw;
          padding: 4px;
          box-sizing: border-box;
          overflow: hidden;
        }

        /* Player panels container - scrollable flex layout, hidden scrollbar */
        .game-player-panels {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 0;
          flex: 1 1 0;
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .game-player-panels::-webkit-scrollbar {
          display: none;
        }

        /* Individual player panel - content flows naturally, parent scrolls */
        .game-player-panel-item {
          flex: 0 0 auto;
          min-height: 120px;
        }

        @media (max-width: 1920px) {
          .game-interface-responsive {
            grid-template-columns: minmax(320px, 440px) 1fr;
            column-gap: 6px;
            padding: 4px;
          }
        }

        @media (max-width: 1600px) {
          .game-interface-responsive {
            grid-template-columns: minmax(280px, 380px) 1fr;
            column-gap: 6px;
            padding: 4px;
          }
        }

        @media (max-width: 1400px) {
          .game-interface-responsive {
            grid-template-columns: minmax(260px, 350px) 1fr;
            column-gap: 6px;
            padding: 4px;
          }
        }

        @media (max-width: 1200px) {
          .game-interface-responsive {
            grid-template-columns: minmax(220px, 300px) 1fr;
            column-gap: 4px;
            padding: 2px;
          }
        }

        @media (max-width: 768px) {
          .game-interface-responsive {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto 1fr auto !important;
            column-gap: 0;
            padding: 0;
            height: 100dvh;
            min-height: -webkit-fill-available;
          }
          .game-interface-responsive > * {
            grid-column: 1 !important;
          }
          /* One column means the board would stack into the panel's cell and
             its React-Flow layers bleed through the panel text — hide it on the
             shared layout at phone width (the panel is the actionable surface;
             per-player phone view already shows no board). */
          .game-board-area {
            display: none !important;
          }
        }

        @media (max-width: 480px) {
          .game-interface-responsive {
            padding: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Clear per-turn notification state on genuine player/turn transitions.
  // gamePhase/players/currentPlayerId/turnNumber/gameStateCompletedActions/
  // tvDarkMode used to be local state, manually re-synced from a subscribe
  // callback AND duplicated in a "initialize with current state" block right
  // below it (the synchronous duplication react-hooks/set-state-in-effect
  // flagged here) — now they're read directly from useSyncedGameState above,
  // so the only thing left to do here is detect an actual player/turn change
  // and clear the per-turn notification state. A ref tracking the previous
  // values takes over the job the old subscribe callback's closure was
  // doing (comparing against React state captured before this render).
  const prevTransitionRef = useRef<{ playerId: string | null; turnNumber: number } | null>(null);
  useEffect(() => {
    const prev = prevTransitionRef.current;
    const playerChanged = !!prev && prev.playerId !== currentPlayerId;
    const turnChanged = !!prev && prev.turnNumber !== turnNumber;
    if (playerChanged || turnChanged) {
      notificationService.clearAllNotifications();
      setButtonFeedback({});
      setPlayerNotifications({});
      setApprovalRevokeNotice({});
    }
    prevTransitionRef.current = { playerId: currentPlayerId, turnNumber };
  }, [currentPlayerId, turnNumber, notificationService]);

  // Clear all notifications on unmount (previously the cleanup of the
  // subscribe effect above, which also fired on every player/turn change
  // since those were in its dependency array — unmount is the only case
  // that actually matters here, the transition case is handled explicitly
  // above).
  useEffect(() => {
    return () => {
      notificationService.clearAllNotifications();
    };
  }, [notificationService]);

  // NOTE: Auto-show movement path logic disabled - using board-based movement
  // indicators instead. The remaining state and toggle handler for that panel
  // were a closed dead subgraph (nothing rendered it, nothing could turn it on)
  // and have been removed; no component references MovementPathVisualization.

  // Handlers for negotiation modal
  const handleCloseNegotiationModal = () => {
    setIsNegotiationModalOpen(false);
    setNegotiationPartnerId(null);
  };

  // Handlers for rules modal (toggle behavior)
  const handleToggleRulesModal = () => {
    if (isRulesModalOpen) {
      setIsRulesModalOpen(false);
    } else {
      // Close any open side panels when modal opens
      setIsSpaceExplorerVisible(false);
      setIsRulesModalOpen(true);
      const gameId = getCurrentGameId();
      if (gameId) trackPlaytestEvent('panel_opened', { gameId, playerId: currentPlayerId || undefined, panel: 'rules' });
    }
  };

  const handleCloseRulesModal = () => {
    setIsRulesModalOpen(false);
  };

  // Handlers for card details modal.
  // NOTE: the open helper here had no caller — the live entry point is the
  // initialPreview effect above, which sets selectedCard + opens the modal
  // directly — so it has been removed.
  const handleCloseCardDetailsModal = () => {
    setIsCardDetailsModalOpen(false);
    setSelectedCard(null);
  };

  // Handlers for space explorer panel
  const handleToggleSpaceExplorer = () => {
    setIsSpaceExplorerVisible(!isSpaceExplorerVisible);
  };

  // Handler for pull-to-refresh (mobile view)
  const handlePullToRefresh = async () => {
    await stateService.loadStateFromServer();
  };

  // Handler for game log toggle
  const handleToggleGameLog = () => {
    setIsGameLogVisible(prev => {
      const next = !prev;
      if (next) {
        const gameId = getCurrentGameId();
        if (gameId) trackPlaytestEvent('panel_opened', { gameId, playerId: currentPlayerId || undefined, panel: 'log' });
      }
      return next;
    });
  };

  // Handler for glossary toggle
  const handleToggleGlossary = () => {
    if (isDictionaryOpen) {
      closeDictionary();
    } else {
      openDictionary();
      const gameId = getCurrentGameId();
      if (gameId) trackPlaytestEvent('panel_opened', { gameId, playerId: currentPlayerId || undefined, panel: 'glossary' });
    }
  };

  // Handler for display settings
  const handleTogglePanel = (playerId: string) => {
    setVisiblePanels(prev => {
      const currentValue = prev[playerId];
      const isCurrentlyVisible = currentValue !== false; // Default to true if undefined

      // Simple toggle: visible -> hidden, hidden -> visible
      const newPanels = { ...prev };
      newPanels[playerId] = !isCurrentlyVisible;

      return newPanels;
    });
  };

  // Handler to clear a player's device connection status (allows re-scanning QR code)
  const handleClearDeviceType = (playerId: string) => {
    stateService.updatePlayer({ id: playerId, deviceType: undefined });
  };

  // Action handlers for ActionCenterPanel
  const handleRollDice = async () => {
    if (!currentPlayerId) return;

    // Haptic feedback for dice roll
    haptics.diceRoll();

    try {
      const result = await turnService.rollDiceWithFeedback(currentPlayerId);
      const currentPlayer = players.find(p => p.id === currentPlayerId);

      if (currentPlayer) {
        // Show dice result modal with detailed feedback (queued — fb:ac29b623)
        diceResultQueue.enqueue(result);

        // Also use unified notification system for the banner
        notificationService.notify(
          NotificationUtils.createDiceRollNotification(result.diceValue, result.effects || [], currentPlayer.name),
          {
            playerId: currentPlayerId,
            playerName: currentPlayer.name,
            actionType: 'dice'
          }
        );
      }
    } catch (error) {
      console.error("Error rolling dice:", error);
      haptics.error(); // Error haptic feedback
      const currentPlayer = players.find(p => p.id === currentPlayerId);
      if (currentPlayer) {
        notificationService.notify(
          NotificationUtils.createErrorNotification('dice roll', error instanceof Error ? error.message : 'Unknown error', currentPlayer.name),
          {
            playerId: currentPlayerId,
            playerName: currentPlayer.name,
            actionType: 'dice'
          }
        );
      }
    }
  };

  // NOTE: end-turn and manual-effect handlers used to live here for the classic
  // panel. PlayerPanelV2 owns both flows now (turnService.endTurnWithMovement /
  // triggerManualEffectWithFeedback), so the copies here were unreachable and
  // have been removed rather than left to read like live wiring.

  const handleAutomaticFunding = async () => {
    if (!currentPlayerId) return;
    try {
      const result = await turnService.handleAutomaticFunding(currentPlayerId);

      // Show modal with funding details (queued — fb:ac29b623)
      if (result && result.effects && result.effects.length > 0) {
        diceResultQueue.enqueue(result);

        // Notification is already sent by TurnService
      }
    } catch (error) {
      console.error("Error handling automatic funding:", error);
    }
  };


  const handleTryAgain = async () => {
    if (!currentPlayerId) return;
    try {
      const result = await turnService.tryAgainOnSpace(currentPlayerId);

      // If Try Again indicates turn should advance, move to next player
      if (result.success && result.shouldAdvanceTurn) {
        // skipAutoMove: true — Try Again already resolved this space
        await turnService.endTurnWithMovement(true, true);
      }
    } catch (error) {
      console.error("Error trying again on space:", error);
    }
  };

  // NOTE: a handleStartGame helper used to live here (add a "Test Player",
  // startGame, place on starting spaces, startTurn). It had no caller — the
  // real game start runs through PlayerSetup — so it has been removed.
  // An isAnyModalOpen() helper was likewise unreferenced; the live equivalent
  // is the `anyModalOpen` const above, used by the Escape-key handler.

  // fb:6e1e8ac4 — one-time tap gate for phone players (TV mode). Renders
  // as a full-screen overlay until tapped; tap primes vibration so the
  // turn-start buzz fires later in the session. Skipped for shared-screen
  // (PC) mode and for already-primed sessions.
  if (needsHapticPrime && effectiveViewPlayerId) {
    const player = stateService.getPlayer(effectiveViewPlayerId);
    const greeting = player?.name ? `Welcome, ${player.name}!` : 'Welcome!';
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: `linear-gradient(135deg, ${player?.color || colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          color: 'white',
          zIndex: 9999,
        }}
        onClick={handleEnterGame}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👋</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {greeting}
        </div>
        <div style={{ fontSize: '1rem', opacity: 0.9, marginBottom: '2rem', maxWidth: '320px' }}>
          Your phone will buzz when it’s your turn — tap below to enable it.
        </div>
        <button
          type="button"
          onClick={handleEnterGame}
          style={{
            padding: '1rem 2.5rem',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            color: player?.color || colors.primary.main,
            background: 'white',
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            cursor: 'pointer',
          }}
        >
          🎮 Tap to Enter Game
        </button>
        <div style={{ fontSize: '0.85rem', opacity: 0.75, marginTop: '1.5rem' }}>
          (You’ll only see this once)
        </div>
      </div>
    );
  }

  return (
    <div
      className="game-interface-responsive"
      style={{
        gridTemplateRows: gamePhase === 'PLAY'
          ? (isGameLogVisible ? 'auto 1fr auto auto' : 'auto 1fr auto')
          : '1fr auto',
        // Dynamic columns: 1 column if no panels shown, 2 columns otherwise
        gridTemplateColumns: hidePanelColumn ? '1fr' : undefined
      }}
    >
      {/* Deploy-update warning — fixed-position, self-subscribing, so one
          instance covers both the mobile and desktop branches below. */}
      <ShutdownNotice />

      {/* Mobile View Mode - Show only player panel */}
      {effectiveViewPlayerId && gamePhase === 'PLAY' && (
        <div
          style={{
            gridColumn: '1 / -1',
            gridRow: '1',
            // No decorative background/border/radius here (fb:2026-07-19) —
            // PlayerPanelWrapper -> PlayerPanelV2 already render their own
            // themed card (background + border + radius, light/dark aware
            // via panelTheme). A second static frame around it just read as
            // "a box inside a box" plus a blue outline that never matched the
            // inner panel's mode.
            overflowY: 'hidden',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}
        >
          {/* Which classroom this game belongs to (fb:75bec2bc) — a corner
              chip so a student always knows they're on their teacher's board,
              not the public one. Hidden on the default classroom. */}
          <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 101 }}>
            <ClassroomBadge />
          </div>
          {/* Reconnect banner — shown when WS drops so the player knows
              why the screen froze. Tap anywhere triggers PullToRefresh.
              fb:TODO-216 */}
          {(connectionState === 'reconnecting' || connectionState === 'disconnected') && (
            <div style={{
              position: 'sticky', top: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '8px 16px',
              backgroundColor: connectionState === 'reconnecting' ? '#fff3cd' : '#f8d7da',
              color: connectionState === 'reconnecting' ? '#856404' : '#721c24',
              borderBottom: `1px solid ${connectionState === 'reconnecting' ? '#ffc107' : '#f5c6cb'}`,
              fontSize: '14px', fontWeight: 600,
            }}>
              {connectionState === 'reconnecting' ? '🔄 Reconnecting to game…' : '⚠️ Connection lost — pull down to retry'}
            </div>
          )}
          <PullToRefresh onRefresh={handlePullToRefresh}>
            {players.find(p => p.id === effectiveViewPlayerId) ? (
              <PlayerPanelWrapper
                gameServices={gameServices}
                playerId={effectiveViewPlayerId}
                onTryAgain={handleTryAgain}
                playerNotification={approvalRevokeNotice[effectiveViewPlayerId] || playerNotifications[effectiveViewPlayerId]}
                onRollDice={handleRollDice}
                onAutomaticFunding={handleAutomaticFunding}
                onManualEffectResult={(result) => {
                  if (result && result.effects && result.effects.length > 0) {
                    diceResultQueue.enqueue(result);
                  }
                }}
                completedActions={completedActions}
                tabRequest={tabRequest}
                // TV mode's phone/controller view has no other glossary entry
                // point — the desktop toolbar button (ProjectProgress, below)
                // never renders on this branch. Bug report 2026-07-22: "no
                // way to access glossary words in tv mode".
                onOpenGlossary={handleToggleGlossary}
              />
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>Player not found</h3>
              </div>
            )}
          </PullToRefresh>
        </div>
      )}

      {/* Desktop View Mode - Show progress, player panels (filtered), and board */}
      {!effectiveViewPlayerId && (
        <>
          {/* Top Panel - Project Progress (only in PLAY phase) */}
          {gamePhase === 'PLAY' && (
            <div style={{
              gridColumn: '1 / -1',
              gridRow: '1'
            }}>
              <ProjectProgress
                players={players}
                currentPlayerId={currentPlayerId}
                dataService={dataService}
                gameRulesService={gameRulesService}
                onToggleGameLog={handleToggleGameLog}
                onOpenRulesModal={handleToggleRulesModal}
                onOpenDisplaySettings={() => setIsDisplaySettingsOpen(true)}
                collapsed={isProgressCollapsed}
                onToggleCollapsed={() => setIsProgressCollapsed(prev => !prev)}
                isRulesOpen={isRulesModalOpen}
                isGameLogOpen={isGameLogVisible}
                isDisplaySettingsOpen={isDisplaySettingsOpen}
                onToggleGlossary={handleToggleGlossary}
                isGlossaryOpen={isDictionaryOpen}
                tvDarkMode={canControlTVDisplay ? tvDarkMode : undefined}
                onToggleTVDarkMode={canControlTVDisplay ? () => stateService.setTVDarkMode(!tvDarkMode) : undefined}
              />
            </div>
          )}

          {/* Left Panel - Player Panels (only show during PLAY if at least one panel is visible) */}
          {gamePhase === 'PLAY' && !hidePanelColumn && (
            <div
              style={{
                gridColumn: '1',
                gridRow: '2',
                // No decorative background/border/radius here (fb:2026-07-19)
                // — see the matching comment on the mobile view's wrapper
                // above; PlayerPanelV2 already renders its own themed card,
                // so this outer frame was a redundant box-in-a-box plus a
                // blue outline that never matched the inner panel's mode.
                padding: '4px',
                overflow: 'hidden',
                position: 'relative',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div className="game-player-panels">
                {(() => {
                  // Show panels only for players not connected on their own device
                  const visiblePlayers = players.filter(p => shouldShowPlayerPanel(p.id));
                  const hasMultipleLocal = visiblePlayers.length > 1;
                  // Rolodex order: the active player's full panel always sits on
                  // top; inactive players' mini-bars sink below it (stable sort,
                  // so their relative order among themselves doesn't shuffle).
                  // Previously this list stayed in fixed player-index order, so
                  // when Player 2 was active, Player 1's mini-bar still rendered
                  // above Player 2's full panel — confusing turn order visually.
                  const orderedPlayers = [...visiblePlayers].sort((a, b) => {
                    const aRank = a.id === currentPlayerId ? 0 : 1;
                    const bRank = b.id === currentPlayerId ? 0 : 1;
                    return aRank - bRank;
                  });
                  return orderedPlayers.map(player => {
                    const isCurrentPlayer = player.id === currentPlayerId;
                    // When multiple local panels, collapse non-current players to a mini bar
                    if (hasMultipleLocal && !isCurrentPlayer) {
                      return (
                        <div key={player.id} className="game-player-panel-item" style={{
                          flex: '0 0 auto',
                          minHeight: 'auto',
                          padding: '6px 10px',
                          background: '#f5f5f5',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.8rem',
                          color: '#757575',
                        }}>
                          <PlayerAvatar avatar={player.avatar} color={player.color} size={24} title={player.name} />
                          <span style={{ fontWeight: 'bold', color: '#343a40' }}>{player.name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>📍 {friendlySpaceName(dataService, player.currentSpace)}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={player.id} className="game-player-panel-item">
                        <PlayerPanelWrapper
                          gameServices={gameServices}
                          playerId={player.id}
                          onTryAgain={handleTryAgain}
                          playerNotification={approvalRevokeNotice[player.id] || playerNotifications[player.id]}
                          onRollDice={handleRollDice}
                          onAutomaticFunding={handleAutomaticFunding}
                          onManualEffectResult={(result) => {
                            if (result && result.effects && result.effects.length > 0) {
                              diceResultQueue.enqueue(result);
                            }
                          }}
                          completedActions={completedActions}
                          tabRequest={tabRequest}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Board during PLAY phase. v3.0.0 retired BoardV3; BoardCanvas
              (coordinate-driven React Flow renderer with drag-to-save) is
              the only board. Admin-only Edit/Edges/Hidden controls in the
              top-right toggle still drive its props. */}
          {gamePhase === 'PLAY' && (
            // At phone width the grid collapses to one column, so the board and
            // the left player panel (both gridRow 2) would land in the same cell
            // and the board's React-Flow layers bleed through the panel text
            // (fb mobile board-bleed). Tag it so the ≤768px rule hides it — but
            // only when a panel is actually shown; with the panel column hidden
            // the board is alone and full-width, so there's nothing to overlap.
            <div
              className={hidePanelColumn ? undefined : 'game-board-area'}
              style={{ gridColumn: hidePanelColumn ? '1 / -1' : '2', gridRow: '2', overflow: 'hidden' }}
            >
              <BoardCanvas
                currentPlayerId={currentPlayerId}
                players={players}
                isAdmin={boardEditMode}
                edgesVisible={boardEdgesVisible}
                hiddenEdgeIds={hiddenEdgeIds}
                onHideEdge={onHideEdge}
                edgeWaypoints={edgeWaypoints}
                onSetEdgeWaypoint={onSetEdgeWaypoint}
                onClearEdgeWaypoint={onClearEdgeWaypoint}
              />
            </div>
          )}
        </>
      )}

      {/* Bottom Panel - Additional UI Elements */}
      {isGameLogVisible && (
        <div
          style={{
            gridColumn: '1 / -1',
            gridRow: gamePhase === 'PLAY' ? '3' : '2',
            background: colors.secondary.bg,
            border: `2px solid ${colors.secondary.light}`,
            borderRadius: '8px',
            padding: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.secondary.main,
            minHeight: '80px'
          }}
        >
          <GameLog />
        </div>
      )}


      {/* Conditional rendering based on game phase */}
      {gamePhase === 'SETUP' && (
        <PlayerSetup
          viewPlayerId={effectiveViewPlayerId || undefined}
          onStartGame={async (players, settings) => {

            // Build game mode settings if Same Starting Point is enabled
            const gameModeSettings = settings.sameStartingPoint ? {
              gameMode: 'SAME_START' as const,
              startingMode: settings.startingMode,
              startingHand: settings.preSelectedHand
            } : undefined;

            // Actually start the game through StateService
            stateService.startGame(gameModeSettings);

            // Place players on starting spaces (no effects processing)
            try {
              await turnService.placePlayersOnStartingSpaces();

              // Start the first turn (this will create snapshots and mark as initialized)
              const currentState = stateService.getGameState();
              if (currentState.currentPlayerId) {
                await turnService.startTurn(currentState.currentPlayerId);
              }
            } catch (error) {
              console.error('❌ Error placing players on starting spaces:', error);
            }
          }}
        />
      )}
      

      
      {/* ChoiceModal - always rendered, visibility controlled by state.
          v3.0.17: passes effectiveViewPlayerId so non-target players' phones
          suppress the modal during a L003/L048 global-discard fan-out. The
          host view (effectiveViewPlayerId undefined) and PC mode keep
          seeing the modal as before. */}
      <ChoiceModal viewerId={effectiveViewPlayerId || undefined} />

      {/* DiceResultModal - shows detailed dice roll feedback */}
      <DiceResultModal
        isOpen={isDiceResultModalOpen}
        result={diceResult}
        onClose={diceResultQueue.close}
        onExitComplete={diceResultQueue.handleExitComplete}
      />

      {/* LifeEventModal - dedicated modal for 1-in-6 life event card draws.
          Opens AFTER the regular dice modal closes; clears the queue on
          dismiss. fb:dfdeaf1c. */}
      <LifeEventModal
        isOpen={isLifeEventModalOpen}
        data={pendingLifeEvent}
        playerCount={players.length}
        onClose={() => {
          setIsLifeEventModalOpen(false);
          setPendingLifeEvent(null);
        }}
      />

      {/* RoutingExplanationModal - "why am I here" after the FDNY logic chain
          routes the player. Queued behind dice + life event. fb:f1bc011b. */}
      {isRoutingModalOpen && pendingRouting && (
        <RoutingExplanationModal
          message={pendingRouting.message}
          toSpaceLabel={pendingRouting.toSpaceLabel}
          onClose={() => {
            setIsRoutingModalOpen(false);
            setPendingRouting(null);
          }}
        />
      )}

      {/* EndGameModal - always rendered, visibility controlled by state */}
      <EndGameModal />
      
      {/* NegotiationModal - always rendered, visibility controlled by state */}
      <NegotiationModal
        isOpen={isNegotiationModalOpen}
        onClose={handleCloseNegotiationModal}
        initialPartnerId={negotiationPartnerId ?? undefined}
      />
      
      {/* RulesModal - always rendered, visibility controlled by state */}
      <RulesModal 
        isOpen={isRulesModalOpen} 
        onClose={handleCloseRulesModal} 
      />
      
      {/* CardDetailsModal - always rendered, visibility controlled by state */}
      <CardDetailsModal 
        isOpen={isCardDetailsModalOpen}
        onClose={handleCloseCardDetailsModal}
        card={selectedCard}
        currentPlayer={players.find(p => p.id === currentPlayerId) || null}
        otherPlayers={players.filter(p => p.id !== currentPlayerId)}
        cardService={cardService}
      />
      
      {/* Space Explorer Panel */}
      {isSpaceExplorerVisible && (
        <SpaceExplorerPanel
          isVisible={isSpaceExplorerVisible}
          onToggle={handleToggleSpaceExplorer}
          initialSelectedSpace={previewSpaceId}
        />
      )}

      {/* Display Settings Modal */}
      {isDisplaySettingsOpen && (
        <GameDisplaySettings
          players={players}
          visiblePanels={visiblePanels}
          onTogglePanel={handleTogglePanel}
          onClose={() => setIsDisplaySettingsOpen(false)}
          onClearDeviceType={handleClearDeviceType}
        />
      )}

      {/* Beta notice footer - only show if not in mobile view */}
      {!effectiveViewPlayerId && (
        <div style={{
          gridColumn: '1 / -1',
          gridRow: isGameLogVisible ? '4' : '3',
          backgroundColor: colors.primary.light,
          padding: '0.25rem 0.5rem',
          fontSize: '0.7rem',
          color: colors.text.secondary,
          textAlign: 'center',
          borderTop: `1px solid ${colors.primary.main}`,
          flexShrink: 0,
        }}>
          <strong>Beta</strong> · Bug? Use the <IconBug size="0.95em" style={{ margin: '0 0.15em' }} /> button (bottom-right) · <a href="mailto:game@unravelcodes.com" style={{ color: colors.primary.main }}>game@unravelcodes.com</a>
        </div>
      )}

      <PlayerDebug />

      {/* Board controls, top-right. BoardToggle gates all of this to
          admin or a logged-in teacher — not regular players (G160,
          2026-07-26). Edit mode is admin-only even within that. */}
      <BoardToggle
        editMode={boardEditMode}
        onEditModeChange={setBoardEditMode}
        edgesVisible={boardEdgesVisible}
        onEdgesVisibleChange={setBoardEdgesVisible}
        hiddenEdgeCount={hiddenEdgeIds.size}
        onClearHiddenEdges={onClearHiddenEdges}
        redirectedEdgeCount={Object.keys(edgeWaypoints).length}
        onClearRedirectedEdges={onClearAllEdgeWaypoints}
      />

      {/* One-time onboarding nudge for the dictionary feature.
          Self-contained: reads localStorage for "seen" state, auto-dismisses
          after 12s or on click. Only renders during gameplay so the hint
          fires when there's actually game text with highlighted terms. */}
      {gamePhase === 'PLAY' && <DictionaryHint />}
    </div>
  );
}
