---
description: Wrap up the session — run the test suite, update CHANGELOG / CLAUDE.md / NEXT_SESSION.md so the next session starts smarter.
---

End-of-session wrap-up for Unravel Codes. Tight loop — don't add ceremony.

## 1. Pre-flight — run the full check suite

```
npm run typecheck
npm run build
npm test                # full vitest. Hangs on Windows per CLAUDE.md memory —
                        # run in background, fall back to a targeted sweep if it
                        # doesn't return within ~3 min.
```

The point of the full suite is catching cross-file ripples a session author wouldn't predict. If Windows-hang forces the targeted fallback, run the same set the koniec sweep historically uses: `tests/components/ tests/utils/ tests/services/` — that catches ~90% of the relevant surfaces.

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

| If this happened in the session | Update this |
|---|---|
| Shipped any version | `CHANGELOG.md` — one entry per version, explain *why* not just what |
| Shipped a user-visible feature/fix | `docs/user/RELEASE_NOTES.md` — only if a playtester needs to know |
| Discovered a cross-session pattern (gotcha, framework trick, deploy quirk, formatter chain) | `docs/core/CLAUDE.md` TACTICAL section — add a new subheading. Bump the footer charter version. |
| Version number changed | `docs/core/PROJECT_STATUS.md` — top-line version + 1–3 sentence blurb on the sprint |
| Service boundary / data flow / major file role changed | `docs/core/ARCHITECTURE.md` |
| Tier / Workstream / phase milestone moved | `docs/core/BETA_PLAN_V3.md` |

If none of those triggered, the sweep is done — skip the read entirely. A no-op pass that didn't read the docs is faster than a no-op pass that read and decided nothing changed.

**CHANGELOG inline during the session is best.** If you wrote entries as each version shipped, just verify they're current — don't rewrite.

## 4. Append new follow-ups to `TODO.md`

Things discovered today that didn't ship and aren't already tracked. Use the existing bucket structure. Also add:
- Pre-existing test failures noticed during pre-flight if not already tracked.
- Living-doc updates that need human judgment rather than an inline guess.

If nothing new — skip. Don't write a "no changes" line.

## 5. Write the next-session starter prompt

Resolve the main checkout's `.claude/` path: `git rev-parse --show-toplevel`. If the result contains `.claude/worktrees/`, take the segment before it. Otherwise use the root directly. Write to `<main-checkout>/.claude/NEXT_SESSION.md`, overwriting (this file is a rolling handoff, not a log).

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

## Test failures to address
(Skip section if green.)
- `tests/<path> > test name` — one-line root-cause guess.

## Decisions waiting on the user
- [Decision] — options the user has been presented with.

## Suggested first move
2–3 sentences, phrased as a question when a choice is involved.

## Reminders
- Deploy command runs from Windows terminal, not WSL.
- (Any session-specific gotcha worth 5 seconds.)
```

The point: "fresh-context me reads this in 15 seconds and knows exactly where to start." Full recap is in CHANGELOG + memory graph; this is just the handoff.

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

## 6. Three-line wrap, then stop

End with three lines. No structured summary report — the user is about to `/exit` and the next `/start` will surface everything actionable.

```
Pre-flight: <typecheck>, <build>, vitest <N/N> (or N failures).
NEXT_SESSION.md written. <doc updates: brief>.
<Blocker, if any — uncommitted work, undeployed build, regression discovered too late>. Otherwise: clean handoff.
```

Don't run `/exit` yourself.
