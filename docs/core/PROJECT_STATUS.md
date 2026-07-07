# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 7, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.97** — **deployed and verified live** (bundle confirms `version:"3.0.97"`, `gitCommit:"cf596d3"`, matching HEAD exactly — no drift). New player panel is now the default in production; 16-bug triage batch (see below).

## Current sprint
**2026-07-06 — new-panel-default flip + full bug-backlog re-triage.** Flipped `panelTheme.ts`'s classic/new toggle default to `'new'` — the redesign has been feature-complete since v3.0.85 but stayed opt-in, so 9 already-shipped fixes never reached real players (checkmark trace, first-visit glow, reversible move pick, replace-expeditor dead-end, expeditor phase gate, life-event tap-to-detail, per-type icons, tappable card-detail rows, avatar color-ring consistency). Then re-triaged the open TODO backlog against **live behavior**, not stale notes, and found 2 genuine parallel-systems-drift bugs (SpaceArrivalProcessor vs CardEffectHandler duplicating life-event receipt logic; 7 components resolving NPC identity with no awareness of DiceService's PM-voiced-space list) plus 5 fresh, independently-scoped fixes (movement-gate hiding, End-Turn error swallowing, card-title duplication, bare Activate button, Return-to-Sender no-target no-op, join-by-code copy). Full detail + file links in CHANGELOG v3.0.97.

## Health
- **Tests:** typecheck ✅ (one pre-existing, unrelated error in `tests/playtest/mailerRecipient.test.ts`, not touched this session) + build ✅ clean. **Full suite: 2332/2334 passing** — 1 known `E2E-AllPaths.test.ts` concurrency flake (confirmed clean in isolation 3x this session, not a regression).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.97 deployed** 2026-07-07 (`bash deploy.sh` from a Windows terminal, not WSL — never `docker compose up`). Verified live via the deployed bundle's embedded version/commit strings. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Live-verify the new-panel-as-default experience with a real multi-player game** on production — this session's fixes were verified via a mix of live browser testing (preview MCP) and unit tests pre-deploy; now that it's live, worth a real playthrough to confirm nothing looks different under real network/multi-device conditions.
2. **Pre-existing typecheck error** in `tests/playtest/mailerRecipient.test.ts` (3 `'err' is of type unknown'` + 1 type-literal mismatch) — unrelated to this session's work, needs a look.
3. **Playtester-acquisition follow-ups carry over from v3.0.96** — finish the screenshot carousel (won/lost/mid-game shots, teacher edit-spaces needs the teacher password), and the demo video still needs real footage. See TODO.md's Playtester Acquisition System section.
