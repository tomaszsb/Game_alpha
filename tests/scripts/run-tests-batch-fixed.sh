#!/bin/bash

# Batch test runner to avoid resource accumulation issues
# This script runs tests in smaller batches to prevent hanging

echo "🚀 Starting batch test execution..."

# Track results
TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_BATCHES=()

# Function to run a batch of tests
run_batch() {
    local batch_name="$1"
    shift
    local test_files=("$@")

    echo ""
    echo "📋 Running batch: $batch_name"
    echo "   Files: ${test_files[*]}"

    if timeout 120s npm test "${test_files[@]}" > /tmp/test_output_$batch_name.log 2>&1; then
        echo "✅ $batch_name: PASSED"
        local passed=$(grep "Tests.*passed" /tmp/test_output_$batch_name.log | tail -1)
        echo "   $passed"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
    else
        echo "❌ $batch_name: FAILED or TIMEOUT"
        FAILED_BATCHES+=("$batch_name")
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        # Show error details
        tail -10 /tmp/test_output_$batch_name.log
    fi
}

# Batch 1: Core Services
run_batch "core-services" \
    "tests/services/StateService.test.ts" \
    "tests/services/DataService.test.ts" \
    "tests/services/LoggingService.test.ts"

# Batch 2: Game Logic Services
run_batch "game-logic" \
    "tests/services/GameRulesService.test.ts" \
    "tests/services/CardService.test.ts" \
    "tests/services/ResourceService.test.ts"

# Batch 3: Advanced Services
run_batch "advanced-services" \
    "tests/services/TurnService.test.ts" \
    "tests/services/EffectEngineService.test.ts" \
    "tests/services/PlayerActionService.test.ts"

# Batch 4: Support Services
run_batch "support-services" \
    "tests/services/MovementService.test.ts" \
    "tests/services/ChoiceService.test.ts" \
    "tests/services/TargetingService.test.ts"

# Batch 5: Communication Services
run_batch "communication-services" \
    "tests/services/NotificationService.test.ts" \
    "tests/services/NegotiationService.test.ts" \
    "tests/services/DurationEffects.test.ts" \
    "tests/services/TurnService-tryAgainOnSpace.test.ts"

# Batch 6: Utilities
run_batch "utilities" \
    "tests/utils/EffectFactory.test.ts" \
    "tests/utils/FormatUtils.test.ts" \
    "tests/utils/NotificationUtils.test.ts" \
    "tests/utils/actionLogFormatting.test.ts" \
    "tests/utils/buttonFormatting.test.ts"

# Batch 7: Isolated Tests
run_batch "isolated" \
    "tests/isolated/gameLogic.test.ts" \
    "tests/isolated/utils.test.ts"

# Batch 8: E2E Tests
run_batch "e2e-tests" \
    "tests/E2E-05_MultiPlayerEffects.test.ts" \
    "tests/E2E-01_HappyPath.test.ts" \
    "tests/E2E-04_EdgeCases.test.ts"

# Batch 9: Integration Tests
run_batch "integration-tests" \
    "tests/E012-integration.test.ts" \
    "tests/E066-reroll-integration.test.ts" \
    "tests/E066-simple.test.ts" \
    "tests/E2E-Lightweight.test.ts"

# Batch 10: Component Tests (smaller batches)
run_batch "core-components" \
    "tests/components/game/CardPortfolioDashboard.test.tsx" \
    "tests/components/TurnControlsWithActions.test.tsx"

run_batch "modal-components" \
    "tests/components/modals/CardActions.test.tsx" \
    "tests/components/modals/DiceResultModal.test.tsx" \
    "tests/components/modals/EndGameModal.test.tsx"

# Summary
echo ""
echo "📊 BATCH TEST SUMMARY"
echo "========================"
echo "✅ Passed batches: $TOTAL_PASSED"
echo "❌ Failed batches: $TOTAL_FAILED"

if [ ${#FAILED_BATCHES[@]} -gt 0 ]; then
    echo ""
    echo "Failed batches:"
    for batch in "${FAILED_BATCHES[@]}"; do
        echo "  - $batch"
    done
    exit 1
else
    echo ""
    echo "🎉 All batches completed successfully!"
    exit 0
fi