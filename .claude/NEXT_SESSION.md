# Next session starter — written 2026-07-18 by /koniec

## State at handoff
- **Version:** v3.1.16 — **pending deploy** (last confirmed-live version is v3.1.10, 2026-07-18).
- **Branch:** master, clean (only `.claude/settings.local.json` local config uncommitted).
- **Last shipped:** an autonomous `/loop /fixloop` run shipped six versions in one continuous session. v3.1.11 root-caused the `npm test` "hang" — the ghost regression gates were silently in the fast dev config, not a deadlock; `npm test` now completes in ~99s, `npm run test:ghost` runs the gates separately. v3.1.12–14 gave `ChoiceModal`/`CardReplacementModal`/`CardDetailsModal` dark-mode support, all three following the `DiceResultModal` pattern exactly. v3.1.15 themed `BoardCanvas`'s genuine chrome only (canvas fill, tile surface, text) — phase/validity/status/player-identity colors deliberately stayed fixed. v3.1.16 added Chronicle inline scope-deltas and fixed a real pre-existing bug: the card-draw log formatter read the wrong field name, so its nicely-formatted output had never fired in production.
- **Test suite:** fast suite (`npm test`) 2357/2358 — 1 pre-existing skip, 0 failures. Ghost suite (`npm run test:ghost`) — see wrap line below (was still running when this was written).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.1.10 → v3.1.16** — six versions queued, none live yet. Deploy command below.
2. **TVDisplay dark mode — needs your call, not a code fix.** Audited 2026-07-18: it's a top-level route with no toggle UI ever reaching the shared TV device, and it spends most of PLAY phase showing the still-light-only board behind its chrome. Real question: does a shared, across-the-room TV screen even want a dark toggle, and if so who operates it? (Board itself, `BoardCanvas.tsx`'s ReactFlow spaces/edges, is a separate, still-untouched follow-up if you want the full board themed too.)
3. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding; the embedded browser can't play animated camera transitions, needs a 2-minute glance at the physical TV (can double as a deploy sanity check once v3.1.16 is live).

## Test failures to address
(Skip section if green — fast suite is green. Ghost suite result was pending at write time; check `.claude/ghost-history.jsonl` or re-run `npm run test:ghost` if unsure.)

## Decisions waiting on the user
- **Board layout** — keep the stock grid, or re-arrange in the editor (drag-save persists).
- **Bank/Investor/Lender character naming** — marinading. **Don't nudge.**
- **Homeowner starting scenario / violation mechanic** — needs its own design pass before engineering.
- **TVDisplay dark mode** — see top item 2 above.

## Suggested first move
Deploy is the highest-value next step — six versions including a real test-infra fix and a real production bug fix (the card-draw log formatter) have been sitting committed since 2026-07-18. Otherwise, the TVDisplay dark-mode design question (item 2) just needs a quick answer, or the real-TV camera check (item 3) is a 2-minute glance.

## Suggested model for next session
Sonnet 5 — the top items are a deploy handoff, a design-decision question, and a manual TV check; nothing architecturally ambiguous.

## Reminders
- Deploy command runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- Dark-mode coverage is now effectively done except TVDisplay + the raw board — every modal in the card-play flow respects the toggle.
