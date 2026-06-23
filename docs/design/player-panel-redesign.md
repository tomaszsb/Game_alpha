# Player Panel Redesign — Locked Design Spec

**Status:** Design locked 2026-06-22. Implementation pending (behind an old/new toggle).
**Owner:** maintainer (creator) · drafted with AI Lead Programmer.
**Source design package:** 17-doc "Design Discovery & Requirements Package v1.0" (in `E:\Downloads`, the design team's brief — see "Design package assessment" below). This spec is *our* design decisions, informed by that brief but not a copy of it.

---

## 1. North star — teach, don't dumb down

This is an **educational simulation / applied learning tool**, not an entertainment-first game. The recurring failure today is that a non-expert is overwhelmed by simultaneous jargon-heavy systems. The fix is **not** to strip the domain content — the jargon (DOB, FDNY, Expeditor, objection) *is the curriculum*. The fix is to **pace it and explain it on demand**.

Success = a player always understands **what action moves them to the next space, and why**. (The maintainer's words: success is when the player *understands* — not just "finds a button.")

The design team's own brief agrees, repeatedly and explicitly:
- "These terms contribute to educational value. They should not be removed. Instead, the interface should help users understand them."
- "Excessive simplification may weaken learning outcomes."
- Non-Goal: "Convert the game into a simulation-only or instruction-only experience."

So the maintainer's worry that "teaching tool" would be used to justify dumbing-down is **unfounded** — the brief forbids it. This spec keeps every term and teaches it via the glossary.

---

## 2. Scope

Three surfaces, treated as one system (Board = *where*, Panel = *what*, Scoreboard = *who*):
- **Player panel — PRIMARY redesign target.** Renders on the player's phone AND on the shared screen.
- **Detailed cards + modals — redesigned** to match.
- **Glossary side panel — behavior kept, dark mode added** (quick fix, see §6).
- **Shared scoreboard — later** (not yet mocked; "who" screen).
- **Board — leave alone**, light tweaks only.

**Hard constraint:** the panel must fit **one screen with NO scroll**, on both phone and the panel's region on the shared screen. This makes the panel a *triage* problem — only what matters now earns a place; progressive disclosure must **replace** the view (tabs/modals/side panel), never **extend** it (scroll/accordions).

Presentation only — **no game-rule, scoring, card, or movement changes.**

---

## 3. Player panel — zone model

Five zones, top → bottom. Emphasis is **phase-adaptive** (the panel shows different things early vs. regulatory vs. construction — it is NOT a static layout).

1. **Header** — player name + colour dot (left); **phase + progress merged**, compact, **top-right** (low-value glance info, kept out of the centre).
2. **Status** — **icon-based** money + days (coin / clock icons, not word labels, to save space). Money is labelled **"Cash on hand"** and is **tappable → breakdown** (where it came from / what's spent). Approvals live here too (see below).
3. **Where you are & why (PURPOSE)** — *deliberately zone 3, not buried last.* One-line plain-language purpose sits directly above the actions; the long NPC narrative is tucked behind "Read full story." This is the maintainer's explicit priority: players struggle to find the *purpose*, so purpose is prominent and flavour is secondary.
4. **Things you can do** — the space's optional actions as visible rows. On **first visit**, a **green dot** marks the suggested action(s); on subsequent visits the dots disappear (gentle hint that fades as the player learns — preserves the learning goal).
5. **Commit spine + negotiate** (footer):
   - **Commit button = one button, two states** (no duplicate CTAs): gray **"N actions left"** (locked, with a lock icon) → blue **action label** when ready (e.g. "Lock scope", "Take your next step"). On **first visit** a green dot sits on the ready commit.
   - **Negotiate button** (replaces bare "Try again"): in-world, names the party, with the cost in **icons** — e.g. "Negotiate with examiner · [clock][coin]". Makes the consequence (lose time/money) visible.

### Maintainer rulings captured (all confirmed)
- Purpose elevated (zone 3), full story tucked behind a link. ✓
- Approvals are **informational diodes, not buttons** — shrunk to a tiny **check / ✗ / clock** next to "DOB" / "FDNY", and **only shown when relevant** (hidden entirely in early game; if a project has no fire scope, no FDNY diode). ✓
- Money: "Cash on hand", tap → breakdown. Card chips tappable too → detail (which work packages, how much). ✓
- Phase + progress **merged into one**, moved **top-right**, small. ✓
- **Player language only** — "Work ×2 / Expeditor ×1", never W/E. **No game words** in player-facing copy — e.g. **"roll" is banned** ("Take your next step", not "Roll to move"). Follows the NPC-narrates-to-PM voice rule. ✓
- Suggestions = **green dot, first visit only**, on suggested actions AND the ready commit. ✓
- Commit button keeps the **action counter + gray→blue** states; "Lock scope" (drop the article "the"). ✓
- Stats as **icons** to save space. ✓

---

## 4. Light & dark mode

- **Both modes are first-class.** Dark palette is built from the slate scale already in `src/styles/theme.ts` (`neutral.gray.*`), so it's consistent.
- **Build approach (decided):** scope light/dark to the **new panel + cards/modals + glossary** first (a small theme mechanism + toggle). The rest of the app stays light until a later app-wide pass. Today every colour is a hardcoded light value inlined into components, so app-wide dark is a separate refactor.
- **HARD RULE — no ghost buttons in light mode.** Every interactive control (action rows, secondary/outline buttons, glossary "related" chips, category filters) must have a **visibly dark border AND dark text in light mode before hover.** This failed repeatedly in mockups (faint gray text/borders) — it must be enforced everywhere. Test: if a button's text is lighter than the muted labels around it, it's wrong.

---

## 5. Detailed cards & modals

- **Detailed card view** ("read more" on a Work package / Expeditor): card-type chip (colour-coded), title, plain-language summary, **key facts as icon rows** (Adds / Costs / Lasts; Saves / Transferable / Lasts), "what it does" prose, and a **"why this matters"** educational callout. Footer: Play / Keep / (Give to a player).
- **Outcome modal** ("what just happened"): **before → after** rows (location, days, cash) — the brief noted before/after is the current modal's genuine strength; keep it. Plain-language "what changed and why next."
- All modals follow the panel aesthetic (flat, rounded, same tokens) and the light-button rule.
- Modals still to redesign in this style (later, same pattern): logic-question modal, dice-result modal, end-game modal.

---

## 6. Glossary integration (corrected)

- The glossary is the **existing `src/dictionary/` module** (its own product), surfaced via **`TextWithTerms`** (wraps jargon) → **`DictionaryPanel`** (slides in from the right, full height).
- **Term style (real, keep it):** solid underline (2px) + subtle tint + a small **ⓘ** marker (set in `DictionaryPanel.css` `.dictionary-term-link`, v2.70.5, fb:8ad42b52). NOT a dotted underline, NOT an inline bottom box.
- **Tapping a term opens the side panel** — never an inline definition box.
- **Dark mode = quick fix, join now.** The dictionary module is the *only* part of the app already on **CSS variables** (`--dictionary-*` in `DictionaryPanel.css` `:root`). Dark mode = override ~8 variables under a dark selector. Full flat-style alignment (radii/borders) is deferred per the maintainer.
- The new panel/modals **reuse `TextWithTerms`** — no reinventing term-linking.

---

## 7. Old / new toggle (build requirement)

The new panel ships **behind a toggle** (old ↔ new) so the maintainer can flip between them and **verify no information was lost** before committing to the new one. Keep the toggle until we're 100% sure all info is included. Likely a setting/dev flag read at the panel mount point (`PlayerPanelWrapper` / `GameLayout`), selecting old `ActionCenterPanel` vs. new component.

---

## 8. Build sequence

1. **Panel-scoped light/dark theme + toggle** (from `theme.ts` colours) + the **old/new toggle** scaffold at the mount point.
2. **New panel component** (e.g. `PlayerPanelV2`), the 5 zones wired to real `Player` data via existing services. Phase-adaptive emphasis.
3. **Glossary**: dark-mode variable override + ensure new panel/modals use `TextWithTerms`.
4. **Detailed cards + outcome modal** restyle.
5. Later: scoreboard, remaining modals, app-wide dark mode, full glossary flat-style alignment.

Each step: typecheck + tests green; presentation only; nothing deployed without the maintainer running the deploy.

---

## 9. Design-package assessment & bias watch-list

The 17-doc brief is **well-aligned** with this direction and validated many calls independently (not-a-race, no-scroll, phone-first, panel = top priority, the priority order, phase-adaptivity, approvals-always-visible). But watch these biases when reading it:

1. **False empiricism (biggest).** Personas, "mental models," "during playtesting players do X" are written like field research, but there's **no real study or game data** behind them — it's a smart synthesis of *our* brief reflected back. Treat as reasoned hypotheses, not validated facts. Verify against real student playtests.
2. **It dodges the hard part.** Every doc asserts no-scroll then marks a *lot* as "always visible." The actual pixel triage is unsolved by the brief — that's our work.
3. **Static tiers vs. dynamic phases (unreconciled).** The IA marks money/progress "always visible, highest"; the phase analysis says early-game money is Medium and progress ~0. Build **phase-adaptive**, not the flat tier list.
4. **"Recommended action" can over-spoon-feed** — for a teaching tool, a do-this arrow can remove the learning. Keep guidance gentle (green dot, first visit only) — which is why we chose that.
5. **Generic.** Correct but could describe any PM board game; it doesn't know this game's soul (voice rule, loop traps, cheat/bypass, dice-vs-effect-roll, per-space funding). We supply the game-specific flesh.
6. **Minor factual wobbles:** brief orders phases Design-before-Funding (game funds first); implies a "lose/why did I lose" state, but the game has **no bankruptcy/elimination** — only the DOB end-game penalty.

---

## 10. Integration with the change-legibility UX layer (added 2026-06-23)

A separate initiative — the **change-legibility / companion / time-feel UX spec** (TODO: "🎛️ Change-legibility / companion / time-feel UX") — layers *change communication over time* (event feed, deltas, transitions) on top of this panel. It is a **second track that runs AFTER this redesign's core panel**, not a rewrite of it: this doc owns the panel's *resting layout*; that spec owns its *dynamics*, and it mostly lives on the bottom tabs (Ledger/Time/Log) and in modals, not in the 5 zones. The philosophies match (teach-don't-dumb-down ↔ diegetic permitting vocabulary; gentle green-dot guidance ↔ "minor changes never interrupt").

Three forward-compatibility tweaks fold into *this* plan now so we don't rework:

1. **Card/modal restyle (§5) must be able to host a "permitting-document" card variant.** The UX spec's Tier-3 events (Change Order, DOB Objection, Stop-Work) arrive as document-styled cards via the existing `emitAutoAction` rail. Build the §5 detailed-card + outcome-modal system so a document-slip variant slots in later without a rebuild.
2. **Accessibility / redundant coding is built in NOW, not deferred.** The new visual language this redesign introduces (icon stats, approval diodes, green first-visit dot, gray→blue commit) must follow **icon + shape + text, colorblind-safe, no-color-alone**. Most already comply (diodes = check/✗/clock; commit = text label). **At-risk: the green first-visit dot** (color carrying meaning) — pair it with a shape or fixed position cue. Retrofitting a11y onto these later is harder than building it in.
3. **The shared screen co-hosts the scoreboard AND the Chronicle feed.** Plan the "who" screen layout to hold both; on the phone, reserve one small affordance to *open* the feed as a modal / side panel (no-scroll is preserved — it opens over the panel, doesn't extend it).

Already covered, no change: the glossary term affordance (§6 solid-underline + ⓘ, tap → side panel) is exactly the fix for the "I expected a *read more* link" report (fb:c240a14c) — that player saw the **classic** panel; shipping this redesign closes it.
