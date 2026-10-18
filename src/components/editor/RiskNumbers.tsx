// src/components/editor/RiskNumbers.tsx
//
// "What it can cost": the teacher's plain view of the days and money behind a
// space's chance outcomes (Tom, 2026-10-18: "Close the gap"; teachers must change
// the game "with ease and no training"). One line per distinct result, e.g.
//   4 in 6 times: [0] days
//   2 in 6 times: [30] days
// built from a DiceRoll Info `Time outcomes` / `Fees Paid` row. Editing a line
// writes the same value into every one of the six cells it stands for, so the
// odds never change, only the price. Rows whose cells are places (not prices)
// and `Next Step` rows are never shown. The server re-checks every value
// (findBadRiskNumbers / restrictChangesToWording in server/instanceContentDiff.js).

import React, { useMemo } from 'react';
import type { DiceRollRow } from './types/EditorTypes';

const CELLS = ['roll_1', 'roll_2', 'roll_3', 'roll_4', 'roll_5', 'roll_6'] as const;
export const RISK_KINDS = ['Time outcomes', 'Fees Paid'] as const;
const DAY_RE = /^(\d{1,3})(\s*days?)?$/i;
const FEE_RE = /^-?\$?\d[\d,]{0,9}$/;

export function riskCellValue(kind: string, cell: string): number | null {
  const t = String(cell ?? '').trim();
  if (t === '') return 0;
  if (kind === 'Time outcomes') {
    const m = t.match(DAY_RE);
    return m ? Number(m[1]) : null;
  }
  return FEE_RE.test(t) ? Math.abs(Number(t.replace(/[$,]/g, ''))) : null;
}

export function isPriceDiceRow(row: Pick<DiceRollRow, 'die_roll'> & Record<string, string>): boolean {
  if (!(RISK_KINDS as readonly string[]).includes(String(row.die_roll || '').trim())) return false;
  return CELLS.every((c) => riskCellValue(row.die_roll.trim(), row[c]) !== null);
}

export function formatRiskCell(kind: string, n: number): string {
  if (kind === 'Time outcomes') return `${n} day${n === 1 ? '' : 's'}`;
  return n === 0 ? '0' : `-${n}`;
}

/** The six cells grouped by equal value, in first-seen order: [{ value, cells }]. */
export function groupRiskCells(kind: string, row: Record<string, string>): Array<{ value: number; cells: typeof CELLS[number][] }> {
  const groups: Array<{ value: number; cells: typeof CELLS[number][] }> = [];
  for (const c of CELLS) {
    const v = riskCellValue(kind, row[c]) ?? 0;
    const g = groups.find((x) => x.value === v);
    if (g) g.cells.push(c); else groups.push({ value: v, cells: [c] });
  }
  return groups;
}

interface Props {
  diceRolls: DiceRollRow[];
  spaceName: string;
  visitType: 'First' | 'Subsequent';
  onUpdateDiceRoll: (index: number, field: keyof DiceRollRow, value: string) => void;
}

const lineStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '6px 0' };
const inputStyle: React.CSSProperties = { width: 110, fontSize: 15, padding: '6px 8px', minHeight: 36 };

export function RiskNumbers({ diceRolls, spaceName, visitType, onUpdateDiceRoll }: Props): JSX.Element | null {
  const rows = diceRolls
    .map((roll, idx) => ({ roll, idx }))
    .filter(({ roll }) => roll.space_name === spaceName && roll.visit_type === visitType
      && isPriceDiceRow(roll as unknown as DiceRollRow & Record<string, string>));
  // Which cells belong together is fixed by the space as it was LOADED, so typing
  // a value that matches another line never merges the two lines mid-edit.
  const layout = useMemo(
    () => new Map(rows.map(({ roll, idx }) => [idx, groupRiskCells(roll.die_roll.trim(), roll as unknown as Record<string, string>).map((g) => g.cells)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-group only when the space or visit changes
    [spaceName, visitType, rows.length],
  );
  if (rows.length === 0) return null;
  return (
    <div data-testid="risk-numbers" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>What it can cost</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>The chances stay the same; you set the price.</div>
      {rows.map(({ roll, idx }) => {
        const kind = roll.die_roll.trim();
        const isDays = kind === 'Time outcomes';
        return (layout.get(idx) ?? []).map((cells) => {
          const value = riskCellValue(kind, (roll as unknown as Record<string, string>)[cells[0]]) ?? 0;
          const label = `${cells.length} in 6 times`;
          return (
            <label key={`${idx}-${cells.join()}`} style={lineStyle} data-testid={`risk-line-${isDays ? 'days' : 'money'}`}>
              <span style={{ minWidth: 96 }}>{label}:</span>
              {!isDays && <span>$</span>}
              <input
                type="number" min={0} max={isDays ? 365 : 1000000} step={isDays ? 1 : 500}
                value={value}
                aria-label={`${label}, ${isDays ? 'days' : 'dollars'}`}
                onChange={(e) => {
                  const raw = Math.floor(Math.abs(Number(e.target.value) || 0));
                  const n = Math.min(raw, isDays ? 365 : 1000000);
                  for (const c of cells) onUpdateDiceRoll(idx, c, formatRiskCell(kind, n));
                }}
                style={inputStyle}
              />
              {isDays && <span>days</span>}
            </label>
          );
        });
      })}
    </div>
  );
}
