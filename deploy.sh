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

# Preserve editor data across deploys (customized CSV content)
EDITOR_DATA="$(pwd)/server/data/game-data"
EDITOR_BACKUP="$(pwd)/server/data/.game-data-backup"
if [ -d "$EDITOR_DATA/SOURCE_FILES" ] && [ "$(ls -A "$EDITOR_DATA/SOURCE_FILES" 2>/dev/null)" ]; then
  echo "Backing up editor data..."
  rm -rf "$EDITOR_BACKUP" 2>/dev/null || true
  cp -a "$EDITOR_DATA" "$EDITOR_BACKUP"
else
  echo "No editor data to preserve (will use build defaults)"
fi
rm -rf "$EDITOR_DATA" 2>/dev/null || true

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

# Restore editor data if we backed it up
if [ -d "$EDITOR_BACKUP" ]; then
  echo "Restoring editor data from backup..."
  # Wait briefly for container to create fresh game-data dir
  sleep 2
  # Overwrite the fresh defaults with the backed-up editor content
  cp -a "$EDITOR_BACKUP/SOURCE_FILES" "$EDITOR_DATA/SOURCE_FILES"
  cp -a "$EDITOR_BACKUP/CLEAN_FILES" "$EDITOR_DATA/CLEAN_FILES"
  rm -rf "$EDITOR_BACKUP"
  echo "   Editor data restored successfully"
else
  echo "No editor backup to restore (using build defaults)"
fi

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
