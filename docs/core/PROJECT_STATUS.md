# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 30, 2026 (v3.2.89)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.89 — pending deploy.** `/health` → `75e85d6` (= v3.2.88) at 2026-09-30 ~12:36 EDT; HEAD is `b0e3848` (code at `4f00a6b`). Trust `/health`, never this line.

## Current sprint
**Bank-loss bug, the TV batch, two phone complaints, a lost destination list, and a security refresh — five releases in one day (v3.2.85–89).** The nightly robot went bankrupt at Bank Review by pushing back with ~$0; root cause was Try Again keeping a loan's up-front interest while taking the loan back. Tom's rule — push-back tears up a deal nobody accepted; its quote comes back, "if work was done there should be some monetary penalty" — shipped as `try_again_fee_share` (v3.2.85). Then the five real-TV reports (saved size everywhere, resize before game, popup under its button, TV wake lock, camera keeps your own space on screen — v3.2.86), the missing DOB/FDNY tags and illegible phone header buttons (v3.2.87), the destination list that vanished after 5 minutes at a space (v3.2.88), and nodemailer 10 (a high-severity advisory) + vitest 5 (v3.2.89).

## Health
- **Tests (v3.2.89):** `npm test` **453 files / 7065 tests green**, ghost gates **11 files / 43 tests green**, typecheck ✅, build ✅, `npm run lint` 0 errors (36 warnings). `npm audit` 0 vulnerabilities.
- **Deploy state:** v3.2.88 live; **v3.2.89 is pending deploy** (`ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`, then `/health` should say `4f00a6b` or the docs HEAD). A first deploy attempt this session pulled the code but did not rebuild the image — re-running `deploy.sh` fixed it; read its output.
- **Feedback dashboard:** 23 open after flipping ten fixed reports at Tom's word (several not yet seen on a real device — reopen if they disagree).
- **Weekly allowance (read 2026-09-30 mid-session):** Pro plan, 33% used; resets 2026-10-05.
- **Machine:** Node 24.10.0 (matches Dockerfile); the old "tests run on Node 20" note was stale.
- **Nightly robot:** Jarvis-repo items unchanged (`TAB_SUFFIX_RE` should accept both "tap to compare" and "tap to see the cost"). Not this repo.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.2.89, then look on a real TV + phone.** Wake lock and auto-center are the two fixes that cannot be proven without the TV.
2. **Decisions waiting on Tom:** the architect/engineer `try_again_fee_share` (currently 1); scope wording (fb:612fbdc4); whether action buttons should glow on later visits; the "?" placement go.
3. **fb:ab383e78** (contractor bankruptcy) still awaits Tom re-trying the contractor flow on a real device before it is flipped.
