import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ClassLandingPage } from '../../src/pages/ClassLandingPage';

const stub = (body: unknown) => vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) =>
  String(url).includes('/api/instances/') ? { ok: true, json: async () => body } : { ok: true }));

describe('ClassLandingPage school branding (?i=<classroom>)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('shows the school name and logo for the classroom in the link', async () => {
    window.history.pushState({}, '', '/class?i=room-1');
    stub({ meta: { schoolName: 'Farmingdale State' }, logoVersion: 7 });
    render(<ClassLandingPage />);
    expect(await screen.findByText('Farmingdale State')).toBeTruthy();
    const img = screen.getByTestId('class-school-logo') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('/api/instances/room-1/logo?v=7');
    expect(img.getAttribute('alt')).toBe('Farmingdale State logo');
  });

  it('shows nothing extra without ?i=, and ignores a hostile one', () => {
    stub({ meta: { schoolName: 'Nope' }, logoVersion: 1 });
    window.history.pushState({}, '', '/class');
    const { unmount } = render(<ClassLandingPage />);
    expect(screen.queryByTestId('class-school')).toBeNull();
    unmount();
    window.history.pushState({}, '', '/class?i=../../etc');
    render(<ClassLandingPage />);
    expect(screen.queryByTestId('class-school')).toBeNull();
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(c => String(c[0]).includes('/api/instances/'));
    expect(calls).toHaveLength(0);
  });
});
