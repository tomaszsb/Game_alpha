# TODO - Game Alpha

**Last Updated:** July 10, 2026
**Status:** Beta — live in production; **v3.0.100 deployed 2026-07-10** (commit `8929371`, confirmed by maintainer)
**Current Version:** 3.0.100

---

## 📌 Documentation rule — the slimness contract (tightened 2026-07-10)

- **✅ Completed** → move to `CHANGELOG.md` and **delete** from here (don't just check off).
- **Section preambles: ONE pointer line max** (e.g. "history: CHANGELOG v3.0.91–98"). Never re-narrate shipped work here — that's CHANGELOG's job. (2026-07-10: preamble recaps had regrown this file to 306 lines / ~26K tokens, past the read cap.)
- **Trigger-gated / deferred / "revisit if noticed" items** live in the 🅿️ Parking lot at the bottom, not in active sections.
- **Size guard:** active portion (above the Parking lot) > ~150 lines, or whole file > ~250 → trim during `/koniec` step 4.

---

## 🔎 Active — bugs & investigations

- [ ] **6x duplicate `subscribeToAutoActions` firing.** Every auto-action event fires 6× instead of once, even on a fresh browser session. Harmless today (all handlers idempotent) but a future counter/append handler would silently misbehave. Candidates: StrictMode double-invoke (explains 2×, not 6×), multiple simultaneous GameLayout mounts (solo/grid/TV, even CSS-hidden), unsubscribe not detaching on effect cleanup. Also noted: `effectiveViewPlayerId` reads stale/null in that effect's closure — harmless now (handlers use `event.playerId`), footgun later. (Background task `task_bb6cec79`, 2026-07-09.)
- [ ] **"Move button disappeared after submitting a bug report"** (fb:1782843327269-bf8bf19a, v3.0.90) — teleport harness can't repro (bypasses client-computed `availableActionTypes`/`movementChoiceUnlocked`; see CLAUDE.md TACTICAL 2026-07-09). Needs a real playthrough to a movement-choice space + filing a report there, or live confirmation it still reproduces on v3.0.100+.
- [ ] **DiceResultModal (outcome modal) restyle to the V2 design language.** Was deferred until the new panel became default — it has been since v3.0.97, so this is now unblocked. Shared live-turn modal (holds the v3.0.71 backdrop-grace fix) — restyle in place, carefully. Design: [player-panel-redesign.md](docs/design/player-panel-redesign.md) §5/§10.1.
- [ ] **Before→after outcome modal ([OutcomeChangesV2.tsx](src/components/player/OutcomeChangesV2.tsx)) — confirm live once**, then judge the "Gained:" double-listing polish question (effect-row + ledger line may read noisy; if so show only lost/swapped). v3.0.99 audit + passing test say it works; just hasn't been watched in a real card-gain/loss moment.

## 📣 Active — host-to-player messaging (2026-07-08)

- [ ] **Design + build a host-message broadcast.** No channel exists to push a message into a running game (new WS message type in `server/websocket.js` + dismissible banner in `GameLayout`/`TVDisplay`). Needs its own design pass first: who can send, free text vs presets, interrupt vs appear, Chronicle logging. Also fits remote-classroom teacher use.

## 📱 Active — playtester acquisition (PRD phases 1–2 shipped; history: CHANGELOG v3.0.95–97)

*Spec: [Unravel_Codes_Playtester_Acquisition_PRD_v4_Lean.docx](Mockups/Unravel_Codes_Playtester_Acquisition_PRD_v4_Lean.docx)*
- [ ] **Live-verify `/challenge` on the user's iPhone 16** — phone view, "Phone alert"→Add-to-Home-Screen, carousel, "Play anyway" warning only seen headless so far.
- [ ] **Finish the screenshot carousel** — 7 shots done; still wanted in `src/playtest/tour/`: mid-game revealed nodes, won game, lost game, money-deducted modal (state-injection recipes in CLAUDE.md TACTICAL); re-shoot `01-player-setup` from production (QR shows localhost); swap `12-a-word-explained.png`. Regenerate via `node scripts/capture-game-screenshot.js`.
- [ ] **Demo video** — 30–45s; script + storyboard drafted 2026-07-05 (in chat); needs footage, then wire the "Watch demo" button.
- [ ] **Print the QR codes** — 5 PNGs in `Mockups/qr-codes/`; add logo overlay in image software first (PRD asks for one).

## 🆕 Active — new-panel feedback (triage history: CHANGELOG v3.0.91–100; un-promoted v3.0.83–90 reports: [.claude/feedback-staged.md](.claude/feedback-staged.md))

### Newly arrived (2026-07-03/05, staged 2026-07-10 — not yet triaged)
- [ ] **Share button on pages where it makes sense** — "looking to get more players". <!-- fb:feedback-1783230681607-5e05dc1f -->
- [ ] **Moves as the last possible act — revisit** — maintainer reconsidering earlier ruling. <!-- fb:feedback-1783082047004-3dcb3ba7 -->
- [ ] **"How does this card work? is the plumbing built for it?"** — card unclear; v3.0.100 audited E009/E024 as correctly implemented, but this specific report was never claimed by id — confirm which card + whether copy needs teaching text. <!-- fb:feedback-1783081638577-ee534eb3 -->
- [ ] **Owner seed money maybe shouldn't count as "funding raised"** — design question. <!-- fb:feedback-1783081115822-cac490a5 -->
- [ ] **History uses game wording ("rolled")** — violates the no-game-language rule; sweep history/Chronicle strings. <!-- fb:feedback-1783080880242-bbbb4005 -->
- [ ] **Both actions were to show costs/changes; only End Turn does** — cost/changes visibility gap. <!-- fb:feedback-1783080349985-a3dc215f -->
- [ ] **Modals have two ways of closing — keep one.** <!-- fb:feedback-1783079995743-3cd24690 -->
- [ ] **Two versions of same output, one old one new** — old/new panel output rendering side-by-side somewhere; new looks better. <!-- fb:feedback-1783079668156-5984e322 -->

### Landing / presentation (game-setup screen, NOT `/challenge` — reassess after v3.0.96 approach is seen live)
- [ ] **Landing feels "naked"** — wants prominent title, representative graphic (carousel idea now proven on `/challenge` — could reuse), optional jingle, subtle motion. <!-- fb:feedback-1782833475856-7dbc2fcc -->
- [ ] **Resize to always fit screen + phone warning** (`/challenge` has the warning; game-setup screen may still want it). <!-- fb:feedback-1782833653490-5470235b -->

### Change-legibility P1 — Project Chronicle (first slice shipped v3.0.86)
- [~] **P1 remaining:** inline deltas per entry, click-entry-to-replay-highlight, TV-persistent feed via `NotificationService` selective subscription. Acceptance: every committed work-change + expeditor add → exactly one feed entry with a delta, from the existing emission point. (P2–P5 parked below pending V2 reframe.)

## 🚀 Active — infra / deploy / data

- [ ] **One-time full live-vs-master audit of CLEAN files** — 5 diverged as of 2026-06-09 (only `pos_x`/`pos_y` are genuine live user-data); data-deploy gap itself is CLOSED (see memory `project_data_deploy_gap`).
- [ ] **Post-deploy doc cleanup:** mark the CLAUDE.md "CSV data fixes do NOT reach the live server" recipe fully obsolete + update auto-memory `project_data_deploy_gap.md` (gap dead by construction).
- [ ] **Dashboard UI: surface `version` + `gitCommit` on bug-report pages** (~15 min, display-only; repo `D:/Unravel/dictionary-scraper/dashboard/frontend/dashboard-ui/`, extend `FeedbackReport.metadata` in feedback/page.tsx + detail view). Optional: gray-out stale-version reports, version filter.
- [ ] **G160: show/hide individual board connectors + redirect per section** — Workstream 3 Phase B+ (global show/hide first; per-edge hide + waypoint redirect TBD per user approval; see BETA_PLAN_V3.md). <!-- fb:feedback-1778327469678-d27a73d0 -->

## 📱 Active — external testing & release

- [ ] **Recruit 3–5 external players** for a structured UAT pass (open since April — the `/challenge` funnel + QR codes above are the remaining enablers).
- [ ] **Compile post-Beta feedback report** — decide if the `/api/feedback` flow + dashboard is enough or a triage cadence is needed.
- [ ] **Bug-fix sprint after structured UAT** — placeholder.

## 🙋 Decisions waiting on the user

- [ ] **Board layout** — keep the stock grid, or re-arrange once in the editor (drag-save persists now). (Custom arrangement lost ~June 12, unrecoverable.)
- [ ] **Bank/Investor/Lender character naming** — 6 spaces show phase-only labels; user is marinading. **Don't nudge.**
- [ ] **Workstream 2 / v3.0.0 criterion** — snapshot Try Again was to *replace* REAL/TEMP entirely; they coexist. Tighten the criterion or do the replacement?
- [ ] **dictionary-scraper stack: `ANTHROPIC_API_KEY` blank** — compose warns on every `up`. Intentional? Ask before fixing.

### Dashboard PATCH recipe (for flips after a deploy is confirmed live)
`PATCH https://game.unravelcodes.com/api/feedback/<full-id>.json?token=<FEEDBACK_TOKEN>` body `{"resolved":true}` (`.json` suffix required, token-gated). 2026-07-10: 20 fixed-and-deployed reports flipped, 53→33 open.

---

## 🅿️ Parking lot — real but deferred; each fires on its inline trigger

### Product / design (trigger noted per item)
- [ ] **Real mobile-preview mini-puzzle** — genuine 30–60s phone demo is design work, not engineering; scope separately when there's a clear idea. ("Quick preview" currently routes to the real game as a deliberate A/B placebo.)
- [ ] **Playtest-funnel Phase 3 (optimize on real data)** — trigger: traffic exists. `GET /api/admin/playtest-stats` already aggregates. Metrics: return rate, completion, feedback rate.
- [ ] **This-turn cost line attribution nuance** (prev-turn movement days attribute to current turn) — trigger: playtesters notice.
- [ ] **✓ done-trace tooltip is desktop-hover only** — trigger: players ask for it on touch.
- [ ] **Ledger accordion for remaining areas** ("Where your money's going" + funding-gap line) — trigger: one-screen rule starts fighting again.
- [ ] **Between-turns move overlay sits under full-screen modals** (panel-scoped z-60 vs modal z-1000) — accepted for v1; lift or suppress if wanted.
- [ ] **Change-legibility P2–P5 + audio** — inline tab deltas/flash/badges (P2), tiered work cards + diegetic vocabulary (P3), time-feel duration-mapped transitions + days-proportional burn, NO float model (P4), a11y/pedagogy + debrief (P5), audio = greenfield (no SFX system; visual-equivalent rule). **Reframe against the V2 panel before building — the 2026-06-23 spec is written in classic-panel terms.** Full spec context: this file's git history (2026-06-23 entry) + [player-panel-redesign.md](docs/design/player-panel-redesign.md) §10.
- [ ] **Expeditor "presence"** (avatar/causality link-line) — assumes a task-cell grid the data model doesn't have; revisit after P1–P5.
- [ ] **Gantt / schedule today-line view** — trigger: teachers add enough construction-section spaces.
- [ ] **Expeditor mechanic: pick with tradeoffs instead of "hire 3"** — bigger design change. <!-- fb:feedback-1778584030168-f22035af -->
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

### Architecture / code health (bundle these in one dedicated session — same drift-trap shape)
- [ ] **Unify TEMP/REAL state + logging sessions into one `TurnTransaction` boundary** — today `tryAgainOnSpace`/`startTurn` hand-call both systems in parallel; begin/commit/discard at one call site. Touches StateService, LoggingService, TurnService, integration tests. 1–2 sessions. **Do NOT do casually.**
- [ ] **NotificationService.notify + LoggingService.info — one "something happened" bus** (toast + log + … routed from one emission). Many callers; scope separately from the above.
- [ ] **`player.money` + `player.moneySources` denormalization** — make `money` a computed getter over sources. Riskiest; do last.
- [ ] **Three effect pipelines (Space/Dice/Card)** behind one `EffectExecutor` interface — no observed bug; shape worth examining only.
- [ ] **Service decomposition — only on concrete pain signal** (specific method painful to edit, git-blame bug hot-spot, documented AI-context cost). **Do not resurrect the 600-line target** (audited cosmetic, Apr 17).
- [ ] **Type-safety Bucket E (~15 `any` sites) — intentional, leave as-is** (documented; not blocked on typecheck).
- [ ] **Per-space hardcoding, defensible constants** (`ApprovalService.ts:37–74` DOB/FDNY space names, `DOB_APPROVED_DESTINATIONS`, `AUDIT_TRIGGERED_FROM`) — lift only if an educator wants a non-standard layout; could become CSV columns.
- [ ] **Turn Numbering System tests** (spec in git history, commit `3f8c14f`) — likely drop unless turn-numbering UI surfaces bugs.
- [ ] **Phase 6.4: lift NPC voice profile to per-space data flag** — educator-added spaces fall back to narrator voice (accepted); revisit if an educator complains.

### Content / authoring workstreams (each is its own project; pointers only)
- [ ] **Story authoring rollout** — 5 of ~75 card-effect rows authored; two paths: Live Data Editor at `/admin`, or JSON + `scripts/set-narrative.mjs` → `regen-clean-files.mjs`. Priority: high-traffic REG/PM/ARCH/ENG first.
- [ ] **Voice rewrite Pass 2 — ModalConfig.csv population** (~100–150 rows) — blocked on mapping doc labels → engine `effect_action` keys; worth scripting (parser starting point: `scripts/merge-voice-rewrite.mjs`).
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
