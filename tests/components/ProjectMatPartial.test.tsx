import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectMat } from '../../src/components/player/ProjectMat';
import { panelPalettes } from '../../src/components/player/panelTheme';

// fb:5617effb: a part-funded project shows an orange icon with the percent, not an empty circle.
// fb:4e8a8550 (Tom, "icons"): the steps are round icons; tapping one names it and says where it stands.
describe('ProjectMat part-done icon', () => {
  const tiles = [{ id: 'funded', label: 'Funded', done: false, percent: 62 }, { id: 'scope', label: 'Scope chosen', done: true }, { id: 'dob', label: 'DOB approved', done: false }];

  it('shows the percent and is marked part done', () => {
    render(<ProjectMat palette={panelPalettes.light} tiles={tiles} />);
    const tile = screen.getByTestId('mat-tile-funded');
    expect(tile.getAttribute('aria-label')).toBe('Funded 62%: part way');
    expect(tile.getAttribute('data-done')).toBe('false');
    expect(tile.getAttribute('data-percent')).toBe('62');
    expect(tile.textContent).toContain('62%');
    expect(screen.getByTestId('project-mat').getAttribute('data-done')).toBe('1');
  });

  it('tapping an icon names it and says where it stands; tapping again hides it', () => {
    render(<ProjectMat palette={panelPalettes.light} tiles={tiles} />);
    expect(screen.queryByTestId('mat-caption')).toBeNull();
    fireEvent.click(screen.getByTestId('mat-tile-dob'));
    expect(screen.getByTestId('mat-caption').textContent).toBe('DOB approved: not yet');
    fireEvent.click(screen.getByTestId('mat-tile-scope'));
    expect(screen.getByTestId('mat-caption').textContent).toBe('Scope chosen: done');
    fireEvent.click(screen.getByTestId('mat-tile-scope'));
    expect(screen.queryByTestId('mat-caption')).toBeNull();
  });

  it('wears the picture of its building when given one', () => {
    render(<ProjectMat palette={panelPalettes.light} tiles={tiles} renderIcon={id => <i data-testid={`pic-${id}`} />} />);
    expect(screen.getByTestId('pic-funded')).toBeTruthy();
    expect(screen.getByTestId('pic-dob')).toBeTruthy();
  });
});
