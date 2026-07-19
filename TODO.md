# TODO - Game Alpha

**Last Updated:** July 18, 2026
**Status:** Beta — live in production; **v3.1.16 deployed** (commit `9095413`, confirmed live 2026-07-18 via header `v3.1.16 · 9095413`)
**Current Version:** 3.1.16 (deployed)

---

## 📌 Documentation rule — the slimness contract (tightened 2026-07-10)

- **✅ Completed** → move to `CHANGELOG.md` and **delete** from here (don't just check off).
- **Section preambles: ONE pointer line max** (e.g. "history: CHANGELOG v3.0.91–98"). Never re-narrate shipped work here — that's CHANGELOG's job. (2026-07-10: preamble recaps had regrown this file to 306 lines / ~26K tokens, past the read cap.)
- **Trigger-gated / deferred / "revisit if noticed" items** live in the 🅿️ Parking lot at the bottom, not in active sections.
- **Size guard:** active portion (above the Parking lot) > ~150 lines, or whole file > ~250 → trim during `/koniec` step 4.

---

## 🔎 Active — bugs & investigations

*2026-07-11 blind code review: all 10 items fixed — history in CHANGELOG v3.0.112–120. `npm test` "hang" root-caused + fixed v3.1.11.*

## 📱 Active — playtester acquisition (PRD phases 1–2 shipped; history: CHANGELOG v3.0.95–97)

*Spec: [Unravel_Codes_Playtester_Acquisition_PRD_v4_Lean.docx](Mockups/Unravel_Codes_Playtester_Acquisition_PRD_v4_Lean.docx)*
- [ ] **Finish the screenshot carousel** — 7 shots done; still wanted in `src/playtest/tour/`: mid-game revealed nodes, won game, lost game, money-deducted modal (state-injection recipes in CLAUDE.md TACTICAL); re-shoot `01-player-setup` from production (QR shows localhost); swap `12-a-word-explained.png`. Regenerate via `node scripts/capture-game-screenshot.js`.
- [ ] **Demo video** — 30–45s; script + storyboard drafted 2026-07-05 (in chat); needs footage, then wire the "Watch demo" button.

## 🆕 Active — new-panel feedback (triage history: CHANGELOG v3.0.91–100; 2026-07-01 backlog recovered + reconciled 2026-07-18, full record: [.claude/feedback-staged.md](.claude/feedback-staged.md))

### Newly arrived (2026-07-03/05, staged 2026-07-10 — not yet triaged)
*(cost-preview item shipped v3.0.121, see CHANGELOG)*

### Newly arrived (2026-07-12, staged same day)
*(join-by-code player picker shipped v3.0.122, see CHANGELOG — closes fb:bb72760f and fb:aaae63c0)*

### Newly arrived (2026-07-13, staged same day)
*(owner alert fix shipped v3.0.124, see CHANGELOG — closes fb:a98951ab)*

### Newly arrived (2026-07-13 later batch — cost-preview toggle feedback)
*(stale-"Varies" bug shipped v3.0.126, see CHANGELOG — closes fb:49395e17; A/B experiment shipped v3.0.128/129, maintainer picked the dark-mode press-and-hold control as winner and requested 3 tweaks, shipped v3.0.131 — see CHANGELOG — closes fb:f453b1f3)*

### Landing / presentation (game-setup screen, NOT `/challenge`)
*(hero header — prominent title, brand-mark graphic, subtle motion — shipped v3.0.133, see CHANGELOG; closes fb:7dbc2fcc except the optional jingle, parked below under "audio = greenfield" since no SFX system exists yet)*

### Newly arrived (2026-07-14, staged same day)
*(TV setup screen fit/legibility — shipped v3.0.135, then the maintainer's real-hardware testing 2026-07-15 surfaced it needed real fixes on top: v3.0.138 (vh/zoom + grid-packing bugs), v3.0.140 (Android-TV-as-phone misdetection), v3.0.142 (tile redesign for the TV's actual 960x540 resolution) — see CHANGELOG. Closes fb:3f9f2831/fb:e121c34e once v3.0.142 is confirmed deployed; see NEXT_SESSION.md "Flip after deploy" for the full fb-id list including two more reports from the same session.)*

### Newly arrived (recovered 2026-07-18 — drafted 2026-07-01, never applied; see .claude/feedback-staged.md for full reconciliation)
*(16 of the 17 recovered items turned out to already be fixed in v3.0.91/v3.0.97, 2026-07-01/06 — the dashboard reports were just never flipped to resolved. Flip queued/pending, see .claude/fixloop/flip-queue.txt. Only one genuine gap remained:)*
- [ ] **Outcome modal has no "next steps"** — should show which work packages were added/removed. <!-- fb:7441e00b -->

### Newly arrived (2026-07-13 to 2026-07-17, staged 2026-07-18)
*(restart-after-crash blank-PC-view bug shipped v3.1.17, see CHANGELOG — closes fb:3a5280d8 once deployed)*
- [ ] **Can't add player** — report has no detail ("Q"), needs repro first. <!-- fb:75101be7 -->
- [ ] **Expeditor-replacement chooser is visible on the shared/TV screen** when played from a phone — private info leak. <!-- fb:44751a06 -->
- [ ] **Color picker: taken colors (blue) not clearly marked unavailable.** <!-- fb:d6bbcb00 -->
- [ ] **Share icon not visible on phone.** <!-- fb:2c848b47 -->

### Change-legibility P1 — Project Chronicle (first slice shipped v3.0.86)
- [~] **P1 remaining:** click-entry-to-replay-highlight, TV-persistent feed via `NotificationService` selective subscription. (Inline deltas per entry — work-change scope $ + expeditor-add count — shipped v3.1.16, which also fixed a real pre-existing bug: the icon-formatted card_draw branch never fired in production due to a field-name mismatch.) (P2–P5 parked below pending V2 reframe.)

### Dark/light mode coverage (maintainer request 2026-07-14, after classic panel removal + TurnCommitControl unification)
- [ ] **TVDisplay — needs a maintainer design decision, not a drop-in fix.** Everything else now respects the toggle: `PlayerPanelV2` + `TurnCommitControl` + `DiceResultModal` (v3.0.127) + `ChoiceModal` (v3.1.12) + `CardReplacementModal` (v3.1.13) + `CardDetailsModal` (v3.1.14) + `BoardCanvas` tile/canvas chrome, phase/validity/status colors deliberately untouched (v3.1.15). `CardModal` was deleted as dead code in v3.1.9. **Audited 2026-07-18: `TVDisplay` doesn't fit the pattern** — it's a top-level route (`App.tsx`, `?mode=tv`) rendered *outside* `PlayerPanelWrapper`'s tree, so it has no live mode signal and no toggle UI reaches the shared TV device (it already hardcodes `mode="light"` on `ScoreboardV2` deliberately). It also shows `BoardCanvas` behind its chrome for nearly the whole PLAY phase — darkening just the TV frame around it would look worse, not better. Needs a maintainer call: does the TV even want a dark mode (shared, across-the-room display, not a personal reading surface — design doc scoped dark/light to "the new panel + cards/modals + glossary" only, app-wide pass deferred), and if so, who operates a toggle for it? ReactFlow's own `Controls`/`MiniMap` chrome (from an imported stylesheet, not inline hex) is a separate small follow-up if wanted.

## 🚀 Active — infra / deploy / data

- [ ] **G160: show/hide individual board connectors + redirect per section** — Workstream 3 Phase B+ (global show/hide first; per-edge hide + waypoint redirect TBD per user approval; see BETA_PLAN_V3.md). <!-- fb:feedback-1778327469678-d27a73d0 -->
- [ ] **dictionary-scraper: label AI-generated glossary entries (decision 2026-07-12).** Audited 2026-07-12: no real dictionary/glossary is actually scraped anywhere in the pipeline — it pulls unread Gmail newsletters and asks Claude to invent term definitions from scratch. ~75% of the 252-entry `GLOSSARY.csv` is tagged "AI Generated" with no source URL. Maintainer decision: keep the AI-writing step, but mark those entries as such wherever the glossary is shown (the pipeline already tags provenance in the CSV `source` column — this is a display-layer change, not a pipeline change). Needs: the in-game dictionary popup + `dashboard-ui` (if it lists terms) to surface the tag. Repo: `D:/Unravel/dictionary-scraper`.
- [ ] **⏸️ Glossary auto-sync is BLOCKED on Anthropic credits (built + deployed 2026-07-13).** A nightly robot in the scraper backend (`dashboard/backend/glossary_autosync.py`, committed `452e76c`) discovers construction words in the game's CSVs that have no glossary entry, AI-drafts definitions, and stages them as `Purgatory` rows in the dashboard review queue for one-tap approval. Live on Unraid and verified end-to-end EXCEPT drafting returns "credit balance too low" — **add credits at console.anthropic.com → Plans & Billing** and it self-runs (nightly, or `POST /api/glossary/autosync` with `X-Sync-Token: $FEEDBACK_TOKEN`). Also fixed a status-leak bug: `get_live_glossary` was serving ~17 unapproved/duplicate rows (incl. a literal "term" row) to players. Details: memory [[project_glossary_autosync]]. NOTE: this auto-sync feeds the same AI-labeling concern as the item above — auto-drafted entries are tagged `source=game_auto | AI Generated`.

## 📱 Active — external testing & release

- [ ] **Recruit 3–5 external players** for a structured UAT pass (open since April — the `/challenge` funnel + QR codes above are the remaining enablers).
- [ ] **Compile post-Beta feedback report** — decide if the `/api/feedback` flow + dashboard is enough or a triage cadence is needed.
- [ ] **Bug-fix sprint after structured UAT** — placeholder.

## 🙋 Decisions waiting on the user

- [ ] **Board layout** — keep the stock grid, or re-arrange once in the editor (drag-save persists now). (Custom arrangement lost ~June 12, unrecoverable.)
- [ ] **Bank/Investor/Lender character naming** — 6 spaces show phase-only labels; user is marinading. **Don't nudge.**
- [ ] **Homeowner starting scenario: build a distinct violation mechanic (decided 2026-07-12).** Direct player comment (2026-07-12, screenshot, not a dashboard report) asked for a cash-strapped-homeowner-facing-a-Notice-of-Violation starting scenario. Audited: no violation concept exists today; the closest analog is `REG-DOB-AUDIT` (dice-roll revokes DOB approval), but maintainer wants a genuinely distinct mechanic, not a reskin of that space. **Still needs its own design pass before engineering** — what does facing the violation actually require the player to do, and how does it resolve? Starting space itself is cheap to change (`GAME_CONFIG.csv`'s `is_starting_space` flag, one cell) — the design gap is the mechanic, not the plumbing.

### Resolved 2026-07-18
- **`canPlayCard` type-tightening (the fb:66bb0bda design call) — DECLINED: the rule stays type-agnostic.** Maintainer decision with two stated reasons: (1) **easier reskin** — a themed version (D&D discussed) would want hand-playable card families (potions/scrolls/henchmen), and baking "E-only" into the rulebook layer bakes today's permitting content into the engine; (2) **flexibility to add more card functionality** later without reopening a hardcoded gate. The V2 screens keep gating what's *offered* (E-only today, presentation-level); the service-level correctness hole that made the loose rule risky was closed in v3.1.10 (Kid E guard on all paths). **Recorded future direction, with trigger:** when a second hand-playable card family actually appears, move the gate into card data (a playable-from-hand flag in the card CSVs, same pattern as cost/duration/phase_restriction) so the rule asks the card, not the type — until then the component-level `card_type === 'E'` checks stand as-is.

### Resolved 2026-07-12 (maintainer interview)
- **Workstream 2 / v3.0.0 criterion** — snapshot Try Again was scoped to *replace* REAL/TEMP entirely; it shipped as `TurnCostLedger` layered on top instead. RESOLVED: rewrite the criterion to match what shipped, don't do the replacement. Audited: zero bugs traced to the overlap in the ledger's lifetime; the ledger only tracks 3 narrow fields (money spent/cards played/life-events-drawn) vs. REAL/TEMP's ~18-field, 83-call-site scope; a full replacement would just relocate that complexity, not remove it, and is unrelated to the CSV-reskin goal (see Active section above). Full replacement parked below with its trigger. Criterion text rewritten 2026-07-18 (docs sweep, see CHANGELOG [Docs]).
- **dictionary-scraper `ANTHROPIC_API_KEY`** — RESOLVED, see the Active infra item above (keep the AI-writing step + label it, not remove the key).

### Dashboard PATCH recipe (for flips after a deploy is confirmed live)
`PATCH https://game.unravelcodes.com/api/feedback/<full-id>.json?token=<FEEDBACK_TOKEN>` body `{"resolved":true}` (`.json` suffix required, token-gated). 2026-07-10: 20 fixed-and-deployed reports flipped, 53→33 open. 2026-07-10/11: 5 more flipped (fixloop closures + 2 maintainer-confirmed-already-resolved) → 27 open. 2026-07-12: 3 more flipped after v3.0.115 deploy confirmed (`b46cb30`) → 24 open. 2026-07-13: 6 more flipped after v3.0.121–127 deploy confirmed → 26 open (2 new reports arrived same window). 2026-07-14: v3.0.116–137 deploy confirmed (`c6e516c`) — 2 more flipped (fb:f453b1f3, fb:7dbc2fcc) → 28 open (new reports arrived in the interim). 2026-07-15: v3.0.141 confirmed deployed (`8b5bf45`) but v3.0.142 (the fix that actually closes the TV-fit thread) is NOT yet deployed — 4 reports pending flip once it is: fb:3f9f2831, fb:e121c34e (original "resolution is crap"/"can't go back up"), plus two filed same day from the same real TV, fb:dca292b8 ("TV detected as phone") and fb:28512320 ("still can not see all four players"). Full detail: NEXT_SESSION.md "Flip after deploy". 2026-07-16: v3.0.142 confirmed deployed (`aa80c0b`) — the 4 pending reports above flipped → 29 open (2 new reports arrived in the interim: fb:2b5b9f2a "zoom changes on space change", fb:daf6b7fc "room for three or four colors"). Same day: both new reports FIXED in v3.1.2 (TV pan-only camera + PC zoom-memory clobber; 3 direct-pick color dots). 2026-07-16 (later): v3.1.0–3.1.3 confirmed deployed (`c4471b3`) — fb:2b5b9f2a and fb:daf6b7fc flipped → 27 open. Real-TV confirmation of the camera feel (zoom should stay put between moves) is still outstanding — this session's browser can't play animated camera transitions at all (see CLAUDE.md TACTICAL), so the fix was verified via unit tests + state instrumentation, not a watched animation.

---

## 🅿️ Parking lot — real but deferred; each fires on its inline trigger

### Product / design (trigger noted per item)
- [ ] **Board visual evolution as more spaces get added (maintainer idea, 2026-07-14)** — the board may need to represent connections better than a flat 2D layout once it grows; maintainer shared a reference image (abstract particle/bokeh visualization, code panels on the sides) evoking "zoom into one space, its info shows at the edges, you still see the rest." **My recommendation: try this in 2D first, not true 3D.** True 3D (a WebGL engine like Three.js — ReactFlow, the board's actual current renderer, is 2D/DOM-based) is a full re-platforming, not a tweak, and carries real risk specifically for this game: smart TVs (a primary target platform, per tonight's TV-mode work) often have weak/inconsistent WebGL support across Tizen/webOS/Android TV/Fire TV, and "readability over immersion" was the explicit house-standard principle from the earlier board-scaling review this same session — a 3D re-platform could regress the TV legibility work just shipped (v3.0.137) for a payoff that isn't guaranteed. The specific desired FEELING (focus on one space, contextual info pinned to the screen edges, everything else still visible but de-emphasized) is a depth-of-field / focus effect, not something that requires true 3D — it's achievable by extending `BoardNode`'s existing 5-step size hierarchy (`computeTileVisualState` in `boardCommon.ts`: compact/validMove/hover/currentBig/expanded) with a new "focus mode": dim/blur non-focused tiles (CSS `filter`/`opacity`) and move the expanded tile's detail content to fixed side panels instead of growing in place. Far lower engineering risk, reuses code that already exists, and gets most of the way to the photo's feeling. Reserve true 3D as a "someday, if we genuinely outgrow 2D legibility" idea, not the first thing to try.
- [ ] **Real mobile-preview mini-puzzle** — genuine 30–60s phone demo is design work, not engineering; scope separately when there's a clear idea. ("Quick preview" currently routes to the real game as a deliberate A/B placebo.)
- [ ] **Playtest-funnel Phase 3 (optimize on real data)** — trigger: traffic exists. `GET /api/admin/playtest-stats` already aggregates. Metrics: return rate, completion, feedback rate.
- [ ] **This-turn cost line attribution nuance** (prev-turn movement days attribute to current turn) — trigger: playtesters notice.
- [ ] **✓ done-trace tooltip is desktop-hover only** — trigger: players ask for it on touch.
- [ ] **Ledger accordion for remaining areas** ("Where your money's going" + funding-gap line) — trigger: one-screen rule starts fighting again.
- [ ] **Between-turns move overlay sits under full-screen modals** (panel-scoped z-60 vs modal z-1000) — accepted for v1; lift or suppress if wanted.
- [ ] **Change-legibility P2–P5 + audio** — inline tab deltas/flash/badges (P2), tiered work cards + diegetic vocabulary (P3), time-feel duration-mapped transitions + days-proportional burn, NO float model (P4), a11y/pedagogy + debrief (P5), audio = greenfield (no SFX system; visual-equivalent rule). **Reframe against the V2 panel before building — the 2026-06-23 spec is written in classic-panel terms.** Full spec context: this file's git history (2026-06-23 entry) + [player-panel-redesign-20260714.md](docs/archive/player-panel-redesign-20260714.md) §10 (archived 2026-07-18, redesign complete).
- [ ] **Expeditor "presence"** (avatar/causality link-line) — assumes a task-cell grid the data model doesn't have; revisit after P1–P5.
- [ ] **Gantt / schedule today-line view** — trigger: teachers add enough construction-section spaces.
- [ ] **Expeditor mechanic: pick with tradeoffs instead of "hire 3"** — bigger design change. <!-- fb:feedback-1778584030168-f22035af -->
- [ ] **Async/decoupled turn order option** — maintainer's own idea (2026-07-13), explicitly "fun thing to think about for the future," not a request: an optional game-settings mode where players move independently instead of the current coordinated loop, so nobody waits on others — motivated by both faster casual play and eventually repurposing the engine for a D&D-style game where players go off on separate quests. Maintainer already flagged the open question themselves: shared-card/shared-time mechanics assume a synchronized turn order, so this needs real design work before engineering, not just a settings flag. Trigger: revisit now that the CSV-portability lift has shipped (v3.1.0, CHANGELOG) — related but distinct (that one was data hardcoding, this is turn-structure). <!-- fb:feedback-1783919654407-1df093dd -->
- [ ] **Build the "Remote" play mode** (maintainer request 2026-07-14) — a real third mode for players in genuinely separate locations, distinct from both PC ("shared screen") and TV ("shared screen + phone controllers"), which both still assume one physical hub device. The setup-screen button exists now (v3.0.136) as a discoverable "coming soon" placeholder only. What's already there: join-by-code + WebSocket state sync already work from anywhere with a network connection (nothing geographically restricts today's `?g=&token=` join flow). What's genuinely missing: a mode where NO device is the "shared board" — every connected player needs their own board view, and today's PC/TV modes both assume exactly one canonical shared display. Related to but distinct from the async-turn-order idea above (that's turn STRUCTURE; this is connection TOPOLOGY) — could ship independently of it, since even coordinated-turn-order play works fine with everyone remote as long as each device shows its own board.
- [ ] **Onboarding Phase C: plain-English aliases** (`display_label_plain` in GAME_CONFIG for tiles/buttons) — needs user to write alias strings (~4 hr). Phases A shipped v2.70.5. <!-- fb:feedback-1778583921001-0aa9660c --> <!-- fb:feedback-1778584099671-8ad42b52 -->
- [ ] **Log follow-ons:** expandable log rows (chevron → raw detail) + end-screen export + post-game viewer with search/filter — agreed as v3.0.45/46 concepts, never built.
- [ ] **Per-NPC rich sentence templates for dice summary** (~30–40 authored sentences) — trigger: attribution form feels thin in playtest.
- [ ] **`{fundingAmount}` token at remaining spots** — partial 2026-05-29 (BANK/INVESTOR Subsequent done; First-visit + LEND skipped deliberately). Outcome-column adoption needs `spaceOutcome` run through `interpolateTemplate`.
- [ ] **First-game tutorial moment for the approval mechanic** — ties into the onboarding package.
- [ ] **End-game penalty tuning** (`MISSING_DOB_PENALTY_*` in ApprovalService.ts) — trigger: 3–5 real games where players hit the penalty.
- [ ] **OPTIONAL content: author `effects_on_play` prose for 74 E + 49 L cards** — only if a one-line authored effect adds teaching value.

### Reliability / plumbing (trigger noted per item)
- [ ] **HTTP polling fallback while disconnected** — trigger: WS reconnect proves insufficient in real play.
- [ ] **"Start without all phones" override for TV mode** — trigger: the hard-block gets in the way of solo demos.
- [ ] **TV bug-report button pulls phone log buffers** (heartbeat-piggyback ~5s, last ~50 entries/phone) — trigger: next phone-crash-can't-report incident.
- [ ] **Mobile-tab-freeze TEMP-state-loss claim** — external audit theory, unverified; `visibilitychange` reconnect already exists. Trigger: a playtester actually reports lost actions after phone lock.
- [ ] **Deploy stamps commit "unknown" on `docker compose` builds** (Alpine container lacks git) — non-issue while using deploy.sh.
- [ ] **Webhook deployment** (push-to-deploy via HTTP receiver on Unraid) + **verify deploy.sh backup/restore of `game-data/`** — DX wishlist, stalled since April.
- [ ] **GEMINI.md setup** — likely obsolete (Gemini-era note); drop unless the user still wants it.
- [ ] **Dice-result modal won't dismiss in the browser test harness** (~20 min investigation). A `DiceResultModal` that won't close via click / pointer-events / Escape even on a fresh reload with zero prior HMR has blocked *live* verification twice (v3.0.111, v3.0.122), forcing "verified via accessibility tree instead of screenshot" caveats. Not a game bug — a tooling/automation obstacle degrading our ability to prove fixes live. Root-cause the modal-dismiss-in-automation path (backdrop-grace timing? pointer-events layering? focus trap?). (2026-07-13 CHANGELOG review)
- [ ] **`tests/E2E-AllPaths.test.ts` intermittently times out under full-suite load** — a *different* sub-test (30–60s timeout on `setupGame()`) fails on each run: 3 separate runs on 2026-07-13 each timed out on a different path (`PM → CHEAT-BYPASS`, `REG-DOB-TYPE-SELECT → REG-DOB-PLAN-EXAM`, `ENG-SCOPE → PM-DECISION-CHECK`). Confirmed non-deterministic (not a code bug in any one path) — almost certainly resource contention from multiple concurrent dev servers/Claude sessions sharing this machine during heavy fixloop sessions. Trigger: recurs on a quiet machine with nothing else running, or blocks a `/koniec` pre-flight often enough to be annoying — then worth raising this file's `testTimeout` or investigating why `setupGame()` is slow enough to bump into it at all under load.

### Architecture / code health (bundle these in one dedicated session — same drift-trap shape)
- [~] ~~Classic→V2 panel parity sweep~~ — MOOT 2026-07-14: the classic `ActionCenterPanel` this item was auditing against was deleted the same day (see CHANGELOG), along with its exclusive sections/CSS/tests. There's no more classic panel to have a parity gap against.
- [ ] **2026-06-10 deficiency-audit leftovers** (audit doc archived → [DEFICIENCY_AUDIT-20260610.md](docs/archive/DEFICIENCY_AUDIT-20260610.md); each verified still real 2026-07-18): `DataEditor.tsx` calls hooks after an early return (28 lint errors incl. rules-of-hooks at :368/:378 — latent crash; the other files DEF-3 flagged died with the classic panel); `npm run lint` still unrunnable (386 errors, `no-undef` misconfigured for TS, lint not in CI — DEF-4); 164 raw `console.*` calls bypass the debug gate (DEF-9); no `engines` pin in package.json (DEF-10, ~2 min); the one true full-game E2E still `it.skip` at [E2E-FullGame.test.tsx:274](tests/E2E-FullGame.test.tsx:274) + `process.exit()` calls in E2E-04 (DEF-11).
- [ ] **DataService lookups are all linear scans** (`getCardById`, `getGameConfigBySpace`, `getMovement`, … [DataService.ts:123–1079](src/services/DataService.ts:123)) — called per-hand-card in hot loops (scope calc, condition checks, action counting on every state change). Build keyed Maps once at load. (2026-07-11 review)
- [ ] **Notification storm + full-state subscriptions.** `updateActionCounts` notifies AND most callers notify again → double listener sweeps per action ([StateService.ts:719–744](src/services/StateService.ts:719) etc.); `setPlayerCompletedManualAction`/`nextPlayer` rely on `updateActionCounts`'s notify, which can early-return WITHOUT notifying (no current player / data not loaded). Meanwhile ~15 components use full-state `subscribe()` (PlayerPanelV2/ScoreboardV2 force-rerender on every change) though `subscribeWithSelector` exists. One perf/cleanliness bundle. (2026-07-11 review)
- [ ] **`getGameState()`'s "deep copies" claim is false** — only `players`+`hand` are copied; `activeCards`/`activeEffects`/`loans`/`moneySources`/decks are shared references ([StateService.ts:284](src/services/StateService.ts:284)), and `getGameStateDeepCopy` is the same function. [EffectEngineService.ts:1411](src/services/EffectEngineService.ts:1411) already mutates through it. Deep-clone or rename + enforce no-mutation. (2026-07-11 review)
- [ ] **Dead-code sweep (~300 lines):** `GameRulesService.canDrawCard` (never called; also wrong in SAME_START mode — checks only shared decks), 5 legacy `apply*CardEffect` methods + `requiresPlayerTurn` ([CardService.ts:1748–1972](src/services/CardService.ts:1748) — contains wrong-if-ever-revived behavior like random-card-type draws), and empty `if/else` husks left from stripped console.logs (StateService.ts:344/357/672, GameRulesService.checkWinCondition, CardService.applyLifeEventsCardEffect). (2026-07-11 review; `TurnService.endTurn` — the other item in this bundle — already deleted in v3.0.113.)
- [ ] **Unify TEMP/REAL state + logging sessions into one `TurnTransaction` boundary** — today `tryAgainOnSpace`/`startTurn` hand-call both systems in parallel; begin/commit/discard at one call site. Touches StateService, LoggingService, TurnService, integration tests. 1–2 sessions. **Do NOT do casually.**
- [ ] **TurnCostLedger full replacement of REAL/TEMP** — considered and declined 2026-07-12 (see Decisions above; audited, no bugs from the current overlap, 83-call-site blast radius for zero net simplification). Trigger to revisit: Try Again needs to preserve a 4th+ type of "sticky outflow" beyond money/cards/life-events-drawn.
- [ ] **NotificationService.notify + LoggingService.info — one "something happened" bus** (toast + log + … routed from one emission). **Largely built 2026-07-17:** domain-event stages 1–4 all shipped (design doc archived → [domain-events-20260717.md](docs/archive/domain-events-20260717.md)); the 9 dual-channel moments now route through `GameEventBus` → `LogWriter`/`ToastWriter`. Per that doc's own rule, re-scope this item now against only the REMAINING direct notify/info callers before doing anything. Many callers; scope separately from the above. *(Independently flagged 2026-07-14 by an external review of the CHANGELOG, which counted toast/modal/banner/approval-banner/shutdown-banner as feeling like several notification systems — same direction as this item, though "several small bespoke inline notifications with no shared pattern" is more accurate than "six systems"; a modal, a persistent banner, and a toast are legitimately different UI patterns for different urgency levels, so full unification may not even be the right end state — worth deciding when actually scoped, not assumed.)*
- [ ] **`player.money` + `player.moneySources` denormalization** — make `money` a computed getter over sources. Riskiest; do last.
- [ ] **Three effect pipelines (Space/Dice/Card)** behind one `EffectExecutor` interface — no observed bug; shape worth examining only.
- [ ] **Dead `notificationService` fields in 5 services** (found during domain-event stage 3, 2026-07-17): `ManualActionProcessor`, `TurnTransitionHandler`, `DiceRollProcessor`, `EffectEngineService`, `SpaceArrivalProcessor` each still take an optional `notificationService` constructor param that's now only ever assigned (via a setter), never read — their one real call site was migrated to `ToastWriter` this stage. Removing the param touches each class's constructor + every call site that constructs it (`ServiceProvider.tsx`, `tests/ghost/bootstrapServices.ts`, and any test file constructing one directly) — small individually, but real cross-file cleanup, not a "while I'm here" fix.
- [ ] **Service decomposition — only on concrete pain signal** (specific method painful to edit, git-blame bug hot-spot, documented AI-context cost). **Do not resurrect the 600-line target** (audited cosmetic, Apr 17).
- [ ] **Type-safety Bucket E (~15 `any` sites) — intentional, leave as-is** (documented; not blocked on typecheck).
- [ ] **Turn Numbering System tests** (spec in git history, commit `3f8c14f`) — likely drop unless turn-numbering UI surfaces bugs.
- [ ] **Phase 6.4: lift NPC voice profile to per-space data flag** — educator-added spaces fall back to narrator voice (accepted); revisit if an educator complains.

### Content / authoring workstreams (each is its own project; pointers only)
- [ ] **Story authoring rollout** — 5 of ~75 card-effect rows authored; **a full draft for most spaces already exists and was never merged: [narratives-draft.md](docs/core/narratives-draft.md)** (Apr 2026; verified 2026-07-18 only the 5 v2.50.0 rows are in SPACE_EFFECTS.csv). Before merging, the draft needs (a) a voice-rule pass — it pre-dates the no-game-language rule and says "Roll" throughout — and (b) format adaptation (it assumed per-type `*_card_narrative` columns; the shipped schema is one `narrative` column per SPACE_EFFECTS row). Two paths: Live Data Editor at `/admin`, or JSON + `scripts/set-narrative.mjs` → `regen-clean-files.mjs`. Priority: high-traffic REG/PM/ARCH/ENG first.
- [ ] **Voice rewrite Pass 2 — ModalConfig.csv population** (~100–150 rows) from the per-space modal tables in [AUTHORED_COPY_REVIEW.md](docs/core/AUTHORED_COPY_REVIEW.md) (Pass 1 — Event/Action/Outcome — verified merged into the CSVs 2026-07-18) — blocked on mapping doc labels → engine `effect_action` keys; worth scripting (parser starting point: `scripts/merge-voice-rewrite.mjs`).
- [ ] **Educational "Learn More" per space** — field-guide register, NYC-sourced (nyc.gov/ZR/Admin Code), 2-space calibration sample first (REG-FDNY-PLAN-EXAM + BANK-FUND-REVIEW).
- [ ] **Per-action confirmation modal two-panel layout** — [Mockups/story-mockup.html](Mockups/story-mockup.html) §2 Option C; POLISH phase.
- [ ] **Editor UX redesign** (Story/Flow/Mechanics tabbed editor, [Mockups/editor-mockup.html](Mockups/editor-mockup.html)) + **Game Card editor** (labeled controls over CARDS_EXPANDED.csv, inline `cardTextMatchesColumns` checks, `_extraColumns` round-trip) — UI pass only, benefits from engine-data separation being further along.
- [ ] **Data storage format (CSV → JSON/markdown)** — decision deferred until engine-data separation reveals the data shape. Do not migrate now.
- [ ] **Multi-tenant catalog (educator licensing/contribution)** — prerequisite is engine-data separation, not file format.
- [ ] **Billing & usage reporting** (per-teacher activity tracking → per-school monthly statements) — build after the teacher layer has real users.

### Balance / metrics (standing watch, not work)
- [ ] **Ghost win-rate "90%" goal** — read win-rate + avgTurns TOGETHER (wins↑ turns→ = easier ✓; wins→ turns↑ = grindier ✗). Track via `.claude/ghost-history.jsonl`. Levers if pursued: easier economy / smarter bot / onboarding.
- [ ] **Game length vs ~40-min class period** — trigger to act: a REAL playtest game runs past ~40 min → trim mechanics/space requirements (that's the lever, not win-rate). Bot avgTurns=149 is NOT a red flag (bots ≠ humans).

### Known limitations / environmental (accepted, flag-only)
- [ ] **Q2 first-visit blind spot** — `scope_changed_since_last_visit` has no snapshot on a first FDNY-FEE-REVIEW visit → defaults "no change"; maintainer accepted 2026-06-15. Sturdier fix if ever needed: snapshot scope at FDNY approval grant.
- [ ] **Loan-repayment deadline + TCO mechanic** (maintainer idea 2026-07-02, "way later") — needs a TCO mechanic; real expansion.
- [ ] **"Play on Perplexity" load failure** — embedded browser blocked scripts + expired game id; no code bug. At most a friendlier "game expired / open in a full browser" message. <!-- fb:feedback-1781190420890-5a155a1a -->
- [ ] **Swap terser → native minifier (Rolldown/Oxc or esbuild)** — bundle-affecting, verify via deploy playtest; preserve vite.config.ts console behaviors. Build is ~8s, low priority.

### Dependency major-version jumps (deferred 2026-05-29; audit clean, minors done)
- [ ] TypeScript 5.9→6.0 (wait 1–2 months, branch attempt) · Vite 7→8 + plugin-react 5→6 (together; check `manualChunks`) · ESLint 9→10 (already flat-config, surface may be small) · jsdom 27→29 (re-test `forksFiles` workarounds) · playwright 1.57→1.60 (alongside Playwright test work).

*For full history, see CHANGELOG.md. Un-promoted v3.0.83–90 feedback staging: [.claude/feedback-staged.md](.claude/feedback-staged.md).*
