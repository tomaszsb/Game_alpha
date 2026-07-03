# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 2, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.92** — **PENDING DEPLOY** (deploy only after the full ghost verdict — strict batch passed its floor mid-run). Bankruptcy now shows a real loss screen instead of a blank page; the panel cash cue shows an orange "$X deficit" when the project isn't fully funded; the end-turn button shows this turn's cost; and the contractor was redesigned — bids land 72–150% of the scope estimate, the crew sets a real schedule (8–78 days), and an unpayable contract bankrupts. Live: v3.0.91 (deployed + playtested 2026-07-01).

## Current sprint
**2026-07-02 — post-deploy triage of v3.0.91 + contractor economy redesign.** Both playtest findings closed: (a) "ran out of money → no end screen" was the win-only EndGameModal (loss endings had no winner → blank page) — fixed with `gameEndReason` + a loss variant; (b) the funding-gap-blind cash cue now runs on `computeProjectFinances`. Maintainer decisions recorded: loans do NOT bankrupt (repayment is post-scope; deadline+TCO mechanic parked), low cash is OK, "still to raise" → "deficit". Contractor redesign ("A and C"): shared [contractorTerms.ts](../../src/utils/contractorTerms.ts) — price centered ~105% of the estimate, schedule varies with roll + crew quality, signing is a mandatory bill (charges into the red → shared `checkBankruptcy`). Tooltips rewritten to match the real mechanic.

## Health
- **Tests:** typecheck + build clean; targeted sweep (components/utils/services) **1772/1772 green** (+13 new). Full `npm test` hangs on Windows (known) → targeted sweep is the gate. **Ghost gate:** strict batch cleared its ≥36-win floor mid-run (37 wins by game 38); full three-batch verdict in NEXT_SESSION.
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.92 pending.** Always **commit + push BEFORE** the deploy command (`deploy.sh` pulls master + stamps the badge from HEAD). Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.92 (after ghost verdict) + playtest the contractor economy** — real-priced bids + schedules are a big game-feel change; confirm the deficit cue steers players to raise before hiring.
2. **Medium tier:** Chronicle turn-ordering + dividers (fb:1eff7156), dark-mode/contrast for the V2 modals, action-count off-by-one (fb:65160c0c — needs a repro with the space name; engine and panel agreed everywhere checked).
3. **Dashboard PATCH sweep pending:** flip `resolved:true` for the shipped reports (9c110d52, 8d68ab14, 222cd521, 1990c71e + this session's 40caa223, 06f7da3b, b53864af, 0aae9865-followup).
