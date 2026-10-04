#!/bin/sh
# Renders Doco's app icons (soleil-main/) from tools/soleil/icon.svg. Needs rsvg-convert (librsvg).
# After changing them, bump ?v= on the icons in soleil-main/manifest.json and index.html.
set -eu
cd "$(dirname "$0")"
out=../../soleil-main
rsvg-convert -w 192 -h 192 icon.svg -o "$out/icon-192.png"
rsvg-convert -w 512 -h 512 icon.svg -o "$out/icon-512.png"
rsvg-convert -w 180 -h 180 icon.svg -o "$out/apple-touch-icon.png"
ls -l "$out"/icon-192.png "$out"/icon-512.png "$out"/apple-touch-icon.png
