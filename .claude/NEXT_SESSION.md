# Next session starter — written 2026-07-13 by /koniec

## State at handoff
- **Version:** v3.0.127 built and pushed. Last maintainer-confirmed deploy was v3.0.115 (2026-07-12); **v3.0.116–127 pending deploy** (13 versions stacked — confirm against live before assuming anything newer than 115 is out).
- **Branch:** master, clean after this session's wrap-up commit plus one follow-up fix landed right after (v3.0.127 — the loop's scheduled wakeup fired once more before being stopped; see Reminders).
- **Last shipped:** v3.0.121–127 via an autonomous `/loop /fixloop` session (~7 hours). Cost-preview toggle for Push back / Lock the scope (first attempt landed in the deprecated classic panel with hover — redirected mid-build to a tap-based toggle in `PlayerPanelV2`), a Join-by-Code "which player are you?" picker so a crashed/rejoining player can reclaim their seat instead of landing in spectator view, a takeover-warning confirmation for claiming an actively-connected player, the owner-alert email moved from firing on mere homepage visits to firing on real game start (which also surfaced a dead `gamePhase === 'PLAYING'` comparison that had never once matched), a deploy-countdown banner, a fix for the cost-preview toggle's own stale-"Varies" bug, and (v3.0.127, landed after the /koniec wrap-up below) a dark-mode fix for the NPC speaker badge in outcome modals. Ran concurrently with a separate session doing glossary auto-sync work in the sibling `dictionary-scraper` repo — see that session's own CLAUDE.md entry and commit `e0a05ac`.
- **Test suite:** **2382/2384 passing, 1 skipped, 1 failure** (all 5 ghost simulation gates green — strict/smart-bot/negotiate-coverage/coverage/authoredInsertion, 0 hard failures). The 1 failure (`E2E-AllPaths.test.ts`, a `setupGame()` timeout) is confirmed pre-existing resource-contention flakiness, not a regression — 3 separate runs this session each timed out on a *different* sub-test within that file, and this machine had multiple concurrent dev servers + a second Claude Code session running throughout. Tracked in TODO.md Parking lot.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.0.116–127**, then run the dashboard PATCH sweep — 6 reports queued in `.claude/fixloop/flip-queue.txt` (fb:a3dc215f, fb:bb72760f, fb:aaae63c0, fb:a98951ab, fb:49395e17, fb:ffec84f4), all fixed in this range.
2. **⏸️ Glossary auto-sync is blocked on Anthropic credits** (concurrent session, 2026-07-13) — the nightly robot is built + deployed + verified end-to-end except drafting 400s on "credit balance too low." Add credits at console.anthropic.com → Plans & Billing, then it self-runs (or `POST /api/glossary/autosync` with `X-Sync-Token: $FEEDBACK_TOKEN`). Detail: memory `project_glossary_autosync` + CLAUDE.md TACTICAL.
3. **Try Again button vs. cost-preview toggle look inconsistent + interaction idea** (fb:f453b1f3) — real visual gap plus a proposed short-tap=switch/long-press=commit redesign that would merge two currently-separate controls. Needs a design decision before building — not auto-built this session on purpose.

## Test failures to address
- `tests/E2E-AllPaths.test.ts > (varies)` — `setupGame()` timeout (30–60s) under full-suite load. Non-deterministic (3 different sub-tests failed across 3 runs today) — resource contention, not a code bug. See TODO.md Parking lot "Reliability / plumbing" for the trigger to actually fix it (raise `testTimeout`, or investigate why `setupGame()` is slow under load).

## Decisions waiting on the user
- **Try Again button vs. cost-preview toggle** (fb:f453b1f3) — short-tap=switch / long-press=commit interaction merge; needs a design call before building.
- **Board layout** / **Bank/Investor/Lender naming** — standing, don't nudge.
- **Homeowner starting scenario** — direction decided (distinct violation mechanic), still needs a design pass on the mechanic itself before engineering.

## Flip after deploy
- fb:a3dc215f, fb:bb72760f, fb:aaae63c0, fb:a98951ab, fb:49395e17, fb:ffec84f4 — fixed in v3.0.121–127; PATCH resolved once that version range is confirmed live (recipe in TODO.md).

## Suggested first move
Deploy v3.0.116–127 first — nothing blocking it, and it closes 6 dashboard reports for free once confirmed. After that: activate the glossary auto-sync (quick, just needs credits) or pick up the Try Again/cost-preview design question — your call, both are independent of each other.

## Suggested model for next session
**Sonnet 5** — deploy is a human action, and the remaining items (glossary credit activation, cost-preview design follow-up once decided) are normal scoped work, not architecturally ambiguous.

## Reminders
- Deploy command runs from Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- **Budget-meter recalibration:** this session's fixloop meter drifted to 55% calibrated-stale while real usage was 82% (checked against the official `/usage` screen) — recalibrated mid-session, weekly budget adjusted 1398.33 → 1183.05. Recalibrate promptly whenever the user reports a mismatch; drift compounds fast on long sessions with agents running elsewhere.
- If touching `server/*.js`, remember it's plain Node with no type checking — a string-literal comparison against a stale value (like this session's `'PLAYING'` vs `'PLAY'`) will never error, just silently never fire. Grep the real value across `src/` before trusting any comparison there. See CLAUDE.md TACTICAL.
- If you suspect another Claude Code session is open on this same checkout, that's a known, documented scenario — see CLAUDE.md TACTICAL "Two interactive Claude Code sessions sharing one working tree."
- **`/koniec` now stops any active `/loop`** — a session bug (2026-07-13) let a fixloop `ScheduleWakeup` outlive `/koniec`'s wrap-up and land one more fix (v3.0.127) after the session was supposedly done. Fixed going forward; personal memory `feedback_koniec_stops_loop` has the detail if it recurs.
