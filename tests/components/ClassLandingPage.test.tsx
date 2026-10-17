import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClassLandingPage } from '../../src/pages/ClassLandingPage';

describe('ClassLandingPage', () => {
  it('explains finishing is enough and links to the normal game start', () => {
    render(<ClassLandingPage />);
    expect(screen.getByText(/You do not have to win/)).toBeTruthy();
    const start = screen.getByTestId('class-start') as HTMLAnchorElement;
    expect(start.getAttribute('href')).toBe('/');
  });
});
