# Next session starter — written 2026-10-18 by /koniec

## State at handoff
- **Version:** v3.8.13 **LIVE** (`/health` `6b94e2a4` = HEAD, deployed 15:28 UTC 10-18 on Tom's go "today only"). Re-read `/health`.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Last shipped (bug session, Manager brief from the 10-18 independent review):** 3.8.8 last work package always stays · 3.8.9 push-back keeps what a life event did · 3.8.10 NPC lines no longer promise missing choices · 3.8.11 bank fee from one data cell + 20% warning on peakScope · 3.8.12 deploy.sh runs the tests first · 3.8.13 glossary 6 s fail-soft. "Time went backwards" = good-luck events, not a bug (robot probe).
- **Tests:** `npm test` 284 files / 3982 green; ghost 45 passed / 1 skipped; build clean. Typecheck: pre-existing errors in `tests/server/dataGate.test.ts` (express types, since v3.8.5).

## Top 3 open items
1. **Bug 6 needs Tom (hold vs tap, 6 names for "move on").** Robot facts: Jarvis's `~/.hermes/scripts/game_playtest.py` finds buttons by `data-testid`, TAPS `commit-end-turn` and `builder-bid-hire`, HOLDS `commit-side` tabs. Renaming labels is robot-safe; making a one-button commit or the builder hire a hold breaks the robot (tell the Jarvis session first). Tom set hold/tap 10-14.
2. **Next overnight sessions:** [N2] certificate fun + "why" questions, why-tips in the existing help, restore guide in ARCHITECTURE.md; [N3] PLAYTEST.md design ideas. All in TODO "From the 2026-10-18 independent review".
3. **The deploy test gate has never run for real:** this deploy used the OLD deploy.sh (it reads itself before `git pull`). On the next deploy, watch for "Running the test suite" then "OK — all tests passed" (~3 extra min).

## Decisions waiting on the user
- Bug 6 rule (see 1). The old "Money/scope vanished" report (10-12) is probably the v3.8.8 cause; ask Tom whether to close it.
- Teacher password resets (Tom, admin screen).

## Suggested first move
Check `/health`, then run the next overnight brief ([N2]) or ask Tom for the bug 6 decision.

## Suggested model for next session
Sonnet 5: [N2] is copy plus small UI on existing pages.

## Reminders
- Deploy: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell). Never 02:45-04:45 EDT (Jarvis robot + update).
- Reading live game records (games.json, visitors.log greps) was refused by the permission check this session; ask Tom if a session needs them.
