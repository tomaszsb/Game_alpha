# Next session starter — written 2026-09-18 by /koniec

## 🙋 START HERE — Tom's decisions (he asked on 2026-09-18 that these come FIRST)
Walk them one at a time: the evidence, my recommendation, get his answer, act on it, **then** anything else. Don't build a decision-gated item before he answers it; build an approved one the moment he does.
1. **"What's this?" tooltip copy — ok / edit / no per row.** 7 live rows + 8 dice categories drafted in `docs/core/AUTHORED_COPY_REVIEW.md` (last section). Rec: approve as drafted. Part 1 (the 7 rows) can ship alone; Part 2 (dice "?") needs a small wiring change keyed on each dice button's `effect_value`, no new column.
2. **Auto-expand the destination picker when picking is the only thing left?** 13 robot hits (09-08, 09-18), independent of the harness bug. Rec: yes, the narrow version only (folded shut whenever real actions remain).
3. **Show the words "What's this?" instead of a bare "?"** — 19 robot findings quoted only "?". Rec: yes.
4. **`data-testid` on `RoutingExplanationModal`** — attributes only, nothing visible changes. Rec: yes.
5. **"Pass a team member" — optional (as built) or mandatory?** Built optional: its card picker has a Cancel like the other team-member actions, so forcing it means removing Cancel for this choice, and nobody presses an optional loss. Rec: keep optional; mandatory makes the game harder for new players.
6. **Stray CR bytes in `DiceRoll Info.csv` / `CARDS_EXPANDED.csv`** — inert (`DataService` trims every field). Rec: leave.
7. **`server/data/.../DiceRoll Info.csv` lacks the 46 authored dice labels** — live authoring input or stale snapshot? Rec: stale snapshot, leave.
8. **Card library Stage 4 (group tier + roles)** — long-term, whenever he wants it.
*Not decisions, but need his hands or eyes:* install Node 24 locally (his PC runs 20, production runs 24 — TODO); look at Lender Review on the live site for the commit glow (fb:11662ac3 / fb:ae480630 — v3.2.65 is live); the TV across a room (fb:93449bf2); approve **Crowdfunding** in Glossary Purgatory.

## State at handoff
- **Version:** v3.2.68 — **pending deploy** (pushed, `fd9be72`). Live is v3.2.67 (`/health` = `01c8fba`, which also carries v3.2.65 and v3.2.66). **Run `curl -sS https://game.unravelcodes.com/health` before believing this.**
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It is Tom's own brief (D&D dual-function constraint + how he wants to be worked with).
- **Last shipped:** v3.2.68 (option A: four "Pass help" buttons gave the presser a free expeditor; now "Pass a team member to your left/right", really passes one) on top of v3.2.65–67 (audit 9 → 0; TypeScript 6 / jsdom 29 / framer-motion 13; lint clean; manual rewritten; Con-Initiation "crash" reproduced as the bankruptcy ending).
- **Test suite:** `npx vitest run` **3245/3245, 226 files** (one `instanceResolver` ENOTEMPTY flake, 160/160 isolated); typecheck ✅, lint 0 errors, build ✅. Ghost smart-bot 49/50, 0 hard failures.
- **After the deploy:** open a modal or two on a real phone — the bundle now carries React 19.3, Vite 8.3 and framer-motion 13.

## Top open items (after the decisions)
1. **Teaching layer:** tutorial, micro-lessons, tooltips (once copy is answered). Never put a glossary term inside an action button.
2. **Playtest robot: still 0 completions** — harness-side (Jarvis, verified). Tom decided 2026-09-16 the game stays as is. Do not edit `game_playtest.py` from here.
3. **Audit II leftovers** (win condition, closed card-family union) — each a dedicated session and Tom's call.

## For the manager (no manager session was live at wrap-up)
Full report left untracked at `handouts/game-alpha-report-2026-09-18.md` in the Jarvis repo, per the 09-17 precedent; nothing in `command/` was edited. Its record says "Game: v3.2.63 LIVE" — **stale: live is v3.2.67**. New cross-project facts: Tom's dev PC runs Node 20 vs production's 24; the robot finds controls by copy, so the four "Pass help" labels changed (check its handles); `.playwright-mcp` gives a real-frames browser for repros.

## Flip after deploy
- **fb:93449bf2** — only after Tom confirms the TV reads well across a room. **fb:ae480630 / fb:11662ac3** — only after a live re-check at Lender Review.

## Suggested first move
Open with the eight decisions above, in order, one line of evidence and a recommendation each — he can answer in a word. Then build whatever he approved (tooltip Part 1 first: it is copy in `ACTION_TOOLTIPS.csv`, no code).

## Suggested model for next session
Sonnet 5 — copy and small UI work with shipped precedent; raise effort to `xhigh` before a bigger model.

## Reminders
- **Edit `public/data/SOURCE_FILES/` and regenerate** (`node scripts/regen-clean-files.mjs`) rather than hand-editing CLEAN_FILES; `UI_STRINGS.csv` is the one clean-only exception.
- **`npm test` ≠ the full suite** (excludes `tests/ghost/**`); `npx vitest run` runs both (~12 min). Never pipe a backgrounded suite through `tail`. Read the failure text before re-running.
- **Tool traps** (memory `reference-tool-quirks`): the Edit tool flips CRLF files to LF wholesale; `grep -c $'\r'` lies — count bytes in python; the built-in Browser pane fires no animation frames — use `mcp__playwright__*`.
- **Jarvis nightly reports live on the Mac mini:** `ssh hermes "cat ~/.hermes/playtest-reports/playtest-<date>.txt"`. Check the mtime against any deploy time before treating a finding as current.
- **Say which folder AND which session you are in.** Deploy runs from a Windows terminal, never from here.
