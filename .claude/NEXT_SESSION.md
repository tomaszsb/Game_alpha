# Next session starter — written 2026-10-17 by /koniec

## State at handoff
- **Version:** v3.8.4 pushed. **LIVE when checked: `/health` = `de31c02a` = v3.8.2 + docs.** v3.8.3 (How to play text, /class "about 30 minutes") and v3.8.4 (press-and-hold caption + `commit_tap` tracker; **restarts the server**) are **pending deploy**. Re-read `/health`; never believe this line.
- **Branch:** master = origin/master after the wrap-up commit, clean.
- **Also added (Tom, mid-wrap): static `public/nest-privacy.html`** for his Google Cloud / Nest sign-in, pending deploy; its contact is `game@unravelcodes.com` (the brief's placeholder, Tom may swap it). After deploy: `curl -s -A "Mozilla/5.0" https://game.unravelcodes.com/nest-privacy.html | grep -c "Privacy Policy"` prints 2 (title + heading).
- **Shipped this session (Manager brief: class landing page + certificate):** 3.8.0 `/class` + printable certificate + joke · 3.8.1 avatar on the phone setup card (was 1 px wide) · 3.8.2 `/class?src=` tag (Jarvis session asked) · 3.8.3 "How to play" rewritten, in code AND `UI_STRINGS.csv` · 3.8.4 "Press and hold" caption + `PLAYTEST_COMMIT_TAP`. Also: data-integrity test reads quoted CSV (tests only), money reports closed, uptime check confirmed running.
- **Tests (v3.8.4):** typecheck + build clean; `npm test` 279 files / 3936 green; ghost gate green (11 files / 43 tests, 1 skipped).

## Top 3 open items
1. **Tom: deploy 3.8.3 + 3.8.4 + the Nest page, then play one game to the end and print the certificate to a real PDF** (never checked as a file). Still owed by Tom: student count, start date, "City College" or generic on `/class`.
2. **Read `visitors.log` after the class starts:** `PLAYTEST_COMMIT_TAP` vs `PLAYTEST_SPACE_REACHED` at OWNER-SCOPE-INITIATION, and `PLAYTEST_*` lines tagged `campaignSource` "kosi". Hypothesis (unverified): the press-and-hold at the first space is why 31 of 46 outside games never passed it. Baseline: 4 of 46 finished; a person's real finish ~35-45 min.
3. **Tom's device checks, then flips** (checklist in the TODO "Tom's checks" bullet; nothing flips until he confirms one by one), incl. the avatar (fb:3c938084), the Safari light-mode test (fb:5c8e37c4, fb:b6b93adf), and the instrumented investigations (TV with no buildings fb:a6474bad, the vanished scope, ResizeObserver): read the next report's `diagnostics` first, do not guess.

## Decisions waiting on the user
- `/class` wording: "City College" or generic (generic now). Phone panel: the ready commit control is 14 px taller until the first hold (54 px, same as while blocked); he can veto.

## Flip after deploy
NOTHING flipped (Manager's rule). Waiting on Tom: 3c938084 (avatar, live), 5b8a060c, 5617effb, aec545c4, 4e8a8550, 4db1b1d9, a49b598f, f9e897b0, bf9dd267, 3fec0e88, bf6176e5, 08dbbe87, 102e0953, a31aff46, b6b93adf, 53a47779 (after 3.8.4). Closed 10-17 on Tom's word: c65560a3, 69b4bc3a. Close without a fix: 4824bc44, 3ec9388f, 0a827891.

## Suggested first move
Read `/health`; ask Tom whether 3.8.4 is deployed and for the three class facts. If the class has started, pull the log and read item 2.

## Suggested model for next session
Sonnet 5: log reading and small follow-ups.

## Reminders
- Deploy stays Tom's: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (PowerShell).
- Commit files BY NAME; `git diff --stat` after any scripted edit; Python needs `encoding='utf-8'` (CLAUDE.md TACTICAL, 10-17).
- `visitors.log` is on the Tower at `/mnt/user/appdata/Game_alpha/server/data/visitors.log` (read-only over `ssh -o BatchMode=yes unraid`).
