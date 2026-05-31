import { describe, it, expect } from 'vitest';
import { friendlySpaceName, friendlyCardName, friendlyCardList } from '../../src/utils/logFormatting';
import { IDataService } from '../../src/types/ServiceContracts';

function makeDataService(overrides: Partial<IDataService> = {}): IDataService {
  return {
    getDisplayLabelOverride: () => '',
    getCardById: () => undefined,
    ...overrides,
  } as IDataService;
}

describe('logFormatting', () => {
  describe('friendlySpaceName', () => {
    it('returns the display_label_override when present', () => {
      const ds = makeDataService({
        getDisplayLabelOverride: (s: string) => s === 'OWNER-SCOPE-INITIATION' ? 'Scope Initiation' : '',
      });
      expect(friendlySpaceName(ds, 'OWNER-SCOPE-INITIATION')).toBe('Scope Initiation');
    });

    it('falls back to shortName when no override exists', () => {
      const ds = makeDataService();
      expect(friendlySpaceName(ds, 'CON-INSPECT')).toBe('Inspect');
    });

    it('returns empty string for empty input', () => {
      const ds = makeDataService();
      expect(friendlySpaceName(ds, '')).toBe('');
    });
  });

  describe('friendlyCardName', () => {
    it('returns the card_name from getCardById', () => {
      const ds = makeDataService({
        getCardById: (id: string) => id === 'W006' ? ({ card_id: 'W006', card_name: 'Adaptive reuse warehouse' } as any) : undefined,
      });
      expect(friendlyCardName(ds, 'W006')).toBe('Adaptive reuse warehouse');
    });

    it('truncates long card names with ellipsis', () => {
      const ds = makeDataService({
        getCardById: () => ({ card_id: 'X', card_name: 'A very long card name that exceeds the truncation limit easily' } as any),
      });
      expect(friendlyCardName(ds, 'X', 20)).toBe('A very long card nam…');
    });

    it('falls back to the raw cardId when card is not found', () => {
      const ds = makeDataService();
      expect(friendlyCardName(ds, 'W999')).toBe('W999');
    });

    it('returns the raw cardId when dataService is undefined', () => {
      expect(friendlyCardName(undefined, 'W006')).toBe('W006');
    });
  });

  describe('friendlyCardList', () => {
    it('joins multiple friendly card names with commas', () => {
      const ds = makeDataService({
        getCardById: (id: string) => ({
          W006: { card_id: 'W006', card_name: 'Adaptive reuse warehouse' } as any,
          W009: { card_id: 'W009', card_name: 'Strip mall senior living' } as any,
        }[id]),
      });
      expect(friendlyCardList(ds, ['W006', 'W009'])).toBe('Adaptive reuse warehouse, Strip mall senior living');
    });

    it('returns raw IDs joined when dataService is undefined', () => {
      expect(friendlyCardList(undefined, ['W006', 'W009'])).toBe('W006, W009');
    });
  });
});
