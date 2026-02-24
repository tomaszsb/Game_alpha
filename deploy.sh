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
