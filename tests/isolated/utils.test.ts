// tests/isolated/utils.test.ts
// Ultra-fast isolated tests for utility functions without service dependencies

describe('Isolated Utility Tests', () => {
  describe('Math utilities', () => {
    it('should calculate percentages correctly', () => {
      const calculatePercentage = (value: number, total: number): number => {
        return (value / total) * 100;
      };

      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(1, 4)).toBe(25);
      expect(calculatePercentage(0, 100)).toBe(0);
    });

    it('should clamp values within range', () => {
      const clamp = (value: number, min: number, max: number): number => {
        return Math.min(Math.max(value, min), max);
      };

      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('String utilities', () => {
    it('should format currency correctly', () => {
      const formatCurrency = (amount: number): string => {
        return `$${amount.toLocaleString()}`;
      };

      expect(formatCurrency(1000)).toBe('$1,000');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(1234567)).toBe('$1,234,567');
    });

    it('should extract card type from ID', () => {
      const getCardType = (cardId: string): string => {
        return cardId.charAt(0);
      };

      expect(getCardType('E001')).toBe('E');
      expect(getCardType('W_active_001')).toBe('W');
      expect(getCardType('B123')).toBe('B');
    });
  });

  describe('Array utilities', () => {
    it('should shuffle arrays consistently', () => {
      const shuffle = <T>(array: T[]): T[] => {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
      };

      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle(original);
      
      expect(shuffled).toHaveLength(5);
      expect(shuffled).toEqual(expect.arrayContaining(original));
    });

    it('should group items by key', () => {
      const groupBy = <T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> => {
        return array.reduce((groups, item) => {
          const key = keyFn(item);
          groups[key] = groups[key] || [];
          groups[key].push(item);
          return groups;
        }, {} as Record<string, T[]>);
      };

      const items = [
        { type: 'E', name: 'Card1' },
        { type: 'W', name: 'Card2' },
        { type: 'E', name: 'Card3' }
      ];

      const grouped = groupBy(items, item => item.type);
      
      expect(grouped.E).toHaveLength(2);
      expect(grouped.W).toHaveLength(1);
    });
  });

  describe('Validation utilities', () => {
    it('should validate email format', () => {
      const isValidEmail = (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      };

      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid.email')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should validate card ID format', () => {
      const isValidCardId = (cardId: string): boolean => {
        return /^[WBELI]\d{3}$/.test(cardId) || /^[WBELI]_\w+_\d{3}$/.test(cardId);
      };

      expect(isValidCardId('E001')).toBe(true);
      expect(isValidCardId('W_active_001')).toBe(true);
      expect(isValidCardId('invalid')).toBe(false);
    });
  });

  describe('Performance validation', () => {
    it('should complete operations within time budget', () => {
      const start = performance.now();
      
      // Perform various operations
      for (let i = 0; i < 1000; i++) {
        const result = i * 2 + Math.random();
        Math.sqrt(result);
      }
      
      const duration = performance.now() - start;
      
      // Should complete very quickly (under 5ms)
      expect(duration).toBeLessThan(5);
    });

    it('should handle large data sets efficiently', () => {
      const start = performance.now();
      
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      const filtered = largeArray.filter(x => x % 2 === 0);
      const mapped = filtered.map(x => x * 2);
      
      const duration = performance.now() - start;
      
      expect(mapped.length).toBe(5000);
      expect(duration).toBeLessThan(10); // Should complete under 10ms
    });
  });
});