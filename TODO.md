# TODO - Game Alpha

**Last Updated:** June 28, 2026
**Status:** Beta — live in production; **v3.0.86 deployed + live 2026-06-26** (commit `6e017d7`)
**Current Version:** 3.0.86

---

## 📌 **IMPORTANT: Documentation Rule**

**✅ Completed tasks** → Move to `CHANGELOG.md` (and delete from this file — don't just check them off).
**📋 Active/Pending tasks** → Keep here
**🎯 Goals/Priorities** → Keep here

This file contains ONLY current and future work. For completed work, see CHANGELOG.md.

---


## 🎛️ **Change-legibility / companion / time-feel UX** (2026-06-23)
*Spec from the user's AI-research + Claude-chat merge, reviewed against the live code 2026-06-23. Engine/infra claims verified accurate (one emission point = `EffectEngineService`/`LogEffect`→`globalActionLog`; `emitAutoAction`/`subscribeToAutoActions` rails; `ResourceChangeEffect(TIME)` magnitude; REAL/TEMP via the `isCommitted` flag on every log entry; expeditor = E card; **NO float/critical-path model — confirmed absent, do not invent one**). The "spreadsheet" target = the **player-panel bottom tabs** ([ProjectLedger.tsx](src/components/player/sections/ProjectLedger.tsx) budget/actual/variance, [TimeSection.tsx](src/components/player/sections/TimeSection.tsx), [PlayerLogSection.tsx](src/components/player/sections/PlayerLogSection.tsx)) — NOT an imaginary data grid. The Log tab already renders `globalActionLog`, so the Chronicle is its upgrade. Must conform to the locked [player-panel-redesign.md](docs/design/player-panel-redesign.md) (teach-don't-dumb-down; one-screen no-scroll — but side panels / popup modals ARE allowed) and the NPC-speaker voice + glossary `TextWithTerms` rules.*

- [~] **P1 — Project Chronicle (event feed). FIRST SLICE SHIPPED v3.0.86 (2026-06-26, opt-in new panel).** The new panel now has a **"📜 History"** modal ([PlayerChronicleV2.tsx](src/components/player/PlayerChronicleV2.tsx)) — a committed-action timeline grouped by space, reusing the canonical pipeline (`getDisplayableLogEntries` → `isCommitted` + player-visible filter = REAL/TEMP-safe; `formatActionDescription`). **Still to build (the fuller P1):** inline **deltas** per entry, **click-an-entry-to-replay-its-highlight** on the relevant tab, a **TV-persistent** feed (not just an on-demand modal) via `NotificationService` selective subscription. *Acceptance (full): every committed work-change + expeditor add → exactly one feed entry with a delta, from the existing emission point.* (Also shipped alongside: **"📋 My numbers"** recall modal [PlayerNumbersV2.tsx](src/components/player/PlayerNumbersV2.tsx) — scope + work-packages-with-costs + money/time, fb:f028e262/cea108fb; and the **between-turns move popup**, fb:15499d9b. See CHANGELOG v3.0.86.)
- [ ] **P2 — Tab legibility (the change-blindness fix).** On the Ledger/Time tabs: **inline deltas** (▲/▼ + cause) fed by `ResourceChangeEffect` payloads, **row flash** ~2–3s then settle, **NEW/CHANGED badge** ~10s, **desaturate unaffected rows** ~2s so the changed one pops. *Acceptance: a change is locatable in <2s without scanning; deltas visible without opening details.*
- [ ] **P3 — Tiered work cards + diegetic vocabulary.** Tier-1 minor = silent → feed only (never pauses). Tier-2 = side card + soft cue + one-line plain-English impact. Tier-3 (Change Order / DOB Objection / Stop-Work) = a **permitting-document card** via `emitAutoAction` (same rail as `DiceResultModal`), skippable + logged, may pause ~1s. **Voiced through the NPC speaker + glossary `TextWithTerms`, NOT raw jargon pop-ups.** Each major card states the PM consequence in teaching terms. Expeditors stay **side-chip** (v3.0.81 phase chips); revisit "presence/avatar" later (parked below).
- [ ] **P4 — Time feel.** Duration-mapped transitions keyed off `ResourceChangeEffect(TIME)` magnitude (e.g. `<7d→0.4s`, `<30d→1.5s`, `<90d→2.5s`, `>90d→3.5s`); cost/overhead **ticks down** on long jumps (drive from `ResourceService` magnitude) = **plain days-proportional burn** (no float model). "Meanwhile…" time-debt summary after long jumps. Time cue rides the **Time tab + board progress**, NOT a Gantt. **Expose magnitude as a clean signal** a future building-site view could subscribe to — hook only, do not wire.
- [ ] **P5 — a11y + pedagogy pass.** Redundant coding everywhere (icon + shape + text; colorblind-safe; NO red/green as the sole helping/hindering signal; reduced-motion + muted parity). PM-consequence payloads on major cards. Session **debrief** built from the Chronicle's causal chain.
- [ ] **FLAG — audio is greenfield.** No SFX system exists (only `SpeechService` = TTS). Every sound cue = net-new infra → optional polish, last; always paired with a visual equivalent (a11y rule).
- [ ] **Polish (low): the between-turns move overlay is panel-scoped (v3.0.86).** [PlayerPanelV2.tsx](src/components/player/PlayerPanelV2.tsx)'s "You moved from X→Y" overlay sits at z-index 60 inside the panel card, so when you arrive at a space that immediately throws a full-screen result/routing modal (z~1000) the modal covers it. Accepted for v1 (the modal is the more important info). If wanted later: either lift the overlay above the modal layer, or suppress it when an arrival modal is queued so the two don't compete.

### Future enhancements (parked)
- [ ] **Gantt / schedule "today-line" view** — too detailed for now, but if teachers add enough construction-section spaces it may become relevant. Revisit then (user call 2026-06-23).
- [ ] **Expeditor "presence"** (co-located avatar / dashed causality link-line to the affected value) — the spec's "highest-value" idea, but it assumes a task-cell grid the data model doesn't have (expeditors are E-cards affecting *phases*, not entities pinned to tiles). Keep the side-chip for now; revisit after P1–P5 land, since expeditors are used heavily (user call 2026-06-23).

---

## 🧩 **Phase 4a — card insertion (teacher-authored spaces)** (2026-06-16)
*Built end-to-end on branch `phase-4a-card-insertion` (committed, NOT merged to master / not pushed / not deployed). Engine + endpoints + UI + LOOP ghost gate, all green (1658 + 226 + 6, typecheck + build clean). Design + audit trail in [TEACHER_LAYER_DESIGN.md](docs/core/TEACHER_LAYER_DESIGN.md). Tiers 4c/4d CUT. Remaining before this is production-ready:*

- [~] **UI redesign — player panel + scoreboard (user + design team). DESIGN LOCKED 2026-06-22 → [docs/design/player-panel-redesign.md](docs/design/player-panel-redesign.md); BUILD STARTED behind a classic/new toggle.** The locked doc captures the north star (teach-don't-dumb-down), the 5-zone panel model, every maintainer ruling (purpose elevated, green-dot first-visit hints, icon stats, tiny conditional approval diodes, glossary via existing `TextWithTerms`→side panel + quick dark-mode override, reworded negotiate, detailed cards + before→after outcome modals), the **hard no-ghost-buttons-in-light-mode rule**, the old/new toggle requirement, and the design-package bias watch-list. **Foundation + PLAYABLE panel landed (typecheck clean, off by default; VERIFIED LIVE in a real game 2026-06-22):** [panelTheme.ts](src/components/player/panelTheme.ts) (light/dark + version hooks), [PlayerPanelV2.tsx](src/components/player/PlayerPanelV2.tsx) (5 zones from real `Player`/space data; full manual-action/movement/dice/end-turn/negotiate wiring that **reuses** the classic handlers + `canEndTurn` rule — no logic drift), classic/new + light/dark toggle in [PlayerPanelWrapper.tsx](src/components/player/PlayerPanelWrapper.tsx), glossary dark-mode override in [DictionaryPanel.css](src/dictionary/components/DictionaryPanel.css) (gated on `html[data-uc-dark]`, set by the wrapper). Live verification drove real turns (manual + dice actions fire, result modals interoperate, counter→ready blue commit, green first-visit dot, player-language card counts, light/dark both readable) **and caught + fixed a dice-effect routing bug** (dice-type actions were sent to the manual handler; now routed to the dice handler like classic). **Increment progress (2026-06-23):** ✅ optional **E-card play from the influence zone** ([PlayerPanelV2.tsx](src/components/player/PlayerPanelV2.tsx) — playable Expeditors as Activate rows; gate+play via the canonical `cardService.canPlayCard`/`playCard` service rule, no drift). ✅ **detailed-card view** ([PlayerCardDetailV2.tsx](src/components/player/PlayerCardDetailV2.tsx) — §5 content model: type chip, key facts as icon rows, "why this matters" callout, Activate/Keep; reuses the proven ModalBase shell so the v3.0.71 backdrop-grace flash-close fix is intact; §10.1 document-variant seam; opened by tapping an expeditor's `ⓘ` name). +6 tests; typecheck+build clean; NOT yet live-verified (opt-in). Also folded the change-legibility UX layer into the lock doc as [§10](docs/design/player-panel-redesign.md). **⏸️ DEFERRED (user call 2026-06-23, option a): outcome-modal (before→after) restyle** — `DiceResultModal` is a SHARED, live-turn modal (triggered at `GameLayout` via AutoActionEvent, holds the flash-close fix), so it isn't toggle-isolated; restyle it in place ONCE the new panel is closer to default rather than risk the classic live experience now. ✅ **scoreboard ("who" screen)** built 2026-06-23 — design chosen by the user (phase-rail journey, soft positional standings, NOT a ranked race): [ScoreboardV2.tsx](src/components/player/ScoreboardV2.tsx) renders players as tokens on the permitting-lifecycle rail at their furthest-reached phase + a per-player status row (icon cash/days + approval diodes) mirroring the panel; light/dark, a11y redundant coding. Furthest-phase calc extracted to a shared pure helper [lifecycleProgress.ts](src/utils/lifecycleProgress.ts) (verbatim from ProjectProgress, so no drift) +7 tests. **WIRED INTO THE LIVE TV (v3.0.83, deployed `e4d956b`):** an opt-in **"📊 Standings"** button in the TV header ([TVDisplay.tsx](src/components/layout/TVDisplay.tsx)) toggles the scoreboard overlay (default hidden — live layout unchanged). Verified live in TV mode (button → overlay renders + positions correctly → close hides). **DONE:** [ProjectProgress.tsx](src/components/game/ProjectProgress.tsx) consolidated onto the shared helper (duplication killed, behavior-identical). **Next:** the deferred outcome-modal restyle (once the panel is closer to default) → later app-wide dark mode + glossary flat-style alignment. Vite serves /data from public/ so verify in the running app; new design is opt-in until confirmed feature-complete. (Original handoff package: `.claude/player-dashboard-variables.md` + `.claude/player-dashboard-context.md`; the referenced PDFs/screenshots folder are no longer on disk.) **Scope:** panel (PRIMARY) + scoreboard (shared-screen only) + board tweaks only; panel must fit one screen NO scroll on both surfaces; not a ranked race (soft positional standings).
- [ ] **Expeditor space: player expected a "read more" link for more info — NOT A BUG, it's a discoverability gap (fb:c240a14c, v3.0.82).** Investigated 2026-06-23: the classic panel's "read more…" ([ActionCenterPanel.tsx:616-661](src/components/player/ActionCenterPanel.tsx#L616)) is purely a **truncation toggle** that only renders when the story is **>200 chars** and only un-truncates the *same* text — it never reveals extra depth. This expeditor story is **157 chars**, so no link shows (whole story already visible) — working as designed. The real "more info" affordance is the **glossary**: "expeditor" is a glossary term ([glossary.json](src/dictionary/data/glossary.json#L515)) and the word in the story is tappable via `TextWithTerms` → opens the definition. **Real gap = the term-tap affordance isn't discoverable** (player didn't know the word was tappable). Fix lives in the panel redesign (make glossary terms visibly tappable + zone-3 "Read full story"), NOT a per-space data fix. Candidate to resolve on the dashboard as "expectation mismatch" once the redesign lands the affordance. <!-- fb:feedback-1782228532845-c240a14c -->
- [ ] **OPTIONAL (content, deferred): author real `effects_on_play` prose for the 74 E + 49 L cards.** Only worth doing if a one-line authored effect would add teaching value beyond the description + key facts already shown. Low priority — the detail view reads clean without it.

---

## 🚀 **Deploy infrastructure — teacher-layer gaps** (2026-06-13, HIGH)
*v3.0.76 went live 2026-06-13. The deploy + verification exposed two real bugs in the deploy/migration plumbing. Full context in CLAUDE.md TACTICAL "Deploy: `deploy.sh` is not teacher-layer-aware" + auto-memory `project_deploy_method`. Recovery tool sits at `server/data/recover-board.mjs` on the live server (`/app/data/recover-board.mjs` in-container) — harmless, clean up.*

- [ ] **Board layout decision (user)** — the maintainer's custom tile arrangement was lost ~June 12 (unrecoverable; confirmed absent from live CLEAN/SOURCE, classroom-1 config, pre-refresh backup, AND git). Current board = the stock grid (a real layout, committed in repo). **Decide:** keep the grid, or re-arrange once in the editor (drag-save now persists to classroom config) — only after `deploy.sh` is fixed so it survives.
- [ ] **Cosmetic: deploy stamps commit "unknown" on compose builds** — Alpine build container has no `git`; `deploy.sh` passes the real commit via `--build-arg GIT_COMMIT=$(git rev-parse --short HEAD)` so the canonical path is fine, but a `docker compose` build shows `unknown` + breaks the "N behind" badge. Non-issue if always using deploy.sh.

---

## 🚚 **Production data-deploy sync** (2026-06-09)
*Discovered 2026-06-09 spot-checking fb:931a55de: CSV **data** fixes in `public/data` don't reach the live server on deploy — it preserves its own writable `CLEAN_FILES` (see `project_data_deploy_gap` memory). Audit (live vs master) found 5 stale CLEAN files; only `pos_x`/`pos_y` (board layout) are genuine live user-data — everything else is un-propagated fixes.*

- [ ] **Broader implication:** any CSV *data* fix since the live volume was first initialized may also be stale-live. After the above, consider a one-time full live-vs-master audit of all CLEAN files (most already match — only these 5 diverged as of 2026-06-09).

---

## 🔧 **Build / dependency housekeeping** (2026-06-23, LOW)
*Two informational messages seen during the v3.0.84 `deploy.sh` build. Neither blocked the deploy or affects the running game — captured here so they're not lost.*

- [ ] **Build perf: `vite:terser` plugin is slow** — the build logged `[PLUGIN_TIMINGS] significant time in plugin vite:terser` (see https://rolldown.rs/options/checks#plugintimings). Cosmetic; minification just takes a while. If build time ever becomes annoying, consider swapping terser for esbuild minify (`build.minify: 'esbuild'`) and compare bundle size — not worth doing until it's a real pain.

---

## 🔐 **Security follow-ups** (2026-06-12, v3.0.72 session)
*The v3.0.72 hardening itself shipped (see CHANGELOG). These are the loose ends.*

- [ ] **Deploy v3.0.72** — the endpoint locks aren't live until deployed. Dashboard companion fix is ALREADY live (proxy sends FEEDBACK_TOKEN; Unraid stack has the env var). No game-server config needed.
- [ ] **dictionary-scraper stack: `ANTHROPIC_API_KEY` not set** — compose warns and defaults blank on every `docker compose up` (pre-existing, surfaced 2026-06-12). If the dashboard's AI features ever misbehave, this is why. Don't fix without asking the user whether it's intentional.

---

## 🆕 **Dashboard reports — Newly arrived (2026-06-14)** (v3.0.78)
*Maintainer's own first-contact testing of the just-shipped Phase 3 teacher/classroom UI (5 reports, 11:26–11:34) + one game-logic note (12:21). Swept in via /start 2026-06-14.*

**🔗 Phase 3 teacher-layer polish cluster — DONE; live since v3.0.78, resolved on dashboard 2026-06-22.** Server: `deleteInstance`/`removeAccountFromAllInstances` (instanceStore) + `deleteAccount` (accountStore); new endpoints `POST /api/instances` (teacher self-create, session-authed, auto-owned), `DELETE /api/instances/:id` (owner-or-admin, refuses classroom-1), `DELETE /api/admin/accounts/:id` (admin, releases the teacher's rooms). Client: TeacherClassroomPanel create+delete, ClassroomAdminPanel delete buttons, ClassroomBadge, inline lock reason. +tests (instanceStore 30, accountStore 15, endpointAuth 44, dataInstance 6); typecheck + build clean.

**Standalone (game logic):**
- [ ] **Known limitation — Q2 first-visit blind spot (low priority, maintainer accepted 2026-06-15).** `scope_changed_since_last_visit` compares scope to the *prior visit to this space*; on a FIRST FDNY-FEE-REVIEW visit there's no snapshot → defaults "no change". Benign in the normal flow (first fee-review visit immediately follows FDNY approval, nothing's changed yet) but could skip a needed FDNY review if a player got FDNY approval, changed scope, then reached fee review for the first time via an unusual loop. The sturdier fix is to snapshot scope at the moment FDNY approval is *granted* (an approval baseline, always present) instead of per-visit. Maintainer chose the simple per-visit version knowingly.

---

## 🐞 **Dashboard reports — 2026-06-11 playtest** (v3.0.70)
*Three reports came in 2026-06-11 against live v3.0.70 (gitCommit f1cfac7). Two real bugs (both FIXED v3.0.71) + one environmental.*

- [ ] **Environmental (no code bug): "play on Perplexity" load failure.** <!-- fb:feedback-1781190420890-5a155a1a --> Console showed `ERR_BLOCKED_BY_CLIENT` (ad-blocker / Perplexity in-app browser blocking a script) + `404 /api/games/G337/state` (stale/expired game id). Game wasn't broken — opened inside a resource-blocking embedded browser on an old link. **No fix required.** At most a friendlier "this game expired / open in a full browser" message — ties into the onboarding package already tracked (Top-3 #1). Flag-only.

---

## 🏫 **Teacher instance layer + space catalog** (design initiative, 2026-06-09 · **design approved 2026-06-12**)
*Source: user, after the data-deploy gap surfaced. Design session held 2026-06-12 — the user reframed it as a **"deck of cards" model** (master stock deck refreshed by every deploy; each classroom holds only its own used/unused markers, positions, teacher copies, and detours; no merge step exists, so nothing can ever be lost). Full spec with all 6 maintainer decisions: [docs/core/TEACHER_LAYER_DESIGN.md](docs/core/TEACHER_LAYER_DESIGN.md).*

- [~] **Phase 1 — Foundation**: CODE COMPLETE v3.0.74 (2026-06-12) — library/instance split, classroom-1 migration (idempotent + `npm run migrate:check` dry-run), stock auto-refresh on deploy, atomic bake + version gate, instance write tokens, drag-save rerouted. 131/131 server+board tests, live boot smoke verified. **Pending deploy** — the live Unraid server's board positions migrate into classroom-1 at first boot of this version (one-time; watch the boot log for the migration summary). *(The old "Apply latest updates" smart-merge button idea is obsolete — superseded by the no-merge model.)*
- [~] **Phase 3 — Multi-teacher front door**: DESIGN SETTLED 2026-06-12 (full accounts, admin-mediated — no self-signup, no email infra, admin resets passwords; ownership via `meta.owner`; games carry their classroom's instanceId, players unchanged; classroom-1 stays the public default). **Build gate CLEARED 2026-06-13** (Phases 1–2 live + verified, data-deploy gap proven dead). Login model decided 2026-06-13: admin-minted, hand-rolled thin layer over stdlib scrypt (no third-party auth — see CHANGELOG). Building in sub-phases:
  - [~] **3c — Client: per-instance data + login/picker UI** (in progress):
    - [~] **3c-2 — Teacher login UI + classroom picker** (UX DECIDED 2026-06-14: **one combined login** — admin password → admin view, teacher username+password → their classroom; admin manages accounts/classrooms inside 🛠️ Admin Tools):
  - [ ] **3d — Deploy + verify live** → unblocks Phase 4. (v3.0.78 ready to deploy; nothing live changes until a teacher account + classroom exist.)
- [ ] **Phase 4 — Card insertion**: teacher-authored spaces / "replace one card with several". Most invasive; last. **Gate (user-affirmed 2026-06-12): do not design until Phases 1–3 run successfully live.**
- [ ] **Post-deploy doc cleanup**: once v3.0.74+ is live-verified, mark the CLAUDE.md "CSV data fixes do NOT reach the live server" recipe fully obsolete (header already flagged) and update auto-memory `project_data_deploy_gap.md` (gap dead by construction).

---

## 💵 **Billing & usage reporting** (2026-06-22, LOW — later)
*Source: user, 2026-06-22. Now that teachers + classrooms exist (Phase 3 live), we'll eventually need per-school monthly bills with rudimentary usage reports — phone-bill style. Not urgent; build after the teacher layer has real users. Conceptually depends on Phase 3 accounts/instances being live; otherwise a separate concern from the gameplay/architecture work in the Teacher layer section above.*

- [ ] **Track per-user activity.** Capture, per teacher account: (a) **logins** — timestamp + session length; (b) **games played** — game-start events tied to the teacher's classroom, count + duration; (c) **spaces added** — teacher-authored insertions via Classroom Setup, count + which classroom. Persist alongside the existing account/instance stores; design the schema so a "school" = group of teacher accounts (new grouping concept — accounts today don't roll up).
- [ ] **Monthly billing + per-school usage report.** Roll the tracked activity up into a per-school monthly statement: which teachers logged in, how many games they ran, how many spaces they authored. Phone-bill style — itemized line items + total. Output as a downloadable report (PDF/HTML) from an admin screen, on a monthly cadence.

---

## 🧱 **Workstream 7 Follow-ups** (May 17, 2026)
*Minor items deferred during Workstream 7 (Plan Approval Mechanic). Shipping v2.65.0–v2.65.4 was the scope; these are post-ship polish.*

- [ ] **End-game penalty numbers (+30 days / +$50K) are pilot values** — locked from spec but not playtest-tuned. After 3-5 games where players actually trigger the missing-DOB end-game, tune `MISSING_DOB_PENALTY_DAYS` and `MISSING_DOB_PENALTY_FEE` constants in `src/services/ApprovalService.ts` if the penalty feels too harsh or too soft.
- [ ] **First-game tutorial moment for approval mechanic** — first time a player rolls at DOB or FDNY, consider showing a one-time intro modal explaining the badges and what approval state means. Currently they discover by reading the banner ("✅ DOB Plan Examiner: approved. Take it to FDNY next.") but a dedicated intro might help non-DOB-savvy players. Tie to the broader onboarding question already in TODO (`fb:0aa9660c`).

---

## 🧹 **Per-space hardcoding audit** (May 18, 2026)
*Source: in-session grep for `player.currentSpace === '...'` and related shapes. Workstream 6 swept this pattern aggressively (10+ lifts, see receipts in `DataService.ts:92-185`, `TurnService.ts:398/789/931`, `MovementService.ts:122/341/352`, `CardService.ts:1205/1250`), but new instances escaped or crept back in. Ordered by urgency.*

### Defensible domain constants (flag only, no immediate action)
- [ ] **`ApprovalService.ts:37,41,45,51`** — `DOB_EXAM_SPACE`, `FDNY_EXAM_SPACE`, `DOB_AUDIT_SPACE`, `DOB_FINAL_REVIEW_SPACE`. These encode real-world regulator-role mappings. Named constants are reasonable; lifting would matter only if an educator wants a non-standard examiner layout.
- [ ] **`ApprovalService.ts:64`** — `DOB_APPROVED_DESTINATIONS = ['REG-FDNY-FEE-REVIEW']`. Could be computed from MOVEMENT.csv when the DOB examiner space resolves.
- [ ] **`ApprovalService.ts:71-74`** — `AUDIT_TRIGGERED_FROM = ['CON-INITIATION', 'REG-DOB-PLAN-EXAM', 'REG-DOB-AUDIT', 'PM-DECISION-CHECK']`. Could lift to a `triggers_dob_audit` bool column.

### Not the failure mode (documentation, no action)
- Dynamic comparisons (`player.currentSpace === n.id` in iterations) at `MovementService.ts:213`, `BoardV3.tsx:162,193`, `SpaceExplorerPanel.tsx:93,351,360`, `BoardCanvas.tsx:373` — legitimate.
- `constants/characters.ts` + `SpeechService.ts:19,20` — speaker-identity / TTS voice profile map. Lift deferred as Phase 6.4 (see Audit-Recovered Items).
- `utils/boardLayout.ts` — already slated for deletion in Workstream 3 Phase D.

---

## 🎯 **Ghost win-rate tracking** (2026-06-04)
*Source: user wish at /koniec — "would love to eventually get to a 90% success rate" with the random bot. Today the strict gate floor is ≥36 wins (recalibrated v3.0.37 after life events activated, baseline ~39/50). Pre-life-events the bot hit 45/50 (90%) because life events did nothing. Goal isn't to game the floor — it's to use win-rate + avgTurns together as a casual-play balance signal across versions.*

- [ ] **Switch the minifier off terser → Rolldown native (Vite 8 hint, 2026-06-14).** Vite 8's Rolldown bundler flags `[PLUGIN_TIMINGS] significant time in vite:terser` — terser is now the slow legacy path; Rolldown's native (Oxc) minifier is much faster + drops the `terser` devDependency. **Must preserve the intentional [vite.config.ts:227](vite.config.ts) behaviors:** keep `console.*` (drop_console:false), drop `debugger`, strip `console.debug` (pure_funcs). Verify the native minifier exposes equivalents (debugger-drop yes; the `console.debug`-only strip may not map 1:1 — acceptable to lose that micro-optimization). ⚠️ **Bundle-affecting** — same rule as the Vite 8 upgrade: tests run vs source and won't catch a minifier regression, so verify via the next deploy's playtest. Low priority (build is still ~8s); bundle it with the next planned deploy, don't rush it. *(NOT a separate item from the ghost heartbeat below — both are 2026-06-14 follow-ups.)*
- [ ] **Ghost-run progress heartbeat (observability) — requested 2026-06-14.** The full suite ran **~52 min** that session (ghost `coverage` alone = 17 min, `ghostPlayer` strict+try-again the rest) and there was **no way to tell mid-run whether it was progressing or hung** — vitest swallows `console.log` on passing tests, and `.claude/ghost-history.jsonl` only writes once per batch (at the very end). Add a per-game (or every-N-games) heartbeat inside `runGhostBatch` ([ghostPlayer.ts](tests/ghost/ghostPlayer.ts)) that appends `{ts, test, gameIndex, total, elapsedMs}` to a tail-able file (e.g. `.claude/ghost-progress.log`) — `tail -f` then confirms movement, and a stuck game shows as `gameIndex` flatlining. Cheap: `appendFileSync`, same pattern as the existing `recordGhostHistory()`. Optional extra: a single-line overwrite file (`.claude/ghost-progress.txt` = `"strict 23/50 · 12m"`) for an at-a-glance check. *(This session we couldn't distinguish "still grinding the 50-game batch" from "hung" without inspecting the node process's CPU — the heartbeat removes that guesswork.)*
- [ ] **Ghost should flag soft-locks, not just crashes — `LOOP` detection (2026-06-14).** The v3.0.80 Prof Cert loop (player path-locked into Prof Cert, which never granted DOB approval → FDNY "no approval" → back to DOB → forever) slipped the gate because **a loop isn't a crash**: the game runs to the 300-turn cap and counts as a normal *loss*, which the win-floor's slack (≥36/50 → up to 14 losses) absorbs. The primary "0 hard failures" assertion only catches EXCEPTION/INVARIANT_VIOLATION. **Fix:** in `runGhostBatch` ([ghostPlayer.ts](tests/ghost/ghostPlayer.ts)), when a game hits TURN_CAP, scan its trail for a **repeating space cycle** (same 2–3 spaces over and over) and classify it as a distinct `LOOP` hard-failure instead of a quiet loss. Would have caught this immediately + any future soft-lock. Contained change to the test harness. *(Surfaced when the user asked "ghost test never caught this?" — the honest answer is the gate is crash-focused.)*
- [ ] **Honest read of the "90%" target.** Random bot ≠ casual human. Use win-rate + avgTurns TOGETHER: wins↑ avgTurns→ = easier ✓; wins→ avgTurns↑ = grindier ✗; wins↓ avgTurns↑ = harder+slower ✗. Don't chase wins by making the economy artificially easier if avgTurns inflates — that's "more wins but each game drags." Real balance signal is "wins go up while avgTurns stays flat or shrinks."
- [ ] **If pursuing 90% intentionally, the lever options are:** (a) easier economy (more starting money, gentler fees, more forgiving regulator dice — playtest-driven), (b) smarter ghost (different question — a smarter bot won't catch regressions a dumb bot would; tracked separately if pursued), (c) ship a tutorial / onboarding so casual players play closer to "smart bot" than "random bot." (c) is already in scope as the onboarding package (Top-3 #2). (a) is balance tuning; (b) is bot research — both deferred until win-rate history shows a sustained problem.
- [ ] **Game length is the live signal now — watch against the ~40 min class-period budget.** Deterministic smart-bot run: avgTurns=149, 40/50 games "long" (>60 turns), 3 grind to the 300-turn cap. Bot turns ≠ human minutes (the bot plays aggressively/randomly, so it takes far more turns than a guided student), so this is NOT yet a red flag — user's call: comparable games (Monopoly/Catan/Wingspan) run 60+ min and a class period is ~40 min, so current length is acceptable. **Trigger to act:** when a *real* playtest game runs past ~40 min, start trimming individual mechanics / space requirements to chop time (this is the lever, not win-rate). Until then, just track avgTurns across versions via `.claude/ghost-history.jsonl`. The 3 deterministic losses (grind to 300 turns) are the worst-case length tail worth a look if length tuning starts.

---

## 🧐 **External architecture audit** (2026-05-29)
*Source: external AI audit run by user. Each claim verified against the actual code before listing. Items dropped: a "Multi-path Click-to-Move Bug" claim that was a false alarm (executeMovement is only called from `TurnService.endTurn` — gated behind End Turn, no auto-fire path), and the "PM_VOICED_SPACES / ApprovalService constants / SPECIAL_NAMES" cleanup items (PM_VOICED_SPACES is the project voice contract; ApprovalService string constants are fine — the hardcoded **behavior** is the real debt and already tracked above; SPECIAL_NAMES is a fallback path that CSV `display_label_override` already supersedes).*

- [ ] **Unify TEMP/REAL state transactions with logging sessions into one turn-transaction model.** Structural debt surfaced by the Try Again log gap (closed symptomatically in v3.0.63 via `LoggingService.discardCurrentSession` mirroring `StateService.discardTempState`). Same shape as the movement-resolver debt above: two parallel systems (state TEMP/REAL + log exploration sessions) that both react to the same lifecycle events (turn start, Try Again, end turn), and any new rule has to be plumbed into BOTH or they drift. Today's symmetry is hand-coded — `tryAgainOnSpace` calls both `discardTempState` and `discardCurrentSession`; `startTurn` calls both `createTempStateFromReal` and `startNewExplorationSession`. The proper fix is one `TurnTransaction` boundary: begin/commit/discard at one call site, with state changes AND log entries bundled inside. Touches `StateService`, `LoggingService`, `TurnService`, and the integration test suite. Estimated 1–2 dedicated sessions. **DO NOT do casually — schedule alongside the movement-resolver merge above; both are the same architectural pattern and should probably be tackled together.**

### Parallel-systems audit — additional candidates (2026-06-04)
*Surfaced during the v3.0.63 retrospective ("any other place where we could combine similar situations?"). Each is the same shape as the two debts above: two systems answer the same conceptual question, hand-synchronized today, drift trap tomorrow. Investigate alongside the movement-resolver merge + state/log unify in the same architecture session — bundling lets us spot shared abstractions instead of three one-off fixes.*

- [ ] **NotificationService.notify + LoggingService.info — two "something happened" channels.** Most game events fire both: a toast via `notify` and a log entry via `info`. Adding a new event means hooking both. Forget one → toast appears but no audit trail, or log entry but no player feedback. Bigger refactor (touches every event call site) but the underlying shape is one bus: "an event happened, route it to toast + log + analytics + …" Worth scoping but probably not in the same session as the others — more callers, more risk surface.
- [ ] **`player.money` + `player.moneySources` denormalization.** Total tracked alongside source breakdown (`ownerFunding + bankLoans + investmentDeals + other`). Any code path that changes money has to update both. Pattern is slightly different from "parallel systems" — it's denormalized state — but the drift shape is identical (one updated, the other forgotten). Fix: make `money` a computed getter over `moneySources`, kill the stored field. Touches every money mutation. Probably the riskiest of this batch; do last or split into a separate session.
- [ ] **Three effect pipelines (SpaceEffects / DiceEffects / CardEffects).** All CSV-driven, all flow through different services. Separated today for legit reasons (different triggers, different timing) but conceptually they're all "apply an effect to the game." Worth investigating whether the three handlers can sit behind one `EffectExecutor` interface with trigger-type metadata, vs. staying as three parallel implementations. Lower priority than the others — no observed bug yet, just shape worth examining.
- [ ] **Mobile-tab-freeze TEMP-state-loss claim — needs a real repro.** External audit flagged this but the `visibilitychange` handler in [WebSocketSyncService.ts:114](src/services/WebSocketSyncService.ts#L114) already reconnects on resume ("THE phone-reliability fix"). What the audit specifically claims — that the conflict-resolution path silently discards mid-turn TEMP state when server version is ahead — is plausible but unverified. Don't act until a playtester reports an actual session where a phone-locked player came back to lost actions; then trace the reconcile path from there.

---

## 🔎 **Audit-Recovered Items** (April 30, 2026)
*Source: documentation audit — items that were quietly mentioned in deleted/trimmed docs but never landed anywhere actionable. Captured here so they aren't lost again.*

- [ ] **Turn Numbering System tests** — TESTING_GUIDE used to carry a 📋 PLANNED section with detailed test specs for `tests/services/TurnNumbering.test.ts` (game-round progression, turn-within-round cycling, global turn counter, multi-player rotation, log entry context, visibility filtering) plus `tests/components/GameLog.TurnHierarchy.test.tsx` and `tests/integration/TurnProgression.test.ts`. Spec was deleted from TESTING_GUIDE in the doc-trim pass — find it in git history (commit `3f8c14f`) if implementation gets picked up. Likely safe to drop entirely if turn-numbering UI hasn't surfaced bugs.
- [ ] **Phase 6.4 (Workstream 6 sub-lift): NPC voice profile** — Lifting `extractPrefix` + `CHARACTER_MAP` + `CHARACTER_PROFILES` to a per-space `npc_voice_profile` data flag. Touches 6 callers (5 components + SpeechService) including pure-utility functions. Scoped out in v2.58.0 because educator-added spaces fall back to narrator voice (acceptable degradation). Probably never lifted unless an educator complains — flagging here so the deferral is explicit, not silent.

---

## 🎯 **Current Priority: User Acceptance Testing**

### **Backlog**
- **Per-action confirmation modal — Two-Panel layout (POLISH phase, deferred)** — Redesign the per-action confirmation modal (the one that appears when you click "Draw W", "Pay Fee", etc.) to a two-panel layout: narrative on the left, mechanics on the right. Strongest separation of "why" vs "what". Reference mockup: [Mockups/story-mockup.html](Mockups/story-mockup.html) → Section 2 → Option C ("Two-Panel: Story | Mechanics"). User picked this over the mockup's recommended Option A (Tinted Blockquote). Caveats from mockup: cramped on phone — would need to stack vertically at narrow widths; narrative competes with mechanics for attention. Not blocking beta; tackle when polishing the modal system. (Section 1 of the mockup — landing-on-space accordion — was already shipped as v2.50.0, see Recently Completed below.)

- Story authoring rollout (post-v2.50.0) — Infrastructure shipped in v2.50.0; authoring is creator-driven (voice is creative, not just a deterministic transformation of a doc — see `docs/core/AUTHORED_COPY_REVIEW.md` voice rule "Per-action narratives stay ambient/narrator-from-above. Not bound by this rule"). Two ways to author:
  - **Live Data Editor** at `https://game.unravelcodes.com/admin` — fill in the `*_card_narrative` columns per (space, visit). Saves write through `processGameData` on the server and update CLEAN_FILES automatically.
  - **JSON + script (offline)** — write a file like `scripts/narratives-<space>.json` with `[{space_name, visit_type, column, narrative}]` entries, then `node scripts/set-narrative.mjs scripts/narratives-<space>.json && node scripts/regen-clean-files.mjs`. See `scripts/set-narrative.mjs` header for full usage.

  As of v2.60.0: 5 of ~75 card-effect rows have authored narratives (samples from v2.50.0 — OWNER-SCOPE-INITIATION/First/E, ARCH-FEE-REVIEW/First+Sub/L+E). Priority order from earlier triage: high-traffic REG/PM/ARCH/ENG first, then CON, then setup spaces. Legacy flat `Action`/`Outcome` blocks render wherever a space has no authored narrative on any effect, so rollout can be incremental with zero gameplay risk.

- Voice rewrite merge — Pass 1 shipped v2.60.0 (May 2026). Spaces.csv text fields (Title/Event/Action/Outcome/end_turn_label/try_again_label), the 2 Negotiate flag flips (REG-DOB-FEE-REVIEW Subsequent → NO; ARCH-INITIATION Subsequent → YES), and the 2 Subsequent-row deletions (OWNER-SCOPE-INITIATION, OWNER-FUND-INITIATION) all merged. CLEAN_FILES regenerated.

  **Pass 2 — ModalConfig.csv population (open).** The doc has `### Modals fired here` tables for ~50 spaces with `effect_action`/`modal_title`/`modal_description`/`modal_button_label`/`modal_summary` per modal. Blocked on a mapping pass: the doc uses human-readable labels (`"Take Owner's Money"`, `"Time: 1 day"`, `"e_card: Draw 3"`) whereas `ModalConfig.csv` keys by the engine's internal `effect_action` value (`add`, `draw_E`, etc., possibly with `dice_value`). Need to walk each space's `SPACE_EFFECTS.csv` rows, match doc-side modal entries to engine-side action keys, then generate ModalConfig rows. ~50 spaces × 2-3 modals each ≈ 100-150 rows. Worth scripting (see `scripts/merge-voice-rewrite.mjs` for the doc parser as a starting point).

- Educational "Learn More" content per space — Hidden educational field per space, revealed via a Learn More icon. Explains why the step exists, why it matters, and historical/regulatory context (NYC-specific: real DOB code sections, ZR citations, Triangle Shirtwaist → FDNY history, 1916 zoning resolution backstory, etc.). Separate "field guide" instructional register from the in-character NPC voice — clicking Learn More gets a teacher, not a character. Constraints to lock before authoring: (a) one paragraph default (~200 words), max ~500 for spaces with rich history; (b) every fee/rate/code claim sourced to nyc.gov / ZR / NYC Admin Code; (c) footer disclaimer ("educational, not legal advice — verify current rules at nyc.gov"). Author a 2-space calibration sample (suggest REG-FDNY-PLAN-EXAM with the Triangle Shirtwaist hook + BANK-FUND-REVIEW for contrast) before scaling to all ~50 spaces. Separate workstream from the voice rewrite — do not block v2.51.0. Target version TBD — content authoring + reading UI; not blocked by engine-data separation work.

- **Data storage format (CSV → JSON / per-space markdown)** — DEFERRED pending engine-data separation. Originally framed (in a lost prior chat) as "convert CSVs to per-space JSON to support educator editing and multi-tenant overrides." Re-analysis 2026-04-26 found that file format is mostly orthogonal to the actual needs — the blocker is engine-data separation (above), not file format. Once engine is fully data-driven, format choice becomes a question of editor ergonomics + multi-tenant override storage. Current bet: per-space markdown-with-frontmatter (mechanics in YAML frontmatter, prose body for narratives + Learn More) is the natural fit, but defer the decision until Phases 1–2 of engine separation reveal the full data shape. Do not migrate now.

- **Multi-tenant catalog (educator licensing + contribution model)** — DEFERRED pending engine-data separation + format decision. The vision: schools license the game, edit data/spaces for their context, and contribute changes back to a shared catalog so other schools can adopt them. Implementation likely needs: (a) backend storage for tenant edits (database, not flat files), (b) auth + tenant identity, (c) override layer (tenant edits as patches over base content), (d) publish/curate workflow (auto-share or moderated catalog?), (e) editor UI tenant-scoping. None of this is file-format-driven — works with CSV or JSON or markdown. Real prerequisite is engine-data separation: educators must be able to edit *all* of a space's behavior via data before tenant overrides become meaningful.

- **Editor UX redesign (POLISH phase, deferred)** — Current editors (SpaceEditor, ModalConfig expanders, DiceRollEditor, BoardLayoutEditor) work but are *crude and too complicated* for non-technical authors. The visual direction is captured in [Mockups/editor-mockup.html](Mockups/editor-mockup.html) — a three-mode tabbed editor that splits one space's data by **author intent**, not by underlying CSV shape: **📖 Story** (Title, Event, Action, Outcome, button labels) with a live player-preview pane on the right; **🔀 Flow** (read-only map of how this space connects to others — edit connections in Mechanics); **⚙️ Mechanics** (dice rolls, card effects, payments, movement destinations). Every field gets a plain-language label + inline hint ("Action — what the player needs to decide or do"), dirty-state indicators per mode, a "Reset to Baseline" undo, and friendly cross-references ("Need to change what this space does? Use Mechanics tab"). Live preview shows exactly what students will see. This is the umbrella redesign — the **Game Card editor** item below is the same spirit applied to the card decks, and would slot in as a 4th editor surface under the same UX. Don't refactor the data layer for this — purely a UI/UX pass over the existing editor components. Pre-req nudge: would benefit from the engine-data separation work being further along so the editor isn't fighting hardcoded engine assumptions.

- **Game Card editor** — we have a Space editor ([SpaceEditor.tsx](src/components/editor/SpaceEditor.tsx)), per-action Modal editor (ModalConfig expanders inside SpaceEditor), Dice-roll editor ([DiceRollEditor.tsx](src/components/editor/DiceRollEditor.tsx)), and Board-layout editor ([BoardLayoutEditor.tsx](src/components/board/BoardLayoutEditor.tsx)) — but **no UI for the card decks**. `CARDS_EXPANDED.csv` (W/B/E/I/L) is hand-authored and edited directly, which is exactly how the v3.0.34 draw/discard column-swap + missing-type bugs shipped (12 cards drawing the wrong type). A card editor should: edit per-card fields by **labeled control, not raw column** (draw vs discard as separate pickers, card-type dropdown so "1 E" can't be typed as bare "1", tick_modifier as a +/− day stepper, conditional `card_mechanic` as a dropdown); **show the `cardTextMatchesColumns` integrity checks inline** so a description/behavior mismatch is caught at author time, not in a playthrough; round-trip through the same `_extraColumns` + multiline-aware CSV path the space editor uses ([csvExport.ts](src/components/editor/utils/csvExport.ts)) so unknown columns survive. Note `CARDS_EXPANDED.csv` is NOT pipeline-generated (no SOURCE→CLEAN step) — the editor writes it directly. Scope TBD; biggest win is closing the "author a card that lies about its effect" gap permanently.

*For full history, see CHANGELOG.md*

---

## 🐛 **Open Feedback (Dashboard May 2026)**

*Source: `/api/feedback` endpoint, 40 unresolved as of May 15 PM. Below are the ones NOT already fixed in shipped code; the server-side `resolved` flag still needs to be flipped on resolved items (admin task — see Server-side housekeeping below).*

### Session follow-ups (2026-05-28, not yet shipped)
- [ ] **HTTP polling fallback while disconnected** — v3.0.24 relies on WebSocket reconnect + server's subscribe-pushes-state. If push reliability proves worse than expected in real play, add a low-frequency `GET /state` poll while `connectionState !== 'connected'` as a belt-and-suspenders catch-up. Only build if reconnect alone proves insufficient.
- [ ] **Mandatory-phone-connect override for TV mode** — v3.0.25 hard-blocks Start until all phones join. For solo demos / testing the host may want a "Start without all phones" escape. Deferred per session decision (hard-block chosen); add if it gets in the way.
- [ ] **Cross-device bug capture (TV pulls phone logs)** — already tracked under "Bug reporter improvements" below as Ship B. The v3.0.24 fix reduces (but doesn't eliminate) the "phone crashed, can't report" dead-end — a phone that fully crashes still can't push. Still worth doing.
- [~] **Dashboard PATCH sweep** — **2026-05-28: flipped 7 already-fixed reports** (`58a2112b`, `dfdeaf1c`, `41e35769`, `97fa9c75`, `96317d74`, `cc345da9`, `3483b37b`) → dashboard 34→27. **Still to flip after their deploys confirm:** `fb:068a66f2` (fixed v3.0.33, needs two-device playtest first), `fb:c7312a0a` + `fb:f7312d82` (v3.0.24 phone-reconnect, verify on next multi-device game), and the v3.0.22–27 voice/board items if not already flipped (`adbc48b0`, `1aad6035`, `5dc01203`). Recipe: `PATCH https://game.unravelcodes.com/api/feedback/<id>.json` body `{"resolved":true}` (`.json` suffix required; endpoint is NOT token-gated).

### Newly arrived (2026-05-27 — v3.0.19 playtest)
*3 reports filed 2026-05-27 00:31–00:36 UTC, all against v3.0.19 (gitCommit `ccfb028`) — same first-playtest of the v3.0.19/v3.0.20 deploy. Items are independent in nature (voice / UI desync / browser-extension noise) so they ship as separate fixes.*

- [~] **Phone crashed mid-game; couldn't grab phone console; TV console showed 4× Chrome extension async errors (likely noise)** — **Partially addressed v3.0.24.** The "won't reload / silent disconnect" half is the WebSocket-freeze root cause, now fixed (reconnect on `visibilitychange`). The TV-side errors are benign Chrome extension noise. The remaining open half is structural: a phone that *fully* crashes still can't file a report — that's the cross-device pull (Ship B in Bug reporter improvements). Verify the reconnect fix on next playtest, then this can close. <!-- fb:feedback-1779842188438-f7312d82 -->

### Bug reporter improvements (2026-05-27, user-direct)
*Not from the dashboard — flagged by user this session after the phone-crash report (`fb:f7312d82`) where the only device that could file a bug report was the device that died.*

- [ ] **TV bug-report button can pull info from connected phones** — when a phone crashes, its bug button dies with it. Mitigation: each phone pushes its log-buffer to the host (TV) on every WS heartbeat. When the TV's bug button is pressed, the report bundles TV console + most recent buffer from each connected phone. Phone-side capture survives crash if it pushed before the crash. Architectural note: doesn't help against instant runtime death — heartbeat cadence is the floor on data loss. Suggested: heartbeat-piggyback every ~5s; capture the last ~50 entries per phone.

### Player audit (G166 playtester, 5-12)
*Design-level feedback, not bugs. Treat as a sprint or a workstream once a target audience decision is made.*
- [~] **Onboarding for non-DOB-savvy players** — too many systems on first screen (expeditors, W cards, scope locking, Fit, money, time). Decision made: newcomer-friendly gradual reveal. **Phase A shipped v2.70.5** — existing 264-term dictionary made discoverable (solid blue underline + ⓘ marker + one-time onboarding toast). **Phase C deferred** — plain-English aliases for short labels (space tiles, button text). ~4 hr when revisited; needs user to write the alias strings. <!-- fb:feedback-1778583921001-0aa9660c -->
- [~] **Jargon / single-letter card types** — Phase A (v2.70.5) made the existing dictionary more visible; Phase C (deferred) would add `display_label_plain` to GAME_CONFIG so tile/button code can swap "Prof Cert" → "Hire a Professional to Sign Off" when newcomer mode is on. See above. <!-- fb:feedback-1778584099671-8ad42b52 -->
- [~] **Plain-English outcome after each action** — **Pass 1 shipped v3.0.44.** Captured live log via chrome-devtools MCP on deployed v3.0.43, found 6 cryptic strings still leaking engine IDs/programmer-speak. New `friendlySpaceName` + `friendlyCardName` helpers in [logFormatting.ts](src/utils/logFormatting.ts); 6 producers updated (TurnService, MovementService, EffectFactory, SpaceArrivalProcessor, CardEffectHandler ×2, FinancialEffectHandler). Raw IDs stay in `details` field for the future post-game viewer to search/filter on. The original "Fit+6 %Scope Initiation" pattern from the report is no longer reproducible in current code — the buttons (DICE_BUTTON constants) and card-draw entries (getCardTypeName) were already humanized in earlier sweeps; this pass closes the remaining log-feed strings. **Two follow-on versions agreed:** v3.0.45 = expandable log rows (chevron toggles raw detail); v3.0.46+ = end-screen export prompt + post-game viewer with search & filter. Both tracked as separate entries below. <!-- fb:feedback-1778583987830-91738221 -->
- [ ] **Expeditor mechanic — pick instead of "hire 3"** — Game-design suggestion: let player pick among expeditors with tradeoffs (cheap/slow, fast/expensive, specialist/generalist). Bigger change; deferred. <!-- fb:feedback-1778584030168-f22035af -->

### Workstream 3 Phase B+ (board editor)
- [ ] **G160 / 5-9: show/hide individual connectors + redirect per section** — Admin asked for control over which edges render and how they route. (In progress: see Workstream 3 Phase B+ in BETA_PLAN_V3.md — global show/hide first; per-edge hide and waypoint redirect TBD per user approval.) <!-- fb:feedback-1778327469678-d27a73d0 -->

### Phase 2 polish (deferred, low priority)
- [ ] **Per-NPC rich sentence templates for dice summary** — v3.0.6 ships `"The Owner: You took on 2 work packages."` (attribution + standard verb phrase). User's wished phrasing is `"I'm wiring you funds — that buys two work packages."` (NPC speaks in first person about THEIR action, with PM as object). Would need per-NPC × per-effect-type sentence templates with count interpolation (~30-40 authored sentences). Authoring-heavy; revisit if the attribution form feels too thin in playtest.
- [~] **Adopt `{fundingAmount}` token at other funding spaces — partial 2026-05-29.** Added to BANK-FUND-REVIEW Subsequent and INVESTOR-FUND-REVIEW Subsequent rows (in both SOURCE Spaces.csv and CLEAN SPACE_CONTENT.csv). Used running cumulative source total. **Skipped:** First-visit Event for these spaces (amount=0 at read time, would render empty); LEND-SCOPE-CHECK Subsequent (dialogue doesn't take an amount naturally). Outcome-column adoption would need `spaceOutcome` to also be run through `interpolateTemplate` ([ActionCenterPanel.tsx:302](src/components/player/ActionCenterPanel.tsx#L302) currently only interpolates `spaceStory`) — small follow-up if author wants Outcome to cite the amount.

### Dependency major-version jumps (deferred 2026-05-29)
*Captured during the post-v3.0.39 hygiene pass. `npm audit` returned 0 vulnerabilities. `npm update` ran the safe minor/patch bumps (1536/1536 still green, typecheck clean, push pending). These five need explicit review — major-version semver, may break tests/build silently.*
- [ ] **TypeScript 5.9.3 → 6.0.3** — newly released major. Risky for a strict-typed codebase; expect a wave of stricter checks (function bivariance, narrowing changes). Suggest waiting 1-2 months for the ecosystem to settle, then attempting on a branch.
- [ ] **Vite 7.3.3 → 8.0.14 + @vitejs/plugin-react 5.2.0 → 6.0.2** — together; plugin major usually paired with host major. Check breaking-change notes; check our `manualChunks` config still parses.
- [ ] **ESLint 9.39.4 → 10.4.1 + @eslint/js 9.39.4 → 10.0.1** — flat-config era; we're already on flat config so the surface area may be small. Try after Vite/TS settle.
- [ ] **jsdom 27.4.0 → 29.1.1** — could shake out test-side `location`/DOM behavior; would re-test our `forksFiles` jsdom workarounds.
- [ ] **playwright 1.57.0 → 1.60.0** — minor under the version mask but the project is in active flux; do alongside any Playwright-driven test work.

---

## 🖥️ **Dashboard UI follow-ups**

- [ ] **Surface `version` + `gitCommit` on bug-report list/detail pages** — v2.70.2 stamped reports with deploy version (game side) and surfaces them at top-level on `/api/public/feedback/open` (already consumed by `/start` briefing). The dashboard at `dashboard.unravelcodes.com` (separate repo: `D:/Unravel/dictionary-scraper/dashboard/frontend/dashboard-ui/`) doesn't yet render either field. ~15 min change: extend `FeedbackReport.metadata` interface in [feedback/page.tsx](D:/Unravel/dictionary-scraper/dashboard/frontend/dashboard-ui/src/app/feedback/page.tsx) (and the `[id]/page.tsx` detail view), render a small `v2.70.2`-style badge per report. Optional: color-code against "current production version" so stale reports go gray. Optional+: filter dropdown for "show reports from version X or older". Data is already flowing; this is purely display.

---

## 📱 **External Testing & Public Release**
*Reframed April 30, 2026 — the prior "Phase 3B / Phase 5 NOT STARTED" framing was misleading because the game has been live at https://game.unravelcodes.com since December 2025. The items below are what's still genuinely open.*

### Open
- [ ] **Recruit 3–5 external players** for a structured UAT pass against v2.58.0 (now that Workstream 6 is closed). Prior internal/playtest UAT happened informally; this is the structured one.
- [ ] **Compile post-Beta feedback report** — currently no rolling channel for player-reported issues other than the in-app feedback button. Decide if the existing `/api/feedback` flow is enough or if we need a triage cadence.
- [ ] **Bug-fix sprint after structured UAT** — placeholder for whatever surfaces.

---

## 🔬 **April 2026 Deficiency Review — Forward Plan**
*Source: Consolidated review (Apr 16, 2026). Tier 1 shipped in v2.47.1. Tiers 2–5 remain.*

### Tier 3 — DI graph cleanup (revised Apr 17, 2026)
*Original framing was "split every service > 600 lines + eliminate all setter injection." Revised after an April 17 audit determined both targets were largely cosmetic. See `docs/core/BETA_PLAN_V3.md` Workstream 4 for the full rationale. **Do not resurrect the 600-line target.***
- [ ] **Service decomposition — deferred pending concrete pain signal.** TurnService (2,076 lines), StateService (1,867), CardService (1,824), EffectEngineService (1,477), MovementService (1,078), PlayerSetup.tsx (1,126), GameLayout.tsx (1,022) are all large but stable. Do not split on size alone. Split only when (a) a specific method becomes painful to edit, (b) a bug hot-spot clusters in a specific region per `git blame`, or (c) AI context cost on a specific workflow becomes a documented problem.

### Tier 4 — Type safety pass
- [ ] **Bucket E — intentional / leave as-is (~15 sites).** `error: any` catch blocks (5× — idiomatic, TS lets you throw anything), `consoleCapture args: any[]` (matches native console signature), `EffectFactory.validateCard(card: any)` (type guard input is supposed to be loose), `(window as any).opera` (legacy browser check), `configCache as any[mode]` (dynamic index access), `ChoiceService reject: (reason: any)` (Promise reject standard), `StateTypes details?: Record<string, any>` open-bag metadata, `DataTypes.effectData: any` (deferred payload union), 2× `null as any` in TurnStateManager TEMP state clearing. **Documented as intentional. Not blocked on typecheck.**

### Tier 5 — Remaining Beta workstreams (blocking v3.0.0 ship)
- [ ] **Workstream 2 ship gap: snapshot Try Again must replace REAL/TEMP entirely** per BETA_PLAN_V3 success criterion. Currently REAL/TEMP coexists with `TurnCostLedger`; v3.0.0 criterion is technically unmet. Decide: tighten the criterion (current implementation is good enough), or do the replacement.

---

## 🛠️ **Workflow & Deployment DX** (Backlog — STALLED)
*Flagged April 30, 2026: these 5 items have sat un-picked since they were added. They're nice-to-have but nothing blocks them. Decision needed: pick up, drop, or accept as standing low-priority.*

### Deployment Automation
- [ ] **Webhook Deployment** — Set up a webhook receiver on Unraid to trigger `deploy.sh` via HTTP, enabling "push-to-deploy" from GitHub or local CLI.
- [ ] **Persistence Protection** — Verify `deploy.sh` backup/restore logic for `game-data/` works correctly with Docker volumes.

### Context Management
- [ ] **GEMINI.md setup** — Create project-level `GEMINI.md` with explicit server paths (`/mnt/user/appdata/Game_alpha/`) and SSH commands to minimize research turns.

---

## 🚀 **Deployment Status**
- **Production URL**: `https://game.unravelcodes.com` (Port 3080 on Unraid)
- **Current Version**: v2.63.2
- **Last Deploy**: see git log / `docker logs game_alpha` for live build
- **Status**: Stable

---
