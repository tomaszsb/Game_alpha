#!/bin/bash

# Test Performance Analysis Script
# Measures execution time for different test categories

echo "🚀 Test Suite Performance Analysis"
echo "=================================="
echo "Date: $(date)"
echo ""

# Function to run tests with timeout and measure performance
run_test_category() {
    local category=$1
    local pattern=$2
    local timeout_sec=$3
    
    echo "📊 Testing: $category"
    echo "Pattern: $pattern"
    echo "Timeout: ${timeout_sec}s"
    
    start_time=$(date +%s)
    
    if timeout ${timeout_sec}s npm test -- "$pattern" --runInBand --silent > /tmp/test_output_$$ 2>&1; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        # Count tests from output
        test_count=$(grep -E "Tests:.*passed" /tmp/test_output_$$ | head -1 | grep -o '[0-9]* passed' | grep -o '[0-9]*' || echo "0")
        
        echo "✅ SUCCESS: ${duration}s (${test_count} tests)"
        echo ""
    else
        echo "❌ TIMEOUT: Exceeded ${timeout_sec}s"
        echo ""
    fi
    
    # Cleanup
    rm -f /tmp/test_output_$$
}

# Test different categories with our optimizations
echo "Testing optimized test files..."
echo ""

# Test our lightweight service tests
run_test_category "Lightweight ResourceService" "tests/services/ResourceService.optimized.test.ts" 60

# Test our isolated utility tests  
run_test_category "Isolated Utils" "tests/isolated/utils.test.ts" 30

# Test our isolated game logic
run_test_category "Isolated Game Logic" "tests/isolated/gameLogic.test.ts" 30

# Test our lightweight E2E
run_test_category "Lightweight E2E" "tests/E2E-Lightweight.test.ts" 60

echo "📈 Performance Summary:"
echo "======================"
echo "Target: Individual test files should complete in 5-30 seconds"
echo "Original: Test files took 15+ minutes (timeout)"
echo ""
echo "🎯 Optimization Strategies Applied:"
echo "• Console output suppression (75% impact expected)"
echo "• Jest parallelization (40% impact expected)" 
echo "• Lightweight mocks (20% impact expected)"
echo "• Isolated unit tests (90% impact expected)"
echo ""
echo "📋 Next Steps:"
echo "• Address Jest environment hanging issues"
echo "• Apply lightweight patterns to more test files"
echo "• Create separate test categories (unit vs integration)"
echo "• Implement test-specific performance budgets"