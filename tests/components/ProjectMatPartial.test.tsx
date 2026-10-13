import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectMat } from '../../src/components/player/ProjectMat';
import { panelPalettes } from '../../src/components/player/panelTheme';

// fb:5617effb: a part-funded project shows an orange tile with the percent, not an empty circle.
describe('ProjectMat part-done tile', () => {
  it('shows the percent and is marked part done', () => {
    render(<ProjectMat palette={panelPalettes.light} tiles={[{ id: 'funded', label: 'Funded', done: false, percent: 62 }, { id: 'scope', label: 'Scope chosen', done: true }]} />);
    const tile = screen.getByTestId('mat-tile-funded');
    expect(tile.textContent).toContain('Funded 62%');
    expect(tile.getAttribute('data-done')).toBe('false');
    expect(tile.getAttribute('data-percent')).toBe('62');
    expect(screen.getByTestId('project-mat').getAttribute('data-done')).toBe('1');
  });
});
