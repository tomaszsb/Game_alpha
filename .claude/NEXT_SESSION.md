# Next session starter — written 2026-09-17 by /koniec

## State at handoff
- **Version:** v3.2.61 — **LIVE** (`/health` = `f2f81be` = HEAD at 2026-09-17 04:41Z). **Run `curl -sS https://game.unravelcodes.com/health` before believing this line.**
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It is Tom's own brief (D&D dual-function constraint + how he wants to be worked with).
- **Last shipped:** v3.2.61 — 8 of 10 untriaged reviewer reports: swap picker choose buttons, Out/In swap result, "optional" tag, board shows picked/pointed-at destination, whole-screen dark mode (one shared setting, toggle in the tracker), bug-report screenshots keep panel modals.
- **Test suite:** `npx vitest run` **3201/3201 across 223 files**; typecheck ✅, build ✅, lint no new warnings.
- **Dashboard:** 9 open (was 17). The 8 v3.2.61 fixes are already flipped resolved.

## Top 3 open items
1. **Teaching layer: tutorial, micro-lessons, and the voice pass on the 44 `ACTION_TOOLTIPS.csv` rows.** Largest part of Onboarding Phase C. Fold in "helper" jargon, the Banker's "pound of flesh" idiom (27 robot hits on 09-16), and fb:adad1561's "What's affecting you" wording. Never put a glossary term inside an action button.
2. **Playtest robot: still 0 completions.** The 09-16 Lender Review loop (G-Z5UM-P9ZQ, 14 push-backs in a row) is **harness-side**, verified against server log and code: the harness drops non-actionable controls, so the model never reads "Finish 'Bring in extra help' above first" or the tap-revealed cost. Tom decided 2026-09-16: the game stays as is. Fix belongs to the Jarvis session. Do not edit `game_playtest.py` from here.
3. **Audit II leftovers ranked in TODO.md** — win condition, closed card-family union. Each is a dedicated session and Tom's call.

## Decisions waiting on the user
- **fb:9e31b860 — undo a swap after confirming it?** It would let a player peek at the random draw and take it back. The picker already switches before confirming.
- **fb:adad1561 — reword "What's affecting you" per source** (expeditor called / something in the news). Voice copy.
- Carried: auto-expand the destination picker when picking is the only thing left? "What's this?" more than a bare `?`? `data-testid` on `RoutingExplanationModal`? Stray CR bytes in `DiceRoll Info.csv` / `CARDS_EXPANDED.csv`? Card library Stage 4.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** Only after Tom confirms the TV reads well across a room.

## Suggested first move
Check `/health`, then start the teaching layer's tooltip voice pass. Want the two design calls above settled first?

## Suggested model for next session
Sonnet 5 — scoped copy/UI work with shipped precedent; raise effort to `xhigh` before a bigger model.

## Reminders
- **Vite's watcher can miss an edit** (bit this session): `curl -s localhost:3000/src/<file> | grep -c <new-id>` before debugging a live check that contradicts the source.
- **Relayed briefs are hypotheses.** Check code and data before acting on one.
- **Edit `public/data/` only;** a classroom's `resolved/` re-bakes itself. UI_STRINGS is clean-only.
- **`npm test` ≠ the full suite** (excludes `tests/ghost/**`). `npx vitest run` runs both (~15 min). Never pipe a backgrounded suite through `tail`.
- **Say which folder AND which session you are in.** Deploy runs from a Windows terminal.
