# Next session starter — written 2026-09-19 by /koniec

## State at handoff
- **Version:** v3.2.71 — **pending deploy** (pushed, `ed5fb2d`). Live is v3.2.70 (`/health` = `7c11b28`, checked 2026-09-19 ~22:37). **Run `curl -sS https://game.unravelcodes.com/health` before believing this.**
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It is Tom's own brief (D&D dual-function constraint + how he wants to be worked with).
- **Last shipped:** v3.2.69 every "?" answers · v3.2.70 the destination list opens itself when choosing is all that's left · **v3.2.71 "One ? everywhere", slice 1** (the space's own help is now the same "?" as the actions, one open card across the panel, editor preview mirrored, no new wording).
- **Test suite:** `npm test` **219 files / 3314 tests green**; ghost gates 11 files / 43 tests green (smart-bot 49/50, 0 hard failures — unchanged); typecheck ✅, lint 0 errors on touched files.
- **Still Tom's:** react to slice 1 **on a real phone** (light and dark), and look at the ~20px phone-width oddity (TODO, active bugs).

## The plan Tom approved (2026-09-19) — full text is in TODO's Onboarding Phase C item
He rejected a new tutorial/tip layer ("yet another set of instructions?"). Instead: **one help look for the whole game, voiced by one recurring mentor, reusing the existing wording.** Slice 1 done. **2** mentor character + one-time hello; **3** fill the gaps with the same "?" (four boxes, move choices via the 24 existing `choice` rows, move-on control, Rules → "How to play"); **4** polish (glossary card look, ~53 hover-only `title=` tooltips). Baselines to re-measure after ≥ 30 new outside games are in that TODO item.

## Top open items (top 3 from this note — TODO.md is the whole backlog)
1. **Slice 2, the mentor — needs Tom.** Bring 3 candidates with a sample line each (copy-review format, ok / edit / no) once he has seen slice 1. Default: approved wording unchanged; the mentor adds a face, a name and a hello.
2. **Playtest robot is blind at its START step** (waits for "THINGS YOU CAN DO", now "This turn") — fix is in the Jarvis repo. It also needs to read `aria-expanded` on the move-list opener, and the old "What to do & why" link is gone (new handles: `help-button` / `help-card`).
3. **Audit II leftovers** (win condition, closed card-family union) — each a dedicated session and Tom's call.

## Decisions waiting on the user
The mentor — who they are (see item 1). Nothing else. On hold: `data-testid` on `RoutingExplanationModal`. Accessibility is research-only, only if he asks.

## Flip after deploy
- **fb:93449bf2** — only after Tom confirms the TV reads well across a room. **fb:ae480630 / fb:11662ac3** — only after a live re-check at Lender Review.

## Suggested first move
Ask whether v3.2.71 is deployed and how the new "?" felt on a phone. If good, bring the three mentor candidates; if not, fix slice 1 first.

## Suggested model for next session
Sonnet 5 — presentation work with shipped precedent; raise effort to `xhigh` before a bigger model.

## Reminders
- **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`, and `curl` is `Invoke-WebRequest` — use `curl.exe … | Select-String -SimpleMatch "text"`, or run read-only checks yourself from Bash.
- **`npm test` ≠ the full suite** (`npm run test:ghost` is separate). Run the command itself with `run_in_background` and wait on a `DONE exit=$?` marker — a `&` inside it makes the completion notice lie.
- **Verify UI in real Chromium** (`mcp__playwright__*`, screenshots go under `.playwright-mcp\`); a page that survived a server restart lies — reload first. The built-in Browser pane clips phone sizes.
- **Say which folder AND which session you are in** (this one: Game_Alpha, `D:\Unravel\Current_Game\Game_Alpha`). Deploy runs from a Windows terminal, never from here.
