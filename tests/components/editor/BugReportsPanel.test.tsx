// tests/components/editor/BugReportsPanel.test.tsx
// Pins that the admin bug-reports panel authenticates its feedback API
// calls (DEF-6: the server now rejects unauthenticated reads/updates).
// The panel renders behind the admin unlock, so the session password is
// available via getAdminPassword().

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BugReportsPanel } from '../../../src/components/editor/BugReportsPanel';

vi.mock('../../../src/utils/networkDetection', () => ({
  getBackendURL: () => 'http://test-backend',
}));

vi.mock('../../../src/utils/adminAuth', () => ({
  getAdminPassword: () => 'sesame',
}));

const REPORT = {
  id: 'feedback-1700000000000-abcd1234.json',
  createdAt: '2026-06-12T10:00:00.000Z',
  whatDoing: 'testing',
  whatWrong: 'nothing',
  resolved: false,
  metadata: {},
};

describe('BugReportsPanel auth headers', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sends x-admin-password when listing reports', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ reports: [REPORT], count: 1 }),
    });

    render(<BugReportsPanel onClose={() => {}} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://test-backend/api/feedback');
    expect(options.headers['x-admin-password']).toBe('sesame');
  });

  it('sends x-admin-password when toggling resolved', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ reports: [REPORT], count: 1 }),
    });

    render(<BugReportsPanel onClose={() => {}} />);
    await screen.findByText('testing');

    fireEvent.click(screen.getByTitle('Click to resolve'));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, opts]) => opts?.method === 'PATCH');
      expect(patchCall).toBeDefined();
      const [url, options] = patchCall!;
      expect(url).toBe(`http://test-backend/api/feedback/${REPORT.id}`);
      expect(options.headers['x-admin-password']).toBe('sesame');
    });
  });
});
