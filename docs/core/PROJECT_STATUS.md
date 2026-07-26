# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 26, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.51** — **confirmed deployed and live** 2026-07-26 (client bundle content-verified `"3.1.51"`, container logs clean).

## Current sprint
**2026-07-26 — a maintainer interview cleared the entire decision backlog, then a mix of fixloop bug fixes, real feature builds, infra fixes, and a UX redesign shipped v3.1.41–v3.1.51.** The interview resolved most open "Decisions waiting on the user" items as either already-decided, a real bug mislabeled as a design question (funding-gap duplication; an IP-detection spoofing gap found by checking the live Cloudflare/Nginx-Proxy-Manager topology directly), or genuinely settled with no code change needed. Landed from there: a real Add Player bug (v3.1.41), the `REGULATORY_REVIEW` rename (v3.1.42), the IP-detection/rate-limiter fix (v3.1.43 — the admin/login rate limiters added two sessions ago had never actually been per-visitor), Log/History icon disambiguation (v3.1.44), two real card-effect builds — L021 (v3.1.45) and E040 (v3.1.47) — a Node 20→24 + geoip-lite upgrade closing 10 new `npm audit` vulnerabilities (v3.1.46), a dark-mode gap on the current player's board tile (v3.1.48), G160's connector-visibility toggle and TVDisplay dark mode (v3.1.49–v3.1.50, both corrected mid-session to admin/teacher-only access rather than open to all players), and a standings-view redesign that also fixed the funding-gap bug at its root (v3.1.51). Also cleaned ~15MB of historical nested-directory server debris (root-caused back in v2.69.7, never cleaned up until now).

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2477/2478 passing** (1 pre-existing skip, no failures this run), ghost gates **33/33 passing** (10 files, 0 hard failures, 573.6s) — no regressions from this session's game-logic changes.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing), unchanged this session.
- **Deploy:** live = **v3.1.51** (bundle-verified 2026-07-26).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Homeowner violation mechanic — needs a real spec before engineering.** Maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session work, not urgent — needs a design conversation (what triggers it, turn-by-turn player actions, what unlocks after filing) before any code.
2. **Four sibling card-effect gaps found while building L021/E040, none yet decided:** "Approved Template" (E034, optional per-player choice — different shape than L021), "Expeditor Training"/"Expeditor Mentor" (E020/E037, linear per-count scaling — different shape than E040), "Press Release" (E036, likely just needs an existing gate wired, not new design), "Appeal Process" (E044, same cut-off-description shape E040 was).
3. **CSP/HSTS/Permissions-Policy headers still deferred** — real regression risk this app's jsdom-based test suite structurally can't catch; needs a full inline-style/iframe survey + live-browser verification, not a quick pass.
