# Next session starter — written 2026-09-24 by /koniec

## State at handoff
- **Version:** v3.2.75 — **deployed and verified live** (`/health` = `71162a1` = HEAD, 2026-09-24 ~21:36 UTC; live bundle carries the new hint; live `SPACE_CONTENT.csv` has the 5 prices). The old note that v3.2.73 was "pending" was wrong — it had been live all along; fixed here and in PROJECT_STATUS.
- **Branch:** master, clean and pushed. Untracked: `idea.txt` — **READ IT, never modify or commit it** (Tom's own brief: D&D dual-function constraint + how he wants to be worked with).
- **Last shipped (Manager brief 2026-09-24, both live):** **v3.2.74** — hint now "Tap to see the cost · press & hold to confirm" (+ both help lines, exact wording Tom approved) and **real push-backs are counted** (`pushBacks` in `/api/admin/engagement-stats`: home/foreign/unknown, deduped). **v3.2.75** — pushing back now costs days at the three places it was free (Investor Review 15, Hire a Builder 5, Final Approval 1; new `try_again_days` column). Checked against the old game folders (Tom's suggestion): no price ever existed there; the dice days are unchanged in every version.
- **Tests:** `npm test` 220 files / 3371 green; ghost gates 11 files / 43 green (run this session; smart-bot 49/50, 70.1 turns — unchanged). Typecheck ✅ build ✅.

## Top 3 open items (top 3 from this note — TODO.md is the whole backlog)
1. **"?" inside its button's outline — Tom must say "go" first.** Facts + process are in TODO (onboarding item "One shape for every '?'"). Show him a picture of the "?" at each of the four spots at phone width and let him pick; needs his real phone, light and dark. Not started, don't fold into other work.
2. **Slice 2, the mentor — needs Tom.** Bring 3 candidates with a sample line each (ok / edit / no). Then Slice 3's leftovers: the 24 movement-choice tooltips (`TooltipService.getMovementTooltip`, zero callers) + the RULES modal body rewrite.
3. **Read the push-back counts once real players exist** (`pushBacks.foreign` only) — also the first test of the new prices, which are Tom-approved guesses. Where the prices live: `Spaces.csv` column `try_again_days`, then `node scripts/regen-clean-files.mjs`.

## Decisions waiting on the user
- The mentor (item 2) and "go" on the "?" work (item 1). Nothing else — the 0-day push-back question was answered and built (v3.2.75).

## For the manager / Jarvis session (not this repo)
- **`game_playtest.py:166` `TAB_SUFFIX_RE`** strips the old "— tap to compare…" tab-label ending; v3.2.74 reworded it, so captions carry "— tap to see the cost, press and hold to confirm" until the regex accepts both (`tap to (?:compare|see the cost)`; also the fallback at :696). Cosmetic — `data-actionable` still drives what it holds. Fix before the next 03:00 run.
- Not fixed, logged in TODO for Tom: Bank Review's text says "1 day per $200K" but the rule is a fixed 1 day.

## Flip after deploy
- **fb:93449bf2** — only after Tom confirms the TV reads well across a room. **fb:ae480630 / fb:11662ac3** — only after a live re-check at Lender Review. (Deploy alone doesn't satisfy these.)

## Suggested first move
`/start full` — 9 of 17 open feedback reports aren't tracked anywhere. Then ask Tom: go on the "?" work? and who's the mentor?

## Suggested model for next session
Sonnet 5 — presentation/copy work with shipped precedent.

## Reminders
- **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`; `curl` is `Invoke-WebRequest` — use `curl.exe … | Select-String -SimpleMatch "text"`, or run read-only checks yourself.
- **Deploy is Tom's:** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. His paste stops after "Stopping existing container" — that's normal-looking; confirm with `/health`.
- **In Git Bash, `sed -i` (like the Edit tool) flips CRLF files to LF** — `docs/user/USER_MANUAL.md` is CRLF; use a Python byte replace and check `git diff --stat`.
- **Verify UI in real Chromium** (`mcp__playwright__*`; `scrollIntoViewIfNeeded` before a mouse press). Say which folder AND session you're in. **`HelpButton` is 26px, not 44px** — deliberate (Tom, v3.2.72).
