# Next session starter — written 2026-06-27 by /koniec

## State at handoff
- **Version:** v3.0.86 — **deployed live (commit `6e017d7`).** No new release this session.
- **Branch:** master. This was a **tooling/process session, no version shipped.** Wrap-up committed + pushed; clean apart from the usual `.claude/settings.local.json` + untracked `.claude/ghost-history.jsonl`.
- **Last shipped (unchanged):** v3.0.86 — between-turns move popup, "📋 My numbers", "📜 History" Chronicle first slice (all opt-in new panel).
- **This session:** (1) restructured `/start` + `/koniec` (see Reminders — `/start` behaves differently now); (2) 4 TODO housekeeping items — npm audit cleared (js-yaml, dev-only), E2E flaky-hang fixed, version-badge drift removed, recover-board.mjs verified already gone.
- **Test suite:** typecheck + build clean; targeted sweep (components/utils/services) **1714/1714 green**; the previously-flaky `E2E-LogicPlaythrough` now **15/15** after the choice-pump fix.

## Top 3 open items
1. **Decision — make the new panel the default?** Pile 2 + Pile 3 closed the gap (recall modals, phase-correct Activate); the classic/new toggle stays until the maintainer says flip it. The big call.
2. **Fuller Project Chronicle (TODO P2–P5).** Only the readable-history first slice shipped. Remaining: inline ▲/▼ deltas, click-an-entry-to-replay-highlight, TV-persistent feed via `NotificationService`, tiered work cards, time-feel, a11y pass.
3. **Cluster B leftovers.** Two new-panel reports open: fb:31e5c4b8 ("effect applied but nothing changed / a roll should say what it determined") and fb:76fa69c7 ("can't see details to pick which expeditor to replace"). Plus deferred outcome-modal restyle, glossary duplicate-key bug (spawned task_37088946).

## Test failures to address
Green — the one known flake (E2E hang) was fixed this session.

## Decisions waiting on the user
- **Make the new panel the default yet?** (Top-3 #1)

## Suggested first move
Ask the maintainer: flip the new panel to default, build out the fuller Chronicle (P2–P5), or clear the Cluster B leftovers? Note `/start` will only sweep dashboard feedback automatically once it's a new month (it's June→still June) — run `/start full` to force a fresh feedback pull.

## Reminders
- **`/start` is now auto-sizing.** Light briefing every session; the heavy feedback sweep + README/TODO drift fire only on the first session of a new month, or on `/start full`. The monthly gate reads the `written YYYY-MM-DD` date on line 1 of THIS file — keep it accurate.
- **Commit + push BEFORE handing over the deploy command.** `deploy.sh` does `git pull origin master` then stamps the badge from HEAD. Deploy from the **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- **Local browser verify needs BOTH servers:** Express (`npm run server`, 3001) + the preview MCP's Vite (3000).
