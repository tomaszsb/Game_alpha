#!/bin/bash

echo "🎮 Game Alpha UAT Runner"
echo "========================="
echo ""

# Check if server is already running
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Dev server already running on port 5173"
    SERVER_ALREADY_RUNNING=true
else
    echo "🚀 Starting dev server..."
    npm run dev &
    SERVER_PID=$!

    # Wait for server to be ready (max 60 seconds)
    echo "⏳ Waiting for server to start..."
    for i in {1..60}; do
        if curl -s http://localhost:5173 > /dev/null; then
            echo "✅ Dev server ready!"
            break
        fi
        sleep 1
        if [ $i -eq 60 ]; then
            echo "❌ Server failed to start within 60 seconds"
            exit 1
        fi
    done
fi

echo ""
echo "🌐 Running Puppeteer UAT tests..."
echo ""

# Run the Puppeteer test
node tests/uat/puppeteer-simple.js

TEST_EXIT_CODE=$?

# Cleanup: Kill server if we started it
if [ "$SERVER_ALREADY_RUNNING" != "true" ]; then
    echo ""
    echo "🛑 Stopping dev server..."
    kill $SERVER_PID 2>/dev/null
    # Also kill any child processes
    pkill -P $SERVER_PID 2>/dev/null
fi

echo ""
echo "========================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ UAT Tests PASSED"
else
    echo "❌ UAT Tests FAILED"
fi
echo "========================="

exit $TEST_EXIT_CODE
