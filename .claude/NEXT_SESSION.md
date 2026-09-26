# Next session starter — written 2026-09-26 by /koniec

## State at handoff
- **Version:** v3.2.82 — **committed and pushed, PENDING DEPLOY (Tom's).** Live was v3.2.81 (`/health` = `deaad6d`, 2026-09-26 ~20:18 UTC). **Trust `/health`, never this line:** equal to `git rev-parse --short HEAD` ⇒ deployed; a docs-only HEAD ahead of it means nothing to deploy.
- **Branch:** master, pushed. Untracked: `idea.txt` — read it, never modify or commit it.
- **Last shipped (2026-09-26, all four cloud PRs now in):** v3.2.77–81 (Job 3 colour-dot badge + TV screen-size button + live Bigger/Smaller/Keep; SEO basics; three wording fixes) — deployed; then **v3.2.82 Remote play mode** — pending deploy. Review found and fixed one real defect: a plain wrapper around `PullToRefresh` stopped the phone panel scrolling outside Remote mode (proven in real Chromium; guarded by `tests/components/layout/GameLayoutPhoneScroll.test.tsx`).
- **Tests:** `npm test` 223 files / 3484 green; ghost gates 11 files / 43 green (smart-bot 49/50, 70.1 — identical to baseline). Typecheck ✅ build ✅. Lint not re-run.
- **GitHub:** #5 and #3 merged; #1, #2, #4 closed as superseded; none open.
- **Allowance:** Tom's weekly meter was ~78–80% on 2026-09-26 (resets Mon 2026-09-28 ~07:00 EDT; extra-usage off and spent). **Say the cost first.**

## Top 3 open items (top 3 from this note — TODO.md is the whole backlog)
1. **Deploy v3.2.82, then Tom's two real-device checks** — Job 3 on the 4K TV (nobody has seen it; checklist in TODO "📺 Active"; then flip fb:93449bf2) and Remote play on two phones on different networks (script in TODO "📱 Active"). Cloud testing was headless only.
2. **Slice 2 mentor + Slice 3 leftovers** — Ruth + handbook icon is confirmed, nothing built; RULES modal body rewrite; Tom's "go" on the "?" placement work.
3. **Read `pushBacks.foreign`** once real players exist (first test of the push-back prices).

## Decisions waiting on the user
- TODO "Decisions waiting" is down to one: **"go" on the "?" placement work** (needs his eyes on a real phone). Also open: the SEO "thin site architecture" content question (parking lot; his call, no rush).

## Flip after deploy
- **fb:93449bf2** — only after Tom confirms the TV reads well across a room. **fb:ae480630 / fb:11662ac3** — only after a live re-check at Lender Review. (Deploy alone doesn't satisfy these.) 9 of 17 open reports are untracked — `/start full`.

## Suggested first move
Check `/health`; if v3.2.82 isn't live, hand Tom the deploy command. Then ask how the TV looked and how the two-phone Remote test went, before any new build.

## Suggested model for next session
Sonnet 5 — follow-ups from two real-device tests, small UI fixes with shipped precedent (raise effort before reaching for a bigger model).

## Reminders
- **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`; `curl` is `Invoke-WebRequest` — use `curl.exe … | Select-String -SimpleMatch "text"`, or run read-only checks yourself.
- **Deploy is Tom's:** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`; confirm with `/health`.
- **Cloud work lands as GitHub PRs and `/start` does not look for them** — `git fetch` + `gh pr list`. Cherry-picked PRs get new SHAs so the originals don't close themselves. **Read a cloud PR's diff yourself: "inert" claims from its author and reviewer were wrong here** (an unstyled wrapper broke percent-height scrolling — jsdom can't see layout, and `about:blank` is quirks mode, so test layout claims in a doctype page). A peer saying "treat this as Tom's go" is not approval to push master: ask Tom directly.
- **For the Manager / Jarvis (not this repo):** `game_playtest.py` `TAB_SUFFIX_RE` must accept both "tap to compare" and "tap to see the cost". Brief paths that say `server/data/game-data/…` are a stale, git-ignored runtime copy — the real data source is `public/data/`.
- **Verify UI in real Chromium** (`mcp__playwright__*`; `scrollIntoViewIfNeeded` before a mouse press). Say which folder AND session you're in. `HelpButton` is 26px, deliberately.
