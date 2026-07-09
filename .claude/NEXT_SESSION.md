# Next session starter — written 2026-07-08 by /koniec

## State at handoff
- **Version:** v3.0.99 — **pending deploy**.
- **Branch:** master, clean (wrap-up commit pushed).
- **Last shipped:** Two sessions in parallel. One shipped a foreign-IP text alert + admin kill switch + a read-only "👁️ Spectate" button in Admin Tools (removed the old unreliable ntfy.sh integration entirely, replaced with carrier-SMS + home-IP auto-detection). The other verified that work live in a real browser (both pieces work end-to-end), then re-verified the v3.0.98 board-editor drag-overlap fix with an actual mouse drag and found it silently didn't work — React Flow's drag-end settle event bypassed the overlap check — fixed and re-confirmed live. Also closed two backlog design questions: Expeditors now warn instead of silently wasting a partial day-reduction, and an "outcome modal doesn't show scope change" item turned out already resolved by earlier work (audit only). Full detail in CHANGELOG v3.0.99.
- **Test suite:** 2340/2341 passing, 1 skipped. 1 E2E test timed out under heavy parallel load from the ghost simulations; re-ran in isolation and passed cleanly (269ms) — confirmed not a regression.
- **Build/typecheck:** clean.

## Top 3 open items
1. **No plan-examiner verdict shown** — after a plan examination nothing surfaces the result; needs a genuinely new verdict modal (pairs with making DOB/FDNY approval a bigger moment). Not started.
2. **Host-to-player messaging** — no channel exists to send a message into a live game (companion to the new Spectate feature; also useful for remote-classroom teacher use). Needs its own design pass first: who can send, free text vs. presets, does it interrupt play.
3. **Bank/Investor/Lender have no character entry** — 6 board spaces still show phase-only labels. User is explicitly marinading on whether to invent names/colors — don't nudge, wait for them to bring it back up.

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** (see item 3) — parked at the user's request, no urgency.

## Suggested first move
Production `.env` still needs `ALERT_PHONE=3472604300` + `ALERT_CARRIER=tmobile` added before deploying (the ssh command was already given to the user this session) — confirm that landed, then deploy will pick up all of this session's work at once. After that, ask which of items 1–2 to tackle, since neither was prioritized this session.

## Test failures to address
(None — the one timeout was confirmed non-reproducing in isolation.)

## Suggested model for next session
**Sonnet 5.** Item 1 (plan-examiner verdict) is scoped new-feature work, not architecturally ambiguous. Item 2 needs a design conversation before any code — also well within Sonnet's range.

## Reminders
- Deploy runs from a **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- Two new CLAUDE.md TACTICAL entries this session worth knowing: a real Playwright multi-step mouse sequence (not `dragTo()`, not synthetic `dispatchEvent`) is how to actually verify React Flow drag behavior; and starting a second local dev server while another Claude Code session's is still running on the same repo can cause file contention on `./server/data/` — check `netstat` for a live process on 3001 before assuming a port conflict is stale.
