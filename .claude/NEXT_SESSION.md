# Next session starter — written 2026-09-01 by /koniec

## State at handoff
- **Version:** v3.2.44 — **PENDING DEPLOY.** Live is still v3.2.43 (`c88b222`).
- **Branch:** master, clean and pushed. One untracked file: `idea.txt` (the maintainer's own draft — leave it).
- **Last shipped:** v3.2.44 — a bug report's unread second half, and the four fixes it was asking for. The triage API never returned `extra`, so fb:93449bf2 was fixed and closed on its one-line summary while the substantive paragraph went unread. Fixed the pipe, then: TV header 129px→77px (was clipping the last player chip), `devicePixelRatio` now in bug reports, a viewer-facing TV screen-size choice, and a zoom floor for the TV board.
- **Test suite:** `npm test` **3082/3082 across 201 files** (was 3043/198). `npm run test:ghost` **33/33 across 10 files** (856s) — green, both 50-game bots cleared their win-rate floors. No failures, none pre-existing.
- **Build/typecheck/lint:** all clean. The one `TVDisplay.tsx` lint warning is pre-existing (confirmed against HEAD).

## Top 3 open items
1. **Deploy v3.2.44, then actually look at the TV.** Four of its five changes only mean anything on real hardware, and **two are explicitly unverified**: the screen-size calibration correctly refuses to render on a desktop (ratio 1, no headroom), so only its gating was seen; and the board zoom floor never executed at all — the React Flow camera stayed at the untouched identity transform, the documented board-camera wall. New footer link: **"Adjust screen size."**
2. **Decide who the game is for.** From fb:8ad42b52's newly-readable `extra`: insiders (keep the jargon, lean into edge-case events) or broader players (tutorial, tooltips, plain-language micro-lessons). "Onboarding Phase C" in the Parking lot silently assumed the second answer, and this gates it. **This is his call, not a technical one.**
3. **Engagement tracking cannot tell the maintainer apart from a real player.** The 2026-08-15 "join-friction is the bottleneck" verdict is **RETRACTED** — his words: *"the games are usually one player because i usually have one person testing them out."* The filter excludes only the Claude/agent UA. Until sessions are attributable (a test flag at game creation, or excluding his home IP the way the foreign-game alert already does), this dataset answers nothing. Don't cite the old read.

(Not exhaustive — `TODO.md` holds the full list; 79 active lines after this session's prune.)

## Test failures to address
None outstanding.

## Decisions waiting on the user
- **The audience fork above (item 2)** — the one that unblocks real work.
- **Card library Stage 4, the group/school tier.** Deferred 2026-08-25 ("skip the middle shelf"), not rejected. `group` is a valid tier nothing writes, so adding it later is additive.
- **`DataEditor` is unreachable but deliberately still in the tree** as a fallback — delete once the merged screen is confirmed good in real use.

## Flip after deploy
- **fb:93449bf2 — do NOT flip on deploy alone.** It was deliberately **re-opened** this session: v3.2.43 had resolved it on half its content. v3.2.44 addresses the other half, but the whole point is that a browser cannot judge it — flip only after he confirms the TV reads well across a room.
- Nothing else pending. Three reports whose `extra` surfaced new work (fb:f22035af, fb:8ad42b52, fb:ae480630) are now tracked in TODO and stay open as real work, not as unflipped fixes.

## Held from cleanup
- `.claude/worktrees/objective-khayyam-7de70a` — **still held**, third session running. Gates: 0 unique commits, cold since 2026-08-25, but 3 dirty files trip gate 2. All three were re-verified byte-identical to master **again** this session, so nothing is at risk; the gate is mechanical, not a real doubt. Clear it whenever: `git -C <wt> restore .claude/settings.local.json`, `git worktree remove <wt>`, `git branch -d claude/objective-khayyam-7de70a`, `git worktree prune`.

## Suggested first move
Hand him the deploy command, then ask what the TV looks like — specifically whether the top bar now leaves the board enough room, and what he picks in "Adjust screen size." That single answer decides whether the 1280 default is right. Item 2 is worth raising in the same breath, since it's a question only he can answer and it's blocking real work.

## Suggested model for next session
Sonnet 5 — the open items are a deploy, a look at a television, and a product question for the maintainer. No architectural ambiguity. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand it over — don't run it.
- **The TV reporting `960x540` is NOT low resolution.** `screen.width × devicePixelRatio` = 3840; the panel is 4K and nothing is blurry. What's small is the layout budget. Corrected in CLAUDE.md 3.84 — the old note said "renders at reduced resolution" and that wrong model cost two sessions.
- **Reaching TVDisplay locally:** navigating to `?g=<id>&mode=tv` resets the game to SETUP (TV mode hard-blocks until a phone joins). What works is finding a game already in PLAY in `server/data/games.json` and using its stored `token` in the URL.
- **`io.open(p,'w')` truncates before it writes.** A patch script that raises mid-write leaves the file EMPTY. Prefer `Edit`; encode-check the string first if a script must write.
- PowerShell here-strings (`@'…'@`) are not Bash. Use a heredoc or `git commit -F <file>` — and a heredoc carrying markdown with backticks/quotes can still break; write the file with `Write` and splice it instead.
- `tests/server/pipelineFaithful.test.ts` is load-bearing. If it fails, fix the pipeline or add a SOURCE column — never edit a generated `CLEAN_FILES` file.
- `npm test` is the commit gate; `npm run test:ghost` is separate and also required for any `src/`/`server/` change.
