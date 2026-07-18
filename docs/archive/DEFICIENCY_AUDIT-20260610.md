# Deficiency Audit — Unravel Codes

**Date:** 2026-06-10
**Audited version:** 3.0.70 (package.json)
**Scope:** Static audit of the codebase + build/test/lint/dependency health. This document lists deficiencies only — no fixes were applied.

> **Archived 2026-07-18** after a doc-vs-code sweep. Final disposition: DEF-1/2/5/6 resolved 2026-06-12 (noted inline); DEF-7 resolved (README rebuilt as a thin pointer; TODO/CLAUDE headers now maintained by `/koniec`); DEF-12 resolved v3.1.11 (ghost gates split out of `npm test`, ~99s now); DEF-3 mostly moot (the flagged panel sections were deleted with the classic panel v3.0.128–137) **except `DataEditor.tsx`, still open**; DEF-4/9/10/11 verified still open 2026-07-18 (lint still 386 errors; still 164 raw `console.*`; no `engines` pin; full-game E2E still skipped) — all open leftovers now tracked as one bundle in TODO.md (Architecture / code health). DEF-8/13 are accepted policy (TODO Bucket E / service-decomposition trigger).

---

## How to read this

Each item has a **severity** and a **confidence**:

- **Severity** — how much it could hurt: `High` (security exposure or latent crash), `Medium` (correctness/maintainability risk, or a broken dev tool), `Low` (hygiene / polish).
- **Confidence** — `Verified` (I read the exact code and confirmed it), `Likely` (strong signal, not exhaustively traced).

Health checks I ran this session, for context:

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | ✅ Clean, 0 errors |
| `npm run build` (vite) | ✅ Clean, builds in ~11.5s |
| Core service tests (StateService + CardService + MovementService) | ✅ 176/176 pass |
| Full test suite | Documented at 1628/1628 in PROJECT_STATUS; not re-run end-to-end here (the `npm test` parallel run buffers/can hang per CLAUDE.md — sampled batches pass) |
| `npm run lint` (eslint) | ❌ **386 errors, 17 warnings** (see DEF-3) |
| `npm audit` | ❌ **2 critical** (see DEF-1) |

---

## High severity

### DEF-1 — Two critical dependency vulnerabilities (`shell-quote` via `concurrently`)
**Severity: High · Confidence: Verified**

> **RESOLVED 2026-06-12.** `concurrently` pinned to 9.2.0 (exact) +
> `npm audit fix` for the transitive `shell-quote`. `npm audit` now reports
> **0 vulnerabilities**; `concurrently` verified working (9.2.0 runs the
> dual-command pattern the `dev` script uses).

`npm audit` reports 2 critical advisories: `shell-quote@1.1.0–1.8.3` (GHSA-w7jw-789q-3m8p, `quote()` does not escape newlines) pulled in transitively by `concurrently@9.2.1`.

- `concurrently` is a **devDependency** used only by `npm run dev`, so this is not a production-runtime exposure — but it is still a critical advisory in the tree.
- Fix is a `concurrently` downgrade to 9.2.0 (`npm audit fix --force` calls it "breaking," though 9.2.1→9.2.0 is a patch-level move). Worth verifying the `dev` script still runs after the bump.

---

### DEF-2 — WebSocket `subscribe` path does not check authentication (game state readable without token)
**Severity: High · Confidence: Verified**

> **RESOLVED 2026-06-12 (split decision).** The READ half is **intentional by
> design** per the maintainer: this is a classroom spectator game ("jack in
> the box" — others are supposed to look and watch), so tokenless subscribe
> stays open on purpose. The WRITE half was a real gap and is fixed:
> `state_push` previously only checked a boolean `authenticated`, so a valid
> token for game A authorized writes to game B. `state_push` now requires
> the token of the specific game being written (`authGameId` check in
> [server/websocket.js](../../server/websocket.js)). Pinned by
> [tests/server/websocketAuth.test.ts](../../tests/server/websocketAuth.test.ts)
> (spectator read works; spectator write rejected; cross-game write rejected;
> same-game write works).

In [server/websocket.js](../../server/websocket.js):

- Connection-time auth only rejects when a `gameId` **is present in the URL** but the token is wrong (`if (gameId && !authenticated)` at line 52). A client that connects with **no `gameId`** in the URL is allowed through with `authenticated = false`.
- The `state_push` (write) handler correctly gates on `clientInfo.authenticated` ([handleStatePush](../../server/websocket.js), ~line 231).
- **But the `subscribe` message handler does not.** `handleClientMessage` → `subscribeToGame` → `sendCurrentState` returns full game state with no auth check. So a client can connect bare, send `{type:"subscribe", gameId:"G123"}`, and receive the complete game state for any game id — even though the REST endpoint `GET /api/games/:id/state` requires the `X-Game-Token`.

This is a read-access bypass: the token gate on state reads is defeated over the WebSocket channel. Game ids are short and somewhat guessable/shared, so this widens exposure. Fix shape: have `subscribe`/`sendCurrentState` validate the token against the target game the same way `handleStatePush` does.

---

### DEF-3 — `react-hooks/rules-of-hooks` violations: `useMemo` after an early `return null`
**Severity: High · Confidence: Verified**

Several player-panel section components call a hook **after** an early return, which is a genuine React rules-of-hooks violation (not just a lint nit). If the guarded value ever flips between renders, React throws *"rendered more/fewer hooks than during the previous render"* and the component tree crashes.

Confirmed instances:
- [ProjectScopeSection.tsx](../../src/components/player/sections/ProjectScopeSection.tsx) — `useState` ×5 at lines 71–75, then `if (!player) return null` at line 79, then **`useMemo` at line 153** (after the return).
- [FinancesSection.tsx](../../src/components/player/sections/FinancesSection.tsx) — same shape: `useState` block, `if (!player) return null` at line 104, then `useMemo` (~line 121).
- ESLint also flags `ProjectLedger.tsx` and `DataEditor.tsx` with rules-of-hooks errors (37 total across 5 files).

In practice it has not crashed because `player` rarely transitions null→non-null mid-mount — but it is a real latent landmine, exactly the kind of thing that surfaces under a new render path (a player joining mid-game, a TEMP-state reset, etc.). Fix: move all hook calls above every early return.

---

## Medium severity

### DEF-4 — `npm run lint` is effectively dead: 386 errors, and lint is not in CI
**Severity: Medium · Confidence: Verified**

`npx eslint src/**/*.{ts,tsx}` returns **386 errors / 17 warnings**. Breakdown by rule:

| Count | Rule | Notes |
|---|---|---|
| 122 | `@typescript-eslint/no-unused-vars` | real dead bindings + some genuinely-unused imports |
| 84 | `no-undef` | **mostly false positives** — fires on TS type-only names like `JSX`, `NotificationPermission`, `NotificationOptions` because the flat config has no TS-type awareness / DOM lib globals |
| 37 | `react-hooks/rules-of-hooks` | see DEF-3 (real) |
| 33 | `react/no-unescaped-entities` | cosmetic (`'`/`"` in JSX text) |
| 29 | `@typescript-eslint/no-explicit-any` | overlaps the tracked "any types" Tier-4 work |
| 24 | `no-empty` | empty catch/blocks |
| 14 | `no-case-declarations` | `let`/`const` in `switch` cases without braces |
| 5 | misc (`no-irregular-whitespace`, `no-unreachable`) | |

Two problems compound here:
1. **The config is misconfigured for a TS codebase** — `no-undef` should be disabled for TS files (TypeScript already checks this; the rule can't see type-only identifiers), and the lint output is ~20% noise because of it. [eslint.config.js](../../eslint.config.js) sets no `parserOptions.project` and doesn't turn off `no-undef`.
2. **Lint is not a gate.** `test:ci` does not run lint, and with 386 errors `npm run lint` can't be used as a pre-commit gate even if someone wanted to. The result is that genuinely useful signals (the rules-of-hooks crashes in DEF-3, real unused vars) are buried and nobody sees them.

This is a "broken windows" situation: the lint tool exists but is unrunnable, so all the legitimate findings it would surface are invisible. Recommend: disable `no-undef` for TS, auto-fix the cosmetic rules, then triage the residue.

---

### DEF-5 — Admin debug endpoints fail open when `ADMIN_PASSWORD_HASH` is unset
**Severity: Medium · Confidence: Verified**

> **RESOLVED 2026-06-12.** Both `/api/debug/*` endpoints now use the shared
> `requireAdmin` guard ([server/authGuards.js](../../server/authGuards.js)):
> timing-safe comparison, and **503 fail-closed** when `ADMIN_PASSWORD_HASH`
> is unset. Unit-tested in [tests/server/authGuards.test.ts](../../tests/server/authGuards.test.ts);
> wiring pinned by [tests/server/serverEndpointAuth.test.ts](../../tests/server/serverEndpointAuth.test.ts).

In [server/server.js](../../server/server.js), `/api/debug/state` (line 1024) and `/api/debug/games` (line 1040) gate with:

```js
if (passwordHash !== CONFIG.ADMIN_PASSWORD_HASH) return res.status(401)...
```

When no `x-admin-password` header is sent, `passwordHash` is `''`. If `ADMIN_PASSWORD_HASH` env var is unset, `CONFIG.ADMIN_PASSWORD_HASH` is also `''` ([line 49](../../server/server.js)). Then `'' !== ''` is false → the check **passes** and the debug endpoints (which dump full game state) are exposed.

The primary `/api/admin/verify` and save/reset endpoints are safe from this because they additionally compare `inputHash.length === expectedHash.length` before `timingSafeEqual` (a 64-char hash can never equal `''`). The two `/api/debug/*` endpoints use a bare `!==` with no length guard, so they're the only ones that fail open. This only bites in a misconfigured deploy (no admin hash set), but it's defense-in-depth worth closing — reject when `CONFIG.ADMIN_PASSWORD_HASH` is empty, mirroring `/api/public/feedback/open`'s 503-when-token-unset behavior.

---

### DEF-6 — Feedback-read endpoints are unauthenticated; reports carry reporter PII
**Severity: Medium · Confidence: Verified**

> **RESOLVED 2026-06-12.** `GET /api/feedback`, `GET /api/feedback/:id`, and
> `PATCH /api/feedback/:id` now require either the admin password
> (`x-admin-password` header — used by the BugReportsPanel, which sits behind
> the admin unlock) or the `FEEDBACK_TOKEN` secret (query/bearer — used by
> maintainer session scripts for screenshot pulls and resolved-flips). 503
> fail-closed when neither secret is configured. `POST /api/feedback` (the
> in-game bug-report button) stays open by design. Guard logic in
> [server/authGuards.js](../../server/authGuards.js); wiring pinned by
> [tests/server/serverEndpointAuth.test.ts](../../tests/server/serverEndpointAuth.test.ts).

In [server/server.js](../../server/server.js):
- `GET /api/feedback` (line 1132) — lists **all** feedback reports, no auth.
- `GET /api/feedback/:id` (line 1157) — returns a full report including the base64 `screenshot`, `consoleLogs`, pruned `gameState`, **and reporter `contact` (name/email/phone)** when present — no auth.
- `PATCH /api/feedback/:id` (line 1176) — flips `resolved`, no auth.

The CLAUDE.md notes acknowledge these are intentionally open ("admin-write surface; open") and the token-gated `/api/public/feedback/open` exists for low-cost reads. But the per-id endpoint exposes reporter contact details and full screenshots to anyone who can enumerate the (timestamp + 8-hex) filenames. For a school-deployed game collecting names/emails, unauthenticated PII read is a privacy gap worth a deliberate decision rather than an inherited default. (The `POST` create endpoint being open is fine and expected — that's the bug-report button.)

---

### DEF-7 — Documentation version drift (README, CLAUDE.md operational header)
**Severity: Medium · Confidence: Verified**

Several living docs disagree on the current version:
- [README.md](../../README.md) says **Status: Beta (May 2026), Version 2.63.2, "99 test files"** — ~7 minor versions and ~28 test files stale (package.json is 3.0.70; there are 127 `.test.ts(x)` files).
- [docs/core/CLAUDE.md](../core/CLAUDE.md) workspace header says **"Beta (v3.0.39, late-May 2026)"** and **"29 services"**, **"115 test files"** — also stale relative to 3.0.70.
- PROJECT_STATUS.md and TODO.md are current (3.0.70 / well-maintained), so the project clearly maintains *some* docs per session but not these. README is the first thing a new contributor or evaluator reads, so its staleness has outsized cost.

TODO.md's own header is also stale: it says "Current Version: 2.66.3" at the top (line 5) while its body tracks work through 3.0.70.

---

### DEF-8 — Large untyped `any` surface remains (Tier 4 unfinished)
**Severity: Medium · Confidence: Verified**

27 `: any` / `as any` occurrences remain across `src` (consistent with the tracked Tier-4 "any types" workstream). Per the project's own TODO (Bucket E), ~15 are documented as intentional (idiomatic `catch (e: any)`, native-console signatures, Promise reject, open-bag metadata). That leaves a meaningful remainder of non-intentional ones, plus the 29 `no-explicit-any` lint errors overlap this. Not urgent, but it's the standing gap between the codebase and its stated "strict TypeScript, 0 `any`" goal. The card-data and effect-payload `any`s (`DataTypes.effectData: any`) are the ones most worth typing since they sit on the data→engine seam where past bugs clustered.

---

### DEF-9 — 164 raw `console.*` calls in `src` (bypass the debug-gating layer)
**Severity: Medium · Confidence: Likely**

There are 164 raw `console.log/warn/error` calls in `src` that are **not** routed through the `debugLog`/`debugWarn` gating utility. Heaviest concentrations: [EffectEngineService.ts](../../src/services/EffectEngineService.ts) (31), [TurnService.ts](../../src/services/TurnService.ts) (18), [GameRulesService.ts](../../src/services/GameRulesService.ts) (13), [CardService.ts](../../src/services/CardService.ts) (13), [GameLayout.tsx](../../src/components/layout/GameLayout.tsx) (10).

The project already has a debug-gating convention (the v3.0.35 work moved skip-action logs to `debugWarn` specifically to silence them in production). These 164 calls bypass that — they ship to the production console, add noise, and can leak state shape. Some are legitimate `console.error` in catch blocks, but the `console.log` share should go through the gate. Recommend a sweep that distinguishes intentional error logging from leftover debug prints.

---

## Low severity

### DEF-10 — No `engines` field in package.json
**Severity: Low · Confidence: Verified**

[package.json](../../package.json) declares no `engines.node`. The server is ESM + Express 5 (needs Node 18+), the toolchain (Vite 7, Vitest 4) needs Node 20+. Without an `engines` pin, a deploy/dev machine on an older Node gets cryptic failures instead of a clear `EBADENGINE` warning. Cheap to add.

### DEF-11 — Disabled / skipped tests with no tracking
**Severity: Low · Confidence: Verified**

[tests/E2E-FullGame.test.tsx:273](../../tests/E2E-FullGame.test.tsx) has `it.skip('should play through the game from START to FINISH')` — the one true full-game E2E is skipped. There's no `xfail`/owner note on it. It may be intentionally retired in favor of the ghost bot, but a skipped "full game" test with no comment is a coverage blind spot worth either deleting or re-enabling. (Also: [tests/E2E-04_EdgeCases.test.ts](../../tests/E2E-04_EdgeCases.test.ts) calls `process.exit()` in a few places — fragile in a runner context, worth a look.)

### DEF-12 — Stated test-run path is unreliable
**Severity: Low · Confidence: Verified**

CLAUDE.md and package.json both note that `npm test` (the documented default) "may hang — use batches instead," and the canonical path is a shell script (`tests/scripts/run-tests-batch-fixed.sh`) plus many granular `test:*` scripts. A test suite whose top-level `npm test` is known-flaky/hangy is a real friction point: CI uses a separate `test:ci` config, but a contributor running the obvious command gets a hang. Worth converging on one reliable invocation (the `vitest.config.ci.ts` sequential-forks setup runs reliably; consider making it the default).

### DEF-13 — Large service files (size-only, explicitly accepted)
**Severity: Low · Confidence: Verified**

The largest services are big: CardService.ts (2,260), TurnService.ts (2,187), StateService.ts (1,931), EffectEngineService.ts (1,515), MovementService.ts (1,290), DataService.ts (1,083). The project has a **deliberate, documented policy** not to split on size alone (TODO "Service decomposition — deferred pending concrete pain signal" + CLAUDE.md code-quality section). I'm listing this only for completeness — it is a known, reasoned trade-off, not an oversight. Flag it as a deficiency only if AI-context cost or a bug hot-spot ever clusters in one of these per `git blame`.

---

## Addendum — 2026-06-12 endpoint sweep (found + fixed beyond the original findings)

Closing DEF-2/5/6 prompted a full re-sweep of every `server.js` route. Four more
unauthenticated surfaces were found and fixed the same day (all pinned by
[tests/server/serverEndpointAuth.test.ts](../../tests/server/serverEndpointAuth.test.ts)
and live-smoke-tested against a running server):

1. **`DELETE /api/games/:gameId` and `DELETE /api/games/:gameId/state` had NO auth** —
   anyone who guessed a gameId could delete a game or wipe its board mid-class.
   Now `requireGameTokenOrAdmin`: that game's token (a player) or the admin
   password (the teacher). The admin Game Manager's reset button sends the header.
2. **`GET /api/games` (full game list) was public**, which defeated the
   join-by-code model: game codes are the join secret (`join-info` exchanges a
   code for the game's token), so a public list of all codes = write access to
   all games. Now admin-only; the only consumer (admin Game Manager) sends the header.
3. **`GET /api/logs` + `GET /api/logs/summary` exposed visitor IPs/devices (PII)** —
   same class as DEF-6. Now gated by admin password or `FEEDBACK_TOKEN`.
4. **Legacy `POST /api/gamestate` was an unauthenticated write; `DELETE` an
   unauthenticated reset** (single-game G0 era). POST now requires G0's token —
   which also converts the known "accidental legacy fallback" client bug from
   silent state corruption into a clean 401. DELETE is admin-or-token.
   `GET /api/gamestate` stays open (spectator-consistent).

**Deliberately still open** (design decisions, also pinned by test):
`POST /api/feedback` (bug-report button), `POST /api/games` (lobby create),
`GET /api/games/:gameId/join-info` (join-by-code — the game code is the secret),
`GET /api/gamestate`, `/health`, and WebSocket spectator reads (DEF-2 decision).

---

## Open items already tracked in TODO.md (not re-litigated here)

The project's [TODO.md](../../TODO.md) already carries **41 open checkboxes**, including substantive architectural debt that I'm not duplicating as new findings. The most load-bearing ones to be aware of:

- **Data-deploy gap** — CSV *data* fixes don't reach the live server on deploy (it preserves its writable working copy); needs the "teacher instance layer" master-library/per-instance split. Tracked; partially mitigated by manual sync.
- **Parallel-systems debts** — `notify`+`info` dual event channels, `money`+`moneySources` denormalization, three effect pipelines, the remaining state/log `TurnTransaction` unification. Each is a documented "two systems answer the same question, hand-synced today, drift trap tomorrow."
- **Onboarding/tutorial package** — recurring "overwhelming for newcomers" feedback theme; the biggest product lever.
- **Dependency majors deferred** — TypeScript 6, Vite 8, ESLint 10, jsdom 29 all parked pending ecosystem settling.

---

## Summary

| ID | Severity | One-liner |
|---|---|---|
| DEF-1 | High | ✅ Resolved 2026-06-12: `concurrently` 9.2.0 + audit fix → 0 vulnerabilities |
| DEF-2 | High | ✅ Resolved 2026-06-12: reads open BY DESIGN (spectator game); cross-game `state_push` write gap fixed |
| DEF-3 | High | `useMemo` after early `return null` in player-panel sections (latent React crash) |
| DEF-4 | Medium | `npm run lint` unrunnable (386 errors, misconfigured `no-undef`, not in CI) |
| DEF-5 | Medium | ✅ Resolved 2026-06-12: `/api/debug/*` now fail closed via shared `requireAdmin` guard |
| DEF-6 | Medium | ✅ Resolved 2026-06-12: feedback reads/PATCH gated by admin password or FEEDBACK_TOKEN |
| DEF-7 | Medium | README + CLAUDE.md header + TODO header version drift |
| DEF-8 | Medium | Untyped `any` surface remains (Tier 4 unfinished) |
| DEF-9 | Medium | 164 raw `console.*` calls bypass debug gating |
| DEF-10 | Low | No `engines` pin in package.json |
| DEF-11 | Low | Skipped full-game E2E with no tracking; `process.exit()` in a test |
| DEF-12 | Low | Documented-default `npm test` is known to hang |
| DEF-13 | Low | Large service files (explicitly accepted policy — informational) |

**Overall:** the production build, typecheck, and sampled tests are healthy, and the project keeps disciplined session docs (PROJECT_STATUS, TODO, CLAUDE.md tactical notes). ~~The findings worth acting on first are the two security gaps (DEF-2 WebSocket auth, DEF-6 feedback PII)~~ *(both closed 2026-06-12 — DEF-2's open reads ruled intentional spectator design, its cross-game write gap fixed; DEF-5 closed in the same pass)*. Next up: the latent React hook-ordering bug (DEF-3) and rehabilitating lint (DEF-4) so its real signals stop being invisible.
