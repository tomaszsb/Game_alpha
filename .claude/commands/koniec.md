---
description: Wrap up the session — run the test suite, update CHANGELOG / CLAUDE.md / NEXT_SESSION.md so the next session starts smarter.
---

End-of-session wrap-up for Unravel Codes. Tight loop — don't add ceremony.

## 1. Pre-flight — run the full check suite

```
npm run typecheck
npm run build
npm test                # full vitest, backgrounded — takes ~10-12 min, NOT hung.
                        # 3 ghost-bot simulation tests each run 50 full games
                        # and take 460-500s apiece; that's most of the runtime.
                        # (2026-07-10 correction: an earlier version of this
                        # skill said "hangs on Windows... fall back if it
                        # doesn't return within ~3 min" — that was wrong. A
                        # session that gave up at 4 min and fell back to a
                        # targeted sweep missed that the backgrounded run
                        # finished clean at 636s, and had already written
                        # "full suite hung" into PROJECT_STATUS.md/
                        # NEXT_SESSION.md before the correction was caught.
                        # Only treat it as actually hung past ~15 min.)
```

The point of the full suite is catching cross-file ripples a session author wouldn't predict. Start it backgrounded early (step 1, before the memory/docs work below) so the ~10-12 min runtime overlaps with everything else in this skill — check back at the end rather than blocking on it. If it genuinely hasn't returned by ~15 min, fall back to the targeted sweep: `tests/components/ tests/utils/ tests/services/` — that catches ~90% of the relevant surfaces.

**Capture for downstream:**
- Total tests, total failures, new failures vs pre-existing.
- For each new failure: `file:test_name` + one-line root-cause guess. **Do not fix unless trivial (30s string update).** Block-on-green at wrap-up pushes work past the user's stopping point.
- If a failure indicates a regression already shipped to production, flag it loudly in the final summary.

## 2. Update the memory graph — minimally

**The memory graph is for cross-session patterns the next session needs to surface via search.** It is NOT a duplicate of CHANGELOG. The ship log already lives there with file links and reasoning.

### 2a. Session entity — keep tiny

Search `mcp__memory__search_nodes` for the specific session entity name you're about to write (`Session YYYY-MM-DD (vX.Y.Z)`). One search, exact name. If hit → `add_observations`. If miss → `create_entities`.

The session entity should contain ONLY:
- Name: `Session YYYY-MM-DD (vX.Y.Z)` where X.Y.Z is the last version shipped.
- 1 observation: `"Shipped vX.Y.Z, see CHANGELOG.md for per-version detail."`
- 0–3 additional observations ONLY if they're *meta* facts not captured by CHANGELOG:
  - Strategic arc (`"Session arc: bug-fix → feature → wisdom layer"`)
  - Verified non-bugs (`"Suspected X was double-counted; verified at file:line it's not"`) — these are valuable because future-you might suspect the same thing
  - Failed approaches that should NOT be retried
  - Anything that took >30 min to figure out and isn't a code change

Skip everything else. If you find yourself paraphrasing CHANGELOG content into an observation, stop — the next session will read CHANGELOG.

Create one relation: `Session ... → Unravel Codes (ships in)`.

### 2b. Patterns — CLAUDE.md is the home, not memory graph

Cross-session patterns (formatter override chains, framework gotchas, deploy quirks, etc.) go in `docs/core/CLAUDE.md` TACTICAL section. CLAUDE.md is auto-loaded in the system prompt — no search cost, always visible. Memory graph patterns require an explicit search to find.

**Default: write the pattern to CLAUDE.md TACTICAL, not memory graph.** Use memory graph only when:
- The pattern is too specific or numerous for CLAUDE.md (e.g. per-bug repro recipes, per-space data oddities)
- It's a long-tail pattern that 99% of sessions won't need but the 1% will benefit from full detail
- You're updating an existing memory entity that's already used by other patterns

For new patterns going to CLAUDE.md: write directly into the TACTICAL section (step 3 below covers this).

**Skip the trivia in both places.** Bar: "would I want to find this in 3 months when I hit a similar problem?"

## 3. Documentation sweep — trigger-based, not checklist

Don't read every doc. React to what changed this session.

**One summary, the right home — do NOT re-summarize the session into every doc.** Each living doc has ONE distinct job. A full prose summary belongs in exactly two places: CHANGELOG (technical) and RELEASE_NOTES (player-facing) — and only if it triggered. Everything else is a *short pointer or snapshot*, never a re-narration of the changelog.

| If this happened in the session | Update this | How |
|---|---|---|
| Shipped any version | `CHANGELOG.md` | **append** one entry per version, explain *why* not just what. The canonical technical record + the home for all history. |
| Shipped a user-visible feature/fix | `docs/user/RELEASE_NOTES.md` | **append** a release intro — plain-language, player audience, different voice from CHANGELOG. Only if a playtester needs to know. |
| Discovered a cross-session pattern (gotcha, framework trick, deploy quirk) | `docs/core/CLAUDE.md` TACTICAL section | **append** a new subheading. Bump the footer charter version (a 2-line pointer, not a summary). |
| Version number changed | `docs/core/PROJECT_STATUS.md` | **REPLACE the snapshot — never prepend.** ~15 lines: version + 2–3 sentence *current-sprint* blurb + test/build health + top-3 open items. It is "where are we NOW," NOT a log. CHANGELOG owns per-version history. If you see a "Prior summary retained below" tail or the file is >5KB, delete the history — it has rotted into a second changelog. |
| Service boundary / data flow / major file role changed | `docs/technical/ARCHITECTURE.md` | edit in place |
| Tier / Workstream / phase milestone moved | `docs/core/BETA_PLAN_V3.md` | edit in place |

*(2026-07-06: ARCHITECTURE.md path corrected from `docs/core/` to `docs/technical/` — the file actually lives there; the old path would have silently skipped this row's trigger since the file "didn't exist" at the listed location.)*

If none of those triggered, the sweep is done — skip the read entirely. A no-op pass that didn't read the docs is faster than a no-op pass that read and decided nothing changed.

**CHANGELOG inline during the session is best.** If you wrote entries as each version shipped, just verify they're current — don't rewrite.

## 4. Prune completed items from `TODO.md`, then append new follow-ups

**Prune first — this is load-bearing.** TODO.md's own rule is "completed → CHANGELOG; this file holds ONLY current/future work." So every item finished this session whose work you just wrote into CHANGELOG (step 3) must be **DELETED from TODO.md — not merely checked off `[x]`.** A checked-off item still sitting in the file is the bug: marking ≠ removing, and that gap let 248 completed items accumulate back to March (cleaned 2026-06-28). While you're in the file, do a quick safety sweep: any stray `[x]`/`✅` items from prior sessions whose version is already in CHANGELOG → delete those too. If you can't confirm an item actually shipped, **leave it** and note it for next session rather than guess (user rule 2026-06-28).

After this step the only checkboxes left should be `[ ]` (pending) and `[~]` (in-progress). If you ever see `[x]` survive a `/koniec`, this step didn't run.

**Enforce the slimness contract (added 2026-07-10 — the file had regrown to 306 lines / ~26K tokens, past the Read cap, mostly from preamble recaps of shipped work):**
- Section preambles are **ONE pointer line max** ("history: CHANGELOG v3.0.91–98"). If a preamble has grown a "Shipped vX: …" narration, cut it to the pointer — CHANGELOG owns that story.
- Items that are trigger-gated / deferred / "revisit if noticed" belong in the **🅿️ Parking lot** section at the bottom, not in active sections. New follow-ups you append this step: ask "does this have a near-term action, or a trigger?" and file accordingly.
- Size guard: active portion (above the Parking lot) over ~150 lines, or whole file over ~250 lines → trim as part of this step and mention it in the step-6 wrap line.

**Then append** things discovered today that didn't ship and aren't already tracked. Use the existing bucket structure. Also add:
- Pre-existing test failures noticed during pre-flight if not already tracked.
- Living-doc updates that need human judgment rather than an inline guess.

If nothing new to append — skip. Don't write a "no changes" line.

## 5. Write the next-session starter prompt

Resolve the main checkout's `.claude/` path: `git rev-parse --show-toplevel`. If the result contains `.claude/worktrees/`, take the segment before it. Otherwise use the root directly. Write to `<main-checkout>/.claude/NEXT_SESSION.md`, overwriting (this file is a rolling handoff, not a log).

**Load-bearing:** the `written YYYY-MM-DD` date on line 1 of the template below is what `/start`'s monthly maintenance gate reads to decide when to fire the feedback sweep + drift check. Keep it accurate and in that exact format — if it's missing or unparseable, `/start` just skips the monthly pass (it never nags), so feedback could rot silently.

**Reference only durable, committed artifacts in the handoff** — never a `.claude/tmp/` path or an uncommitted/never-saved plan file; they get swept or never exist, and the next session wastes time hunting. Inline the key points instead, or point at a committed doc. (2026-06-20: a prior handoff cited `.claude/plans/replicated-baking-hoare.md` that never existed — cost a hunt before the plan was reconstructed from code.)

Template — keep under 35 lines:

```markdown
# Next session starter — written YYYY-MM-DD by /koniec

## State at handoff
- **Version:** vX.Y.Z (deployed / **pending deploy**)
- **Branch:** master, N uncommitted / clean
- **Last shipped:** one-line summary
- **Test suite:** N/N passing / **N failures (see below)** / pre-existing: N
- **Build/typecheck:** clean / errors in <file>

## Top 3 open items
1. **[Title]** — one-sentence context.
2. **[Title]** — same.
3. **[Title]** — same.

(If an item carries a root-cause theory that was never reproduced this session, label it
"hypothesis — unverified", never as settled fact. 2026-06-12: a confident AnimatePresence
diagnosis written at handoff turned out wrong on live repro — the real cause was backdrop
click-through; presenting it as settled nearly shipped a fix that wouldn't have fixed the bug.)

## Test failures to address
(Skip section if green.)
- `tests/<path> > test name` — one-line root-cause guess.

## Decisions waiting on the user
- [Decision] — options the user has been presented with.

## Flip after deploy
(Skip section if the shipped version is already deployed or no fb reports were closed.)
- fb:<full-id>, fb:<full-id> — fixed in vX.Y.Z; PATCH resolved once that version is confirmed live.

## Suggested first move
2–3 sentences, phrased as a question when a choice is involved.

## Suggested model for next session
One line: model name + why, sized to what the top-3 items actually need.

## Reminders
- Deploy command runs from Windows terminal, not WSL.
- (Any session-specific gotcha worth 5 seconds.)
```

The point: "fresh-context me reads this in 15 seconds and knows exactly where to start." Full recap is in CHANGELOG + memory graph; this is just the handoff.

**Filling in "Suggested model for next session" (added 2026-07-05, user request):** default to **Sonnet 5** — it's the coding/agentic workhorse (near-Opus quality on coding/debugging at a third of the price) and covers the overwhelming majority of sessions in this repo: feature work, bug fixes, refactors, investigation. Only suggest **Opus 4.8** when the top-3 items are genuinely long-horizon/autonomous (many hours of unsupervised execution, minimal expected human checkpoints) or need its deeper judgment on an architecturally ambiguous problem — not just "this feels hard." Only suggest **Fable 5** if a top-3 item is itself the hardest class of reasoning problem and the user would explicitly opt into the cost (~3x Opus, ~7x Sonnet) — it is never the default upgrade path. When in doubt, recommend Sonnet 5 and note that effort can be raised to `xhigh` first before reaching for a bigger model.

## 5a. Self-correction — did this session expose a flaw in `/start` or `/koniec`? (skip if not)

A 30-second reflection, strictly conditional. Did anything THIS session reveal a bug or missing check in the `/start` or `/koniec` skills *themselves* — not the project, the skill? Signals: a skill step gave a wrong/misleading result, made you redo work, matched the wrong thing, or baked in a false assumption.

Examples that triggered adding this step: (a) the `/start` fb-id matcher checked only one of TODO's two marker forms (`fb:<hex>` vs `fb:feedback-<ts>-<hex>`) → proposed already-tracked reports as "new candidates," burning a full reconciliation (2026-06-09); (b) the dashboard PATCH sweep flipping a *data-fix* report resolved when the data wasn't actually live (the data-deploy gap — "fixed in code ≠ live" for CSV data).

If yes → **fix it directly** in `.claude/commands/start.md` / `.claude/commands/koniec.md` (or the CLAUDE.md note the step leans on), with a dated one-line rationale so the fix isn't silently reverted. These are self-correcting skills: a process bug caught once should never recur. The skill-file edits get committed in step 5c (its `git add` includes `.claude/commands/`).

If nothing surfaced (most sessions) → **skip silently.** Do NOT invent a "change" to satisfy the step — the bar is "a real flaw bit me this session," not "polish for its own sake."

## 5b. Auto-sweep `.claude/tmp/` if it's accumulated

`.claude/tmp/` is gitignored — by convention it's scratch (feedback screenshots, debug artifacts, one-off scripts). Auto-clean when either threshold trips. Nothing tracked lives here, so a delete can't lose anything that mattered.

```bash
# Threshold check: >10 files OR anything older than 30 days
if [ -d .claude/tmp ]; then
  count=$(find .claude/tmp -maxdepth 2 -type f 2>/dev/null | wc -l)
  stale=$(find .claude/tmp -maxdepth 2 -type f -mtime +30 2>/dev/null | wc -l)
  if [ "$count" -gt 10 ] || [ "$stale" -gt 0 ]; then
    oldest_days=$(find .claude/tmp -maxdepth 2 -type f -printf '%T@\n' 2>/dev/null | sort -n | head -1 | awk -v now=$(date +%s) '{printf "%d", (now-$1)/86400}')
    rm -rf .claude/tmp/*
    echo "🧹 Cleaned .claude/tmp/ ($count files, oldest ${oldest_days}d)"
  fi
fi
```

Mention the cleanup in step 6's wrap line if it fired. Otherwise silent — no need to report a no-op.

## 5c. Commit the wrap-up — don't leave docs dirty

The doc sweep + NEXT_SESSION must not drift into next session uncommitted (that's how `/start` ends up flagging mystery "uncommitted changes" and nobody knows what shipped). Commit the wrap-up artifacts and push.

```bash
git add CHANGELOG.md TODO.md docs/ .claude/NEXT_SESSION.md package.json package-lock.json
git add .claude/commands/    # ONLY if step 5a edited a skill file — else skip this line
git status --short            # eyeball what's staged
```

- **Stage only the wrap-up + already-intended files** (living docs, NEXT_SESSION, version bump). Do NOT `git add -A` blindly — if there is *other* uncommitted work in the tree (un-committed source changes the session never committed), that is a **blocker**, not something to bundle. Leave it unstaged and call it out loudly in the step-6 wrap line.
- Commit: `docs: /koniec sweep for vX.Y.Z` (+ the standard `Co-Authored-By` trailer).
- Push: `git push origin master`, then verify `git log origin/master..master` is empty. This project deploys from master via `git pull`, so an unpushed commit is its own kind of drift.
- `.claude/settings.local.json` is local machine config — include it only if it changed meaningfully; it's fine to leave.

## 6. Three-line wrap, then stop

End with three lines. No structured summary report — the user is about to `/exit` and the next `/start` will surface everything actionable.

```
Pre-flight: <typecheck>, <build>, vitest <N/N> (or N failures).
NEXT_SESSION.md written. <doc updates: brief>. Wrap-up committed + pushed (or: nothing to commit).
<Blocker, if any — uncommitted SOURCE left in tree, undeployed build, regression discovered too late>. Otherwise: clean handoff.
```

Don't run `/exit` yourself.
