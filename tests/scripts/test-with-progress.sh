#!/bin/bash

# Test runner with progress monitoring and hang detection
# Keeps the reliable vitest config but adds progress feedback

set -e

echo "🧪 Starting test suite with progress monitoring..."
echo "⏱️  Expected duration: 30-60 seconds for full suite (optimized dev config)"
echo ""

# Function to run a command with timeout and progress
run_with_progress() {
    local cmd="$1"
    local description="$2"
    local timeout="${3:-180}" # 3 minutes default timeout

    echo "▶️  $description"
    echo "   Command: $cmd"
    echo "   Timeout: ${timeout}s"

    # Start the command in background
    timeout $timeout bash -c "$cmd" &
    local pid=$!

    # Monitor progress
    local elapsed=0
    local interval=30

    while kill -0 $pid 2>/dev/null; do
        sleep $interval
        elapsed=$((elapsed + interval))
        echo "   ⏳ Still running... ${elapsed}s elapsed"

        # Show warning at 60s mark
        if [ $elapsed -eq 60 ]; then
            echo "   ⚠️  Running longer than expected (${elapsed}s)"
        fi

        # Show concern at 120s mark
        if [ $elapsed -eq 120 ]; then
            echo "   🔍 Taking much longer than usual (${elapsed}s)"
            echo "   💡 Consider using: npm run test:services or npm run test:components"
        fi
    done

    # Wait for completion and get exit code
    wait $pid
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo "   ✅ Completed successfully in ${elapsed}s"
    elif [ $exit_code -eq 124 ]; then
        echo "   ⏰ TIMEOUT: Command exceeded ${timeout}s limit"
        echo "   💡 Try: npm run test:services (faster, targeted testing)"
        return 124
    else
        echo "   ❌ Failed with exit code $exit_code"
        return $exit_code
    fi

    echo ""
}

# Main test execution with monitoring
case "${1:-full}" in
    "services")
        run_with_progress "npm run test:services" "Testing Services Only (Fast Dev Config)" 45
        ;;
    "components")
        run_with_progress "npm run test:components" "Testing Components Only (Fast Dev Config)" 45
        ;;
    "e2e")
        run_with_progress "npm run test:e2e" "Testing E2E Scenarios (Fast Dev Config)" 60
        ;;
    "core")
        run_with_progress "npm run test:core" "Testing Core Services (Fast Dev Config)" 30
        ;;
    "safe")
        run_with_progress "npm run test:safe" "Running Safe Batch Tests" 120
        ;;
    "full"|*)
        echo "🎯 Running FULL test suite with optimized development config"
        echo "💡 For CI reliability testing, use: npm run test:ci"
        echo ""
        run_with_progress "npm test" "Full Test Suite (Fast Dev Config)" 60
        ;;
esac

echo "🎉 Test execution complete!"