# Vertical video (30 s, 1080×1920)

A teaser rendered from the site's own 3D acts, with on-screen text in French and English and synthesised music. Used for ionic.paulasquin.com on Instagram and YouTube Shorts.

All three parts share one grid: **96 BPM, one bar = 2.5 s, one shot per bar** (`SHOTS` in `capture.py`, `TEXT` in `captions.py`, the FX placements at the end of `music.py`).

```bash
# 1. Footage: deploy the site first; the capture loads it with ?capture (full quality, UI hidden)
#    and drives the acts frame by frame on a virtual clock (deterministic, no dropped frames).
MODAL_PROFILE=photomate modal run capture.py --url "https://<site>/?capture&lang=fr"     # clean.mp4, ~15 min on an L4
MODAL_PROFILE=photomate modal run capture.py --url "…" --only 3,4                         # re-render shots 3 and 4
ffmpeg -i clean.mp4 -i shots_3-4.mp4 -filter_complex "[0:v]trim=end_frame=<a>,setpts=PTS-STARTPTS[a];[1:v]trim=end_frame=<n>,setpts=PTS-STARTPTS[b];[0:v]trim=start_frame=<a+n>,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1[v]" -map "[v]" -c:v libx264 -crf 14 -pix_fmt yuv420p spliced.mp4

# 2. Music (no licence involved).
uv run --with numpy --with scipy python music.py                                            # music.wav

# 3. Fonts for libass: download the site's variable fonts, then make static instances.
mkdir -p fonts && for u in "ofl/unbounded/Unbounded%5Bwght%5D.ttf" "ofl/inter/Inter%5Bopsz,wght%5D.ttf" "ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"; do
  curl -sSL -o "fonts/$(basename "$u" | sed 's/%5B.*//').ttf" "https://github.com/google/fonts/raw/main/$u"; done
uv run --with fonttools python make_fonts.py

# 4. Text + music + footage.
./compose.sh                                                                                 # out/video-fr.mp4, out/video-en.mp4 (~14 MB each)
```

Framing tips:
- The site's portrait framing lifts subjects above the cards; for video, `zoom` tightens each shot and `shift` recentres a subject that sits off-centre in landscape layouts.
- Keep text between 55 % and 75 % of the height: Instagram and YouTube cover the top ~12 % and the bottom ~20 %. Leave a quiet area on the end card for a link sticker.
- Check a contact sheet before composing: `ffmpeg -i clean.mp4 -vf "fps=1/1.25,scale=216:384,tile=8x3" -frames:v 1 sheet.png`.
- Listen to the music before publishing: it is generated, so only levels and spectrum are checked automatically (`ffmpeg -af volumedetect`, about −15 dB mean, −1 dB peak).
