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

import React, { useState } from 'react';
import { IServiceContainer } from '../../types/ServiceContracts';
import { ModalBase } from '../modals/shared/ModalBase';
import { panelPalettes, PanelMode } from './panelTheme';
import { FormatUtils } from '../../utils/FormatUtils';
import { computeProjectFinances, WorkPackage } from '../../utils/projectFinances';
import { TextWithTerms, useDictionaryPanel } from '../../dictionary';

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
  // Glossary terms in the ledger are taught on demand, not stripped (redesign §1
  // "teach, don't dumb down" + §6 — wrap jargon in TextWithTerms → side panel).
  const { openWithTerm } = useDictionaryPanel();
  // The scope list collapses behind the "Total scope" header (progressive
  // disclosure — keeps the recall view to one screen); tap it to reveal the
  // work packages. Which work packages have their own cost drill-down open.
  const [scopeOpen, setScopeOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return null;

  // One canonical finances computation (shared with any other new-view surface
  // via projectFinances) — scope, spent-vs-budget per area, funding gap. Mirrors
  // the old ledger's math so the numbers can't disagree during the migration.
  const fin = computeProjectFinances(player, (id) => gameServices.dataService.getCardById(id));

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
    padding: '6px 10px',
    marginBottom: 4,
  };

  const moneyRow = (icon: string, label: string, value: number) => (
    <div style={row}>
      <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{icon}</span>
      <span style={{ color: p.muted, flex: 1 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{fmt(value)}</span>
    </div>
  );

  // Trade subheading (the DOB work type, e.g. "Plumbing") with its scope subtotal.
  const tradeHeader: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    fontWeight: 700,
    color: p.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '5px 10px 1px',
  };

  // One line inside a work package's cost drill-down: a soft-cost component (or
  // the bold "Full cost" total). Indented under the package row.
  const subLine = (label: string, value: number, opts?: { bold?: boolean }) => (
    <div
      style={{
        display: 'flex',
        gap: 8,
        fontSize: 12,
        padding: '2px 10px 2px 32px',
        ...(opts?.bold
          ? { borderTop: `1px solid ${p.border}`, marginTop: 2, paddingTop: 4 }
          : null),
      }}
    >
      <span style={{ flex: 1, color: opts?.bold ? p.text : p.muted }}>{label}</span>
      <span style={{ fontWeight: opts?.bold ? 700 : 500, color: opts?.bold ? p.text : p.muted }}>
        {fmt(value)}
      </span>
    </div>
  );

  // A work-package row. The headline is the build cost (so the list still sums to
  // Total scope); tapping it drills into the soft costs the owner's price folds
  // in — design, city filings, a safety buffer — and the package's full cost.
  // That's why the money you must raise runs ahead of the bare scope.
  const packageRow = (w: WorkPackage, key: string) => {
    const isOpen = expanded.has(w.id);
    return (
      <div key={key} style={{ marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => toggle(w.id)}
          aria-expanded={isOpen}
          style={{
            ...row,
            paddingLeft: 14,
            marginBottom: 0,
            width: '100%',
            border: 'none',
            background: p.surf,
            font: 'inherit',
            color: p.text,
            textAlign: 'left',
            cursor: 'pointer',
            minHeight: 36,
          }}
        >
          <span aria-hidden style={{ width: 18, textAlign: 'center' }}>🏗️</span>
          <span style={{ flex: 1 }}>{w.name}</span>
          <span style={{ fontWeight: 600 }}>{fmt(w.cost)}</span>
          <span aria-hidden style={{ color: p.muted, fontSize: 11, width: 12, textAlign: 'center' }}>
            {isOpen ? '▾' : '▸'}
          </span>
        </button>
        {isOpen && (
          <div style={{ background: p.surf2, borderRadius: 8, padding: '4px 0', margin: '2px 0 0' }}>
            {subLine('The build itself', w.breakdown.build)}
            {subLine('Design & professional fees (20%)', w.breakdown.design)}
            {subLine('Regulatory & filings (5%)', w.breakdown.regulatory)}
            {subLine('Safety buffer (contingency)', w.breakdown.contingency)}
            {subLine('Full cost', w.fullCost, { bold: true })}
          </div>
        )}
      </div>
    );
  };

  // A "where the money's going" area: spent of budget, with a plain over-budget
  // flag when relevant. Over/under is carried by the ▲ + words, never colour
  // alone (a11y), and the chip only appears when actually over.
  const areaRow = (icon: string, label: string, spent: number, budget: number) => {
    const over = spent - budget;
    return (
      <div key={label} style={{ ...row, flexWrap: 'wrap' }}>
        <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <TextWithTerms text={label} onTermClick={(term) => openWithTerm(term.id)} />
        </span>
        <span style={{ fontWeight: 600 }}>
          {fmt(spent)} <span style={{ color: p.muted, fontWeight: 400 }}>of {fmt(budget)}</span>
        </span>
        {over > 0 && (
          <span
            style={{
              flexBasis: '100%',
              textAlign: 'right',
              fontSize: 11,
              fontWeight: 700,
              color: '#c0392b',
            }}
          >
            ▲ {fmt(over)} over budget
          </span>
        )}
      </div>
    );
  };

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
        <div style={{ marginBottom: 12 }}>
          <p style={sectionLabel}>What you&apos;re building (scope)</p>
          {fin.workPackages.length === 0 ? (
            <>
              <div style={{ ...row, background: p.surf2, fontSize: 15 }}>
                <span aria-hidden style={{ width: 18, textAlign: 'center' }}>🏢</span>
                <span style={{ color: p.muted, flex: 1 }}>
                  <TextWithTerms text="Total scope" onTermClick={(term) => openWithTerm(term.id)} />
                </span>
                <span style={{ fontWeight: 700 }}>{fmt(fin.scopeTotal)}</span>
              </div>
              <div style={{ fontSize: 12, color: p.muted, padding: '6px 2px' }}>
                No work packages yet — you&apos;ll pick these up as you go.
              </div>
            </>
          ) : (
            <>
              {/* Total scope is itself a drill-down: tap to reveal the work
                  packages (the "scope" word still opens the glossary — its click
                  stops propagation, so it won't toggle the section). */}
              <button
                type="button"
                onClick={() => setScopeOpen((o) => !o)}
                aria-expanded={scopeOpen}
                style={{
                  ...row,
                  background: p.surf2,
                  fontSize: 15,
                  width: '100%',
                  border: 'none',
                  font: 'inherit',
                  color: p.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: 40,
                }}
              >
                <span aria-hidden style={{ width: 18, textAlign: 'center' }}>🏢</span>
                <span style={{ color: p.muted, flex: 1 }}>
                  <TextWithTerms text="Total scope" onTermClick={(term) => openWithTerm(term.id)} />
                </span>
                <span style={{ fontWeight: 700 }}>{fmt(fin.scopeTotal)}</span>
                <span aria-hidden style={{ color: p.muted, fontSize: 11, width: 12, textAlign: 'center' }}>
                  {scopeOpen ? '▾' : '▸'}
                </span>
              </button>
              {/* Grouped by trade (DOB work type) so the scope reads the way it's
                  actually filed — General Construction / Plumbing / Sprinklers / …
                  (fb:222cd521). Each trade carries its own scope subtotal. */}
              {scopeOpen &&
                fin.scopeByTrade.map((g) => (
                  <div key={g.trade} style={{ marginBottom: 2 }}>
                    <div style={tradeHeader}>
                      <span style={{ flex: 1 }}>
                        <TextWithTerms text={g.trade} onTermClick={(term) => openWithTerm(term.id)} />
                      </span>
                      {g.packages.length > 1 && <span>{fmt(g.total)}</span>}
                    </div>
                    {g.packages.map((w, i) => packageRow(w, w.id || String(i)))}
                  </div>
                ))}
              {/* Reconciles the scope list with "Still to raise": the owner's prices
                  fold in design, filings + a buffer, so the money to raise runs ahead
                  of the bare build. Always visible — the summary that ties it together. */}
              <div style={{ ...row, background: p.surf2, fontSize: 14, marginTop: 6 }}>
                <span aria-hidden style={{ width: 18, textAlign: 'center' }}>💰</span>
                <span style={{ color: p.muted, flex: 1 }}>Full project budget</span>
                <span style={{ fontWeight: 700 }}>{fmt(fin.commitments)}</span>
              </div>
              <p style={{ fontSize: 11, color: p.muted, margin: '4px 2px 0', lineHeight: 1.4 }}>
                More than the scope above: the owner&apos;s prices fold in design,
                city filings &amp; a safety buffer.{' '}
                {scopeOpen ? 'Tap any item to see its full cost.' : 'Tap “Total scope” to see each item.'}
              </p>
            </>
          )}
        </div>

        {/* Where your money's going — spent vs budget per area (the old ledger's
            "uses" breakdown, in plain language). Only shown once there's scope to
            budget against, so an empty early-game view stays clean. */}
        {fin.scopeTotal > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={sectionLabel}>Where your money&apos;s going</p>
            {areaRow('📐', 'Design & professional fees', fin.design.spent, fin.design.budget)}
            {areaRow('📋', 'Regulatory & filings', fin.regulatory.spent, fin.regulatory.budget)}
            {areaRow('🏗️', 'Construction', fin.construction.spent, fin.construction.budget)}
            {areaRow('🛡️', 'Contingency (your buffer)', fin.contingency.used, fin.contingency.budget)}
          </div>
        )}

        {/* Money — raised, spent, on hand, and whether you've raised enough */}
        <div style={{ marginBottom: 12 }}>
          <p style={sectionLabel}>Your money</p>
          {moneyRow('💰', 'Cash on hand', fin.cash)}
          {moneyRow('🏦', 'Funding raised', fin.fundingRaised)}
          {moneyRow('💸', 'Spent so far', fin.spent)}
          {fin.fundingGap > 0 && (
            <div
              style={{
                ...row,
                background: '#fdecea',
                border: '1px solid #f5c6cb',
              }}
            >
              <span aria-hidden style={{ width: 18, textAlign: 'center' }}>⚠️</span>
              <span style={{ flex: 1, color: '#c0392b', fontWeight: 600 }}>Still to raise</span>
              <span style={{ fontWeight: 700, color: '#c0392b' }}>{fmt(fin.fundingGap)}</span>
            </div>
          )}
        </div>
      </div>
    </ModalBase>
  );
};
