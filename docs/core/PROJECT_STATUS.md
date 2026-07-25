# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 25, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.40** — **deployed + confirmed live** 2026-07-25 (client bundle content-verified `"3.1.40"`, and `package.json` inside the running container matches; `/health`'s own version field is unreliable in production — see TODO Parking lot).

## Current sprint
**2026-07-25 — `/loop /fixloop` closed out the 2026-07-21 playtest batch + the full security audit, then a user-directed dependency upgrade attempt.** 12 fixloop iterations shipped v3.1.32–v3.1.40: naming reconciliations (Glossary/Dictionary, Rules/Game Rules), a real bug where two location badges showed raw internal space IDs instead of friendly names, then the entire security-audit MEDIUM tier (admin + login rate limiting, a foreign-game SMS alert volume cap, `npm audit fix`, `X-Powered-By` disabled, admin routes consolidated onto the shared `requireAdmin` helper — the last one needed 3 client fetch call sites updated too, since the helper reads the password from a header not the body). Two more playtest findings turned out to be false positives (press-and-hold "duplicate," PM-DECISION-CHECK "missing flavor text") and the "Bulk Discount" card was reclassified from a copy nit to a decision item — same shape as the earlier High-Profile Client finding, its description promises an effect that was never mechanically implemented. Session closed with a user-directed real ESLint 9→10 upgrade attempt to close the last 6 HIGH advisories; confirmed via the npm registry (not just this repo) that `eslint-plugin-react` has no ESLint-10-compatible release at all — forcing it crashes every lint run. Reverted; documented as a hard blocker, not an untried item.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2453/2454 passing** (1 pre-existing skip, no flakes this run), ghost gates **33/33 passing** (10 files, 0 hard failures, 572.9s).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing) — confirmed still the same shape post-ESLint-revert, not worse.
- **Deploy:** live = **v3.1.40** (`6030b50`), confirmed 2026-07-25 — deployed mid-session, verified via bundle content + container `package.json` (see Health note above on why `/health` itself isn't a reliable check).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Real-TV checks + TVDisplay dark-mode decision** — still outstanding across multiple sessions; needs a trip to the actual TV and a maintainer call on whether the shared screen wants a dark toggle at all.
2. **Two "build the mechanic or rewrite the copy honestly" decision calls** — High-Profile Client (L021) and now Bulk Discount (E040) both have description text promising an effect that was never mechanically implemented.
3. **Remaining MEDIUM/decision items need maintainer input, not more autonomous fixes** — funding-gap number reconciliation, "Funding raised" definition.
