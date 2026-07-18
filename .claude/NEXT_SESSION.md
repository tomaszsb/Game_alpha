# Next session starter — written 2026-07-17 by /koniec

## State at handoff
- **Version:** v3.1.8 (committed + pushed, **pending deploy**). Live = v3.1.4.
- **Branch:** master, clean (nothing uncommitted after this wrap-up).
- **Last shipped:** domain-event stage 4 (final planned stage) — moved emitter ownership into `ApprovalService`/`FinancialEffectHandler`/`CardService`; fixed a real bug where bankruptcy/design-fee-cap losses rendered a toast literally saying "Received: undefined"; gave the WIN ending its first-ever toast/log/TV announcement.
- **Test suite:** 2427/2429 passing, 1 pre-existing skip, 1 failure (`E2E-AllPaths.test.ts` — documented pre-existing scheduling flake, confirmed non-regression via 2 isolated reruns).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.1.5–v3.1.8** — 4 versions sitting committed/pushed, undeployed. No urgency, but the bankruptcy/win-toast bug fix (v3.1.8) is worth getting live. Hand the user: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
2. **Delete the orphaned dead-code cluster** — `CardModal.tsx`, `CardActions.tsx`, `CardsSection.tsx`+`.css`, `PlayerActionService.playCard()`, `StateService.showCardModal()`. Audited this session: `showCardModal` (the only trigger for `CardModal`) has zero callers anywhere in `src/` — leftover from the v3.0.128-137 classic-panel removal. Contains a real but unreachable bug (see TODO.md); safe, cheap cleanup.
3. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding. The embedded browser here can't play animated camera transitions at all (see CLAUDE.md TACTICAL), so this needs an actual glance on the maintainer's TV, not more automated testing.

## Test failures to address
- `tests/E2E-AllPaths.test.ts > REG-FDNY-FEE-REVIEW Branches > Path: REG-FDNY → PM-DECISION-CHECK (back to planning)` — 60s timeout on `setupGame()`. Pre-existing documented flake (TODO.md), confirmed non-deterministic (fails on a different sub-test each run under full-suite load, passes clean in isolation). Not a regression.

## Decisions waiting on the user
- **Board layout** — keep the stock grid, or re-arrange in the editor (drag-save persists now).
- **Bank/Investor/Lender character naming** — user is marinading. Don't nudge.
- **Homeowner starting scenario / distinct violation mechanic** — needs its own design pass before engineering (starting-space swap itself is cheap, the mechanic isn't designed yet).

## Suggested first move
Ask whether to deploy v3.1.5–v3.1.8 now (bundles 4 versions of internal refactor + the bankruptcy/win-toast bug fix, all currently invisible to players) before starting new work — it's been sitting pending for a full session's worth of stacked changes. If deploy isn't wanted yet, the dead-code cleanup (item 2 above) is a clean, low-risk next task with zero open questions.

## Suggested model for next session
Sonnet 5 — the top items are routine (deploy handoff, a well-audited dead-code deletion, a manual TV check) with no architecturally ambiguous judgment calls needed.

## Reminders
- Deploy command runs from a Windows terminal, not WSL.
- 4 versions (v3.1.5–v3.1.8) are bundled pending deploy — after deploying, confirm the live bundle's version string reads 3.1.8, not a stale intermediate.
