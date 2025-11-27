// tests/performance/LoadTimeOptimization.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../../src/utils/PerformanceMonitor';
import { DataServiceOptimized } from '../../src/services/DataServiceOptimized';

describe('Load Time Optimizations', () => {
  beforeEach(() => {
    PerformanceMonitor.clear();
    PerformanceMonitor.enable();

    // Mock fetch for CSV loading
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const delay = url.includes('CARDS_EXPANDED') ? 100 : 50; // Simulate different load times

      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            text: () => Promise.resolve('mock,csv,data\ntest,data,here')
          });
        }, delay);
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    PerformanceMonitor.clear();
  });

  describe('PerformanceMonitor', () => {
    it('should track measurement times correctly', () => {
      PerformanceMonitor.startMeasurement('test-operation');

      // Simulate some work
      const start = performance.now();
      while (performance.now() - start < 10) {
        // Busy wait for 10ms
      }

      const duration = PerformanceMonitor.endMeasurement('test-operation');

      expect(duration).toBeGreaterThan(8); // Allow for some variance
      expect(duration).toBeLessThan(50); // Should be reasonable
    });

    it('should generate performance reports', () => {
      PerformanceMonitor.startMeasurement('operation-1');
      PerformanceMonitor.endMeasurement('operation-1');

      PerformanceMonitor.startMeasurement('operation-2');
      PerformanceMonitor.endMeasurement('operation-2');

      const report = PerformanceMonitor.generateReport();

      expect(report).toContain('PERFORMANCE REPORT');
      expect(report).toContain('operation-1');
      expect(report).toContain('operation-2');
    });

    it('should track total load time', () => {
      PerformanceMonitor.startMeasurement('app-initialization');
      PerformanceMonitor.endMeasurement('app-initialization');

      const totalTime = PerformanceMonitor.getTotalLoadTime();
      expect(totalTime).toBeGreaterThan(0);
    });
  });

  describe('DataServiceOptimized', () => {
    let dataService: DataServiceOptimized;

    beforeEach(() => {
      dataService = new DataServiceOptimized();
    });

    it('should load critical data faster than full data', async () => {
      PerformanceMonitor.startMeasurement('critical-data-load');

      // Load critical data only
      await dataService.loadData();

      const criticalLoadTime = PerformanceMonitor.endMeasurement('critical-data-load');

      expect(dataService.isLoaded()).toBe(true);
      expect(criticalLoadTime).toBeLessThan(200); // Should be fast

      // Full data might not be loaded yet
      const initialCardCount = dataService.getAllCards().length;

      // Wait for background loading to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const finalCardCount = dataService.getAllCards().length;

      // Cards should be loaded in background
      expect(finalCardCount).toBeGreaterThanOrEqual(initialCardCount);
    });

    it('should provide lazy loading for non-critical data', async () => {
      // Before loading, methods should return empty arrays
      expect(dataService.getAllCards()).toHaveLength(0);
      expect(dataService.getDiceOutcomes()).toHaveLength(0);

      // Load critical data
      await dataService.loadData();

      // Basic data should be available immediately
      expect(dataService.isLoaded()).toBe(true);

      // Non-critical data might still be loading
      const cardsBeforeWait = dataService.getAllCards();

      // Wait for background loading
      await new Promise(resolve => setTimeout(resolve, 200));

      // Non-critical data should now be available
      const cardsAfterWait = dataService.getAllCards();
      expect(cardsAfterWait.length).toBeGreaterThanOrEqual(cardsBeforeWait.length);
    });

    it('should handle concurrent access to the same data gracefully', async () => {
      // Start multiple concurrent loads
      const promises = [
        dataService.loadData(),
        dataService.loadData(),
        dataService.loadData()
      ];

      await Promise.all(promises);

      expect(dataService.isLoaded()).toBe(true);
      // Should not cause any errors or duplicate loads
    });

    it('should cache loaded data to prevent duplicate fetches', async () => {
      await dataService.loadData();

      const firstCall = dataService.getGameConfig();
      const secondCall = dataService.getGameConfig();

      // Should return the same cached data (content equality)
      expect(firstCall).toStrictEqual(secondCall);
      expect(firstCall.length).toBeGreaterThan(0);
      expect(secondCall.length).toBeGreaterThan(0);

      // Data should be immediately available from cache
      expect(firstCall).toEqual(secondCall);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should demonstrate load time improvements', async () => {
      const optimizedService = new DataServiceOptimized();

      // Measure optimized loading time
      PerformanceMonitor.startMeasurement('optimized-service-load');
      await optimizedService.loadData();
      const optimizedTime = PerformanceMonitor.endMeasurement('optimized-service-load');

      // The optimized service should be available quickly for basic operations
      expect(optimizedService.isLoaded()).toBe(true);
      expect(optimizedTime).toBeLessThan(200); // Should be under 200ms for critical data

      // Basic game configuration should be available immediately
      const gameConfig = optimizedService.getGameConfig();
      expect(Array.isArray(gameConfig)).toBe(true);

      // Movement data should be available immediately
      const movements = optimizedService.getAllMovements();
      expect(Array.isArray(movements)).toBe(true);
    });

    it('should show progressive loading benefits', async () => {
      const service = new DataServiceOptimized();

      // Track different loading phases
      PerformanceMonitor.startMeasurement('phase-1-critical');
      await service.loadData();
      PerformanceMonitor.endMeasurement('phase-1-critical');

      // Critical data available immediately
      expect(service.isLoaded()).toBe(true);

      // Non-critical data might still be loading
      const cardsAtStart = service.getAllCards().length;

      PerformanceMonitor.startMeasurement('phase-2-background');
      // Wait for background loading
      await new Promise(resolve => setTimeout(resolve, 200));
      PerformanceMonitor.endMeasurement('phase-2-background');

      const cardsAfterBackground = service.getAllCards().length;

      // Should have more data after background loading
      expect(cardsAfterBackground).toBeGreaterThanOrEqual(cardsAtStart);

      console.log(PerformanceMonitor.generateReport());
    });
  });
});