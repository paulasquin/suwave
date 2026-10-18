"""Resize and convert source images into WebP web assets, from a JSON mapping.

    uv run --with pillow python -I tools/build_images.py images.json

images.json:
    [{"src": "~/sources/IMG_1234.jpg", "dest": "assets/photos/prototype.webp", "size": 1600, "thumb": 640},
     {"src": "~/sources/render.png",   "dest": "assets/img/render.webp",       "size": 1400}]

"thumb" also writes <name>-s.webp, which the journal and photo strips use as thumbnails.
EXIF orientation is applied; quality defaults to 78.
"""
import json, sys, pathlib
from PIL import Image, ImageOps

def save(im, dest, size, q):
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((size, size), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=q, method=6)

for item in json.load(open(sys.argv[1])):
    src = pathlib.Path(item["src"]).expanduser()
    dest = pathlib.Path(item["dest"])
    im = Image.open(src)
    save(im, dest, item.get("size", 1600), item.get("quality", 78))
    if item.get("thumb"):
        save(im, dest.with_name(dest.stem + "-s.webp"), item["thumb"], 74)
    print(dest)
