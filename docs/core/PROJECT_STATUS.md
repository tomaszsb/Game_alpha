# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 12, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.71** (deployed + live data synced 2026-06-12)

## Current sprint
**2026-06-12 — shipped both real bugs from the 2026-06-11 playtest (v3.0.71), end-to-end.** Bank-loan button mislabel (fb:06e5d66f): data label fixed in SOURCE+CLEAN, code fallback now funding-source-aware; live data synced and verified at origin. Result-modal flash (fb:ac29b623): the live repro **overturned the prior diagnosis** — not an AnimatePresence swallow but *click-through* (the next modal opens under an already-committed click that lands on the backdrop); fixed with a 500ms backdrop grace window in ModalBase (protects all modals) plus a result-modal queue (`useModalQueue` + `onExitComplete` plumbing) for deterministic reopen ordering. Deployed, both dashboard reports flipped resolved (open 7→5). Also created the user's Windows ssh config so the `unraid` alias resolves.

## Health
- **Tests:** 1911/1911 non-ghost sweep green (+14 new this session); full-suite koniec run in flight at handoff — see NEXT_SESSION.md.
- **Build / typecheck:** clean.
- **Lint:** `npm run lint` reports 386 errors (DEFICIENCY_AUDIT DEF-4 — config is TS-unaware; long-standing, not a regression).
- **Deploy:** v3.0.71 live (bundle verified serving, commit ece5584). Live CSV label sync verified at origin (cf MISS).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Security gaps from the audit** (DEF-2, DEF-6) — WebSocket `subscribe` skips token auth (state readable without token); feedback-read endpoints unauthenticated + expose reporter PII. See docs/technical/DEFICIENCY_AUDIT.md.
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af` + L66) — game-level tutorial; the biggest remaining product lever (recurring "overwhelming for newcomers" feedback theme).
3. **Teacher instance layer + space catalog** (design initiative) — master-library vs per-instance-config split: turns the manual data-sync into a dashboard button AND enables teachers to add/remove spaces. Needs a focused design/brainstorm session first (see TODO).
