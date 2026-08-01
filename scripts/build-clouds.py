#!/usr/bin/env python3
"""Bake public/textures/clouds.png — the drifting cloud layer on the Trips globe.

Seamless (periodic-by-construction) equirectangular cloud map from spectral
noise: a 1/f amplitude falloff with planet-sized wavelengths suppressed, soft
thresholded into scattered systems with feathered edges, faded at the poles
where the equirectangular projection pinches. White RGB, alpha = cloud density.

Requires: pillow, numpy  (pip install pillow numpy)
Usage:    python3 scripts/build-clouds.py
"""

import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures", "clouds.png")
W, H = 2048, 1024

# Tuning knobs
FALLOFF = 1.75      # spectral slope: higher = smoother, blobbier clouds
MIN_CYCLES = 5.0    # suppress wavelengths larger than 1/this of the map
THRESHOLD = 0.75    # noise level where clouds start: lower = more coverage
FEATHER = 0.95      # threshold-to-opaque ramp: wider = softer edges
OPACITY = 0.5       # peak cloud alpha
POLE_FADE = 80, 12  # start fading above this |lat|, over this many degrees
SEED = 11


def main() -> None:
    rng = np.random.default_rng(SEED)
    ky = np.fft.fftfreq(H)[:, None] * H
    kx = np.fft.fftfreq(W)[None, :] * W
    n = np.sqrt(kx**2 + ky**2)
    n[0, 0] = 1
    amp = 1 / n**FALLOFF * (1 - np.exp(-((n / MIN_CYCLES) ** 2)))
    spec = (rng.normal(size=(H, W)) + 1j * rng.normal(size=(H, W))) * amp
    spec[0, 0] = 0
    noise = np.fft.ifft2(spec).real
    noise = (noise - noise.mean()) / noise.std()

    alpha = np.clip((noise - THRESHOLD) / FEATHER, 0, 1) ** 1.25 * OPACITY
    lat = np.linspace(90, -90, H)[:, None]
    fade_start, fade_range = POLE_FADE
    alpha = alpha * np.clip((fade_start - np.abs(lat)) / fade_range, 0, 1)

    rgb = np.full((H, W, 3), 255, dtype=np.uint8)
    img = Image.fromarray(np.dstack([rgb, (alpha * 255).astype(np.uint8)]), "RGBA")
    img.save(os.path.abspath(OUT), optimize=True)
    print(f"wrote {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
