# Next session starter — written 2026-06-20 by /koniec (updated post-merge/deploy)

## State at handoff
- **Version:** v3.0.80 — **deployed + live, commit `9666140`** (maintainer confirmed the start-screen badge `9666140 ✓` = in sync with origin). No package version bump this session (Phase 4 ships invisible until a teacher authors a space).
- **Branch:** **`phase-4a-card-insertion` MERGED → master (fast-forward), pushed, deployed.** master = origin/master = live = `9666140`, clean. (Branch ref still exists; fine to delete.)
- **This session:** built **all of Phase 4b** (4 slices) — authored spaces can splice onto dice/choice edges, deal cards, be a dice roll (per-face), and charge fees (flat / % of loans / % of scope). Verified the bake against **real stock** (19/19 checks, covers all four 4a bug classes). Merged → master, pushed, **deployed live**. Also: README → self-maintaining pointer, monthly-maintenance step added to `/start`, untracked 3.3 MB of dashboard-screenshot bloat.
- **Test suite:** full gate green at last run (~2166 pass / 1 skip) modulo 3 **confirmed-flaky** env failures (Windows `rmdir` race on a bake test + 2 E2E timeouts under load) — all pass in isolation. **Typecheck + build clean.**
- **Deploy safety CONFIRMED:** the deploy preserved `game-data` (instances survived) — the v3.0.77 deploy.sh fix is real. Teacher customization (incl. authored spaces) survives deploys by construction. The old "deploy.sh wipe blocker" is **resolved/stale** — do not re-flag it.

## Top 3 open items
1. **Live post-deploy verification** — author a space in the live app (Admin Tools → 🏫 Classroom Setup), bake a game, walk through it. The deterministic bake check is green; this is the last "see it work in the real running app" step (the kind that caught 4a's bugs).
2. **UI redesign — player panel + scoreboard** (design-team package ready: `.claude/player-dashboard-*.md` + local screenshots) + the mobile board-bleed-through bug.
3. **Authored-insertion ghost fixture** (deferred) — the bot can't yet stress-test instance boards for unwinnable loops; the safety net before teachers author spaces at scale.

## Decisions waiting on the user
- **Authored scope fees + the 20% cap** — shipped *not* tied to the design-fee game-over cap (safety: no teacher-made instant-loss spaces). Re-open only if you want authored fees to count toward that cap.

## Suggested first move
Phase 4 is live. Strongest next move: **walk an authored space in the live app** to close the loop (author one with a dice roll + card + % fee, play through it) — or pick up the deploy-independent **UI redesign / mobile board-bleed bug**. Which appeals?

## Reminders
- Deploy runs from the **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- **Verify per-instance/classroom boards via Express (`localhost:3001`), NOT Vite (`localhost:3000`)** — Vite serves `/data` from `public/` (stock). (CLAUDE.md TACTICAL.)
- Authored-space bake gotchas (curated DICE_OUTCOMES is load-bearing; fees map by Fee string; re-run typecheck after JSDoc-param tests) are in CLAUDE.md TACTICAL.
- First session of **July** → `/start` now runs a monthly README + TODO-drift check (new this session).
