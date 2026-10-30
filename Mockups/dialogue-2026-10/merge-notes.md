# Merge notes: one conversation sheet for every stop

Written 2026-10-29 by "dialogue-merge in D:\Unravel\Current_Game\Game_Alpha".
The sheet is `.tmp/dialogue/conversation-merged.csv` (80 rows, opens in Excel). Nothing in the game was changed.

## 1. Where the three sources disagreed, and which one I followed

1. **The old voice rule says card-effect lines stay "ambient narrator from above". Tom's new direction says a narrator must be a faceless caption, never a speech bubble.** I followed Tom's newer direction: every card line is now spoken by the stop's own character (the Contractor says "Boss", and so on). Only the two rules-guide rows use "Narrator (no face)", written as captions.
2. **The old card lines (narratives-draft) describe effects the live game no longer has.** I checked every line against `SPACE_EFFECTS.csv` and followed the live game. Dropped lines:
   - Lender, first visit: "your expeditor knows a guy" (no expeditor effect there now).
   - Bank, first visit: "pick up two expeditors".
   - Final Approval (DOB final review), both visits: "pick up three / one expeditor".
   - Contractor hire, first visit: "pick up three expeditors" plus the quality and multiplier lines (the builder bids replaced them).
   - Contractor hire, return visit: "pick up one expeditor".
   - Site Inspection, return visit: "Frank's team, pick up two expeditors".
   - Owner scope, return visit: the draft has lines for a visit that has no row any more (the review doc deletes it).
   The Pass 2 pop-up list (section 3) has the same stale expeditor effects. Tom confirmed on 2026-10-30 that leaving them out is right: hiring happens only at an office (section 5).
3. **Owner scope, first visit: three contacts or one?** The review doc and the old draft say three. The live data and the live card line say one. I followed the live data.
4. **Who speaks at Find an Architect and Find an Engineer, return visits: SETTLED by Tom (2026-10-30).** A return visit goes back to the same vendor, who has plenty to say about the changing scope, so the Architect and the Engineer now speak (the 2026-04-25 review doc had proposed the same). The flow agrees: PM Decision leads here, and the next stop is, by chance, that vendor's extra-fee talk or the next step on. Today's words were already the vendor's. Both rows now say The Architect / The Engineer in "Who talks", with the vendor's own hello, speech and replies. The first visits stay PM thinking (the PM is still hunting for a vendor). Needs a small code change, see section 5.
5. **Staff names.** The review doc names a DOB clerk, DOB plan examiner, DOB auditor, FDNY clerk and FDNY plan examiner. `CHARACTERS.csv` and the draft have just two: DOB Examiner and FDNY Inspector. I followed the draft.
6. **`why_text` is empty for all 80 rows of `SPACE_CONTENT.csv`.** The teaching "why" tips actually live in `ACTION_TOOLTIPS.csv` (the "why" rows for seven stops, and the "?" text of each Go-to button). I used those, with numbers removed. Five stops have no tooltip at all (owner scope, owner funding, sign-off, which certificate, and the rules guide); their Why is marked "new" in Sources or comes from the guide tip.
7. **Data glitch at the rules guide.** In `SPACE_CONTENT.csv` the guide's tip sentence sits in the "can_negotiate" column instead of the "why_text" column, for both rows. The guide's button explanations in `SPACE_EFFECTS.csv` still use game words ("W cards", "20% design fee") and one swear word. I did not touch them (not part of this job).
8. **Today's panel text that disagrees with the stop.** (a) Bank, return visit: the Offer says "or push for better ones" but there is no bargaining there. (b) Site Inspection, return visit: the story said Frank's guys join the walk; I cut that line, because the game gives nothing there and hiring on a site breaks Tom's rule (section 5). (c) Special inspector: the story says "you hire", the tooltip says "the owner hires". Both can be true, I left "you hire". The Offer and button columns are data, so I did not change them.
9. **Things I dropped because the game has no such rule (or may be out of date):** the Finish tooltip's "compare completion time and remaining funds to win" (the trophy win rule has since changed, so I did not repeat it); "Maybe your file gets a softer read" (Final Approval), "worse mood / worse terms" (Bank, return visit), and the Owner's "took longer than I wanted, cost more than I budgeted" (it was said whatever happened in the game).
10. **Numbers.** None of my lines contain money, days or percent. I wrote the idea without the number ("a set share of the project", "takes a good while", "a few days" where today's tooltip already says that). I did not need the `{number from data}` placeholder anywhere. The only token left is `{fundingAmount}`, which the game already fills in. If a number should come back as a live token, the game needs a new token first. Numbers I removed: the 1% DOB and Fire Dept fees, the Bank's tiered fee, the Investor's 5%, the Architect and Engineer percent ranges, "Three days" (Test It Now), "ten days" (full report, sign-off), "One day" (sign today), and every "five / ten / fifty days" in the old card lines. Zoning citations (ZR-23.5, ZR-25-13) are references, not amounts, so they stay.

## 2. Stops from Tom's pending wording review (so one pass covers both)

- Fix It First: `CON-FIX`, rows 50 and 51 of `conversation-merged.csv` (Notes say PENDING WORDING REVIEW)
- Steer the Inspector: `CON-STEER`, rows 52 and 53 of `conversation-merged.csv` (Notes say PENDING WORDING REVIEW)
- Test It Now: `TR8-TEST-NOW`, rows 54 and 55 of `conversation-merged.csv` (Notes say PENDING WORDING REVIEW)
- Close Up, Test Later: `TR8-TEST-LATER`, rows 56 and 57 of `conversation-merged.csv` (Notes say PENDING WORDING REVIEW)
- Hire a Special Inspector (picker): `SI-HIRE`, rows 58 and 59 of `conversation-merged.csv` (Notes say PENDING WORDING REVIEW)
- Top inspection agency: `SI-AGENCY-TOP`, rows 60 and 61 of `conversation-merged.csv` (Notes say PENDING WORDING REVIEW)
- Budget inspection agency: `SI-AGENCY-BUDGET`, rows 62 and 63 of `conversation-merged.csv` (Notes say PENDING WORDING REVIEW)
- Name one later: `SI-SKIP`, rows 64 and 65 of `conversation-merged.csv` (Notes say PENDING WORDING REVIEW)

The same chain also has new stops that are not on your list but share the speaker: full report, sign today, inspector sign-off (rows 72 and 73, rows 74 and 75, rows 70 and 71) and the certificate stops (rows 76 and 77, rows 78 and 79, rows 80 and 81). Their Notes say NEW CHARACTER where the Special Inspector speaks.

## 3. Pop-ups that say the same thing as a stop (listed, not rewritten)

The live `ModalConfig.csv` holds only two rows (Bank, both visits, loan, with no text). The Pass 2 pop-up wording is still only a proposal in `AUTHORED_COPY_REVIEW.md` ("Modals fired here" under each stop). Almost every one repeats a line of the sheet: a **life event** pop-up repeats the life-event card line, an **expeditor** pop-up repeats the expeditor card line, and **time** and **fee** pop-ups repeat what the official already says about waiting and paying. Stop by stop (title and kind):

- **OWNER-SCOPE-INITIATION / First**: Three names from my Rolodex (expeditor); That's a day (time)
- **OWNER-FUND-INITIATION / First**: I'm wiring it now (money); Another day on this (time)
- **PM-DECISION-CHECK / First**: Today wasn't quiet (life event); Swapping a contact (expeditor); Five days burned (time)
- **PM-DECISION-CHECK / Subsequent**: Today wasn't quiet (life event); Lost one to the neighbor (expeditor); Another five days gone (time)
- **OWNER-DECISION-REVIEW / First**: While you wait on me (life event); I'll get back to you (time)
- **OWNER-DECISION-REVIEW / Subsequent**: World still turns (life event); Short wait this round (time)
- **CHEAT-BYPASS / First**: Today wasn't quiet (life event); Letting someone go (expeditor)
- **CHEAT-BYPASS / Subsequent**: Today wasn't quiet (life event); Parting ways (expeditor)
- **LEND-SCOPE-CHECK / First**: Life happens between meetings (life event); That's a sharp angle (expeditor); Five days at this table (time)
- **LEND-SCOPE-CHECK / Subsequent**: Even now, life happens (life event); That pitch ran out (expeditor); Another week of this (time)
- **BANK-FUND-REVIEW / First**: Your terms are ready (loan); Two introductions inside the bank (expeditor); Underwriting takes its time (time); The bank's fee (fee)
- **BANK-FUND-REVIEW / Subsequent**: Revised terms (loan); That contact's done (expeditor); Same underwriting pace (time); Same fee structure (fee)
- **INVESTOR-FUND-REVIEW / First**: Even committee meetings end (life event); Better fit for this room (expeditor); Our cut (fee)
- **INVESTOR-FUND-REVIEW / Subsequent**: Even now, the world moves (life event); We're moving someone (expeditor); Same 5% (fee)
- **ARCH-INITIATION / First**: Today wasn't quiet (life event); A week on the phones (time)
- **ARCH-INITIATION / Subsequent**: Even now, the world spins (life event); A week with the drawings (time)
- **ARCH-FEE-REVIEW / First**: Long projects, long days (life event); Trim the team (expeditor); Fifty days to settle the fee (time)
- **ARCH-FEE-REVIEW / Subsequent**: Never the quiet days (life event); Someone you should know (expeditor); Two weeks on the upcharge (time)
- **ARCH-SCOPE-CHECK / First**: Even on reveal day (life event); Different talent needed (expeditor); Fifty days behind this (time)
- **ARCH-SCOPE-CHECK / Subsequent**: Even on the re-review (life event); Losing one to a competitor (expeditor); Fifteen days on this revision (time)
- **ENG-INITIATION / First**: Today wasn't quiet (life event); A week on the phones (time)
- **ENG-INITIATION / Subsequent**: World keeps moving (life event); A week on the calcs (time)
- **ENG-FEE-REVIEW / First**: Long projects, loud days (life event); Fifty days on the fee (time)
- **ENG-FEE-REVIEW / Subsequent**: Fee talk takes a day (life event); Two weeks on the upcharge (time)
- **ENG-SCOPE-CHECK / First**: Even at the reveal (life event); Fifty days of engineering (time)
- **ENG-SCOPE-CHECK / Subsequent**: Even on the re-review (life event); Fifteen days on the revisions (time)
- **REG-DOB-FEE-REVIEW / First**: Even at the counter (life event); Two filing hands (expeditor); Ten days for processing (time); DOB fee (fee)
- **REG-DOB-FEE-REVIEW / Subsequent**: Even on the second visit (life event); Fresh hands (expeditor); Ten more days (time); Add-on fee (fee)
- **REG-DOB-TYPE-SELECT / First**: Today wasn't quiet (life event); Ten days to lock it (time)
- **REG-DOB-TYPE-SELECT / Subsequent**: Today wasn't quiet (life event); Ten more days (time)
- **REG-DOB-PLAN-EXAM / First**: Even at the examiner's desk (life event); Ten days with your file (time)
- **REG-DOB-PLAN-EXAM / Subsequent**: Even on the second read (life event); Ten days on the resubmission (time)
- **REG-DOB-PROF-CERT / First**: One day, in and out (time)
- **REG-DOB-PROF-CERT / Subsequent**: One day, fingers crossed (time)
- **REG-DOB-AUDIT / First**: Under the microscope (life event); Ten days under the microscope (time)
- **REG-DOB-AUDIT / Subsequent**: Even during follow-up (life event); Ten days on follow-up (time)
- **REG-DOB-FINAL-REVIEW / First**: Even at the final counter (life event); Closing-team intros (expeditor)
- **REG-DOB-FINAL-REVIEW / Subsequent**: Take two doesn't pause the world (life event); One more pair of hands (expeditor)
- **REG-FDNY-FEE-REVIEW / First**: Intake's a day (time); FDNY fee (fee)
- **REG-FDNY-FEE-REVIEW / Subsequent**: One more day (time)
- **REG-FDNY-PLAN-EXAM / First**: Under FDNY's eye (life event); Ten days under review (time)
- **REG-FDNY-PLAN-EXAM / Subsequent**: Even on the second read (life event); Five days for the second pass (time)
- **CON-INITIATION / First**: Life happens, work continues (life event); My crew comes with me (expeditor)
- **CON-INITIATION / Subsequent**: Change-order day (life event); One extra hand (expeditor)
- **CON-ISSUES / First**: Even fixing things (life event); Right tool for the job (expeditor)
- **CON-ISSUES / Subsequent**: Worst time (life event); Lost one to the neighbor (expeditor)
- **CON-INSPECT / First**: During the inspection (life event); Clean break (expeditor)
- **CON-INSPECT / Subsequent**: During the walkthrough (life event); Reinforcements (expeditor)

Worth a look when Tom reviews:
- **Owner funding, "I'm wiring it now"**: "Everything after this comes with strings" is also in the Owner's yes reply now. Keep it in one place.
- **Owner scope, "Don't rush this. Get the scope right at the table..."**: says what the Owner's hello now says.
- **Bank**: "Your terms are ready", "Underwriting takes its time" and "The bank's fee" repeat the Banker's talk. The pop-ups contain money figures and percentages; the return-visit pop-up says the terms are worse, which the stop does not.
- **Investor "Our cut"**, **DOB "DOB fee"**, **Architect and Engineer "days to settle the fee"**: repeat the fee talk and carry numbers.
- **DOB plan exam, FDNY plan exam**: "I read every page" and "I won't rush a code check" repeat the examiners' opening speech.
- **Expeditor pop-ups with effects the game no longer has**: Lender first visit, Bank first visit, Final Approval (both), Contractor hire (both), Site Inspection return visit. These should go: hiring happens only at an office (section 5).
- **Speaker names in the pop-ups** (DOB clerk, auditor, FDNY clerk, Architect and Engineer for the two return-visit "find" stops) do not match the sheet's speakers.
- Later pop-up rewrite should use the same voice as the sheet: no numbers, and the same character as the stop.

## 4. How the sheet is laid out

- Draft columns kept as they were. "What they say" is the merged speech; hello and both replies are lengthened only where it made them clearer (hello: 12 changed, yes reply: 27, bargain reply: 21; 122 draft lines kept).
- New columns: **Card lines (from narratives-draft)**, **Why (teaching)**, **Sources** (where each piece came from), **Notes** (draft note first, then mine).
- Every bargain reply says the stop is gone over again and costs time, and none promises a better deal. At the four fee stops it also says there is a revision fee (that comes from `try_again_scope_pct`).
- Narrator rows: only the two rules-guide rows. PM rows stay first person and never say "you".

## 5. Tom's two rulings of 2026-10-30, and what they leave open

**Ruling 1: return visits to the architect and engineer are spoken by that vendor.** Done in the sheet (see conflict 4). The first visits stay PM thinking.

**Ruling 2: letting a filing rep (expeditor) go can happen anywhere; hiring only happens at an office ("you don't hire someone in a bank, but you can fire someone there").**
- This confirms the dropped hiring lines at the Lender, Bank, Final Approval, Contractor hire and Site Inspection, and the pop-ups that go with them. Frank's crew line was cut for the same reason.
- Letting someone go stays wherever the game has it (Lender and Bank return visits, Architect fee, shortcut stops, Site Inspection).
- "An office" means the project's own offices: the PM's desk, the owner, the architect, the engineer, the contractor. Not offices: bank, lender, investors, the site. **Tom ruled on 2026-10-30 that a city borough office is NOT an office either**, so the city counters (DOB and Fire Dept) are out for hiring too.
- **Live effects that still break the rule (data change, not mine to make):** Investor first visit (swap), DOB filing fee first visit (take on two) and return visit (swap), Trouble On Site first visit (swap; borderline if a site trailer counts as the contractor's office). Each of these rows has a Notes line saying so (the Investor and DOB return-visit rows also carry fire-only wording). With the borough-office ruling, the DOB counter first visit (take on two) is a clear break, not a maybe. Only Trouble On Site stays borderline (a site trailer might count as the contractor's office); Tom has not ruled on that one.

**For the manager (code and data, not done here):**
- The game's list of PM-voiced spaces is per space. It needs to become per visit so that Find an Architect and Find an Engineer speak as the vendor on the return visit (badge, portrait, speech voice, result summary).
- Fire-only versions of the four effects above, if Tom agrees.
- Cut the stale expeditor pop-ups and the Frank sentence from the Pass 2 list when it is applied.
