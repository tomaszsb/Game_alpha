// tests/vitest.d.ts
// Type definitions for Vitest globals

import type { vi } from 'vitest';

declare global {
  // Make vi available globally in test files
  const vi: typeof import('vitest').vi;

  // Other Vitest globals that might be needed
  const expect: typeof import('vitest').expect;
  const describe: typeof import('vitest').describe;
  const it: typeof import('vitest').it;
  const test: typeof import('vitest').test;
  const beforeEach: typeof import('vitest').beforeEach;
  const afterEach: typeof import('vitest').afterEach;
  const beforeAll: typeof import('vitest').beforeAll;
  const afterAll: typeof import('vitest').afterAll;
}

export {};