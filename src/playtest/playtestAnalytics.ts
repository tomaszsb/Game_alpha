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
  | 'panel_opened'
  // A real push-back ("Try Again") — fired once, when the engine accepts it.
  // Answers "which controls do players actually push back on, and do they
  // look at the cost first?" (decided 2026-09-24; see engagementStats.js).
  | 'push_back';

/** Optional fields the in-game engagement events attach. Always pseudonymous
 *  (gameId/playerId), never the player's display name. */
export interface EngagementTrackingDetails {
  gameId?: string;
  playerId?: string;
  spaceId?: string;
  panel?: string;
  // push_back only. `turn` + `attempt` make one real push-back identifiable, so
  // two screens reporting the same one are counted once at aggregation while a
  // genuine second push-back at the same space still counts.
  visitType?: string;
  /** What the space charged for this push-back (fixed time-add total, in days). */
  daysCharged?: number;
  turn?: number;
  attempt?: number;
  /** Had the player opened this side's cost box (a tap or Space) BEFORE the
   *  press that committed? Omitted when the caller can't tell. */
  costChecked?: boolean;
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
