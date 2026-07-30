#!/bin/bash
# Deploy script for Game Alpha
# Run with: bash deploy.sh

set -e  # Exit on error

echo "Pulling latest changes..."
git checkout -- deploy.sh 2>/dev/null || true
git pull origin master

# NOTE (2026-07-29): the stop/rm used to live HERE, before the build. That
# opened a ~7-minute window (the image build) in which the container name was
# free, and Unraid's Docker manager would recreate the container from its saved
# template partway through. The deploy then died on "container name is already
# in use" at the final step.
#
# That failure was the LUCKY direction: the recreate happened late enough to
# pick up the new image, so the site was correct despite the error. Had it
# fired earlier it would have recreated on the OLD image and produced an
# identical-looking error while silently leaving the previous version running.
# The stop/rm now sits immediately before `docker run` (window: ~1s), and the
# image the container ends up on is verified at the end rather than assumed.

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

echo "Stopping existing container..."
docker stop game_alpha 2>/dev/null || true
# -f because the container may have been recreated (and started) by Unraid's
# Docker manager between the stop above and this line.
docker rm -f game_alpha 2>/dev/null || true

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
echo "Verifying the running container is on the image we just built..."
# Guards the silent-failure mode described above: a deploy that "succeeds" while
# the previous version is still serving. Compare the container's resolved image
# ID against the tag we just built — not the tag name, which both would share.
BUILT_IMAGE_ID=$(docker image inspect game_alpha:latest --format '{{.Id}}')
RUNNING_IMAGE_ID=$(docker inspect game_alpha --format '{{.Image}}' 2>/dev/null || echo 'NONE')
if [ "$RUNNING_IMAGE_ID" != "$BUILT_IMAGE_ID" ]; then
  echo "   DEPLOY FAILED: game_alpha is NOT running the image just built."
  echo "   built:   $BUILT_IMAGE_ID"
  echo "   running: $RUNNING_IMAGE_ID"
  echo "   The old version is probably still serving. Investigate before"
  echo "   assuming this deploy landed; do not just re-run and hope."
  exit 1
fi
echo "   OK — running $GIT_COMMIT (${BUILT_IMAGE_ID:7:12})"

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
