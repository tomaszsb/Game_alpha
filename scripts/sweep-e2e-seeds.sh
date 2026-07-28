#!/usr/bin/env bash
# Sweep E2E_SEED values looking for one that reproduces the E2E timeout hang.
#
# The three heavy E2E files seed Math.random (tests/helpers/seededRandom.ts) so
# a given seed always deals the same decks and walks the same path. That makes
# the long-standing timeout flake reproducible: find a bad seed here, then
# re-run that one seed as often as you like with a debugger attached.
#
#   scripts/sweep-e2e-seeds.sh              # seeds 1..25, E2E-AllPaths only
#   scripts/sweep-e2e-seeds.sh 1 60         # seeds 1..60
#   scripts/sweep-e2e-seeds.sh 1 25 all     # all three heavy files (slower)
#
# Prints one line per seed and a summary of the failing seeds at the end.

set -u

START="${1:-1}"
END="${2:-25}"
SCOPE="${3:-allpaths}"

if [ "$SCOPE" = "all" ]; then
  FILES="tests/E2E-AllPaths.test.ts tests/E2E-Multiplayer2P.test.ts tests/E2E-Multiplayer4P.test.ts"
else
  FILES="tests/E2E-AllPaths.test.ts"
fi

bad=()
for seed in $(seq "$START" "$END"); do
  out=$(E2E_SEED="$seed" npx vitest run --config vitest.config.dev.ts $FILES 2>&1)
  if echo "$out" | grep -qE 'Tests +[0-9]+ passed \([0-9]+\)$|Tests +[0-9]+ passed'; then
    if echo "$out" | grep -q "failed"; then
      detail=$(echo "$out" | grep -E 'Error:' | head -1 | cut -c1-90)
      echo "seed $seed: FAIL  $detail"
      bad+=("$seed")
    else
      echo "seed $seed: pass"
    fi
  else
    detail=$(echo "$out" | grep -E 'Error:' | head -1 | cut -c1-90)
    echo "seed $seed: FAIL  $detail"
    bad+=("$seed")
  fi
done

echo
if [ ${#bad[@]} -eq 0 ]; then
  echo "no failing seeds in $START..$END"
else
  echo "failing seeds (${#bad[@]}): ${bad[*]}"
  echo "reproduce with:  E2E_SEED=${bad[0]} npx vitest run --config vitest.config.dev.ts $FILES"
fi
