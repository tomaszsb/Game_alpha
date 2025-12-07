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

# Batch 8: E2E Tests (Group 1)
run_batch "e2e-tests-1" \
    "tests/E2E-05_MultiPlayerEffects.test.ts" \
    "tests/E2E-01_HappyPath.test.ts" \
    "tests/E2E-04_EdgeCases.test.ts"

# Batch 9: E2E Tests (Group 2)
run_batch "e2e-tests-2" \
    "tests/E2E-02_ComplexCard.test.ts" \
    "tests/E2E-03_ComplexSpace.test.ts" \
    "tests/E2E-04_SpaceTryAgain.test.ts"

# Batch 10: Integration Tests
run_batch "integration-tests" \
    "tests/E012-integration.test.ts" \
    "tests/E066-reroll-integration.test.ts" \
    "tests/E066-simple.test.ts" \
    "tests/E2E-Lightweight.test.ts"

# Batch 11: Component Tests - Core
run_batch "core-components" \
    "tests/components/game/CardPortfolioDashboard.test.tsx" \
    "tests/components/TurnControlsWithActions.test.tsx"

# Batch 12: Component Tests - Game Components
run_batch "game-components" \
    "tests/components/game/DiceRoller.test.tsx" \
    "tests/components/game/GameSpace.test.tsx" \
    "tests/components/game/MovementPathVisualization.test.tsx"

# Batch 13: Component Tests - Game Components (Group 2)
run_batch "game-components-2" \
    "tests/components/game/ProjectProgress.test.tsx" \
    "tests/components/game/SpaceExplorerPanel.test.tsx"

# Batch 14: Component Tests - Modal Components (Group 1)
run_batch "modal-components-1" \
    "tests/components/modals/CardActions.test.tsx" \
    "tests/components/modals/DiceResultModal.test.tsx" \
    "tests/components/modals/EndGameModal.test.tsx"

# Batch 15: Component Tests - Modal Components (Group 2)
run_batch "modal-components-2" \
    "tests/components/CardDetailsModal.test.tsx" \
    "tests/components/ChoiceModal.test.tsx" \
    "tests/components/NegotiationModal.test.tsx"

# Batch 16: Component Tests - Modal Components (Group 3)
run_batch "modal-components-3" \
    "tests/components/modals/CardReplacementModal.test.tsx" \
    "tests/components/modals/DiscardPileModal.test.tsx" \
    "tests/components/modals/DiscardedCardsModal.test.tsx"

# Batch 17: Component Tests - Player Panel (Group 1)
run_batch "player-components-1" \
    "tests/components/player/PlayerPanel.test.tsx" \
    "tests/components/player/PlayerPanel.integration.test.tsx" \
    "tests/components/player/ExpandableSection.test.tsx"

# Batch 18: Component Tests - Player Panel (Group 2)
run_batch "player-components-2" \
    "tests/components/player/CardsSection.test.tsx" \
    "tests/components/player/FinancesSection.test.tsx" \
    "tests/components/player/TimeSection.test.tsx"

# Batch 19: Component Tests - Player Panel (Group 3)
run_batch "player-components-3" \
    "tests/components/player/NextStepButton.test.tsx" \
    "tests/components/player/sections/CurrentCardSection.test.tsx"

# Batch 20: Regression Tests (Group 1)
run_batch "regression-tests-1" \
    "tests/regression/ButtonNesting.regression.test.tsx" \
    "tests/regression/CardCountNaN.regression.test.tsx" \
    "tests/services/ActionSequenceRegression.test.ts"

# Batch 21: Regression Tests (Group 2)
run_batch "regression-tests-2" \
    "tests/services/GameLogRegression.test.ts" \
    "tests/services/SpaceProgressionRegression.test.ts" \
    "tests/services/TransactionalLogging.test.ts"

# Batch 22: Feature Tests
run_batch "feature-tests" \
    "tests/features/E2E-MultiPathMovement.test.tsx" \
    "tests/features/ManualFunding.test.ts" \
    "tests/P1_AutomaticFunding_Fix.test.ts"

# Batch 23: Performance Tests
run_batch "performance-tests" \
    "tests/performance/LoadTimeOptimization.test.ts"

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