// TrophyPlace — the trophy's picture and the player's place in that race ("2nd"), at the right end of a clipboard
// box's label row (Tom, 2026-10-25: "fastest on time, quality on scope and budget on money"). It sits in a row that
// already exists, so the box does not grow. Nothing is drawn when there is no race (a solo player, everyone level) or the
// player is out. A place that can still change is in italics, as on the live board. The picture comes from TROPHIES.csv;
// the emoji is used when there is none or it fails to load.
import React, { useState } from 'react';
import type { PanelPalette } from './panelTheme';
import type { LiveRow } from '../../utils/liveTrophies';
import { ordinal } from '../../utils/liveTrophies';
import { getTrophyRules, type TrophyId } from '../../utils/trophyRules';
import { detail } from '../game/LiveTrophyBoard';

const FALLBACK_EMOJI: Record<TrophyId, string> = { time: '📅', quality: '📋', money: '💰' };

interface Props {
  race: TrophyId;
  /** This player's row on the live board (undefined when the board is not available). */
  row: LiveRow | undefined;
  /** True when the game has one player: there is no race to place in. */
  solo: boolean;
  palette: PanelPalette;
}

/** True when TrophyPlace draws something (so the box's arrow knows whether it still needs the free space). */
export function hasTrophyPlace(race: TrophyId, row: LiveRow | undefined, solo: boolean): boolean {
  return !!row && !solo && row.status !== 'out' && row.races[race].contested && row.races[race].place !== null;
}

export function TrophyPlace({ race, row, solo, palette: p }: Props): JSX.Element | null {
  const [broken, setBroken] = useState(false);
  if (!row || solo || row.status === 'out') return null;
  const standing = row.races[race];
  if (!standing.contested || standing.place === null) return null;
  const rules = getTrophyRules();
  const icon = rules.icons[race];
  const provisional = !row.solid;
  const title = `${rules.names[race]}: ${detail(race, row)}, ${ordinal(standing.place)} of ${standing.of}${provisional ? ' for now' : ''}`;
  return (
    <span
      data-testid={`trophy-place-${race}`}
      data-place={standing.place}
      data-provisional={String(provisional)}
      title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 'auto', fontSize: 11, fontWeight: 700, lineHeight: '16px', color: standing.place === 1 ? p.good : p.text, fontStyle: provisional ? 'italic' : 'normal' }}
    >
      {icon && !broken
        ? <img src={`/images/${icon}`} alt="" width={16} height={16} onError={() => setBroken(true)} style={{ display: 'block', flexShrink: 0 }} />
        : <span aria-hidden style={{ fontSize: 13, lineHeight: '16px' }}>{FALLBACK_EMOJI[race]}</span>}
      <span>{ordinal(standing.place)}</span>
    </span>
  );
}
