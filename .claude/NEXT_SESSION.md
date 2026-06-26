# Next session starter — written 2026-06-26 by /koniec

## State at handoff
- **Version:** v3.0.86 — **deployed live 2026-06-26 (commit `6e017d7`), badge confirmed by the user.** Shipped together with v3.0.85 (`de5c363`).
- **Branch:** master, clean apart from the usual `.claude/settings.local.json` + untracked `.claude/ghost-history.jsonl`. Wrap-up committed + pushed.
- **Last shipped:** Pile 2 (v3.0.85 — action icons, first-visit glow, ✓ traces, reversible move-picks; + expeditor phase-gate correctness fix; + SETUP→OWNER relabel; + the held 2026-06-25 fixes) and Pile 3 (v3.0.86 — between-turns move popup, "📋 My numbers" recall modal, "📜 History" Chronicle first slice). All new-panel work is behind the opt-in toggle.
- **Test suite:** typecheck + build clean; targeted sweep (components/utils/services) **1714/1714 green** (+~24 new). Full vitest not run clean end-to-end — see below.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Decision — make the new panel the default?** Pile 2 + Pile 3 are done, so the new panel now matches *and exceeds* the classic panel (recall modals, phase-correct Activate). The classic/new toggle stays until the maintainer says flip it. This is the big call.
2. **Fuller Project Chronicle (TODO P2–P5).** This session shipped the readable-history *first slice* only. Remaining: inline ▲/▼ deltas on the figures, click-an-entry-to-replay-its-highlight, a TV-persistent feed via `NotificationService`, tiered work cards, time-feel, a11y pass.
3. **Cluster B leftovers + low-pri.** Two new-panel reports unaddressed: fb:31e5c4b8 ("effect applied but nothing changed / a roll should say what it determined") and fb:76fa69c7 ("can't see details to pick which expeditor to replace"). Plus: deferred outcome-modal restyle, optional E/L `effects_on_play` prose, glossary duplicate-key bug.

## Test failures to address
(Not a regression — a test flake.)
- `tests/E2E-LogicPlaythrough.test.ts > should complete a full game…` — intermittent 60s **hang** (~1-in-3; passes 5/5 on clean re-run). Async race in the *test* (`setTimeout(10)` + `resolveChoice`), not the engine. Tracked in TODO (Build/dependency housekeeping). Don't mistake a full-suite red on it for a real break.

## Decisions waiting on the user
- **Make the new panel the default yet?** (see Top-3 #1)

## Suggested first move
Ask the maintainer: flip the new panel to default now that Pile 2 + Pile 3 have closed the gap, build out the fuller Chronicle (P2–P5), or clear the Cluster B leftovers? Or run `/start` to sweep any fresh dashboard feedback first.

## Reminders
- **Commit + push BEFORE handing over the deploy command.** `deploy.sh` does `git pull origin master` then stamps the badge from HEAD. Deploy from the **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`; confirm the badge shows the new commit.
- **Local browser verify needs BOTH servers:** Express (`npm run server`, 3001) + the preview MCP's Vite (3000). The opt-in new panel persists its "Try new design" toggle. Note: `preview_screenshot` intermittently times out on ModalBase overlays — `preview_eval` reading the modal's text is the reliable fallback.
