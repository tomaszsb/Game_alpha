# Next session starter — written 2026-09-17 by /koniec (amended 2026-09-18 after v3.2.65)

## State at handoff
- **Version:** v3.2.65 — **PENDING DEPLOY** (pushed 2026-09-18). Live is v3.2.64 (`/health` = `3a87964`). **Run `curl -sS https://game.unravelcodes.com/health` before believing this line.**
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It is Tom's own brief (D&D dual-function constraint + how he wants to be worked with).
- **Last shipped:** v3.2.65 — `npm audit` 9 → 0 vulnerabilities; fixed fb:ae480630's hidden request (commit control now highlights whenever `commit.ready`, not just on a First visit); added `byOrigin` (home/foreign) to `/api/admin/engagement-stats`, the prerequisite a 2026-08-15/09-01 TODO item was waiting on; "underwriting" (Bank Review's modal title, unreachable by the glossary linker) → "reviewing"/"reviewed", Tom's pick from this morning's Jarvis report. v3.2.64 — the three worst copy offenders from the 2026-09-12 playtest.
- **Test suite (v3.2.65):** `npx vitest run` **3214/3214 across 224 files** (one `tests/server/**` ENOTEMPTY flake, confirmed non-regression via isolated re-run — the documented Windows temp-dir pattern); typecheck ✅.
- **Dashboard:** nothing flipped this session. fb:11662ac3 ("no pulsating buttons" at Lender Review) may be a live match for the v3.2.65 highlight fix — too thin a report to confirm without a live re-check.

## Top open items
1. **Teaching layer: tutorial, micro-lessons, and the voice pass on the 44 `ACTION_TOOLTIPS.csv` rows.** Largest part of Onboarding Phase C. Never put a glossary term inside an action button.
2. **`docs/user/USER_MANUAL.md` needs an accuracy pass.** Still says "Things you can do" (renamed to "This turn" in v3.2.64) and still shows "What's affecting you" as its own panel zone (removed by the v3.2.62 four-box redesign). Not a one-line fix — needs a real read-through against the current panel.
3. **fb:ae480630's ORIGINAL complaint (highlight going stale, chased since July) may still be open** — only its hidden second request was fixed in v3.2.65. Needs a live re-check, ideally at Lender Review specifically (fb:11662ac3 may be the same bug).
4. **This morning's 2026-09-18 03:45 Jarvis report, three findings folded into the already-tracked "should the destination picker auto-expand?" decision** (🙋 Decisions waiting on the user in TODO) as supporting evidence, not new asks.
5. **Playtest robot: still 0 completions.** Harness-side (verified). Tom decided 2026-09-16: the game stays as is. Fix belongs to the Jarvis session. Do not edit `game_playtest.py` from here.
6. **Audit II leftovers ranked in TODO.md** — win condition, closed card-family union. Each is a dedicated session and Tom's call.

## Decisions waiting on the user
- Settled 2026-09-18: "reviewing"/"reviewed" for Bank Review's "underwriting" — Tom's pick, applied to all three occurrences (title + both story mentions).
- Settled 2026-09-18: three earlier copy replacements ("team member" / "squeeze you" / "This turn") — Tom picked all three from drafted options.
- Settled 2026-09-18: fb:adad1561 (My numbers placeholders + real-phone look) RESOLVED.
- Carried: auto-expand the destination picker? (now with 9 more hits of supporting evidence) "What's this?" more than `?`? `data-testid` on `RoutingExplanationModal`? Stray CR bytes in `DiceRoll Info.csv` / `CARDS_EXPANDED.csv`? Card library Stage 4.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** Only after Tom confirms the TV reads well across a room.

## Suggested first move
Check `/health` to confirm v3.2.65 deployed, then a live re-check of the commit-control highlight fix at Lender Review (fb:11662ac3), or start the ACTION_TOOLTIPS voice pass.

## Suggested model for next session
Sonnet 5 — scoped copy/UI work with shipped precedent; raise effort to `xhigh` before a bigger model.

## Reminders
- **Vite's watcher can miss an edit**: `curl -s localhost:3000/src/<file> | grep -c <new-id>` before debugging a live check that contradicts the source.
- **Relayed briefs are hypotheses.** Check code and data before acting on one.
- **Edit `public/data/SOURCE_FILES/` and regenerate** (`node scripts/regen-clean-files.mjs`) rather than hand-editing CLEAN_FILES directly — a classroom's `resolved/` re-bakes itself. UI_STRINGS.csv is the one clean-only exception (no SOURCE copy).
- **`npm test` ≠ the full suite** (excludes `tests/ghost/**`). `npx vitest run` runs both (~15 min). Never pipe a backgrounded suite through `tail`.
- **Jarvis nightly playtest reports live on the Mac mini**, not this repo: `ssh hermes "cat ~/.hermes/playtest-reports/playtest-<date>.txt"` (or `scp` to pull a copy). Check the file's mtime against any deploy time before treating a finding as current — this session's 03:45 report predated that morning's own deploy.
- **Say which folder AND which session you are in.** Deploy runs from a Windows terminal.
