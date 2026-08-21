# Card Library — design spec (the "rolodex" model)

**Status:** Design session with the maintainer 2026-08-21, decisions recorded below. Extends [TEACHER_LAYER_DESIGN.md](TEACHER_LAYER_DESIGN.md) rather than replacing it — that spec's slot/card split is the foundation this builds on, and its "Editor mapping" line (decision 3, [line 53](TEACHER_LAYER_DESIGN.md)) is the half-finished piece this doc finally closes. Every claim below about current behavior was verified against the code on 2026-08-21, with file references given; nothing here is inferred from the older spec's intent.
**Owns:** card ownership tiers, edit-as-new-version, the single space-editing surface, and the durability fix for the maintainer's own content edits.
**Companion TODO entry:** "Card library / space-editor consolidation" (TODO.md, 2026-08-21).

---

## The problem this kills

Three separate problems, one root.

**1. Two screens that look like they do the same job.** Admin Tools offers ⚙️ **Space Data Editor** and 🏫 **Classroom Setup**. They overlap on exactly six fields (`Title`, `Event`, `Action`, `Outcome`, `Time`, `Fee` — [instanceCatalog.js:19](../../server/instanceCatalog.js)), both change the board actually being played, and neither explains how it differs from the other. The maintainer's report, verbatim: *"to me they do the same thing in different ways."*

**2. The better-looking editor is the one that loses your work.** The Space Data Editor reads and writes the master CSVs ([DataEditor.tsx:143](../../src/components/editor/DataEditor.tsx), `POST /api/admin/save-source-files`, [server.js:969](../../server/server.js)). On boot, `initWritableData()` ([server.js:356](../../server/server.js)) compares a **content hash** of the writable stock against the shipped image (`computeStockVersion`) and re-seeds from the image when they differ. Saving in the editor is precisely what makes them differ — so **every Space Data Editor edit is reverted by the next restart or deploy**, backup taken first. Classroom Setup's changes live in `game-data/instances/` which `deploy.sh` is explicitly instructed never to touch, and persist forever. The durability is exactly backwards from what the two screens look like.

**3. Editing destroys the previous version.** `updateTeacherCopy` mutates in place and `deleteTeacherCopy` deletes outright, also clearing the slot pointer ([instanceStore.js](../../server/instanceStore.js)). There is no way back to what a card said before an edit.

## The model

The maintainer's mental model (2026-08-21): **a rolodex of cards.** A teacher flips through the available cards for a spot on the board and picks the one they want. Editing a card doesn't change it — it produces a new card, and the old one stays in the rolodex.

- **Slot** — a position on the board (`ARCH-FEE-REVIEW`). Slot names remain the only space identifiers in baked files; that invariant from the teacher-layer spec is unchanged and load-bearing.
- **Card** — the content that fills a slot. Already exists in two flavors (stock card, teacher copy); this spec gives every card an **owner**.
- **Rolodex** — every card visible to you for a given slot, across all tiers.
- **Tiers** — three levels of ownership, stored **structurally** and labelled per skin (see "Tier names are reskinnable" below): `official` (curated, ships with the game), `group` (shared across one organization), `individual` (one person's own).
- **Role field** — each card carries a short human-written note explaining what it is *for*, so a rolodex of near-identical cards is navigable.
- **Editing branches.** Saving an edit creates a new card and points the slot at it. The previous card stays in the rolodex, unselected.
- **Removing unselects, never destroys.** "Remove my copy" points the slot back at the official card; the removed one remains available.
- **Drift is flagged, never applied.** When the official card changes underneath a copy, the copy keeps playing and gets marked for review. Nothing shifts under a class mid-term.

### The finding that makes tiers cheap

A slot holds **one pointer to one card**. The bake resolves it with a single lookup and no fallback chain: `const copy = slot?.card ? copies[slot.card] : null` ([instanceResolver.js:114](../../server/instanceResolver.js)). Which tier a card came from is **irrelevant at bake time** — it is just a card.

This matters more than anything else in this document. The assumption going in was that three tiers meant the resolver would have to search official → school → teacher on every slot, and the resolver is where the project's hardest guarantees live (atomic replacement, version-pinned reads, "a resolved board never references an inactive space"). **None of that is touched.** Tiers are a question of *who may see and pick a card*, not of how a board is assembled.

What tiers *do* cost is storage location: cards currently live inside a single classroom's config (`config.teacherCopies`), and a card shared across a school cannot live there. They must move out into a library keyed by owner. The teacher-layer spec anticipated this exact split and shaped the config so it would be "mechanical, not a redesign."

### Tier names are reskinnable

The maintainer's observation (2026-08-21, arriving from the D&D-reskin experiment): a **school** is a **club** and a **teacher** is an individual **master**. The tiers are not education-specific — the shape is "a curated set, a group's set, a person's set," which recurs in any deployment of this engine.

A display layer cannot rename data. If `owner.tier = 'school'` is written into every card file, a D&D deployment either lies in its own storage (calling a club a school) or needs a migration to stop. So the stored value names the **structure** and the words come from the existing vocabulary swap — `UI_STRINGS.csv` overrides resolved through `getUIString()` with in-code fallbacks ([uiStrings.ts](../../src/constants/uiStrings.ts), built for exactly this in the v3.2.1–v3.2.2 CSV-portability lift):

| Stored | Default skin | D&D skin |
|---|---|---|
| `official` | Official | Core set |
| `group` | School | Club |
| `individual` | Teacher | Master |

`official` needs no swap — it means "curated, ships with the game" in any theme. Only the two audience words do, and they are exactly the two the reskin renames.

**This costs nothing now and commits to nothing.** The D&D reskin itself remains ON HOLD per the 2026-08-15 engagement finding (join-friction, not board theme, is what stalls real games — see TODO). Naming the tiers structurally is worth doing regardless, because it is free today and a migration later.

It also softens an earlier reservation honestly recorded here: when tiers were framed as school-specific, building them with zero schools looked speculative. Framed as curated/group/individual, the shape is general enough that the *storage decision* is warranted now even though the group tier itself is stage 4.

## Decisions (maintainer, 2026-08-21)

1. **Three tiers: official, group, individual.** An individual's card may stay private to their group or be promoted to official and made available everywhere. Stored structurally, labelled per skin (school/teacher by default, club/master under the D&D skin).
2. **Every card carries a role note** explaining its purpose.
3. **Editing produces a new card.** Nothing is overwritten; the previous version stays reachable. *"One can always just go back to the previous version of the card."*
4. **Drift: flag it, keep playing theirs.** When a system correction changes the official card a copy was made from, the copy keeps playing and is marked for review. Rejected: auto-replacing the teacher's card.
5. **The maintainer's overrides are king** while there are no teachers — and his edits must stop evaporating, which is what makes that true rather than aspirational.
6. **A card owns rows keyed to exactly one space that hold that space's authored content** — cross-space relationships and globally-keyed tables stay out. That covers dice outcomes (verbatim, carrying `visit_type` and `roll_group`), modal copy, and logic-question *wording*; it excludes path-choice rules and action tooltips. Full table and reasoning under "What a card owns".
7. **Build the tiers; defer the approval queue.** All three decks exist and work; promoting a card upward is a manual operation for now. Rationale: the queue is the piece most likely to be designed wrong with zero teachers to observe, and it is the cheapest to add later once cards already know their owner.
8. **One editing surface.** The two screens merge. *"We are editing the same thing."*

## What a card owns

**The rule (maintainer, 2026-08-21).** A card owns a file's rows **when they are keyed to exactly one space and hold that space's authored content.** Cross-space relationships and globally-keyed tables stay out.

Recorded as a standing test, not just as a list of verdicts, so a file added next year is decided by asking the question rather than by re-running this whole audit. Applied to every data file as of today:

| File | Card owns it? | Why |
|---|---|---|
| `Spaces.csv` rows | **Yes** (already) | The card's original content. |
| `DiceRoll Info.csv` / `DICE_OUTCOMES.csv` | **Yes** | Keyed by space + visit type. See below. |
| `ModalConfig.csv` | **Yes** | Keyed `space_name, visit_type` — the card's exact shape. Trivially small today: 2 rows in the whole file, both on `BANK-FUND-REVIEW`, setting one button label. |
| `LOGIC_QUESTIONS.csv` | **Wording only** | Per-space and genuinely authored, but each row also carries routing. See below. |
| `PATH_CHOICE_RULES.csv` | **No** | Names an `affected_space`, but its meaning comes from a choice made at a *different* space — a relationship between spaces, not content of one. |
| `ACTION_TOOLTIPS.csv` | **No** | Keyed by action type, not by space. Global. |
| `MOVEMENT` / `GAME_CONFIG` / `SPACE_CONTENT` / `SPACE_EFFECTS` / `DICE_EFFECTS` | n/a | Generated from the rows a card already holds. |

`PATH_CHOICE_RULES` is the counterexample worth keeping in mind. [TEACHER_LAYER_DESIGN.md](TEACHER_LAYER_DESIGN.md) reached the same conclusion from the opposite direction — it considered rewriting that file during a bake and rejected it as "building a compiler." Two independent routes to one answer; treat it as settled.

### Dice outcomes

**Decision (maintainer, 2026-08-21):** yes — a card owns the dice outcomes of its slot. Raised with three complications: first-visit vs return-visit differences, a roll that does more than one thing, and rolling more than once at a space.

**None of the three needs new modeling.** `DiceRoll Info.csv` is keyed `space_name, die_roll, visit_type, 1..6, button_label, roll_group`, and each complication is already a column:

- **First vs return** — `visit_type`, exactly the key a card already stores its space rows under. A card gains dice rows under the same two buckets it already has.
- **One roll doing several things** — several rows for the same space and visit sharing a `roll_group` (blank counts as one shared group). This is in live use: **7 spaces** have more than two dice rows today. `CHEAT-BYPASS` is the clearest — 6 rows, being 3 jobs (`Time outcomes`, `Fees Paid`, `Next Step`) across 2 visit types, so a single roll simultaneously costs days, costs money, and decides where the player goes.
- **Rolling more than once** — two rows with *different* non-blank `roll_group` values are two separate rolls. The engine already groups on this, and the editor already exposes the field (`InlineDiceRollEditor`). **No space in current data sets a non-blank `roll_group` at all** — so this is a capability sitting unused, not something to build. Carrying `roll_group` on the card is what lets a teacher be the first to use it.

So the model extension is simply: **a card stores its space's dice rows verbatim, the same way it already stores its space rows** — no interpretation, no new shape. What changes is the bake, not the card's meaning.

### What this costs at bake time

- **The merge point already exists.** `applyConfigToDiceCsv` ([instanceResolver.js:268](../../server/instanceResolver.js)) already overlays dice rows for switched-off spaces and authored insertions. Copy-owned rows are a third case in a function that does this twice already — an extension, not a new mechanism.
- **`DICE_OUTCOMES.csv` is the load-bearing one.** It is curated and `processGameData` does **not** regenerate it, and the client reads it directly for destinations. A bake that rewrites only the SOURCE dice table produces a board that renders correctly and routes wrongly — the space is functionally dead. This trap is already documented in CLAUDE.md from the Phase 4b authored-space work; any dice-carrying card must rewrite both.
- **Column consistency matters more once teachers can edit.** Rows sharing one roll must populate all six faces, or a roll silently does nothing for one of its jobs. `DataService.validateDiceEffectGroups` already warns on this at load; with teacher-authored dice it should be a save-time validation error, not a console warning nobody sees.

### Logic questions: wording, not routing

`LOGIC_QUESTIONS.csv` is per-space authored content — 10 rows today, all on `REG-FDNY-FEE-REVIEW`, holding real player-facing text ("Did the scope change since the last visit?"). But each row carries `yes_target` / `no_target` alongside the wording: where the player actually goes.

**Decision: a card owns the wording; routing stays fixed.** A teacher can rewrite a question into their classroom's own language — the entire benefit for the translation-and-clarity use case this layer exists to serve — without being able to strand a player. Letting a card change `yes_target`/`no_target` would make it able to reshape the board's topology, which is exactly the class of change this project surrounds with protection and save-time validation; opening it now would mean building that validation before a single teacher exists to need it. Routing can open later, and the wording-only split does not have to be undone to do it.

Practically: the copy-editable field set for logic questions is `question_text`, `yes_reason`, `no_reason`. `question_id`, `yes_target`, `no_target` and `auto_answer_from` are structural and always come from stock.

### Deliberately still open

Two questions that genuinely cannot be answered yet, parked rather than guessed:

- **How deep version history goes in the picker** — needs a deck that has actually got crowded.
- **Whether a group admin can edit official cards** — needs a real group to exist. Stage 4 assumes no.

## What exists vs. what is new

| Piece | State on 2026-08-21 |
|---|---|
| Slot / card separation | **Built** — `config.slots[name].card` |
| Several cards per slot | **Built** — the validator has a warning specifically for a card that exists but isn't the one in play (`COPY_UNPLAYED`, [instanceValidation.js:340](../../server/instanceValidation.js)) |
| Card remembers which official version it came from | **Built** — `copiedFromStockVersion` |
| "The original changed — worth a review" | **Built** — `COPY_STOCK_UPDATED` ([instanceValidation.js:356](../../server/instanceValidation.js)), surfaced as a generic banner rather than on the card |
| Structure repaired automatically, wording never | **Built** — `COPY_SCHEMA_DRIFT`; missing columns filled from stock at bake |
| Switch a space off, with detour preview | **Built** — Classroom Setup |
| Author a brand-new space | **Built** — insertions, with dice and card draws |
| Card owner / tier | **New** — the one thing that must be decided early |
| Edit branches instead of overwrites | **New** — small change to `updateTeacherCopy` |
| Remove unselects instead of deletes | **New** — small change to `deleteTeacherCopy` |
| Card picker UI | **New** — the catalog already ships unplayed cards to the client; nothing renders them |
| Role note field | **New** — trivial |
| Cards live above the classroom | **New** — the real migration |
| Group entity, roles on accounts | **New** — accounts today hold username, password, display name only ([accountStore.js](../../server/accountStore.js)); no roles, no organizations |
| Approval queue | **Deferred** — see breadcrumbs |

## Data model sketch

Cards move out of the per-classroom config into a library keyed by owner:

```
game-data/cards/<cardId>.json
  owner:     { tier: 'official' | 'group' | 'individual', id: <groupId|accountId|null> }
  slot:      ARCH-FEE-REVIEW          # which position this card can fill
  role:      "Shorter version for a 45-minute period"
  derivedFrom: <cardId|null>          # the card this was branched from
  copiedFromStockVersion: <hash|null> # unchanged; drives the drift flag
  rows:      { First: {...}, Subsequent: {...} }   # Spaces.csv rows
  diceRows:  [ {die_roll, visit_type, '1'..'6', button_label, roll_group}, … ]
             # this space's DiceRoll Info rows, verbatim. Absent on a card for
             # a space that never rolls; absent on cards written before this.
  modalRows: [ {visit_type, effect_action, modal_title, modal_description,
                modal_button_label, modal_summary, dice_value}, … ]
  logicRows: [ {visit_type, question_id, question_text, yes_reason, no_reason}, … ]
             # WORDING ONLY -- question_id/yes_target/no_target/auto_answer_from
             # are structural and always resolve from stock at bake.
  createdAt / updatedAt / supersededBy
```

The classroom config keeps only the *choice*: `slots[name].card = <cardId>`. Resolution is unchanged — one pointer, one lookup, no search.

**Visibility rule** (the only place tiers are interpreted): a rolodex for a slot shows official cards, plus cards owned by your group, plus your own. Nothing else. This is a query, not a resolution strategy.

## Build order

**Stage 1 — stop losing work.** Route Space Data Editor saves into cards instead of the master CSVs, so the maintainer's edits survive a restart. Cards start carrying an owner here.

> **Clarified 2026-08-21, during slice 2.** An earlier draft of this line said "into the card library," which is ahead of itself — the shared library does not exist until the storage move, and the durability fix does not need it. Cards live in the classroom config today, and that config already survives every deploy by construction, so writing there is sufficient and correct for stage 1. Admin edits are written at `owner.tier: 'official'`: the maintainer is the curator, so when the shared library is later extracted, **the official-tier cards are exactly the set that migrates into it** — which is what makes the deferral safe rather than a debt. Correct the Board Layout Editor's on-screen help, which currently claims each drop is *"written to `Spaces.csv`"* — it posts to `/api/instances/:id/positions` ([saveBoardPosition.ts:64](../../src/components/board/saveBoardPosition.ts)) and the in-game tooltip already says so correctly. *(The related "board draggable with no way to turn it off" bug was fixed ahead of this stage on 2026-08-21 — see CHANGELOG.)*

**Stage 1b — a card carries the rest of its own content.** Dice rows, modal copy, and logic-question wording, per the ownership rule above. Dice is the load-bearing part: Extend the card to hold its space's `DiceRoll Info` rows and merge them at bake through `applyConfigToDiceCsv`, rewriting the curated `DICE_OUTCOMES.csv` as well as the SOURCE table (see the cost notes above — missing the curated file yields a board that renders right and routes wrong). Promote the shared-roll column-consistency check from a load-time console warning to a save-time error. This must land before the Space Data Editor's save path is swapped, or that screen would persist some edits and silently drop others.

**Stage 2 — make it a rolodex.** Edit branches; remove unselects; per-slot card picker showing every visible card with its tier and role note; the drift flag moves onto the card it concerns instead of the page-level banner.

**Stage 3 — one screen.** Merge the two editors: the Space Data Editor's field layout and live preview, plus Classroom Setup's switch-off, author-a-space, and durability. **Fix the preview while doing it** — `PlayerPreviewPanel` deliberately renders with the retired classic panel's stylesheet and its own comment says it *"mirrors what the classic panel used to look like in-game"* ([PlayerPreviewPanel.tsx:3](../../src/components/editor/PlayerPreviewPanel.tsx)). Players see `PlayerPanelV2`. The single most reassuring feature in the tool is currently drawing a design that no longer ships.

**Stage 4 — group tier.** Group entity (a school, a club), roles on accounts (member / group admin), permission checks on every write, group-scoped visibility in the picker. Promotion to official stays a manual operation.

**Deferred — the approval queue.** Not built. See below.

## Breadcrumbs for future expansion

Deliberately reserved now so later work is additive rather than a rework:

- **`owner` on every card from stage 1**, even while only `official` is used. This is the one field that is expensive to retrofit and cheap to add — everything else in stage 4 depends on it and nothing else does.
- **`owner.id` nullable.** An official card has no owner id. A group id slots in without a schema change.
- **Tier labels routed through `getUIString()` from stage 1**, even while only `official` exists. Three CSV keys reserved now (`CARD_TIER.official` / `.group` / `.individual`) means a reskin renames decks without touching stored data or writing a migration.
- **`derivedFrom` and `supersededBy`** recorded from stage 2, even though nothing reads them yet. They are what a version history screen, a "what changed" diff, and any future merge assistance would all be built on; capturing them costs one field each at write time and cannot be reconstructed afterwards.
- **`role` note from stage 2.** Doubles as the submission blurb if a queue is ever built — a teacher proposing a card upward has already written why it exists.
- **Approval queue, when it comes:** the shape to copy is the glossary Purgatory review already running in the dictionary-scraper backend (nightly robot stages candidates, human approves/rejects). Confirmed 2026-08-21 that no Purgatory code exists in *this* repo — it would be a fresh build here, informed by a pattern the maintainer already operates. Minimum pieces: a submission record (card id + submitter + note + status), a review screen, and a promote operation that clones the card to `owner.tier = 'official'` while leaving the submitter's original in place.
- **⚠️ `instanceCatalog`'s `entry.dice` flag goes stale the moment a card can EDIT dice** (found building stage 1b, 2026-08-21). It is computed from the *stock* dice table via `buildDiceDests(diceCsv, …)`, so a card that adds or removes a `Next Step` row would leave the catalog still reporting stock's answer to "is this a dice space" — which drives the editor's own "pick an edge" dropdown. Harmless today, because a card's dice rows are captured verbatim from stock and there is no editing API yet. It must consult `copyDiceRowsBySpace` as part of the editor-swap slice. This is the same parallel-systems drift that produced the 2026-06-20 `requires_dice_roll`-vs-`Next Step` bug, where one conceptual question was answered in three places and two went stale.
- **Card protection tiers** (structural / semantic / path-choice) already exist for slots and are untouched by any of this. A protected slot restricts *switching off*, never *which card fills it*, so tiers and protection stay orthogonal.
