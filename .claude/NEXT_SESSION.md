# Next session starter — written 2026-10-25 by the Game session (v3.8.83), session being archived

Written by the Game session working for the Manager session. Folder: `D:\Unravel\Current_Game\Game_Alpha` (branch master).

## State at handoff
- **Version:** v3.8.78 (3.8.76-78 are Tom's phone findings, below), committed + pushed, **NOT deployed** (Tom deploys himself: hand him `ssh unraid ...` / `bash deploy.sh`; never deploy). Before saying what is live, compare `https://game.unravelcodes.com/health` (a commit hash) with `git rev-parse --short HEAD`. Do NOT trust this note for the live version.
- **Checks at 3.8.74:** `npm test` 326 files / 4287 pass; build OK; `npm audit` 0. 3.8.75 touched only footer link styling (+1 test). The deploy gate (`deploy.sh`) runs `npm ci` + `npm test` only: **lint is not part of it**. Lint today: 2 errors + 24 warnings (older: `scripts/build-board-flowchart.mjs`, `server/mailer.js`, a `react-hooks/set-state-in-effect` warning). Typecheck shows only 5 old `tests/server/dataGate.test.ts` express-types errors.

## Built (this stretch)
- Robot Banker (3.8.65-69), school logo + name (3.8.65), builder-bid signing (3.8.70), office Move list grouped by stage (3.8.71), flaky-test fix (3.8.72).
- **Reps with a salary (3.8.73):** hire/fire from "Your team" on the Expeditors page, good/bad at one area, 1-in-20 roll on arrival, stop work order for a bad rep. Data `REPS.csv` + built-in `DEFAULT_REP_ROWS` (a test pins file == built-ins).
- **The auto-run (3.8.74):** after 2 send-backs in a row the pop-up "Go round again?" offers "Send your filing rep" (greyed "Needs a filing rep" with none held). `AutoRunService.ts`, `autoRunRules.ts`; counter `sendBackCount` is an optional player field outside the push-back snapshot. Ghost option `autoRun`; measure `tests/ghost/autorunMeasure.test.ts` (`AUTORUN_MEASURE=30`, writes `.claude/autorun-measure.md`).
- **3.8.75:** setup-screen footer links now take the sentence colour and are underlined (was blue on blue). Not seen on a real TV.

- **3.8.76 bank wording:** Tom's "funding did not show" was NOT a money failure. Live game G-EQYH-VZAJ: the banker refused (answer refuse, $0, bankRefusals 1), owner's $440,000 arrived; the result line wrongly said "Secured a Bank Loan". Now "The bank said no: no loan this time" / "Bank loan approved: $X" (`ManualActionProcessor`, test `BankResultWording`).
- **3.8.77 rep picker:** hire list shows all 3 people at once inside the Expeditors pop-up (scrolling, max 190px), each with a "Good at / Weak at <area>: N days ..." line (`repStrengthLine`); screen uses `RepService.getOffers/hireOne`, robot/tests still `hire()`. Tom's point (d) "new cards, not the old ones" is only REPORTED, not changed: the Expeditors page lists expeditor cards (emoji + Activate) first, then a separate "Your team" block of reps (no emoji, no Activate, pay + Let go); reps never enter the hand.
- **3.8.80 trophy boxes:** PC circle row now ABOVE the clipboard (phone dots stay in the header); Time/Scope/Money box label rows show the trophy picture + place (`TrophyPlace.tsx`; picture path in the `value` cell of the TROPHIES.csv trophy rows, emoji fallback; final art copied from `public/assets/trophies/v4_leaning/` to `public/images/trophies/`, assets untouched). Measured in a browser: box/label-row heights identical with and without the place at 360x640 and 390x844.
- **3.8.81 markers + stamps:** `trophyBubbles()` (townLayout.ts) adds a plus/minus + new place bubble in the town balloon after the player's own numbers change (TownBoard compares `racePlaces` before/after); box arrows for 6 s; `useStamp` in ProjectMat.tsx ringed + "✓ DOB approved" label 6 s, which steps stamp = `stamp` rows in TROPHIES.csv. Animations do not run in the Browser pane: needs a real phone/TV look. NOT built: the ninth "Final inspection" circle (waits for the Inspector work).
- **3.8.82 view plate:** the town board's 7 corner buttons are one plate (`TownViewPad.tsx`): arrows round a fit button, zoom +/-; hidden on TV, folded to a "View" button on the remote strip. `screen` prop ('pc'|'tv'|'remote') runs BoardCanvas > GameBoard > TownBoard. Arrow movement not watched (no animation in the test browser).
- **3.8.83 clocks:** `gameStartDate` ('YYYY-MM-DD', set once at PLAY in `StateService`), `gameClock.ts` (date = start + that player's `timeSpent`), `TownClocks.tsx` (flip clock per band, pinned to the visible top, TV 1.6x, remote = one slim clock, shuffle 0.6 s by timers, reduced motion = ring). Clock sits at the middle of each band's cut line (zIndex 1800: above buildings, under open signs/bubbles); band 0's clock lands over buildings on the island edge: nudge if Tom dislikes it. Bands not cut yet = design step 3. Remote/TV screens and the shuffle are NOT seen live.
- **3.8.78 builder box:** the grey "lender is one door away" note is now a button (same pick as the lender row in the Move list; no rule change; bids stay on the player). Measured in a real browser (Chrome pane, 2026-10-25) at 360x640 and 390x844: the new button is 15px tall against 17px for the old note plus its margin, so the player panel got 2px SHORTER, not bigger. The hire list lives in the Expeditors pop-up, which sizes to its content and grows from 341px to 522px tall while the list is open (screen is 640; the list scrolls inside, max 190px) - the player panel behind it is unchanged. Still needs a real-phone look.

## Known gaps (honest)
- **The run is rarely triggered in robot games:** 30 seeded games, only 3 (good rep) and 4 (bad rep) ever sent the rep, because the robot is rarely sent back twice in a row and its rep often quits first. So the ghost table cannot prove the estimated 15-days-a-circle saving; only the unit test with fixed rolls proves the keep-the-better rule. Tom said: do NOT change how long reps stay.
- Not checked on a real phone or TV: the auto-run pop-ups (checked in the browser at 360x640 and 390x844 only), the setup links, the reps "Your team" block.
- Reps measure: reps show no clear win or loss in 30 games (noise-sized).

## Designed, NOT built (Tom has not given the go; each is its own fresh session)
- **Trophy race on the board:** `docs/core/BETA_PLAN_V3.md` section "### 5. Show the trophy race all game; approvals stamp the mat" (circle row above on PC, race places in clipboard boxes, 9th circle "Final inspection", stamps) and "### 5b. Trophy markers" (plus/minus and new place after Commit or Negotiate). About 4.5 days; the 9th circle waits on the Inspector work below.
- **Inspector sign-off and TCO vs final CO:** BETA_PLAN_V3.md N3 items "### 1. Inspector sign-off" and "### 3. TCO vs final CO at the end". Needs Tom's numbers and a source for TCO rules.
- **Time on the town board:** `docs/core/TIME_ON_BOARD_DESIGN.md`, section 6 "Final build order": 1 d-pad box (BUILT 3.8.82), 2 clocks (BUILT 3.8.83), 3 bands and monthly looks, 4 trees, 5 weather and light, 6 flowers/grass/leaves, 7 polish + real-TV pass (about 18 days, 28 pictures; steps 1-2 need no pictures).
- **Bad rep's mistake worded by phase:** BETA_PLAN_V3.md note "#### 2b" (BUILT 3.8.79, Tom approved 2026-10-25): `mistake` rows in REPS.csv + `mistakeWords()`; Code = wrong records / design error, Permits = upset a city official / audit, Inspections keeps stop work order; same prices. Funding wording PARKED (no rep area covers funding). The pop-up sentence is a line longer for Code: not measured in a browser.
- Parked: Save time / Save money buttons for the run (no die needs them yet).

## Files drawn by other sessions, NOT committed, NOT wired
`git status` shows only `public/assets/` untracked (26 files): `public/assets/trophies/` (money.png, quality.png, time.png, contact_sheet.png, `v1/`, `v1/rejected/`, `v2_tries/`) and `public/assets/inspector/` (final_inspection.png, contact_sheet.png, `rejected/`). They belong to the trophy-art session. Do not add or delete them from a code job. When Tom picks the pictures: the trophy art session (or a fresh one) copies the chosen finals into a wired path, leaves `rejected/` and contact sheets out of the commit, and wires them with the trophy-boxes build (5/5b). Nothing in the game reads them yet.

## Standing rules (Tom)
- **Tom deploys himself.** Never run `deploy.sh`; push first (`git status -sb` must not say "ahead"), hand over the command.
- One writer per folder; several sessions across two repos, so every report starts with the agent name and absolute folder.
- Plain 5th-grade English reports, at most 2 questions, my pick first. Say "RPG", never "D&D". No game language in player copy (no die numbers, no "card").
- Own commit and version per code job; patch number caps at 99. Commit + push only when full `npm test`, build and `npm audit` pass; commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- The phone panel must never get bigger (measure 360x640 and 390x844). Weekly token allowance is tight: state the cost before big steps.
- Windows traps: CRLF files need byte-exact edits (Python); heredocs with apostrophes break (use Write); `grep -c $'\r'` lies.

## Top open items
1. Tom's go on one of the designed items above (the Inspector sign-off / ninth circle is next; the trophy boxes, markers and stamps are built).
2. Tom's answers on the stop-work-order wording (2 questions above).
3. A real phone / TV look at the new pop-ups and the setup footer.
