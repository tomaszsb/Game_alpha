#!/bin/bash
# Unified AI Collaboration Manager - Controls both Claude's and Gemini's MCP communication clients

SCRIPT_DIR="/mnt/d/unravel/current_game/code2027"
CLAUDE_MANAGER="$SCRIPT_DIR/ai-collab.sh"
GEMINI_MANAGER="$SCRIPT_DIR/ai-collab-gemini.sh"

start_all() {
    printf "🔄 Claude..."
    "$CLAUDE_MANAGER" start >/dev/null 2>&1 && printf " ✅ | 🔄 Gemini..." || printf " ❌ | 🔄 Gemini..."
    "$GEMINI_MANAGER" start >/dev/null 2>&1 && printf " ✅\n" || printf " ❌\n"
}

stop_all() {
    printf "🛑 Claude..."
    "$CLAUDE_MANAGER" stop >/dev/null 2>&1 && printf " ✅ | 🛑 Gemini..." || printf " ❌ | 🛑 Gemini..."
    "$GEMINI_MANAGER" stop >/dev/null 2>&1 && printf " ✅\n" || printf " ❌\n"
}

status_all() {
    printf "📊 Claude: "
    "$CLAUDE_MANAGER" status
    printf "📊 Gemini: "
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
