// src/components/setup/SpectatorWaitingScreen.tsx
//
// Shown instead of the full PlayerSetup form when someone joins a game via
// "Just watching" (the picker in the "Join or resume a game" flow) while
// that game is still in SETUP phase. Maintainer report 2026-08-18: without
// this, a spectator landed on the exact same editable setup screen as the
// host — able to rename/remove/re-color players, even press Start Game —
// because PlayerSetup has no concept of "read-only visitor," only "the
// current game's players." Read-only: shows who's in so far and waits for
// gamePhase to flip to PLAY (GameLayout's own gamePhase branch then swaps
// to the normal shared/spectator PLAY view automatically, same as it
// already does for joining an already-started game).

import React from 'react';
import { colors } from '../../styles/theme';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { Player } from '../../types/StateTypes';
import { getCurrentGameId } from '../../utils/networkDetection';
import { IconEye, IconHourglass } from '../icons/SetupIcons';

interface SpectatorWaitingScreenProps {
  players: Player[];
}

export function SpectatorWaitingScreen({ players }: SpectatorWaitingScreenProps): JSX.Element {
  const namedPlayers = players.filter(p => p.name.trim());
  const gameId = getCurrentGameId();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.purple.main} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '16px', color: 'white', display: 'flex', alignItems: 'center', gap: '0.3em' }}>
        <IconEye size="1em" />
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
        Just watching
      </div>
      <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.85)', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '0.4em' }}>
        <IconHourglass size="1em" /> Waiting for the host to start {gameId ? <strong>{gameId}</strong> : 'the game'}…
      </div>

      {namedPlayers.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 12,
          padding: '1rem 1.25rem',
          minWidth: 220,
        }}>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', marginBottom: '0.6rem' }}>
            Players so far
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {namedPlayers.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontWeight: 600 }}>
                <PlayerAvatar avatar={p.avatar} color={p.color} size={24} />
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
