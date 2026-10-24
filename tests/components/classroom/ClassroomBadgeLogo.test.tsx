/* @vitest-pool forks */
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ClassroomBadge } from '../../../src/components/classroom/ClassroomBadge';

const stub = (body: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }));

describe('ClassroomBadge logo', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('shows the school logo (named for the school) instead of the little school icon', async () => {
    window.history.pushState({}, '', '/?i=room-1');
    stub({ meta: { displayName: 'Room 4B', schoolName: 'Farmingdale State' }, logoVersion: 8 });
    render(<ClassroomBadge />);
    const img = await screen.findByTestId('classroom-badge-logo') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('/api/instances/room-1/logo?v=8');
    expect(img.getAttribute('alt')).toBe('Farmingdale State');
    expect(screen.getByText(/Room 4B/)).toBeInTheDocument();
  });

  it('is unchanged when the classroom has no logo', async () => {
    window.history.pushState({}, '', '/?i=room-1');
    stub({ meta: { displayName: 'Room 4B' }, logoVersion: null });
    render(<ClassroomBadge />);
    await waitFor(() => expect(screen.getByText(/Room 4B/)).toBeInTheDocument());
    expect(screen.queryByTestId('classroom-badge-logo')).toBeNull();
  });

  it('renders nothing on the public board', () => {
    window.history.pushState({}, '', '/');
    const { container } = render(<ClassroomBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
