// BuilderBidsCard — "Hire a Builder" on the player panel: the builders' bids (price, days of
// work, how long the price is held) with one Hire button each, plus the lender's money line.
// Replaces the two outcome buttons that used to be pressed here. The work quality is not on the
// screen until the player has hired someone. All rules are in utils/builderBids.ts; wording is
// UI_STRINGS.csv (BUILDER_BIDS.*); the numbers and names are TROPHIES.csv.
//
// Test ids (the playtest robots rely on these): builder-bids, builder-bid (+ data-bid-id,
// data-price, data-days, data-guarantee-days), builder-bid-hire, builder-bids-lapsed,
// builder-bids-error, builder-hired, bank-bid-line.

import React, { useEffect, useState } from 'react';
import type { IServiceContainer } from '../../types/ServiceContracts';
import type { PanelPalette } from './panelTheme';
import { BUILDER_BIDS } from '../../constants/uiStrings';
import { getBuilderRules } from '../../utils/trophyRules';
import { cheapestLiveBid, isBidLive, typicalQuote } from '../../utils/builderBids';
import { usePhoneWidth } from '../../hooks/usePhoneWidth';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

interface CardProps {
  gameServices: IServiceContainer;
  playerId: string;
  palette: PanelPalette;
  /** Only the player whose turn it is can hire (a spectator or a waiting seat only looks). */
  canAct: boolean;
}

/** True when this player stands at the builder's desk with nobody hired (the panel uses it to open its "This turn" section). */
export function isShoppingForBuilder(gameServices: IServiceContainer, playerId: string): boolean {
  const player = gameServices.stateService.getPlayer(playerId);
  const space = getBuilderRules().space;
  return !!player && !!space && player.currentSpace === space && !player.contractor;
}

export const BuilderBidsCard: React.FC<CardProps> = ({ gameServices, playerId, palette: p, canAct }) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // On a phone the same facts take fewer words: the player panel there must stay no taller than it was.
  const isPhone = usePhoneWidth();
  const player = gameServices.stateService.getPlayer(playerId);
  const day = player?.timeSpent ?? 0;
  const planKeyNow = player
    ? `${gameServices.gameRulesService.calculateProjectScope(playerId)}|${gameServices.gameRulesService.calculateTotalWorkCost(playerId)}`
    : '';

  // Bring the bids up to date whenever the player, the day or the plan changes (a lapsed price
  // is replaced; a changed plan voids them all). Only the player whose turn it is writes.
  useEffect(() => {
    if (canAct) gameServices.turnService.ensureBuilderBids(playerId);
  }, [canAct, gameServices, playerId, player?.currentSpace, day, planKeyNow, player?.contractor]);

  if (!player) return null;
  const set = player.builderBids;

  // Already signed: say what the deal turned out to be, including the quality that was hidden.
  if (player.contractor) {
    const bid = set?.bids.find((b) => b.id === set.hiredId);
    // Only on the visit where the deal was made, not on every later change-order visit.
    if (!bid || player.visitType !== 'First' || player.currentSpace !== getBuilderRules().space) return null;
    const quality = getBuilderRules().qualities[bid.quality];
    return (
      <div data-testid="builder-hired" style={{ padding: '9px 11px', marginBottom: 8, background: p.goodSurf, border: `1px solid ${p.goodBorder}`, borderRadius: 9, fontSize: 13, color: p.text }}>
        {BUILDER_BIDS.hired(money(bid.price), bid.days, quality.name)}
      </div>
    );
  }

  const live = (set?.bids ?? []).filter((b) => isBidLive(b, day));
  if (live.length === 0) return null;

  const hire = async (bidId: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await gameServices.turnService.hireBuilderBid(playerId, bidId);
      if (!result.success) setError(result.message ?? null);
    } finally {
      setBusy(false);
    }
  };

  const lapsed = set?.lapsed ?? [];
  const lapsedLines = lapsed.some((l) => l.reason === 'plan_changed')
    ? [BUILDER_BIDS.LAPSED_PLAN]
    : lapsed.map((l) => BUILDER_BIDS.lapsedExpired(money(l.price), l.guaranteeDays));

  return (
    <div data-testid="builder-bids" style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 3px', color: p.text }}>{BUILDER_BIDS.title(live.length)}</p>
      {!isPhone && <p style={{ fontSize: 12, margin: '0 0 6px', color: p.muted }}>{BUILDER_BIDS.INTRO}</p>}
      {lapsedLines.length > 0 && (
        <div data-testid="builder-bids-lapsed" style={{ fontSize: 12, margin: '0 0 6px', padding: '6px 9px', background: p.warnSurf, border: '1px solid #f59e0b', borderRadius: 8, color: p.text }}>
          {lapsedLines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
      {live.map((b) => (
        <div
          key={b.id}
          data-testid="builder-bid"
          data-bid-id={b.id}
          data-price={b.price}
          data-days={b.days}
          data-guarantee-days={b.guaranteeDays}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isPhone ? 5 : 6, padding: isPhone ? '5px 8px' : '7px 9px', background: p.surf, border: `1px solid ${p.borderStrong}`, borderRadius: 9 }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: p.text }}>{money(b.price)}</div>
            <div style={{ fontSize: 12, color: p.muted }}>
              {isPhone
                ? `${BUILDER_BIDS.days(b.days)} · ${BUILDER_BIDS.holdsShort(b.expiresDay)}`
                : `${BUILDER_BIDS.days(b.days)} · ${BUILDER_BIDS.holds(b.expiresDay, b.expiresDay - day)}`}
            </div>
          </div>
          <button
            type="button"
            data-testid="builder-bid-hire"
            aria-label={BUILDER_BIDS.hireAria(money(b.price), b.days)}
            disabled={!canAct || busy}
            onClick={() => hire(b.id)}
            style={{ flexShrink: 0, padding: isPhone ? '8px 9px' : '8px 10px', borderRadius: 8, border: `1px solid ${p.borderStrong}`, background: p.accent, color: '#fff', fontWeight: 600, fontSize: 13, cursor: canAct && !busy ? 'pointer' : 'default', opacity: canAct ? 1 : 0.55 }}
          >
            {isPhone ? BUILDER_BIDS.HIRE_SHORT : BUILDER_BIDS.HIRE}
          </button>
        </div>
      ))}
      {error && <div data-testid="builder-bids-error" role="alert" style={{ fontSize: 12, color: p.bad, marginBottom: 6 }}>{error}</div>}
      <p style={{ fontSize: 11, margin: '0 0 2px', color: p.muted }}>{isPhone ? BUILDER_BIDS.LENDER_SHORT : BUILDER_BIDS.LENDER}</p>
    </div>
  );
};

interface LineProps {
  gameServices: IServiceContainer;
  playerId: string;
  palette: PanelPalette;
}

/** The line at the lender (and bank, and investor): the quote on the table, or a rough guess that says so. */
export const BuilderMoneyLine: React.FC<LineProps> = ({ gameServices, playerId, palette: p }) => {
  const player = gameServices.stateService.getPlayer(playerId);
  const rules = getBuilderRules();
  if (!player || player.contractor || !rules.noteSpaces.includes(player.currentSpace)) return null;

  const quote = cheapestLiveBid(player.builderBids, player.timeSpent);
  let text: string;
  if (quote) {
    const set = player.builderBids!;
    const bid = set.bids.filter((b) => isBidLive(b, player.timeSpent)).reduce((a, b) => (b.price < a.price ? b : a));
    text = BUILDER_BIDS.bankQuote(money(quote.price), quote.days, bid.expiresDay, player.timeSpent);
  } else {
    const workCost = gameServices.gameRulesService.calculateTotalWorkCost(playerId);
    if (workCost <= 0) return null;
    text = BUILDER_BIDS.bankLikely(money(typicalQuote(workCost)));
  }
  return (
    <div data-testid="bank-bid-line" style={{ fontSize: 12, margin: '6px 0', padding: '6px 9px', background: p.surf, border: `1px solid ${p.border}`, borderRadius: 8, color: p.text }}>
      {text}
    </div>
  );
};
