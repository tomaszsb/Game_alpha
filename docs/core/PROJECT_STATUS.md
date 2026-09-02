# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 1, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.44** — built and tested, **NOT yet deployed**. Live is still v3.2.43 (`c88b222`).

## Current sprint
**2026-09-01 — one bug report's unread second half, and the four fixes it turned out to be asking for.** fb:93449bf2 arrived on 2026-08-30 with a one-line summary ("It is on but should be off") and a longer `extra` paragraph saying the TV lays out like a phone despite being a 4K panel. v3.2.43 fixed the one-liner and closed the report. The paragraph was never seen, because `GET /api/public/feedback/open` — the endpoint the `/start` sweep reads — **never returned `extra` at all**. Nothing failed; a response object quietly missing a key is indistinguishable from one that never had it.

v3.2.44 fixes the pipe first, then the substance. Restoring `extra` immediately surfaced that **42 of 222 reports carry text nobody in triage could see, 4 of them still open** — including a completely separate feature request buried inside the report that had been chased since July on its first line alone. Then the TV work the paragraph actually asked for: the header was measured at **129px of 540 (23.9%)** with the last player chip clipped mid-word, because the row was set not to wrap while its children were — so buttons broke their own labels three lines deep instead. Flipped, it is **77px (14.2%)** with nothing clipped. Bug reports now carry `devicePixelRatio`, so the next one says "3840x2160" instead of leaving it to be inferred. And a new viewer-facing screen-size choice (`utils/tvScale.ts`) replaces guessing: the app can measure the panel, but not how big it is or how far away you sit — so it asks, with samples drawn at the size each answer produces.

**A retraction also landed.** The 2026-08-15 engagement read — "the recurring blocker is a game never getting a second player" — is **withdrawn**. The maintainer, asked directly: *"the games are usually one player because i usually have one person testing them out."* The instrument filters only the Claude/agent user-agent and cannot exclude his own manual sessions, so "4 of 9 real games never got a second player" is un-interpretable, not a finding. Both conclusions drawn from it fall, including the basis for the D&D skin's hold.

## Health
- **Tests:** `npm test` **3082/3082 across 201 files** (was 3043/198) — 39 new tests, verified to bite by breaking `previewFontPx` on purpose (4 failed, including the one that would otherwise look fine on screen). Typecheck ✅, production build ✅, lint ✅ — the single remaining `TVDisplay.tsx` warning is pre-existing, confirmed against HEAD. `npm run test:ghost` — see NEXT_SESSION.md for this session's result.
- **Verification honesty:** of v3.2.44's five changes, three were measured directly (header geometry, API shape, metadata). **Two are unverified on real hardware:** the screen-size calibration correctly refuses to render on a desktop (ratio 1, no headroom to reclaim) so only its gating was seen; and the TV board zoom floor never executed at all, because the React Flow camera stayed at the untouched identity transform in this environment — the documented board-camera wall, not a regression.
- **Security:** `npm audit` 0 vulnerabilities.
- **Deploy:** ⚠️ **v3.2.44 is pending.** Live remains v3.2.43 (`c88b222`).
- **Dashboard feedback:** **7 open** (was 6). fb:93449bf2 was deliberately **re-opened** — it had been resolved on half its content, and the half that mattered is what v3.2.44 addresses.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.2.44, then look at the TV.** Four of its five changes only mean anything on the real television — the header at 77px, the new "Adjust screen size" choice in the footer, and whether the board's bigger tiles read across a room.
2. **Decide who the game is for.** Surfaced from fb:8ad42b52's newly-readable `extra`: insiders (keep the jargon, lean into edge-case events) or broader players (tutorial, tooltips, plain-language micro-lessons). "Onboarding Phase C" in the Parking lot silently assumed the second answer, and this gates it.
3. **Engagement tracking cannot tell the maintainer apart from a real player** — which is why the join-friction verdict was retracted. Until sessions are attributable (a test flag at game creation, or excluding his home IP the way the foreign-game alert already recognises it), this dataset cannot answer anything.
