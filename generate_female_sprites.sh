#!/bin/bash
# Generate 36 female character sprites via PixelLab API (4 races x 9 roles)

API_KEY="6d3605e6-f1ac-47cb-9b94-ae0aeabb593d"
API_URL="https://api.pixellab.ai/v1/generate-image-pixflux"
OUT_DIR="/mnt/d/unravel/current_game/game_alpha/public/images/characters"

RACES=("white" "black" "hispanic" "asian")

declare -A ROLE_DESC
ROLE_DESC[owner]="Building owner wearing a professional black suit with a single tie, confident expression"
ROLE_DESC[architect]="Architect wearing a gray shirt, holding rolled blueprints, creative expression"
ROLE_DESC[engineer]="Engineer wearing a white hard hat, holding a tablet device, focused expression"
ROLE_DESC[dob_clerk]="DOB office clerk wearing a white shirt with blue lanyard, holding folders"
ROLE_DESC[dob_examiner]="DOB examiner wearing thick glasses and a gray suit with a red tie, holding a red stamp, stern expression"
ROLE_DESC[fdny_clerk]="FDNY office clerk wearing a headset with microphone, red lanyard visible"
ROLE_DESC[fdny_examiner]="FDNY fire examiner wearing a blue shirt with FDNY badge, holding a red binder"
ROLE_DESC[contractor]="Construction contractor wearing an orange safety vest over a gray t-shirt, pencil behind ear"
ROLE_DESC[inspector]="Building inspector wearing a white shirt with a badge, holding a silver clipboard"

ROLES=("owner" "architect" "engineer" "dob_clerk" "dob_examiner" "fdny_clerk" "fdny_examiner" "contractor" "inspector")

TOTAL=0
SUCCESS=0
FAIL=0
TOTAL_COST="0"

for role in "${ROLES[@]}"; do
  for race in "${RACES[@]}"; do
    TOTAL=$((TOTAL + 1))
    FILENAME="${role}_${race}_female.png"
    FILEPATH="${OUT_DIR}/${FILENAME}"

    PROMPT="Portrait of a ${race} woman, head and shoulders, face slightly turned, flat vector art style, simple clean lines, cream background. ${ROLE_DESC[$role]}. Single person only, no text, no watermark."
    NEG_PROMPT="double mouth, double tie, extra limbs, deformed, blurry, low quality"

    # Build JSON payload using python3
    JSON_PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'description': sys.argv[1],
    'negative_description': sys.argv[2],
    'image_size': {'width': 400, 'height': 400},
    'no_background': False
}))
" "$PROMPT" "$NEG_PROMPT")

    # Make API call
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${API_KEY}" \
      -d "$JSON_PAYLOAD" \
      --max-time 60)

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
      # Extract base64 image, decode, and get cost using python3
      RESULT=$(python3 -c "
import json, base64, sys
data = json.loads(sys.stdin.read())
b64 = data.get('image', {}).get('base64', '') or data.get('base64', '')
cost = data.get('usage', {}).get('usd', '?')
if b64:
    with open(sys.argv[1], 'wb') as f:
        f.write(base64.b64decode(b64))
    print(f'OK|{cost}')
else:
    print(f'NO_IMAGE|{list(data.keys())}')
" "$FILEPATH" <<< "$BODY")

      STATUS=$(echo "$RESULT" | cut -d'|' -f1)
      COST=$(echo "$RESULT" | cut -d'|' -f2)

      if [ "$STATUS" = "OK" ]; then
        FILESIZE=$(stat -c%s "$FILEPATH" 2>/dev/null || echo "0")
        if [ "$FILESIZE" -gt 100 ]; then
          SUCCESS=$((SUCCESS + 1))
          TOTAL_COST=$(python3 -c "print(round($TOTAL_COST + ${COST:-0}, 6))" 2>/dev/null || echo "$TOTAL_COST")
          echo "[${TOTAL}/36] OK  ${FILENAME} (${FILESIZE} bytes, cost: \$${COST})"
        else
          FAIL=$((FAIL + 1))
          rm -f "$FILEPATH"
          echo "[${TOTAL}/36] ERR ${FILENAME} - file too small"
        fi
      else
        FAIL=$((FAIL + 1))
        echo "[${TOTAL}/36] ERR ${FILENAME} - no base64 image: ${COST}"
      fi
    else
      FAIL=$((FAIL + 1))
      ERROR_MSG=$(python3 -c "
import json, sys
try:
    data = json.loads(sys.stdin.read())
    print(data.get('detail', data.get('error', data.get('message', 'unknown'))))
except: print('parse error')
" <<< "$BODY")
      echo "[${TOTAL}/36] ERR ${FILENAME} - HTTP ${HTTP_CODE}: ${ERROR_MSG}"
    fi

    # Delay between requests
    sleep 2
  done
done

echo ""
echo "=== COMPLETE ==="
echo "Success: ${SUCCESS}/36"
echo "Failed:  ${FAIL}/36"
echo "Total cost: \$${TOTAL_COST}"
