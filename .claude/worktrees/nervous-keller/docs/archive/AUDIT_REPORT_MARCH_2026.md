# Game Alpha — Health Check Report
**Date:** March 10, 2026
**Prepared for:** Tomas
**Purpose:** Honest assessment of the codebase before moving from Alpha to Beta

---

## How to Read This Report

Think of the game's code like a building. This report is the inspector's walkthrough before you open to the public. Each finding is rated:

- **RED** — Needs fixing before Beta. Could cause visible bugs or confusion.
- **YELLOW** — Should fix soon. Won't break anything today, but will slow you down later.
- **GREEN** — Noted for awareness. Fix when convenient.

For each issue, I explain **what it is**, **why it matters**, and give a **real-world analogy**.

---

## RED — Fix Before Beta

### 1. Two Blueprints for the Same Thing (Duplicate GameState)

**What:** The code has two different definitions of what "the current state of the game" looks like. One is an old version with 5 fields. The other is the current version with 60+ fields. Both are named `GameState`.

**Analogy:** Imagine having two floor plans for the same building — one from 2023 with 5 rooms, one from 2025 with 60 rooms. If a contractor grabs the wrong one, they'll build the wrong thing.

**Risk:** If any future code accidentally imports the old version, it will silently use the wrong data structure. Things would look fine but behave incorrectly.

**Fix:** Delete the old one. Quick, safe, no side effects.

---

### 2. A Door That Goes Nowhere (Empty Code Branch)

**What:** When a player plays a card manually (not auto-played), the code has an empty block — literally "do nothing." The auto-play path works fine, but the manual path is blank.

**Where:** CardEffectHandler, the section that processes card plays.

**Analogy:** A hallway that splits left and right. Left leads to the conference room. Right leads to... a wall. Nobody has hit the wall yet because most cards auto-play, but when someone eventually takes the right turn, nothing will happen.

**Risk:** If/when a card needs manual play processing, this will silently fail.

**Fix:** Need your input — should manual plays do the same thing as auto-plays, or something different?

---

### 3. Two Versions of the Same Button

**What:** There are two `ActionButton` components in the code. One is simple (49 lines, no styling). The other is full-featured (92 lines with animations, loading spinners, active state glow). One screen uses the simple version; all other screens use the full version.

**Analogy:** You ordered 50 identical door handles for a hotel, but one room got a cheap handle from a different supplier. It works, but it looks and feels different.

**Risk:** The simple button is missing the loading spinner and active state. On that one screen, buttons will look slightly different from everywhere else.

**Fix:** Delete the simple version, point that one screen to the full version.

---

### 4. Negotiation Feature is Fake

**What:** The game has a `NegotiationService` with `acceptOffer()` and `declineOffer()` methods. But these methods are hollow — they always return "success" with a hardcoded temporary ID, regardless of what the player actually does. They don't change any game state.

**Analogy:** There's a "Submit Complaint" form on a website, but pressing Submit just shows "Thank you!" without actually recording or sending anything.

**Risk:** If players reach a negotiation scenario, it will appear to work but nothing actually happens behind the scenes. The game continues as if no deal was made.

**Your decision needed:**
- Is negotiation a feature you want for Beta? → It needs to be built properly.
- Is it not needed yet? → Remove the fake code so nobody gets confused.

---

## YELLOW — Fix Soon

### 5. Debug Messages Came Back (296 of them)

**What:** In February, 586 debug messages were cleaned out of the code as part of security hardening. Since then, 296 new ones have crept back in through new feature work. These are messages like `"🔄 Creating TEMP state..."` and `"✅ Changes applied..."` with emoji.

**Analogy:** You deep-cleaned the house before guests arrived. Then over the next month of living in it, clutter accumulated again — coffee cups on counters, mail on tables.

**Risk:** Not a security issue since they only show in the browser's developer console (which normal players never open). But it's messy, slightly hurts performance, and if someone technical inspects the game, it looks unpolished.

**Fix:** Another cleanup sweep. Could also add a "debug mode" switch so these messages only appear during development.

---

### 6. Same Animation Defined Four Times

**What:** The "pulse" animation (a gentle glow effect) is defined in four separate CSS files. The "bounce" animation is defined in two files. They're identical copies.

**Analogy:** Four different instruction manuals in a factory each contain the same safety procedure. When you need to update the procedure, you have to remember to change all four — and you probably won't.

**Risk:** If someone updates the animation in one file but not the others, different parts of the game will animate differently. Also wastes a tiny bit of loading time.

**Fix:** Keep the animations in one central file, remove the copies.

---

### 7. Documentation Says One Thing, Code Says Another

**What:** Several documents have fallen out of date:

| The docs say... | But actually... |
|----------------|-----------------|
| "Built with React 18" | Uses React 19 (upgraded months ago) |
| "26 service files" | There are 27+ now |
| "Services should be under 300 lines" | Five services are 500-800+ lines |
| "Production Ready (October 2025)" | Phase 3B (External Testing) hasn't started yet |
| "586 console.logs removed" | 296 new ones have appeared since |

**Analogy:** The restaurant menu says "Grilled Salmon" but the kitchen is actually serving "Pan-Seared Salmon." The food is fine, but the menu is wrong. New staff (or AI assistants) reading the menu will get confused.

**Risk:** Any new developer (or AI) reading the docs will make assumptions based on outdated information. This leads to wrong decisions.

**Fix:** Update the documents to match reality. Takes about 30 minutes.

---

### 8. Two Remote Configuration Systems

**What:** The code has two separate modules that fetch settings from your dashboard server. One is basic (41 lines, no caching). The other is full-featured (91 lines, with caching and fallback defaults). They live in different folders and don't know about each other.

**Analogy:** Two employees independently call the same supplier to check prices. They get the same information but neither knows the other is calling. Wasted effort, and if the supplier changes their number, you have to update it in two places.

**Fix:** Keep the better one, delete the simpler one.

---

### 9. Duplicate Money Formatting

**What:** There's a proper `formatMoney()` utility that formats numbers nicely ($1,500, $2.5M, etc.). But one screen ignores this utility and has its own simpler version inline — which is missing features like the K/M/B abbreviations.

**Analogy:** The company has a standard letterhead template, but one department designed their own. Letters from that department look slightly different.

**Fix:** Replace the homemade version with the standard utility. Two-line change.

---

### 10. Movement Logic Written Twice

**What:** The code for "when a player has multiple paths to choose from" is implemented in two different files — `MovementChoiceManager` and `MovementService`. They do essentially the same thing.

**Analogy:** Two project managers independently creating the same meeting schedule. If one updates the schedule but the other doesn't, people get confused about which meeting is real.

**Risk:** If a bug is found in this logic and fixed in one place, the other copy still has the bug.

**Fix:** Merge them into one file.

---

### 11. Broken Utility Scripts

**What:** The `scripts/` folder contains four old scripts that no longer work:
- `setup-game-data.sh` — calls three Python files that were deleted months ago
- `compare-migration.py` — references folder paths that don't exist
- `fix-l-cards.py` — a one-time fix that was already applied
- `restore-card-columns.py` — a one-time restore that was already done

**Analogy:** Old instruction cards pinned to a workshop bulletin board: "Call Jim at ext. 234 to fix the printer." Jim left the company a year ago and ext. 234 is disconnected.

**Risk:** If someone (or an AI) tries to use these scripts, they'll fail with confusing errors.

**Fix:** Delete all four.

---

### 12. Build Output Contains Backup Files

**What:** The `dist/` folder (what gets deployed to your server) contains old backup CSV files and source data files that shouldn't be there: `CARDS_EXPANDED_BACKUP.csv`, `CARDS_new.csv`, `CARDS_RICH.csv`, etc.

**Analogy:** Shipping a product box that contains not just the product, but also the prototype, the rejected design, and the manufacturing notes. The customer doesn't need any of that.

**Risk:** Slightly increases download size. Could also leak internal data structure details.

**Fix:** Clean up the dist folder and configure the build to exclude these files.

---

### 13. Stale Git Branch

**What:** There's a branch called `xenodochial-brown` that diverged from the main code 143 commits ago. It was likely created by Gemini during an earlier phase. It can never be merged back — the two have diverged too far.

**Analogy:** A fork in a hiking trail. One path went to the summit (master). The other path was abandoned after 100 meters. The abandoned path is still marked on the map, confusing hikers.

**Fix:** Delete the branch.

---

## GREEN — Awareness / Future Cleanup

### 14. Turn Summary Feature is a Placeholder

**What:** `PlayerViewStateService.buildTurnSummary()` is supposed to generate a summary of what happened during a player's turn. Currently it returns a near-empty placeholder.

**Decision:** Is this a feature you want? If not, remove the stub. If yes, it needs implementation.

---

### 15. Cost Calculation is Hardcoded to Zero

**What:** In the Time section, there's a line: `const cost = 0; // TODO: Implement cost calculation if needed`

**Decision:** Should spending time have a cost? If not, remove the TODO. If yes, define the cost formula.

---

### 16. Two Discard Pile Modals

**What:** There are two modal windows for viewing discarded cards — `DiscardPileModal` and `DiscardedCardsModal`. They appear to do similar things with different approaches.

**Risk:** Low — they may serve slightly different purposes. Worth checking if both are needed.

---

### 17. Empty `tools/` Folder

**What:** A folder called `tools/` exists but contains nothing.

**Fix:** Delete it, or note what it's reserved for.

---

### 18. Button Colors Disagree

**What:** In one CSS file, a button's hover color is defined as a theme variable (`var(--primary-hover)`). In another CSS file, the same button's hover color is hardcoded as `#218838` (a specific green). If someone changes the theme, one button won't follow.

---

### 19. Build Target Mismatch

**What:** TypeScript is configured to output code compatible with browsers from 2020 (ES2020), but the build tool (Vite) is configured to output the absolute latest JavaScript (ESNext). This inconsistency is unlikely to cause issues today but could cause subtle bugs with certain JavaScript features.

---

### 20. Unused Debug Component

**What:** A `PlayerDebug` component exists in the code — a floating panel that shows internal game state. Nothing in the game actually uses it (zero imports). It was likely used during early development and forgotten.

---

## Summary: The State of Things

| Category | Count | Effort to Fix |
|----------|-------|---------------|
| RED — Fix before Beta | 4 issues | 1-3 hours (except negotiation — needs your decision) |
| YELLOW — Fix soon | 9 issues | 3-5 hours total |
| GREEN — When convenient | 7 issues | 1-2 hours total |

### The Big Picture

The game's core logic is solid. Turn processing, card effects, dice rolls, movement — all working and well-tested (~1,300+ tests). The server architecture is clean. The deployment pipeline works.

What you're seeing is the natural accumulation of "vibe coding" — when you're building fast, small messes pile up:
- Things get copied instead of shared (buttons, animations, money formatting)
- Placeholder code gets written and forgotten (negotiation, turn summary, cost calculation)
- Documentation drifts from reality
- Cleanup gets undone by new features (console messages)

None of these are structural problems. They're housekeeping. A focused cleanup session of 5-8 hours would resolve everything in RED and YELLOW, leaving you with a clean codebase ready for Beta testers.

### What I Need From You

Before I can fix everything, I need your decisions on these items:

1. **Negotiation** — Keep for Beta, or remove for now?
2. **Manual card play** (the empty else block) — Same behavior as auto-play, or different?
3. **Turn summary** — Want this feature, or remove the placeholder?
4. **Time cost** — Should spending time cost something, or is free correct?
5. **Console messages** — Another sweep, or implement a debug toggle?
6. **The two discard modals** — Do you use both, or can we merge them?

---

*Report generated by Claude — March 10, 2026*
*Based on full codebase audit (5 parallel analysis passes) + documentation cross-reference + git history review*
