// tests/utils/authoredButtonLabel.test.ts
//
// The maintainer renamed the expeditor draw button in the editor, saw it
// change in the modal and NOT on the player panel, and reported it
// (2026-08-22). formatManualEffectButton generated the text in code
// ("Hire Expeditor") and never looked at what he typed -- his label was
// written into `description`, the one column the voice sweep had deliberately
// stopped button labels reading, because that column auto-fills with
// game-speak ("3 E cards").
//
// An authored label now arrives in its own column and wins.

import { describe, it, expect } from 'vitest';
import { formatManualEffectButton } from '../../src/utils/buttonFormatting';
import type { SpaceEffect } from '../../src/types/DataTypes';

const drawE = (over: Partial<SpaceEffect> = {}): SpaceEffect => ({
  space_name: 'CON-INITIATION',
  visit_type: 'First',
  effect_type: 'cards',
  effect_action: 'draw_E',
  effect_value: '3',
  condition: '',
  description: '3 E cards',
  trigger_type: 'manual',
  ...over,
});

describe('a button label the maintainer typed', () => {
  it('is used instead of the generated wording', () => {
    expect(formatManualEffectButton(drawE({ button_label: 'Meet the expediting team' })).text)
      .toBe('Meet the expediting team');
  });

  it('still picks the right icon from the card type', () => {
    expect(formatManualEffectButton(drawE({ button_label: 'Meet the expediting team' })).icon)
      .toBe(formatManualEffectButton(drawE()).icon);
  });

  it('falls back to the safe generated wording when nothing was authored', () => {
    expect(formatManualEffectButton(drawE()).text).toBe('Hire 3 Expeditors');
  });

  it('does NOT fall back to description, which auto-fills with game-speak', () => {
    // This is the whole reason the label needed its own column.
    expect(formatManualEffectButton(drawE({ description: '3 E cards' })).text).not.toBe('3 E cards');
  });

  it('ignores a blank or whitespace-only label', () => {
    expect(formatManualEffectButton(drawE({ button_label: '   ' })).text).toBe('Hire 3 Expeditors');
  });
});
