# Next session starter — written 2026-09-22 by /koniec

## State at handoff
- **Version:** v3.2.73 — **pending deploy.** v3.2.72 was deployed and confirmed live mid-session (`/health` = `b5187ba`); v3.2.73 (the "Rules" → "How to play" rename, see below) shipped right after and has NOT been deployed yet. Run `curl -sS https://game.unravelcodes.com/health` before believing this.
- **Branch:** master, clean and pushed to origin. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It's Tom's own brief (D&D dual-function constraint + how he wants to be worked with).
- **Last shipped:** v3.2.73 — the header button + modal title "Rules" → "How to play" (Slice 3 line item). Found a real trap doing it: `RULES.title` had a live `UI_STRINGS.csv` override row that wins over the code default, so changing only `uiStrings.ts` silently did nothing until the CSV row was updated too — verified live before trusting it. **v3.2.72** (same session, shipped first): Onboarding Phase C Slice 3 partial — closed the top 2 confusions from the 2026-09-21 playtest report (press-and-hold hint made visible + its own "?"; the four glance boxes share one "?" explaining Money/Time/Expeditors/Scope, including "deficit"). Also every "?" in the game shrank from a 44px touch-target floor to 26px, per Tom's direct live feedback.
- **Test suite:** `npm test` **219 files / 3317 tests green** across both versions. Typecheck ✅, build ✅. Ghost gates (`npm run test:ghost`) **not re-run either version** — judgment call, both changes are presentation-only (help text, button sizing, one label rename), no game logic/dice/movement/effects touched. Run it before the NEXT logic-touching change if you want fresh confirmation.
- **Still Tom's:** deploy v3.2.73. React to slice 1 **on a real phone** (light and dark) is still outstanding, and the ~20px phone-width oddity (TODO, active bugs) — confirmed it still clips the new commit-control "?" on a 375px emulated viewport this session (pre-existing bug, not new).

## What happened this session (two turns, same session)
1. **Investigated and planned** (per the morning's Manager brief): confirmed Owner's Money's hold-gesture and "deficit" both fall inside Slice 3's already-approved scope, wrote a file:line plan into TODO.md, drafted two candidate sentences for Tom's reaction.
2. **Tom said build it today** ("we still have 6%... this can be done today"), reacted to the drafts live (asked the Money caption to also cover green/red, not just orange; asked every "?" in the game to shrink, referencing the header toolbar's small icon buttons as the target). Built and shipped as v3.2.72 in the same session — see CHANGELOG for full detail.

## The plan Tom approved (2026-09-19) — full text is in TODO's Onboarding Phase C item
He rejected a new tutorial/tip layer ("yet another set of instructions?"). Instead: **one help look for the whole game, voiced by one recurring mentor, reusing the existing wording.** Slice 1 done. Slice 3 partial (this session). **2** mentor character + one-time hello — still needs Tom. **3** remaining: the 24 movement-choice tooltip rows (currently unreachable — `TooltipService.getMovementTooltip` has zero callers, same dead-code shape as the negotiation row this session rewired), and Rules → "How to play". **4** polish (glossary card look, ~53 hover-only `title=` tooltips).

## Top open items (top 3 from this note — TODO.md is the whole backlog)
1. **Deploy v3.2.73.** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` from a Windows terminal (yours, not this session's).
2. **Slice 2, the mentor — needs Tom.** Bring 3 candidates with a sample line each (copy-review format, ok/edit/no). Default: approved wording unchanged; the mentor adds a face, a name and a hello.
3. **Slice 3's one remaining gap:** the 24 movement-choice tooltip rows (`TooltipService.getMovementTooltip` has zero callers today) — plus the RULES modal's body content rewrite (raw space IDs, "Determine Outcome", "snapshot"), separate from the header rename already shipped.

## Decisions waiting on the user
- The mentor — who they are (see item 2). Nothing else new this session — the two copy proposals were reacted to and shipped already.

## Flip after deploy
- **fb:93449bf2** — only after Tom confirms the TV reads well across a room. **fb:ae480630 / fb:11662ac3** — only after a live re-check at Lender Review. (Unchanged — deploy status alone doesn't satisfy these.)

## Suggested first move
Deploy v3.2.72, then ask how the new "?" size and the press-and-hold explanation feel on a real phone. If good, move on to the mentor candidates.

## Suggested model for next session
Sonnet 5 — same shape of work (presentation/copy, shipped precedent).

## Reminders
- **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`, and `curl` is `Invoke-WebRequest` — use `curl.exe … | Select-String -SimpleMatch "text"`, or run read-only checks yourself from Bash.
- **`npm test` ≠ the full suite** (`npm run test:ghost` is separate). Run the command itself with `run_in_background` and wait on a `DONE exit=$?` marker.
- **Verify UI in real Chromium** (`mcp__playwright__*`, screenshots go under `.playwright-mcp\`); a page that survived a server restart lies — reload first. The built-in Browser pane clips phone sizes (confirmed again this session — the pre-existing ~20px overflow bug clips content near the panel's right edge on a 375px emulated viewport; real device needed to diagnose properly).
- **Say which folder AND which session you are in** (this one: Game_Alpha, `D:\Unravel\Current_Game\Game_Alpha`). Deploy runs from a Windows terminal, never from here.
- **`HelpButton`'s touch target is now 26px, not 44px** (v3.2.72, Tom's direct call on feel) — if a future session is tempted to "fix" this back per old accessibility notes, don't without asking him first; it was a deliberate trade.
