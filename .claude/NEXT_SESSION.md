# Next session starter — written 2026-07-19 by /koniec

## State at handoff
- **Version:** v3.1.20 — committed + pushed, **pending deploy** (live is still v3.1.16).
- **Branch:** master, clean after this session's commits.
- **Last shipped:** dashboard reconciliation + 4 real fixes. Found `TODO.md` had drifted badly from the live feedback dashboard (28 reports showing "open" that TODO didn't track). Root cause: a 2026-07-01 staging draft was never applied, and 17 of those 28 had actually already been fixed weeks ago but never flipped resolved on the dashboard. Flipped all 17 (user-approved). Fixed and shipped the 4 genuine remaining bugs: PC blank-view-after-restart (v3.1.17), private card-picker leaking to the shared screen (v3.1.18), color picker silently reassigning your color instead of showing it's taken (v3.1.19), Share button unreachable on phones + missing from the per-player view (v3.1.20). Also fixed the root cause in the `/start` skill itself — step 4d now cross-checks CHANGELOG.md before proposing a report as new work.
- **Test suite:** fast suite 2376/2377 (1 pre-existing skip, 119s). Ghost gates: see wrap line below (was still running when this was written).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.1.20** — closes 4 real dashboard reports (fb:3a5280d8, fb:44751a06, fb:d6bbcb00, fb:2c848b47) once live; flip queue in `.claude/fixloop/flip-queue.txt`.
2. **Real-TV checks** — still outstanding from before this session: confirm the v3.1.2 camera feel (zoom stays put between moves) and the dark-mode slices, one trip to the TV.
3. **TVDisplay dark mode — needs your call, not a code fix.** Shared across-the-room TV screen: does it even want a dark toggle, and who operates it?

## Decisions waiting on the user
- **Board layout** — keep stock grid, or re-arrange in the editor (drag-save persists).
- **Bank/Investor/Lender character naming** — marinading. **Don't nudge.**
- **Homeowner violation mechanic** — needs its own design pass before engineering.
- **TVDisplay dark mode** — see top item 3.

## Flip after deploy
- fb:3a5280d8, fb:44751a06, fb:d6bbcb00, fb:2c848b47 — fixed in v3.1.17–3.1.20; PATCH resolved once that version is confirmed live (recipe in TODO.md "Dashboard PATCH recipe").

## Suggested first move
Deploy v3.1.20, confirm it's live, then flip the 4 queued fb ids. After that, the TV camera check (item 2) is the natural next step — it's been waiting since before this session.

## Suggested model for next session
Sonnet 5 — deploy handoff, a TV check, and whatever's next in the dashboard backlog (down to 1 genuinely unactionable report — "Can't add player," no repro). Nothing architecturally ambiguous queued.

## Reminders
- Deploy from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- The deploy's `git pull` will delete the server's copy of `.claude/settings.local.json` — expected and harmless.
- Dashboard PATCH-flip calls: issue one at a time, not in a shell loop — batched/looped external writes get blocked by the permission classifier even with prior approval (see CLAUDE.md TACTICAL).
