// src/playtest/playtestAnalytics.ts
//
// Minimal funnel tracking for the QR-code -> landing page -> reminder ->
// return-visit -> play funnel. Fire-and-forget: a failed tracking call must
// never break the landing page. The campaign source (?src= or
// ?utm_campaign=) is captured once and persisted so later events (e.g.
// "play_click", which navigates to "/" and loses the query string) can
// still attach it.

import { getBackendURL } from '../utils/networkDetection';
import { getStoredCampaignSource, storeCampaignSource } from './playtestStorage';

export type PlaytestEvent =
  | 'landing_view'
  | 'preview_click'
  | 'reminder_selected'
  | 'bookmark_click'
  | 'play_click'
  | 'return_visit'
  | 'share_click'
  // In-game engagement tracking (TODO.md, decided 2026-08-02) — "how far
  // players get, what draws their attention." Reuses this same
  // funnel-tracking endpoint/pattern rather than a parallel one.
  | 'space_reached'
  | 'game_finished'
  | 'panel_opened';

/** Optional fields the in-game engagement events attach. Always pseudonymous
 *  (gameId/playerId), never the player's display name. */
export interface EngagementTrackingDetails {
  gameId?: string;
  playerId?: string;
  spaceId?: string;
  panel?: string;
}

function resolveCampaignSource(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('src') || params.get('utm_campaign');
  if (fromUrl) {
    storeCampaignSource(fromUrl);
    return fromUrl;
  }
  return getStoredCampaignSource();
}

export function trackPlaytestEvent(event: PlaytestEvent, details?: EngagementTrackingDetails): void {
  try {
    const campaignSource = resolveCampaignSource();
    fetch(`${getBackendURL()}/api/playtest/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, campaignSource, ...details }),
      keepalive: true,
    }).catch(() => { /* tracking must never break the page */ });
  } catch {
    /* ignored */
  }
}
