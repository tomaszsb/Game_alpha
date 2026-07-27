# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 27, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.60** — **pending deploy** (last confirmed-live bundle: 3.1.51, 2026-07-26).

## Current sprint
**2026-07-26/27 — fixloop closed the last card-effect gaps, a real infra root-cause was found via live-server investigation, then a long visual-design arc replaced emoji/avatars/logo with real generated art.** Fixloop landed E036's card gate (v3.1.52) and the dictionary AI-generated-label fix (v3.1.53, which found the actual bug: the live game's data path was silently discarding the scraper's AI-provenance tag). A maintainer interview then resolved the remaining 3 card-effect gaps as copy fixes, not new mechanics (v3.1.54). Checking the glossary auto-sync's real status found a NEW blocker behind the already-fixed credits issue — a retired Claude model — fixed in the sibling `dictionary-scraper` repo (not yet deployed). The rest of the session replaced 15+ setup-screen emoji with a custom SVG icon set (v3.1.55), then went through three maintainer-corrected rounds on player avatars/logo before landing on real PixelLab-generated art for the 10 avatars (~$0.074 total) and reverting the logo to the real, untouched `logo.png` with its pre-existing CSS animation rather than any regenerated version (v3.1.56–v3.1.60).

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2482/2483 passing** (1 pre-existing skip, no failures), ghost gates **33/33 passing** (10 files, 0 hard failures, 572.96s) — no regressions.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing), unchanged this session.
- **Deploy:** live = **v3.1.51**; v3.1.52–v3.1.60 pushed, awaiting `deploy.sh`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Homeowner violation mechanic — needs a real spec before engineering.** Maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session work, not urgent — needs a design conversation before any code.
2. **Glossary auto-sync fix needs deploying to the `dictionary-scraper` repo** — code fix committed (`0278955`), needs `scp` of 2 files + `docker restart dictionary-scraper-backend` on Unraid.
3. **CSP/HSTS/Permissions-Policy headers still deferred** — real regression risk this app's jsdom-based test suite structurally can't catch; needs a full inline-style/iframe survey + live-browser verification, not a quick pass.
