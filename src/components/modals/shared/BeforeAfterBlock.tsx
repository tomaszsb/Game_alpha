// Renders a "before / after" snapshot diff inside a result modal so the
// player can see exactly what changed in their resources without dismissing
// the modal and hunting through tabs. Drives the at-a-glance feedback the
// 2026-05-15 playtesters asked for (feedback IDs 7692dba5, 5ce94e05).
//
// Renders nothing if both snapshots are absent or no field changed.

import React from 'react';
import { colors, theme } from '../../../styles/theme';
import { FormatUtils } from '../../../utils/FormatUtils';
import { getCardTypeName } from '../../../utils/cardTypeNames';
import type { ResourceSnapshot } from '../../../types/StateTypes';

interface BeforeAfterBlockProps {
  before: ResourceSnapshot | undefined;
  after: ResourceSnapshot | undefined;
}

interface DiffRow {
  label: string;
  beforeText: string;
  afterText: string;
  deltaText: string;
  isGain: boolean;
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString()}`;
}

function formatScope(n: number): string {
  return `$${n.toLocaleString()}`;
}

function formatTime(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

function formatCount(n: number, type: 'W' | 'B' | 'E' | 'I' | 'L'): string {
  return `${n} ${getCardTypeName(type, n)}`;
}

function buildRows(before: ResourceSnapshot, after: ResourceSnapshot): DiffRow[] {
  const rows: DiffRow[] = [];

  if (before.money !== after.money) {
    const delta = after.money - before.money;
    rows.push({
      label: 'Money',
      beforeText: formatMoney(before.money),
      afterText: formatMoney(after.money),
      deltaText: `${delta >= 0 ? '+' : '−'}${formatMoney(Math.abs(delta))}`,
      isGain: delta > 0,
    });
  }

  if (before.projectScope !== after.projectScope) {
    const delta = after.projectScope - before.projectScope;
    rows.push({
      label: 'Project scope',
      beforeText: formatScope(before.projectScope),
      afterText: formatScope(after.projectScope),
      deltaText: `${delta >= 0 ? '+' : '−'}${formatScope(Math.abs(delta))}`,
      // Scope going up is "more work taken on" — neutral, not a gain. Color
      // both directions in the brand-neutral text color rather than green/red
      // to avoid implying "scope went up = good news."
      isGain: false,
    });
  }

  if (before.timeSpent !== after.timeSpent) {
    const delta = after.timeSpent - before.timeSpent;
    rows.push({
      label: 'Project time',
      beforeText: formatTime(before.timeSpent),
      afterText: formatTime(after.timeSpent),
      deltaText: `${delta >= 0 ? '+' : '−'}${formatTime(Math.abs(delta))}`,
      // Time going up is bad (project taking longer), so flip the gain flag.
      isGain: delta < 0,
    });
  }

  const types: Array<'W' | 'B' | 'E' | 'I' | 'L'> = ['W', 'B', 'E', 'I', 'L'];
  for (const t of types) {
    const b = before.cardCountsByType[t];
    const a = after.cardCountsByType[t];
    if (b === a) continue;
    const delta = a - b;
    rows.push({
      label: getCardTypeName(t, 2), // plural-friendly heading
      beforeText: formatCount(b, t),
      afterText: formatCount(a, t),
      deltaText: `${delta >= 0 ? '+' : '−'}${Math.abs(delta)}`,
      isGain: delta > 0,
    });
  }

  return rows;
}

export function BeforeAfterBlock({ before, after }: BeforeAfterBlockProps): JSX.Element | null {
  if (!before || !after) return null;
  const rows = buildRows(before, after);
  if (rows.length === 0) return null;

  return (
    <div style={{
      marginTop: '14px',
      padding: '12px 14px',
      borderRadius: theme.borderRadius.md,
      backgroundColor: colors.secondary.bg,
      border: `1px solid ${colors.secondary.light}`,
    }}>
      <h4 style={{
        margin: 0,
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: 'bold',
        color: colors.text.primary,
      }}>
        Before → After
      </h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <td style={{
                padding: '4px 0',
                color: colors.text.secondary,
                whiteSpace: 'nowrap',
                paddingRight: '8px',
              }}>
                {row.label}
              </td>
              <td style={{
                padding: '4px 0',
                color: colors.text.primary,
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                paddingRight: '6px',
                whiteSpace: 'nowrap',
              }}>
                {row.beforeText}
              </td>
              <td style={{
                padding: '4px 0',
                color: colors.text.secondary,
                textAlign: 'center',
                paddingRight: '6px',
              }}>
                →
              </td>
              <td style={{
                padding: '4px 0',
                color: colors.text.primary,
                fontWeight: 'bold',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                paddingRight: '10px',
                whiteSpace: 'nowrap',
              }}>
                {row.afterText}
              </td>
              <td style={{
                padding: '4px 0',
                color: row.isGain ? colors.success.main : colors.text.secondary,
                fontWeight: 'bold',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}>
                {row.deltaText}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
