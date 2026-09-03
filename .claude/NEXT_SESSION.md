# Next session starter — written 2026-09-03 by /koniec

## State at handoff
- **Version:** v3.2.47 — **DEPLOYED and independently verified live.** `/health` → `48d8549`, and the changed strings confirmed in the served `assets/services-*.js` chunk. v3.2.44 and v3.2.45 shipped ahead of it the same night. **3.2.46 is deliberately skipped** — it belongs to the held commit, which needs renumbering on landing.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` (the maintainer's own draft — leave it).
- **Held branch:** `hold/v3.2.46-session-log` (`12d9ee1`). Correct fix, deliberately NOT merged — read its commit message before touching it.
- **Last shipped:** v3.2.47 — `return_e` renamed "Return Expeditor" -> **"Let one expeditor go"** (a layoff, not a return), with `CardEffectService`'s prompt reworded to match. Found by the same bot once v3.2.45 let it walk deep enough to reach ARCH-FEE-REVIEW. Before that, v3.2.45 — the commit spine replaced its caption with the gate reason, so "Lock the scope" had no name on screen until you'd already done the right thing, leaving "Push back" (costs a day, returns you to the same space) as the only *named* control. A local-model playtest burned 11 of 17 moves in that trap; the server transcript showed all six of that night's games dying in the same corner.
- **Test suite:** `npm test` **3084/3084 across 201 files** and `npm run test:ghost` **33/33 across 10 files**, 0 failures either way. Typecheck ✅ build ✅. The smart-bot gate held its 47/3/0-hard/86.9 signature on this code — v3.2.47 changed two string literals and consumed no extra `Math.random` draws, so the RNG coupling in item 1 was not disturbed. Note: the held branch reports **3085** on `npm test` — it carries the new Try-Again regression test.
- **Git ownership:** the maintainer assigned **Game_Alpha's git to the Claude Code session**, not the Jarvis/Hermes one. That session shares the repo and committed here once on 2026-09-03.

## Top 3 open items
1. **Decouple log-entry ids from the game RNG, then land the held v3.2.46.** `StateService.generateActionId()` (:1836) builds ids with `Math.random()`; `DiceService` (:67) rolls from the same global; `tests/ghost/ghostPlayer.ts:619` replaces that global with `mulberry32(seed)`. So **one draw is burned per log line and log volume decides dice values.** Fix: monotonic counter for `generateActionId()` + `generatePlayerId()` (:1629) — ids stay unique, nothing parses their format. Then `npm run test:ghost` and expect 47/3/0 to return *with* the guard in place. **This is measured, not a hypothesis** — see below.
2. **Decide who the game is for — now with real evidence.** A run against live v3.2.47 confirmed the "Let one expeditor go" rename worked (the old "returning suggests giving it back" confusion is gone) and surfaced what sat underneath it, **8 hits**: *"the term 'expeditor' is unclear jargon, and the benefit of letting one go is unknown."* Fixing wording one term at a time keeps revealing the same gap — that is the argument that this is a fork, not polish. Insiders (keep the jargon, lean into edge-case events) or broader players (tutorial, tooltips, micro-lessons)? **His call, and it gates the onboarding work.**
3. **Look at the TV.** v3.2.44's screen-size calibration ("Adjust screen size" in the footer) and the board zoom floor are now live but were **never verified on real hardware** — both only execute on a real panel. fb:93449bf2 flips only after the maintainer confirms the TV reads well across a room; a browser cannot judge it.

## The RNG finding — measured, not inferred
Four runs of `ghostPlayerSmartBot`, same seed (`baseSeed=100001`):

| when (UTC) | TurnService guard | result |
|---|---|---|
| 2026-09-02 23:26 | absent | 47 / 3 / **0 hard** / 86.9 — pass |
| 2026-09-03 00:16 | present | 48 / 2 / **1 hard** / 94.9 — fail |
| 2026-09-03 00:33 | present | 48 / 2 / **1 hard** / 94.9 — fail |
| 2026-09-03 00:46 | absent | 47 / 3 / **0 hard** / 86.9 — pass |

47/3/0/86.9 had been stable across 23 runs since 2026-08-26. Nothing in the bot or any decision path reads `globalActionLog` — it is write-only for decisions. The swing is RNG-stream alignment, not behaviour. **⚠️ Corollary: any cosmetic "tidy the log noise" change silently re-deals every seeded game.** Fix the coupling first.

## Post-wrap addendum — v3.2.45 is CONFIRMED WORKING, and the next trap is named
The first playtest run against deployed v3.2.45 landed after the sweep. Verified off the server (`G-5RJ3-XFQW`), not from the bot's own account:

| | this morning, v3.2.43, 6 games | run 5, v3.2.45, 1 game |
|---|---|---|
| Try Agains at `OWNER-SCOPE-INITIATION` | **11** | **0** |
| committed moves | 16 total (2.7/game) | **7 in one game** |

The opening-space trap is gone. The bot then burned **5 Try Agains at ARCH-FEE-REVIEW at 50 days each — 250 of its 272 total days on one space.** The wording half of that ("Return Expeditor") **shipped as v3.2.47**; the 50-day disclosure question is open above. One game only, and no bot has yet finished a full game.

## Test failures to address
None outstanding on master. The one hard ghost failure above appears only with the *held* guard applied, and is a symptom of item 1, not a game regression. Worth a look once the noise is gone: it was a LOOP at `OWNER-DECISION-REVIEW` — a bot pressing Try Again out to 4,259 days. That loop was always reachable; the re-deal just walked into it. Same shape as the trap v3.2.45 fixed in the UI.

## Decisions waiting on the user
- **The audience fork (item 2)** — now backed by evidence, and it unblocks real work.
- **Does the 50-day Try Again cost at ARCH-FEE-REVIEW need to be visible before you commit?** The bot walked into it twice with **no mention of a cost anywhere in its stated reasoning** — evidence about disclosure, not balance. Related: the "Push back never states its cost" finding was withdrawn 2026-09-02 (correctly — `startHold` reveals the bubble on pointer-down), but that reasoning holds at a **1-day** space and may not at a **50-day** one.
- **Card library Stage 4, the group/school tier.** Deferred 2026-08-25 ("skip the middle shelf"), not rejected; `group` is a valid tier nothing writes, so adding it later is additive.
- **`DataEditor` is unreachable but deliberately still in the tree** as a fallback — delete once the merged screen is confirmed good in real use.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** v3.2.44 is now live, but the whole point is that a browser cannot judge it: flip only after he confirms the TV reads well across a room. Rolled forward deliberately, not forgotten.

## Suggested first move
Item 1 is small, fully diagnosed, and unblocks a finished fix — a counter in two functions, then one `npm run test:ghost` to confirm 47/3/0 returns with the guard in place. Ask whether he wants that first, or whether he'd rather answer the audience fork while the "expeditor is jargon" evidence is fresh — that one only he can settle.

## Suggested model for next session
Sonnet 5 — item 1 is a two-line change with a clear verification step, and items 2–3 need the maintainer, not deeper reasoning. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- **Deploy runs from a Windows terminal, not WSL:** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand it over by default — the maintainer explicitly overrode that once this session ("deploy it"), which is his call to make, not a change to the standing rule.
- **Verifying a deploy: grep the RIGHT chunk.** The build is code-split. v3.2.47's strings live in `assets/services-*.js`, and `index-*.js` returned **zero hits on a perfectly good deploy** — indistinguishable from a shipped-old-version failure. `/health` gives the running commit; `grep -rl "<string>" dist/assets/*.js` finds the chunk locally; then fetch that chunk live. `/koniec` step 4a was corrected the same day.
- **Say which folder you are in, every time.** Two Claude sessions share repos and git cannot tell them apart — every commit here is authored `Claude AI <claude@game-alpha.local>`. The reliable fingerprint is the **test count**: `npm test` ≈ 201 files/3084 tests (ghost excluded); a run *including* `tests/ghost/**` ≈ 211/3118.
- **`npm test` ≠ the full suite.** It excludes `tests/ghost/**` by config. A green `npm test` says nothing about the ghost gates.
- **The Browser pane reports `document.visibilityState: "hidden"` until you `tabs_select` the tab** — then it goes `visible` at 1280x720. This is what blocked the Con-Initiation crash repro in two prior sessions; it is now unblocked, and that bug remains untested.
- **Never pipe a backgrounded suite through `tail`** — the failing test's identity prints *above* the counts and is destroyed.
- `io.open(path,'w')` truncates before writing; a patch script that raises mid-write leaves the file EMPTY.
