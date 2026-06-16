# UI redesign — game context for the design team

Companion to `.claude/player-dashboard-variables.md` (the data inventory). This
answers "how does a player actually play, and what decisions does the UI need to
support." Written 2026-06-16 from the codebase, docs, and live feedback.

**Provenance key:** ✅ authoritative (code/docs) · 🧭 design judgment (implementer's read — creator should confirm) · ❓ needs creator confirmation · 📷 needs the running app / data we don't have yet.

---

## 0. Scope & surfaces (read this first — creator-confirmed 2026-06-16)

The game has **three UI areas**; this redesign treats them as one coherent system:

1. **Game board** (`BoardCanvas`, React Flow) — **mostly done; light tweaks only.** Not a redesign target, but considered as part of the whole.
2. **Player panel** (`ActionCenterPanel` + sections) — **the PRIMARY redesign target.** Renders on two surfaces: the shared screen (PC mode, beside the board) **and** each player's phone.
3. **Scoreboard** — today this is the `ProjectProgress` strip at the top (phase track + per-player % done + days/budget). **Needs rethinking.** Shared-screen only.

**Surface / no-scroll matrix (the governing layout constraint):**

| Surface | Shows | Hard rule |
|---|---|---|
| **Phone** (each player) | Player panel ONLY | 🔒 must fit one phone screen, **no scroll** |
| **PC** (shared screen) | Board + player panel + scoreboard | 🔒 the panel must fit its region, **no scroll** |
| **TV** (shared screen) | Board + scoreboard (players act on phones) | 🔒 scoreboard fits the TV |

**The scoreboard's job** (creator-confirmed): show **whose turn it is** (+ nudge "look at your phone"), **per-player progress side by side**, and a **soft sense of who's ahead** — *positionally* (how far along the board / which phase), **NOT** a hard score-ranked leaderboard. 🧭 Reconciliation of the "standings" + "not a ranked race" answers: the game is about **completing your own project well**, not topping a single metric; the scoreboard makes relative progress *visible* without making it cutthroat. Data it draws on (per player): name/color, current phase + board position, % done, days spent vs estimate, money — and whose turn. Lives on the shared screen only; **phones never show the scoreboard** (it would eat the no-scroll panel budget).

Everything below was originally written about the **player panel**; §1 and §9 are now corrected for the three-surface framing, and the scoreboard is called out where it differs.

---

## 1. Current player panel

- **Sections** (collapsible): Current Card / space story · Project Scope · Finances · Time · Cards · Events · Player Log · Project Ledger.
- **ApprovalBadges** — DOB / FDNY status chips.
- **Sticky bottom bar**: `🔄 Try Again` · `▶️ End Turn` (the latter is the context-aware "Next Step" button: green "End Turn" when ready, gray "N actions remaining" when not, blue "Roll to Move" when a dice move is pending).
- **🔴 red-dot indicators** on section headers show where an action is available.

✅ **Three layouts, one panel** (`GameLayout` / `TVDisplay`): desktop = panel beside the React-Flow board; **TV mode = board on a shared TV, each player drives from their phone** (the signature classroom/tabletop mode); mobile = full-screen panel.

**Known complaints (from live feedback + CLAUDE.md):**
- 🔥 **Jargon + overwhelm** — "Terms like 'Prof Cert', 'Audit', 'Life Events', 'Bypass'…"; "On the very first screen I already see expeditors… this is a LOT of systems at once for someone who isn't DOB-savvy." This is the loudest, most repeated signal.
- "Filing reps — not clear what phase they work in."
- "Buttons don't fit, looks unfinished."
- Historic: "N actions remaining" with no visible affordance (action-counter confusion); the dice-result modal showing the same outcome three times (fixed); voice/jargon leaks ("Roll for W Cards").

🧭 **Success vs not:** the design succeeds when a player **always knows their single next action without hunting** (the Next Step button is the spine of that) and isn't overwhelmed by simultaneous systems. It fails when a non-expert sees a wall of unfamiliar mechanics and can't tell what's required vs optional, or why they're stuck.

✅ **Screenshots captured 2026-06-16 (live production v3.0.80), in `.claude/dashboard-screenshots/`:**
- `dashboard-desktop-early.png` (1440px) — left sidebar panel beside the React-Flow board; at the very first space the panel already shows space story + NPC narration + a "Hire Expeditor" block + **"YOUR ACTIONS (2 remaining)"** with four buttons (Hire 3 Expeditors / Get Work Packages / Lock the scope / Push back). The board fills the rest with all spaces in phase columns.
- `dashboard-mobile-viewport.png` (390px) — **reveals two real problems:** (1) the board renders *behind* the panel and bleeds through the text (e.g. story text overlapping faint board tiles), and (2) the four action buttons are crammed at the very bottom edge. On a phone the player sees: header + phase strip + player progress + space story, and must scroll for the actions.
- `dashboard-desktop-mid.png` (1440px) — the same panel with a populated regulatory state (DOB approved / FDNY pending), showing the approval chips and the player advanced into the regulatory board column.

---

## 2. Game overview

✅ **Objective:** shepherd a NYC construction project through its real lifecycle — owner's vision → funding → design (architect/engineer) → **regulatory approvals (DOB + FDNY)** → construction → FINISH — managing money and time.

✅ **Win / goal (creator-confirmed 2026-06-16): it is NOT a ranked race.** The goal is to **complete your own project well** — reach FINISH with approvals in hand and resources managed. Reaching FINISH is the completion point; finishing **without DOB sign-off** incurs an end-game penalty (+30 days, +$50k). Players see each other's progress (the scoreboard), but the design should **not** frame the game as topping a single metric (score / time / "who won"). This resolves the earlier manual ambiguity — don't build a hard win-ranking into the UI.

✅ **Lose:** there is **no elimination / bankruptcy**. There's no "you're about to die" state to warn about; the stakes are *completing your project cleanly* and *avoiding the regulatory traps* (loops, missing approvals), not beating opponents to a finish line.

✅ **Players:** 2–4.
🧭 **Length:** a full game is dozens of turns (the bot averages ~80–150 turns across all players); a human game is roughly 30–60 min.
✅ **Audience:** **educational** — teaches the real NYC construction-permitting process to non-experts, plus classroom use (TV + phones). The feedback confirms the core tension: it's teaching genuine domain complexity (DOB/FDNY/expeditors) to people who don't have that background.

---

## 3. Typical turn flow

✅ (from USER_MANUAL + TurnService):

| Step | What happens | Info the player needs |
|---|---|---|
| 1. Turn starts | Space-arrival effects auto-process (some REG spaces auto-roll; some life events auto-draw) | "What just happened to me?" — the space story + any auto effect |
| 2. Read the space | NPC narrates the situation | Current space context; money + time (can I afford what's coming?) |
| 3. Manual actions (optional) | Get funding · play cards · transfer cards · trigger manual dice (CHEAT/owner spaces) | Hand + what each card does; affordability; active effects already ticking |
| 4. Resolve choices | Path-choice or logic-question modal (some lock permanently) | Where each option leads; **approval status** (am I cleared?) |
| 5. Roll to move | On dice-movement spaces | Valid destinations; odds (CHEAT spaces are a gamble) |
| 6. End Turn | Movement executes | "What's still required before I can end?" (the action counter) |

🧭 The dashboard's job is heaviest at **steps 2–4**: orient ("where am I, what happened"), then support the affordability + approval + "what's required" decisions.

---

## 4. Player pain points (most common mistakes)

From feedback + the mechanics (and the bugs fixed this month):
1. 🔥 **Overwhelm / jargon** — can't tell required from optional; unfamiliar domain terms. (Biggest.)
2. **Not knowing what action unblocks "End Turn"** — the "N actions remaining" with nothing obvious to click.
3. **Regulatory loops** — bounced between DOB / FDNY / plan-exam without understanding why (a real bug class this month: the Prof-Cert and FDNY auto-answer loops). Players don't grasp *what approval they're missing*.
4. **Missing approvals → penalized finish** (no DOB sign-off = +30d/+$50k).
5. **Permanent path locks** chosen blind (e.g. DOB type select) — regret with no undo.
6. **Running low on money** for fees/cards.
7. **Forgetting active effects** (duration cards ticking) and holding cards too long.
8. **Contractor selection** (quality/multiplier) consequences are opaque.

🧭 Dashboard implication: surface **"what do I need to do next"** and **"what's blocking/trapping me (approvals, money)"** above everything else.

---

## 5. Importance ranking (🧭 implementer's read — creator should confirm)

Ranked by *how often it blocks or confuses a player*, not by theme:
1. **Movement / "what's my next action"** — the #1 confusion is not knowing what to do. The Next-Step affordance is the single most important element.
2. **Approvals (DOB/FDNY)** — gating; missing them traps or penalizes. The clearest "on track?" signal in the regulatory phase.
3. **Money** — hard constraint; running out blocks actions.
4. **Project progress** — scope + phase + how close to FINISH (orientation).
5. **Cards** (hand + active effects) — the main lever the player controls.
6. **Time elapsed** — a quality/progress measure, accrues passively (low interaction).
7. **Contractor status** — matters only in construction; narrow window.
8. **Score** — only meaningful at end-game, and **not a competitive ranking driver** (§2: not a ranked race) — so it earns little/no live panel space.

> This ranking is for the **player panel** (no-scroll triage). The **scoreboard** ranks differently: it shows per-player *progress* side by side (positional, §0), not these per-player decision priorities.

---

## 6. Approval workflow ✅ (PRIMARY panel feature)

- **DOB approval** = the Dept of Buildings approves your *plans to build*. Obtained at **REG-DOB-PLAN-EXAM** (or granted by the **Prof Cert** self-certification path on a passing roll).
- **FDNY approval** = Fire Dept fire-safety sign-off. Obtained at **REG-FDNY-PLAN-EXAM**.
- **Status values:** `none` · `minor-objection` · `approved` · `denied`.
- **The gate:** **REG-DOB-FINAL-REVIEW** requires *both* DOB and FDNY approved, or it **bounces the player back** to the missing examiner. So approvals are **effectively mandatory** to finish cleanly.
- **Consequences of missing:** regulatory loops (this month's bug class) and/or the end-game penalty for finishing without DOB.
- **When pursued:** the REGULATORY phase, mid-to-late game, after design.

🧭 **Verdict: approvals should be a primary, always-visible dashboard element** (two clear status indicators + "what's needed next"), not buried in a section. They're the mechanic players most often get lost in.

---

## 7. Card strategy ✅

Five types (player-facing names — never show the letter): **Work Package (W)**, **Bank Loan (B)**, **Investment (I)**, **Expeditor (E)**, **Life Event (L)**.

- **W (Work Package):** builds project scope, needed to finish, draw early to qualify for investor funding. *Accumulated.*
- **B / I (funding):** auto-play at funding spaces; bank for smaller projects, investor for larger (>~$4M). *Played.*
- **E (Expeditor):** reduces permit/processing time — the **most valuable for optimization**; **transferable**. *Played.*
- **L (Life Event):** usually negative; **transferable to opponents** (strategic); some dice-conditional or multi-turn duration. *Drawn, sometimes forced-discard.*
- **Hand size:** loosely matters (forced-discard L cards exist); no prominent hard cap.
- **Active effects** (duration-based, e.g. multi-turn time modifiers) — **players DO forget what's ticking**; reminders are valuable.

🧭 Display implication: show **hand counts by type**, flag **playable** cards, and surface **active effects with remaining duration**. E-card value (time) and L-card transfer are the strategic depth.

---

## 8. Example players — REAL game-state, captured from a live game on production 2026-06-16

✅ Pulled from a live game (G374) via the game's own state API. **Early is a genuine fresh turn-1 player** (so it's all zeros — that *is* what the dashboard shows at game start). 🧭 **Mid and Late were injected** via the documented state-cheat (real, engine-shaped `Player` objects the dashboard renders — but the *scenario* is authored, not organically played, because reaching late-game organically is 100+ turns). Field names map 1:1 to the variables inventory.

**Early-game — REAL (turn 1, just placed):**
- currentSpace `OWNER-SCOPE-INITIATION` · visitType First · money **$0** · timeSpent **0** · projectScope **0** · score 0 · hand **[]** · activeCards [] · activeEffects [] · loans [] · moneySources all 0 · expenditures all 0 · costs.total 0 · dobApprovalStatus `none` · fdnyApprovalStatus `none` · contractor none · visitedSpaces `[OWNER-SCOPE-INITIATION]`.
- *Takeaway:* at start the dashboard has **almost nothing to show** — every number is zero. The screen is dominated by the space story + the 4 action buttons ("Hire 3 Expeditors / Get Work Packages / Lock the scope / Push back"). This is exactly where the "a LOT of systems at once" overwhelm hits.

**Mid-game — injected (regulatory):**
- currentSpace `REG-DOB-PLAN-EXAM` · visitType Subsequent · money **$1,150,000** · timeSpent **42** days · projectScope **5** · hand `[W001, W014, E030, L012]` (4 cards) · activeEffects `[{ Expeditor: -2 days on filings, 2 turns left }]` · loans `[{principal $1.5M}]` · moneySources `{owner 500k, bank 1.5M}` · expenditures `{design 260k, fees 90k}` · costs `{architectural 160k, engineering 100k, regulatory 60k, expeditor 30k, total 350k}` · dobApprovalStatus **`approved`** · fdnyApprovalStatus **`none`** · dobApprovedDestinations `[REG-FDNY-FEE-REVIEW]` · contractor none.
- *Takeaway:* the interesting state — **DOB approved but FDNY still pending** (the "half-cleared" moment that confuses players), an active effect ticking, money/cost split worth surfacing.

**Late-game — injected (construction):**
- currentSpace `CON-INITIATION` · visitType First · money **$310,000** · timeSpent **124** days · projectScope **8** · hand `[W022]` (mostly spent) · activeCards [] · dobApprovalStatus **`approved`** · fdnyApprovalStatus **`approved`** · contractor **{quality HIGH, multiplier 4}** · moneySources `{owner 500k, bank 1.5M}` · expenditures `{design 300k, fees 180k, construction 900k}` · costs.total **$1,380,000**.
- *Takeaway:* both approvals done, contractor set, money nearly spent, time high — the dashboard's job here is "are you going to finish in good shape?" (money cushion + time vs opponents).

---

## 9. Mobile requirements ❗ (hard constraint — creator-confirmed 2026-06-16)

- **🔒 THE #1 LAYOUT CONSTRAINT (see the §0 matrix): the player panel MUST fit without scrolling on BOTH surfaces** — one phone screen on the handheld, AND its region on the PC shared screen. This is a firm requirement, not a goal. The design may not fall back on "collapse the overflow into accordions and let it scroll." Everything the player needs at a given moment must be visible at once.
  - **Implication:** the panel is fundamentally a **prioritization / triage problem**, not a layout problem. Only what fits earns a place; §5's importance ranking is therefore *the* load-bearing design decision, not a nicety. Progressive disclosure must use mechanisms that **replace the view** (tabs, swap-panels, modals/overlays) — never mechanisms that **extend** it (vertical scroll, stacked accordions).
  - **Implication:** the view is almost certainly **context-dependent** — what's shown adapts to the phase/space (e.g. approvals surface in the regulatory phase, contractor in construction), because no single fixed layout can hold everything *and* fit. The "all zeros at start" finding (§8) reinforces this: early game needs orientation + actions; later game needs status. The panel should show *different* things at different times rather than everything always.
- **The phone is the tightest target — design phone-first.** The signature mode is **"TV shows the board + scoreboard, each player controls from their own phone."** The phone shows the **player panel only** (no board, no scoreboard — that frees the whole viewport for the panel, and is why the scoreboard is shared-screen only). The PC shared screen is more spacious but its panel region still may not scroll.
- **The scoreboard fits the shared screen, not the phone** — it never competes for the phone's no-scroll budget (§0).
- **Phones disconnect/freeze** (handled via WebSocket reconnect on visibility-resume); storage/keyboard quirks handled (`100dvh` — and note: the no-scroll budget shrinks when the keyboard is up, so any text input must account for it). Don't reintroduce `100vh` on input-bearing containers.
- ⚠️ **Current state fails this** — the live mobile capture (`.claude/dashboard-screenshots/dashboard-mobile-viewport.png`) shows the action buttons pushed below the fold and the board bleeding through; the present panel scrolls. The redesign's core job is to make it fit.

---

## 10. Existing analytics 📷

- **No cross-game analytics database exists** — there is no aggregation of "most common cause of defeat/success" across games. (Honest gap.)
- **Per-game end stats DO exist and are rich:** `EndGameModal` renders `buildEndGameStats(player)` (money breakdown, fees vs funding, turns, time, scope, card counts) + `buildEndGameInsights` (~20 rules producing win/observe/lesson "project debrief" messages) + the end-game penalty. The **insights rules are a good proxy** for "what the game already thinks correlates with doing well/poorly" — worth mining (`src/utils/endGameInsights.ts`).
- I can: capture completed-game screenshots, dump the EndGameStats fields, or (if you want real numbers) pull a saved game's state. No win-correlation data to provide.

---

## 11. Technical constraints ✅

- **Stack:** React 18 + TypeScript (strict) + Vite 8 (Rolldown). Inline-style objects (no CSS framework); central design tokens in **`src/styles/theme.ts`** (colors + card-type labels).
- **Board:** React Flow (`@xyflow/react`) — separate from the dashboard.
- **State:** service layer + DI (`ServiceProvider`, ~29 services); the dashboard reads from the synced `Player` object (see the variables doc). Real-time multi-device sync over WebSocket — the dashboard is a *view* of synced state, not a local store.
- **The panel renders in 3 layouts** (desktop sidebar, TV+phone, mobile full-screen) via `GameLayout`/`TVDisplay` — **a redesign must work in all three.**
- **Reusable pieces already available:** `ExpandableSection`, `ActionButton`, `ApprovalBadges`, the per-domain section components, `BeforeAfterBlock` (modal), and the theme tokens.
- **Voice/content rules (hard constraints on copy):** player-facing strings follow the NPC-narrates-to-PM voice rule, and card types use the canonical friendly names via `getCardTypeName` — never surface the letter code or the word "card-as-jargon." (This directly addresses the #1 feedback complaint — a redesign is a chance to de-jargon.)
- **Performance:** non-issue (small per-player data).
- **In flux:** the teacher/classroom layer is active development (Phase 4a on a branch); nothing blocks a dashboard redesign, which is orthogonal.

---

### The one-line brief for the design team
This is an **educational game teaching real NYC permitting to non-experts**, played **on phones around a shared board**, where the player's recurring questions are **"what do I do next?"** and **"am I on track (approvals + money)?"** — and the current design's biggest failure is **overwhelming a non-expert with simultaneous jargon-heavy systems.** Optimize for *one clear next action* + *approval/money status*, de-jargoned, phone-first.

**The hard constraint that shapes everything (§9): the panel MUST fit one phone screen with zero scrolling.** That makes the dashboard a *triage problem* — pick what fits using the §5 ranking, show different things in different phases, and use view-replacing disclosure (tabs/modals), never scroll. If a layout idea requires scrolling on a phone, it's out of scope by definition.
