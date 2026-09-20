# Next session starter — written 2026-09-19 by /koniec

## State at handoff
- **Version:** v3.2.70 — **LIVE** (Tom deployed the evening of 2026-09-19; `/health` = `7c11b28`, the docs commit on top of `e06f90b`; v3.2.69 is `fcbbbda`). Verified: the bundle carries "3.2.70" and the live `ACTION_TOOLTIPS.csv` has the new wording. **Run `curl -sS https://game.unravelcodes.com/health` before believing this.**
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It is Tom's own brief (D&D dual-function constraint + how he wants to be worked with).
- **Last shipped:** v3.2.69 every "?" answers (7 card rows in beginner voice + all 45 dice buttons; a merged button explains every outcome it fires); v3.2.70 the destination list opens itself when choosing where to go is the only thing left. **Tom answered all eight open decisions on 2026-09-19** (via the manager session) — built or recorded in CHANGELOG v3.2.70. Nothing waits on him.
- **Test suite:** `npm test` **216 files / 3280 tests green**; ghost gates 11 files / 43 tests green (smart-bot 49/50, 0 hard failures — same as v3.2.68); typecheck ✅, build ✅, lint 0 errors.
- **Still Tom's:** open a modal or two on a real phone (the bundle carries React 19.3, Vite 8.3, framer-motion 13 since v3.2.67), and look at the new "?" and the auto-opening list.

## Top open items (top 3 from this note — TODO.md is the whole backlog)
1. **Teaching layer, what's left:** the tutorial and story-based micro-lessons (tooltips are done). Never put a glossary term inside an action button.
2. **Playtest robot is blind at its START step** (09-19 03:00: 0 of 6 games) — it waits for "THINGS YOU CAN DO", renamed "This turn" in v3.2.64. Fix is in the Jarvis repo (`game_playtest.py`) — do not edit it from here. New since v3.2.70: the picker opener reads `aria-expanded="true"` on arrival, so the robot must read it before clicking or it folds the list.
3. **Audit II leftovers** (win condition, closed card-family union) — each a dedicated session and Tom's call.

## Decisions waiting on the user
None. On hold, not waiting on you: `data-testid` on `RoutingExplanationModal` (Tom wants to know what Jarvis can do visually first). **Accessibility for visually impaired players** is research-only in TODO's parking lot — audit the live game only if Tom asks; build nothing first.
*Not decisions, but need his hands or eyes:* install Node 24 locally (PC runs 20, production 24); Lender Review commit glow live (fb:11662ac3 / fb:ae480630); the TV across a room (fb:93449bf2); approve **Crowdfunding** in Glossary Purgatory.

## For the manager (no manager session was live at wrap-up; brief was read)
Handoff files are what you read. `command/README.md` is stale on the game: live is v3.2.70 (deployed and verified the evening of 2026-09-19). Brief items 1A, 1B, 2 built; 3, 5, 6, 8 left as decided; 4 left on hold; 7 closed with your evidence (all recorded in CHANGELOG v3.2.70). Two additions to the brief: the `replace_E` "picked for you" line (verified in `CardService.replaceCard`) and that a merged dice button spans 8 space/visit combos, not 1. `PROJECT_STATUS.md` and this file no longer say v3.2.68 is pending.

## Flip after deploy
- **fb:93449bf2** — only after Tom confirms the TV reads well across a room. **fb:ae480630 / fb:11662ac3** — only after a live re-check at Lender Review.

## Suggested first move
Nothing waits on Tom, and v3.2.69–70 are live. Ask whether he has looked at the new "?" and the auto-opening list on a phone, then pick up the teaching layer (tutorial / micro-lessons) or whatever he raises.

## Suggested model for next session
Sonnet 5 — small UI and copy work with shipped precedent; raise effort to `xhigh` before a bigger model.

## Reminders
- **Edit `public/data/SOURCE_FILES/` and regenerate** (`node scripts/regen-clean-files.mjs`); `ACTION_TOOLTIPS.csv` and `UI_STRINGS.csv` are the standalone CLEAN-only files. `TooltipService` cannot read a literal `"` inside a field.
- **`npm test` ≠ the full suite** (excludes `tests/ghost/**`; that is `npm run test:ghost`). Run the command itself with `run_in_background` and wait on a `DONE exit=$?` marker — a `&` inside it makes the completion notice lie. Read the failure text before re-running.
- **Tool traps:** the Edit tool flips CRLF files to LF wholesale (`USER_MANUAL.md` is CRLF — patch it byte-safely); the Browser pane fires no animation frames (use `mcp__playwright__*`); the memory-graph MCP was erroring on a schema dialect. **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`, and `curl` is `Invoke-WebRequest` — use `curl.exe … | Select-String -SimpleMatch "text"`, or just run the check yourself from Bash.
- **Say which folder AND which session you are in** (this one: Game_Alpha, `D:\Unravel\Current_Game\Game_Alpha`). Deploy runs from a Windows terminal, never from here.
