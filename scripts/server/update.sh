#!/usr/bin/env bash
# Moves the server to a released version, or back to an older one.
#
#   ./update.sh 0.0.19      on the server, or through the deploy workflow
#
# It changes one line in the environment, pulls that version's images, and restarts. Nothing is built
# here. If the new version will not start, put the old number back and run it again.
set -euo pipefail

VERSION="${1:?which version to run, for example 0.0.19}"
DIR="${MASCHINA_DIR:-/opt/maschina}"
cd "$DIR"

previous=$(grep -m1 '^MASCHINA_VERSION=' .env | cut -d= -f2 || echo "none")
echo "moving from $previous to $VERSION"

# A pull that runs out of disk half way leaves a half extracted layer and a service that will not
# start, which is how 2026-10-17 went (MISTAKES M47). Refuse first instead, and say what to do.
free=$(df -Pk . | awk 'NR == 2 { print int($4 / 1024 / 1024) }')
if [ "$free" -lt "${MASCHINA_MIN_FREE_GB:-6}" ]; then
  echo "only ${free}GB free, which is not enough to pull a release safely." >&2
  echo "run ./prune.sh to remove the images no longer in use, then try again." >&2
  exit 1
fi

sed -i "s/^MASCHINA_VERSION=.*/MASCHINA_VERSION=$VERSION/" .env
docker compose -f compose.prod.yml --profile migrate pull --quiet

# The schema moves before the code does, and the code does not move if it fails. Migrations only ever
# add, so the version already running is unaffected by them: the risk is the other way round, new code
# against an old schema, and that is what this prevents.
echo "applying migrations"
if ! docker compose -f compose.prod.yml run --rm migrator; then
  echo "migrations failed, so nothing was restarted; still running $previous" >&2
  sed -i "s/^MASCHINA_VERSION=.*/MASCHINA_VERSION=$previous/" .env
  exit 1
fi

docker compose -f compose.prod.yml up -d --remove-orphans

# Give them a moment, then say what is actually running.
sleep 10
docker compose -f compose.prod.yml ps --format '{{.Name}} {{.State}} {{.Status}}'

unhealthy=$(docker compose -f compose.prod.yml ps --format '{{.Name}} {{.State}}' | grep -cv ' running' || true)
if [ "$unhealthy" -gt 0 ]; then
  echo "something is not running after the update; the previous version was $previous" >&2
  exit 1
fi
echo "running $VERSION"

# Every release pulls a fresh image for every service and nothing used to remove the old ones, so the
# disk filled up over 49 releases. Keep this version and the one before it, so a rollback needs no
# network, and delete the rest of ours. Never anything that is not ours.
if [ -x ./stale-images.sh ]; then
  stale=$(docker image ls --format '{{.Repository}}:{{.Tag}}' | ./stale-images.sh "$VERSION" "$previous")
  if [ -n "$stale" ]; then
    echo "removing $(printf '%s\n' "$stale" | wc -l | tr -d ' ') images from older releases"
    printf '%s\n' "$stale" | xargs -r docker image rm >/dev/null 2>&1 || true
  fi
fi
df -h . | awk 'NR == 2 { print $4 " free" }'
