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
