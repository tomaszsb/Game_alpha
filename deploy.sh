#!/bin/bash
# Deploy script for Game Alpha
# Run with: bash deploy.sh

set -e  # Exit on error

# Everything below lives in main() and runs at the very last line (2026-10-07).
# Bash reads a script a piece at a time as it runs, and the `git pull` below can
# REWRITE this very file. The first deploy of the health-wait version ran the old
# script's first half, then the pull swapped the file, and bash carried on from the
# old byte position inside the new text: it printed "game_alpha" twice (old, unsilenced
# lines), skipped the connected-players check and the /health wait, and stopped after
# "Verifying". A function body is read in full before anything in it runs, so the
# pull can no longer change what this run does.
main() {

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
# --ipv6/--subnet only take effect on first creation (2026-08-16 maintenance
# window) -- the || true makes this a no-op on every later deploy where the
# network already exists, but if it's ever removed again this recreates it
# WITH IPv6 instead of silently regressing back to the false-foreign-alert bug.
docker network create --ipv6 --subnet fd00:dead:beef:1::/64 game-net 2>/dev/null || true

# Is anyone playing right now? (2026-10-06) /health's `activeGames` is NOT that: it
# counts games the server still holds (created and not yet expired), so it read 7
# with nobody connected. Live people are the websocket clients. Restarting drops
# them, so ask first. No terminal (plain `ssh unraid "..."`) means we cannot ask:
# stop and say how to run it, rather than cut people off silently.
CLIENTS=$(curl -s --max-time 5 http://localhost:3080/health 2>/dev/null | grep -o '"totalClients":[0-9]*' | grep -o '[0-9]*$' || true)
if [ -n "$CLIENTS" ] && [ "$CLIENTS" -gt 0 ] && [ "$FORCE" != "1" ]; then
  echo ""
  echo "   WARNING: $CLIENTS player screen(s) are connected right now. Restarting will drop them."
  if [ -t 0 ]; then
    read -r -p "   Restart anyway? Type yes to continue: " ANSWER
    if [ "$ANSWER" != "yes" ]; then
      echo "   Cancelled. The new image is built but the old container is still running."
      exit 1
    fi
  else
    echo "   This run has no terminal to ask on, so nothing was stopped. The new image is built."
    echo "   Run it again from a terminal ( ssh -t unraid ... ), or set FORCE=1 to restart anyway."
    exit 1
  fi
fi

echo "Stopping existing container..."
# >/dev/null: docker prints the container name on stop and again on rm, which
# looked like a duplicate line. Errors still show.
docker stop game_alpha >/dev/null 2>&1 || true
# -f because the container may have been recreated (and started) by Unraid's
# Docker manager between the stop above and this line.
docker rm -f game_alpha >/dev/null 2>&1 || true

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
echo "Waiting for the new container to answer /health..."
# The image check above only proves the right image was started. This proves the
# server inside it came up (2026-10-06: the script used to print nothing after
# "Starting container...", so a crashing server looked like a finished deploy).
HEALTH=""
for i in $(seq 1 30); do
  HEALTH=$(curl -s --max-time 3 http://localhost:3080/health 2>/dev/null || true)
  if echo "$HEALTH" | grep -q '"status":"ok"'; then break; fi
  HEALTH=""
  sleep 2
done
if [ -z "$HEALTH" ]; then
  echo "   DEPLOY FAILED: /health did not answer within 60 seconds."
  echo "   Look at: docker logs --tail 50 game_alpha"
  exit 1
fi
LIVE_VERSION=$(echo "$HEALTH" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
LIVE_STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$LIVE_VERSION" != "$GIT_COMMIT" ]; then
  echo "   DEPLOY FAILED: /health says version $LIVE_VERSION but we built $GIT_COMMIT."
  exit 1
fi
echo "   OK — status $LIVE_STATUS, version $LIVE_VERSION (the commit this deploy pulled)"

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
}

main "$@"
exit $?
