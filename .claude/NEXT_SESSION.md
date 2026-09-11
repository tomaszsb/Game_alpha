# Next session starter — written 2026-09-11 by /koniec

## State at handoff
- **Version:** v3.2.58 — **PENDING DEPLOY** (pushed 2026-09-11). Live was v3.2.57 (`/health` = `f926d5b` at 10:54Z). **Run `curl -sS https://game.unravelcodes.com/health` before believing this line** — Tom may have deployed since.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It is Tom's own brief, the origin of the D&D dual-function constraint, and his standing instructions on how he wants to be worked with.
- **Last shipped:** v3.2.56 (Workstream 6 CSV-only-reskin audit II: 4 condition evaluators → 1, fail-closed; "The Banker"; phase table; `auto_roll_dice` flag; `CARD_TYPES.is_playable_from_hand`), v3.2.57 (5 dead UI_STRINGS rows that logged 5 console errors per page load), and v3.2.58 (leak #14: "what counts as a Work Package" defined once — CARD_TYPES `is_project_scope`, read by `card_type` at all six former `startsWith('W')` sites).
- **Test suite:** `npx vitest run` **3170/3170 across 217 files**, green on the first attempt at v3.2.58. Typecheck ✅, build ✅.

## Top 3 open items
1. **Teaching layer: tutorial, micro-lessons, and the voice pass on the 44 `ACTION_TOOLTIPS.csv` rows.** The largest part of Onboarding Phase C still to do. Hard constraint: never put a glossary term inside an action button.
2. **The playtest robot has zero real completions, and its 09-10 "REACHED THE END" was probably a LOSS.** Its evidence was the text `Final score`, which the loss screen also renders (`EndGameModal.tsx:442`; `design_fee_cap`/`bankruptcy` end the game in `FinancialEffectHandler.ts:322/411`). The game behaves correctly. The fix belongs to the Jarvis session (tell a win from a loss, use v3.2.55's `data-testid` hooks, clear `[role="dialog"]`). **Do not edit `game_playtest.py` from here.**
3. **Deploy v3.2.58, then the audit II leftovers ranked in TODO.md.** #14 is done. The biggest remaining are the win condition and the closed card-family union; each is a dedicated session and Tom's call.

## Decisions waiting on the user
- **Three design calls from 09-09, all in TODO.md "Decisions":** auto-expand the destination picker when picking is the only thing left? make "What's this?" more than a bare `?`? add a `data-testid` to `RoutingExplanationModal`?
- **Voice pass on the 44 tooltip rows.** The tooltip is the one place a trade word should appear.
- Carried: normalize the stray CR bytes in `DiceRoll Info.csv` / `CARDS_EXPANDED.csv`? Card library Stage 4 (deferred, not rejected).

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** Only after Tom confirms the TV reads well across a room.

## Suggested first move
Check `/health`. If v3.2.58 isn't live, hand Tom `bash deploy.sh`. Then start the teaching layer: it's the real work and needs no one else.

## Suggested model for next session
Sonnet 5. Both candidates are scoped work with a shipped precedent; raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- **Relayed briefs are hypotheses.** The v3.2.56 brief called its claims "verified facts", and four were wrong. Check code and data before acting on one.
- **A classroom's `resolved/` re-bakes itself on a stock change.** Edit `public/data/` only. CHARACTERS, CARD_TYPES and UI_STRINGS are clean-only (no SOURCE copy).
- **A status line is a handoff too.** "Pushed, not deployed" went stale within hours. Use `/health`.
- **`npm test` ≠ the full suite** (it excludes `tests/ghost/**`). `npx vitest run` runs both (~15 min). **Never pipe a backgrounded suite through `tail`.**
- **Say which folder AND which session you are in.** A Manager session also works in this repo. Deploy runs from a Windows terminal.
