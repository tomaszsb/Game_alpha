# Next session starter — written 2026-06-23 by /koniec

## State at handoff
- **Version:** v3.0.83 — **deployed live 2026-06-23 (commit `e4d956b`), badge confirmed by the user.** All this session's work ships behind opt-in toggles/overlays, so live default behaviour is unchanged.
- **Branch:** master, clean apart from the usual `.claude/settings.local.json` + untracked `.claude/ghost-history.jsonl`. Wrap-up committed + pushed.
- **Last shipped:** three more player-panel redesign increments — **E-card play** from the influence zone, the **detailed-card view** (PlayerCardDetailV2), and the **scoreboard "who" screen** now wired into the live TV as an opt-in "📊 Standings" overlay. Plus a card-detail tweak hiding the systematic "Apply Card" placeholder.
- **Test suite:** **full vitest green — 2190 passed / 1 skipped** (incl. the ghost gate). +14 new tests.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Player-panel redesign — continue.** It can run a full turn end-to-end now (opt-in). **Next increment: the outcome-modal (before→after) restyle — DEFERRED** (user call, option a) because `DiceResultModal` is a SHARED live-turn modal, not toggle-isolated; do it once the new panel is closer to becoming the default. Then app-wide dark mode + glossary flat-style alignment.
2. **Decision pending — make the new panel the default?** Still opt-in (the "Try new design" toggle). Keep it until the maintainer confirms feature-complete.
3. **Change-legibility / companion / time-feel UX initiative** — a reviewed external spec, now a TODO section (P1 Project Chronicle → P5 a11y) + design-doc §10. P1 (Chronicle = event-first upgrade of the Log tab on `globalActionLog`) is the natural first build if pursued. Plus: optional `effects_on_play` prose for the 74 E + 49 L cards (low), and the pre-existing glossary duplicate-key bug (spawned task).

## Decisions waiting on the user
- **Make the new panel the default yet?** (still opt-in until confirmed feature-complete)
- **Start the change-legibility UX initiative (P1 Chronicle), continue the panel polish, or something else?**

## Suggested first move
Ask the maintainer which thread to pull: continue the redesign (the deferred outcome-modal restyle is the next panel piece), kick off the change-legibility UX P1 (Chronicle), or flip the new panel toward default after a fuller play-through? The redesign now plays a full turn, so "is it default-ready?" is a real question to put to them.

## Reminders
- Deploy runs from the **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. Confirm the start-screen badge shows the new commit + `unravel-codes@X.Y.Z`.
- **Local browser verify needs BOTH servers:** start Express (`npm run server`, 3001) first, then let the preview MCP own Vite (3000); Vite-only → red "Couldn't start a new game". Don't start Vite by hand (port fight). See auto-memory `project_local_app_start`.
- Preview `preview_screenshot` reliably times out while any fixed overlay/modal is open — use `preview_eval` DOM checks as the evidence instead.
