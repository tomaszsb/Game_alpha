---
description: Wrap up the session — run the test suite, sweep documentation, write today's learnings into mcp__memory and CLAUDE.md so the next session starts smarter (the manual equivalent of Anthropic's "dreaming" feature).
---

End-of-session wrap-up for Unravel Codes. Run the dream-equivalent loop:

## 1. Pre-flight — run the full check suite

Run all three in sequence. Capture pass/fail counts and any new failures — they feed into the memory graph, the doc sweep, and the next-session starter prompt below.

```
npm run typecheck
npm run build
npm test                # full vitest suite — slow (~2 min) but catches cross-file ripples
```

**Why the full suite, not a smart-targeted subset:** the point of `/koniec` is to catch the regression a session author wouldn't have predicted. A targeted run keyed off "files changed this session" misses tests in unrelated files whose assertions pinned a string or behavior that today's work changed. 2 minutes is the cheap price for that safety.

**Capture for downstream steps:**

- Total tests, total failures, new failures vs pre-existing.
- For each new failure, the file:test_name and a one-line root cause (your guess, not a deep dive — defer the actual fix to the next session unless trivial).
- For pre-existing failures, note them once but don't re-investigate. Track them in TODO.md if not already there.
- Build/typecheck output: clean or specific errors.

**Don't fix failures during /koniec unless they're a 30-second obvious string update or version bump.** This is a reflection step, not a work step. If the suite is red and the fix is non-trivial, the starter prompt should say "tests red, here's where" so next session can resume cleanly. Blocking on green at wrap-up time pushes work past the user's intended stopping point.

If a failure shows that today's session shipped a regression that's already in production, flag it in the summary report at the bottom — that's higher signal than the test count alone.

## 2. Update the memory graph (`mcp__memory`)

**Search first, then write — never duplicate.**

- Search `mcp__memory__search_nodes` for "Session" to find today's session entity. The naming convention is `Session YYYY-MM-DD (vX.Y.Z)` where X.Y.Z is the version that shipped.
- If today's session entity exists: `mcp__memory__add_observations` to append what shipped, what's open, what's deferred, **and the test-suite status** (pass count, new failures with one-line cause).
- If today's session entity does NOT exist: `mcp__memory__create_entities` to create one, with `entityType: "session"`. Then `mcp__memory__create_relations` linking it to `Unravel Codes` with relation `ships in`, and to any pattern entities the session applied or introduced.

**Patterns:**

- For each non-trivial pattern discovered today (CSV gotcha, file:formatter override location, deploy quirk, React-Flow trick, service-cycle gotcha, etc.), search the graph first.
  - If a matching entity exists, `add_observations` with the new detail.
  - If not, create a new entity. Use a short descriptive name (e.g. "Voice rule override chain", "React Flow custom node data injection"). `entityType` should be `pattern`, `data_schema`, `workflow`, or `service` as appropriate.
- Create relations linking new patterns to `Unravel Codes` and to related patterns.

**Skip the trivia.** Don't write entities for one-line fixes, typos, copy tweaks, or anything that won't help a future session move faster. The bar is: "would I want to find this in 3 months when I hit a similar problem?"

## 3. Documentation sweep

The reference-doc ownership map lives in the memory graph at `reference_docs`. Run `mcp__memory__search_nodes "reference_docs"` if you need a refresher on which doc owns what topic. For each doc below, ask: *did today's work change something this doc currently claims as fact?* If yes, update inline. If you're not confident the change is real or worth documenting, flag it in TODO.md rather than guessing.

**Per-release docs (must be current with the shipped version):**

- **`CHANGELOG.md`** — every shipped version needs an entry. If a hotfix landed (e.g. v2.63.4 after v2.63.3), it needs its own section, not an edit to the previous one. The body should explain *why* the change was made, not just what files changed — future-you reads this when investigating regressions.
- **`docs/user/RELEASE_NOTES.md`** — only if today's changes are visible to playtesters in a way they should know about. Don't mirror every CHANGELOG entry here.

**Living docs (only touch if today's work made them stale):**

- **`docs/core/CLAUDE.md`** — TACTICAL PATTERNS (Session Learnings) section. Add a new pattern only if it's broad enough that a fresh-context Claude benefits from it before even searching the memory graph (CSV gotcha that affects multiple features, formatter/override chain controlling many UI strings, deploy/build verification trick, Windows-vs-WSL quirk). Don't dump session-specific ship logs here — those belong in CHANGELOG and the memory graph's session entity.
- **`docs/core/PROJECT_STATUS.md`** — version number, tier completion, workstream status. If today shifted any of those, update.
- **`docs/core/ARCHITECTURE.md`** — only if a service boundary, data flow, or major file's role changed. Voice changes and UI tweaks don't belong.
- **`docs/core/BETA_PLAN_V3.md`** — only if a milestone moved (Tier completion, Workstream phase boundary, deferred items list changes).

**Skip docs that are still accurate.** A no-op pass on a living doc is a successful sweep, not a failure. Pollution from over-documenting is real.

## 4. Append new follow-ups to `TODO.md`

Anything discovered today that didn't ship and isn't already tracked. Use the existing TODO.md bucket structure (Voice-leak follow-ups, UX/layout, G-numbered playtester feedback, older items). **Also add:**

- Pre-existing test failures noticed during the pre-flight if they're not already in TODO.md.
- Living-doc updates that need a human eye to write rather than an inline guess.

## 5. Write the next-session starter prompt

**Resolve the main checkout's `.claude/` path first** — the current session may be running in a Claude Code worktree (CWD will contain `.claude/worktrees/<name>`), in which case writing to `.claude/NEXT_SESSION.md` relative to CWD lands inside the worktree and `/start` from the main checkout won't find it.

Steps:
1. `Bash: git rev-parse --show-toplevel` to get the current root.
2. If the path contains `.claude/worktrees/`, the main checkout is the part **before** that segment. Otherwise it's the current root.
3. Write to `<main-checkout>/.claude/NEXT_SESSION.md`, overwriting any previous content (this file is a rolling handoff, not a log).

The body should be tight and actionable so `/start` can surface it cleanly. Use this template:

```markdown
# Next session starter — written YYYY-MM-DD by /koniec

## State at handoff
- **Version:** vX.Y.Z (deployed / **pending deploy**)
- **Branch:** master, N uncommitted files / clean
- **Last shipped:** one-line summary of the most recent change set
- **Test suite:** N/N passing / **N failures (see below)** / pre-existing failures: N
- **Build/typecheck:** clean / errors in <file>

## Top 3 open items
1. **[Title]** — one-sentence context, what decision or work is needed.
2. **[Title]** — same.
3. **[Title]** — same.

## Test failures to address
(Skip this section if suite is green.)
- `tests/<path>.test.ts > test name` — one-line root-cause guess.

## Decisions waiting on the user
- [Decision needed] — list the options the user has been presented with.

## Suggested first move
Two or three sentences proposing what to tackle first, citing the open item or decision. Phrased as a question to the user when a choice is involved — never assume.

## Reminders
- Check `mcp__memory__search_nodes` for any topic before re-deriving it.
- Deploy command runs from Windows terminal, not WSL.
- (Any other session-specific gotcha worth a 5-second heads-up.)
```

Keep it under 35 lines total (the test-failures section can push past 30 when the suite is red). The point is "fresh-context me reads this in 15 seconds and knows exactly where to start" — not a full session recap. The full recap lives in the memory graph's session entity.

## 6. Summary report

End with a short summary (under 250 words):

- **Pre-flight:** typecheck clean / errors, build clean / errors, vitest N/N passing or N new failures (with file:test_name).
- **Memory graph:** N entities created, N observations appended, N relations added.
- **Documentation sweep:** which docs were updated (CHANGELOG, RELEASE_NOTES, CLAUDE.md TACTICAL, PROJECT_STATUS, ARCHITECTURE, BETA_PLAN_V3) and which were checked-and-found-current.
- **TODO.md:** N items appended / no change.
- **Next session prompt:** Written to `.claude/NEXT_SESSION.md` (or noted reason if skipped).
- **Status:** Anything the user should know before exiting (uncommitted work, undeployed build, pending decisions, regressions discovered too late to fix this session). Be honest if there's stale state — under-reporting here costs the next session real time.

After this command runs, the user typically follows with `/exit`. Don't run `/exit` yourself; just leave them with a clean handoff.
