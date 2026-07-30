import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
        ...globals.jest
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react': react,
      'react-hooks': reactHooks
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',

      // ---------------------------------------------------------------
      // Core rules that TypeScript supersedes
      // ---------------------------------------------------------------
      // `no-undef` is an ESLint core rule that predates TypeScript and has no
      // idea TS types exist. It fired 138 times here, and every one was a false
      // positive: `JSX`, `NodeJS`, type-only imports, ambient declarations — all
      // "undefined" to this rule, all perfectly real to `tsc`. typescript-eslint
      // ships an `eslint-recommended` override that turns it off for exactly
      // this reason; this config pulled in their rules object but never that
      // override, so the rule stayed on. Real undefined identifiers are caught
      // by `npm run typecheck`, which is where that check belongs.
      'no-undef': 'off',

      // ---------------------------------------------------------------
      // Severity triage (2026-07-27)
      // ---------------------------------------------------------------
      // Goal: make `npm run lint` exit 0 so it can go into CI and start
      // BLOCKING new problems — the whole point being that
      // `react-hooks/rules-of-hooks` is now at zero violations (v3.1.65 fixed
      // the last 28, which had been masking a real crash in DataEditor for
      // seven weeks) and can therefore guard the future as a hard error.
      //
      // The rules below still have existing violations. They are set to 'warn',
      // NOT off: they stay visible in every lint run, they just don't block.
      // This is a burn-down list, not a suppression list — see TODO.md. Each
      // one that reaches zero should be promoted back to 'error' so it can
      // never regress, the same way rules-of-hooks just was.
      '@typescript-eslint/no-explicit-any': 'warn',   // 19 — see the breakdown below
      // Re-audited site-by-site 2026-07-30, 28 → 19. "Bucket E, all
      // intentional" turned out to be true of only about half of them, and
      // three of the nine removed were hiding real defects:
      //   • `remoteConfig` used `(configCache as any)[mode]` in BOTH fallback
      //     returns. The cast silenced a declared `| null`, and the cache
      //     really could go null (the success branch stored whatever the
      //     endpoint returned, `null` body included) — after which the next
      //     failed fetch threw a TypeError out of the catch instead of
      //     degrading to the bundled default. Now optional-chained, with
      //     regression cover in tests/utils/remoteConfig.test.ts.
      //   • `EffectFactory.validateCard(card: any): card is Card` returned
      //     `card && …`, which short-circuits to the ARGUMENT — so a declared
      //     boolean type guard returned `null` for `validateCard(null)`. Its
      //     test had been weakened to `toBeFalsy()` to accommodate that.
      //     `unknown` does not compile against that body; `any` did.
      //   • `TurnStateManager`'s two `null as any` casts were simply
      //     unnecessary — `tempStates` is already `PlayerTurnState | null`.
      // What REMAINS is genuinely deliberate, and splits three ways:
      //   1. Platform casts that no type can express: `(window as any).opera`,
      //      `(window as any).webkitAudioContext`, and `args: any[]` matching
      //      `console`'s own lib.dom signature. Permanent — accept these.
      //   2. Free-form bags where `any` is the honest type: log/measurement
      //      `details?: Record<string, any>`, the `[key: string]: any` metadata
      //      index, and `reject: (reason: any) => void` (mirrors TypeScript's
      //      own PromiseConstructor). Could become `unknown` only by also
      //      touching every consumer — low value, real churn.
      //   3. Two that are worth real work, but NOT as lint work:
      //      `ActiveEffect.effectData: any` (DataTypes.ts) is the root cause of
      //      the `(payload as any)?.requiredPhase` cast in EffectEngineService —
      //      nothing type-checks the producer of that field against its
      //      consumer. And the three NegotiationState/-Result `any`s belong to
      //      the shelved player-to-player trading feature; type them when that
      //      feature gets built, not before. See TODO.md.
      // So: this rule stays 'warn' indefinitely, on purpose. Buckets 1 and 2
      // are the answer, not a backlog. A NEW warning here still deserves a
      // look, which is why it isn't 'off'.
      'react-hooks/set-state-in-effect': 'warn',      // 34 — new rule in react-hooks v6.
      // Audited site-by-site 2026-07-29 and deliberately NOT burned down: the
      // 34 are overwhelmingly legitimate shapes (subscribe-to-store, fetch-on-
      // mount, derive-from-props). Clearing them properly means moving stores
      // to useSyncExternalStore and reworking derived state at render time —
      // a React data-flow refactor, not a lint cleanup. Revisit as its own
      // project, not as a sweep.

      // Kept as hard errors: currently at zero, so they guard rather than nag.
      // (`react-hooks/rules-of-hooks` is already 'error' via the recommended
      // preset above — restated here only to make the intent unmissable.)
      'react-hooks/rules-of-hooks': 'error',
      // Promoted from 'warn' 2026-07-29 on reaching zero, per the policy above.
      // no-unused-vars: the last 41 were mostly dead classic-panel code.
      // exhaustive-deps: the last 10 included a real stale-closure bug (Back
      // button vs. the routing-explanation modal), which is exactly what this
      // now guards against reappearing. Where the rule's advice would have been
      // wrong, the sites carry an inline eslint-disable WITH the reason —
      // so a new warning here means a new decision to make, not noise.
      '@typescript-eslint/no-unused-vars': ['error', {
        // `_`-prefixed params are the established convention here for
        // deliberately-unused signature args.
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'react-hooks/exhaustive-deps': 'error',
      'no-unreachable': 'error',

      // Promoted from 'warn' to 'error' on 2026-07-28, each at zero violations.
      // What each one bought, so a future reader knows what regressing costs:
      //   static-components — ProjectProgress declared ActiveDot inside render,
      //     so React saw a new component type every pass and remounted it.
      //   refs — PullToRefresh read isPulling.current during render to pick a CSS
      //     transition. It rendered correctly only because every mutation happened
      //     to be followed by a setState in the same handler.
      //   immutability — two `window.location.href = …` navigations (now
      //     location.assign) and a useEffect closing over a const declared below it.
      //   no-irregular-whitespace — three raw U+FEFF (BOM) characters sitting
      //     invisibly inside BOM-stripping regexes, now written as \uFEFF.
      //   no-unused-expressions — a ternary used as a statement for its side effects.
      'react-hooks/static-components': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/refs': 'error',
      'no-irregular-whitespace': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',

      // Promoted 2026-07-28 (second pass), both at zero violations.
      //   no-case-declarations — 14 `const`s declared directly in a `case` with
      //     no block, so they were scoped to the WHOLE switch and visible to
      //     sibling cases. Multi-statement bodies got braces; four cases that
      //     only assigned a const to return it immediately got the const inlined.
      //   no-empty — all 19 were husks left behind when console.logs were
      //     stripped: `if (x) { }` doing nothing. Six of them were inside the
      //     five dead `apply*CardEffect` methods, which had zero callers
      //     anywhere in src/ or tests/ and were deleted outright (215 lines)
      //     rather than patched. Two more were `if (ok) { } else { fail() }`,
      //     inverted to `if (!ok) { fail() }`.
      'no-case-declarations': 'error',
      'no-empty': 'error',

      // Promoted 2026-07-28 (third pass), at zero violations.
      //   no-unescaped-entities — 41 raw apostrophes and quote marks in JSX
      //     copy. Maintainer chose typographic quotes (’ “ ”) over &apos;/&quot;
      //     escapes: the escapes render identically but make the source painful
      //     to edit, and this is player-facing copy the maintainer edits by hand.
      //     Rewritten from ESLint's own reported line:column positions rather
      //     than a text search, so JSX expressions like {'{diceValue}'} and {' '}
      //     spacers were provably untouched.
      'react/no-unescaped-entities': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  // -----------------------------------------------------------------
  // Plain-JavaScript files: the Express server, build/utility scripts,
  // and the service worker. (Coverage added 2026-07-30.)
  // -----------------------------------------------------------------
  // Until now `npm run lint` ran the glob `src/**/*.{ts,tsx}` and nothing
  // else, so the twelve hard-error rules above guarded roughly a third of
  // the code. `server/` — auth guards, the mailer, instance storage, the
  // WebSocket layer, all live production code — had never been linted at
  // all, and neither had `scripts/` or the service worker.
  //
  // The reason it *looked* unlintable is that the block above scopes its
  // `languageOptions` to `**/*.{ts,tsx}`, so plain-JS files inherited no
  // globals: `console` and `process` were "undefined" to `no-undef` 156
  // times in `server/` alone, drowning the 13 real findings. Declaring the
  // environment per file type is all that was missing.
  {
    files: ['server/**/*.js', 'scripts/**/*.{js,mjs}', 'public/sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      // Same `_`-prefix convention the TS block uses, so the two halves of
      // the codebase agree on how a deliberately-unused arg is spelled.
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }]
    }
  },
  {
    // `page.evaluate(() => …)` bodies are serialised and run inside the
    // browser, so `document`/`window` in this file are correct rather than
    // mistakes — ESLint has no way to know the callback crosses that
    // boundary. Browser globals are additive here, not a replacement: the
    // surrounding script is still Node.
    files: ['scripts/capture-game-screenshot.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  },
  {
    // A service worker has neither `window` nor `document`; its global is
    // `self` (ServiceWorkerGlobalScope), plus `caches`/`clients`/`fetch`.
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker
      }
    }
  },
  {
    // `docs/**` is prose plus archived one-off scripts (e.g. the April 2026
    // `merge-csv-rows.js` cleanup tool). Not shipped, not maintained, and
    // not worth holding to the same bar as running code.
    ignores: ['dist/**', 'node_modules/**', 'docs/**', '*.config.js', '*.config.ts']
  }
];
