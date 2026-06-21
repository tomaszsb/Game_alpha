# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 21, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.81** — **committed on master, NOT yet deployed.** Live prod is still the v3.0.80 build (commit `9666140`, all of Phase 4a/4b). v3.0.81 is four post-deploy items waiting on a deploy.

## Current sprint
**2026-06-21 — four post-deploy fixes (v3.0.81), all committed on master, undeployed.** (1) **Validator/engine dice-drift fix** — `validateInsertions` + the catalog decided "is this a dice source?" from `requires_dice_roll`, but the engine routes movement off `die_roll='Next Step'`; a space that only *effect*-rolls (W Cards/Fees) moves along a fixed edge, so splicing onto it was wrongly rejected and the edge wasn't offered. Aligned all three spots to the dice table's `Next Step` rows. (2) **Mobile board-bleed fix** — at phone width the grid collapses to one column but the panel and board both carry inline `gridRow:'2'`, so they overlapped and React-Flow layers bled through the panel; the board is now hidden at ≤768px when a panel is shown. (3) **Expeditor phase indicator** (fb:f8dc7c38) — each expeditor shows a color-coded phase chip and the list sorts by phase, so a player with many filing reps can tell which phase each serves. (4) **Authored-insertion ghost fixture** — the bot bootstrap now takes a CLEAN_FILES dir, so a test bakes a board *with* an authored insertion and runs the ghost (real board + benign space → still winnable; synthetic board + looping dice space → `detectLoops` flags it). Closes the long-standing Phase-4b safety-net gap.

## Health
- **Tests:** targeted koniec sweep (components + utils + services) **1661/1661 green, 95 files**; server suite **250/250**; new ghost fixture **3/3**. Full vitest run was launched but is slow (~25 min ghost gates) — the targeted sweep + server + ghost cover every surface this session touched. Typecheck + build clean.
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.81 is undeployed** — live prod serves v3.0.80 (`9666140`). So the dice-drift and board-bleed fixes are NOT live yet; on prod the splice-onto-a-fixed-edge workaround still applies. Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`; NPM routes domain → 3080; cf-cache is DYNAMIC. **Local-dev:** verify per-instance boards via Express (localhost:3001), not Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.81** — four fixes sit committed+unpushed-to-deploy on master; nothing live changes until `deploy.sh` runs.
2. **Live post-deploy verification of authored spaces** — local walk PASSED; only the **live-prod** walk remains (user driving).
3. **UI redesign — player panel + scoreboard** (deploy-independent; design-team handoff ready). The mobile board-bleed bug is now FIXED; the expeditor feedback folds into this redesign.
