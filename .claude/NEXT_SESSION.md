# Next session starter — written 2026-09-03 by /koniec

## State at handoff
- **Version:** v3.2.45 — **DEPLOYED and independently verified live** (`curl https://game.unravelcodes.com/health` → `2fdf9e5`). v3.2.44 shipped in the same deploy.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` (the maintainer's own draft — leave it).
- **Held branch:** `hold/v3.2.46-session-log` (`12d9ee1`). Correct fix, deliberately NOT merged — read its commit message before touching it.
- **Last shipped:** v3.2.45 — the commit spine replaced its caption with the gate reason, so "Lock the scope" had no name on screen until you'd already done the right thing, leaving "Push back" (costs a day, returns you to the same space) as the only *named* control. A local-model playtest burned 11 of 17 moves in that trap; the server transcript showed all six of that night's games dying in the same corner.
- **Test suite:** `npm test` **3084/3084 across 201 files**, 0 failures. Typecheck ✅ build ✅. `test:ghost` NOT re-run at wrap — it was measured 4× during the session instead (table below). Note: the held branch reports **3085** — it carries the new Try-Again regression test.
- **Git ownership:** the maintainer assigned **Game_Alpha's git to the Claude Code session**, not the Jarvis/Hermes one. That session shares the repo and committed here once on 2026-09-03.

## Top 3 open items
1. **Decouple log-entry ids from the game RNG, then land the held v3.2.46.** `StateService.generateActionId()` (:1836) builds ids with `Math.random()`; `DiceService` (:67) rolls from the same global; `tests/ghost/ghostPlayer.ts:619` replaces that global with `mulberry32(seed)`. So **one draw is burned per log line and log volume decides dice values.** Fix: monotonic counter for `generateActionId()` + `generatePlayerId()` (:1629) — ids stay unique, nothing parses their format. Then `npm run test:ghost` and expect 47/3/0 to return *with* the guard in place. **This is measured, not a hypothesis** — see below.
2. **Look at the TV.** v3.2.44's screen-size calibration ("Adjust screen size" in the footer) and the board zoom floor are now live but were **never verified on real hardware** — both only execute on a real panel. fb:93449bf2 flips only after the maintainer confirms the TV reads well across a room; a browser cannot judge it.
3. **Decide who the game is for.** From fb:8ad42b52's `extra`: insiders (keep the jargon, lean into edge-case events) or broader players (tutorial, tooltips, plain-language micro-lessons). **His call, not a technical one**, and it gates the onboarding work.

## The RNG finding — measured, not inferred
Four runs of `ghostPlayerSmartBot`, same seed (`baseSeed=100001`):

| when (UTC) | TurnService guard | result |
|---|---|---|
| 2026-09-02 23:26 | absent | 47 / 3 / **0 hard** / 86.9 — pass |
| 2026-09-03 00:16 | present | 48 / 2 / **1 hard** / 94.9 — fail |
| 2026-09-03 00:33 | present | 48 / 2 / **1 hard** / 94.9 — fail |
| 2026-09-03 00:46 | absent | 47 / 3 / **0 hard** / 86.9 — pass |

47/3/0/86.9 had been stable across 23 runs since 2026-08-26. Nothing in the bot or any decision path reads `globalActionLog` — it is write-only for decisions. The swing is RNG-stream alignment, not behaviour. **⚠️ Corollary: any cosmetic "tidy the log noise" change silently re-deals every seeded game.** Fix the coupling first.

## Test failures to address
None outstanding on master. The one hard ghost failure above appears only with the *held* guard applied, and is a symptom of item 1, not a game regression. Worth a look once the noise is gone: it was a LOOP at `OWNER-DECISION-REVIEW` — a bot pressing Try Again out to 4,259 days. That loop was always reachable; the re-deal just walked into it. Same shape as the trap v3.2.45 fixed in the UI.

## Decisions waiting on the user
- **The audience fork (item 3)** — the one that unblocks real work.
- **Card library Stage 4, the group/school tier.** Deferred 2026-08-25 ("skip the middle shelf"), not rejected; `group` is a valid tier nothing writes, so adding it later is additive.
- **`DataEditor` is unreachable but deliberately still in the tree** as a fallback — delete once the merged screen is confirmed good in real use.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** v3.2.44 is now live, but the whole point is that a browser cannot judge it: flip only after he confirms the TV reads well across a room. Rolled forward deliberately, not forgotten.

## Suggested first move
Item 1 is small, fully diagnosed, and unblocks a finished fix — a counter in two functions, then one `npm run test:ghost` to confirm 47/3/0 returns with the guard in place. Ask whether he wants that first, or whether he'd rather look at the TV while it's on his mind, since item 2 needs him and not you.

## Suggested model for next session
Sonnet 5 — item 1 is a two-line change with a clear verification step, and items 2–3 need the maintainer, not deeper reasoning. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- **Deploy runs from a Windows terminal, not WSL:** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand it over — don't run it.
- **Say which folder you are in, every time.** Two Claude sessions share repos and git cannot tell them apart — every commit here is authored `Claude AI <claude@game-alpha.local>`. The reliable fingerprint is the **test count**: `npm test` ≈ 201 files/3085 tests (ghost excluded); a run *including* `tests/ghost/**` ≈ 211/3118.
- **`npm test` ≠ the full suite.** It excludes `tests/ghost/**` by config. A green `npm test` says nothing about the ghost gates.
- **The Browser pane reports `document.visibilityState: "hidden"` until you `tabs_select` the tab** — then it goes `visible` at 1280x720. This is what blocked the Con-Initiation crash repro in two prior sessions; it is now unblocked, and that bug remains untested.
- **Never pipe a backgrounded suite through `tail`** — the failing test's identity prints *above* the counts and is destroyed.
- `io.open(path,'w')` truncates before writing; a patch script that raises mid-write leaves the file EMPTY.
