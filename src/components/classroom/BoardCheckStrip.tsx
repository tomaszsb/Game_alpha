// src/components/classroom/BoardCheckStrip.tsx
//
// "Check my board" (Manager brief Job 4). A teacher presses one button; the server plays the classroom's
// built board with practice players in the background and says, in plain words, whether a game can be
// finished. It takes about a minute, so this strip polls and shows progress instead of waiting on a save.
// All wording here is a first draft for Tom to reword.

import React, { useCallback, useEffect, useState } from 'react';
import { startBoardCheck, fetchBoardCheck, type BoardCheck } from './classroomApi';
import { colors } from '../../styles/theme';

interface BoardCheckStripProps {
  instanceId: string;
  /** Bumps every time the teacher saves a change, so an older verdict can be marked as out of date. */
  changeToken: number;
  /** On a classroom row of the teacher list: no box of its own, no margin. */
  bare?: boolean;
}

const POLL_MS = 3000;

export function BoardCheckStrip({ instanceId, changeToken, bare }: BoardCheckStripProps): JSX.Element {
  const [check, setCheck] = useState<BoardCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // The change token the board had when the shown check started.
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCheck(await fetchBoardCheck(instanceId));
    } catch { /* a missed poll is fine - the next one tries again */ }
  }, [instanceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (check?.status !== 'running') return undefined;
    const timer = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [check?.status, refresh]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    const result = await startBoardCheck(instanceId);
    setStarting(false);
    if (result.success) {
      setCheck(result.check);
      setCheckedAt(changeToken);
    } else {
      setError(result.error);
    }
  };

  const running = check?.status === 'running';
  const summary = check?.summary ?? null;
  const outOfDate = !!check && check.status !== 'running' && checkedAt !== null && checkedAt !== changeToken;
  const tone = summary?.verdict === 'ok' ? colors.success : summary?.verdict === 'problem' ? colors.danger : colors.secondary;

  return (
    <div
      data-testid="board-check"
      style={{
        margin: bare ? 0 : '0.5rem 0.75rem', padding: bare ? 0 : '0.6rem 0.9rem', background: bare ? 'transparent' : '#fff',
        border: bare ? 'none' : '1px solid #dee2e6', borderRadius: 8, width: bare ? '100%' : undefined, display: 'flex', flexDirection: 'column', gap: '0.4rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid="board-check-button"
          disabled={starting || running}
          onClick={() => void handleStart()}
          style={{
            padding: '0.45rem 1rem', background: starting || running ? '#e9ecef' : colors.primary.main,
            color: starting || running ? '#868e96' : '#fff', border: 'none', borderRadius: 6,
            fontSize: '0.88rem', cursor: starting || running ? 'default' : 'pointer',
          }}
        >
          🔎 Check my board
        </button>
        <span style={{ fontSize: '0.82rem', color: colors.text.secondary }}>
          Practice players play your board and tell you if a game can be finished. It takes one to two minutes.
        </span>
      </div>

      {running && check && (
        <div data-testid="board-check-progress" style={{ fontSize: '0.85rem', color: colors.text.secondary }}>
          Checking… practice game {Math.min(check.results.length + 1, check.games)} of {check.games}
        </div>
      )}

      {error && <div role="alert" style={{ fontSize: '0.85rem', color: colors.danger.main }}>{error}</div>}

      {!running && summary && (
        <div
          data-testid="board-check-result"
          data-verdict={summary.verdict}
          style={{ fontSize: '0.88rem', color: tone.main ?? colors.text.primary }}
        >
          <div style={{ fontWeight: 600 }}>
            {summary.verdict === 'ok' ? '✅ ' : summary.verdict === 'problem' ? '⚠️ ' : 'ℹ️ '}
            {summary.headline}
            {outOfDate && <span style={{ fontWeight: 400, color: colors.text.secondary }}> (This was before your latest change - check again.)</span>}
          </div>
          {summary.problems.map(p => (
            <div key={p.code} style={{ marginTop: 2 }}>{p.message}</div>
          ))}
          {summary.lostNote && <div style={{ marginTop: 2, color: colors.text.secondary }}>{summary.lostNote}</div>}
          {check?.error && <div style={{ marginTop: 2, color: colors.text.secondary }}>{check.error}</div>}
        </div>
      )}
    </div>
  );
}
