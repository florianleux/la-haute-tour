#!/usr/bin/env bash
# Trim des PNG (marge transparente/blanche) et les convertit en webp lossless.
# Usage: img-trim-webp.sh <image.png> [<image.png>...]
#
# Plusieurs images sont rognées sur la même boîte — l'union de leurs contenus —
# et non chacune sur la sienne : des variantes d'un même personnage gardent
# ainsi le même cadrage, et un portrait affiché à hauteur fixe ne change pas de
# taille en passant de l'une à l'autre.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: cleanimage <image> [<image>...]" >&2
  exit 1
fi

box=$(magick "$@" -background none -layers merge -format '%@' info:)

for src in "$@"; do
  dir=$(dirname "$src")
  base=$(basename "$src")
  name="${base%.*}"
  slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' _' '-' | tr -s '-')
  out="$dir/$slug.webp"

  magick "$src" -crop "$box" +repage -define webp:lossless=true -quality 99 "$out"
  echo "$out"
done
