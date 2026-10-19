import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClassLandingPage } from '../../src/pages/ClassLandingPage';
import { getStoredCampaignSource } from '../../src/playtest/playtestStorage';

describe('ClassLandingPage', () => {
  it('explains finishing is enough and links to the normal game start', () => {
    render(<ClassLandingPage />);
    expect(screen.getByText(/You do not have to win/)).toBeTruthy();
    const start = screen.getByTestId('class-start') as HTMLAnchorElement;
    expect(start.getAttribute('href')).toBe('/');
  });

  it('names SUNY Farmingdale and the three requirements', () => {
    render(<ClassLandingPage />);
    expect(screen.getByText(/SUNY Farmingdale/)).toBeTruthy();
    expect(screen.getByText(/Finish one entire game, win or lose/)).toBeTruthy();
    expect(screen.getByText(/at least one comment/)).toBeTruthy();
    expect(screen.getByTestId('class-bug-sample')).toBeTruthy();
    expect(screen.getByText('350')).toBeTruthy();
  });

  describe('campaign tag', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      try { sessionStorage.clear(); } catch { /* ignore */ }
      window.history.pushState({}, '', '/class?src=kosi');
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      window.history.pushState({}, '', '/');
    });

    it('stores ?src and posts one landing_view carrying it', () => {
      render(<ClassLandingPage />);
      expect(getStoredCampaignSource()).toBe('kosi');
      const calls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/playtest/track'));
      expect(calls).toHaveLength(1);
      const body = JSON.parse(calls[0][1].body as string);
      expect(body).toMatchObject({ event: 'landing_view', campaignSource: 'kosi' });
    });

    it('keeps Start a same-tab link so the stored tag carries over', () => {
      render(<ClassLandingPage />);
      const start = screen.getByTestId('class-start') as HTMLAnchorElement;
      expect(start.getAttribute('target')).toBeNull();
    });
  });
});
