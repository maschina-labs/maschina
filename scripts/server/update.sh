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
