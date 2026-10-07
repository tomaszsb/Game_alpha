/* @vitest-pool forks */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BoardCheckStrip } from '../../../src/components/classroom/BoardCheckStrip';
import * as api from '../../../src/components/classroom/classroomApi';

const done = (verdict: 'ok' | 'problem', headline: string, problems: any[] = []): api.BoardCheck => ({
  status: 'done', games: 3, seats: 1, startedAt: 1, finishedAt: 2, results: [], error: null,
  summary: { verdict, headline, problems, counts: { games: 3, finished: 3, lost: 0, stuck: 0, broken: 0 }, lostNote: null },
});

describe('BoardCheckStrip', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => cleanup());

  it('starts a check, then shows a plain verdict', async () => {
    vi.spyOn(api, 'fetchBoardCheck').mockResolvedValue(null);
    const start = vi.spyOn(api, 'startBoardCheck').mockResolvedValue({ success: true, check: done('ok', 'Good news: practice players finished this board in 3 of 3 games.') });
    render(<BoardCheckStrip instanceId="room-1" changeToken={0} />);
    fireEvent.click(screen.getByTestId('board-check-button'));
    await waitFor(() => expect(screen.getByTestId('board-check-result')).toHaveAttribute('data-verdict', 'ok'));
    expect(start).toHaveBeenCalledWith('room-1');
    expect(screen.getByText(/Good news/)).toBeInTheDocument();
  });

  it('names the problem when practice players get stuck', async () => {
    vi.spyOn(api, 'fetchBoardCheck').mockResolvedValue(done('problem', 'Something is wrong with this board.', [
      { code: 'STUCK', message: '2 of 3 practice games got stuck. They went round in circles around: AUTH-1.', spaces: ['AUTH-1'] },
    ]));
    render(<BoardCheckStrip instanceId="room-1" changeToken={0} />);
    await waitFor(() => expect(screen.getByTestId('board-check-result')).toHaveAttribute('data-verdict', 'problem'));
    expect(screen.getByText(/AUTH-1/)).toBeInTheDocument();
  });

  it('shows progress while it runs and disables the button', async () => {
    vi.spyOn(api, 'fetchBoardCheck').mockResolvedValue({
      status: 'running', games: 3, seats: 1, startedAt: 1, finishedAt: null,
      results: [{ reason: 'FINISHED' }], error: null, summary: null,
    });
    render(<BoardCheckStrip instanceId="room-1" changeToken={0} />);
    await waitFor(() => expect(screen.getByTestId('board-check-progress')).toHaveTextContent('practice game 2 of 3'));
    expect(screen.getByTestId('board-check-button')).toBeDisabled();
  });

  it('shows the server error when the check cannot start', async () => {
    vi.spyOn(api, 'fetchBoardCheck').mockResolvedValue(null);
    vi.spyOn(api, 'startBoardCheck').mockResolvedValue({ success: false, error: 'Not signed in.' });
    render(<BoardCheckStrip instanceId="room-1" changeToken={0} />);
    fireEvent.click(screen.getByTestId('board-check-button'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not signed in.'));
  });
});
