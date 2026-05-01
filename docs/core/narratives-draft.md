# v2.50.1 Authored Narratives — Draft

**Status:** draft for review before merging into `public/data/SOURCE_FILES/Spaces.csv`
**Format:** one narrative per effect_action, per (space, visit_type). Italic, NPC-voiced, ~1–2 sentences.
**Merge plan:** append `w/b/i/l/e_card_narrative` columns on each row; regenerate `CLEAN_FILES`; commit as v2.50.1 (content-only).

Already authored (v2.50.0, for reference):
- `OWNER-SCOPE-INITIATION/First` e_card
- `ARCH-FEE-REVIEW/First` l_card, e_card
- `ARCH-FEE-REVIEW/Subsequent` l_card, e_card

Skipped (by design):
- `START-QUICK-PLAY-GUIDE` — tutorial instructions already in value column
- `OWNER-FUND-INITIATION` — no card/dice actions, only time
- Most `time/add` (mechanical, 1 day) — covered by Event header

---

## SETUP

### OWNER-SCOPE-INITIATION / Subsequent

- **e_card (Draw 3)**: *"The owner hands you the same stack — but watch them watching you pick. Second chances don't come cheap."*
- **dice (W Cards)**: *"You owe the owner a scope. Roll for how much they're letting you take on this time."*

---

## OWNER (decisions)

### PM-DECISION-CHECK / First

- **l_card (auto, roll 1)**: *"Five days of phone calls and three different strategies later. Life taps you on the shoulder."*
- **e_card (Replace 1)**: *"Your staff saw greener grass at the competition. Swap out whoever's weakest — you need the A-team for this call."*

### PM-DECISION-CHECK / Subsequent

- **e_card (person to right takes)**: *"You're still deciding. Your right-hand neighbor reaches past you and picks an expeditor off the pile — payback for last time."*
- **l_card (auto, roll 2)**: *"Decisions pile up while you're deciding. Roll, and see what the universe decided for you."*

### OWNER-DECISION-REVIEW / First

- **l_card (auto, roll 1)**: *"Ten days waiting on an owner decision. Enough time for life to find you."*
- **dice (E cards)**: *"Owner's got a list of people they want on this. Roll — you're getting expeditors whether you like them or not."*
- **dice (W Cards)**: *"Owner's pushing scope. Roll — you're taking on more work."*

### OWNER-DECISION-REVIEW / Subsequent

- **l_card (auto, roll 2)**: *"Owner's impatient now. Five days and they want an answer. Life still does what life does."*
- **dice (E cards)**: *"Owner's pushing the same list, now with urgency. Roll."*
- **dice (W Cards)**: *"Scope again. Owner wants finish line — not yours, theirs. Roll."*

### CHEAT-BYPASS / First

- **l_card (auto, roll 3)**: *"You're cutting corners. The universe is watching."*
- **e_card (Return 1)**: *"The scheme needs fewer witnesses. Send one of your expeditors home."*
- **dice (Time outcomes)**: *"Dice decide whether the shortcut saves days or costs them. Roll."*

### CHEAT-BYPASS / Subsequent

- **l_card (auto, roll 4)**: *"Second time around, cleaner plan. The universe still notices."*
- **e_card (Return 1)**: *"Same drill. One fewer pair of eyes — send an expeditor home."*
- **dice (Time outcomes)**: *"Roll. Luck's been kind to you exactly once."*

---

## FUNDING

### LEND-SCOPE-CHECK / First

- **e_card (Draw 1)**: *"Your expeditor pipes up — they know a guy who can get this deal over the line. Hire them on the spot."*
- **l_card (auto, roll 3)**: *"Scope talks drag on. The world doesn't freeze while you negotiate."*
- **dice (W Cards)**: *"Rate is locked in — now they'll tell you how much scope it actually bought you. Roll."*

### LEND-SCOPE-CHECK / Subsequent

- **e_card (Return 1)**: *"Lender wants fewer fingers in the pie. Let one of your expeditors go before the paperwork is signed."*
- **l_card (auto, roll 4)**: *"Back at the table, back to square one. Life keeps ticking."*
- **dice (W Cards)**: *"Fresh deal, fresh terms. Roll for this round's scope."*

### BANK-FUND-REVIEW / First

- **b_card (Draw 1)**: *"Banker slides a term sheet across the desk. Conservative, boring, exactly what you'd expect — sign and draw your loan."*
- **e_card (Draw 2)**: *"Paperwork this thick takes muscle. Pick up two expeditors to shepherd the closing."*
- **fee (deduct, tiered)**: *"Interest: the bank's non-negotiable cut. Small loans get the thin rate; bigger loans pay to play."*

### BANK-FUND-REVIEW / Subsequent

- **b_card (Draw 1)**: *"Second trip to the bank. Same paperwork, worse mood — draw the loan and get out before they change their mind."*
- **e_card (Return 1)**: *"The bank wants a leaner crew on the closing. Send one of your expeditors home."*
- **fee (deduct, tiered)**: *"Interest again — this time with a side of side-eye from the loan officer."*

### INVESTOR-FUND-REVIEW / First

- **l_card (auto, roll 5)**: *"Investors like to move fast. Life moves faster."*
- **e_card (Replace 1)**: *"Investor doesn't love one of your people — wants someone more aggressive. Swap them out."*
- **dice (I Cards)**: *"They're deciding how big a check they'll cut. Roll."*
- **dice (Time outcomes)**: *"And how long they'll make you wait for it. Roll again."*
- **fee (deduct, 5%)**: *"Five points off the top. Investor's cut — no negotiation."*

### INVESTOR-FUND-REVIEW / Subsequent

- **e_card (person to left takes)**: *"Your left-hand neighbor smells blood and takes an expeditor off your bench."*
- **l_card (auto, roll 6)**: *"Fresh round, same patterns. Life rolls through."*
- **dice (I Cards)**: *"Round two. Investor's feeling generous — or stingy. Roll and find out."*
- **dice (Time outcomes)**: *"Clock starts the moment they sign. Roll."*
- **fee (deduct, 5%)**: *"Same five points. The cost of investor money never gets cheaper."*

---

## DESIGN

### ARCH-INITIATION / First

- **l_card (auto, roll 1)**: *"The hunt for the right architect takes weeks. A lot happens in weeks."*

### ARCH-INITIATION / Subsequent

- **l_card (auto, roll 2)**: *"Redesign talks, phase two. Life doesn't wait for the architect to figure it out."*

### ARCH-SCOPE-CHECK / First

- **l_card (auto, roll 5)**: *"Fifty days into the final presentation. A lot can happen in fifty days."*
- **e_card (Replace 1)**: *"Architect's assistant isn't cutting it. Replace one of your expeditors with someone who can read these drawings."*
- **dice (W Cards)**: *"The final scope presentation. Roll for how much work the architect locked in."*

### ARCH-SCOPE-CHECK / Subsequent

- **e_card (person to right takes)**: *"Architect wants a familiar face on the team. Your right-hand neighbor snags one of your people."*
- **l_card (auto, roll 6)**: *"Another round of design review. More weeks, more life."*
- **dice (W Cards)**: *"Revised scope. Roll — the architect's holding the pen."*

### ENG-INITIATION / First

- **l_card (auto, roll 1)**: *"Engineer searches are slower than architect searches — more calls, fewer qualified names. Time passes."*

### ENG-INITIATION / Subsequent

- **l_card (auto, roll 2)**: *"Structural revisions on the back end. The world keeps spinning."*

### ENG-FEE-REVIEW / First

- **l_card (auto, roll 3)**: *"Fifty days of fee back-and-forth. The engineer's meticulous. Life isn't."*
- **dice (Fees Paid)**: *"Engineer's fee, locked in. Roll for how deep the cut goes."*

### ENG-FEE-REVIEW / Subsequent

- **l_card (auto, roll 4)**: *"Additional fees — the engineer's 'friendly reminder.' Life writes its own reminders while you argue."*
- **dice (Fees Paid)**: *"Round two on the fee discussion. Roll."*

### ENG-SCOPE-CHECK / First

- **l_card (auto, roll 5)**: *"Fifty days on the final structural presentation. The engineer triple-checks. Life doesn't."*
- **dice (W Cards)**: *"Structural scope is set. Roll for how much work it actually took."*

### ENG-SCOPE-CHECK / Subsequent

- **l_card (auto, roll 6)**: *"Redesign review — same drawings, faster pace. Life keeps up."*
- **dice (W Cards)**: *"Revised structural scope. Roll."*

---

## REGULATORY — DOB

### REG-DOB-FEE-REVIEW / First

- **e_card (Draw 2)**: *"DOB paperwork is a two-person job. Grab two expeditors to keep the line moving."*
- **l_card (auto, roll 5)**: *"Ten days of DOB processing. Life fills the waiting room."*
- **dice (Time outcomes)**: *"Fee's in. Clock's the variable. Roll."*
- **fee (deduct, 1%)**: *"DOB's standard 1%, written into every filing. Pay and move on."*

### REG-DOB-FEE-REVIEW / Subsequent

- **e_card (Replace 1)**: *"One of your expeditors missed a filing deadline. Swap them — DOB doesn't give second chances on form completeness."*
- **l_card (auto, roll 6)**: *"More waiting at DOB. You know the drill."*
- **dice (Time outcomes)**: *"Roll for this trip's wait time."*
- **fee (deduct, dice-based)**: *"Additional fees, sized by the dice. Whatever you rolled, pay it."*

### REG-DOB-TYPE-SELECT / First

- **l_card (auto, roll 1)**: *"Ten days choosing between slow-safe and fast-risky. Life rolls in either way."*

### REG-DOB-TYPE-SELECT / Subsequent

- **l_card (auto, roll 2)**: *"Waiting for your turn at the clerk window. Life keeps moving in the queue."*

### REG-DOB-PLAN-EXAM / First

- **l_card (auto, roll 3)**: *"Plan exam takes ten days minimum. Life uses the gap."*
- **dice (Time outcomes)**: *"Examiner's pen is hovering. Roll — how many days until their verdict."*

### REG-DOB-PLAN-EXAM / Subsequent

- **l_card (auto, roll 4)**: *"Back for re-exam. Ten more days. Life's consistent."*
- **dice (Time outcomes)**: *"Revised plans under review. Roll for their mood."*

### REG-DOB-PROF-CERT / First

- **dice (Time outcomes)**: *"Clerk barely sees you — a day at most. Roll for which day."*

### REG-DOB-PROF-CERT / Subsequent

- **dice (Time outcomes)**: *"'You again?' — the clerk knows. Roll anyway."*

### REG-DOB-AUDIT / First

- **l_card (auto, roll 5)**: *"Ten days post-audit, life does its thing. Getting audited is only the start."*
- **dice (Time outcomes)**: *"The auditor has questions. Roll — how many days until they're satisfied."*

### REG-DOB-AUDIT / Subsequent

- **l_card (auto, roll 6)**: *"Audit wraps up slower than promised. Of course."*
- **dice (Time outcomes)**: *"Almost through. Roll for the last few objections."*

### REG-DOB-FINAL-REVIEW / First

- **e_card (Draw 3)**: *"Final review is a three-expeditor job. Pick up three — you need the bench depth."*
- **l_card (auto, roll 3)**: *"The clerks are having a birthday. Everything's an hour late. Life uses the hour."*
- **dice (Time outcomes)**: *"Final review wait. Roll."*

### REG-DOB-FINAL-REVIEW / Subsequent

- **e_card (Draw 1)**: *"You're missing one person on the final. Grab an expeditor to round out the team."*
- **l_card (auto, roll 4)**: *"Clerks are in a mood. Slow day. Life takes advantage."*
- **dice (Time outcomes)**: *"Roll — the mood of the room decides today."*

---

## REGULATORY — FDNY

### REG-FDNY-FEE-REVIEW / First

- **fee (deduct, 1%)**: *"FDNY's standard 1% cut. Non-negotiable — fire safety always gets its slice."*

### REG-FDNY-PLAN-EXAM / First

- **l_card (auto, roll 1)**: *"Ten days for FDNY plan review. Fire safety doesn't hurry."*
- **dice (Time outcomes)**: *"Examiner's slow and stern. Roll for patience."*

### REG-FDNY-PLAN-EXAM / Subsequent

- **l_card (auto, roll 2)**: *"FDNY re-review, five days. Faster than first pass. Life still gets in."*
- **dice (Time outcomes)**: *"Speak when spoken to. Roll."*

---

## CONSTRUCTION

### CON-INITIATION / First

- **e_card (Draw 3)**: *"Contractor's vetted their picks — grab three expeditors to run the job."*
- **l_card (auto, roll 3)**: *"Contract negotiation takes days you don't have. Life uses every one."*
- **dice (Multiplier)**: *"Contractor's quality multiplier. Roll — this changes every number downstream."*
- **dice (Quality)**: *"And their actual work quality. Roll again."*

### CON-INITIATION / Subsequent

- **e_card (Draw 1)**: *"Change order needs a runner. Grab one expeditor to shepherd it through."*
- **l_card (auto, roll 4)**: *"Negotiating change orders is its own full-time job. Life does its own."*
- **dice (Fee Paid)**: *"Change order fee. Roll — contractor's not giving it away."*
- **dice (Time outcomes)**: *"Extension length, up to the dice. Roll."*

### CON-ISSUES / First

- **l_card (auto, roll 5)**: *"Site issues take time to resolve, no matter how fast you move. Life fills the cracks."*
- **e_card (Replace 1)**: *"One of your expeditors dropped a detail. Swap them before it costs you more days on-site."*
- **dice (Time outcomes)**: *"Problem's on the table. Roll — how many days to make it go away."*

### CON-ISSUES / Subsequent

- **e_card (person to right takes)**: *"Your neighbor's got a problem-solver they can lend. They lend themselves instead."*
- **l_card (auto, roll 6)**: *"Same problems, different day. Life keeps up the pattern."*
- **dice (Time outcomes)**: *"Roll. Every delay is paid for."*

### CON-INSPECT / First

- **l_card (auto, roll 1)**: *"You're distracting the inspector from something sketchy. Life notices — whether the inspector does or not."*
- **e_card (Return 1)**: *"You can't have too many people around during the 'inspection.' Send one expeditor home."*
- **dice (Time outcomes)**: *"Does it work? Roll — no second chances."*

### CON-INSPECT / Subsequent

- **e_card (Draw 2)**: *"Frank's team wrapped in time — pick up two expeditors to keep the inspection flowing."*
- **l_card (auto, roll 2)**: *"Inspector Johnes takes his time. You use the wait."*
- **dice (Time outcomes)**: *"Roll. Johnes is fair, but fair takes days."*

---

## END

### FINISH / First

- **dice (Time outcomes)**: *"Final tally. Roll — how the project closes out, for good or bad."*

### FINISH / Subsequent

- **dice (Time outcomes)**: *"Again? Well — roll for the closing."*
