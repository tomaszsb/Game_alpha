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
docker build -t game_alpha .

echo "Starting container..."
docker run -d \
  --name game_alpha \
  -p 3080:3001 \
  -v "$(pwd)/server/data:/app/server/data" \
  --restart unless-stopped \
  game_alpha

echo ""
echo "Deployment complete!"
echo "Check status with: docker logs -f game_alpha"
