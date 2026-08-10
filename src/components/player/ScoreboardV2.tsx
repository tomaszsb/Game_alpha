// ScoreboardV2 — the redesigned shared-screen "who" surface (redesign §2).
//
// Soft positional standings, NOT a ranked race: players are tokens on the
// permitting-lifecycle rail at their furthest-reached phase, so you read who's
// where on the shared journey without rank numbers, win/lose, or elimination
// framing (the game has no bankruptcy — bias watch-list #6). Below the rail,
// each player's status row mirrors the panel's status zone (icon cash/days +
// approval diodes) so panel and scoreboard read as one system.
//
// Lifecycle position comes from the shared `playerLifecyclePosition` helper (same
// rule as ProjectProgress — no drift). Shared-screen only; the live TVDisplay
// wiring is a separate step. §10.3: a region is left for the future Chronicle.

import React, { useEffect, useState } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { PanelMode, panelPalettes } from './panelTheme';
import { playerLifecyclePosition } from '../../utils/lifecycleProgress';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { getDobLabel, getFdnyLabel } from '../../services/ApprovalService';

export interface ScoreboardV2Props {
  gameServices: IServiceContainer;
  mode: PanelMode;
}

// Same status → display mapping as PlayerPanelV2's approval diodes (kept visually
// consistent across the two surfaces).
function approvalMark(status: string | undefined): { mark: string; dot: string; label: string } | null {
  if (!status || status === 'none') return null;
  switch (status) {
    case 'approved': return { mark: '✓', dot: '#22c55e', label: 'approved' };
    case 'minor-objection': return { mark: '!', dot: '#f59e0b', label: 'objection' };
    case 'denied': return { mark: '✗', dot: '#ef4444', label: 'denied' };
    default: return { mark: '·', dot: '#94a3b8', label: status };
  }
}

// 'REGULATORY' → 'Regulatory' (player-language phase labels).
function prettyPhase(phase: string): string {
  if (!phase || phase === 'UNKNOWN') return 'Getting started';
  return phase
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export const ScoreboardV2: React.FC<ScoreboardV2Props> = ({ gameServices, mode }) => {
  const p = panelPalettes[mode];
  const [, force] = useState(0);

  useEffect(() => {
    const unsub = gameServices.stateService.subscribe(() => force((n) => n + 1));
    return () => unsub();
  }, [gameServices.stateService]);

  const players = gameServices.stateService.getAllPlayers();
  if (!players || players.length === 0) return null;

  const gameState = gameServices.stateService.getGameState();
  const currentId = gameState.currentPlayerId;
  const phases = gameServices.dataService.getPhaseOrder();

  const standings = players.map((player) => ({
    player,
    pos: playerLifecyclePosition(player, gameServices.dataService),
  }));

  // --- styles -------------------------------------------------------------
  const wrap: React.CSSProperties = {
    background: p.bg,
    color: p.text,
    border: `0.5px solid ${p.border}`,
    borderRadius: 18,
    padding: 16,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };
  const zlbl: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.05em',
    color: p.muted,
    textTransform: 'uppercase',
    margin: '0 0 10px',
  };

  return (
    <div style={wrap} data-testid="scoreboard-v2">
      <p style={zlbl}>Where everyone is</p>

      {/* Phase rail — tokens sit under each player's furthest-reached phase. */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {phases.map((phase, i) => {
          const here = standings.filter((s) => (s.pos.phaseIndex < 0 ? 0 : s.pos.phaseIndex) === i);
          return (
            <div key={phase} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              {/* connector + node */}
              <div style={{ position: 'relative', height: 14, marginBottom: 6 }}>
                <div style={{ position: 'absolute', top: 6, left: 0, right: 0, height: 2, background: p.border }} />
                <div
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: p.borderStrong,
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: p.muted, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {prettyPhase(phase)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 18 }}>
                {here.map((s) => (
                  <div
                    key={s.player.id}
                    title={`${s.player.name} — ${prettyPhase(s.pos.phase)}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, maxWidth: '100%' }}
                  >
                    <PlayerAvatar avatar={s.player.avatar} color={s.player.color || p.accent} size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.player.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-player status rows — mirrors the panel status zone. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {standings.map(({ player, pos }) => {
          const isCurrent = player.id === currentId;
          const dobv = approvalMark(player.dobApprovalStatus);
          const fdnyv = approvalMark(player.fdnyApprovalStatus);
          return (
            <div
              key={player.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: isCurrent ? p.surf2 : p.surf,
                border: isCurrent ? `1px solid ${p.accent}` : `1px solid transparent`,
                borderRadius: 9,
                padding: '8px 11px',
              }}
            >
              <PlayerAvatar avatar={player.avatar} color={player.color || p.accent} size={22} />
              <span style={{ fontSize: 13, fontWeight: 500, minWidth: 0, flex: '0 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {player.name}
                {isCurrent && <span style={{ color: p.muted, fontWeight: 400 }}> · their turn</span>}
              </span>
              <span style={{ fontSize: 11, color: p.muted, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {prettyPhase(pos.phase)}
              </span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} title="Cash on hand">
                <span aria-hidden>💰</span>${player.money.toLocaleString()}
              </span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} title="Days spent">
                <span aria-hidden>🕐</span>{player.timeSpent}
              </span>
              {(dobv || fdnyv) && (
                <span style={{ display: 'flex', gap: 8, fontSize: 10, color: p.muted }}>
                  {dobv && (
                    <span title={`${getDobLabel()} ${dobv.label}`}>
                      {getDobLabel()} <span style={{ color: dobv.dot, fontWeight: 600 }}>{dobv.mark}</span>
                    </span>
                  )}
                  {fdnyv && (
                    <span title={`${getFdnyLabel()} ${fdnyv.label}`}>
                      {getFdnyLabel()} <span style={{ color: fdnyv.dot, fontWeight: 600 }}>{fdnyv.mark}</span>
                    </span>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
