// PlayerChronicleV2 — the new panel's "what's happened" history (Pile 3 /
// change-legibility; the Project Chronicle, first slice). An openable timeline
// of committed actions so a player can look back at what changed and when —
// the recall counterpart to PlayerNumbersV2's current-state snapshot.
//
// 2026-08-25 (maintainer decision): this is no longer its own feed. Every
// history surface — this modal, the shared-screen Log, the TV column, the
// end-of-game viewer — renders the SAME <HistoryFeed/> and differs only in
// which filters it opens with. This one opens filtered to the player whose
// panel it is; the "Who" chip lets them widen it to the whole table.
//
// What stays here: the modal shell (ModalBase), the panel's light/dark mode,
// and closing the modal when a row jumps the board to a space. Everything
// else — the block grouping, the wording, the filter chips — lives in
// HistoryFeed so the surfaces can't drift apart.

import React, { useState } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { HistoryFeed, HistoryFeedFilters } from '../game/HistoryFeed';
import { ModalBase } from '../modals/shared/ModalBase';
import { panelPalettes, PanelMode } from './panelTheme';
import { getCardTypeName } from '../../utils/cardTypeNames';
import { colors } from '../../styles/theme';

export interface PlayerChronicleV2Props {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  gameServices: IServiceContainer;
  /** The panel's light/dark mode — body and ModalBase shell follow it. */
  mode?: PanelMode;
  /** Click-entry-to-replay-highlight (TODO P1 change-legibility) — called
   *  with the block's raw space id (the CSV space_name / React Flow node
   *  id, NOT the shortName()-displayed label) when the player clicks a log
   *  entry or its turn-block header. Rows render as plain, non-interactive
   *  text when omitted (e.g. the phone/controller view, which has no board
   *  on the same screen to pan). */
  onNavigateToSpace?: (spaceId: string) => void;
  /** Cards whose family CARD_TYPES.csv files under history (Life Events on the
   *  stock board) — they used to sit in "What's affecting you" (fb:adad1561).
   *  Shown above the feed, grouped by family, each tappable for details. */
  historyCards?: Array<{ id: string; name: string; type: string }>;
  onOpenCard?: (cardId: string) => void;
}

export const PlayerChronicleV2: React.FC<PlayerChronicleV2Props> = ({
  isOpen,
  onClose,
  playerId,
  gameServices,
  mode = 'light',
  onNavigateToSpace,
  historyCards = [],
  onOpenCard,
}) => {
  const p = panelPalettes[mode];
  // Opens on "just me" — the panel's frame of reference — but it's a chip, not
  // a hard scope, so the player can widen it to the whole table and back.
  const [filters, setFilters] = useState<HistoryFeedFilters>(() => ({ who: playerId, what: 'all' }));

  const footer = (
    <button
      onClick={onClose}
      aria-label="Close"
      style={{
        border: `1px solid ${p.borderStrong}`,
        background: p.surf,
        color: p.text,
        borderRadius: 9,
        padding: '9px 16px',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      Got it
    </button>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="What's happened"
      emoji="📜"
      maxWidth="420px"
      footer={footer}
      testId="player-chronicle-v2"
      mode={mode}
    >
      {historyCards.length > 0 && (
        <div data-testid="chronicle-history-cards" style={{ marginBottom: 12 }}>
          {[...new Set(historyCards.map((c) => c.type))].map((type) => {
            const ofType = historyCards.filter((c) => c.type === type);
            return (
              <div key={type} style={{ marginBottom: 6 }}>
                <p style={{ fontSize: 10, letterSpacing: '0.05em', color: p.muted, textTransform: 'uppercase', margin: '0 0 6px' }}>
                  {getCardTypeName(type, ofType.length)}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ofType.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onOpenCard?.(c.id)}
                      disabled={!onOpenCard}
                      aria-label={`Details for ${c.name}`}
                      style={{
                        fontSize: 12, padding: '5px 9px', borderRadius: 8, background: p.surf2,
                        border: `1px solid ${p.border}`, color: p.text,
                        cursor: onOpenCard ? 'pointer' : 'default',
                      }}
                    >
                      {colors.game.cardTypes[type]?.emoji ?? '📄'} {c.name} <span aria-hidden style={{ color: p.muted }}>ⓘ</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <HistoryFeed
        gameServices={gameServices}
        mode={mode}
        filters={filters}
        onFiltersChange={setFilters}
        defaultFilters={{ who: playerId, what: 'all' }}
        maxHeight={420}
        emptyText="Nothing yet — your moves and changes will show up here as you play."
        testId="player-chronicle-feed"
        onNavigateToSpace={
          onNavigateToSpace
            ? (spaceId: string) => {
                onNavigateToSpace(spaceId);
                onClose();
              }
            : undefined
        }
      />
    </ModalBase>
  );
};
