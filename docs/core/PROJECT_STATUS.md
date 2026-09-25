# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 25, 2026 (v3.2.76)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.76 — committed and pushed, PENDING DEPLOY (Tom's).** Live is v3.2.75 (`/health` = `71162a1`, checked 2026-09-25 ~17:22 UTC; HEAD was then a docs-only commit ahead of it). Run `curl -sS https://game.unravelcodes.com/health` before believing this.

## Current sprint
**Onboarding Phase C, teaching a beginner the game** (Tom's 2026-09-19 replan: no new tutorial layer — one help look for the whole game, one recurring mentor, existing wording reused). This session (2026-09-25, Manager brief): **v3.2.76 — Bank Review now charges "1 day per $200K"** of the loan on the table (words untouched; the data step used to throw "per $200K" away). Tom OK'd the loan→days table (median 7 days a visit, 3–20; was 1). Also brought the mentor candidates — Tom: "Loving Ruth and the handbook/spell book icon idea" (one-word confirm pending, nothing built) — and checked five findings read-only (Architect/Engineer first press, Pick Your Path, the "Expeditor" definition, the blank Owner's Money preview, the false "2 behind" version badge). Tom also decided the next batch (TV screen-size live buttons, header entry point, colour-only version badge, docs-only = up to date), **not started** — it waits on Tom/Manager because the weekly allowance is tight.

## Health
- **Tests (v3.2.76):** `npm test` **221 files / 3419 tests green** (+48). Ghost gates **11 files / 43 tests green**; smart-bot **49/50 wins, 70.1 avg turns — unchanged**, all 50 seeded games play out identically (days don't steer the bot). Typecheck ✅, build ✅, lint 0 errors (4 old warnings in `GameLayout`).
- **Deploy:** v3.2.76 waits for Tom's `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`; confirm with `/health`. Real-browser check done on dev servers: a $4M offer showed +20 days and a real hold moved Time 7 → 27.
- **Weekly allowance (read 2026-09-25):** Pro plan, weekly meter ~71–72% used, resets Monday 2026-09-28 ~07:00 EDT; extra-usage is off and its budget is spent. Say the cost before any big step.
- **Nightly robot:** its `TAB_SUFFIX_RE` regex in the Jarvis repo still needs to accept both "tap to compare" and "tap to see the cost" (cosmetic; not this repo).
- **Dashboard:** fb:93449bf2 waits for Tom's eyes on the real TV; fb:ae480630 / fb:11662ac3 need a live look. 9 of 17 open reports are not tracked in TODO/CHANGELOG — run `/start full`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom's answers** (TODO "Decisions waiting"): the mentor one-word confirm; TV entry point (header button + lobby pulse vs pre-screen); approve the "counts as docs" path list; Architect/Engineer first press; Pick Your Path reading; Owner's Money preview.
2. **Job 3 — TV lobby & badge** (badge colours, header size button, live Bigger/Smaller/Keep with snap-back) — one version each; wait for the go.
3. **Slice 2 mentor + Slice 3 leftovers** (24 movement tips also answers Pick Your Path; RULES body rewrite); "?" placement still needs Tom's "go".
