# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 15, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.80** — committed + pushed, **PENDING RE-DEPLOY** (live still serves v3.0.78; v3.0.79/80 not yet deployed)

## Current sprint
**2026-06-15 — Phase 3 teacher-layer polish + the FDNY logic-question auto-answer (and the two live-playtest fixes it surfaced).** Started from v3.0.78 live+playtested. Shipped **v3.0.79**: the 5-report Phase 3 polish cluster (teachers self-create their own classrooms — *reversed* the v3.0.78 admin-only-creation decision after live use; delete teachers/classrooms; classroom badge on game screens; inline locked-space reason; button-fit fix) **plus** the FDNY logic-question auto-answer (Q2 scope-changed, Q3 DOB-referred, Q4 fire-systems now resolve from game state) **plus** a "🧭 where you're headed next" routing-explanation modal. Live playtest then surfaced two latent gaps the auto-answers *exposed*: (a) Q2-no routed approved+unchanged players back through redundant FDNY → fixed (Q2-no→Q5); (b) **v3.0.80 hotfix** — Prof Cert never set `dobApprovalStatus`, so the auto-answered Q5 looped path-locked Prof-Cert players forever → Prof Cert now grants DOB approval on a pass roll (data-driven off `path_type='Prof'`).

## Health
- **Tests:** targeted koniec sweep (services + components + utils) **1658 passed / 0 failures** (95 files). Ghost gate validated mid-session: strict 50-game gate green (0 hard failures, wins ≥36), smart-bot win floor + aggressive-Try-Again gates green. Typecheck + build clean.
- **Build / typecheck:** clean. **npm audit: 0 vulnerabilities.** **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** ⚠️ **v3.0.80 NOT deployed** — live still runs v3.0.78. Re-deploy `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` to ship v3.0.79/80 (the Prof Cert loop fix needs it). Never `docker compose up`; NPM routes domain → 3080; cf-cache is DYNAMIC.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Phase 4 — card insertion** (teacher-authored spaces / "replace one card with several"). The spec's biggest-risk phase — start with a design pass, not code. Best started in a **fresh session** after v3.0.80 deploys + playtests clean.
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af`) — biggest product lever, deploy-independent.
3. **Ghost `LOOP` detection** (small, new this session) — the ghost gate can't see soft-locks (the Prof Cert loop slipped a green gate); flag a TURN_CAP game with a repeating space-cycle as a distinct `LOOP` failure. Sketch in TODO.
