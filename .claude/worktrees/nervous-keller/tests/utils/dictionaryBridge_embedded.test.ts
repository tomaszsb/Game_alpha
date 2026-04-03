/* @vitest-pool forks */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openInDictionary, registerPanelOpenCallback, unregisterPanelOpenCallback } from '../../src/utils/dictionaryBridge';

describe('dictionaryBridge Embedded Mode', () => {
  const mockWindowOpen = vi.fn();
  const mockPanelCallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      open: mockWindowOpen,
      location: { search: '' },
      history: { replaceState: vi.fn() }
    });
    unregisterPanelOpenCallback();
  });

  it('should call registered panel callback instead of opening new tab', () => {
    registerPanelOpenCallback(mockPanelCallback);
    openInDictionary('card', 'W001');
    
    expect(mockPanelCallback).toHaveBeenCalledWith('W001');
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('should open new tab with game view if no callback registered', () => {
    openInDictionary('card', 'W001');
    
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('view=game'),
      '_blank',
      expect.any(String)
    );
  });

  it('should include term ID in the URL when opening new tab', () => {
    openInDictionary('space', 'OWNER-FUND');
    
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('id=OWNER-FUND'),
      '_blank',
      expect.any(String)
    );
  });
});
