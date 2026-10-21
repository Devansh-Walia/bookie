#!/bin/sh
# Regenerates all app icon PNGs from the SVG fragments in this folder.
# Requires rsvg-convert (brew install librsvg).
set -e
cd "$(dirname "$0")"
OUT=../images
DEFS=$(cat defs.svgfrag); BOOK=$(cat book.svgfrag)
svg() { printf '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">%s%s</svg>' "$DEFS" "$1"; }
center() { printf '<g transform="translate(512 512) scale(%s) translate(-512 -512)">%s</g>' "$1" "$2"; }

# iOS / generic icon: full-bleed background.
svg "<rect width=\"1024\" height=\"1024\" fill=\"url(#bg)\"/><rect width=\"1024\" height=\"1024\" fill=\"url(#glow)\"/>$(center 1.05 "$BOOK")" > icon.svg
# Android adaptive: background layer + foreground kept inside the 66% safe zone.
svg "<rect width=\"1024\" height=\"1024\" fill=\"url(#bg)\"/><rect width=\"1024\" height=\"1024\" fill=\"url(#glow)\"/>" > adaptive-bg.svg
svg "$(center 0.78 "$BOOK")" > adaptive-fg.svg
# Android 13+ themed icon: single-colour silhouette.
svg "$(center 0.78 "$(cat mono.svgfrag)")" > adaptive-mono.svg
# Splash: logo only, on the light splash background.
svg "$(center 1.0 "$BOOK")" > splash.svg

rsvg-convert -w 1024 -h 1024 icon.svg -o $OUT/icon.png
rsvg-convert -w 1024 -h 1024 adaptive-fg.svg -o $OUT/adaptive-icon.png
rsvg-convert -w 1024 -h 1024 adaptive-bg.svg -o $OUT/adaptive-icon-background.png
rsvg-convert -w 1024 -h 1024 adaptive-mono.svg -o $OUT/adaptive-icon-monochrome.png
rsvg-convert -w 1024 -h 1024 splash.svg -o $OUT/splash-icon.png
rsvg-convert -w 96 -h 96 icon.svg -o $OUT/favicon.png
rsvg-convert -w 512 -h 512 icon.svg -o ../../site/icon.png
rm -f icon.svg adaptive-bg.svg adaptive-fg.svg adaptive-mono.svg splash.svg
