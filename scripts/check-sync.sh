#!/usr/bin/env bash
# check-sync.sh — compare local git commit vs GitHub remote vs live server
# Usage: bash scripts/check-sync.sh
# Run from the repo root (where package.json lives).

set -euo pipefail

LOCAL=$(git rev-parse HEAD 2>/dev/null | cut -c1-7)
REMOTE=$(git ls-remote origin HEAD 2>/dev/null | cut -c1-7)
LIVE=$(curl -sS --max-time 5 "https://game.unravelcodes.com/health" \
       | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','?')[:7])" 2>/dev/null \
       || echo "unavailable")

echo ""
echo "  Local  : $LOCAL"
echo "  Remote : $REMOTE"
echo "  Live   : $LIVE"
echo ""

OK=true

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "  ✓ Local matches remote (nothing to push)"
else
  echo "  ⚠  Local differs from remote — run: git push"
  OK=false
fi

if [ "$LIVE" = "unavailable" ]; then
  echo "  ? Live server unreachable"
elif [ "$LIVE" = "$LOCAL" ]; then
  echo "  ✓ Live matches local (deployed)"
else
  echo "  ⚠  Live ($LIVE) differs from local ($LOCAL) — deploy needed"
  OK=false
fi

echo ""
if [ "$OK" = "true" ]; then
  echo "  ✅ All in sync."
else
  echo "  🔶 Out of sync — see warnings above."
fi
echo ""
