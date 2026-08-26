# Next session starter — written 2026-08-26 by /koniec

## State at handoff
- **Version:** v3.2.42 — **deployed and confirmed live** (`/health` → `e6f6330`; bundle carries `3.2.42` and the `tv-history-feed` marker). v3.2.39–42 all went out in one deploy.
- **Branch:** master, clean and pushed (untracked `idea.txt` is the maintainer's own draft — leave it).
- **Last shipped:** one shared history feed across the TV, phone panel, shared-screen Log and end-of-game viewer, differing only by opening filter (v3.2.38); SPACE_EFFECTS read by header name (v3.2.39); accessible names across the space editor (v3.2.40) and its dice-outcome table (v3.2.42); teachers can change what a space says again, on their own card only (v3.2.41).
- **Test suite:** `npm test` **3016/3016** (198 files). `npm run test:ghost` **33/33** (10 files, 872s). smart-bot 47/50 wins, **0 hard failures**, deterministic — identical numbers to every run since 2026-08-17, so this session's five versions caused no behavioral drift.
- **Build/typecheck/lint:** all clean.

## Top 3 open items
1. **Look at the TV history column on a real television.** It takes 260px of the TV's 960px width; the 📜 History button in the header hides it. Verified at exactly 960×540 in a browser — 260px column, 700px board, no overflow, chips filter live, toggle returns the full 944px board. What a browser cannot answer is whether the board stays readable *across a room*, and the TV-fit history behind fb:3f9f2831 / fb:28512320 says that matters. If it's tight, the fix is one line: default `showHistory` to false in `TVDisplay.tsx`.
2. **Two things only a real click settles.** v3.2.37's click-a-field-to-light-the-panel and v3.2.34's Tab order were both verified by *dispatching* the events a browser sends, never by a real click — the Browser pane never holds keyboard focus, so `.focus()` moves `activeElement` while firing zero focus events (root cause in CLAUDE.md TACTICAL). Add a third: v3.2.42 changed a `<span>` to a `<label>` in the dice-outcome table and was deliberately not eyeballed; the style sets `display:flex` explicitly so it should be identical, but that's reasoning, not seeing.
3. **Teachers reach the new editor through Classroom Setup, not the merged admin screen** — so they get the deck and the six wording fields, but not the player-view preview the admin gets. Tracked as follow-up (ii) on the card-library item in TODO.md. Note also that no teacher account exists in production; the boundary was proven against a throwaway local server, not live.

(Not exhaustive — this is a shortlist. `TODO.md` holds 15 active items and a 51-item parking lot.)

## Test failures to address
None outstanding. **One real regression was caught and fixed during this wrap-up:** v3.2.41's `ClassroomSetup` editing pane made the component require the service container, and `ClassroomSetup.test.tsx` renders it bare — all 10 tests threw "must be used within a ServiceProvider". Fixed by wrapping those renders in a `GameContext.Provider`. It is **not** a production bug: `App.tsx` mounts `ServiceProvider` above `AppContent`, and PlayerSetup → AdminToolsPanel → ClassroomSetup sits inside it.

**Worth knowing:** that regression passed **22/22 batches**, because `run-tests-batch-fixed.sh` enumerates test files explicitly and never lists `tests/components/classroom/`. Only the full `npm test` caught it. Filed in TODO; treat "22/22 batches" as a subset signal from now on.

## Decisions waiting on the user
- **Card library Stage 4 — the group/school tier.** Explicitly deferred 2026-08-25 ("skip the middle shelf"), not rejected. Revisit when a real school has several teachers retyping the same fix; the `group` tier is a valid value nothing writes, so adding it later is additive, not a migration.
- **`DataEditor` is unreachable but deliberately still in the tree** as a fallback — delete once the merged screen is confirmed good in real use.

## Held from cleanup
- `.claude/worktrees/objective-khayyam-7de70a` — **HELD**: 0 unique commits (merged), but 3 dirty files beyond `settings.local.json`. Its content was copied onto master and verified byte-identical before v3.2.42 landed, so nothing is at risk; it was left because the spawned session that owns it may still be open. Once you know it's closed: `git worktree remove --force .claude/worktrees/objective-khayyam-7de70a && git branch -D claude/objective-khayyam-7de70a`.

## Suggested first move
Two minutes on a real TV settles item 1, and it's the only thing in this batch that could need a change before anyone else sees it. Ask him what the history column does to the board across a room — and whether the filter chips read as an invitation or as clutter, since that's the half no test can measure.

## Suggested model for next session
Sonnet 5 — the open items are scoped (a one-line default, a batch-script glob, the sibling CSV parsers with a working helper to copy). No architectural ambiguity left; Stage 4 is deferred by decision, not blocked. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand it over — he ran it himself this session.
- **`io.open(p,'w')` truncates before it writes.** A patch script that raises mid-write leaves the file EMPTY — it destroyed a 3435-line committed doc this session (recovered via git). Prefer the `Edit` tool; if a script must write, encode-check the string first. Now in CLAUDE.md TACTICAL, along with the surrogate-pair emoji trap that caused the raise.
- PowerShell here-strings (`@'…'@`) are not Bash. Use a heredoc or `git commit -F <file>` — a stray `@` leaked into a commit subject this session.
- `tests/server/pipelineFaithful.test.ts` is load-bearing. If it fails, fix the pipeline or add a SOURCE column — never edit a generated `CLEAN_FILES` file.
- The `/fixloop` budget meter was at ~3.9% of a 28.57% day-2 cap when the loop stopped. It stopped on judgement, not budget — see the memory-graph session entity for why the teacher branch was refused autonomously.
