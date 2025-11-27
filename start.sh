#!/bin/bash
# Unified AI Collaboration Manager - Controls both Claude's and Gemini's MCP communication clients

SCRIPT_DIR="/mnt/d/unravel/current_game/code2027"
CLAUDE_MANAGER="$SCRIPT_DIR/ai-collab.sh"
GEMINI_MANAGER="$SCRIPT_DIR/ai-collab-gemini.sh"

start_all() {
    echo "Starting Claude's communication client..."
    "$CLAUDE_MANAGER" start
    echo "Starting Gemini's communication client..."
    "$GEMINI_MANAGER" start
    echo "All AI communication clients started."
}

stop_all() {
    echo "Stopping Claude's communication client..."
    "$CLAUDE_MANAGER" stop
    echo "Stopping Gemini's communication client..."
    "$GEMINI_MANAGER" stop
    echo "All AI communication clients stopped."
}

status_all() {
    echo "--- Claude's Client Status ---"
    "$CLAUDE_MANAGER" status
    echo "--- Gemini's Client Status ---"
    "$GEMINI_MANAGER" status
}

# Main command handling
case "$1" in
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    status)
        status_all
        ;;
    *)
        echo "Usage: $0 {start|stop|status}"
        exit 1
        ;;
esac

exit 0
