# Product Charter — Unravel Codes: The Game

**Status:** Beta (v2.63.2) — live at https://game.unravelcodes.com
**Last Updated:** May 6, 2026

## Mission

Unravel Codes is a multi-player turn-based board game that simulates the NYC construction project-management process — from owner scope-setting through architect/engineer design, regulatory review (DOB, FDNY, DCP), construction, and finish. Players take the role of project managers competing to complete their projects under real-world constraints around scope, money, time, and regulatory paths.

The game is designed to be playable both for entertainment and as an educational tool — schools and educators can edit per-space behavior via CSV data files (Workstream 6 invariant: engine is generic, all per-space variation lives in data).

## Core Mechanics

- **5 card types**: W (Work), B (Bank Loan), E (Expeditor), L (Life Events), I (Investor Loan)
- **Resources**: money, time spent, project scope (computed from W cards)
- **Phases**: SETUP → DESIGN → REGULATORY → CONSTRUCTION → FINISH
- **Multi-player effects**: cards that target other players, requiring negotiation
- **Try Again**: snapshot-based retry on negotiable spaces, with cost-ledger semantics (money paid sticks, cards drawn revert)
- **Multi-device play**: each player on their own device via QR code; HTTP + WebSocket sync

## Settled decisions (one line each; moved from TODO.md on 2026-10-13, full wording in [docs/archive/TODO-full-2026-10-13.md](../archive/TODO-full-2026-10-13.md))

- **2026-09-03 - the game is for broader players and beginners, not insiders.** Help is plain words, tooltips and story, not insider edge cases.
- **2026-09-16 - the game stays as is; do not re-open "push back hides its cost" a third time.** The cost already shows on a short press (`TurnCommitControl.startHold` reveals the bubble on pointer-down). The robot's push-back loops are a harness-side matter (Jarvis session).
- **2026-09-17 - a confirmed helper (expeditor) swap is not undoable** (fb:9e31b860).
- **2026-09-19 - no new tutorial or tip layer.** One help look for the whole game, voiced by one recurring mentor; reuse existing wording. **2026-09-26: the mentor is Ruth, the icon a handbook (a spellbook for a fantasy reskin).** Not built yet.
- **2026-10-02 - answered and built (CHANGELOG v3.2.91-98):** push-back = 0.5% of scope + 5 days and the quote comes back; the 20% design-fee cap and bankruptcy are checked once, at End Turn; scope = a dice-picked project type with {project} blanks; glow all game; the "?" sits inside outlines; the screen-size button lives in the header; one-colour header.
- **2026-10-03 - a screen's type (PC / TV / phone) is remembered per device and stays ON by default; Remote is per game and never remembered** (v3.2.97). The 30-student class scenario is back-burnered until there is a real class and date.
- **2026-08-25 / 2026-09-19 - no group/school tier in the card library;** a teacher writes an `individual` card; the approval queue stays deferred.
- **2026-08-02 - the old leaked PixelLab key stays in git history** (it is dead; a purge is not worth the disruption).
- **2026-07-12 - a full TurnCostLedger replacement of REAL/TEMP was declined** (audited: no bugs from the overlap, 83 call sites). Revisit only if Try Again must keep a 4th kind of sticky outflow.
- **2026-06-15 - the first-FDNY-visit "scope changed" blind spot is accepted** (`scope_changed_since_last_visit` has no snapshot on a first visit).
- **2026-09-01 - the engagement-data verdict was retracted:** solo games are Tom's own testing, so those stats cannot judge the D&D skin (see DND_RESKIN_EXPERIMENT.md).
- **2026-10-12 - Town A3 closed by Tom on the real TV** (names readable from the couch; walk 1.5 s; Town is the default, chosen on the setup screen). **TV news cards: parked ("lets wait").**

## Where to Look

- **Strategy & open work:** [TODO.md](../../TODO.md), [BETA_PLAN_V3.md](./BETA_PLAN_V3.md)
- **Architecture:** [ARCHITECTURE.md](../technical/ARCHITECTURE.md)
- **Per-version history:** [CHANGELOG.md](../../CHANGELOG.md)
- **User-facing changes:** [RELEASE_NOTES.md](../user/RELEASE_NOTES.md)
- **Settled decisions since 2026-06:** the section above.
- **Foundational decisions:** [docs/archive/HANDOVER_REPORT-20251003.md](../archive/HANDOVER_REPORT-20251003.md)
