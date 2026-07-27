# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 27, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.61** — **pending deploy** (last confirmed-live: **v3.1.60**, deployed by the maintainer 2026-07-27, commit `93261a`).

## Current sprint
**2026-07-26/27 — fixloop closed the last card-effect gaps, a real infra root-cause was found via live-server investigation, then a long visual-design arc replaced emoji/avatars/logo with real generated art, deployed, and extended.** Fixloop landed E036's card gate (v3.1.52) and the dictionary AI-generated-label fix (v3.1.53). A maintainer interview resolved the remaining 3 card-effect gaps as copy fixes, not new mechanics (v3.1.54). The glossary auto-sync's real blocker turned out to be a retired Claude model, not credits — fixed in the sibling `dictionary-scraper` repo (not yet deployed there). The rest of the session replaced 15+ setup-screen emoji with a custom SVG icon set (v3.1.55), went through three maintainer-corrected rounds on player avatars/logo, and landed on real PixelLab-generated avatars + the logo reverted to the real `logo.png` (v3.1.56–v3.1.60) — **the maintainer deployed v3.1.60 and confirmed it live.** Follow-up feedback after seeing it live: the new avatars were too subtle at the small setup-screen size, so they were extended to the board tiles and TV scoreboard (previously plain color dots), plus 3 more leftover emoji swept for icon consistency (the floating bug button, in-game footer message, personal light/dark toggle) — v3.1.61, pending deploy.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite last full run 2482/2483 passing (1 pre-existing skip), ghost gates 33/33 (572.96s) — both from the /koniec pass earlier this session; v3.1.61's presentation-only changes (avatar images replacing color dots, icon swaps) verified via existing targeted tests (`BoardCanvas.test.ts` 20/20, `ScoreboardV2.test.tsx` 3/3, `PlayerAvatar.test.tsx` 2/2) + live dev-server verification, ghost gates not re-run for this round (no game-logic changes).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing), unchanged this session.
- **Deploy:** live = **v3.1.60** (confirmed by maintainer); v3.1.61 pushed, awaiting `deploy.sh`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Homeowner violation mechanic — needs a real spec before engineering.** Maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session work, not urgent — needs a design conversation before any code.
2. **Glossary auto-sync fix needs deploying to the `dictionary-scraper` repo** — code fix committed (`0278955`), needs `scp` of 2 files + `docker restart dictionary-scraper-backend` on Unraid.
3. **CSP/HSTS/Permissions-Policy headers still deferred** — real regression risk this app's jsdom-based test suite structurally can't catch; needs a full inline-style/iframe survey + live-browser verification, not a quick pass.
