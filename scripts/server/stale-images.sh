#!/usr/bin/env bash
# Which of Maschina's own images on this server are safe to delete.
#
#   docker image ls --format '{{.Repository}}:{{.Tag}}' | ./stale-images.sh 0.0.53 0.0.52
#
# Reads a list of images on standard input, one per line, and prints the ones to remove. It only ever
# names images from this project's own registry, so Postgres, the tunnel and anything else a person
# put on the box are never touched. Given no version to keep it prints nothing, because a mistake
# there would delete the image the running system needs.
#
# Its decisions are tested in scripts/checks/stale-images.test.mjs.
set -euo pipefail

OURS="ghcr.io/maschina-labs/"

# Nothing to keep means nothing to delete. Deleting everything would be the opposite of safe.
if [ "$#" -eq 0 ]; then
  exit 0
fi

# `|| [ -n "$line" ]` so a last line with no newline after it is still read.
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "$OURS"*:*) ;;
    *) continue ;;
  esac

  tag="${line##*:}"
  # An untagged image says nothing about which version it belongs to, so it is left for a person.
  case "$tag" in
    "" | "<none>") continue ;;
  esac

  keep=""
  for version in "$@"; do
    if [ "$tag" = "$version" ]; then
      keep="yes"
      break
    fi
  done
  [ -n "$keep" ] || printf '%s\n' "$line"
done
