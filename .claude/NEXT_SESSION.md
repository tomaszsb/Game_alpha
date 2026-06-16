# Next session starter — written 2026-06-16 by /koniec

## State at handoff
- **Version:** v3.0.80 (no new version this session). Live deploy of v3.0.80 was user-driven at session start — **confirm the live header reads v3.0.80** (I never verified).
- **Branch:** ⚠️ still on **`phase-4a-card-insertion`**, not master. 3 code/doc commits + this wrap-up. **Not merged, not pushed, not deployed.** master clean.
- **This session (2 blocks):** (1) built **Phase 4a card insertion** end-to-end (engine + endpoints + UI + LOOP gate; 4c/4d cut). (2) Built a **UI-redesign handoff package** for the design team (no code).
- **Test suite:** 1658 components/utils/services + 226 server + 6 ghost-LOOP — all green (from this session; no code changed since). **Build/typecheck:** clean.

## Top 3 open items
1. **UI redesign — player panel + scoreboard** (user + design team). Handoff ready: `.claude/player-dashboard-variables.md`, `.claude/player-dashboard-context.md`, `UI-screenshots.pdf` (20p), `modal-inventory.pdf` (5p). Scope/constraints confirmed (panel primary + scoreboard; HARD no-scroll on both surfaces; not a ranked race). See TODO "UI redesign" for the one open design tension.
2. **Verify Phase 4a in-app, then decide merge** — UI components are build-verified only. Walk the teacher flow locally (Add a space → pick edge → save → tile routes A→N→B) before merging the branch to master.
3. **Mobile board-bleed-through bug** (found this session) + **`deploy.sh` instances-wipe** — both block Phase 4a going live cleanly. The bleed-through is independently fixable (panel needs opaque bg). See TODO.

## Decisions waiting on the user
- Merge `phase-4a-card-insertion` → master now, or keep iterating (then 4b)?
- Scoreboard "who's ahead" framing — confirm the reconciliation (soft positional standings, not a hard leaderboard).

## Suggested first move
Pick the track: **UI redesign** (deploy-independent, handoff package is ready to hand the design team) or **verify + merge Phase 4a** (needs the deploy-wipe confirmed before it can go live)? The redesign is the lower-friction start.

## Reminders
- Deploy runs from the **Windows terminal**, not WSL.
- You're on a **feature branch** — `git checkout phase-4a-card-insertion` if a fresh shell lands on master. Nothing pushed; local-only.
- Modal/screenshot artifacts (`*.pdf`, `modal-*.png`, `dashboard-*.png`) sit **uncommitted** at root + `.claude/` — deliverables for the design team, not committed (binaries). Throwaway live game G374 was left mid-state (harmless).
