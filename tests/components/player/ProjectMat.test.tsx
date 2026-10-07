/* @vitest-pool forks */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { ProjectMat } from '../../../src/components/player/ProjectMat';
import { panelPalettes } from '../../../src/components/player/panelTheme';

describe('ProjectMat', () => {
  afterEach(() => cleanup());

  it('shows each milestone, checked or not, and how many are done', () => {
    render(<ProjectMat palette={panelPalettes.light} tiles={[
      { id: 'scope', label: 'Scope chosen', done: true },
      { id: 'dob', label: 'DOB approved', done: false },
    ]} />);
    expect(screen.getByTestId('project-mat')).toHaveAttribute('data-done', '1');
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByTestId('mat-tile-scope')).toHaveAttribute('data-done', 'true');
    expect(screen.getByTestId('mat-tile-dob')).toHaveAttribute('data-done', 'false');
  });

  it('draws nothing when the data names no tiles', () => {
    const { container } = render(<ProjectMat palette={panelPalettes.light} tiles={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
