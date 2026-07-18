# Next session starter — written 2026-07-18 by /koniec

## State at handoff
- **Version:** v3.1.10 — **deployed, confirmed live** 2026-07-18 (live bundle embeds 3.1.10 + commit 2adf193).
- **Branch:** master, clean (only `.claude/settings.local.json` local config uncommitted).
- **Last shipped:** v3.1.9 deleted the orphaned classic-panel dead-code cluster (−2,839 lines: CardModal/CardActions/CardContent/CardsSection/PlayerActionService/showCardModal + `GameState.activeModal`); v3.1.10 fixed the latent N×N card-effect fan-out on manual `playCard` the test migration uncovered (Kid E guard extended to all paths, red-green regression test). Maintainer closed the fb:66bb0bda design call: `canPlayCard` stays type-agnostic (reskin + future card functionality; see TODO "Resolved 2026-07-18").
- **Test suite:** 2386/2388 — 1 pre-existing skip, 1 failure = the documented `E2E-AllPaths.test.ts` scheduling flake (passes 10/10 in isolation).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding; the embedded browser can't play animated camera transitions (CLAUDE.md TACTICAL), needs a 2-minute glance at the physical TV (v3.1.10 is live, so the TV session doubles as a deploy sanity check).
2. **Dark/light mode coverage beyond `PlayerPanelV2`** — board, `TVDisplay`, `ChoiceModal` still light-only. Scope shrank in v3.1.9: `CardModal` (the other dark-unaware modal) was deleted as dead code.
3. **Playtester acquisition + dashboard `version`/`gitCommit` display** — standing actives from TODO.

## Test failures to address
- `tests/E2E-AllPaths.test.ts` — 90s timeout under full-suite load only; documented pre-existing scheduling flake (TODO parking lot), passes clean in isolation. Not a regression.

## Decisions waiting on the user
- **Board layout** — keep the stock grid, or re-arrange in the editor (drag-save persists).
- **Bank/Investor/Lender character naming** — marinading. **Don't nudge.**
- **Homeowner starting scenario / violation mechanic** — needs its own design pass before engineering.
- (fb:66bb0bda is CLOSED as of this session — no longer pending.)

## Suggested first move
Everything through v3.1.10 is live — no deploy pending. The real-TV camera check (item 1) just needs 2 minutes with the physical TV; otherwise the dark-mode audit (item 2) is the meatiest scoped work available.

## Suggested model for next session
Sonnet 5 — the top items are a deploy handoff, a manual TV check, and a scoped dark-mode audit; nothing architecturally ambiguous.

## Reminders
- Deploy command runs from a Windows terminal, not WSL.
- If a D&D reskin conversation continues: the load-bearing question is whether the five card families (W/B/E/L/I) keep their *behaviors* under the new theme — see PROJECT_STATUS + the 2026-07-18 session memory entity.
