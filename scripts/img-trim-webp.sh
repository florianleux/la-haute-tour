#!/usr/bin/env bash
# Trim un PNG (marge transparente/blanche) et le convertit en webp lossless.
# Usage: img-trim-webp.sh <image.png>
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: cleanimage <image>" >&2
  exit 1
fi

src="$1"
dir=$(dirname "$src")
base=$(basename "$src")
name="${base%.*}"
slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' _' '-' | tr -s '-')
out="$dir/$slug.webp"

magick "$src" -trim +repage -define webp:lossless=true -quality 99 "$out"
echo "$out"
