#!/usr/bin/env bash
# Assemble the Instagram versions: clean 3D footage + captions + music.
#   ./compose.sh            -> out/video-fr.mp4, out/video-en.mp4 (rename to suit)
set -euo pipefail
cd "$(dirname "$0")"
python3 captions.py >/dev/null
mkdir -p out
for spec in "fr:video-fr" "en:video-en"; do
  lang=${spec%%:*}; name=${spec#*:}
  ffmpeg -hide_banner -loglevel error -y -i clean.mp4 -i music.wav \
    -filter_complex "[0:v]ass=captions_${lang}.ass:fontsdir=fonts/static,format=yuv420p[v]" \
    -map "[v]" -map 1:a -c:v libx264 -preset slow -crf 21 -maxrate 9M -bufsize 18M -profile:v high -level 4.2 -r 30 \
    -c:a aac -b:a 256k -ar 48000 -t 30 -movflags +faststart "out/${name}.mp4"
  echo "out/${name}.mp4 $(du -h "out/${name}.mp4" | cut -f1)"
done
