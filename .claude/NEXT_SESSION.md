# Next session starter — written 2026-06-16 by /koniec

## State at handoff
- **Version:** v3.0.80 (last shipped). **No new version this session.** User was deploying v3.0.80 at session start — deploy completion **unverified by me** (confirm live header reads v3.0.80).
- **Branch:** ⚠️ **on `phase-4a-card-insertion`**, not master. 3 commits (design, implementation, koniec wrap-up). **Not merged, not pushed, not deployed.** master is clean.
- **Last built:** Phase 4a (card insertion) end-to-end — teacher-authored narrative spaces on an edge: engine + endpoints (+409 concurrency) + catalog UI + LOOP ghost gate. Tiers 4c/4d CUT.
- **Test suite:** all green — 1658 components/utils/services + 226 server + 6 ghost-LOOP units. Smart-bot gate 50/50 with detectLoops armed.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Verify Phase 4a in-app, then decide merge** — the two UI components are build-verified only (no behavior tests). Walk the teacher flow locally (Add a space → pick edge → save → see the tile route A→N→B) before merging `phase-4a-card-insertion` → master.
2. **Player dashboard redesign** (the user's explicit next-day ask) — full variables reference ready at `.claude/player-dashboard-variables.md`. Independent of Phase 4a.
3. **`deploy.sh` instances-wipe is the live blocker for Phase 4a** — authored spaces won't survive a deploy until it's fixed (already DONE in repo v3.0.77 per TODO, but ⚠️ *not yet deployed* — verify it actually shipped before relying on it).

## Decisions waiting on the user
- Merge Phase 4a branch to master now, or keep iterating (then 4b)?
- Fix/confirm the deploy.sh-wipe is live before deploying Phase 4a (hard prerequisite).

## Suggested first move
Want to start by **verifying Phase 4a in the local app** (I can launch it and screenshot the Add-a-space flow), or jump straight into the **player dashboard redesign** using the variables reference? The dashboard work is deploy-independent; Phase 4a needs the deploy-wipe confirmed before it can go live.

## Reminders
- Deploy runs from the **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- You're on a **feature branch** — `git checkout phase-4a-card-insertion` if a fresh shell lands on master. Nothing is pushed; work is local-only until you choose to push.
- Phase 4a authored spaces ride `display_label_override` (real Spaces.csv has the column; confirmed).
