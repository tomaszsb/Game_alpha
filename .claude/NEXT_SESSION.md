# Next session starter — written 2026-09-22 by /koniec

## State at handoff
- **Version:** v3.2.71 — **LIVE.** `/health` = `d4f4759` = HEAD (checked 2026-09-22). No code shipped this session — investigation + planning only, plus correcting the stale "pending deploy" claim this file and PROJECT_STATUS.md had both been carrying since 09-19.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it.** It's Tom's own brief (D&D dual-function constraint + how he wants to be worked with).
- **Last shipped:** v3.2.71 "One ? everywhere", slice 1 (2026-09-19) — unchanged since.
- **Test suite:** not re-run this session (zero game-source touched — only TODO.md, PROJECT_STATUS.md, this file). Last known-green: 219 files / 3314 tests (v3.2.71). `typecheck` and `build` both re-verified clean 2026-09-22.

## What this session did (investigate-and-plan only, per Tom's brief)
Confirmed and root-caused last night's playtest report's top two confusions:
1. **Owner's Money press-and-hold (24 trips, biggest confusion by far).** It's the space, not a button — OWNER-FUND-INITIATION is the first `can_negotiate` space in the game, so it's the first time ANY player meets the hold-to-confirm control. An explanation already exists (`TurnCommitControl.tsx:427-430`, "Tap to compare · press & hold to confirm" + a matching aria-label) but at 9.5px muted gray it reads as a footnote next to two clearly-labeled buttons. Not a "nothing exists" case — a "nobody sees it" case.
2. **"Deficit" (12 trips).** Genuinely unexplained anywhere — checked the live glossary API directly (0 of 274 terms match). None of the four glance tiles (Money/Time/Expeditors/Scope) have a "?" at all.

Both fall squarely inside Slice 3 of the already-approved plan ("the four boxes" = deficit's home; "the move-on/push-back control" = the hold gesture's home) — not new scope. Full file-and-line plan written into **TODO.md**, under the Onboarding Phase C item (two new sub-bullets right after it). Tomorrow's session can start building from that with zero further research.

**Two new sentences are proposed, waiting on Tom's ok/edit/no** (everything else in the plan is styling — no new words, no review needed):
1. On the hold control: *"Press and hold either side to confirm it — a tap just switches which one you're comparing."*
2. On the Money box: an explanation distinguishing "running low" (low cash) from "$X deficit" (committed scope exceeds secured funding) — not yet drafted, needs to be workshopped with Tom rather than guessed at.

## Top open items (top 3 from this note — TODO.md is the whole backlog)
1. **Build the Slice 3 Owner's Money + deficit fix — plan is ready, nothing built yet.** Get Tom's reaction to the two sentences above, then implement per TODO.md's two new sub-bullets (file:line pointers already there).
2. **Slice 2, the mentor — still needs Tom.** Bring 3 candidates with a sample line each (copy-review format, ok/edit/no). Default: approved wording unchanged; the mentor adds a face, a name and a hello.
3. **Playtest robot is blind at its START step** (waits for "THINGS YOU CAN DO", now "This turn") — fix is in the Jarvis repo. It also needs to read `aria-expanded` on the move-list opener, and the old "What to do & why" link is gone (new handles: `help-button` / `help-card`).

## Decisions waiting on the user
- The mentor — who they are (see item 2 above).
- The two new sentences above (Owner's Money hold control + deficit explanation) — ok / edit / no.
- Nothing else new. On hold: `data-testid` on `RoutingExplanationModal`. Accessibility is research-only, only if he asks.

## Flip after deploy
- **fb:93449bf2** — only after Tom confirms the TV reads well across a room. **fb:ae480630 / fb:11662ac3** — only after a live re-check at Lender Review. (Unchanged — deploy status alone doesn't satisfy these; they need Tom's own eyes.)

## Untriaged feedback
9 open dashboard reports (filed 2026-09-20/21) aren't tracked in TODO.md or CHANGELOG.md yet — none relate to Owner's Money or deficit. Monthly `/start` sweep isn't due until October; run `/start full` sooner if you want them triaged now.

## Suggested first move
Show Tom the two proposed sentences above. If he's fine with them (or edits them), build both Slice 3 fixes from TODO.md's plan — it's concrete enough to start immediately, no re-investigation needed.

## Suggested model for next session
Sonnet 5 — this is presentation/copy work with a fully-scoped plan already written, well within its range.

## Reminders
- **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`, and `curl` is `Invoke-WebRequest` — use `curl.exe … | Select-String -SimpleMatch "text"`, or run read-only checks yourself from Bash.
- **`npm test` ≠ the full suite** (`npm run test:ghost` is separate). Run the command itself with `run_in_background` and wait on a `DONE exit=$?` marker — a `&` inside it makes the completion notice lie.
- **Verify UI in real Chromium** (`mcp__playwright__*`, screenshots go under `.playwright-mcp\`); a page that survived a server restart lies — reload first. The built-in Browser pane clips phone sizes.
- **Say which folder AND which session you are in** (this one: Game_Alpha, `D:\Unravel\Current_Game\Game_Alpha`). Deploy runs from a Windows terminal, never from here.
- **Verify `/health` fresh every session** — deploy status and commit history are independent facts (this session found the 09-19 handoff's "pending deploy" claim had gone stale without any new commits).
