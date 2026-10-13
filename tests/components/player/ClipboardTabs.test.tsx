/* @vitest-pool forks */
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ClipboardTabs, PageTabsRow, PAGE_TABS } from '../../../src/components/player/ClipboardTabs';
import { panelPalettes } from '../../../src/components/player/panelTheme';

// fb:4e8a8550 (Tom, 10-13: "I like yours" - the page tabs on the clipboard's edge).
describe('clipboard page tabs', () => {
  afterEach(() => cleanup());

  it('five tabs in order: Money, Time, Expeditors, Scope, Life events', () => {
    expect(PAGE_TABS.map(t => t.id)).toEqual(['money', 'time', 'expeditors', 'scope', 'life']);
    render(<ClipboardTabs active={null} onSelect={() => {}} palette={panelPalettes.light} />);
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Money', 'Time', 'Expeditors', 'Scope', 'Life events']);
  });

  it("the open page's tab is marked, and tapping a tab asks for that page", () => {
    const onSelect = vi.fn();
    render(<ClipboardTabs active="scope" onSelect={onSelect} palette={panelPalettes.light} />);
    expect(screen.getByTestId('clipboard-tab-scope')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('clipboard-tab-money')).toHaveAttribute('data-active', 'false');
    fireEvent.click(screen.getByTestId('clipboard-tab-life'));
    expect(onSelect).toHaveBeenCalledWith('life');
  });

  it('the same tabs sit as a row on an open page so the player can flip on', () => {
    const onSelect = vi.fn();
    render(<PageTabsRow active="time" onSelect={onSelect} palette={panelPalettes.light} />);
    expect(screen.getByTestId('page-tab-time')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByTestId('page-tab-money'));
    expect(onSelect).toHaveBeenCalledWith('money');
  });

  it('the strip is placed absolutely, so it takes no layout space', () => {
    render(<ClipboardTabs active={null} onSelect={() => {}} palette={panelPalettes.light} />);
    expect(screen.getByTestId('clipboard-tabs').style.position).toBe('absolute');
  });
});
