# Authored Copy — Direct Replacement Review

> Same field shape as `Spaces.csv` and `ModalConfig.csv`. For each space/visit: current cell value on the left, proposed cell value on the right. **The NPC of each space narrates to the PM in second person, with 5 PM-voiced exceptions.**

---

## Voice rule (locked, revised 2026-04-25)

- **`Event`** — the NPC of the space narrates to the PM in second person ("you"). 5 spaces are PM-voiced first person — see speaker map below.
- **`Action`** — neutral panel text, second person, instructional. Same regardless of speaker.
- **`Outcome`** — neutral panel text, reports what happened. Same regardless of speaker.
- **Modals (`modal_title`, `modal_description`, `modal_summary`)** — narrated by the same speaker as `Event` for that space. NPC for most, PM for the 5 PM-voiced spaces.
- **Per-action narratives (`*_card_narrative` columns)** — separate surface (the v2.50.0 in-page accordion). Stays ambient/narrator-from-above. Not bound by this rule.
- **No game terms anywhere.** No "roll dice," "draw a card," "discard," "$X," "effect," "action," "turn."

### Speaker map

**PM-voiced (first person, "I"):** PM-DECISION-CHECK, CHEAT-BYPASS, ARCH-INITIATION, ENG-INITIATION, REG-DOB-TYPE-SELECT.

**All other spaces — NPC of the space narrates** (second person, addressing PM as "you"):

| Prefix / Space | Narrator |
|---|---|
| `OWNER-*` | Owner |
| `LEND-*` | Lender |
| `BANK-*` | Banker |
| `INVESTOR-*` | Investor |
| `ARCH-*` (except `ARCH-INITIATION`) | Architect |
| `ENG-*` (except `ENG-INITIATION`) | Engineer |
| `REG-DOB-*` (except `REG-DOB-TYPE-SELECT`) | DOB inspector |
| `REG-FDNY-*` | FDNY inspector |
| `REG-DCP-*` | DCP planner |
| `CON-*` | Contractor / GC |
| `FINISH` | Owner (congratulating) |

---

## CSV structural changes (need your sign-off)

| Change | Space/Visit | Reason |
|---|---|---|
| **Delete row** | OWNER-SCOPE-INITIATION / Subsequent | No space routes here. |
| **Delete row** | OWNER-FUND-INITIATION / Subsequent | No space routes here. |
| **Flip `Negotiate` YES → NO** | REG-DOB-FEE-REVIEW / Subsequent | Sunk-cost rule. |
| **Flip `Negotiate` NO → YES** | ARCH-INITIATION / Subsequent | PM has boots on the ground; architect's in the office. |

---

## Modal scope (locked)

Every material effect fires a modal — including `Time` and `Fee`. PM has to feel every day burned and every dollar out the door. The `dice_value` column in `ModalConfig.csv` stays for the engine where it needs to disambiguate effects on the same action, but copy never mentions dice numbers — only the outcome.

---

# SETUP PHASE

## OWNER-SCOPE-INITIATION / First — *Negotiate: YES* — **Speaker: Owner**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Owner Scope Initiation | The owner walks you through it |
| Event | I've been thinking about this project and I have a vision. Let me tell you what I have in mind. | *"Sit down. I've been turning this project over for months — let me walk you through what I want built. You're going to hear it from me first, before anyone else gets a say."* |
| Action | Review the owner's scope proposal. Accept it or negotiate next turn. | Lock the scope as offered, or push back and revisit tomorrow. |
| Outcome | *(empty)* | Scope is locked. Funding next. |
| end_turn_label | Agree with Owner | Lock the scope |
| try_again_label | Negotiate | Push back |
| e_card_narrative | The owner hands you a stack of contacts — expeditors they've worked with before. Take all three; you'll need every one of them before this project is done. | *(keep — accordion surface, ambient voice retained)* |

### Modals fired here — narrated by Owner

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| e_card: Draw 3 | Three names from my Rolodex | *"Take these — a permit runner, a fixer, a friend at the borough office. They've worked for me before. They'll work for you now."* | I'll take them | Three of the owner's contacts added to your hand. |
| Time: 1 day | That's a day | *"Don't rush this. Get the scope right at the table and you save yourself weeks of fixing it later."* | Move on | One day spent at the owner's table. |

---

## OWNER-SCOPE-INITIATION / Subsequent — **DELETE ROW**

---

## OWNER-FUND-INITIATION / First — *Negotiate: YES* — **Speaker: Owner**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Owner Funding Initiation | The owner opens the books |
| Event | Let me look at the numbers. Here's what I'm willing to put up for this project. | *"Here's what I'm putting in. Look it over. I'm not negotiating against myself — but if you've got a real reason to push back, I'll hear it."* |
| Action | Review the owner's funding offer. Accept it or negotiate next turn for a different amount. | Take the check, or push for more and revisit tomorrow. |
| Outcome | Take Owner's Money | Owner's funding is in. Starting budget is set. |
| end_turn_label | Agree with Owner | Take the check |
| try_again_label | Negotiate | Push for more |

### Modals fired here — narrated by Owner

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| Take Owner's Money | I'm wiring it now | *"That's the number. Treat it like it's the only free money in this project — because it is. Everything after this comes with strings."* | Got it | Owner's funding deposited. |
| Time: 1 day | Another day on this | *"My time costs too. Don't make me sit in this conversation longer than I have to."* | Move on | One day spent at the owner's table. |

---

## OWNER-FUND-INITIATION / Subsequent — **DELETE ROW**

---

# OWNER / DECISION PHASE

## PM-DECISION-CHECK / First — *Negotiate: NO* — **Speaker: PM (first person)**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | PM Decision Check | I pick a direction |
| Event | As project manager your first decision is to determine the direction of project. | *"I'm picking a direction. Expeditor and I have talked it through, but the call's mine. Time to commit."* |
| Action | You and expeditor strategize and come up with some changes. Life happens and you choose a path forward. | Trim the team, see how the days shake out, commit to a path. |
| Outcome | *(empty)* | Direction set. Tomorrow I move on it. |
| end_turn_label | End Turn | Move forward |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by PM

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 1 | Today wasn't quiet | *"Life doesn't pause for strategy meetings. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Replace 1 | Swapping a contact | *"Cost-cutting time. One of my expeditors steps away — different person comes in for the next stretch."* | Got it | One expeditor swapped on my roster. |
| Time: 5 days | Five days burned | *"A full week of meetings, phone calls, and staring at the plan."* | Move on | Five days off the clock. |

---

## PM-DECISION-CHECK / Subsequent — *Negotiate: NO* — **Speaker: PM (first person)**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | PM Decision Reassessment | I rethink the plan |
| Event | You are a thinker and need to reassess the situation. What will you do next? | *"Rethinking the plan. Life's moving fast, my staff's restless, and the first try didn't pan out."* |
| Action | Your staff sees an opportunity at the competition and leaves you. Meanwhile life passes you by and you finally decide what to do next. | A staff member quits for a better gig. Days pass. Commit to a new plan. |
| Outcome | *(empty)* | New direction locked. Time to act. |
| end_turn_label | End Turn | Commit to the new plan |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by PM

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 2 | Today wasn't quiet | *"Another day where life doesn't pause. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Person to your right takes a card | Lost one to the neighbor | *"The PM next to me sees an opening and grabs one of my expeditors. No hard feelings — better hours, better pay, better gig."* | That stings | One expeditor poached by neighbor. |
| Time: 5 days | Another five days gone | *"Another stretch where the clock just kept moving."* | Move on | Five days off the clock. |

---

## OWNER-DECISION-REVIEW / First — *Negotiate: YES* — **Speaker: Owner**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Owner Decision Review | I'm not signing off until you hear me |
| Event | Some decisions require owners input. Especially when owner wants it THEIR WAY. | *"This one's not yours to call alone. There are pieces of this project I won't budge on — let me tell you which way it's going. You can argue if you want, but you'll lose."* |
| Action | The owners ponder and tell you their plans. | Hear the owner out. Go with the owner's call, or push back. |
| Outcome | *(empty)* | The owner's call is locked in. |
| end_turn_label | Agree with Owner | Go with the owner's call |
| try_again_label | Negotiate | Push back on it |

### Modals fired here — narrated by Owner

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 1 | While you wait on me | *"World doesn't stop while you're waiting on my decision. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 10 days | I'll get back to you | *"Ten days, give or take. I'll get back to you when I've made up my mind. Don't hover."* | Move on | Ten days waiting on the owner. |

---

## OWNER-DECISION-REVIEW / Subsequent — *Negotiate: YES* — **Speaker: Owner**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Owner Follow-up Review | I want to see the finish line |
| Event | It has been a while since last review. Time is running out and owner just wants to see the finish line. | *"Enough back and forth. I want to see this thing finished — here's my call. Take it and move, or come back tomorrow with a better argument."* |
| Action | Impatiently the owners hear you out and come to a quick decision. | Owner's decided fast this round. Go with it, or push for one more round. |
| Outcome | *(empty)* | Owner's done deliberating. Move. |
| end_turn_label | Agree with Owner | Go with the owner's call |
| try_again_label | Negotiate | One more round |

### Modals fired here — narrated by Owner

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 2 | World still turns | *"Even on the short version, the world keeps moving. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 5 days | Short wait this round | *"I made up my mind quicker this time. Don't make me regret moving fast."* | Move on | Five days waiting on the owner. |

---

## CHEAT-BYPASS / First — *Negotiate: NO* — **Speaker: PM (first person)**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Cheat Bypass | I cut a corner |
| Event | Let's get this shit done at any cost! they said… So you are looking to cut a few days off the top. | *"Owner said get this done at any cost. I'm going to cut a corner. Odds aren't in my favor — I know it."* |
| Action | You are nervous - the odds are not in your favor. | Quietly let a contact go for deniability. See if the move lands. |
| Outcome | *(empty)* | I made my move. Now we see if it stuck. |
| end_turn_label | End Turn | Make the play |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by PM

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 3 | Today wasn't quiet | *"Life lands while I'm pulling something. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Return 1 | Letting someone go | *"This kind of thing needs deniability. One of my people steps away — clean break, no paper trail."* | Got it | One expeditor off my roster. |

---

## CHEAT-BYPASS / Subsequent — *Negotiate: NO* — **Speaker: PM (first person)**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Cheat Bypass Retry | Careful version |
| Event | Cheating last time did not go so well. You still want to try but are a lot more careful. | *"Last time didn't go well. I'm being a lot more careful this time."* |
| Action | Review path and fees are determined by 1 dice roll. | Quietly part ways with another contact. See how the careful version lands. |
| Outcome | *(empty)* | Careful move made. Let's see. |
| end_turn_label | End Turn | Try the careful version |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by PM

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 4 | Today wasn't quiet | *"Life shows up at the worst time. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Return 1 | Parting ways | *"Different angle this time — same need to keep someone off the books. They step away."* | Got it | One expeditor off my roster. |

---

# FUNDING PHASE

## LEND-SCOPE-CHECK / First — *Negotiate: YES* — **Speaker: Lender**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Lender Scope Check | I'm flipping through your plan |
| Event | You need more money! - The lender reviews the business plan and negotiates scope for a better rate. | *"Sit down. I've got your plan in front of me — let's see if it holds up. I'll cut you a rate, but I want my pound of flesh on the scope first."* |
| Action | Scope negotiations last a while as life passes you by. Your expeditor comes up with an idea and the deal is struck! | Negotiate scope and rate. Lock in the terms, or push for better. |
| Outcome | *(empty)* | Terms agreed. On to the bank. |
| end_turn_label | Accept Scope | Lock the scope |
| try_again_label | Negotiate | Push for better terms |

### Modals fired here — narrated by Lender

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 3 | Life happens between meetings | *"World doesn't pause while we hash this out. {cardTitle} — {cardDescription}."* | Got it | A life event hit during negotiations. |
| e_card: Draw 1 | That's a sharp angle | *"Good pitch from your side. I'll make a note — that one could pay off when you're back at someone else's table."* | Take it | New expeditor angle added. |
| Time: 5 days | Five days at this table | *"Five days. Could've closed three deals in that time. But here we are."* | Move on | Five days at the lender's table. |

---

## LEND-SCOPE-CHECK / Subsequent — *Negotiate: NO* — **Speaker: Lender**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Lender Scope Renegotiation | You again. Already. |
| Event | Burning through the pile of cash is easier than you thought… Time to get some fresh dough. | *"You're back. Cash didn't last? Sit down — I'll listen, but the warmth's gone. This round it's whatever I'm willing to put up. You take it."* |
| Action | More money = more staff scope and life changes. | Re-pitch the ask. Take whatever the lender offers this time. |
| Outcome | *(empty)* | New ask on the table. |
| end_turn_label | End Turn | Take what they're offering |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by Lender

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 4 | Even now, life happens | *"You think this is the only thing on your plate? {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Return 1 | That pitch ran out | *"That angle you had last time? Doesn't move me anymore. Drop it from the playbook."* | Got it | One expeditor angle removed. |
| Time: 5 days | Another week of this | *"Another five days I won't get back. Neither will you."* | Move on | Five days at the lender's table. |

---

## BANK-FUND-REVIEW / First — *Negotiate: YES* — **Speaker: Banker**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Bank Funding Review | We're underwriting your file |
| Event | You wait patiently as the bank underwrites to determine the loan amount and rate. | *"We've got your file. Underwriting will work the numbers — amount, rate, timeline. We'll come back with terms. Standard process. Sit tight."* |
| Action | Having money will allow you to hire and spend maybe even have a life. | Sign the loan terms, or push for a lower rate. |
| Outcome | *(empty)* | Loan approved at the bank's terms. Money incoming. |
| end_turn_label | Accept Funding | Sign the loan |
| try_again_label | Negotiate | Push for a lower rate |

### Modals fired here — narrated by Banker

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| b_card: Draw 1 | Your terms are ready | *"Underwriting's done. Amount, rate, timeline — all on paper. Standard package. Take a look."* | Read it | Loan added to your accounts. |
| e_card: Draw 2 | Two introductions inside the bank | *"I'll pull you aside and introduce you to two of my colleagues. Useful voices when you're back here."* | Take them | Two banker contacts added. |
| Time: 1 day per $200K | Underwriting takes its time | *"About a day per $200,000 on the ask. The larger the loan, the longer the review. Bank policy."* | Move on | Underwriting time burned. |
| Fee: 1% / 2% / 3% (tiered by loan size) | The bank's fee | *"1% up to $1.4M. 2% from $1.5M to $2.75M. 3% above that. Standard tiered structure — non-negotiable."* | Pay it | Bank fee paid. |

---

## BANK-FUND-REVIEW / Subsequent — *Negotiate: NO* — **Speaker: Banker**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Bank Funding Follow-up | We see you're back |
| Event | You wait impatiently as the bank underwrites to determine the loan amount and rate. | *"You're back with us. We've already underwritten this project once — second pass means a closer look and a tighter rate. Patience is shorter on this side too."* |
| Action | It is late in the game - you are starting to lose credibility. Staff is leaving. Life is passing you by. | A banker stops returning your calls. Take the revised loan, whatever it looks like. |
| Outcome | *(empty)* | New terms in hand. Whatever they are. |
| end_turn_label | End Turn | Take the revised loan |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by Banker

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| b_card: Draw 1 | Revised terms | *"New offer. Worse than the first — the project's riskier now and we both know it."* | Read it | Revised loan added to your accounts. |
| e_card: Return 1 | That contact's done | *"One of my colleagues stops taking your calls. Word travels in here."* | Got it | One banker contact removed. |
| Time: 1 day per $200K | Same underwriting pace | *"Same policy as last time — a day per $200,000."* | Move on | Underwriting time burned. |
| Fee: tiered | Same fee structure | *"Same tiered fee. The bank doesn't bend on this."* | Pay it | Bank fee paid. |

---

## INVESTOR-FUND-REVIEW / First — *Negotiate: YES* — **Speaker: Investor**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Investor Funding Review | The committee will hear you out |
| Event | You wait patiently as the investors determine the loan amount and rate. | *"The committee will hear you out. We're slower than the bank and we cost more — but we move real money when we like the deal. Walk us through it."* |
| Action | Having money will allow you to hire and spend maybe even have a life. | Sign with the investors, or push for better terms. |
| Outcome | *(empty)* | Investor signed. Big money in. |
| end_turn_label | Accept Funding | Sign with the investors |
| try_again_label | Negotiate | Push for better terms |

### Modals fired here — narrated by Investor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 5 | Even committee meetings end | *"Committee adjourns and the world is still moving. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Replace 1 | Better fit for this room | *"One of your contacts isn't strong enough for this committee. We'll introduce you to someone who is."* | Got it | Investor contact upgraded. |
| Fee: 5% of amount borrowed | Our cut | *"5% of whatever you take. Baked into the deal — non-negotiable. Cost of the committee's attention."* | Pay it | Investor fee paid. |

---

## INVESTOR-FUND-REVIEW / Subsequent — *Negotiate: NO* — **Speaker: Investor**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Investor Funding Follow-up | The committee's seen you before |
| Event | You wait impatiently as the investors determine the loan amount and rate. | *"You're back. We've already put real money into this project once — the appetite for sweetening terms is gone. Take what we offer this round, or come back later."* |
| Action | It is late in the game - you are starting to lose credibility. Staff is leaving. Life is passing you by. | An investor contact gets pulled into another deal. Take whatever terms come back. |
| Outcome | *(empty)* | Took what the committee offered. Moving on. |
| end_turn_label | End Turn | Take their offer |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by Investor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 6 | Even now, the world moves | *"Committee deliberates, world doesn't pause. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Person to your left takes a card | We're moving someone | *"One of your contacts here gets pulled to a more interesting deal. The PM to your left was paying better attention."* | That stings | One investor contact lost to neighbor. |
| Fee: 5% | Same 5% | *"Same 5%. Always 5%. We don't move on this."* | Pay it | Investor fee paid. |

---

# DESIGN PHASE

## ARCH-INITIATION / First — *Negotiate: NO* — **Speaker: PM (first person)**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Architect Search | Hunting for an architect |
| Event | You begin the search for an architect. Phone calls and qualification reviews take time while others move ahead. | *"I'm hunting for an architect. Calls, resumes, interviews — it takes days. I'd rather be building."* |
| Action | Outside influences may affect you while you search for the right architect. | Work the phones. See who turns up. |
| Outcome | *(empty)* | Architect hired. Fees up next. |
| end_turn_label | End Turn | Hire the architect |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by PM

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 1 | Today wasn't quiet | *"Life happens while I'm working the phones. {cardTitle} — {cardDescription}."* | Got it | A life event hit during the search. |
| Time: 5 days | A week on the phones | *"Five days of cold calls and long lunches."* | Move on | Five days on the search. |

---

## ARCH-INITIATION / Subsequent — *Negotiate: **YES** (flipped from NO)* — **Speaker: Architect** *(flagged — see Phase 4 note)*

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Architect Redesign Review | I want another look at these drawings |
| Event | Let me take another look at these drawings. Something may need to change. | *"I've been thinking about these drawings overnight and something's off. Give me another pass — I think we can do better. Push back if you have to, but I'd rather get this right than fast."* |
| Action | The architect reviews the files. A redesign might be necessary. | Approve the redesign, or push back on the changes. |
| Outcome | *(empty)* | Redesign decision is in. |
| end_turn_label | End Turn | Approve the redesign |
| try_again_label | Try Again | Push back on the changes |

### Modals fired here — narrated by Architect

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 2 | Even now, the world spins | *"You and I get to talk drawings, but the world out there hasn't paused. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 5 days | A week with the drawings | *"A week revisiting the work. The drawings will be better for it — trust me."* | Move on | Five days on the redesign. |

---

## ARCH-FEE-REVIEW / First — *Negotiate: YES* — **Speaker: Architect**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Architect Fee Review | Let's talk about my fee |
| Event | Architect negotiates their initial fees. | *"We need to talk money. I've put real time into this — sketches, options, conversations with the consultants. The fee covers the work I've already done. It's not unreasonable."* |
| Action | Everyone wants money from you! You paid a big chunk so now you have to save a little by cutting your staff. | Cut a contact to save budget. Pay the fee, or push back. |
| Outcome | *(empty)* | Fee agreed. Moving to the design work. |
| end_turn_label | Accept Fee | Pay the fee |
| try_again_label | Negotiate | Push back on the fee |
| l_card_narrative | You've been on this job a while — sometimes things just happen. Keep your head down and hope today isn't one of those days. | *(keep — accordion surface, ambient voice retained)* |
| e_card_narrative | You're cutting staff to save budget. One of your expeditors has to go — pick carefully, they're hard to replace. | *(keep — accordion surface, ambient voice retained)* |

### Modals fired here — narrated by Architect

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 3 | Long projects, long days | *"This will be a long collaboration. Life will land somewhere along the way. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Return 1 | Trim the team | *"Budget math means someone has to step away from your roster. The work continues."* | Got it | One expeditor off your roster. |
| Time: 50 days | Fifty days to settle the fee | *"Negotiation takes time. I don't apologize for it — getting the terms right protects both of us."* | Move on | Fifty days on the fee. |

---

## ARCH-FEE-REVIEW / Subsequent — *Negotiate: YES* — **Speaker: Architect**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Architect Additional Fees | There's more to the work than I quoted |
| Event | Architect negotiates additional architect fees. | *"The scope grew. It always does. The original fee covered the original drawings — what's been added needs to be paid for separately. I'm not nickel-and-diming. This is the actual extra work."* |
| Action | You cross your fingers and wait for life to dump on you. You will need a friend in need. | Pay the extra, or push back on the upcharge. |
| Outcome | *(empty)* | Additional fee agreed. |
| end_turn_label | Accept Fee | Pay the extra |
| try_again_label | Negotiate | Push back on the upcharge |
| l_card_narrative | Back again, and life doesn't stop throwing curveballs. Roll the dice and see what lands. | *(keep — accordion surface, ambient voice retained)* |
| e_card_narrative | Your architect friend recommends someone new. Add them to your roster — you'll need the help later. | *(keep — accordion surface, ambient voice retained)* |

### Modals fired here — narrated by Architect

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 4 | Never the quiet days | *"The quiet days never seem to land on this project. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Draw 1 | Someone you should know | *"I've worked with someone who'd be good for your roster. I'll make the introduction."* | Take it | New expeditor contact added. |
| Time: 15 days | Two weeks on the upcharge | *"Two weeks to settle the additional fee. I won't pretend it could've gone faster."* | Move on | Fifteen days on the upcharge. |

---

## ARCH-SCOPE-CHECK / First — *Negotiate: YES* — **Speaker: Architect**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Architect Scope Check | Today is the design reveal |
| Event | Architect's team finished their design. Today you are attending the final presentation. | *"Today's the day. We've finished the design — every elevation, every section, every detail. Sit through the presentation, then we'll talk about whether it's ready for engineering."* |
| Action | The architect takes their time to get to the initial design scope determination. | Watch the presentation. Approve the design, or send it back. |
| Outcome | *(empty)* | Design approved. Engineering next. |
| end_turn_label | Accept Scope | Approve the design |
| try_again_label | Negotiate | Send it back |

### Modals fired here — narrated by Architect

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 5 | Even on reveal day | *"World doesn't pause for design reveals. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Replace 1 | Different talent needed | *"This design needs different expertise on your team. Swap one of your contacts for someone better suited."* | Got it | Contact swapped on your roster. |
| Time: 50 days | Fifty days behind this | *"Fifty days of work behind this presentation. Take the time to look at it properly."* | Move on | Fifty days on the design. |

---

## ARCH-SCOPE-CHECK / Subsequent — *Negotiate: YES* — **Speaker: Architect**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Architect Design Review | Here's the revised design |
| Event | Architect subsequent design review determination. | *"Took your feedback. Here are the revised drawings — I think you'll see the changes. If they don't land, send it back again, but I'd rather we converge this round."* |
| Action | Roll for outcome. | Compare the new drawings to the old. Approve the revisions, or send them back again. |
| Outcome | *(empty)* | Design locked. Onward. |
| end_turn_label | Accept Result | Approve the revisions |
| try_again_label | Negotiate | Send it back again |

### Modals fired here — narrated by Architect

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 6 | Even on the re-review | *"Re-reviews aren't immune to the world. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Person to your right takes a card | Losing one to a competitor | *"One of your contacts here gets pulled to the project the PM next to you is running. They were paying better attention."* | That stings | One expeditor poached by neighbor. |
| Time: 15 days | Fifteen days on this revision | *"Fifteen days to integrate the changes. Faster than the first pass — for what that's worth."* | Move on | Fifteen days on the revision. |

---

## ENG-INITIATION / First — *Negotiate: NO* — **Speaker: PM (first person)**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Engineer Search | Hunting for an engineer |
| Event | Time to find a structural engineer. More calls and credential checks while the project waits. | *"I'm hunting for a structural engineer. Same grind as the architect — calls, credentials, interviews."* |
| Action | Outside influences may affect you while you search for the right engineer. | Work the phones. See who turns up. |
| Outcome | *(empty)* | Engineer onboarded. Fees next. |
| end_turn_label | End Turn | Hire the engineer |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by PM

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 1 | Today wasn't quiet | *"Life happens while I'm working the phones. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 5 days | A week on the phones | *"Five days of cold calls."* | Move on | Five days on the search. |

---

## ENG-INITIATION / Subsequent — *Negotiate: YES* — **Speaker: Engineer** *(flagged — see Phase 4 note)*

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Engineer Redesign Review | I need another pass at the calcs |
| Event | I've been going over the structural calculations. We might need some changes here. | *"I've been over the structural calculations and I want another pass. Numbers don't lie — if something's off, we fix it now, before steel orders or pour schedules. I'd rather slow down here than have it back at me later."* |
| Action | The engineer reviews the specs. Watch carefully for the verdict. | Accept the engineer's findings, or ask for another pass. |
| Outcome | *(empty)* | Engineer's verdict in. |
| end_turn_label | Accept Result | Accept the engineer's findings |
| try_again_label | Negotiate | Ask for another pass |

### Modals fired here — narrated by Engineer

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 2 | World keeps moving | *"World keeps moving while I run the numbers. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 5 days | A week on the calcs | *"A week with the calculations. If the numbers were tighter we wouldn't need the time. They're not."* | Move on | Five days on the recalc. |

---

## ENG-FEE-REVIEW / First — *Negotiate: YES* — **Speaker: Engineer**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Engineer Fee Review | Let's settle the fee |
| Event | Engineer negotiates their initial fees. | *"Let's settle the fee. Structural is precise work — load calcs, code review, stamped drawings. The number reflects the liability I carry on this. I don't pad it."* |
| Action | Every penny counts - you get your best man involved. | Every penny counts. Pay the fee, or push back. |
| Outcome | *(empty)* | Fee settled. On to the design. |
| end_turn_label | Accept Fee | Pay the fee |
| try_again_label | Negotiate | Push back on the fee |

### Modals fired here — narrated by Engineer

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 3 | Long projects, loud days | *"Long projects, loud days. The world finds its way in. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 50 days | Fifty days on the fee | *"Fifty days to land the number. Liability isn't a quick conversation."* | Move on | Fifty days on the fee. |

---

## ENG-FEE-REVIEW / Subsequent — *Negotiate: YES* — **Speaker: Engineer**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Engineer Additional Fees | More work, more fee |
| Event | Engineer negotiates additional architect fees. | *"Scope grew. Load calcs need redoing. Either you pay for the additional engineering, or we sign off on what's already there — and I don't recommend that."* |
| Action | How do we make this sound like it is included in the original fee? | Pay the extra, or push back on the upcharge. |
| Outcome | *(empty)* | Extra fee agreed. |
| end_turn_label | Accept Fee | Pay the extra |
| try_again_label | Negotiate | Push back on the upcharge |

### Modals fired here — narrated by Engineer

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 4 | Fee talk takes a day | *"Fee talk takes a day, the world decides the rest. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 15 days | Two weeks on the upcharge | *"Two weeks on the upcharge. The math doesn't move just because you'd like it to."* | Move on | Fifteen days on the upcharge. |

---

## ENG-SCOPE-CHECK / First — *Negotiate: YES* — **Speaker: Engineer**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Engineer Scope Check | Structural design is done |
| Event | Engineer's team finished their design. Time for another final presentation. | *"Structural design is done. I know it took a while — that's what conservative load paths and code review get you. Sit through the presentation. The numbers are sound."* |
| Action | I am not building a rocket ship. Why is this taking so long? What will the design be? | Watch the presentation. Approve the structure, or send it back. |
| Outcome | *(empty)* | Structural design approved. Filings next. |
| end_turn_label | Accept Scope | Approve the structure |
| try_again_label | Negotiate | Send it back |

### Modals fired here — narrated by Engineer

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 5 | Even at the reveal | *"Even at the structural reveal, the world doesn't pause. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 50 days | Fifty days of engineering | *"Fifty days to get the structure right. I won't apologize for the time — I will for the cost if I'd rushed it."* | Move on | Fifty days on the structure. |

---

## ENG-SCOPE-CHECK / Subsequent — *Negotiate: YES* — **Speaker: Engineer**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Engineer Design Review | Revised structure, same standards |
| Event | Engineer subsequent design review determination. | *"Revised drawings. The changes are subtle — that's how structural revisions work. I'm not redesigning the wheel, I'm tightening the calcs. Compare them properly before you tell me they look the same."* |
| Action | The roll of drawings you got does not look any different. You wonder if there are changes. | Compare the new drawings to the old. Approve the revised structure, or send it back again. |
| Outcome | *(empty)* | Revised design locked. |
| end_turn_label | Accept Result | Approve the revised structure |
| try_again_label | Negotiate | Send it back again |

### Modals fired here — narrated by Engineer

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 6 | Even on the re-review | *"Even on the re-review, the world doesn't slow. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 15 days | Fifteen days on the revisions | *"Fifteen days to integrate. The revisions are smaller than the first pass — but the calcs still need to be redone."* | Move on | Fifteen days on the revisions. |

---

# REGULATORY PHASE

## REG-DOB-FEE-REVIEW / First — *Negotiate: NO* — **Speaker: DOB clerk**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Fee Review | Department of Buildings counter |
| Event | Owner pays DOB fees. | *"Department of Buildings. You're here to pay the filing fee — 1% of project value. Standard rate. Sign here, here, and here. We don't haggle on this."* |
| Action | Fork over the cash…And hire a few staff. | Pay the fee. Hire a few hands to keep the filing clean. |
| Outcome | *(empty)* | Fees paid. You're in the system. |
| end_turn_label | End Turn | Pay the DOB fee |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by DOB clerk

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 5 | Even at the counter | *"World doesn't pause for the line at our counter. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Draw 2 | Two filing hands | *"You'll need help working with our office. Two contacts who know our paperwork. Use them."* | Take them | Two expeditor contacts added. |
| Time: 10 days | Ten days for processing | *"Ten days to process. The line moves at its own pace. Welcome to civil service."* | Move on | Ten days at the DOB counter. |
| Fee: 1% | DOB fee | *"1% of project value. Statutory rate. Out of your account, into ours."* | Pay it | DOB fee paid. |

---

## REG-DOB-FEE-REVIEW / Subsequent — *Negotiate: **NO** (flipped from YES)* — **Speaker: DOB clerk**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Additional Fees | DOB add-on bill |
| Event | Determine if additional fees are due to Department of Buildings. | *"You're back. Add-on fees are owed — review the bill and pay. Once you've paid the original, the add-ons aren't up for debate. We've already done the work on this file."* |
| Action | hope not to fork over more cash…And replace staff. | Swap a worn-out helper. Pay the extra. |
| Outcome | *(empty)* | Extra fees paid. Onward. |
| end_turn_label | Accept Fee | Pay the extra |
| try_again_label | Negotiate | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by DOB clerk

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 6 | Even on the second visit | *"Second visit, world still moves on. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Replace 1 | Fresh hands | *"One of your filing contacts is burning out from working with us. Swap them before it costs you."* | Got it | Contact swapped on your roster. |
| Time: 10 days | Ten more days | *"Ten more days at our pace. Same line, same line speed."* | Move on | Ten more days at the counter. |
| Fee: variable | Add-on fee | *"DOB add-on. Standard rate. Out of your account."* | Pay it | DOB add-on fee paid. |

---

## REG-DOB-TYPE-SELECT / First — *Negotiate: NO* — **Speaker: PM (first person)**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Path Selection | I pick my DOB route |
| Event | Project manager chooses (slow and low risk) or (fast and high risk) path at DOB. | *"I'm picking my filing path. Plan Exam is slow but safe. Prof Cert is fast but risky. The owner wants this done — so do I. The call's mine."* |
| Action | You have a choice to say Plan Exam (slow) or Prof Cert (fast). | Plan Exam is slower but safer. Prof Cert is faster but riskier. Pick. |
| Outcome | *(empty)* | Path chosen. I live with it. |
| end_turn_label | End Turn | Lock in the path |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by PM

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 1 | Today wasn't quiet | *"Life lands while I'm picking the route. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 10 days | Ten days to lock it | *"Ten days just to lock the route."* | Move on | Ten days deciding. |

---

## REG-DOB-TYPE-SELECT / Subsequent — *Negotiate: NO* — **Speaker: PM (first person)**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Processing Wait | Waiting in the DOB line |
| Event | Waiting for Clerks to process files or for appointment. | *"Clerks are slow today. Nothing to do but wait — paperwork moves at the line's pace, not mine."* |
| Action | Hurry Up and Wait… | Hurry up and wait. That's the DOB rhythm. |
| Outcome | *(empty)* | Paperwork moved along. |
| end_turn_label | End Turn | Wait it out |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by PM

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 2 | Today wasn't quiet | *"Life lands while I'm waiting. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 10 days | Ten more days | *"Ten more days in the line. Nothing personal — that's just how it moves."* | Move on | Ten more days waiting. |

---

## REG-DOB-PLAN-EXAM / First — *Negotiate: YES* — **Speaker: DOB plan examiner**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Plan Exam | I'm reading your plans |
| Event | Let me review these plans. I need to verify everything meets building code. | *"I'm working through your plans page by page — every elevation, every section. Checking against code. Nothing personal. If there's an objection, I'll write it up. Save us both time and submit clean."* |
| Action | Wait for the examiner's determination. You can negotiate if the result is unfavorable. | Accept the examiner's verdict, or resubmit with revisions. |
| Outcome | *(empty)* | Examiner's verdict is in. |
| end_turn_label | Accept Result | Accept the examiner's verdict |
| try_again_label | Negotiate | Resubmit with revisions |

### Modals fired here — narrated by DOB plan examiner

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 3 | Even at the examiner's desk | *"Plans on my desk, world keeps moving. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 10 days | Ten days with your file | *"Ten days to read it properly. I won't rush a code check — neither should you."* | Move on | Ten days under exam. |

---

## REG-DOB-PLAN-EXAM / Subsequent — *Negotiate: YES* — **Speaker: DOB plan examiner**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Plan Re-exam | I'm reading the resubmission |
| Event | Back again? Let me take another quick look at the revised submissions. | *"I'm reading the resubmission. I flip faster on the second pass — I already know what to look for. If you fixed the objections, it'll go quick. If you didn't, it'll go quicker."* |
| Action | The examiner reviews your resubmission. Approval or denial — stay quiet and wait. | Accept the second read, or resubmit again. |
| Outcome | *(empty)* | Second verdict in. |
| end_turn_label | Accept Result | Accept the second read |
| try_again_label | Negotiate | Resubmit again |

### Modals fired here — narrated by DOB plan examiner

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 4 | Even on the second read | *"Resubmissions don't pause the world. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 10 days | Ten days on the resubmission | *"Ten days on the second read. Faster than the first — for what that's worth."* | Move on | Ten days on resubmission. |

---

## REG-DOB-PROF-CERT / First — *Negotiate: NO* — **Speaker: DOB clerk**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Professional Certification | Prof Cert filing accepted |
| Event | DOB Clerk almost notices your existence while processing your paperwork. | *"Prof Cert filing. Self-certified — we barely look. That's the deal you signed up for. Stamp it, file it, you're out the door. Just hope the data entry hand types your numbers right — that's on you, not us."* |
| Action | You chew your gum intently hoping no errors are done in data entry. | File and hope no one checks too hard. |
| Outcome | *(empty)* | Cert filed. |
| end_turn_label | End Turn | File and go |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by DOB clerk

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| Time: 1 day | One day, in and out | *"One day to file. We don't slow you down on Prof Cert — that's the trade."* | Move on | One day at the counter. |

---

## REG-DOB-PROF-CERT / Subsequent — *Negotiate: NO* — **Speaker: DOB clerk**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Prof Cert Follow-up | You again — second cert |
| Event | DOB Clerk greets you by saying -You again?- and processes your paper work | *"You again. Hand it over. Hope your expeditor filled the forms right — at this counter, errors aren't our problem. They're yours."* |
| Action | You hope that this time the expeditor filled out the forms correctly… after all you paid almost a grand. | File and hope. |
| Outcome | *(empty)* | Filed. For better or worse. |
| end_turn_label | End Turn | File and hope |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by DOB clerk

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| Time: 1 day | One day, fingers crossed | *"One day in and out. Hope your forms are clean."* | Move on | One day at the counter. |

---

## REG-DOB-AUDIT / First — *Negotiate: YES* — **Speaker: DOB auditor**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Audit | Auditor's at your file |
| Event | Nerdy auditor cites from memory ZR-23.5 while auditing your application. | *"I've pulled your file. ZR-23.5, ZR-25-13, that side yard variance you skipped — I cite them from memory because that's my job. Audits aren't paranoid. They're routine. The findings are yours to accept or contest."* |
| Action | You got home after a long day at Department of Buildings and you find that your job was audited - where did we go wrong? | Read the findings. Accept them, or dispute. |
| Outcome | *(empty)* | Audit findings in hand. |
| end_turn_label | Accept Result | Accept the findings |
| try_again_label | Negotiate | Dispute the audit |

### Modals fired here — narrated by DOB auditor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 5 | Under the microscope | *"World keeps moving while I read your file cover to cover. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 10 days | Ten days under the microscope | *"Ten days reading your file end to end. I miss nothing — that's why they pay me."* | Move on | Ten days under audit. |

---

## REG-DOB-AUDIT / Subsequent — *Negotiate: YES* — **Speaker: DOB auditor**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Audit Follow-up | Down to the last objections |
| Event | Auditor notices the number of objections fixed and continues with audit. | *"You've cleared most of the objections. A few remain. We'll close them out one of two ways — you accept the final findings, or we have one more conversation. I'd recommend the first."* |
| Action | We almost had it and now it is down to the last few objections. Will they pass? | Down to the last few. Accept the final call, or push the last few. |
| Outcome | *(empty)* | Final audit call is in. |
| end_turn_label | Accept Result | Accept the final call |
| try_again_label | Negotiate | Push the last few |

### Modals fired here — narrated by DOB auditor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 6 | Even during follow-up | *"Follow-up doesn't pause the world. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 10 days | Ten days on follow-up | *"Ten days of follow-up. Photocopying isn't fast at this office."* | Move on | Ten days on follow-up. |

---

## REG-DOB-FINAL-REVIEW / First — *Negotiate: YES* — **Speaker: DOB clerk**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Final Review | Final review counter |
| Event | The clerks are having a birthday party. Everything is delayed an hour | *"Final review. Birthday party in the back office — everything's running an hour late. You picked a good day to come in. Maybe your file gets a softer read. Maybe."* |
| Action | At least the clerks will be happy - you think when you hand in the final files. | Accept the verdict, or ask for another pass. |
| Outcome | *(empty)* | Final verdict is in. |
| end_turn_label | Accept Result | Accept the verdict |
| try_again_label | Negotiate | Ask for another pass |

### Modals fired here — narrated by DOB clerk

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 3 | Even at the final counter | *"Even at the final counter, the world keeps moving. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Draw 3 | Closing-team intros | *"Three names from our regulars — specialists in closing files clean. Use them. They'll push it through."* | Take them | Three expeditor contacts added. |

---

## REG-DOB-FINAL-REVIEW / Subsequent — *Negotiate: YES* — **Speaker: DOB clerk**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | DOB Final Review Follow-up | Final review, second pass |
| Event | the supervisor is consoling one of the clerks - everything is slow again. | *"Bad day at the counter. Supervisor's consoling a clerk who just got chewed out. Files are crawling. Hope nobody notices the photocopy where the original should be."* |
| Action | Worst part is everyone seems in bad mood. Will they notice the photocopy instead of original? | Accept the verdict, or ask for another pass. |
| Outcome | *(empty)* | Final verdict is in. |
| end_turn_label | Accept Result | Accept the verdict |
| try_again_label | Negotiate | Ask for another pass |

### Modals fired here — narrated by DOB clerk

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 4 | Take two doesn't pause the world | *"World still turns during the second pass. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Draw 1 | One more pair of hands | *"One of our clerks recommends someone — extra hand to push through the last paperwork."* | Take it | One expeditor contact added. |

---

## REG-FDNY-FEE-REVIEW / First — *Negotiate: NO* — **Speaker: FDNY clerk**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | FDNY Fee Review | FDNY intake desk |
| Event | FDNY Clerk checks to see if job review needs to be done. | *"FDNY intake. We deal with what kills people in fires — sprinklers, standpipes, alarms, egress. Don't dance with us. Yes/no questions, straight answers. You hedge, we catch it."* |
| Action | You have to answer a maze of questions to get out of here. | Answer the routing questions. Be straight — they catch a hedge. |
| Outcome | *(empty)* | Path through FDNY determined. |
| end_turn_label | End Turn | Take the FDNY route |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by FDNY clerk

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| Time: 1 day | Intake's a day | *"One day to route you. We don't drag intake — we save the time for review."* | Move on | One day at FDNY intake. |
| Fee: 1% | FDNY fee | *"1% past the front desk. Statutory."* | Pay it | FDNY fee paid. |

---

## REG-FDNY-FEE-REVIEW / Subsequent — *Negotiate: NO* — **Speaker: FDNY clerk**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | FDNY Fee Follow-up | FDNY intake, second visit |
| Event | FDNY Clerk checks to see if job review needs to be done. | *"Second visit. We remember faces here. Recognition usually means more attention, not less. Same questions — answer them the same way."* |
| Action | Assess 4 criteria. | Run through intake again. Be straight — they remember inconsistencies. |
| Outcome | *(empty)* | Path through FDNY updated. |
| end_turn_label | End Turn | Take the updated route |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by FDNY clerk

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| Time: 1 day | One more day | *"One day. We've answered these questions before."* | Move on | One day at FDNY intake. |

---

## REG-FDNY-PLAN-EXAM / First — *Negotiate: YES* — **Speaker: FDNY plan examiner**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | FDNY Plan Exam | FDNY plan exam |
| Event | Plan examiner takes time to do first review. | *"I read for what kills people in fires. Sprinkler heads, standpipe risers, egress widths, alarm zones. Sound like you know the code if you want — I actually know it. Objections come back specific."* |
| Action | You try to sound like you know the code and wait for their determination. | Accept FDNY's verdict, or push back on objections. |
| Outcome | *(empty)* | FDNY verdict in. |
| end_turn_label | Accept Result | Accept FDNY's verdict |
| try_again_label | Negotiate | Push back on objections |

### Modals fired here — narrated by FDNY plan examiner

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 1 | Under FDNY's eye | *"World doesn't pause for FDNY review. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 10 days | Ten days under review | *"Ten days with your fire-safety plans on my desk. I read every page."* | Move on | Ten days under FDNY review. |

---

## REG-FDNY-PLAN-EXAM / Subsequent — *Negotiate: NO* — **Speaker: FDNY plan examiner**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | FDNY Plan Re-exam | FDNY second read — final |
| Event | Plan examiner rushes through the review. | *"You've been here once. We don't do third negotiations — this round you get a stamp or you don't. Sit quietly. Speak only when spoken to."* |
| Action | You stay quiet and only speak when spoken to - which stamp will he use approval or denial? | Approval stamp or denial stamp — which one comes out? |
| Outcome | *(empty)* | Stamp chosen. |
| end_turn_label | End Turn | Take the stamp |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by FDNY plan examiner

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 2 | Even on the second read | *"Second read still doesn't pause the world. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| Time: 5 days | Five days for the second pass | *"Five days. The decision is faster — the standard isn't."* | Move on | Five days under FDNY review. |

---

# CONSTRUCTION PHASE

## CON-INITIATION / First — *Negotiate: YES* — **Speaker: Contractor**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Contractor Selection | Sit down, let's talk price |
| Event | Alright, let's talk business. You need someone to build this thing and I'm your guy. | *"Sit down. You need someone to build this thing — I'm your guy. Quality, cost, schedule — pick two, but I'll be straight with you on all three. Cheap crew costs you on the back end. Good crew costs you up front. Your call."* |
| Action | Evaluate the contractor's quality and cost multiplier. Do the math. | Quality and cost multiplier on the table. Sign the contractor, or push back on the price. |
| Outcome | *(empty)* | Contractor hired. Dig starts soon. |
| end_turn_label | Accept Terms | Sign the contractor |
| try_again_label | Negotiate | Push back on the price |

### Modals fired here — narrated by Contractor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 3 | Life happens, work continues | *"World's not gonna pause while we hire. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Draw 3 | My crew comes with me | *"Three of my best — each one a specialist. They'll run the site for you."* | Take them | Three contractor crew added. |

---

## CON-INITIATION / Subsequent — *Negotiate: YES* — **Speaker: Contractor**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Change Order Negotiation | Change order on the table |
| Event | Look, things changed on site. We need to renegotiate the terms. | *"Look — things shifted on site. Found something we couldn't see in the drawings. I need a change order. Time extension, extra fee. Not unreasonable. But it's not free either."* |
| Action | The contractor wants a change order. Negotiate the time extension. | Approve the change order, or push back. |
| Outcome | *(empty)* | Change order accepted. |
| end_turn_label | Accept Terms | Approve the change order |
| try_again_label | Negotiate | Push back on the change order |

### Modals fired here — narrated by Contractor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 4 | Change-order day | *"Even change-order day doesn't pause the world. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Draw 1 | One extra hand | *"The change adds work. Got one extra specialist who can absorb it."* | Take it | One contractor contact added. |

---

## CON-ISSUES / First — *Negotiate: NO* — **Speaker: Contractor**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Construction Issues | We hit something in the field |
| Event | Construction many time unearths unforeseen issues in the field. | *"Boss — we hit something in the field. Wasn't on the drawings. Every hour we're stopped costs you. Need to swap a body in for the right specialist. We can fix it on site if we move now."* |
| Action | You attempt to resolve everything on the spot because delays are expensive. | Swap a contact for the right specialist. Try to fix it on site. |
| Outcome | *(empty)* | Issue addressed. Moving on. |
| end_turn_label | End Turn | Move past it |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by Contractor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 5 | Even fixing things | *"World keeps moving while we fix things. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Replace 1 | Right tool for the job | *"This needs a specific specialist. Swapping someone out, the right body in."* | Got it | Contact swapped on your roster. |

---

## CON-ISSUES / Subsequent — *Negotiate: NO* — **Speaker: Contractor**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | More Construction Issues | Another one in the field |
| Event | Problems never stop at a construction site - but every day counts. | *"Boss — another one. Construction sites don't hand you problems one at a time, they pile up. Every day we're slowed costs you. Push hard or eat the delay."* |
| Action | Once again you try to prevent issues. No time for delays. | Push hard to head off the delay. No time to spare. |
| Outcome | *(empty)* | Issue handled. |
| end_turn_label | End Turn | Move past it |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by Contractor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 6 | Worst time | *"Life lands at the worst times. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Person to your right takes a card | Lost one to the neighbor | *"PM next door spotted one of your guys and pulled them onto their job. Their gain, your loss."* | That stings | One contact poached by neighbor. |

---

## CON-INSPECT / First — *Negotiate: NO* — **Speaker: Contractor** *(multi-NPC scene — Contractor narrates the inspector's visit)*

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Construction Inspection | Inspector just walked in |
| Event | That inspector looks fresh this is either good or bad news. | *"Boss — inspector just walked onto the site. Looks fresh, that cuts both ways. There's a safety violation by the southwest corner — let me steer them somewhere else while you handle the paperwork."* |
| Action | You notice a safety violation and distract the inspector making him look the other way - will it work? | Steer their attention elsewhere. See if it works. |
| Outcome | *(empty)* | Inspection complete. |
| end_turn_label | End Turn | Wrap the inspection |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by Contractor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 1 | During the inspection | *"World keeps moving even when the inspector's here. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Return 1 | Clean break | *"Something didn't pass. One of your people takes the paperwork hit — they'll step away. Keeps the rest of us clear."* | Got it | One expeditor off your roster. |

---

## CON-INSPECT / Subsequent — *Negotiate: NO* — **Speaker: Contractor**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Follow-up Inspection | Johnes is back for the follow-up |
| Event | Inspector Johnes never liked you; but at least he tries to be fair. | *"Boss — Inspector Johnes is back. He never liked you, but he's fair. Frank's crew just wrapped, two of his guys can join us for the walk. Extra eyes, extra hands. Keep our story straight."* |
| Action | Luckily the Frank's team just finished in time for this inspection. You think it should be smooth sailing. | Walk the site with the inspector. Steady answers, no volunteered info. |
| Outcome | *(empty)* | Follow-up complete. |
| end_turn_label | End Turn | Wrap the walkthrough |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

### Modals fired here — narrated by Contractor

| effect_action | modal_title | modal_description | modal_button_label | modal_summary |
|---|---|---|---|---|
| l_card: Draw 1 if you roll a 2 | During the walkthrough | *"World keeps turning during the walk. {cardTitle} — {cardDescription}."* | Got it | A life event hit. |
| e_card: Draw 2 | Reinforcements | *"Frank's two best join the walkthrough. Now on your roster — experienced contacts."* | Take them | Two expeditor contacts added. |

---

# END PHASE

## FINISH / First & Subsequent — *Negotiate: NO* — **Speaker: Owner (warm register, end-of-project)**

### Field-level replacements

| Field | Current | Proposed |
|---|---|---|
| Title | Project Complete! | You delivered |
| Event | You Completed project! | *"You delivered. Took longer than I wanted, cost more than I budgeted — but it's done, and it's done right. That's what matters in the end. Good work."* |
| Action | YOU ARE done! Calculate final score. | Final score gets calculated here. |
| Outcome | *(empty)* | Project delivered. Score incoming. |
| end_turn_label | End Turn | End the project |
| try_again_label | Try Again | *(not rendered — Negotiate=NO)* |

*(No modal effects — endpoint only.)*

---

# QUICK BUTTON-LABEL SCAN

| Space / Visit | Current `end_turn_label` → Proposed | Current `try_again_label` → Proposed |
|---|---|---|
| OWNER-SCOPE-INITIATION First | Agree with Owner → **Lock the scope** | Negotiate → **Push back on scope** |
| OWNER-FUND-INITIATION First | Agree with Owner → **Take the check** | Negotiate → **Push for more** |
| PM-DECISION-CHECK First | End Turn → **Move forward** | — |
| PM-DECISION-CHECK Sub | End Turn → **Commit to the new plan** | — |
| OWNER-DECISION-REVIEW First | Agree with Owner → **Go with the owner's call** | Negotiate → **Push back on it** |
| OWNER-DECISION-REVIEW Sub | Agree with Owner → **Go with the owner's call** | Negotiate → **One more round** |
| CHEAT-BYPASS First | End Turn → **Make the play** | — |
| CHEAT-BYPASS Sub | End Turn → **Try the careful version** | — |
| LEND-SCOPE-CHECK First | Accept Scope → **Lock the scope** | Negotiate → **Push for better terms** |
| LEND-SCOPE-CHECK Sub | End Turn → **Take what they're offering** | — |
| BANK-FUND-REVIEW First | Accept Funding → **Sign the loan** | Negotiate → **Push for a lower rate** |
| BANK-FUND-REVIEW Sub | End Turn → **Take the revised loan** | — |
| INVESTOR-FUND-REVIEW First | Accept Funding → **Sign with the investors** | Negotiate → **Push for better terms** |
| INVESTOR-FUND-REVIEW Sub | End Turn → **Take their offer** | — |
| ARCH-INITIATION First | End Turn → **Hire the architect** | — |
| ARCH-INITIATION Sub | End Turn → **Approve the redesign** | Try Again → **Push back on the changes** *(now rendered — flip)* |
| ARCH-FEE-REVIEW First | Accept Fee → **Pay the fee** | Negotiate → **Push back on the fee** |
| ARCH-FEE-REVIEW Sub | Accept Fee → **Pay the extra** | Negotiate → **Push back on the upcharge** |
| ARCH-SCOPE-CHECK First | Accept Scope → **Approve the design** | Negotiate → **Send it back** |
| ARCH-SCOPE-CHECK Sub | Accept Result → **Approve the revisions** | Negotiate → **Send it back again** |
| ENG-INITIATION First | End Turn → **Hire the engineer** | — |
| ENG-INITIATION Sub | Accept Result → **Accept the engineer's findings** | Negotiate → **Ask for another pass** |
| ENG-FEE-REVIEW First | Accept Fee → **Pay the fee** | Negotiate → **Push back on the fee** |
| ENG-FEE-REVIEW Sub | Accept Fee → **Pay the extra** | Negotiate → **Push back on the upcharge** |
| ENG-SCOPE-CHECK First | Accept Scope → **Approve the structure** | Negotiate → **Send it back** |
| ENG-SCOPE-CHECK Sub | Accept Result → **Approve the revised structure** | Negotiate → **Send it back again** |
| REG-DOB-FEE-REVIEW First | End Turn → **Pay the DOB fee** | — |
| REG-DOB-FEE-REVIEW Sub | Accept Fee → **Pay the extra** | Negotiate → *(not rendered — flip to NO)* |
| REG-DOB-TYPE-SELECT First | End Turn → **Lock in the path** | — |
| REG-DOB-TYPE-SELECT Sub | End Turn → **Wait it out** | — |
| REG-DOB-PLAN-EXAM First | Accept Result → **Accept the examiner's verdict** | Negotiate → **Resubmit with revisions** |
| REG-DOB-PLAN-EXAM Sub | Accept Result → **Accept the second read** | Negotiate → **Resubmit again** |
| REG-DOB-PROF-CERT First | End Turn → **File and go** | — |
| REG-DOB-PROF-CERT Sub | End Turn → **File and hope** | — |
| REG-DOB-AUDIT First | Accept Result → **Accept the findings** | Negotiate → **Dispute the audit** |
| REG-DOB-AUDIT Sub | Accept Result → **Accept the final call** | Negotiate → **Push the last few** |
| REG-DOB-FINAL-REVIEW First | Accept Result → **Accept the verdict** | Negotiate → **Ask for another pass** |
| REG-DOB-FINAL-REVIEW Sub | Accept Result → **Accept the verdict** | Negotiate → **Ask for another pass** |
| REG-FDNY-FEE-REVIEW First | End Turn → **Take the FDNY route** | — |
| REG-FDNY-FEE-REVIEW Sub | End Turn → **Take the updated route** | — |
| REG-FDNY-PLAN-EXAM First | Accept Result → **Accept FDNY's verdict** | Negotiate → **Push back on objections** |
| REG-FDNY-PLAN-EXAM Sub | End Turn → **Take the stamp** | — |
| CON-INITIATION First | Accept Terms → **Sign the contractor** | Negotiate → **Push back on the price** |
| CON-INITIATION Sub | Accept Terms → **Approve the change order** | Negotiate → **Push back on the change order** |
| CON-ISSUES First | End Turn → **Move past it** | — |
| CON-ISSUES Sub | End Turn → **Move past it** | — |
| CON-INSPECT First | End Turn → **Wrap the inspection** | — |
| CON-INSPECT Sub | End Turn → **Wrap the walkthrough** | — |
| FINISH | End Turn → **End the project** | — |

---

## What I need from you

1. **Read through.** Voice rule was rewritten 2026-04-25 (PM-collapsed → NPC-of-the-space). Mark any cell where the proposed text doesn't sound right for the assigned speaker.
2. **Two flagged speaker calls** to confirm or override:
   - `ARCH-INITIATION / Subsequent` — voiced as **Architect** (asking for redesign), not PM. Speaker map says `ARCH-INITIATION = PM` (PM is searching), but the Subsequent visit is post-hire where the architect drives the conversation.
   - `ENG-INITIATION / Subsequent` — same situation, voiced as **Engineer**.
3. **Multi-NPC scene** to confirm: `CON-INSPECT / First & Subsequent` voiced as **Contractor** narrating the inspector's visit (rather than introducing the inspector as a separate voice). Matches the speaker map (`CON-* = Contractor`).
4. **Confirm the four CSV structural changes** at the top.
5. **Once approved**, edit `Spaces.csv` (text + flag flips + row deletions) and populate `ModalConfig.csv` with the new modal copy. Ship as v2.51.0.

### Speakers established in this rewrite

| Speaker | Spaces |
|---|---|
| **PM** (first person) | PM-DECISION-CHECK, CHEAT-BYPASS, ARCH-INITIATION/First, ENG-INITIATION/First, REG-DOB-TYPE-SELECT |
| **Owner** | OWNER-SCOPE-INITIATION, OWNER-FUND-INITIATION, OWNER-DECISION-REVIEW, FINISH (warm register at end) |
| **Lender** | LEND-SCOPE-CHECK |
| **Banker** | BANK-FUND-REVIEW |
| **Investor** | INVESTOR-FUND-REVIEW |
| **Architect** | ARCH-FEE-REVIEW, ARCH-SCOPE-CHECK, ARCH-INITIATION/Subsequent *(flagged)* |
| **Engineer** | ENG-FEE-REVIEW, ENG-SCOPE-CHECK, ENG-INITIATION/Subsequent *(flagged)* |
| **DOB clerk** | REG-DOB-FEE-REVIEW, REG-DOB-PROF-CERT, REG-DOB-FINAL-REVIEW |
| **DOB plan examiner** | REG-DOB-PLAN-EXAM |
| **DOB auditor** | REG-DOB-AUDIT |
| **FDNY clerk** | REG-FDNY-FEE-REVIEW |
| **FDNY plan examiner** | REG-FDNY-PLAN-EXAM |
| **Contractor** | CON-INITIATION, CON-ISSUES, CON-INSPECT *(multi-NPC scene)* |
