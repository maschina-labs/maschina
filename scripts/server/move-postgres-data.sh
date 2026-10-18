#!/usr/bin/env bash
# Moves the database into the named volume, once, before the mount is corrected (MISTAKES M42, M56).
#
# Since 2026-09-20 compose has mounted postgres-data at /var/lib/postgresql, one level above where
# Postgres writes. The image declares /var/lib/postgresql/data a volume of its own, so that inner
# path has always been an anonymous volume and the real data has never been in postgres-data. On
# 2026-10-02 a compose change recreated the container, Docker handed it a fresh anonymous volume,
# and the services came up on an empty database.
#
# Correcting the mount on its own repeats that, because the named volume is empty. So the data moves
# first, here, and the mount is corrected afterwards by the deploy.
#
# Run it on the server. It stops the stack, so pick a moment when no run is due: a machine mid trade
# has its money on chain and is never at risk, but its trade can be left unresolved in the record.
#
#   ./move-postgres-data.sh
#
# Nothing is deleted. The old anonymous volume is left exactly where it is, so this is reversible by
# putting the old mount back.
set -euo pipefail

DIR="${MASCHINA_DIR:-/opt/maschina}"
CONTAINER="maschina-postgres"
COMPOSE="${MASCHINA_COMPOSE:-compose.prod.yml}"
cd "$DIR"

say() { printf '\n== %s\n' "$1"; }

say "What is mounted now"
docker inspect "$CONTAINER" --format '{{range .Mounts}}{{.Type}} {{.Name}} -> {{.Destination}}{{"\n"}}{{end}}' \
  || { echo "no container called $CONTAINER. Is the stack up?" >&2; exit 1; }

# The anonymous volume holding the real data: whatever is mounted at the path Postgres writes to.
anon=$(docker inspect "$CONTAINER" \
  --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')

if [ -z "$anon" ]; then
  echo "nothing is mounted at /var/lib/postgresql/data." >&2
  echo "either this is already fixed, or the data is on the container's own filesystem." >&2
  echo "stop here and look at the mounts printed above before doing anything else." >&2
  exit 1
fi

if [ "$anon" = "$NAMED" ]; then
  echo "already mounted correctly: $NAMED is at /var/lib/postgresql/data. Nothing to do."
  exit 0
fi

# The named volume is whichever one compose actually gave this container, read from the container
# rather than worked out from the project name, so there is no second guess to get wrong.
NAMED=$(docker inspect "$CONTAINER" \
  --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql"}}{{.Name}}{{end}}{{end}}')
if [ -z "$NAMED" ]; then
  echo "no named volume is mounted at /var/lib/postgresql, so there is nothing to move it into." >&2
  echo "look at the mounts printed above before doing anything else." >&2
  exit 1
fi

echo "the real data is in $anon, and it belongs in $NAMED"

say "A plain dump first, as the thing to fall back on"
# The nightly backup is encrypted to a key that is deliberately not on this server, so it is
# insurance rather than something that can be restored here in a hurry. This one is readable, lives
# for the length of this operation, and is deleted at the end.
dump="$DIR/before-move-$(date -u +%Y-%m-%dT%H-%M-%SZ).sql"
docker exec "$CONTAINER" pg_dump -U maschina_owner -d maschina --no-owner > "$dump"
size=$(wc -c <"$dump")
if [ "$size" -lt 1000 ]; then
  echo "the dump is only $size bytes, which is not a real database. Stopping." >&2
  exit 1
fi
echo "dumped $dump ($size bytes)"

say "How much is in there, to compare against afterwards"
before=$(docker exec "$CONTAINER" psql -U maschina_owner -d maschina -tAc \
  "select count(*) from events")
machines=$(docker exec "$CONTAINER" psql -U maschina_owner -d maschina -tAc \
  "select count(*) from machines")
echo "$before events across $machines machines"

say "Stopping the stack"
docker compose -f "$COMPOSE" down

say "Copying $anon into $NAMED"
# Into a subdirectory of nothing: the named volume is emptied first, because whatever Postgres left
# in its home directory is not a database and must not be mistaken for one.
docker run --rm \
  -v "$anon":/from:ro \
  -v "$NAMED":/to \
  alpine sh -c 'rm -rf /to/* /to/..?* /to/.[!.]* 2>/dev/null; cp -a /from/. /to/'

if ! docker run --rm -v "$NAMED":/to alpine test -f /to/PG_VERSION; then
  echo "the copy did not produce a database: no PG_VERSION in $NAMED." >&2
  echo "nothing has been destroyed. $anon is untouched and the old mount still works." >&2
  exit 1
fi
echo "copied, and $NAMED holds a database"

cat <<NEXT

== Done here. The data is in $NAMED and $anon is untouched.

Next, and nothing else should be merged in between:

  1. Merge the pull request that changes the mount to
     postgres-data:/var/lib/postgresql/data
  2. The deploy brings the stack back up on the corrected mount.
  3. Check it came back with everything:

       docker exec $CONTAINER psql -U maschina_owner -d maschina -tAc \\
         "select count(*) from events"

     It should say $before, or more if anything ran. If it says 0, the deploy
     started on an empty database: put the old mount back, bring it up, and
     the original data is still in $anon.

  4. Once it is right, delete the plain dump, which is not encrypted:

       shred -u $dump

NEXT
