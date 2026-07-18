import React from 'react';
import { screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '../../utils/test-utils';
import { NarrativeBlock } from '../../../src/components/modals/shared/NarrativeBlock';

describe('NarrativeBlock', () => {
  afterEach(() => {
    cleanup();
  });

  // fb:feedback-1783924131895-ffec84f4 — hardcoded to the light-only `colors`
  // tokens, so it would show as a stray light box the next time a dice/action
  // result with a genuine draw narrative fires in dark mode (same bug as
  // CharacterBadge). Confirms the default (no `mode` prop, e.g. ChoiceModal/
  // ChoiceModal call site) still renders the light surface, and `mode="dark"`
  // (DiceResultModal in dark mode) switches to the dark panel surface instead.
  it('should default to the light-mode surface when no mode prop is passed', () => {
    render(<NarrativeBlock text="A narrative passage." spaceName="OWNER-FUND-INITIATION" />);
    const block = screen.getByText('A narrative passage.').closest('div');
    expect(block).not.toBeNull();
    expect((block as HTMLElement).style.backgroundColor).toBe('rgb(241, 244, 248)'); // panelPalettes.light.surf
  });

  it('should use the dark panel surface when mode="dark" is passed', () => {
    render(<NarrativeBlock text="A narrative passage." spaceName="OWNER-FUND-INITIATION" mode="dark" />);
    const block = screen.getByText('A narrative passage.').closest('div');
    expect(block).not.toBeNull();
    expect((block as HTMLElement).style.backgroundColor).toBe('rgb(30, 41, 59)'); // panelPalettes.dark.surf
  });
});
