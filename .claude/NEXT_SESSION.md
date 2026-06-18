# Next session starter — written 2026-06-18 by /koniec

## State at handoff
- **Version:** v3.0.80 (no new version this session). Live still serves **v3.0.78** — v3.0.79/80 pending deploy.
- **Branch:** ⚠️ on **`phase-4a-card-insertion`** (this session's 4a fixes = commit `af3e5f6`). **NOT merged/pushed/deployed.** master clean.
- **This session:** **verified Phase 4a in the running game** (user call: verify before building 4b) → found + fixed **4 real bugs** the build-only tests missed (lowercase-id soft-lock; resolver clone-and-blank behavioral leak; tile position overlap; label OK). 4a is now genuinely usable; routing + tile render confirmed end-to-end. Did NOT start 4b.
- **Test suite:** 227 server + 1658 component/util/service — all green. **Build/typecheck:** clean.

## Top 3 open items
1. **4b slice 1 — fork-splice** (splice authored stops onto choice/dice edges). **Full plan in `.claude/plans/replicated-baking-hoare.md`.** Key: plain **choice** edges ALREADY work (catalog enumerates non-dice multi-dest edges, resolver rewrites `space_N`) — the genuinely-new work is the **dice** case (catalog must enumerate dice-table edges; validation allow them + reject path-choice lock-point edges; resolver rewrite the dice roll columns).
2. **`deploy.sh` instances-wipe** — hard blocker: no teacher customization (incl. Phase 4a) survives a deploy until fixed. Plus v3.0.79/80 still need deploying. See TODO "Deploy infrastructure".
3. **UI redesign — player panel + scoreboard** (deploy-independent, design-team handoff package ready) + the mobile board-bleed-through bug.

## Decisions waiting on the user
- **Merge `phase-4a-card-insertion` → master** — when? (kept local through 4b so far, per prior handoffs.)
- 4b scope: **sliced** (decided 2026-06-18) — fork-splice → card-draws → dice-outcomes → percentage-fees.

## Suggested first move
Start **4b slice 1 (fork-splice)** on the branch — the plan is written and 4a underneath it is now solid. The dice-edge case is the real work; confirm the choice-edge case already works first (quick), then build the dice path. Or: does the maintainer want to merge 4a → master before stacking 4b on it?

## Reminders
- Deploy runs from the **Windows terminal**, not WSL. You're on branch `phase-4a-card-insertion`.
- **Verify per-instance/classroom boards via Express (`localhost:3001`), NOT Vite (`localhost:3000`)** — Vite serves `/data` from `public/` (stock); only Express serves the baked classroom board. Cost ~1hr this session. (CLAUDE.md TACTICAL has this + the Windows resolved-dir EPERM bake note + the authored-id-uppercase rule.)
