import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { StoryAccordion } from '../../../../src/components/player/sections/StoryAccordion';
import { SpaceEffect, VisitType } from '../../../../src/types/DataTypes';
import { IDataService } from '../../../../src/types/ServiceContracts';
import { DictionaryProvider } from '../../../../src/dictionary';

// Minimal in-memory IDataService stub. Only the methods StoryAccordion uses
// are implemented; anything else throws so tests can't silently depend on
// behavior we didn't mock.
function makeDataService(
  effects: SpaceEffect[],
  narratives: Record<string, string>,
): IDataService {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'getSpaceEffects') {
        return (_space: string, _visit: VisitType) => effects;
      }
      if (prop === 'getEffectNarrative') {
        return (_space: string, _visit: VisitType, action: string) =>
          narratives[action];
      }
      throw new Error(`Unexpected IDataService call: ${String(prop)}`);
    },
  };
  return new Proxy({}, handler) as IDataService;
}

function mkEffect(over: Partial<SpaceEffect>): SpaceEffect {
  return {
    space_name: 'TEST-SPACE',
    visit_type: 'First',
    effect_type: 'cards',
    effect_action: 'draw_e',
    effect_value: '1',
    condition: '',
    description: '',
    trigger_type: 'manual',
    ...over,
  };
}

const renderAccordion = (ui: React.ReactElement) =>
  render(<DictionaryProvider>{ui}</DictionaryProvider>);

describe('StoryAccordion', () => {
  beforeEach(() => cleanup());

  it('renders null when no effects have narratives', () => {
    const ds = makeDataService(
      [mkEffect({ effect_action: 'draw_e' })],
      {}, // no narrative authored
    );
    const { container } = renderAccordion(
      <StoryAccordion
        dataService={ds}
        spaceName="TEST-SPACE"
        visitType="First"
        completedActions={{ manualActions: {} }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one row per authored narrative, ordered E→W→B→I→dice→money→time→L', () => {
    const effects = [
      mkEffect({ effect_type: 'time', effect_action: 'add' }),
      mkEffect({ effect_type: 'cards', effect_action: 'draw_l', trigger_type: 'auto' }),
      mkEffect({ effect_type: 'cards', effect_action: 'draw_e' }),
      mkEffect({ effect_type: 'dice', effect_action: 'dice_outcome' }),
      mkEffect({ effect_type: 'cards', effect_action: 'draw_w' }),
    ];
    const narratives = {
      add: 'Time passes.',
      draw_l: 'Life happens.',
      draw_e: 'Hire someone.',
      dice_outcome: 'Roll it.',
      draw_w: 'Do work.',
    };
    const ds = makeDataService(effects, narratives);
    const { container } = renderAccordion(
      <StoryAccordion
        dataService={ds}
        spaceName="TEST-SPACE"
        visitType="First"
        completedActions={{ manualActions: {} }}
      />,
    );
    const rows = Array.from(
      container.querySelectorAll('[data-testid^="story-accordion-row-"]'),
    );
    const ids = rows.map((r) => r.getAttribute('data-testid'));
    expect(ids).toEqual([
      'story-accordion-row-cards:draw_e',
      'story-accordion-row-cards:draw_w',
      'story-accordion-row-dice:dice_outcome',
      'story-accordion-row-time:add',
      'story-accordion-row-cards:draw_l',
    ]);
  });

  it('auto-expands the first uncompleted row and collapses completed rows with a ✓', () => {
    const effects = [
      mkEffect({ effect_type: 'cards', effect_action: 'draw_e' }),
      mkEffect({ effect_type: 'cards', effect_action: 'draw_w' }),
    ];
    const narratives = { draw_e: 'E narrative.', draw_w: 'W narrative.' };
    const ds = makeDataService(effects, narratives);
    const { container, getByText } = renderAccordion(
      <StoryAccordion
        dataService={ds}
        spaceName="TEST-SPACE"
        visitType="First"
        completedActions={{ manualActions: { 'cards:draw_e': 'done' } }}
      />,
    );
    const eRow = container.querySelector(
      '[data-testid="story-accordion-row-cards:draw_e"]',
    )!;
    const wRow = container.querySelector(
      '[data-testid="story-accordion-row-cards:draw_w"]',
    )!;
    expect(eRow.getAttribute('data-completed')).toBe('true');
    expect(wRow.getAttribute('data-completed')).toBe('false');
    // ✓ present on completed row
    expect(eRow.querySelector('[aria-label="Completed"]')).not.toBeNull();
    // W (first uncompleted) should be expanded → narrative visible
    expect(getByText('W narrative.')).toBeInTheDocument();
    // E is collapsed → narrative not in DOM
    expect(container.textContent).not.toContain('E narrative.');
  });

  it('renders auto-triggered L rows with "Life event happened" collapsed label', () => {
    const effects = [
      mkEffect({ effect_type: 'cards', effect_action: 'draw_l', trigger_type: 'auto' }),
      mkEffect({ effect_type: 'cards', effect_action: 'draw_e' }),
    ];
    const narratives = { draw_l: 'Life narrative.', draw_e: 'E narrative.' };
    const ds = makeDataService(effects, narratives);
    const { getByText, container } = renderAccordion(
      <StoryAccordion
        dataService={ds}
        spaceName="TEST-SPACE"
        visitType="First"
        completedActions={{ manualActions: {} }}
      />,
    );
    // L row should use the special collapsed label
    expect(getByText('Life event happened — click to read')).toBeInTheDocument();
    // L row treated as completed (trigger_type=auto) and collapsed by default
    const lRow = container.querySelector(
      '[data-testid="story-accordion-row-cards:draw_l"]',
    )!;
    expect(lRow.getAttribute('data-completed')).toBe('true');
  });

  it('toggles a row open/closed when clicked', () => {
    const effects = [
      mkEffect({ effect_type: 'cards', effect_action: 'draw_e' }),
      mkEffect({ effect_type: 'cards', effect_action: 'draw_w' }),
    ];
    const narratives = { draw_e: 'E narrative.', draw_w: 'W narrative.' };
    const ds = makeDataService(effects, narratives);
    const { container, getByText, queryByText } = renderAccordion(
      <StoryAccordion
        dataService={ds}
        spaceName="TEST-SPACE"
        visitType="First"
        completedActions={{ manualActions: {} }}
      />,
    );
    // E (first uncompleted) is expanded by default
    expect(getByText('E narrative.')).toBeInTheDocument();
    expect(queryByText('W narrative.')).toBeNull();
    // Click W header to expand it
    const wRow = container.querySelector(
      '[data-testid="story-accordion-row-cards:draw_w"]',
    )!;
    fireEvent.click(wRow.querySelector('button')!);
    expect(getByText('W narrative.')).toBeInTheDocument();
    // Click E header to collapse it
    const eRow = container.querySelector(
      '[data-testid="story-accordion-row-cards:draw_e"]',
    )!;
    fireEvent.click(eRow.querySelector('button')!);
    expect(queryByText('E narrative.')).toBeNull();
  });

  it('treats dice completion as done when completedActions.diceRoll is set', () => {
    const effects = [
      mkEffect({ effect_type: 'dice', effect_action: 'dice_outcome' }),
      mkEffect({ effect_type: 'cards', effect_action: 'draw_e' }),
    ];
    const narratives = { dice_outcome: 'Rolled.', draw_e: 'Hire.' };
    const ds = makeDataService(effects, narratives);
    const { container } = renderAccordion(
      <StoryAccordion
        dataService={ds}
        spaceName="TEST-SPACE"
        visitType="First"
        completedActions={{ diceRoll: '4', manualActions: {} }}
      />,
    );
    const diceRow = container.querySelector(
      '[data-testid="story-accordion-row-dice:dice_outcome"]',
    )!;
    expect(diceRow.getAttribute('data-completed')).toBe('true');
  });
});
