# Next session starter — written 2026-06-22 by /koniec

## State at handoff
- **Version:** v3.0.82 — **committed + pushed to origin/master, pending deploy** (user runs `deploy.sh`). v3.0.81 was deployed live earlier this session (`e85da2c`).
- **Branch:** master. Wrap-up + redesign source committed; tree clean apart from the usual `.claude/settings.local.json` + untracked `.claude/ghost-history.jsonl`.
- **Last shipped:** player-panel **redesign — first build behind an opt-in classic/new toggle** (off by default; normal play untouched). Playable `PlayerPanelV2` (5 zones, real data, reuses classic handlers + `canEndTurn`), light/dark, glossary dark-mode override. Verified live; caught+fixed a dice-effect routing bug.
- **Test suite:** targeted vitest sweep (components/utils/services) **1661/1661 green**. Full suite NOT re-run (change is additive + toggle-gated; typecheck+build are the cross-file guard). Classic panel untouched.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Player-panel redesign — keep building.** Locked spec: [docs/design/player-panel-redesign.md](player-panel-redesign.md is at docs/design/). Done: playable V2 + light/dark + glossary dark, all behind the toggle. **Next increments in order:** optional E-card play from the influence zone → detailed-card + outcome-modal restyle → shared scoreboard ("who" screen, not yet mocked) → later app-wide dark mode + glossary flat-style alignment.
2. **Glossary duplicate-key bug** (pre-existing, surfaced during verification) — opening the dictionary panel logs ~24 React "duplicate key" errors from repeated term ids (`certificate-of-occupancy`, `dcas`, `emissions`, …) in the glossary data. De-dupe the data (or make list keys unique) + add a uniqueness guard. Spawned as a task; also in TODO.
3. **Authored-space live walk (broader).** The dice-drift case was walked live; the full card-draw + %-fee + dice gameplay walk of an authored space in prod still remains (user driving).

## Decisions waiting on the user
- **Make the new panel the default?** Not yet — it's opt-in until confirmed feature-complete (E-card play + modals still to come). Keep the toggle until then.

## Suggested first move
Deploy v3.0.82 if not already done (`ssh unraid …`), then continue the redesign build — **E-card play from the influence zone** is the next increment, after which the new panel can run a full turn end-to-end. Or pick the scoreboard ("who" screen) if you'd rather see all three surfaces before deepening the panel. Which?

## Reminders
- Deploy runs from the **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. After deploy, confirm the start-screen badge shows the new commit + `unravel-codes@3.0.82`.
- New panel is **opt-in**: in the running app, each player panel has a "Try new design" button (top-right) + Dark/Light when on. Off by default.
- Local-dev: the new panel works on Vite (localhost:3000) for normal stock games; per-instance/authored boards still need Express (localhost:3001).
