#!/usr/bin/env bash
# Frees disk on the server by removing images from older releases.
#
#   ./prune.sh            keeps the version running and the one before it
#   ./prune.sh 0.0.51     keeps that one as well
#
# It removes only this project's own images, and only ones no container is using: Docker refuses to
# delete an image in use, and nothing here overrides that. Volumes are never touched, so the database
# is never at risk. Nothing is stopped or restarted, so a running machine does not notice (D-088).
#
# Which images it picks is decided by stale-images.sh, and tested.
set -euo pipefail

DIR="${MASCHINA_DIR:-/opt/maschina}"
cd "$DIR"

running=$(grep -m1 '^MASCHINA_VERSION=' .env | cut -d= -f2 || echo "")
if [ -z "$running" ]; then
  echo "no MASCHINA_VERSION in $DIR/.env, so there is no version to keep. Nothing removed." >&2
  exit 1
fi

echo "before:"
df -h . | awk 'NR == 2 { print "  " $4 " free of " $2 }'

stale=$(docker image ls --format '{{.Repository}}:{{.Tag}}' | ./stale-images.sh "$running" "$@")
if [ -z "$stale" ]; then
  echo "nothing to remove."
else
  count=$(printf '%s\n' "$stale" | wc -l | tr -d ' ')
  echo "removing $count images from older releases, keeping $running${*:+ and $*}"
  # Docker refuses any image a container is using, which is the safety net: the worst case is a line
  # of "image is being used" and nothing deleted.
  printf '%s\n' "$stale" | xargs -r docker image rm 2>&1 | grep -civ "^untagged\|^deleted" >/dev/null || true
fi

# Layers left behind by a pull that died part way belong to no image and no container.
docker image prune -f >/dev/null

echo "after:"
df -h . | awk 'NR == 2 { print "  " $4 " free of " $2 }'
