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
      '@typescript-eslint/no-unused-vars': ['warn', {
        // `_`-prefixed params are the established convention here for
        // deliberately-unused signature args.
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',   // 28 — Bucket E is documented as intentional
      'react/no-unescaped-entities': 'warn',          // 41 — apostrophes in copy, cosmetic
      'react-hooks/exhaustive-deps': 'warn',          // 10 — famously noisy, needs case-by-case judgment
      'react-hooks/set-state-in-effect': 'warn',      // 34 — new rule in react-hooks v6

      // Kept as hard errors: currently at zero, so they guard rather than nag.
      // (`react-hooks/rules-of-hooks` is already 'error' via the recommended
      // preset above — restated here only to make the intent unmissable.)
      'react-hooks/rules-of-hooks': 'error',
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
      'no-empty': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts']
  }
];
