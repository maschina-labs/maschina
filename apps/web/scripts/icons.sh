#!/usr/bin/env bash
# Draws the site's icons and social card from the brand SVGs in public/brand. Needs rsvg-convert and ImageMagick.
# Run it again after the mark or the wordmark changes, and commit what it writes.
set -euo pipefail
cd "$(dirname "$0")/.."

mark=public/brand/kit/mark-white.svg
wordmark=public/brand/kit/wordmark-white.svg
for file in "$mark" "$wordmark"; do
  [ -f "$file" ] || { echo "missing $file" >&2; exit 1; }
done

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# A black square with the mark centered in it, the mark taking `$2` percent of the width.
icon() {
  local size=$1 percent=$2 out=$3
  local mark_size=$((size * percent / 100)) offset=$(((size - size * percent / 100) / 2))
  rsvg-convert -w "$mark_size" "$mark" -o "$tmp/mark.png"
  magick -size "${size}x${size}" xc:black "$tmp/mark.png" -geometry "+${offset}+${offset}" -composite "$out"
}

icon 192 60 public/icon-192.png
icon 512 60 public/icon-512.png
# Maskable icons keep the mark inside the middle 80 percent so a phone can crop the corners.
icon 512 44 public/icon-maskable-512.png
icon 180 56 public/apple-touch-icon.png
icon 48 60 "$tmp/48.png"
icon 32 64 "$tmp/32.png"
icon 16 70 "$tmp/16.png"
magick "$tmp/16.png" "$tmp/32.png" "$tmp/48.png" public/favicon.ico

# The card shown when a link is shared: the wordmark in the middle of black, 1200 by 630.
rsvg-convert -w 640 "$wordmark" -o "$tmp/word.png"
magick -size 1200x630 xc:black "$tmp/word.png" -gravity center -composite public/og-image.png
cp public/og-image.png public/twitter-image.png
