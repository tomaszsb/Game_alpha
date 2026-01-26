
/**
 * Remote Configuration Service
 * Fetches visibility settings from the Dashboard API
 */

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
    show_ad_image_url: boolean;
    [key: string]: boolean;
}

import bundledConfig from '../data/config.json';

const API_ENDPOINT = 'https://dashboard.unravelcodes.com/api/public/config/services';

// Initialize cache with bundled config
let configCache: Record<string, ServiceVisibility> | null = bundledConfig as any;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute

export async function fetchRemoteConfig(mode: string = 'game'): Promise<ServiceVisibility | null> {
    const now = Date.now();

    // Return cached/bundled if valid
    if (configCache && (now - lastFetchTime < CACHE_DURATION)) {
        // If we haven't fetched yet (freq=0) but have bundle, return bundle but trigger fetch in background?
        // For simplicity, just return what we have.
        return configCache[mode] || null;
    }

    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) {
            console.warn(`Failed to fetch remote config: ${response.status}`);
            // Return bundled if fetch fails
            return (bundledConfig as any)[mode] || null;
        }

        const data = await response.json();
        configCache = data;
        lastFetchTime = now;

        return data[mode] || null;
    } catch (error) {
        console.warn('Error fetching remote config:', error);
        return (bundledConfig as any)[mode] || null;
    }
}
