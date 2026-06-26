// PlayerNumbersV2 — the new panel's "recall my numbers" reference (Pile 3 /
// change-legibility; fb:f028e262, fb:cea108fb). A focused, plain-language recap
// the player can open ANY time — including mid-decision when choosing a path —
// to remember their scope, what each work package was and cost, how much money
// they've raised/spent, and how many days they've burned.
//
// It deliberately is NOT the classic pro-forma ProjectLedger (capital stack /
// variance / ROI = analysis, which is more than "what are my numbers again?").
// It REUSES the same canonical figures so it can't drift from the ledger: the
// work-package list + scope are the W-card `cost` basis the ledger's "Project
// Scope" line shows; money/spend come from the player's moneySources /
// expenditures. Reuses the proven ModalBase shell (light body, like
// PlayerCardDetailV2 — a dark modal body is a shared later step).

import React from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { ModalBase } from '../modals/shared/ModalBase';
import { panelPalettes, PanelMode } from './panelTheme';
import { FormatUtils } from '../../utils/FormatUtils';

export interface PlayerNumbersV2Props {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  gameServices: IServiceContainer;
  /** Reserved for the panel's light/dark mode; body is light-only for now. */
  mode?: PanelMode;
}

export const PlayerNumbersV2: React.FC<PlayerNumbersV2Props> = ({
  isOpen,
  onClose,
  playerId,
  gameServices,
}) => {
  const p = panelPalettes.light; // ModalBase body is light-only (mirrors PlayerCardDetailV2)
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  // Work packages held (hand + active) with their costs — the same basis as the
  // classic ProjectLedger's "Project Scope" line, so the two can't disagree.
  const cardIds = [
    ...(player.hand || []),
    ...((player.activeCards || []).map((ac) => ac.cardId)),
  ];
  const wCards = cardIds
    .map((id) => gameServices.dataService.getCardById(id))
    .filter((c): c is NonNullable<typeof c> => !!c && c.card_type === 'W');
  const scopeTotal = wCards.reduce((sum, c) => sum + parseFloat(String(c.cost || 0)), 0);

  const ms = player.moneySources || {};
  const fundingRaised =
    (ms.ownerFunding || 0) + (ms.bankLoans || 0) + (ms.investmentDeals || 0) + (ms.other || 0);
  const ex = player.expenditures || {};
  const spent = (ex.design || 0) + (ex.fees || 0) + (ex.construction || 0);
  const cash = player.money || 0;
  const days = player.timeSpent || 0;

  const fmt = (n: number) => FormatUtils.formatMoney(n);

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
    padding: '7px 10px',
    marginBottom: 6,
  };

  const moneyRow = (icon: string, label: string, value: number) => (
    <div style={row}>
      <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{icon}</span>
      <span style={{ color: p.muted, flex: 1 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{fmt(value)}</span>
    </div>
  );

  const footer = (
    <button
      onClick={onClose}
      aria-label="Close"
      style={{
        border: `1px solid ${p.borderStrong}`,
        background: p.surf,
        color: p.text,
        borderRadius: 9,
        padding: '9px 16px',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      Got it
    </button>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Your numbers"
      emoji="📋"
      maxWidth="420px"
      footer={footer}
      testId="player-numbers-v2"
    >
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: p.text }}>
        {/* Scope — what you're building, and what each piece cost */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionLabel}>What you&apos;re building (scope)</p>
          <div style={{ ...row, background: p.surf2, fontSize: 15 }}>
            <span aria-hidden style={{ width: 18, textAlign: 'center' }}>🏢</span>
            <span style={{ color: p.muted, flex: 1 }}>Total scope</span>
            <span style={{ fontWeight: 700 }}>{fmt(scopeTotal)}</span>
          </div>
          {wCards.length === 0 ? (
            <div style={{ fontSize: 12, color: p.muted, padding: '6px 2px' }}>
              No work packages yet — you&apos;ll pick these up as you go.
            </div>
          ) : (
            wCards.map((c, i) => (
              <div key={c.card_id || i} style={row}>
                <span aria-hidden style={{ width: 18, textAlign: 'center' }}>🏗️</span>
                <span style={{ flex: 1 }}>{c.card_name || c.card_id}</span>
                <span style={{ fontWeight: 600 }}>{fmt(parseFloat(String(c.cost || 0)))}</span>
              </div>
            ))
          )}
        </div>

        {/* Money — raised, spent, on hand */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionLabel}>Your money</p>
          {moneyRow('💰', 'Cash on hand', cash)}
          {moneyRow('🏦', 'Funding raised', fundingRaised)}
          {moneyRow('💸', 'Spent so far', spent)}
        </div>

        {/* Time */}
        <div>
          <p style={sectionLabel}>Your time</p>
          <div style={row}>
            <span aria-hidden style={{ width: 18, textAlign: 'center' }}>🕐</span>
            <span style={{ color: p.muted, flex: 1 }}>Days spent</span>
            <span style={{ fontWeight: 600 }}>{days}</span>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};
