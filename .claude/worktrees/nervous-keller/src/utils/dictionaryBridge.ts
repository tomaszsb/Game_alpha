// src/utils/dictionaryBridge.ts

/**
 * Constants for the dictionary dashboard
 */
const DICTIONARY_BASE_URL = 'https://dashboard.unravelcodes.com/dictionary';

/**
 * Callback for opening terms in the dictionary panel
 * Set by DictionaryContext to allow opening terms within the game
 */
let openInPanelCallback: ((termId: string) => void) | null = null;

/**
 * Register a callback for opening terms in the dictionary panel
 * Called by DictionaryContext on mount
 */
export function registerPanelOpenCallback(callback: (termId: string) => void): void {
  openInPanelCallback = callback;
}

/**
 * Unregister the panel open callback
 * Called by DictionaryContext on unmount
 */
export function unregisterPanelOpenCallback(): void {
  openInPanelCallback = null;
}

/**
 * Opens the dictionary with the specified asset context.
 * If a panel callback is registered, opens within the game panel.
 * Otherwise, opens the dashboard in a new tab.
 *
 * @param type The type of asset ('card' or 'space')
 * @param id The unique identifier for the asset
 * @param preferPanel If true, prefer panel over new tab (default: true)
 */
export function openInDictionary(type: 'card' | 'space', id: string, preferPanel: boolean = true): void {
  // If panel callback is registered and preferred, use it
  if (preferPanel && openInPanelCallback) {
    openInPanelCallback(id);
    return;
  }

  // Fallback: open in new tab
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
