// src/components/game/LiveTrophyBoard.tsx
//
// The live trophy board (Manager brief Job 5, first slice). It replaces the big per-player cards in the
// Progress panel and the "Where everyone is" standings pop-up. For each player it shows their place in
// the three races (fastest / on budget / best built) and how far behind the leader they are, from the
// same numbers the end-of-game count uses (GameRulesService.computeLiveBoard, TROPHIES.csv names).
//
// Players take turns at different points in time, so a place is only provisional until every other
// player has passed that player's day count; provisional places are drawn lighter and the board says why.
// All wording is a first draft for Tom.

import React from 'react';
import type { Player } from '../../types/DataTypes';
import type { IGameRulesService } from '../../types/ServiceContracts';
import { panelPalettes, PanelMode } from '../player/panelTheme';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { getTrophyRules, TROPHY_IDS, TrophyId } from '../../utils/trophyRules';
import { ordinal, LiveRow } from '../../utils/liveTrophies';
import { FormatUtils } from '../../utils/FormatUtils';

export interface LiveTrophyBoardProps {
  players: Player[];
  gameRulesService: Pick<IGameRulesService, 'computeLiveBoard'>;
  currentPlayerId: string | null;
  mode: PanelMode;
  /** Tighter spacing for the small Progress strip. */
  compact?: boolean;
}

function detail(id: TrophyId, row: LiveRow): string {
  const r = row.row;
  if (id === 'time') return `${r.daysUsed} of ${r.daysPlanned} planned days`;
  if (id === 'money') return `${FormatUtils.formatMoney(r.moneySpent)} of ${FormatUtils.formatMoney(r.moneyPlanned)} planned`;
  return r.reviews > 0
    ? `${r.problemPoints} problem point${r.problemPoints === 1 ? '' : 's'} in ${r.reviews} review${r.reviews === 1 ? '' : 's'}`
    : 'No reviews yet';
}

export function LiveTrophyBoard({ players, gameRulesService, currentPlayerId, mode, compact }: LiveTrophyBoardProps): JSX.Element | null {
  const p = panelPalettes[mode];
  if (players.length === 0) return null;
  const board = gameRulesService.computeLiveBoard();
  const names = getTrophyRules().names;
  const pad = compact ? '4px 6px' : '6px 8px';

  return (
    <div data-testid="live-trophy-board" style={{ display: 'flex', flexDirection: 'column', gap: 6, color: p.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {board.rows.map(row => {
          const player = players.find(x => x.id === row.playerId);
          const isCurrent = row.playerId === currentPlayerId;
          const out = row.status === 'out';
          return (
            <div
              key={row.playerId}
              data-testid="player-progress-card"
              data-player-name={row.name}
              data-finished={String(row.status === 'finished')}
              data-out={String(out)}
              data-provisional={String(!out && !row.solid)}
              style={{
                background: isCurrent ? p.surf2 : p.surf,
                border: isCurrent ? `1px solid ${p.accent}` : '1px solid transparent',
                borderRadius: 9, padding: pad, opacity: out ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: compact ? '0.72rem' : '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                {player && <PlayerAvatar avatar={player.avatar} color={player.color} size={compact ? 16 : 20} title={row.name} />}
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                {isCurrent && !out && row.status !== 'finished' && <span style={{ color: p.muted, fontWeight: 400 }}>· their turn</span>}
                {row.status === 'finished' && <span style={{ color: p.muted, fontWeight: 400 }}>· finished</span>}
                {out && <span style={{ color: p.muted, fontWeight: 400 }}>· out</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                {TROPHY_IDS.map(id => {
                  const race = row.races[id];
                  const leading = race.place === 1;
                  return (
                    <div
                      key={id}
                      data-testid={`trophy-race-${id}`}
                      data-place={race.place ?? ''}
                      title={out ? `${names[id]}: out of the game` : `${names[id]}: ${race.value}% of plan so far (${detail(id, row)})`}
                      style={{ fontSize: compact ? '0.62rem' : '0.7rem', lineHeight: 1.25, opacity: row.solid || out ? 1 : 0.75, fontStyle: row.solid || out ? 'normal' : 'italic' }}
                    >
                      <div style={{ color: p.muted }}>{names[id]}</div>
                      {out || race.place === null ? (
                        <div>—</div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 700, color: leading ? p.good : p.text }}>
                            {leading ? '🏆 ' : ''}{ordinal(race.place)} <span style={{ fontWeight: 400, color: p.muted }}>of {race.of}</span>
                          </div>
                          <div style={{ color: p.muted }}>
                            {leading ? 'leading' : `${race.behind} points behind`}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {board.anyProvisional && (
        <div data-testid="live-trophy-note" style={{ fontSize: compact ? '0.58rem' : '0.68rem', color: p.muted, fontStyle: 'italic' }}>
          Places in italics are for now. Players take their turns at different points in time, so a place settles
          once every other player has passed that player&apos;s day.
        </div>
      )}
    </div>
  );
}
