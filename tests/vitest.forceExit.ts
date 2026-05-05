// tests/vitest.forceExit.ts
// Custom vitest reporter that force-exits after all tests complete.
// Workaround for vitest hanging due to open handles in test workers.

import type { Reporter } from 'vitest/reporters';
type File = any;

export default class ForceExitReporter implements Reporter {
  private totalFiles = 0;
  private finishedFiles = 0;
  private exitTimer: ReturnType<typeof setTimeout> | null = null;

  onInit(ctx: any) {
    // Get total test files count from context
    this.totalFiles = 0;
    this.finishedFiles = 0;
  }

  onCollected(files?: File[]) {
    if (files) {
      this.totalFiles = files.length;
    }
  }

  onFinished(files?: File[], errors?: unknown[]) {
    // Force exit shortly after vitest reports completion
    this.exitTimer = setTimeout(() => {
      const hasErrors = errors && errors.length > 0;
      const hasFailed = files?.some(f => f.result?.state === 'fail');
      process.exit(hasErrors || hasFailed ? 1 : 0);
    }, 1000);
  }
}
