# Next session starter — written 2026-09-25 by /koniec

## State at handoff
- **Version:** v3.2.76 — **committed and pushed, PENDING DEPLOY (Tom's).** Live is v3.2.75 (`/health` = `71162a1`, 2026-09-25 ~17:22 UTC). Check `/health` first: equal to `git rev-parse --short HEAD` ⇒ deployed; a docs-only HEAD ahead of it means nothing to deploy.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — read it, never modify or commit it.
- **Last shipped (Manager brief 2026-09-25):** **v3.2.76** — Bank Review now charges "1 day per $200K" of the loan drawn that visit (rounds up, min one block; median 7 days, was 1; push-back the same). The data step used to throw "per $200K" away; it now lives in the row's `condition` (`per_200k`), one rule in `costPreview.ts`. Tom OK'd the table ("Table is fine").
- **Tests:** `npm test` 221 files / 3419 green; ghost gates 11 files / 43 green (smart-bot 49/50, 70.1 — unchanged, all 50 games identical). Typecheck ✅ build ✅ lint 0 errors.
- **Allowance:** Tom's weekly meter was ~71–72% on 2026-09-25 (resets Mon 2026-09-28 ~07:00 EDT; extra-usage off and spent). **Say the cost first; do NOT start Job 3 until Tom or the Manager says go.**

## Top 3 open items (top 3 from this note — TODO.md is the whole backlog)
1. **Tom's pending answers** — TODO "Decisions waiting" #1–7: "?" go; mentor one-word confirm (Ruth + handbook icon; nothing built); TV entry point (header button + lobby pulse vs pre-screen); approve the "counts as docs" list; Architect/Engineer first press ("Take your next step"); Pick Your Path reading (switch on the 24 existing movement tips, no rename); Owner's Money preview blank (hide the sentence on the preview, my pick).
2. **Job 3, one version each, NOT started** — 3C version badge → colours only (green/yellow/orange/red, docs-only = up to date); 3B screen-size button in the TV header + lobby flare; 3A live Bigger/Smaller/Keep with ~10 s snap-back. A never-asked TV keeps starting at BIGGEST. Full facts, files and a cost guess are in TODO "📺 Active — TV lobby & version badge".
3. **Slice 2 mentor + Slice 3 leftovers** (24 movement tips, RULES body rewrite); then read `pushBacks.foreign` once real players exist (first test of the push-back prices, now including Bank Review's per-loan days).

## Decisions waiting on the user
See item 1 above and TODO "Decisions waiting on the user" (seven items, each with my pick).

## Flip after deploy
- **fb:93449bf2** — only after Tom confirms the TV reads well across a room. **fb:ae480630 / fb:11662ac3** — only after a live re-check at Lender Review. (Deploy alone doesn't satisfy these.) 9 of 17 open reports are untracked — `/start full`.

## Suggested first move
Check `/health`; if v3.2.76 isn't live, hand Tom the deploy command. Then ask the mentor one-word confirm and walk the rest of the decisions with picks, one at a time, before any Job 3 work.

## Suggested model for next session
Sonnet 5 — presentation/copy and small UI work with shipped precedent (raise effort before reaching for a bigger model).

## Reminders
- **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`; `curl` is `Invoke-WebRequest` — use `curl.exe … | Select-String -SimpleMatch "text"`, or run read-only checks yourself.
- **Deploy is Tom's:** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`; confirm with `/health`.
- **For the Manager / Jarvis (not this repo):** `game_playtest.py:166` `TAB_SUFFIX_RE` must accept both "tap to compare" and "tap to see the cost". Brief paths that say `server/data/game-data/…` are a stale, git-ignored runtime copy — the real data source is `public/data/`.
- **Verify UI in real Chromium** (`mcp__playwright__*`; `scrollIntoViewIfNeeded` before a mouse press); a dev teleport skips arrival effects, so play the real first turn to see arrival-time behaviour. Say which folder AND session you're in. `HelpButton` is 26px, deliberately.
