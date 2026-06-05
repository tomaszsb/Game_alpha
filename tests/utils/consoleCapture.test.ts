// Verifies the bug-reporter console-capture buffer actually records entries.
// Prompted by a playtester whose reports arrived with no console logs despite
// (believing they) checked "Include browser console log". Conclusion: the
// capture mechanism is sound — the logs were absent because the opt-in checkbox
// (default OFF, resets after each submit) wasn't effectively enabled.
//
// NOTE: install + log + assert must live in ONE test — vitest restores the
// global console between tests, which would strip the wrapper installed here.
import { describe, it, expect } from 'vitest';
import { installConsoleCapture, getConsoleLogs } from '../../src/utils/consoleCapture';

describe('consoleCapture', () => {
  it('captures console.error / console.warn and the "Invalid move" turn-error shape', () => {
    installConsoleCapture();
    const before = getConsoleLogs().length;

    console.error('test-capture-error', { detail: 'x' });
    console.warn('test-capture-warn');
    // Mirrors TurnService.endTurnWithMovement catch (console.error before rethrow)
    console.error('🏁 TurnService.endTurnWithMovement - Error:', {
      step: 'execute_movement',
      message: 'Invalid move: REG-DOB-PLAN-EXAM is not a valid destination from REG-DOB-FINAL-REVIEW.',
    });

    const after = getConsoleLogs();
    expect(after.length).toBe(before + 3);

    const dump = after.map(e => `${e.level}:${e.message}`).join('\n');
    expect(dump).toContain('error:test-capture-error');
    expect(dump).toContain('warn:test-capture-warn');
    // A caught-and-logged turn error IS captured — so a checked console box
    // would have included the Final Review crash.
    expect(dump).toContain('Invalid move: REG-DOB-PLAN-EXAM');
  });
});
