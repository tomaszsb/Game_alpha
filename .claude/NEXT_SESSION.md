# Next session starter — written 2026-09-09 by /koniec

## State at handoff
- **Version:** v3.2.55 — **LIVE.** `/health` re-checked today: `5718946`. HEAD is `a7f9bd8`, a docs-only commit on top. **Still run `curl -sS https://game.unravelcodes.com/health` before believing this line.**
- **Branch:** master, clean and pushed. Untracked: `idea.txt` (the maintainer's own draft — leave it).
- **Last shipped:** v3.2.55, on 2026-09-08. **This session shipped nothing** — investigation only, zero changes to `src/`, `server/`, `public/data/` or `tests/`.
- **Test suite:** not run, deliberately — `/koniec`'s zero-game-source rule. Last green baseline stands: **3132/3132 across 213 files**, first attempt (v3.2.55). Typecheck ✅ and build ✅ were re-run today and are clean.

## What this session settled
**The robot's "click would not land" is an overlay, not a game bug — proven, not suspected.** `is_pressable()` passes and then `ElementHandle.click: Timeout 8000ms exceeded` because a full-viewport `ModalBase` backdrop (`position:fixed`, `inset:0`, `z-index:1000`) intercepts pointer events. Reproduced locally; Playwright's own call log prints `element is visible, enabled and stable` and then `<div data-testid="dice-result-modal-overlay">…</div> intercepts pointer events`.

Two things make it cheap to re-derive and hard to argue with:
- A `.click()` timeout is raised by the actionability wait **before dispatch**, so a button whose handler no-ops reports *success*. "Genuinely inert" is excluded by the error class alone — no sampling needed.
- The interceptor is a property of the **page**, not the control, so *any* control behind it fails identically. One of the six 09-09 deaths was a **commit** button; one game had three *different* buttons fail at one place.

⚠️ **Do not write "all 18 clicks were 8000ms timeouts."** Only 5 of the 18 ever had their `why` text written to disk; the other 13 have places and labels but **no recoverable error text**. Correct framing: *proven on the cases that could be seen; the other 13 are unestablished.*

⚠️ **This one failure was named after the wrong shared attribute four times in one day** — the space, then the button kind, then one effect at several spaces, then `replace_e`. Every one was an honest summary of the visible data. The mechanism survived because it was read off an instrument instead of inferred from a pattern. Full write-up: CLAUDE.md TACTICAL (top entry); memory: `feedback-mechanism-before-naming`.

## Top 3 open items
1. **The harness is now the entire remaining question — both game-side answers are in.** `game_playtest.py` lives on the Mac mini, is owned by a Jarvis session, and **must not be edited from this repo.** It needs two changes: use v3.2.55's `data-testid` hooks, and clear `[role="dialog"]` (dismiss via `button[aria-label="Close modal"]`) before offering any panel control. Tell for the first: `clicked:  ➡️` in the 03:26 report — 7 on 09-05, then 0, 0, 0.
2. **Finish the teaching layer — the tutorial and micro-lessons are still unbuilt**, plus the maintainer's beginner-voice pass on the 44 `ACTION_TOOLTIPS.csv` rows. Hard constraint, structural in code: never put a glossary term inside an action button.
3. **Three design calls now waiting on Tom, all in TODO.md "Decisions":** should the destination picker auto-expand when picking is the only thing left? should "What's this?" show more than a bare `?`? and the new one — add a `data-testid` to `RoutingExplanationModal`, the one modal with no structural handle. All three change shipped code or what a player sees, so none were built.

## Test failures to address
None. No code changed; last full run was green on the first attempt at v3.2.55.

## Decisions waiting on the user
- **The three in item 3 above.** The `RoutingExplanationModal` testid is deliberately *not* bundled with the harness fix — `role="dialog"` already finds that modal today, so only its dismissal text is exposed, and the harness needs a text fallback either way. Worth doing on its own merits.
- **The 44 tooltip rows' voice pass** — the tooltip is the one place a trade word SHOULD appear; buttons stay plain.
- **Normalize the stray CR bytes in `DiceRoll Info.csv` / `CARDS_EXPANDED.csv`?** Not a live defect. Deployed data files, so a maintainer call.
- **`SOURCE_FILES/DiceRoll Info.csv` carries none of the 46 authored dice `button_label` values.** Flagged, not copied — blind-copying between those trees is a documented trap.
- **Card library Stage 4**, the group/school tier. Deferred 2026-08-25, not rejected.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** A browser cannot judge it: flip only after Tom confirms the TV reads well across a room. Rolled forward deliberately. Nothing shipped this session, so no new candidates.

## Suggested first move
**Ask Tom whether the Jarvis session's harness changes landed, and answer the three design calls in item 3** — they are cheap for him and they unblock real work. If he'd rather not chase the robot, the teaching layer's remainder is the substantive work and needs no one else.

## Suggested model for next session
Sonnet 5 — the teaching layer is scoped content-and-copy work with a shipped precedent, and the open items need the maintainer's judgement, not deeper reasoning. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- **A robot playtest that gets stuck is not evidence of a game bug** until you confirm it can both SEE and REACH the control. Both halves have now bitten: copy-coupled selectors (v3.2.52–54) and a modal backdrop (this session). v3.2.53 was shipped against the symptom.
- **Never cite `file:NNN` for a file another session is editing.** Two claims about `game_playtest.py` were wrong in one day purely because of *when* it was read.
- **A teammate's status line is a handoff too** — it describes the world when it was composed. This session reported "dev servers left running", stopped them ten minutes later, and the Manager repeated the stale line. Re-check, don't relay.
- **Playtest timestamps are EDT; `/health` is Zulu.** Comparing directly produces a false "the run predates the deploy" conclusion.
- **Con-Initiation crash: do NOT attempt a harness repro.** Needs the maintainer's own foregrounded browser. Has burned three sessions.
- **Say which folder AND which session you are in, every time.** A Manager session also works in this repo.
- **`npm test` ≠ the full suite** — it excludes `tests/ghost/**`. `npx vitest run` runs both (213 files).
- **Never pipe a backgrounded suite through `tail`** — the failing test's identity prints *above* the counts.
- **Verify deployed content by finding the chunk locally first** (`grep -rl "<string>" dist/assets/*.js`) — the build is code-split. Expect a brief 502 right after a deploy; it clears.
- **Deploy runs from a Windows terminal, not WSL.** Hand it over by default.
