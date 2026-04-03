#!/bin/bash

# Ensure a clean slate within the script's own context
echo "Ensuring a clean slate by killing existing processes (pre-start)..."
pkill -f "npm run dev" || true
pkill -f "vite" || true
pkill -f "node server/server.js" || true
sleep 1 # Give processes a moment to terminate

echo "Starting game development server in background..."
npm run dev > /dev/null 2>&1 & # Redirect output to /dev/null and background it
DEV_PROCESS_PID=$! # Store PID of the npm run dev process (which is 'concurrently')

echo "DEV_PROCESS_PID=$DEV_PROCESS_PID" # Output the PID for external capture

echo "Waiting for http://localhost:3000 to be available..."
ATTEMPTS=0
MAX_ATTEMPTS=60 # 60 * 1 seconds = 1 minute timeout
URL="http://localhost:3000"

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  if curl -s -f "$URL" > /dev/null; then
    echo "Server is up!"
    exit 0 # Script exits, leaving npm run dev running
  fi
  echo "Server not yet available, waiting 1 second..."
  sleep 1
  ATTEMPTS=$((ATTEMPTS+1))
done

echo "Error: Server did not become available at $URL within timeout."
kill -s SIGTERM $DEV_PROCESS_PID || true # Attempt to gracefully terminate the npm run dev process
exit 1
