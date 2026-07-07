# Next session starter — written 2026-07-06 by /koniec, updated 2026-07-07 post-deploy

## State at handoff
- **Version:** v3.0.97 — **deployed and verified live 2026-07-07** (deployed bundle confirms `version:"3.0.97"`, `gitCommit:"cf596d3"`, matching HEAD exactly — no drift).
- **Branch:** master, clean (commit `141623b` code + `cf596d3` docs, both pushed).
- **Last shipped:** Flipped the classic/new player-panel toggle default to `'new'` (feature-complete since v3.0.85 but left opt-in) — closed 9 already-fixed bug reports for free. Re-triaged the rest of the open backlog against live behavior and fixed 7 more: movement-destination options hidden instead of grayed-out, End Turn silently blocked by an unsurfaced scope-gate error, a real parallel-systems-drift bug (Daily Permit leader-bonus reveal missing on the common auto-draw path), another real drift bug (5 PM-voiced spaces showing the wrong NPC's badge/portrait/voice), card-modal titles repeating the description, a bare "Activate" button, and "Return to Sender" silently no-op'ing with no target. Plus a maintainer decision recorded (keep spent life-events reviewable, not locked) and clearer join-by-code error copy.
- **Test suite:** 2332/2334 passing. 1 failure is the known `E2E-AllPaths.test.ts` concurrency flake — confirmed clean in isolation 3 separate times this session (different specific test times out each run under load; not a regression).
- **Build/typecheck:** build clean. Typecheck has **1 pre-existing, unrelated failure** in `tests/playtest/mailerRecipient.test.ts` (3× `'err' is of type 'unknown'` + 1 type-literal mismatch) — not touched this session, doesn't block build or runtime tests.

## Top 3 open items
1. **Live-verify the new-panel-as-default experience with a real multi-player game on production** — this session's fixes were verified via a mix of live browser testing (preview MCP) and unit tests pre-deploy, but never against a real production game with multiple real devices. The panel-default flip is the biggest lever this session pulled; worth confirming it looks right under real network conditions.
2. **Pre-existing typecheck error in `tests/playtest/mailerRecipient.test.ts`** — quick, isolated fix (3 `catch (err)` blocks need a type guard/cast, one test fixture uses an invalid literal). Should be a <15 min fix whenever someone's next in that area.
3. **The remaining "New-panel playtest" backlog is now much shorter and is genuinely all design/content decisions, not bugs** — modal chrome reorg (single close, "why this matters" position), a plan-examiner verdict modal, a bigger DOB/FDNY approval moment, newspaper copy rewrites (data-only), board-node/tile-discipline visual polish, and one maintainer question already flagged (fb:f6e100b7, "did the new view drop Action/Outcome text on purpose?"). See TODO.md's "New-panel playtest" section — every item left in it needs a judgment call, not more investigation.

## Decisions waiting on the user
- **Teacher password** — still needed to auto-capture the teacher edit-spaces screenshot (carried over from the Playtester Acquisition backlog). Otherwise the user captures it by hand.
- **fb:f6e100b7** ("New-view dropped Action + Outcome text") — the maintainer explicitly asked for the rationale on this one; needs your read on whether the new panel's "Where you are & why" (owner's-words only) is an acceptable simplification or a regression.

## Suggested first move
Play a real game against production (or ask a playtester to) to confirm the new-panel-as-default experience looks right live — headless preview and unit tests covered the logic, but nothing has exercised it under real multi-device conditions yet. If that feels premature, the typecheck fix (item 2) is a good 15-minute warm-up first.

## Suggested model for next session
**Sonnet 5.** Live verification + a trivial typecheck fix — no long-horizon or architecturally ambiguous work in the top 3. Raise effort to `xhigh` if the design-decision backlog (item 3) turns into an actual implementation session.

## Reminders
- Deploy runs from a **Windows terminal**, not WSL.
- **Verifying a live deploy's version:** the server's `/health` endpoint reports a generic `"version":"dev"` regardless of build — it does NOT reflect the actual deployed commit. To confirm what's really live, fetch the built JS bundle (find its filename from `index.html`'s `<script src="/assets/index-*.js">`) and grep it for the version/commit strings baked in via Vite's `define` (e.g. `grep -oE '"3\.0\.[0-9]+","[a-f0-9]{7,9}"' bundle.js`) — that's what the in-app version badge actually reads.
- This session verified fixes with a mix of live preview-MCP browser testing AND `GET`/`POST /api/games/:id/state` raw state injection (the "cheating state" recipe in CLAUDE.md TACTICAL) — injection can't simulate a real `awaitingChoice` MOVEMENT object (that's only set by `SpaceArrivalProcessor` on real arrival) unless you construct it by hand; see this session's PM-DECISION-CHECK tests in CardService.test.ts / the new SpaceArrivalProcessor.test.ts for the pattern.
- `docs/technical/ARCHITECTURE.md` is the correct path (the koniec skill file had it as `docs/core/` — fixed this session).
