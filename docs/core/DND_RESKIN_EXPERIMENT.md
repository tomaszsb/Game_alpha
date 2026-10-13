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
