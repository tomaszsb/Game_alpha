# Next session starter — written 2026-09-17 by /koniec (amended 2026-09-18 after v3.2.63)

## State at handoff
- **Version:** v3.2.63 — **PENDING DEPLOY** (pushed 2026-09-18). Live is v3.2.62 (`/health` = `337ebf0` at 2026-09-18 09:28Z). **Run `curl -sS https://game.unravelcodes.com/health` before believing this line.**
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It is Tom's own brief (D&D dual-function constraint + how he wants to be worked with).
- **Last shipped:** v3.2.63 — named the five approved "My numbers" placeholder strings (fb:adad1561, `UI_STRINGS.csv` `NUMBERS.*`), data-only. v3.2.62 — Tom's "My numbers" redesign: four tappable glance boxes (Money/Time/Expeditors/Scope) replace "What's affecting you"; CARD_TYPES `numbers_section` decides where each family shows.
- **Test suite (v3.2.63):** `npx vitest run` **3209/3209 across 224 files**; typecheck ✅, build ✅.
- **Dashboard:** 9 open (was 17). The 8 v3.2.61 fixes are already flipped resolved.

## Top 3 open items
1. **Teaching layer: tutorial, micro-lessons, and the voice pass on the 44 `ACTION_TOOLTIPS.csv` rows.** Largest part of Onboarding Phase C. Fold in "helper" jargon, the Banker's "pound of flesh" idiom (27 robot hits on 09-16), and fb:adad1561's "What's affecting you" wording. Never put a glossary term inside an action button.
2. **Playtest robot: still 0 completions.** The 09-16 Lender Review loop (G-Z5UM-P9ZQ, 14 push-backs in a row) is **harness-side**, verified against server log and code: the harness drops non-actionable controls, so the model never reads "Finish 'Bring in extra help' above first" or the tap-revealed cost. Tom decided 2026-09-16: the game stays as is. Fix belongs to the Jarvis session. Do not edit `game_playtest.py` from here.
3. **Audit II leftovers ranked in TODO.md** — win condition, closed card-family union. Each is a dedicated session and Tom's call.

## Decisions waiting on the user
- **v3.2.62 placeholders are named (v3.2.63, done).** Still waiting: Tom looking at the four boxes on a real phone (controller view) before fb:adad1561 flips.
- Settled 2026-09-17: a confirmed swap is NOT undoable (fb:9e31b860 resolved).
- Carried: auto-expand the destination picker? "What's this?" more than `?`? `data-testid` on `RoutingExplanationModal`? Stray CR bytes in `DiceRoll Info.csv` / `CARDS_EXPANDED.csv`? Card library Stage 4.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** Only after Tom confirms the TV reads well across a room.
- **fb:adad1561 — flip only after v3.2.63 is live AND Tom has looked at the four boxes on a real phone.** Placeholders are named (v3.2.63); the phone look is still outstanding.

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
