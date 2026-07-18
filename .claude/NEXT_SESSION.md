# Next session starter — written 2026-07-18 by /koniec (deploy confirmed after wrap-up)

## State at handoff
- **Version:** v3.1.8 — **deployed, confirmed live** 2026-07-18 (bundle hash `index-CyJDO-6t.js` matches the local v3.1.8 build exactly).
- **Branch:** master, clean.
- **Last shipped:** domain-event stage 4 (final planned stage) — moved emitter ownership into `ApprovalService`/`FinancialEffectHandler`/`CardService`; fixed a real bug where bankruptcy/design-fee-cap losses rendered a toast literally saying "Received: undefined"; gave the WIN ending its first-ever toast/log/TV announcement. v3.1.5–v3.1.8 all shipped in this one deploy.
- **Test suite:** 2427/2429 passing, 1 pre-existing skip, 1 failure (`E2E-AllPaths.test.ts` — documented pre-existing scheduling flake, confirmed non-regression via 2 isolated reruns).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Delete the orphaned dead-code cluster** — `CardModal.tsx`, `CardActions.tsx`, `CardsSection.tsx`+`.css`, `PlayerActionService.playCard()`, `StateService.showCardModal()`. Audited 2026-07-17: `showCardModal` (the only trigger for `CardModal`) has zero callers anywhere in `src/` — leftover from the v3.0.128-137 classic-panel removal. Contains a real but unreachable bug (see TODO.md); safe, cheap cleanup, ready to execute.
2. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding. The embedded browser here can't play animated camera transitions at all (see CLAUDE.md TACTICAL), so this needs an actual glance on the maintainer's TV, not more automated testing.
3. **Dark/light mode coverage beyond `PlayerPanelV2`** — the board itself and at least `ChoiceModal`/`CardModal` still render light-only regardless of the toggle (maintainer request 2026-07-14, TODO.md has the scoped audit questions).

## Test failures to address
- `tests/E2E-AllPaths.test.ts > REG-FDNY-FEE-REVIEW Branches > Path: REG-FDNY → PM-DECISION-CHECK (back to planning)` — 60s timeout on `setupGame()`. Pre-existing documented flake (TODO.md), confirmed non-deterministic (fails on a different sub-test each run under full-suite load, passes clean in isolation). Not a regression.

## Decisions waiting on the user
- **Board layout** — keep the stock grid, or re-arrange in the editor (drag-save persists now).
- **Bank/Investor/Lender character naming** — user is marinading. Don't nudge.
- **Homeowner starting scenario / distinct violation mechanic** — needs its own design pass before engineering (starting-space swap itself is cheap, the mechanic isn't designed yet).

## Suggested first move
No deploy is pending, so pick up whichever top item fits the time available: the dead-code cleanup is a clean, self-contained, low-risk task with zero open questions; the real-TV check just needs 2 minutes with the physical TV.

## Suggested model for next session
Sonnet 5 — the top items are routine (a well-audited dead-code deletion, a manual TV check, a scoped dark-mode audit) with no architecturally ambiguous judgment calls needed.

## Reminders
- Deploy command runs from a Windows terminal, not WSL.
- Everything through v3.1.8 is now live — no undeployed backlog going into next session.
