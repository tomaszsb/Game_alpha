// OutcomeChangesV2 — the new-view "what just happened" before→after block.
//
// Gated to the opt-in new panel (DiceResultModal reads ucPanelVersion). The
// shared classic BeforeAfterBlock stays untouched. This mirrors the "My numbers"
// ledger (PlayerNumbersV2) so a change reads in the SAME visual language the
// player recalls their figures in (fb:dc7652ec — "before/after should look like
// my numbers"). It also names the SPECIFIC resource/expeditor gained or lost
// from the effect payload, instead of a bare count delta, so the player can see
// *which* card changed (fb:0001f5df / fb:0fc63fc1 / fb:3aad5f84 — "says it cost
// me two expeditors but not which two").
//
// Pure helpers (buildResourceRows / buildCardChanges) are exported for tests.

import React from 'react';
import { panelPalettes, PanelMode } from './panelTheme';
import { FormatUtils } from '../../utils/FormatUtils';
import { getCardTypeName } from '../../utils/cardTypeNames';
import type { ResourceSnapshot, DiceResultEffect } from '../../types/StateTypes';

/** Resolve a card id to a player-facing name + type. */
export type ResolveCard = (id: string) => { name: string; type: string } | null;

type CardKind = 'W' | 'B' | 'E' | 'I' | 'L';
const CARD_TYPES: CardKind[] = ['W', 'B', 'E', 'I', 'L'];

function isCardKind(t: string): t is CardKind {
  return (CARD_TYPES as string[]).includes(t);
}

export interface ResourceRow {
  key: 'money' | 'scope' | 'time';
  icon: string;
  label: string;
  beforeText: string;
  afterText: string;
  deltaText: string;
  /** true → tint the delta as a positive/gain (green); false → neutral. */
  isGain: boolean;
}

function formatMoney(n: number): string {
  return FormatUtils.formatMoney(n);
}

function formatDays(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

function signed(delta: number, fmt: (n: number) => string): string {
  return `${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))}`;
}

/**
 * The numeric before→after rows: cash, scope, project time. Only rows that
 * actually changed are returned (an unchanged figure adds noise).
 */
export function buildResourceRows(
  before: ResourceSnapshot,
  after: ResourceSnapshot,
): ResourceRow[] {
  const rows: ResourceRow[] = [];

  if (before.money !== after.money) {
    const delta = after.money - before.money;
    rows.push({
      key: 'money',
      icon: '💰',
      label: 'Cash on hand',
      beforeText: formatMoney(before.money),
      afterText: formatMoney(after.money),
      deltaText: signed(delta, formatMoney),
      isGain: delta > 0,
    });
  }

  if (before.projectScope !== after.projectScope) {
    const delta = after.projectScope - before.projectScope;
    rows.push({
      key: 'scope',
      icon: '🏢',
      label: 'Project scope',
      beforeText: formatMoney(before.projectScope),
      afterText: formatMoney(after.projectScope),
      deltaText: signed(delta, formatMoney),
      // More scope = more work taken on, not "good news" — keep it neutral.
      isGain: false,
    });
  }

  if (before.timeSpent !== after.timeSpent) {
    const delta = after.timeSpent - before.timeSpent;
    rows.push({
      key: 'time',
      icon: '📅',
      label: 'Project time',
      beforeText: formatDays(before.timeSpent),
      afterText: formatDays(after.timeSpent),
      deltaText: signed(delta, formatDays),
      // Time going UP is bad (project taking longer) — a gain is fewer days.
      isGain: delta < 0,
    });
  }

  return rows;
}

export interface CardChange {
  action: 'gained' | 'lost' | 'swapped';
  type: string;
  /** Specific card name when we know which card; null for a generic count. */
  name: string | null;
  /** Only meaningful for generic (name===null) rows. */
  count: number;
}

const ACTION_FROM_CARD_ACTION: Record<string, CardChange['action']> = {
  draw: 'gained',
  remove: 'lost',
  give: 'lost',
  return: 'lost',
  replace: 'swapped',
};

/**
 * Turn the card effects into named change rows. Prefers the effect's cardIds
 * (so we can name the exact card — "Zoning Expeditor"); falls back to a generic
 * "N Expeditors" row when the payload didn't carry ids. When no card effects
 * are present but snapshots differ (legacy paths), the caller can fall back to
 * buildCardChangesFromSnapshot.
 */
export function buildCardChanges(
  effects: DiceResultEffect[] | undefined,
  resolveCard: ResolveCard,
): CardChange[] {
  if (!effects) return [];
  const changes: CardChange[] = [];

  for (const eff of effects) {
    if (eff.type !== 'cards') continue;
    const action = ACTION_FROM_CARD_ACTION[eff.cardAction || 'draw'];
    if (!action) continue;

    const ids = eff.cardIds ?? [];
    if (ids.length > 0) {
      for (const id of ids) {
        const resolved = resolveCard(id);
        changes.push({
          action,
          type: resolved?.type || (eff.cardType ?? ''),
          name: resolved?.name ?? null,
          count: 1,
        });
      }
    } else if (eff.cardCount && eff.cardType) {
      // No ids on the payload — degrade to a generic "N <type>" row rather
      // than drop the change entirely.
      changes.push({ action, type: eff.cardType, name: null, count: eff.cardCount });
    }
  }

  return changes;
}

/**
 * Fallback for legacy result paths that carry snapshots but no card effects:
 * diff the per-type counts. Can only produce generic (unnamed) rows.
 */
export function buildCardChangesFromSnapshot(
  before: ResourceSnapshot,
  after: ResourceSnapshot,
): CardChange[] {
  const changes: CardChange[] = [];
  for (const t of CARD_TYPES) {
    const delta = after.cardCountsByType[t] - before.cardCountsByType[t];
    if (delta === 0) continue;
    changes.push({
      action: delta > 0 ? 'gained' : 'lost',
      type: t,
      name: null,
      count: Math.abs(delta),
    });
  }
  return changes;
}

interface OutcomeChangesV2Props {
  before: ResourceSnapshot | undefined;
  after: ResourceSnapshot | undefined;
  effects?: DiceResultEffect[];
  resolveCard: ResolveCard;
  mode: PanelMode;
}

const ACTION_META: Record<CardChange['action'], { symbol: string; verb: string }> = {
  gained: { symbol: '＋', verb: 'Gained' },
  lost: { symbol: '－', verb: 'Lost' },
  swapped: { symbol: '↔', verb: 'Swapped' },
};

/** Plain-language name for a card change row. */
function cardChangeLabel(c: CardChange): string {
  if (c.name) return c.name;
  // Generic: "2 Expeditors"
  const typeName = isCardKind(c.type) ? getCardTypeName(c.type, c.count) : c.type;
  return `${c.count} ${typeName}`;
}

/** The trade/type tag shown after a named card (e.g. "Expeditor"). */
function cardTypeTag(c: CardChange): string | null {
  if (!c.name) return null; // generic rows already carry the type in their label
  return isCardKind(c.type) ? getCardTypeName(c.type, 1) : c.type;
}

export function OutcomeChangesV2({
  before,
  after,
  effects,
  resolveCard,
  mode,
}: OutcomeChangesV2Props): JSX.Element | null {
  const p = panelPalettes[mode];

  if (!before || !after) return null;

  const resourceRows = buildResourceRows(before, after);
  let cardChanges = buildCardChanges(effects, resolveCard);
  if (cardChanges.length === 0) {
    cardChanges = buildCardChangesFromSnapshot(before, after);
  }

  if (resourceRows.length === 0 && cardChanges.length === 0) return null;

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.05em',
    color: p.muted,
    textTransform: 'uppercase',
    margin: '0 0 6px',
  };
  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    background: p.surf,
    borderRadius: 8,
    padding: '6px 10px',
    marginBottom: 4,
    flexWrap: 'wrap',
  };
  const gainColor = p.good; // mode-safe green from the shared palette

  return (
    <div
      data-testid="outcome-changes-v2"
      style={{
        marginTop: 14,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: p.text,
      }}
    >
      <p style={sectionLabel}>What changed</p>

      {/* Numeric before → after rows (cash / scope / time), ledger-styled. */}
      {resourceRows.map((r) => (
        <div key={r.key} style={row}>
          <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{r.icon}</span>
          <span style={{ color: p.muted, flex: 1 }}>{r.label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: p.muted, fontVariantNumeric: 'tabular-nums' }}>{r.beforeText}</span>
            <span aria-hidden style={{ color: p.muted }}>→</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.afterText}</span>
            <span
              style={{
                marginLeft: 4,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: r.isGain ? gainColor : p.muted,
              }}
            >
              {r.deltaText}
            </span>
          </span>
        </div>
      ))}

      {/* Named resource/expeditor changes — the "which one?" the players asked
          for. Redundant coding: a +/−/↔ symbol AND the verb word, never colour
          alone (a11y; and the light-mode no-ghost rule keeps text dark). */}
      {cardChanges.map((c, i) => {
        const meta = ACTION_META[c.action];
        const tag = cardTypeTag(c);
        return (
          <div key={`card-${i}`} style={row}>
            <span
              aria-hidden
              style={{
                width: 18,
                textAlign: 'center',
                fontWeight: 700,
                color: c.action === 'lost' ? p.text : c.action === 'gained' ? gainColor : p.muted,
              }}
            >
              {meta.symbol}
            </span>
            <span style={{ color: p.muted }}>{meta.verb}:</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{cardChangeLabel(c)}</span>
            {tag && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: p.muted,
                  background: p.surf2,
                  borderRadius: 6,
                  padding: '1px 6px',
                }}
              >
                {tag}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
