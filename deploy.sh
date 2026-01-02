#!/bin/bash
# Deploy script for Game Alpha
# Run this from the game_alpha directory on the server

echo "Pulling latest changes..."
git pull

echo "Rebuilding and restarting container..."
docker-compose down
docker-compose up -d --build

echo "Deployment complete!"
echo "Check status with: docker-compose logs -f"
