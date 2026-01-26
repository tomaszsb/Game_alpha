// src/utils/remoteConfig.ts

const API_BASE = 'https://dashboard.unravelcodes.com/api/public';

export interface ServiceVisibility {
  show_term: boolean;
  show_category: boolean;
  show_simple_def: boolean;
  show_technical_def: boolean;
  show_why_it_matters: boolean;
  show_related_docs: boolean;
  show_instructions: boolean;
  show_aliases: boolean;
  show_connections: boolean;
  show_game_card_id: boolean;
  show_game_space_id: boolean;
  show_visual_example: boolean;
  show_video: boolean;
  show_source: boolean;
  show_instagram: boolean;
  show_quiz_mode: boolean;
  show_ad_copy: boolean;
  show_ad_link: boolean;
}

/**
 * Fetches the visibility matrix from the Command Center
 */
export async function fetchRemoteConfig(): Promise<ServiceVisibility | null> {
  try {
    const response = await fetch(`${API_BASE}/config/services`);
    if (!response.ok) return null;
    const data = await response.json();
    // Return the 'game' specific configuration
    return data.game || null;
  } catch (err) {
    console.error('Failed to fetch remote dictionary config:', err);
    return null;
  }
}
