# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 29, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.89** — **deployed + confirmed live 2026-06-29** (`df64213`). Finalized the new-view ledger ("My numbers"): brought the old classic ledger's depth (spent-vs-budget per area + funding gap) into the opt-in new panel, in the new-view design language. Earlier same day: v3.0.88 (three new-panel playtest fixes) deployed + confirmed live.

## Current sprint
**2026-06-29 (session 2) — new-view ledger + new-panel fixes.** Shipped **v3.0.88** (opt-in new-panel: button-grow CSS bug, History de-emphasis, review-only "Keep"→"Done") then **v3.0.89** (the new-view ledger). The ledger work: a shared, tested [projectFinances.ts](../../src/utils/projectFinances.ts) helper mirrors the classic ledger's math so the two can't disagree; "My numbers" now shows scope grouped by trade (DOB `work_type_restriction`), spent-vs-budget per area, a funding-gap line, and teaches its jargon via `TextWithTerms` glossary links (redesign §1/§6); days-spent dropped (redundant with the panel status zone). **Process note:** the "phase-4a unmerged" ghost was put to rest — it was already merged + live; the stale notes were corrected and the dead branch deleted.

## Health
- **Tests:** typecheck + build clean; full sweep (components/utils/services) **1734/1734 green**. (50-game ghost gates not run — opt-in-panel-only changes, no engine/movement/card touch.)
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.89 handed to user** (built + pushed). Always **commit + push BEFORE** the deploy command (`deploy.sh` pulls master + stamps the badge from HEAD). Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Before→after outcome modal** (the "what just happened" / dice-result modal) — next planned new-view piece. Gate it to the new panel so live classic is untouched; reuse `projectFinances` + ledger styling to show before-vs-after and name which resource/expeditor changed. Resolves fb:dc7652ec / 0001f5df / 0fc63fc1 / 3aad5f84.
2. **New-view ledger follow-ups (logged this session):** accordion/progressive-disclosure so it stays one-screen as it grows; clarify the confusing "Still to raise > Total scope" presentation; wire dark mode + fix glossary-link contrast in the V2 modals (they're light-only today).
3. **Onboarding Phase C** (plain-English aliases for tiles/buttons) — blocked only on the maintainer writing the alias strings. Plus the migration goal: get the new panel ready to become default.
