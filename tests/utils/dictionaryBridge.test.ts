import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openInDictionary, getPreviewParams, clearPreviewParams } from '../../src/utils/dictionaryBridge';

describe('dictionaryBridge', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      open: vi.fn(),
      location: {
        search: '',
        href: 'http://localhost/'
      },
      history: {
        replaceState: vi.fn()
      }
    });
  });

  describe('openInDictionary', () => {
    it('opens the correct URL for a card', () => {
      openInDictionary('card', 'W001');
      expect(window.open).toHaveBeenCalledWith(
        'https://dashboard.unravelcodes.com/dictionary?id=W001&view=game',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('opens the correct URL for a space', () => {
      openInDictionary('space', 'OWNER-FUND-INITIATION');
      expect(window.open).toHaveBeenCalledWith(
        'https://dashboard.unravelcodes.com/dictionary?id=OWNER-FUND-INITIATION&view=game',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  describe('getPreviewParams', () => {
    it('returns nulls when no params are present', () => {
      window.location.search = '';
      const params = getPreviewParams();
      expect(params.action).toBeNull();
      expect(params.id).toBeNull();
    });

    it('parses preview_card action correctly', () => {
      window.location.search = '?action=preview_card&id=W001';
      const params = getPreviewParams();
      expect(params.action).toBe('preview_card');
      expect(params.id).toBe('W001');
    });
  });

  describe('clearPreviewParams', () => {
    it('removes preview params but keeps others', () => {
      window.location.href = 'http://localhost/?g=G1&action=preview_card&id=W001';
      clearPreviewParams();
      
      const call = vi.mocked(window.history.replaceState).mock.calls[0];
      const newUrl = new URL(call[2] as string);
      
      expect(newUrl.searchParams.get('g')).toBe('G1');
      expect(newUrl.searchParams.has('action')).toBe(false);
      expect(newUrl.searchParams.has('id')).toBe(false);
    });
  });
});
