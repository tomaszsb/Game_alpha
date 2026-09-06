# Next session starter — written 2026-09-06 by /koniec

## State at handoff
- **Version:** v3.2.52 — **LIVE and content-verified.** `/health` → `648e212` (contains v3.2.52's `c091b5c`; `648e212` is a docs-only commit the Manager session added on top). Verified both halves against the live host: the served CSV carries the new labels, and the live `index-*.js` chunk has the new strings with `Determine Outcome` / `Moving to:` at **zero**.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` (the maintainer's own draft — leave it).
- **Last shipped:** v3.2.52, off the 2026-09-05 robot playtest. **The root cause was v3.2.51's own:** `collapsePairedDiceActions` overwrites the authored dice label with a hardcoded constant when two dice rows sharing one roll merge — on 8 space/visit combinations, so **16 of 46 authored labels never reached a player**. Also: "Cut back your help" → "Let one helper go" (the report's #1 confusion, 57 hits), a live Move button that announced a move which had not happened, finished actions listed under "Things you can do", and four sequencing strings that stated a rule without naming its subject.
- **Test suite:** `npx vitest run` — the **whole** suite including ghost — **3130/3130 across 212 files**, 0 failures. Typecheck ✅ build ✅.
- **Ghost caveat, recorded honestly:** all four ghost suites passed with the win-rate floor, but this run's reporter did **not** print the batch line, so 50/0/0/70.8/21 was not directly observed. **Do not chase 47/3/0/86.9** — pre-v3.2.48, cannot return by construction.

## The two rules that govern this work
1. **"Buttons say what you're doing, in everyday words. No trade jargon on buttons."** Structural, not stylistic — `TextWithTerms` renders `<span role="button">` with `stopPropagation()`, so a glossary link inside a real `<button>` swallows the click. A button is the one surface where a hard word can never explain itself.
2. **New, from v3.2.52: a data guard cannot see a string the renderer substitutes after reading the data.** Before authoring into a column, grep the source for every place the value can be *reassigned* (`label:`, `?? '…'`, `|| '…'`, same-domain constants), not just where it is read. Full entry in CLAUDE.md TACTICAL.

## Top 3 open items
1. **Build the teaching layer — the rest of Onboarding Phase C, and the bulk of it.** Tiles (v3.2.50), buttons (v3.2.51) and label *delivery* (v3.2.52) were all the mechanical half. **Tutorial, tooltips and micro-lessons are unbuilt.** Hard constraint: never put a glossary term inside an action button.
2. **Does ARCH-FEE-REVIEW's 50-day Try Again cost need to be visible before you commit?** The 50 days are intended (`SPACE_EFFECTS.csv:57`); this is **disclosure, not balance**. Maintainer's call, and the smaller of the two asks.
3. **Look at the TV.** v3.2.44's screen-size calibration and board zoom floor are live but were never verified on real hardware.

⚠️ This is a curated shortlist, **not the backlog** — read `TODO.md` before claiming anything about what else is open.

## Test failures to address
None. Green on master at v3.2.52.

## Decisions waiting on the user
- **The ARCH-FEE-REVIEW 50-day disclosure question** (item 2) — the one that unblocks real work.
- **`formatDiceRollButton` is dead code — delete it?** 74 lines, zero call sites; six `DICE_BUTTON` keys reachable only through it are dead too. (TODO.md:84)
- **One malformed row in `SOURCE_FILES/DiceRoll Info.csv`** — blank `space_name`, `die_roll` set to the literal string `button_label`. (TODO.md:85)
- **Card *type* names were deliberately left alone.** Renaming "Work Package"/"Bank Loan"/"Expeditor" globally via `getCardTypeName` would reach the log, card details and outcome banners — its own decision.
- **Card library Stage 4, the group/school tier.** Deferred 2026-08-25, not rejected; additive whenever it comes.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** The whole point is that a browser cannot judge it: flip only after he confirms the TV reads well across a room. Rolled forward deliberately, not forgotten. (v3.2.52 closed no dashboard reports — its findings came from the robot playtest, not the dashboard.)

## Suggested first move
**The robot plays again tonight.** Read the new report before starting anything — it is the direct check on whether v3.2.52 worked, and one item is explicitly waiting on it (TODO.md's parking-lot entry: does "Things you can do" still draw ~16 hits now that finished actions were moved out of it?). Then ask whether he wants the teaching layer started or the 50-day disclosure question settled first.

## Suggested model for next session
Sonnet 5 — the teaching layer is scoped content-and-copy work with three shipped precedents to follow, and items 2–3 need the maintainer, not deeper reasoning. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- **`/start` now curls `/health` (added 2026-09-06).** It never did, which is how a "PENDING DEPLOY" claim survived a full day past the actual deploy and misled two briefings. Trust `/health`, never this file's own version line.
- **A data guard cannot see a render-time substitution** — see rule 2 above. This is what made 16 of v3.2.51's labels inert while every test passed.
- **A robot playtest finding that describes a TRUE state is not a defect.** 25 of 28 checkmark hits were `doneActionTraces` — a `<div>`, `cursor: default`, no handler, genuinely finished. Confirm the element before confirming the complaint; reading the code first is what found the real bug.
- **Con-Initiation crash: do NOT attempt a harness repro.** Needs the maintainer's own foregrounded browser; automated ones report `visibilityState: hidden`. Has burned three sessions.
- **Say which folder AND which session you are in, every time.** Two Claude sessions share this repo; a Manager session (`local_83ef110e`) also works here and commits occasionally. Fingerprint by test count.
- **`npm test` ≠ the full suite** — it excludes `tests/ghost/**` by config. `npx vitest run` runs both (212 files).
- **Never pipe a backgrounded suite through `tail`** — the failing test's identity prints *above* the counts.
- **Verify deployed content by finding the chunk locally first** (`grep -rl "<string>" dist/assets/*.js`) — the build is code-split.
- **Deploy runs from a Windows terminal, not WSL.** Hand it over by default.
- `io.open(path,'w')` truncates before writing; a patch script that raises mid-write leaves the file EMPTY.
