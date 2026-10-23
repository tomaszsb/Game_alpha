# D&D reskin — the rule and the experiment

> Consumed from Tom's old `idea.txt` draft (2026-10-07); the persona text and all stale facts
> (version, service count, test-batch script) were dropped. Status: **experiment ON HOLD.**

## The standing rule (permanent)
The engine must serve this game **and a D&D version with data changes only**. For any change, ask:
"If I swapped the CSVs for D&D encounter data, would this still work?" If the answer is "I'd have to
rewrite code", the design is not generic: fix the design, not the test. D&D is a constraint on the
engine, not a feature to ship. The invariant and its validation question live in
[ARCHITECTURE.md](../technical/ARCHITECTURE.md) (Workstream 6); open leaks are tracked in TODO.md
under the CSV-only-reskin audit items. Red flags: hard-coded space-id or name checks (they belong in
data flags), numbers or labels a player sees that are typed in code, solutions that only make sense
for permitting.

## The experiment (engagement test, not an architecture test)
**Hypothesis:** players drop out of the permitting game because the theme and board overwhelm them;
D&D is more familiar, so the same complexity would be tolerated and players would get further.

**Design rule: identical structure, different theme.** Same board layout (~40 spaces), same action
flow (move, roll, choose), same turn complexity, same game length. Only data changes: theme, classes,
abilities mapped to the existing action and dice system, items mapped to the existing inventory,
encounters mapped to the existing spaces. No new mechanics, no new systems.

- **Success:** D&D players get further or faster than permitting players on the same engine and structure.
  Then the engine is sound and the permitting game needs an onboarding or narrative fix.
- **Failure:** D&D players stall at the same point. Then board complexity is the barrier: simplify the
  board for BOTH versions.
- **Scope traps (ruin the test):** making D&D simpler or better, adding D&D features, optimizing D&D
  while leaving the permitting game alone.
- **Success metric for the work itself:** "Does this help me ship a better engine for the permitting
  game?" If we are building D&D features, we are doing it wrong; if we are proving the architecture
  generalizes, we are on track.

## Why it is on hold
Engagement data cannot yet settle the question: the first reading ("join friction is the bottleneck")
was retracted on 2026-09-01 because solo games are Tom's own testing and the stats cannot exclude his
sessions (see the engagement item in TODO.md). Revisit when there is real class data.

## Moved from TODO.md (2026-10-13; full wording in [TODO-full-2026-10-13.md](../archive/TODO-full-2026-10-13.md))

- **Engagement data (read 2026-08-15, verdict RETRACTED 2026-09-01).** Of 15 `GAME_STARTED` events since tracking began (v3.1.89, 2026-08-02), 6 were agent test sessions; of 9 real games 4 were single-player and never got a second player, 1 played to the end, 2 made real progress. "Join friction is the blocker" was drawn from that and withdrawn: Tom said solo games are him testing alone, and the stats cannot tell his sessions from strangers. **Prerequisite built v3.2.65:** `/api/admin/engagement-stats` returns a `byOrigin: {home, foreign}` split (same `isHomeIP()` as the foreign-game alert). Re-read it with `foreign` only once there is meaningfully more foreign traffic than ~9 games. This dataset has twice produced a confident verdict that dissolved once we knew who was at the keyboard.
- **Second instance `dnd.unravelcodes.com` (raised 2026-08-03, ON HOLD, no D&D CSVs exist).** Plan: a second container (`game_alpha_dnd`, host port 3081 to 3001, same image, own bind-mounted data dir; `DATA_DIR` is already a runtime volume, no code change). Open decision: where the D&D CSVs live (a second `public/data-dnd/` tree picked by a build arg vs. a separate branch). Two steps outside the repo, Tom's: a Cloudflare DNS record and an Nginx Proxy Manager host to port 3081.
- **Async/decoupled turn order (Tom's idea, 2026-07-13, "fun to think about")** would let players move independently (faster casual play, and a D&D game with separate quests); needs real design (shared cards and time assume one order). fb:feedback-1783919654407-1df093dd.

---

## Design prep: one fantasy RPG board, data only (2026-10-23, inventory first, nothing built)

Sources: `D:\Unravel\Independent_Review\RESEARCH-2.md` §5, the standing rule at the top of this file, and `BETA_PLAN_V3.md` "Workstream 6 - open reskin leaks".

- **The goal in plain words.** A second, fantasy-themed board built with new words and art only (no D&D name), on the same engine, to test whether a familiar theme gets players further. This is the old experiment (ON HOLD, above) in a smaller form. Per Tom's 2026-10-18 idea the product word is "RPG", not "D&D".
- **What already exists.**
  - **The engine is data-driven and most reskin leaks are closed.** Audit I closed in v3.2.2 and most of Audit II in v3.2.56. The data files that carry a board are: `Spaces.csv` and its clean files `SPACE_CONTENT`, `SPACE_EFFECTS`, `MOVEMENT`, `DICE_OUTCOMES`, `DICE_EFFECTS`, `GAME_CONFIG`; `CARDS_EXPANDED.csv` (400 cards); `CHARACTERS.csv` (9 speakers with emoji, colour and image role); `TROPHIES.csv` (the three race names and the mat); `UI_STRINGS.csv`; `GLOSSARY.csv`; `TOWN.csv` (the board picture); `SCOPE_WORDING.csv`.
  - **A second set of data can already be served**: `/data/i/<classroom-id>/...` serves a classroom's own board tree, which is how teacher classrooms work. A fantasy board could be a classroom with a stock tree that is not the permit one (hypothesis, unverified: the instance baker assumes the stock Spaces.csv as its base, so a wholly different board needs a "base board" choice per classroom).
- **What is still code today (from the open-leaks list, each checked in that list, not re-read here).**
  - **Five card families are a closed list** (`CardType = 'W'|'B'|'E'|'L'|'I'`, about 58 comparisons, hard-coded W and E tabs). A fantasy deck must be relabelled into those five, not extended.
  - **Money and days are the only two resources** (`money`/`timeSpent`) and **the die is a d6** baked into the dice file columns (`roll_1..roll_6`).
  - **Architect, Engineer and Contractor are named in code** (`CON-INITIATION` alone in about 10 files), and project-length constants live in code.
  - **Small:** an end-game insight keyed on a phase name, one card-picker chip, and a few words left typed on purpose (quality ids, header-menu words the robot reads, `LEND-SCOPE-CHECK`).
  - **Permit words and pictures in the interface** that a player would see: the real-world explanations (`why` tips, glossary, DOB/FDNY terms), the trophy names, the certificate, the avatar art. Hypothesis, unverified until someone plays a reskinned board: more words are hard-wired in `UI_STRINGS.csv` and the help panels than the leak list shows.
- **Options.**
  1. **A paper reskin first.** Write the one board as data in a scratch folder (about 40 spaces, 60 cards, 9 characters, 3 trophies, the glossary), run it through the existing pipeline (`processGameData`, the pipeline-faithful test shows it is repeatable) and the board-check tool, and play it locally. About 1 to 2 weeks of writing, 1 to 2 days of code to load a non-permit base. Needs no new engine feature.
  2. **Unify the closed lists first** (card families, vendors, resources). The right long-term fix, weeks of work, and the open-leaks list already scopes it. Not needed for a single test board if option 1 maps the five families.
  3. **Do nothing until there is class data.** The engagement verdict was retracted (2026-09-01: solo games are Tom's own testing). The experiment's own rule says to revisit when there is real class data.
- **What could go wrong.** Writing the board is the real cost, not the code. Mapping fantasy ideas onto "scope, money, days" can feel forced and the test would then measure the writing, not the theme. A reskin with a permit glossary and a certificate in the same build confuses teachers. Selling it needs a short paid check by a games or IP lawyer (not legal advice here); do not use "D&D" in a name or logo; the SRD is only needed if real D&D rules go inside.
- **Pick: option 3 for now, option 1 as the first move once a real class gives engagement numbers.** Reason: the code is ready enough that no engine work blocks a test, but the test has nothing to decide until the engagement question can be answered. When it fires, do the paper reskin and one afternoon on the "base board" choice.
- **Needs Tom first:** yes. (1) Does he still want the experiment, now as an RPG with no D&D name, and who writes the board (him, or an agent with his taste review)? (2) The price and the "owner pays" idea belong to a later decision.
