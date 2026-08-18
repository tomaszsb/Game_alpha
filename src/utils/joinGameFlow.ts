// src/utils/joinGameFlow.ts
//
// Pure, React-free logic behind PlayerSetup's "Join" flow — split out so it
// can be unit tested directly instead of only through a full component
// mount. Two concerns: deciding what a join-info response means (picker vs.
// direct navigate vs. error), and building the URL to navigate to. Neither
// needs React state; PlayerSetup.tsx's performJoinByCode()/navigateToGame()
// are thin wrappers that call these and setState based on the result.

import { getBackendURL } from './networkDetection';

export interface JoinPickerPlayer {
  id: string;
  shortId?: string;
  name: string;
  color?: string;
  avatar?: string;
  connected?: boolean;
}

export type JoinInfoResult =
  | { status: 'not-found'; gameId: string }
  | { status: 'server-error'; gameId: string; httpStatus: number }
  | { status: 'network-error' }
  | { status: 'picker'; gameId: string; token: string; instanceId?: string; players: JoinPickerPlayer[] }
  | { status: 'direct'; gameId: string; token: string; instanceId?: string };

/**
 * Fetch a game code's join-info and classify the result. Mirrors the
 * "which player are you?" picker logic (fb:feedback-1783819148816-bb72760f
 * / fb:feedback-1783819238489-aaae63c0): a game with named players yields
 * 'picker' instead of navigating straight to the shared/spectator view.
 *
 * fb:7bede788 — non-technical reporters described a mistyped/expired code
 * as the game being "unavailable"; both are near-universally a mistyped or
 * expired (~24-41h idle) code, not a permissions problem — the caller's
 * 'not-found' message should say that plainly, not describe it technically.
 */
export async function fetchJoinInfo(rawGameId: string): Promise<JoinInfoResult> {
  const gameId = rawGameId.trim().toUpperCase();
  try {
    const backendURL = getBackendURL();
    const response = await fetch(`${backendURL}/api/games/${gameId}/join-info`);
    if (response.status === 404) {
      return { status: 'not-found', gameId };
    }
    if (!response.ok) {
      return { status: 'server-error', gameId, httpStatus: response.status };
    }
    const data: {
      token: string;
      instanceId?: string;
      players?: JoinPickerPlayer[];
    } = await response.json();

    const pickablePlayers = (data.players || []).filter(p => p.shortId && p.name?.trim());
    if (pickablePlayers.length > 0) {
      return { status: 'picker', gameId, token: data.token, instanceId: data.instanceId, players: pickablePlayers };
    }
    return { status: 'direct', gameId, token: data.token, instanceId: data.instanceId };
  } catch {
    // A real network failure (offline, DNS, CORS) throws something like
    // "Failed to fetch" — the caller shows something actionable instead.
    return { status: 'network-error' };
  }
}

export interface BuildJoinUrlOptions {
  currentUrl: string;
  gameId: string;
  token: string;
  instanceId?: string;
  playerShortId?: string;
  tvMode: boolean;
  /** Whether the physical screen is phone-sized — gates ?p= (fb:3a5280d8):
   * picking a player on a PC/TV must not set ?p=, which GameLayout reads as
   * "show the phone-only stripped panel," wiping out the board on desktop. */
  isPhoneScreen: boolean;
  /** "Just watching" from the picker, not a specific player. Sets ?spectate=1
   * so a target game still in SETUP phase shows a read-only waiting screen
   * (GameLayout/SpectatorWaitingScreen) instead of the full add-players/
   * Start-Game form — maintainer report 2026-08-18: a spectator landed on
   * the exact same editable setup screen as the host and could rename/
   * remove/re-color players and even press Start Game. */
  spectate?: boolean;
}

/** Pure URL-building logic behind navigateToGame — split out for testing. */
export function buildJoinGameUrl(opts: BuildJoinUrlOptions): string {
  const url = new URL(opts.currentUrl);
  url.searchParams.set('g', opts.gameId);
  if (opts.token) url.searchParams.set('token', opts.token);
  // Carry the game's classroom so its board loads (Phase 3c); the default
  // classroom needs no param (plain /data).
  if (opts.instanceId && opts.instanceId !== 'classroom-1') url.searchParams.set('i', opts.instanceId);
  else url.searchParams.delete('i');
  if (opts.playerShortId && opts.isPhoneScreen) url.searchParams.set('p', opts.playerShortId);
  else url.searchParams.delete('p');
  if (opts.tvMode) url.searchParams.set('mode', 'tv');
  else url.searchParams.delete('mode');
  if (opts.spectate) url.searchParams.set('spectate', '1');
  else url.searchParams.delete('spectate');
  return url.toString();
}
