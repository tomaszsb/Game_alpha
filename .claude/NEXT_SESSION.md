# Next session starter — written 2026-06-21 by /koniec

## State at handoff
- **Version:** v3.0.81 — **committed on master, NOT deployed.** Live prod is still v3.0.80 (`9666140`). Pushed to origin? **NO — push pending** (see step below / wrap line).
- **Branch:** master, clean (only `.claude/settings.local.json` + untracked `.claude/ghost-history.jsonl`).
- **Last shipped:** four post-deploy fixes — validator dice-drift fix, mobile board-bleed fix, expeditor phase chips+sort (fb:f8dc7c38), authored-insertion ghost fixture.
- **Test suite:** targeted sweep **1661/1661** (components+utils+services) + server **250/250** + new ghost fixture **3/3**, all green. Full vitest run is slow (~25 min ghost gates) — launched but not confirmed end-to-end; pre-existing flakies: 3 (Windows rmdir race + 2 E2E timeouts, green in isolation).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.0.81** — four fixes are committed on master; nothing live changes until `deploy.sh` runs. The dice-drift + board-bleed fixes are NOT live yet (prod workaround: splice onto a truly-fixed edge like `FUND→PM`).
2. **Live post-deploy walk of authored spaces** — local walk PASSED; only the live-prod walk remains (user driving it themselves).
3. **UI redesign — player panel + scoreboard** (deploy-independent; design handoff ready). The mobile board-bleed bug is now FIXED; the expeditor feedback folds into this redesign.

## Decisions waiting on the user
- **Mobile shared-screen board:** v3.0.81 *hides* the board at phone width (it was illegible + bleeding through). If you'd rather it stack below the panel (reintroduces scroll), say so — current call is hide.
- **Authored scope fees + the 20% game-over cap** — still shipped *not* tied to the cap (no teacher-made instant-loss spaces). Re-open only if you want that changed.

## Suggested first move
Deploy v3.0.81 (push origin first, then `ssh unraid …`), then do the live-prod authored-space walk to close the last Phase-4 verification — or, if you'd rather build, jump straight to the deploy-independent UI redesign. Which appeals?

## Reminders
- **Push before deploy** — `deploy.sh` builds from pushed code only. Confirm `git log origin/master..master` is empty first. Deploy runs from the **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- After deploy, confirm the start-screen badge shows the new commit, and that the build log's `unravel-codes@3.0.81` matches.
