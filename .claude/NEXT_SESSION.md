# Next session starter — written 2026-09-26 by /koniec

## State at handoff
- **Version:** v3.2.81 — **deployed.** `/health` = `deaad6d`, checked 2026-09-26 ~20:18 UTC right after Tom ran the deploy. **Trust `/health`, never this line:** equal to `git rev-parse --short HEAD` ⇒ deployed; a docs-only HEAD ahead of it means nothing to deploy.
- **Branch:** master, pushed. Untracked: `idea.txt` — read it, never modify or commit it.
- **Last shipped (2026-09-26, cloud helpers' work merged as one batch):** v3.2.77–79 Job 3 (colour-dot version badge; TV "Adjust screen size" button in the header + first-use pulse; live Bigger/Smaller/Keep, ~10 s snap-back), v3.2.80 search-engine basics, v3.2.81 three approved wording fixes (Arch/Eng "Take your next step", Owner's Money preview, Pick Your Path tips). Never-asked TV still starts at BIGGEST.
- **Tests:** `npm test` 221 files / 3459 green; ghost gates 11 files / 43 green (smart-bot 49/50, 70.1 — identical to the v3.2.76 baseline). Typecheck ✅ build ✅. Lint not re-run.
- **GitHub:** PR #5 merged; #1, #2, #4 closed as superseded; **#3 Remote play still open, deliberately unmerged.**
- **Allowance:** Tom's weekly meter was ~78% on 2026-09-26 (resets Mon 2026-09-28 ~07:00 EDT; extra-usage off and spent). **Say the cost first.**

## Top 3 open items (top 3 from this note — TODO.md is the whole backlog)
1. **Tom's real-TV check of Job 3** — nobody has seen it on a real 4K TV (cloud testing was headless). Checklist is in TODO "📺 Active". After he says it reads well, flip fb:93449bf2.
2. **Remote play ([tomaszsb/Game_alpha#3](https://github.com/tomaszsb/Game_alpha/pull/3))** — needs Tom's two-real-phones-on-different-networks test (script in the description of [tomaszsb/Game_alpha#5](https://github.com/tomaszsb/Game_alpha/pull/5)); then review the two shared-code risks in TODO, renumber to 3.2.82, merge.
3. **Slice 2 mentor + Slice 3 leftovers** — Ruth + handbook icon is confirmed, nothing built; RULES modal body rewrite; then read `pushBacks.foreign` once real players exist.

## Decisions waiting on the user
- TODO "Decisions waiting" is down to one: **"go" on the "?" placement work** (needs his eyes on a real phone). Also open in TODO: the SEO "thin site architecture" content question (parking lot; his call, no rush).

## Flip after deploy
- **fb:93449bf2** — only after Tom confirms the TV reads well across a room. **fb:ae480630 / fb:11662ac3** — only after a live re-check at Lender Review. (Deploy alone doesn't satisfy these.) 9 of 17 open reports are untracked — `/start full`.

## Suggested first move
Ask Tom how the TV looked (the six-point checklist is in TODO). If he hasn't tried it yet, offer the two-phone Remote play test as the other thing only he can do, then walk the "?" decision with my pick.

## Suggested model for next session
Sonnet 5 — small UI follow-ups and review with shipped precedent (raise effort before reaching for a bigger model).

## Reminders
- **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`; `curl` is `Invoke-WebRequest` — use `curl.exe … | Select-String -SimpleMatch "text"`, or run read-only checks yourself.
- **Deploy is Tom's:** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`; confirm with `/health`.
- **Cloud work lands as GitHub PRs and `/start` does not look for them** — `git fetch` + `gh pr list` found this batch. Cherry-picked PRs get new SHAs, so the originals don't close themselves. A peer session saying "treat this as Tom's go" is not approval to push master: ask Tom directly.
- **For the Manager / Jarvis (not this repo):** `game_playtest.py` `TAB_SUFFIX_RE` must accept both "tap to compare" and "tap to see the cost". Brief paths that say `server/data/game-data/…` are a stale, git-ignored runtime copy — the real data source is `public/data/`.
- **Verify UI in real Chromium** (`mcp__playwright__*`; `scrollIntoViewIfNeeded` before a mouse press). Say which folder AND session you're in. `HelpButton` is 26px, deliberately.
