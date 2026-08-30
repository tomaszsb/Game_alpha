#!/bin/bash

# Batch test runner — runs the suite in smaller chunks to keep memory and
# handle usage flat across a long run.
#
# WHY THIS FILE GLOBS RATHER THAN ENUMERATING (rewritten 2026-08-30)
# ------------------------------------------------------------------
# It used to list every test file by hand: 23 named batches, 60 files. The
# suite had grown to 198. The other 138 — including all of tests/server/,
# tests/components/editor/ and tests/utils/ — were never run by this script at
# all, and nothing said so. A v3.2.41 change broke all 10 tests in
# tests/components/classroom/ and this script still reported "22/22 batches
# PASSED", because that directory was simply not on the list. Only the full
# `npm test` caught it, at /koniec, a whole session later.
#
# A hand-maintained list of test files is a promise to update it every time
# somebody adds a file, and that promise was silently broken for months. So
# the list is now DERIVED: the same include/exclude rules as
# vitest.config.dev.ts, applied by find. A new test file — or a whole new
# directory — is picked up the moment it exists.
#
# Keep the rules below in sync with vitest.config.dev.ts's include/exclude.
# The self-check at the end of discovery is what tells you if they drift.
#
# `npm test` is the commit gate (CLAUDE.md). This script is for chunked runs
# with readable per-group progress, and is now a true superset check rather
# than an unlabelled subset of it.
#
# Env knobs:
#   BATCH_SIZE=10   files per batch
#   BATCH_TIMEOUT=300  seconds per batch
#   DRY_RUN=1       list what would run, run nothing

set -uo pipefail

cd "$(dirname "$0")/../.." || exit 1

BATCH_SIZE="${BATCH_SIZE:-10}"
BATCH_TIMEOUT="${BATCH_TIMEOUT:-300}"
DRY_RUN="${DRY_RUN:-0}"

LOG_DIR="${TMPDIR:-/tmp}/game-alpha-batch-tests"
mkdir -p "$LOG_DIR"

echo "🚀 Starting batch test execution..."

# ---------------------------------------------------------------------------
# Discovery. Mirrors vitest.config.dev.ts:
#   include: tests/**/*.test.ts, tests/**/*.test.tsx
#   exclude: tests/**/*.lightweight.test.ts, tests/**/*.optimized.test.ts,
#            tests/debug-*.test.ts, tests/ghost/**
# tests/ghost/** is the 20-30-minute regression gate; it has its own runner
# (`npm run test:ghost`) and has never belonged in a "fast feedback" batch.
# ---------------------------------------------------------------------------
ALL_FILES=()
while IFS= read -r f; do
    [ -n "$f" ] && ALL_FILES+=("$f")
done < <(find tests -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) \
    ! -path 'tests/ghost/*' \
    ! -name '*.lightweight.test.ts' \
    ! -name '*.optimized.test.ts' \
    ! -path 'tests/debug-*.test.ts' \
    | sort)

TOTAL_FILES=${#ALL_FILES[@]}

if [ "$TOTAL_FILES" -eq 0 ]; then
    echo "❌ Discovered 0 test files. The glob rules above no longer match the"
    echo "   repo layout — fix them before trusting any result from this script."
    exit 1
fi

echo "🔎 Discovered $TOTAL_FILES test files (batch size $BATCH_SIZE, ${BATCH_TIMEOUT}s per batch)"

# Track results
TOTAL_PASSED=0
TOTAL_FAILED=0
FILES_RUN=0
FAILED_BATCHES=()
# Every file actually handed to a batch, so the summary can prove the set that
# ran IS the set that was discovered — not merely the same size as it.
RAN_FILES=()

# Run one batch of test files.
#   $1 = batch label, rest = files
run_batch() {
    local batch_name="$1"
    shift
    local test_files=("$@")
    local log_file="$LOG_DIR/${batch_name}.log"

    echo ""
    echo "📋 Running batch: $batch_name (${#test_files[@]} files)"
    # `_tf`, not `f`: bash has no block scope, and this function is called from
    # inside the main `for file in ...` loop. A loop variable named `f` here
    # would overwrite the caller's — which is exactly the bug this script
    # shipped with for one run: the group-change flush clobbered the current
    # filename, so each group's first batch re-ran the previous group's last
    # file and the real one was dropped. Same file count, wrong files.
    local _tf
    for _tf in "${test_files[@]}"; do echo "      $_tf"; RAN_FILES+=("$_tf"); done

    if timeout "${BATCH_TIMEOUT}s" npm test "${test_files[@]}" > "$log_file" 2>&1; then
        echo "✅ $batch_name: PASSED"
        local passed
        passed=$(grep "Tests.*passed" "$log_file" | tail -1)
        echo "   $passed"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
    else
        echo "❌ $batch_name: FAILED or TIMEOUT  (log: $log_file)"
        FAILED_BATCHES+=("$batch_name")
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        tail -20 "$log_file"
    fi
    FILES_RUN=$((FILES_RUN + ${#test_files[@]}))
}

# ---------------------------------------------------------------------------
# Group by directory so a failure names a recognisable area, then chunk each
# group to BATCH_SIZE. Grouping is cosmetic; coverage comes from the glob.
# ---------------------------------------------------------------------------
current_group=""
group_index=0
chunk=()

flush_chunk() {
    [ ${#chunk[@]} -eq 0 ] && return
    group_index=$((group_index + 1))
    local label
    label=$(echo "$current_group" | sed -e 's|^tests$|root|' -e 's|^tests/||' -e 's|/|-|g')
    if [ "$DRY_RUN" = "1" ]; then
        echo ""
        echo "📋 [dry run] ${label}-${group_index} (${#chunk[@]} files)"
        local _cf
        for _cf in "${chunk[@]}"; do echo "      $_cf"; RAN_FILES+=("$_cf"); done
        FILES_RUN=$((FILES_RUN + ${#chunk[@]}))
    else
        run_batch "${label}-${group_index}" "${chunk[@]}"
    fi
    chunk=()
}

for f in "${ALL_FILES[@]}"; do
    d=$(dirname "$f")
    if [ "$d" != "$current_group" ]; then
        flush_chunk
        current_group="$d"
        group_index=0
    fi
    chunk+=("$f")
    if [ ${#chunk[@]} -ge "$BATCH_SIZE" ]; then
        flush_chunk
    fi
done
flush_chunk

# ---------------------------------------------------------------------------
# Summary. Reports FILES, not just batches — "22/22 batches passed" was the
# exact shape of the old lie, and a batch count alone cannot expose a gap.
# ---------------------------------------------------------------------------
echo ""
echo "📊 BATCH TEST SUMMARY"
echo "========================"
echo "🔎 Test files run: $FILES_RUN of $TOTAL_FILES discovered"
echo "✅ Passed batches: $TOTAL_PASSED"
echo "❌ Failed batches: $TOTAL_FAILED"

# Set equality, not just count equality. A count check alone is too weak: the
# first version of this rewrite dropped one file per directory and duplicated
# another, which kept the total at exactly 198 and looked perfectly healthy.
DISCOVERED_SORTED=$(printf '%s\n' "${ALL_FILES[@]}" | sort)
RAN_SORTED=$(printf '%s\n' "${RAN_FILES[@]}" | sort -u)
if [ "$FILES_RUN" -ne "$TOTAL_FILES" ] || [ "$DISCOVERED_SORTED" != "$RAN_SORTED" ]; then
    echo ""
    echo "❌ Batching did not run exactly the discovered set — this is a bug in THIS SCRIPT, not in the tests."
    echo "   discovered: $TOTAL_FILES   dispatched: $FILES_RUN   distinct: $(printf '%s\n' "${RAN_FILES[@]}" | sort -u | wc -l)"
    echo "   never run:"
    comm -23 <(printf '%s\n' "$DISCOVERED_SORTED") <(printf '%s\n' "$RAN_SORTED") | sed 's/^/     /'
    echo "   run more than once:"
    printf '%s\n' "${RAN_FILES[@]}" | sort | uniq -d | sed 's/^/     /'
    exit 1
fi

if [ "$DRY_RUN" = "1" ]; then
    echo ""
    echo "🔍 Dry run — nothing executed."
    exit 0
fi

if [ ${#FAILED_BATCHES[@]} -gt 0 ]; then
    echo ""
    echo "Failed batches:"
    for batch in "${FAILED_BATCHES[@]}"; do
        echo "  - $batch"
    done
    exit 1
else
    echo ""
    echo "🎉 All batches completed successfully! ($TOTAL_FILES files)"
    exit 0
fi
