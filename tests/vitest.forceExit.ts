// tests/vitest.forceExit.ts
// Custom vitest reporter that force-exits after all tests complete.
// Workaround for vitest hanging due to open handles in test workers.
//
// vitest 5 (2026-09-30): the `Reporter` type moved from 'vitest/reporters' to
// 'vitest/node', and the old onFinished(files, errors) hook is gone — onTestRunEnd is the
// one it calls now. Left on onFinished this would import fine, never fire, and `npm test`
// would hang on the open handles this file exists to get past.

import type { Reporter, TestModule } from 'vitest/node';

export default class ForceExitReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<unknown>) {
    // Force exit shortly after vitest reports completion
    setTimeout(() => {
      const hasErrors = unhandledErrors.length > 0;
      const hasFailed = testModules.some((m) => m.state() === 'failed');
      process.exit(hasErrors || hasFailed ? 1 : 0);
    }, 1000);
  }
}
