// src/components/setup/JoinByCodePanel.tsx

import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { getBackendURL } from '../../utils/networkDetection';
import { isPhoneScreen } from '../../utils/deviceDetection';
import { styles } from './PlayerSetup.styles';
import { IconController, IconEye } from '../icons/SetupIcons';
import { AvatarIcon } from '../icons/AvatarIcons';

interface JoinPickerPlayer {
  id: string;
  shortId?: string;
  name: string;
  color?: string;
  avatar?: string;
  connected?: boolean;
}

interface JoinPickerState {
  gameId: string;
  token: string;
  instanceId?: string;
  players: JoinPickerPlayer[];
}

interface JoinByCodePanelProps {
  selectedMode: 'pc' | 'tv';
}

/**
 * "Game Setup" settings-drawer section: join an existing game by typed code.
 * When the game already has named players, a "which player are you?" picker
 * (fb:feedback-1783819148816-bb72760f / fb:feedback-1783819238489-aaae63c0)
 * replaces the code entry so a rejoining player who lost their personal QR
 * link can get back to their own actionable panel instead of always landing
 * in the shared/spectator view.
 *
 * That personal-panel behavior is phone-only (fb:3a5280d8): this whole panel
 * lives on the PC/TV setup screen, so a maintainer picking a player on an
 * actual PC or TV still gets the full board and shared view, not the
 * stripped phone panel. See navigateToGame's isPhoneScreen() check below.
 */
export function JoinByCodePanel({ selectedMode }: JoinByCodePanelProps): JSX.Element {
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinPicker, setJoinPicker] = useState<JoinPickerState | null>(null);

  /**
   * Build the join URL and navigate (full reload so AppContent picks up the
   * new gameId/playerId on mount). Shared by direct-join and the "which
   * player are you?" picker below — `playerShortId` omitted means the
   * shared/spectator view, same as today's behavior.
   */
  const navigateToGame = (gameId: string, token: string, instanceId?: string, playerShortId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('g', gameId);
    if (token) url.searchParams.set('token', token);
    // Carry the game's classroom so its board loads (Phase 3c); the default
    // classroom needs no param (plain /data).
    if (instanceId && instanceId !== 'classroom-1') url.searchParams.set('i', instanceId);
    else url.searchParams.delete('i');
    // Mirrors the QR-code join flow's ?p= short id so the picked player
    // lands on their own actionable panel instead of the shared view —
    // but only when this device's physical screen is actually phone-sized
    // (fb:3a5280d8: picking a player on a PC/TV set ?p= unconditionally,
    // which GameLayout reads as "show the phone-only stripped panel,"
    // wiping out the board and all other chrome on a desktop screen).
    // This component only ever renders on the PC/TV setup screen
    // (selectedMode is 'pc' | 'tv', never 'phone'), so selectedMode can't
    // tell a maintainer's desktop apart from a player who lost their QR
    // link and is rejoining from their actual phone — both default to
    // 'pc'. isPhoneScreen() (already used one component up by
    // PhoneScreenWarning) measures the real screen, not the mode toggle,
    // so a genuine phone still gets its personal panel and a PC/TV keeps
    // the full board.
    if (playerShortId && isPhoneScreen()) url.searchParams.set('p', playerShortId);
    else url.searchParams.delete('p');
    if (selectedMode === 'tv') {
      url.searchParams.set('mode', 'tv');
    } else {
      url.searchParams.delete('mode');
    }
    window.location.href = url.toString();
  };

  /**
   * Join an existing game by typed code. Mirrors the retired GameLobby's
   * handleJoinGame — fetches the target game's token, then navigates with a
   * full reload so AppContent picks up the new gameId on mount.
   *
   * fb:feedback-1783819148816-bb72760f / fb:feedback-1783819238489-aaae63c0:
   * a rejoining player who lost their personal QR link had no way to get
   * back to their own actionable panel — "Join by Code" always landed in
   * the shared/spectator view. If join-info comes back with players to
   * choose from, show a picker instead of navigating immediately. A fresh
   * game with no players yet (or a player missing a shortId) falls straight
   * through to the old direct-navigate behavior.
   */
  const handleJoinByCode = async () => {
    setJoinError('');
    const normalized = joinCode.trim().toUpperCase();
    if (!normalized) {
      setJoinError('Enter a game code first.');
      return;
    }
    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games/${normalized}/join-info`);
      if (response.status === 404) {
        // Non-technical reporters have described this as the game being
        // "unavailable" (fb:7bede788) — the actual cause is almost always a
        // mistyped or expired code (games auto-expire after ~24-41h idle),
        // not a permissions problem. Anyone with a valid code can join —
        // there's no separate admin-only path — so say that plainly.
        setJoinError(`No game found with code ${normalized}. It may be mistyped, or the game may have ended — ask whoever's hosting for the current code.`);
        return;
      }
      if (!response.ok) {
        setJoinError(`Couldn't reach game ${normalized} right now (server returned ${response.status}). Try again in a moment.`);
        return;
      }
      const data: {
        token: string;
        instanceId?: string;
        gamePhase?: string;
        playerCount?: number;
        players?: JoinPickerPlayer[];
      } = await response.json();

      const pickablePlayers = (data.players || []).filter(p => p.shortId && p.name?.trim());
      if (pickablePlayers.length > 0) {
        setJoinPicker({
          gameId: normalized,
          token: data.token,
          instanceId: data.instanceId,
          players: pickablePlayers,
        });
        return;
      }

      navigateToGame(normalized, data.token, data.instanceId);
    } catch (err) {
      // A real network failure (offline, DNS, CORS) throws something like
      // "Failed to fetch" — technical and alarming to a non-technical
      // reporter. Log the real error for debugging; show something actionable.
      console.error('Join by code failed:', err);
      setJoinError('Could not connect to the server. Check your connection and try again.');
    }
  };

  /**
   * Picker choice: a specific player → their own actionable panel.
   *
   * Takeover warning (fb takeover-warning follow-up, 2026-07-12/13): if the
   * picked player already has a live WebSocket connection elsewhere (another
   * device actively playing as them), confirm before navigating — otherwise
   * this silently boots them off their own seat. Not a hard block: accepting
   * still proceeds, since a stale/zombie connection from a crashed tab is a
   * common false positive and we don't want to lock a player out of their
   * own seat.
   *
   * Only relevant on an actual phone screen: that's the only case where
   * navigateToGame below assumes the player's ?p= identity (see its
   * isPhoneScreen() gate, fb:3a5280d8). On PC/TV, picking a player doesn't
   * take over their WebSocket connection, so there's nothing to warn about.
   */
  const handlePickPlayer = (player: { shortId?: string; name: string; connected?: boolean }) => {
    if (!joinPicker) return;
    if (!player.shortId) return;
    if (player.connected && isPhoneScreen()) {
      const confirmed = window.confirm(
        `${player.name} is currently connected on another device. Taking over may disrupt their game — continue anyway?`
      );
      if (!confirmed) return;
    }
    navigateToGame(joinPicker.gameId, joinPicker.token, joinPicker.instanceId, player.shortId);
  };

  /** Picker choice: spectate — identical to today's no-picker behavior. */
  const handleJoinAsSpectator = () => {
    if (!joinPicker) return;
    navigateToGame(joinPicker.gameId, joinPicker.token, joinPicker.instanceId);
  };

  return (
    <div style={styles.settingsBlock}>
      <h3 style={{ ...styles.sectionTitleSmall, display: 'flex', alignItems: 'center', gap: '0.4em' }}>
        <IconController size="1em" /> Game Setup
      </h3>

      {/* Join an existing game by code. Navigates with a full reload
          so AppContent picks up the new gameId in the URL the same
          way the retired GameLobby did. When the game already has
          players, a "which player are you?" picker (joinPicker)
          replaces the code entry until a choice is made or cancelled. */}
      <div style={{ marginTop: '0.85rem' }}>
        <label style={styles.label}>Join existing game</label>
        {joinPicker ? (
          <div>
            <p style={{ fontSize: '0.72rem', color: colors.text.secondary, margin: '0 0 0.5rem' }}>
              Game {joinPicker.gameId} already has players. Which one are you?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {joinPicker.players.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePickPlayer(p)}
                  title={p.connected ? `${p.name} is currently connected on another device` : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.65rem',
                    background: 'white',
                    border: `2px solid ${p.color || colors.secondary.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: colors.text.primary,
                    textAlign: 'left',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: p.color || colors.secondary.main,
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  {p.avatar && <span style={{ display: 'inline-flex' }}><AvatarIcon avatar={p.avatar} size="1.1rem" /></span>}
                  <span>{p.name}</span>
                  {p.connected && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: colors.text.secondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: colors.success.text,
                          display: 'inline-block',
                        }}
                      />
                      already connected
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
              <button
                type="button"
                onClick={handleJoinAsSpectator}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.65rem',
                  background: colors.secondary.main,
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
                title="Watch the game without controlling a player."
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
                  <IconEye size="1em" /> Just watching
                </span>
              </button>
              <button
                type="button"
                onClick={() => setJoinPicker(null)}
                style={{
                  padding: '0.5rem 0.65rem',
                  background: 'transparent',
                  color: colors.text.secondary,
                  border: `1px solid ${colors.secondary.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.72rem', color: colors.text.secondary, margin: '0 0 0.4rem' }}>
              Anyone with the code can join — no login needed. This is also how to watch a game in progress without playing.
            </p>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                placeholder="e.g., G-A7F9-K3PX"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoinByCode(); }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.6rem',
                  border: `1px solid ${joinError ? '#dc3545' : colors.secondary.border}`,
                  borderRadius: 6,
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
                maxLength={12}
                autoComplete="off"
                name="gamecode"
                data-lpignore="true"
                data-1p-ignore
              />
              <button
                type="button"
                onClick={handleJoinByCode}
                style={{
                  padding: '0.5rem 0.85rem',
                  background: colors.primary.main,
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
                title="Joining will navigate away from this empty game."
              >
                Join
              </button>
            </div>
            {joinError && (
              <p style={{ fontSize: '0.75rem', color: '#dc3545', margin: '0.35rem 0 0' }}>
                {joinError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
