// tests/components/board/BoardToggle.test.tsx
//
// G160 (2026-07-26): "Edges on/off" was fully gated behind isAdminAuthenticated(),
// so even the maintainer playing a normal (non-admin) session had no way to
// declutter the board's connector lines. Corrected to also open it to a
// logged-in teacher (the person running a classroom instance) — explicitly
// NOT to regular players/students, who should see no board controls at all.

import React from 'react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BoardToggle } from '../../../src/components/board/BoardToggle';

function renderToggle(overrides: Partial<React.ComponentProps<typeof BoardToggle>> = {}) {
  const props: React.ComponentProps<typeof BoardToggle> = {
    editMode: false,
    onEditModeChange: () => {},
    edgesVisible: true,
    onEdgesVisibleChange: () => {},
    ...overrides,
  };
  return render(<BoardToggle {...props} />);
}

function clearAuth() {
  sessionStorage.removeItem('admin_authenticated');
  sessionStorage.removeItem('teacher_session');
  sessionStorage.removeItem('teacher_account');
}

describe('BoardToggle — G160 board-control access', () => {
  beforeEach(clearAuth);
  afterEach(() => {
    cleanup();
    clearAuth();
  });

  it('renders nothing at all for a regular player (no admin, no teacher session)', () => {
    const { container } = renderToggle();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Edges on/off but NOT Edit mode to a logged-in teacher', () => {
    sessionStorage.setItem('teacher_session', 'fake-token');
    renderToggle();

    expect(screen.getByRole('button', { name: /Edges (on|off)/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit (on|off)/ })).not.toBeInTheDocument();
  });

  it('shows both Edit mode and Edges toggle to an authenticated admin', () => {
    sessionStorage.setItem('admin_authenticated', 'true');
    renderToggle();

    expect(screen.getByRole('button', { name: /Edit (on|off)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edges (on|off)/ })).toBeInTheDocument();
  });

  it('lets a logged-in teacher click Edges to toggle visibility', () => {
    sessionStorage.setItem('teacher_session', 'fake-token');
    let visible = true;
    const { rerender } = renderToggle({
      edgesVisible: visible,
      onEdgesVisibleChange: (v) => { visible = v; },
    });

    fireEvent.click(screen.getByRole('button', { name: /Edges on/ }));
    expect(visible).toBe(false);

    rerender(
      <BoardToggle
        editMode={false}
        onEditModeChange={() => {}}
        edgesVisible={visible}
        onEdgesVisibleChange={(v) => { visible = v; }}
      />,
    );
    expect(screen.getByRole('button', { name: /Edges off/ })).toBeInTheDocument();
  });

  it('never shows the hidden-edge restore badge when nothing is hidden', () => {
    sessionStorage.setItem('admin_authenticated', 'true');
    renderToggle({ hiddenEdgeIds: [], onClearHiddenEdges: () => {}, onRestoreOneHiddenEdge: () => {} });
    expect(screen.queryByText(/hidden · restore/)).not.toBeInTheDocument();
  });

  it('shows the hidden-edge restore pill and opens a per-item picker (2026-08-04)', () => {
    sessionStorage.setItem('admin_authenticated', 'true');
    renderToggle({
      hiddenEdgeIds: ['OWNER-SCOPE-INITIATION__OWNER-FUND-INITIATION'],
      onClearHiddenEdges: () => {},
      onRestoreOneHiddenEdge: () => {},
    });
    const pill = screen.getByRole('button', { name: /1 hidden · restore/ });
    expect(pill).toBeInTheDocument();
    // Nothing shown until the pill is clicked.
    expect(screen.queryByText(/Scope Initiation/)).not.toBeInTheDocument();
    fireEvent.click(pill);
    expect(screen.getByText(/Scope Initiation → Fund Initiation/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore all 1/ })).toBeInTheDocument();
  });
});
