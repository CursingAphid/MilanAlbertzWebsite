#!/usr/bin/env python3
"""Bake public/textures/relief-shade.png — the mountain overlay on the Trips globe.

The overlay is a transparent RGBA hillshade: cream on sunlit slopes, dark brown
on shaded ones, fully transparent over oceans and lowlands. It is generated from
two public-domain sources, downloaded on first run:

  - Natural Earth "Gray Earth with Shaded Relief" 50m (10800x5400):
    the artist-made relief shading, extracted with a high-pass filter
  - three-globe's earth-topology.png (2048x1024): elevation, used to fade
    the shading out over lowlands so only mountains show

Requires: pillow, numpy  (pip install pillow numpy)
Usage:    python3 scripts/build-relief-texture.py
"""

import io
import os
import urllib.request
import zipfile

import numpy as np
from PIL import Image, ImageFilter

GRAY_URL = "https://naciscdn.org/naturalearth/50m/raster/GRAY_50M_SR_W.zip"
TOPO_URL = "https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-topology.png"

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures", "relief-shade.png")
W, H = 8192, 4096

# Tuning knobs
BLUR = 12           # high-pass radius: bigger = broader relief features
ALPHA_GAIN = 22.0   # smaller = stronger shading
ALPHA_MAX = 0.6     # opacity ceiling
ELEV_START = 40.0   # elevation (0-255) where shading starts to fade in
ELEV_FULL = 100.0   # elevation at full shading strength
LIT = (244, 231, 193)    # cream, sunlit slopes
SHADED = (48, 34, 18)    # dark brown, shadow slopes

Image.MAX_IMAGE_PIXELS = None


def fetch(url: str) -> bytes:
    print(f"downloading {url}")
    with urllib.request.urlopen(url) as res:
        return res.read()


def main() -> None:
    with zipfile.ZipFile(io.BytesIO(fetch(GRAY_URL))) as zf:
        with zf.open("GRAY_50M_SR_W.tif") as f:
            gray = Image.open(io.BytesIO(f.read())).convert("L").resize((W, H), Image.LANCZOS)
    topo = Image.open(io.BytesIO(fetch(TOPO_URL))).convert("L").resize((W, H), Image.LANCZOS)

    g = np.asarray(gray, dtype=np.float32)
    base = np.asarray(gray.filter(ImageFilter.GaussianBlur(BLUR)), dtype=np.float32)
    shade = g - base  # high-pass: + = lit slope, - = shadow

    e = np.asarray(topo, dtype=np.float32)
    mask = np.clip((e - ELEV_START) / (ELEV_FULL - ELEV_START), 0.0, 1.0)

    alpha = np.clip(np.abs(shade) / ALPHA_GAIN, 0.0, ALPHA_MAX) * mask
    rgb = np.where(
        (shade > 0)[..., None],
        np.array(LIT, dtype=np.float32),
        np.array(SHADED, dtype=np.float32),
    )

    out = np.dstack([rgb, alpha[..., None] * 255]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    # 2 tones x an alpha ramp fit comfortably in a 256-color palette,
    # which shrinks the file to roughly a quarter of the RGBA size
    img.quantize(colors=256, method=Image.FASTOCTREE).save(os.path.abspath(OUT), optimize=True)
    print(f"wrote {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
