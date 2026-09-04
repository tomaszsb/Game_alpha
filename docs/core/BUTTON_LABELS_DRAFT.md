# Button labels — draft for approval

**81 labels: 35 card buttons + 46 dice buttons.** (A 47th dice row exists but is a malformed header fragment that renders no button — see item 2 at the bottom.)

**Status:** DRAFT, nothing applied. Written 2026-09-04. Approve, edit, or reject line by line the way you did the tile labels in v3.2.50.

## The rule you set

> Buttons say what you're doing, in everyday words. No trade jargon on buttons.
> Glossary links can't go on buttons (`TextWithTerms` swallows the click — tested and rejected), so a button is the one surface where a hard word can never explain itself. Teach vocabulary in the story and glossary; the button just says the action.

Two consequences applied throughout:

- **"Expeditor" comes off every button.** Including `return_e` — "Let one expeditor go" (v3.2.47) fixed the *direction* problem but left 8 hits of "I don't know what an expeditor is", so it is redrafted here rather than used as the template. The word stays in the story prose and the glossary, where it can explain itself.
- **"Work Package", "Bank Loan", "Investment"** are treated the same way on buttons — the button says the action ("Add work to the job"), not the game's noun for the thing.

## Where these live — no schema change needed

Same shape as the tile fix. Every column already exists and is simply empty:

| Button | Source file | Column | Filled today |
|---|---|---|---|
| Card actions | `SOURCE_FILES/Spaces.csv` | `w_card_label`, `b_card_label`, `i_card_label`, `e_card_label` | **0 / 105** |
| Dice actions | `SOURCE_FILES/DiceRoll Info.csv` | `button_label` | **0 / 113** |
| End Turn | `SOURCE_FILES/Spaces.csv` | `end_turn_label` | 50 / 105 — **your wording, already done** |
| Try Again | `SOURCE_FILES/Spaces.csv` | `try_again_label` | 27 / 105 — **your wording, already done** |

The draft below follows the register of the two you already authored ("Lock the scope", "Take the check", "Push back on the fee"): verb-first, everyday words, 2–5 words, specific to the space.

`SPACE_EFFECTS.csv` is **generated** — these edits go in the two SOURCE files above, then `node scripts/regen-clean-files.mjs`. Editing the CLEAN file directly would be erased and would fail `pipelineFaithful`.

---

## Card buttons (35)

| Space | Visit | Action | Current | **Proposed** |
|---|---|---|---|---|
| Architect's Fee | First | Return 1 | Let one expeditor go | **Cut back your help** |
| Architect's Fee | Subsequent | Draw 1 | Hire Expeditor | **Bring in more help** |
| See the Design | First | Replace 1 | Replace Expeditor | **Swap in different help** |
| See the Design | Subsequent | to your right | Expeditor Reassigned (right) | **Pass help to your right** |
| Bank Review | First | Draw 1 (bank) | Get Bank Loan | **See the bank's terms** |
| Bank Review | First | Draw 2 | Hire 2 Expeditors | **Bring in extra help** |
| Bank Review | Subsequent | Draw 1 (bank) | Get Bank Loan | **See the new terms** |
| Bank Review | Subsequent | Return 1 | Let one expeditor go | **Cut back your help** |
| Cut a Corner | First | Return 1 | Let one expeditor go | **Cut back your help** |
| Cut a Corner | Subsequent | Return 1 | Let one expeditor go | **Cut back your help** |
| Hire a Builder | First | Draw 3 | Hire 3 Expeditors | **Bring in extra help** |
| Hire a Builder | Subsequent | Draw 1 | Hire Expeditor | **Bring in more help** |
| Site Inspection | First | Return 1 | Let one expeditor go | **Cut back your help** |
| Site Inspection | Subsequent | Draw 2 | Hire 2 Expeditors | **Bring in extra hands** |
| Trouble On Site | First | Replace 1 | Replace Expeditor | **Swap in the right specialist** |
| Trouble On Site | Subsequent | to your right | Expeditor Reassigned (right) | **Pass help to your right** |
| Investor Review | First | Replace 1 | Replace Expeditor | **Swap in different help** |
| Investor Review | Subsequent | to your left | Expeditor Reassigned (left) | **Pass help to your left** |
| Lender Review | First | Draw 1 | Hire Expeditor | **Bring in extra help** |
| Lender Review | Subsequent | Return 1 | Let one expeditor go | **Cut back your help** |
| Meet the Owner | First | Draw 3 | Hire 3 Expeditors | **Bring in extra help** |
| Pick Your Path | First | Replace 1 | Replace Expeditor | **Swap in different help** |
| Pick Your Path | Subsequent | to your right | Expeditor Reassigned (right) | **Pass help to your right** |
| City Filing Fee | First | Draw 2 | Hire 2 Expeditors | **Bring in extra help** |
| City Filing Fee | Subsequent | Replace 1 | Replace Expeditor | **Swap in different help** |
| Final Approval | First | Draw 3 | Hire 3 Expeditors | **Bring in extra help** |
| Final Approval | Subsequent | Draw 1 | Hire Expeditor | **Bring in more help** |
| Quick Play | First | work | Add Work Package | **Add work to the job** |
| Quick Play | First | bank | Get Bank Loan | **Borrow from the bank** |
| Quick Play | First | investor | Get Investment | **Raise money from investors** |
| Quick Play | First | help | Hire Expeditor | **Bring in extra help** |
| Quick Play | Subsequent | work | Add Work Package | **Add work to the job** |
| Quick Play | Subsequent | bank | Get Bank Loan | **Borrow from the bank** |
| Quick Play | Subsequent | investor | Get Investment | **Raise money from investors** |
| Quick Play | Subsequent | help | Hire Expeditor | **Bring in extra help** |

## Dice buttons (46)

`Determine Time Impact` alone is **23 of these** — the most-pressed button in the game.

| Space | Visit | Category | Current | **Proposed** |
|---|---|---|---|---|
| Architect's Fee | First | Fees Paid | Determine Fee Amount | **See what he's asking** |
| Architect's Fee | Subsequent | Fees Paid | Determine Fee Amount | **See what the extra costs** |
| See the Design | First | W Cards | Get Work Packages | **See what the design adds** |
| See the Design | Subsequent | W Cards | Get Work Packages | **See what changed** |
| Cut a Corner | First | Time outcomes | Determine Time Impact | **See if it costs you time** |
| Cut a Corner | First | Fees Paid | Determine Fee Amount | **See what the fine is** |
| Cut a Corner | Subsequent | Time outcomes | Determine Time Impact | **See how long it sets you back** |
| Cut a Corner | Subsequent | Fees Paid | Determine Fee Amount | **See what it costs you** |
| Hire a Builder | First | Quality | Assess Quality | **See how good his work is** |
| Hire a Builder | First | Multiplier | Determine Outcome | **See what it adds up to** |
| Hire a Builder | Subsequent | Time outcomes | Determine Time Impact | **See how long the change takes** |
| Hire a Builder | Subsequent | Fee Paid | Determine Fee Amount | **See what the change costs** |
| Site Inspection | First | Time outcomes | Determine Time Impact | **See how long the inspection takes** |
| Site Inspection | Subsequent | Time outcomes | Determine Time Impact | **See how long the walk takes** |
| Trouble On Site | First | Time outcomes | Determine Time Impact | **See how long you're stopped** |
| Trouble On Site | Subsequent | Time outcomes | Determine Time Impact | **See how long it slows you** |
| Engineer's Fee | First | Fees Paid | Determine Fee Amount | **See what the fee is** |
| Engineer's Fee | Subsequent | Fees Paid | Determine Fee Amount | **See what the extra costs** |
| Check the Structure | First | W Cards | Get Work Packages | **See what the design adds** |
| Check the Structure | Subsequent | W Cards | Get Work Packages | **See what changed** |
| Finish | First | Time outcomes | Determine Time Impact | **See your final time** |
| Finish | Subsequent | Time outcomes | Determine Time Impact | **See your final time** |
| Investor Review | First | I Cards | Seek Investments | **See what they'll put in** |
| Investor Review | First | Time outcomes | Determine Time Impact | **See how long they take** |
| Investor Review | Subsequent | I Cards | Seek Investments | **See what's left on the table** |
| Investor Review | Subsequent | Time outcomes | Determine Time Impact | **See how long they take** |
| Lender Review | First | W Cards | Get Work Packages | **See what the plan covers** |
| Lender Review | Subsequent | W Cards | Get Work Packages | **See what he'll cover now** |
| Owner Decides | First | W Cards | Get Work Packages | **See what the owner wants** |
| Owner Decides | First | E cards | Hire Expeditors | **See who he sends you** |
| Owner Decides | Subsequent | W Cards | Get Work Packages | **See the owner's call** |
| Owner Decides | Subsequent | E cards | Hire Expeditors | **See who he sends you** |
| Meet the Owner | First | W Cards | Get Work Packages | **See what he wants built** |
| Meet the Owner | Subsequent | W Cards | Get Work Packages | **See what he wants now** |
| The Audit | First | Time outcomes | Determine Time Impact | **See how long the audit takes** |
| The Audit | Subsequent | Time outcomes | Determine Time Impact | **See how long it takes to close** |
| City Filing Fee | First | Time outcomes | Determine Time Impact | **See how long the counter takes** |
| City Filing Fee | Subsequent | Time outcomes | Determine Time Impact | **See how long the counter takes** |
| Final Approval | First | Time outcomes | Determine Time Impact | **See how long final review takes** |
| Final Approval | Subsequent | Time outcomes | Determine Time Impact | **See how long final review takes** |
| City Checks Plans | First | Time outcomes | Determine Time Impact | **See how long the check takes** |
| City Checks Plans | Subsequent | Time outcomes | Determine Time Impact | **See how long the second read takes** |
| Self-Certify | First | Time outcomes | Determine Time Impact | **See how long filing takes** |
| Self-Certify | Subsequent | Time outcomes | Determine Time Impact | **See how long filing takes** |
| Fire Dept. Review | First | Time outcomes | Determine Time Impact | **See how long fire review takes** |
| Fire Dept. Review | Subsequent | Time outcomes | Determine Time Impact | **See if you get the stamp** |

---

## Three things to decide alongside the wording

1. **`formatDiceRollButton` is dead code.** 74 lines in `src/utils/buttonFormatting.ts`, zero call sites. Six `DICE_BUTTON` keys are reachable *only* through it (`FUNDING`, `EFFECTS`, `BONUS`, `BONUS_FUNDING`, `BONUS_EFFECTS`, `NEXT_STEP`) and so are dead too. Delete with this change, or leave it?

2. **A malformed row in `DiceRoll Info.csv`** has `die_roll` set to the literal string `button_label` and a blank `space_name` — a header fragment that got into the data. It produces no button today. Worth deleting while we're in the file.

3. **`PlayerPreviewPanel.tsx` re-implements the label logic** instead of calling it (lines 139 and 154 say "Mirrors formatManualEffectButton"). It is the editor's preview pane, so if we change wording it will silently disagree with the real game. I'd point it at the real function rather than copy the new strings into it — otherwise this drifts again the next time anyone edits a label.

## What happens after you approve

1. Write approved strings into `Spaces.csv` (4 card columns) and `DiceRoll Info.csv` (`button_label`).
2. `node scripts/regen-clean-files.mjs` — regenerates `SPACE_EFFECTS.csv` only.
3. Add a guard test in the shape of `tests/utils/boardCommon.test.ts`'s uniqueness check: every manual effect row resolves to a non-empty label, and no button still contains a jargon term from a small blocklist ("expeditor", "work package").
4. `npm test` + `npm run test:ghost`, then deploy.
