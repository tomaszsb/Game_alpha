# Next session starter — written 2026-06-20 by /koniec

## State at handoff
- **Version:** v3.0.80 — **deployed + live** (maintainer confirmed `bbbd984`). No new version this session.
- **Branch:** ⚠️ on **`phase-4a-card-insertion`** — all of Phase 4a **and** Phase 4b. **NOT merged/pushed/deployed** (on-branch by standing decision). master clean.
- **This session:** built **all of Phase 4b** (4 slices) — authored spaces can splice onto dice/choice edges, deal cards, be a dice roll (per-face), and charge fees (flat / % of loans / % of scope). Also rewrote README → self-maintaining pointer + added a monthly-maintenance step to `/start`.
- **Test suite:** full gate green at last run (~2166 pass / 1 skip) modulo 3 **confirmed-flaky** env failures (Windows `rmdir` race on a bake test + 2 E2E timeouts under load) — all pass in isolation. **Typecheck + build clean.**

## Top 3 open items
1. **`deploy.sh` instances-wipe** — hard blocker: no teacher customization (any of Phase 4) survives a deploy until fixed. See TODO "Deploy infrastructure". (v3.0.80 itself is already live.)
2. **Merge `phase-4a-card-insertion` → master** — branch now holds all of Phase 4a + 4b; clean fast-forward (branch = master + the Phase-4 commits, nothing diverged). Decide when.
3. **UI redesign — player panel + scoreboard** (deploy-independent, design-team package ready) + the mobile board-bleed-through bug. Plus the deferred authored-insertion ghost fixture.

## Decisions waiting on the user
- **Merge timing** — keep on-branch, or merge Phase 4 to master now? (Nothing deploys until `deploy.sh` is fixed regardless.)
- **Authored scope fees + the 20% cap** — shipped *not* tied to the design-fee game-over cap (safety: no teacher-made instant-loss spaces). Re-open only if you want authored fees to count toward that cap.

## Suggested first move
Phase 4b is done and committed; the natural next move is unblocking it for live use — **fix the `deploy.sh` instances-wipe** so teacher customization survives a deploy (the one hard prerequisite for any of Phase 4 reaching players). Or: merge Phase 4 → master first? Or pick up the deploy-independent UI redesign / mobile board-bleed bug.

## Reminders
- Deploy runs from the **Windows terminal**, not WSL. You're on branch `phase-4a-card-insertion` — `/koniec` did NOT push (branch is local by design).
- **Verify per-instance/classroom boards via Express (`localhost:3001`), NOT Vite (`localhost:3000`)** — Vite serves `/data` from `public/` (stock). (CLAUDE.md TACTICAL.)
- Authored-space bake gotchas (curated DICE_OUTCOMES is load-bearing; fees map by Fee string; re-run typecheck after JSDoc-param tests) are in CLAUDE.md TACTICAL.
- First session of **July** → `/start` now runs a monthly README + TODO-drift check (new this session).
