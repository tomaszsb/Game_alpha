# Next session starter — written 2026-07-19 by /koniec

## State at handoff
- **Version:** v3.1.20 — **deployed + confirmed live 2026-07-19** (bundle-verified: `v3.1.20 · 47c88a7`).
- **Branch:** master, clean.
- **Last shipped:** dashboard reconciliation + 4 real fixes. Found `TODO.md` had drifted badly from the live feedback dashboard (28 reports showing "open" that TODO didn't track). Root cause: a 2026-07-01 staging draft was never applied, and 17 of those 28 had actually already been fixed weeks ago but never flipped resolved on the dashboard. Flipped all 17 (user-approved). Fixed and shipped the 4 genuine remaining bugs: PC blank-view-after-restart (v3.1.17), private card-picker leaking to the shared screen (v3.1.18), color picker silently reassigning your color instead of showing it's taken (v3.1.19), Share button unreachable on phones + missing from the per-player view (v3.1.20). Deploy confirmed same day — flipped those 4 too. Dashboard open count: 28 → 7. Also fixed the root cause in the `/start` skill itself — step 4d now cross-checks CHANGELOG.md before proposing a report as new work.
- **Test suite:** fast suite 2376/2377 (1 pre-existing skip, 119s) + ghost gates 33/33 (all four 50-game batches passed, 0 hard failures, 597s).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Real-TV checks** — still outstanding from before this session: confirm the v3.1.2 camera feel (zoom stays put between moves) and the dark-mode slices, one trip to the TV.
2. **TVDisplay dark mode — needs your call, not a code fix.** Shared across-the-room TV screen: does it even want a dark toggle, and who operates it?
3. **Dashboard backlog is down to 7 open reports**, only one of which is actionable right now ("Can't add player" — no repro, needs more detail from whoever filed it). The other 6 are either Parking-lot items (deliberately deferred) or need a maintainer decision.

## Decisions waiting on the user
- **Board layout** — keep stock grid, or re-arrange in the editor (drag-save persists).
- **Bank/Investor/Lender character naming** — marinading. **Don't nudge.**
- **Homeowner violation mechanic** — needs its own design pass before engineering.
- **TVDisplay dark mode** — see top item 2.

## Suggested first move
Nothing time-sensitive is queued — the TV camera check (item 1) is the natural next step since it's been waiting the longest, or pick anything else from TODO.md.

## Suggested model for next session
Sonnet 5 — a TV check and whatever's next in a mostly-clean dashboard backlog. Nothing architecturally ambiguous queued.

## Reminders
- Deploy from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- The deploy's `git pull` will delete the server's copy of `.claude/settings.local.json` — expected and harmless.
- Dashboard PATCH-flip calls: issue one at a time, not in a shell loop — batched/looped external writes get blocked by the permission classifier even with prior approval (see CLAUDE.md TACTICAL).
