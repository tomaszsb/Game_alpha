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

# Batch 4: Support Services
run_batch "support-services" \
    "tests/services/MovementService.test.ts" \
    "tests/services/ChoiceService.test.ts" \
    "tests/services/TargetingService.test.ts"

# Batch 5: Communication Services
run_batch "communication-services" \
    "tests/services/NotificationService.test.ts" \
    "tests/services/NegotiationService.test.ts" \
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
    "tests/E2E-01_HappyPath.test.tsx" \
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
    "tests/E2E-Lightweight.test.ts"

# Batch 11: Component Tests - Core
# (CardPortfolioDashboard/TurnControlsWithActions deleted in the classic-panel removal;
#  swapped for their V2 successors, 2026-08-01)
run_batch "core-components" \
    "tests/components/player/PlayerCardDetailV2.test.tsx" \
    "tests/components/player/TurnCommitControl.test.tsx"

# Batch 12: Component Tests - Game Components
# (DiceRoller/GameSpace/MovementPathVisualization deleted in the classic-panel removal;
#  swapped for the service/board-layer tests that now cover this ground, 2026-08-01)
run_batch "game-components" \
    "tests/services/DiceService.test.ts" \
    "tests/components/board/BoardCanvas.test.ts" \
    "tests/services/MovementService-unifiedResolver.test.ts"

# Batch 13: Component Tests - Game Components (Group 2)
run_batch "game-components-2" \
    "tests/components/game/ProjectProgress.test.tsx" \
    "tests/components/game/SpaceExplorerPanel.test.tsx"

# Batch 14: Component Tests - Modal Components (Group 1)
run_batch "modal-components-1" \
    "tests/components/modals/DiceResultModal.test.tsx" \
    "tests/components/modals/EndGameModal.test.tsx"

# Batch 15: Component Tests - Modal Components (Group 2)
run_batch "modal-components-2" \
    "tests/components/CardDetailsModal.test.tsx" \
    "tests/components/ChoiceModal.test.tsx" \
    "tests/components/NegotiationModal.test.tsx"

# Batch 16: Component Tests - Modal Components (Group 3)
# (DiscardedCardsModal deleted pre-beta, superseded by DiscardPileModal below, 2026-08-01)
run_batch "modal-components-3" \
    "tests/components/modals/CardReplacementModal.test.tsx" \
    "tests/components/modals/DiscardPileModal.test.tsx"

# Batch 17: Component Tests - Player Panel (Group 1)
# (PlayerPanel/PlayerPanel.integration deleted in the classic-panel removal;
#  swapped for their V2 successors, 2026-08-01)
run_batch "player-components-1" \
    "tests/components/player/PlayerPanelV2.test.tsx" \
    "tests/components/player/PlayerPanelWrapper.test.tsx" \
    "tests/components/player/ExpandableSection.test.tsx"

# Batch 18: Component Tests - Player Panel (Group 2)
# (FinancesSection/TimeSection were classic-panel accordion tabs, deleted in the panel
#  removal; swapped for the V2 components that now show that same money/summary info, 2026-08-01)
run_batch "player-components-2" \
    "tests/components/player/PlayerNumbersV2.test.tsx" \
    "tests/components/player/ScoreboardV2.test.tsx"

# Batch 19: Component Tests - Player Panel (Group 3)
# (NextStepButton deleted alongside TurnControlsWithActions, superseded by TurnCommitControl
#  in batch 11; CurrentCardSection deleted with the classic panel. Swapped for two other
#  real, currently-uncovered player-component test files, 2026-08-01)
run_batch "player-components-3" \
    "tests/components/player/PlayerChronicleV2.test.tsx" \
    "tests/components/player/pendingActionsCollapse.test.ts"

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
# (E2E-MultiPathMovement deleted in the classic-panel removal; swapped for another
#  currently-uncovered movement test, 2026-08-01)
run_batch "feature-tests" \
    "tests/services/MovementService-visitTypeInvariant.test.ts" \
    "tests/features/ManualFunding.test.ts" \
    "tests/P1_AutomaticFunding_Fix.test.ts"

# Batch 23 (Performance Tests) removed 2026-08-01: its only file, LoadTimeOptimization.test.ts,
# no longer exists and there's no real successor — the closest thing (tests/isolated/gameLogic.test.ts's
# "Performance benchmarks") is wall-clock assertions already flagged in TODO.md as non-diagnostic,
# and it's already covered via batch 7 ("isolated") anyway.

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