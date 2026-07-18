# Next session starter — written 2026-07-18 by /koniec

## State at handoff
- **Version:** v3.1.10 — committed + pushed, **pending deploy** (live is v3.1.8).
- **Branch:** master, clean (only `.claude/settings.local.json` local config uncommitted).
- **Last shipped:** v3.1.9 deleted the orphaned classic-panel dead-code cluster (−2,839 lines: CardModal/CardActions/CardContent/CardsSection/PlayerActionService/showCardModal + `GameState.activeModal`); v3.1.10 fixed the latent N×N card-effect fan-out on manual `playCard` the test migration uncovered (Kid E guard extended to all paths, red-green regression test). Maintainer closed the fb:66bb0bda design call: `canPlayCard` stays type-agnostic (reskin + future card functionality; see TODO "Resolved 2026-07-18").
- **Test suite:** 2386/2388 — 1 pre-existing skip, 1 failure = the documented `E2E-AllPaths.test.ts` scheduling flake (passes 10/10 in isolation).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.1.9 + v3.1.10** — pushed and ready; hand the maintainer the deploy command (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`, from a Windows terminal). Confirm the live bundle version after.
2. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding; the embedded browser can't play animated camera transitions (CLAUDE.md TACTICAL), needs a 2-minute glance at the physical TV.
3. **Dark/light mode coverage beyond `PlayerPanelV2`** — board, `TVDisplay`, `ChoiceModal` still light-only. Scope shrank in v3.1.9: `CardModal` (the other dark-unaware modal) was deleted as dead code.

## Test failures to address
- `tests/E2E-AllPaths.test.ts` — 90s timeout under full-suite load only; documented pre-existing scheduling flake (TODO parking lot), passes clean in isolation. Not a regression.

## Decisions waiting on the user
- **Board layout** — keep the stock grid, or re-arrange in the editor (drag-save persists).
- **Bank/Investor/Lender character naming** — marinading. **Don't nudge.**
- **Homeowner starting scenario / violation mechanic** — needs its own design pass before engineering.
- (fb:66bb0bda is CLOSED as of this session — no longer pending.)

## Suggested first move
Hand over the deploy command for v3.1.9+v3.1.10 first — everything is pushed and verified. Then the real-TV camera check (item 2) can piggyback on the same TV session that verifies the new deploy.

## Suggested model for next session
Sonnet 5 — the top items are a deploy handoff, a manual TV check, and a scoped dark-mode audit; nothing architecturally ambiguous.

## Reminders
- Deploy command runs from a Windows terminal, not WSL.
- If a D&D reskin conversation continues: the load-bearing question is whether the five card families (W/B/E/L/I) keep their *behaviors* under the new theme — see PROJECT_STATUS + the 2026-07-18 session memory entity.
