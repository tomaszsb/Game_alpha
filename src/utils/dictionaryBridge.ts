// src/utils/dictionaryBridge.ts

/**
 * Constants for the dictionary dashboard
 */
const DICTIONARY_BASE_URL = 'https://dashboard.unravelcodes.com/dictionary';

/**
 * Opens the dictionary dashboard in a new tab with the specified asset context
 * 
 * @param type The type of asset ('card' or 'space')
 * @param id The unique identifier for the asset
 */
export function openInDictionary(type: 'card' | 'space', id: string): void {
  // Use the asset ID as the lookup key in the dictionary
  const url = `${DICTIONARY_BASE_URL}?id=${encodeURIComponent(id)}&view=game`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Parses preview parameters from the current URL
 * Supports ?action=preview_card&id=W001 or ?action=preview_space&id=SPACE_ID
 */
export function getPreviewParams(): { action: string | null; id: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    action: params.get('action'),
    id: params.get('id')
  };
}

/**
 * Clears the preview parameters from the URL without triggering a page reload.
 * This preserves other important params like game ID (g) or player ID (p).
 */
export function clearPreviewParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('action');
  url.searchParams.delete('id');
  
  // Update the URL in the address bar without reloading
  window.history.replaceState(null, '', url.toString());
}
