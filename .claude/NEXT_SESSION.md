# Next session starter — written 2026-09-17 by /koniec (amended 2026-09-18 after v3.2.64)

## State at handoff
- **Version:** v3.2.64 — **PENDING DEPLOY** (pushed 2026-09-18). Live is v3.2.63 (`/health` = `15aae59`). **Run `curl -sS https://game.unravelcodes.com/health` before believing this line.**
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It is Tom's own brief (D&D dual-function constraint + how he wants to be worked with).
- **Last shipped:** v3.2.64 — the three worst copy offenders from the 2026-09-12 playtest, all wording picked by Tom: "helper"/"help" (28 hits) → "team member" across `e_card_label` rows; the Lender's "pound of flesh" idiom (12 hits) → "squeeze you"; "THINGS YOU CAN DO" (10 hits) → "This turn". Also made `PlayerPanelV2`'s commit-caption fallbacks CSV-portable (no wording change). v3.2.63 — named the five approved "My numbers" placeholder strings (fb:adad1561).
- **Test suite (v3.2.64):** full `npx vitest run` — run it before trusting this line, the koniec pass should have a fresh count.
- **Dashboard:** fb:adad1561 flipped resolved 2026-09-18. The three v3.2.64 copy fixes have no individual `fb:` ids (sourced from the playtest report directly, not the dashboard).

## Top 2 open items
1. **Teaching layer: tutorial, micro-lessons, and the voice pass on the 44 `ACTION_TOOLTIPS.csv` rows.** Largest part of Onboarding Phase C. The three worst copy offenders are now fixed (v3.2.64) — this is the next tier down. Never put a glossary term inside an action button.
2. **`docs/user/USER_MANUAL.md` needs an accuracy pass.** Found 2026-09-18: still says "Things you can do" (renamed to "This turn" in v3.2.64) and still shows "What's affecting you" as its own panel zone (removed by the v3.2.62 four-box redesign). Not a one-line fix — needs a real read-through against the current panel. See TODO.md.
3. **Playtest robot: still 0 completions.** The 09-16 Lender Review loop (G-Z5UM-P9ZQ, 14 push-backs in a row) is **harness-side**, verified against server log and code. Tom decided 2026-09-16: the game stays as is. Fix belongs to the Jarvis session. Do not edit `game_playtest.py` from here.
4. **Audit II leftovers ranked in TODO.md** — win condition, closed card-family union. Each is a dedicated session and Tom's call.

## Decisions waiting on the user
- Settled 2026-09-18: three copy replacements ("team member" / "squeeze you" / "This turn") — Tom picked all three from drafted options, no more copy calls pending on this batch.
- Settled 2026-09-18: fb:adad1561 (My numbers placeholders + real-phone look) RESOLVED.
- Settled 2026-09-17: a confirmed swap is NOT undoable (fb:9e31b860 resolved).
- Carried: auto-expand the destination picker? "What's this?" more than `?`? `data-testid` on `RoutingExplanationModal`? Stray CR bytes in `DiceRoll Info.csv` / `CARDS_EXPANDED.csv`? Card library Stage 4.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** Only after Tom confirms the TV reads well across a room.

## Suggested first move
Check `/health` to confirm v3.2.64 deployed, then start the ACTION_TOOLTIPS voice pass or the USER_MANUAL.md accuracy pass.

## Suggested model for next session
Sonnet 5 — scoped copy/UI work with shipped precedent; raise effort to `xhigh` before a bigger model.

## Reminders
- **Vite's watcher can miss an edit**: `curl -s localhost:3000/src/<file> | grep -c <new-id>` before debugging a live check that contradicts the source.
- **Relayed briefs are hypotheses.** Check code and data before acting on one.
- **Edit `public/data/SOURCE_FILES/` and regenerate** (`node scripts/regen-clean-files.mjs`) rather than hand-editing CLEAN_FILES directly — a classroom's `resolved/` re-bakes itself. UI_STRINGS.csv is the one clean-only exception (no SOURCE copy).
- **`npm test` ≠ the full suite** (excludes `tests/ghost/**`). `npx vitest run` runs both (~15 min). Never pipe a backgrounded suite through `tail`.
- **Say which folder AND which session you are in.** Deploy runs from a Windows terminal.
