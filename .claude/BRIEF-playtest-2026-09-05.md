# Brief for a Game_Alpha session — 2026-09-05

Paste the block below into a new Claude Code session opened in
`D:\Unravel\Current_Game\Game_Alpha`.

Source: the nightly robot playtest, `~/.hermes/playtest-reports/playtest-2026-09-05.txt`
on the Mac mini (`ssh hermes`), run 03:00–03:46, `Execution: completed`.

---

```
/start

Context: last night's robot playtest (2026-09-05, seed 914815617) finished
cleanly — 3 games, 166 steps, 155 confusions. Read it yourself before trusting
this summary: ssh hermes then
  sed -n '1,60p' ~/.hermes/playtest-reports/playtest-2026-09-05.txt

FIRST, THE HEADLINE THAT HAS NOT MOVED IN A YEAR: no bot has ever finished a
game. Last night: two hit the 80-step cap, one gave up after 6 steps.

READ THIS BEFORE ACTING ON ANY OF IT — the instrument is degrading.
The run logged 81 MODEL ERRORS (up from 24 the night before) and 3 clicks that
would not land, e.g. "pick 1 out of range". 17 findings were dropped by the
report's own trust check for not quoting the screen. So confusion COUNTS are
soft; the confusion TEXTS, which quote real on-screen strings, are solid.
Two findings from this dataset have already dissolved under inspection
(2026-09-02 and 2026-09-04). Treat every item below as a hypothesis to confirm
in the code, never as a defect.

---
ITEM 1 — THE CHECKMARK MAKES LIVE BUTTONS LOOK ALREADY DONE. New, and the
biggest genuinely new signal in the report. ~28 hits across three strings:

  "✓ Determine Outcome"        22 hits — "The checkmark and phrasing imply this
                                is a completed action rather than an available
                                button to press."
  "✓ Meet the Expediting Team"  3 hits — "The tick mark suggests this is a
                                completed action rather than an available
                                button."
  "✅ Moving to: Bank Review"   3 hits — "looks like a status update describing
                                a completed move."

DO NOT dismiss this by pointing at the withdrawn 2026-09-02 finding. That one
said "finished actions still look like live buttons" and was correctly refuted
(doneActionRow is already muted, cursor:default, deliberately same footprint).
THIS IS THE INVERSE: live buttons look finished. Different claim, different
direction, not covered by that refutation. Check where ✓/✅ is prepended to
ACTIONABLE controls.

---
ITEM 2 — "⚡ Cut back your help" IS NOW THE #1 CONFUSION AT 57 HITS.
It was #5 with 15 hits the night before. This is one of v3.2.51's OWN new
plain-English labels, and it is getting worse, not better. The complaint:
"would not know if 'cutting back' means stopping help entirely or reducing it,
nor who will receive the saved help."

Underlying row: SPACE_EFFECTS.csv:55, ARCH-FEE-REVIEW First, `return_e`,
button_label "Cut back your help". It returns ONE expeditor. The label does not
say one, and does not say where they go.

Constraint that still holds (settled 2026-09-04, do not re-litigate): NO trade
jargon on buttons, and never a glossary term inside a button — TextWithTerms
renders <span role="button"> with stopPropagation(), which swallows the click.
So the fix is wording, not a tooltip on the button.
"⚡ Swap in different help" (2 hits) has the same shape.

---
ITEM 3 — THE SEQUENCING CLUSTER, UNCHANGED FROM THE NIGHT BEFORE.
Still the largest group by volume, still unaddressed:

  "THINGS YOU CAN DO"                              16 — reads as a status report
  "You can switch until you end your turn."        14 — "switch" what?
  "➡️ Move — 2 options"                             8 — never says WHAT the two are
  "Finish your other actions first, then pick
   where to go."                                    6 — never says WHICH action

The through-line: the game states a RULE without naming the SUBJECT of the
rule. The single highest-value fix in the whole report is probably naming the
blocking action in that fourth string.

---
WHAT NOT TO DO
- Do not chase the old ghost baseline 47/3/0/86.9. It belongs to the pre-v3.2.48
  RNG-coupled era and cannot return by construction. Current: 50/0/0, ~70.8.
- Do not attempt a Con-Initiation crash repro in an automated browser. It needs
  Tom's own foregrounded browser; automated ones report visibilityState hidden
  and produce false positives. This has burned three sessions.
- Do not put a glossary term inside an action button (see Item 2).

CHECK BEFORE YOU START: docs/core/PROJECT_STATUS.md and .claude/NEXT_SESSION.md
were both STALE on 2026-09-04 — they claimed v3.2.51 was pending deploy when it
was already live (/health → e5cc6a0). Verify against /health, and fix those
files if they are still wrong.

Tom is not technical. Report in plain 5th-grade English without being asked,
and say which folder you are in — two agents share these repos.
```
