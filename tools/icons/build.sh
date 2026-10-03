#!/bin/sh
# Renders the atlas's app icons (public/icons/) from the SVGs next to this script.
# icon.svg: rounded square for "any" purpose; icon-maskable.svg: full bleed, for
# Android's maskable icon and iOS (which rounds the corners itself).
# Needs rsvg-convert (librsvg). Run: sh tools/icons/build.sh
set -eu
cd "$(dirname "$0")"
out=../../public/icons
mkdir -p "$out"
rsvg-convert -w 192 -h 192 icon.svg -o "$out/icon-192.png"
rsvg-convert -w 512 -h 512 icon.svg -o "$out/icon-512.png"
rsvg-convert -w 512 -h 512 icon-maskable.svg -o "$out/icon-maskable-512.png"
rsvg-convert -w 180 -h 180 icon-maskable.svg -o "$out/apple-touch-icon.png"
ls -l "$out"
