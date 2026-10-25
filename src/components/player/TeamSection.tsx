// src/components/player/TeamSection.tsx
// "Your team" on the Expeditors page: the reps you hold (name, area, pay) with a Let go button each, and one
// Hire a team member button. Hiring and letting go are the player's own choice, any time on their turn; the
// hire pop-up and the rest are the shared choice pop-up, so this section only starts them (BETA_PLAN_V3.md, N3 item 2).
import React, { useState } from 'react';
import type { PanelPalette } from './panelTheme';
import type { RepService } from '../../services/RepService';
import { TEAM as NUMBERS } from '../../constants/uiStrings';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

interface Props {
  playerId: string;
  repService: RepService;
  palette: PanelPalette;
  /** Hire and let go only on the player's own turn. */
  canAct: boolean;
}

export function TeamSection({ playerId, repService, palette: p, canAct }: Props): JSX.Element {
  const [busy, setBusy] = useState(false);
  const team = repService.describe(playerId);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const button: React.CSSProperties = {
    border: `1px solid ${p.accent}`, background: p.accent, color: '#fff', borderRadius: 8, padding: '6px 12px',
    fontSize: 12, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
  };
  return (
    <div data-testid="team-section" style={{ marginTop: 14 }}>
      <p style={{ fontSize: 10, letterSpacing: '0.05em', color: p.muted, textTransform: 'uppercase', margin: '0 0 6px' }}>{NUMBERS.TEAM_TITLE}</p>
      {team.length === 0 && (
        <div style={{ fontSize: 13, color: p.muted, padding: '2px 2px 8px' }}>{NUMBERS.TEAM_EMPTY}</div>
      )}
      {team.map(r => (
        <div
          key={r.id}
          data-testid={`team-rep-${r.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: p.surf, borderRadius: 8, padding: '6px 10px', marginBottom: 4 }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>{r.def.name}</strong>
            <span style={{ color: p.muted }}> · {r.def.area} · {NUMBERS.teamPay(money(r.salary))}</span>
            <span style={{ display: 'block', fontSize: 11, color: p.muted }}>{r.def.blurb}</span>
          </span>
          {canAct && (
            <button
              type="button"
              data-testid={`team-fire-${r.id}`}
              disabled={busy}
              onClick={() => run(() => repService.fire(playerId, r.id))}
              style={{ ...button, background: 'transparent', color: p.text, border: `1px solid ${p.borderStrong}` }}
            >
              {NUMBERS.TEAM_FIRE}
            </button>
          )}
        </div>
      ))}
      {team.length > 0 && (
        <div style={{ fontSize: 12, color: p.muted, marginBottom: 6 }}>{NUMBERS.teamTotal(money(repService.weeklyPay(playerId)))}</div>
      )}
      {canAct && (
        <>
          <button type="button" data-testid="team-hire" disabled={busy} onClick={() => run(() => repService.hire(playerId))} style={button}>
            {busy ? NUMBERS.TEAM_WAITING : NUMBERS.TEAM_HIRE}
          </button>
          <div style={{ fontSize: 11, color: p.muted, marginTop: 4 }}>{NUMBERS.TEAM_HIRE_NOTE}</div>
        </>
      )}
    </div>
  );
}
