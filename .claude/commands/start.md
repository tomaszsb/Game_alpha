---
description: Begin a session — show the /koniec handoff and run a light briefing. Once a month (or with `/start full`) it also sweeps dashboard feedback and checks README/TODO drift.
argument-hint: "[full]"
---

Begin-of-session briefing. The user just typed `/start` — they want to know where things stand before they decide what to work on.

**This command auto-sizes.** Every session runs the light briefing (steps 1–3, then 5). The heavy periodic pass (step 4 — feedback sweep + README/TODO drift) fires on its own **only on the first session of a new month**, or any time the user runs `/start full`. Most sessions skip step 4 entirely. The monthly floor guarantees dashboard feedback never rots silently; `/start full` is the manual override for active stretches when you want a fresh pull now.

## 1. Read the starter prompt

`Bash: git rev-parse --show-toplevel` for the repo root. If the path contains `.claude/worktrees/`, the main checkout is the segment **before** that — `NEXT_SESSION.md` lives there, not in the worktree. Otherwise use the repo root directly.

Read `<main-checkout>/.claude/NEXT_SESSION.md` and present its contents verbatim under a clear heading. Don't paraphrase — the previous session wrote it specifically to be surfaced here.

If the file doesn't exist (first session or `/koniec` was skipped), say so honestly and continue.

**Cache two things from this file** — step 4 needs them: the "Top 3 open items" titles (for clustering) and the `written YYYY-MM-DD` date on line 1 (for the monthly gate).

## 2. One-paragraph recap

The actionable view is already in the starter prompt. This paragraph is the rear-view mirror — what shipped in the most recent session block. Pull from `CHANGELOG.md`: read the most recent version's entry (top of the file) and distill into 3–5 sentences covering what shipped, what's open or deferred, and anything that still needs user input.

Do not search the memory graph for this — the ship log lives in CHANGELOG. The memory graph is for cross-session patterns and meta observations, not per-session ship logs. Save it for step 4's clustering if you need a specific pattern.

## 3. Quick state checks (parallel, lightweight)

Single message, parallel tool calls so the user sees them fast:

- `git status --short` — flag uncommitted changes
- `git worktree list` — extras beyond the main checkout? If yes, run the stale-worktree sweep exactly as written in `/koniec` step 5b (three safety gates: merged into master, no dirty files beyond `.claude/settings.local.json`, cold >24h; restore-then-plain-remove, `git branch -d`). Report one line: `🧹 removed N stale agent worktree(s)` and/or `⚠️ held: <name> (<reason>)`. Only the main checkout (the common case) → stay silent. (Added 2026-07-18: 6 stranded copies had been inflating every repo search since May.)
- `Read package.json` lines 1–10 — pick up the version
- Match the version against the starter prompt's "pending deploy" claim
- **Flip-after-deploy (added 2026-07-10):** if the starter prompt has a "Flip after deploy" list AND the pending version is now confirmed live (user says so, or the live bundle shows it), PATCH those fb ids resolved (recipe in TODO.md "Dashboard PATCH recipe") and report the new open count. This is what keeps the dashboard's open list honest — fixed-but-unflipped reports had piled up to ~20 of 53 "open" by 2026-07-10.

Report each as a one-liner:

> - **Version:** v3.0.13 — pending deploy (last session flagged this).
> - **Uncommitted:** clean (only `.claude/settings.local.json`).
> - **Branch:** master.

## 4. Periodic maintenance — auto-gated (skip unless triggered)

**Run this entire step only if EITHER condition holds. Otherwise skip straight to step 5.**

- **Monthly trigger (compute, don't guess):** compare the **current month** (`YYYY-MM` of today's date, from the session context) against the **last-session month** — the `written YYYY-MM-DD` date on line 1 of `NEXT_SESSION.md` (cached in step 1). Same month → not triggered. Today in a **later** month (or `NEXT_SESSION` missing and the top `CHANGELOG` entry's date is a prior month) → triggered. If neither date is parseable, treat as **not** triggered — never nag.
- **Manual override:** the invocation included the `full` argument (`$ARGUMENTS` contains `full`) → triggered regardless of month.

If **not** triggered, print one line and go to step 5:

> Periodic maintenance not due (same month, no `full`) — skipping feedback sweep + drift check. Run `/start full` to force it.

Rationale: the feedback sweep used to run every session, which made `/start` heavy every time. Clustering still needs all open reports seen together — but seeing them once a month (plus `/start full` whenever you want a fresh pull) is enough, and it stops the per-session cost. The README/TODO drift check rides the same trigger so both heavy jobs fire together on the monthly pass. (Restructured 2026-06-27 — feedback sweep was every-session before; gated to monthly + `/start full` to cut the per-session cost.)

### 4a. README skim

`README.md` is a deliberate thin pointer (no version/counts/feature lists — those rot). Skim it against reality and flag ONLY if something structural broke: a doc it links to was renamed/moved (dead link), the one-paragraph "what this game is" description is no longer true, or the run-it-locally commands changed. If it's still accurate (the common case), say so in one line and move on. Do **not** re-pad it with version numbers or feature lists — that's the rot it was built to avoid.

### 4b. TODO drift triage

A deeper pass than the feedback sweep below. Read `TODO.md` and check the **unchecked `- [ ]` items** for drift:
- **Stale-done:** shipped in CHANGELOG but never checked off (e.g. a "Deploy vX" line when live is already past vX). → propose checking off / moving to CHANGELOG.
- **Superseded / won't-do:** items overtaken by later decisions, or that are really "flag only / accepted limitation / far-future wishlist" masquerading as active work.
- **Mis-bucketed:** genuine non-actions mixed in with active work, making the backlog look heavier than it is.

Propose a re-bucket: keep only *real, actionable, not-blocked-on-the-user* items at the top; gather the non-actions under a clearly labelled **"Parking lot / someday"** section so nothing is deleted but the active list reads honestly. **Same approval gate as the feedback sweep below — surface the proposed changes and wait for `yes / no / edit`; write nothing to `TODO.md` (or `README.md`) without an explicit OK.**

Keep it tight: this is a drift check, not a rewrite. If nothing drifted, one line ("Drift check: README + TODO still accurate, no drift") and continue to 4c.

## 4c. Feedback — token + fetch

```bash
grep '^FEEDBACK_TOKEN=' .env 2>/dev/null | cut -d= -f2-
```

If `.env` is missing or the line is empty, skip the rest of step 4 with `> Feedback fetch skipped — no FEEDBACK_TOKEN in .env.` Continue to step 5. Don't prompt the user — optional infrastructure.

```bash
curl -sS --max-time 10 "https://game.unravelcodes.com/api/public/feedback/open?token=<TOKEN>"
```

Use `curl` not WebFetch (Cloudflare blocks WebFetch on this domain). Non-200 → print status code, skip to step 5. Never block on fetch failures.

Response shape: `{ reports: [{ id, createdAt, whatDoing, whatWrong, contact, version, gitCommit }, ...], count }`.

### 4d. Reconcile + draft

Read `TODO.md`. For each fetched report:

- **Already tracked:** report's id appears anywhere in `TODO.md` → skip. ⚠️ **Match BOTH marker forms** — TODO mixes them: the full id `fb:feedback-<ts>-<hex>` AND the short hex suffix `fb:<hex>`. A report `feedback-1778583921001-0aa9660c` is tracked if EITHER `fb:feedback-1778583921001-0aa9660c` OR `fb:0aa9660c` appears. Grepping only one form (e.g. the short 8-char) silently misses every entry written in the other form → proposes already-tracked items as "new candidates." This burned a full reconciliation on 2026-06-09. Extract the trailing hex from each fetched id and check both.
- **New candidate:** draft a bullet in the existing style:

```
- [ ] **<short title from whatWrong>** — <one-line context from whatDoing>. <!-- fb:<id> -->
```

Group candidates by `createdAt` YYYY-MM-DD. Stage under `### Newly arrived (YYYY-MM-DD)` inside the Dashboard section.

### 4e. Cluster (this is the value)

Two passes, both cheap keyword-overlap heuristics. Lowercase, drop punctuation, drop stopwords (`the a an of for to in on and or`).

**Pass 1 — candidates vs top-3 starter items.** If a candidate shares 2+ tokens with a top-3 title, append:
```
🔗 may bundle with top-3: <top-item title>
```

**Pass 2 — candidates vs each other.** This is the change that catches sprints. For each pair of new candidates, if they share 2+ tokens OR share `version` field OR were filed within 6 hours of each other, group them. When a group of 2+ candidates emerges, surface it in the proposal:

```
🔗 cluster: 3 reports touch tile/board/arrow (fb:41e35769, fb:97fa9c75, fb:96317d74)
            → suggest a "board readability v2" mini-sprint
```

The cluster names itself from the shared tokens. Suggest a sprint label only when the cluster is ≥3 reports — pairs don't need it. This is hints-only — surface the overlap, let the user decide whether to actually bundle. Don't reorder or merge.

### 4f. Show proposed diff, wait for OK

Compact summary:

```
Dashboard feedback: N unresolved · M already tracked · K new candidate(s)
```

If K=0: `> No new feedback since last sweep.` then step 5.

If K>0, list each new candidate with the proposed bullet line, target bucket, and any 🔗 hints (both top-3 and cluster). Print any cluster blocks above the candidate list so the sprint suggestion lands first.

Cap inline preview at 10 candidates. If more, write the full proposal to `.claude/feedback-staged.md` and reference it.

End with:

> **Apply these K additions to TODO.md? (yes / no / edit)**

- `yes` → Edit TODO.md inserting bullets under target bucket(s).
- `no` or silence → leave TODO.md untouched (candidates reappear next monthly sweep / `/start full` until accepted or marked resolved on the dashboard).
- `edit` → ask which lines to change, apply approved subset.

**Do NOT** modify any existing TODO.md content in this step beyond the approved additions. No "mark done" sweeping — that belongs to mid-session or `/koniec`.

## 5. Hand control back to the user

Short open question — never assume what to work on. If step 4 ran and 4e surfaced a cluster, name it first:

- "The 🔗 cluster from step 4 (3 board-related reports) reads like a "board readability v2" mini-sprint. Want to tackle that, or pick from the top-3 open items?"
- "Want to start by committing v3.0.13 and pushing the deploy, or jump into the dashboard backlog?"

If step 4 was skipped (the common case), just hand back from the briefing — point at the top-3 open items and ask what to pick up.

Do not start any code work in this turn. `/start` is purely a briefing.
