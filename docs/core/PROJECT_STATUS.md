# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 3, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.94** — **PENDING DEPLOY** (v3.0.93 + v3.0.94 pushed to origin; live is v3.0.92, deployed 2026-07-02). Two bug batches from the dashboard backlog: Chronicle turn-dividers (turn_end no longer files under the next space), dark-mode V2 modal bodies + term-link contrast, tablet-tappable glossary links + a 6s local fallback when the dashboard iframe hangs, and a double-applied time effect removed from the classic CardModal path (E013's +2 was hitting for +4).

## Current sprint
**2026-07-02/03 — Thursday-night bug batch, dashboard backlog.** Four reports closed (fb:1eff7156 Chronicle ordering, dark-mode/contrast, fb:baa01a70 glossary tap, fb:c51f9f16 E013 audit) + one engine bug found by the audit (EffectFactory double tick_modifier emission) + two stale E2E-05 tests repaired (L003 gained phase_restriction=CONSTRUCTION after they were written). ModalBase grew an opt-in `mode` prop (default light = classic pixel-identical); good/bad/alert tints centralized in `panelPalettes`.

## Health
- **Tests:** typecheck + build clean. **Full suite ran this session: 2,293 passed / 1 skipped** (only failures were the 2 stale E2E-05 tests, fixed + verified). Koniec targeted sweep 1818/1818.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.93+94 pending.** Always **commit + push BEFORE** the deploy command (`deploy.sh` pulls master). Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.94** and confirm the glossary tap fix **on a real tablet** (the cursor:pointer cause is desktop-verified only — hypothesis for the iPad report).
2. **Dashboard PATCH sweep after deploy:** flip `resolved:true` for the shipped reports (this session's 1eff7156, baa01a70, c51f9f16 + the earlier pending batch: 9c110d52, 8d68ab14, 222cd521, 1990c71e, 40caa223, 06f7da3b, b53864af).
3. **Remaining standalone bugs:** Move button disappeared after bug-report popup (fb:bf8bf19a), buttons gone after board zoom (fb:45cb8b0c), action-count off-by-one (fb:65160c0c — needs repro with space name).
