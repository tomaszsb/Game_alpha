
import { debugWarn } from './debugLog';

/**
 * Remote Configuration Service (Game Alpha)
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

const API_ENDPOINT = import.meta.env.VITE_CONFIG_URL || 'https://dashboard.unravelcodes.com/api/public/config/services';

// Default config (fallback)
const DEFAULT_CONFIG: Record<string, ServiceVisibility> = {
    game: {
        "show_term": true,
        "show_category": true,
        "show_simple_def": true,
        "show_technical_def": false,
        "show_why_it_matters": false,
        "show_related_docs": false,
        "show_instructions": false,
        "show_aliases": true,
        "show_connections": true,
        "show_game_card_id": true,
        "show_game_space_id": true,
        "show_visual_example": true,
        "show_video": false,
        "show_source": false,
        "show_instagram": false,
        "show_quiz_mode": false,
        "show_ad_copy": true,
        "show_ad_link": true,
        "show_ad_image_url": true
    }
};

// Cache to prevent excessive fetching
let configCache: Record<string, ServiceVisibility> | null = DEFAULT_CONFIG;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute

export async function fetchRemoteConfig(mode: string = 'game'): Promise<ServiceVisibility | null> {
    const now = Date.now();

    // Return cached/bundled if valid (and fetch not needed or failed recently)
    // If we want fresh data, we should try fetch first, then fallback?
    // To avoid delay, we return cache, but trigger update if old?
    // For simplicity: If expired, await fetch. If fetch fails, return cache.

    if (now - lastFetchTime < CACHE_DURATION && configCache) {
        return configCache[mode] || null;
    }

    // Skip cross-origin fetch — dashboard API doesn't support CORS
    // Use the bundled default config instead
    if (!window.location.origin.includes('dashboard.unravelcodes.com')) {
        lastFetchTime = now;
        return (configCache as any)[mode] || null;
    }

    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) {
            debugWarn(`Failed to fetch remote config: ${response.status}`);
            return (configCache as any)[mode] || null;
        }

        const data = await response.json();
        configCache = data;
        lastFetchTime = now;

        return data[mode] || null;
    } catch (error) {
        debugWarn('Error fetching remote config:', error);
        return (configCache as any)[mode] || null;
    }
}
