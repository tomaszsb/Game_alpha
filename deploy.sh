#!/bin/bash
# Deploy script for Game Alpha
# Run with: bash deploy.sh

set -e  # Exit on error

echo "Pulling latest changes..."
git checkout -- deploy.sh 2>/dev/null || true
git pull origin master

echo "Stopping existing container..."
docker stop game_alpha 2>/dev/null || true
docker rm game_alpha 2>/dev/null || true

# Teacher instance layer (docs/core/TEACHER_LAYER_DESIGN.md): the bind-mounted
# server/data/game-data is intentionally left UNTOUCHED here. Do NOT back up,
# wipe, or restore it.
#   - Stock (SOURCE_FILES/CLEAN_FILES/BASELINE) follows the deploy on its own:
#     the server's initWritableData() refreshes it from the freshly-built image
#     on boot (backing up to game-data/backups/ first) whenever the shipped
#     data differs. Restoring the old editor copy here is redundant and was
#     what kept the data-deploy gap half-alive.
#   - Per-classroom config (game-data/instances/<id>/config.json — tile
#     positions, teacher copies, detours) MUST survive every deploy. The old
#     "rm -rf game-data" wiped it, so the next deploy ate the teacher's work.
# There is no merge step anywhere; that is what kills the data-deploy gap.

echo "Building new image..."
GIT_COMMIT=$(git rev-parse --short HEAD)
echo "   Version: $GIT_COMMIT"
docker build --build-arg GIT_COMMIT=$GIT_COMMIT -t game_alpha .

echo "Ensuring isolated network exists..."
docker network create game-net 2>/dev/null || true

echo "Starting container..."
docker run -d \
  --name game_alpha \
  -p 3080:3001 \
  -v "$(pwd)/server/data:/app/data" \
  --env-file .env \
  --network game-net \
  --read-only \
  --tmpfs /tmp:noexec,nosuid,size=64m \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --restart unless-stopped \
  game_alpha

echo ""
echo "Cleaning up orphaned images..."
PRUNED=$(docker image prune -f 2>&1)
if echo "$PRUNED" | grep -q "Total reclaimed space"; then
  echo "   $PRUNED" | tail -1
else
  echo "   No orphaned images to remove"
fi

echo ""
echo "Deployment complete!"
echo "Check status with: docker logs -f game_alpha"
