#!/usr/bin/env python3
"""Bake public/textures/waternormals.webp — the ocean normal map on the Trips globe.

Generates a seamless (periodic-by-construction) 4096x4096 tangent-space normal
map of an ocean surface via FFT spectral synthesis: a Phillips-like wave
spectrum with directional wind bias, inverse-transformed to a heightfield,
plus a faint fine-chop layer for close-up detail. Slopes become the normals.

Requires: pillow, numpy  (pip install pillow numpy)
Usage:    python3 scripts/build-water-normals.py
"""

import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures", "waternormals.webp")

N = 4096         # output resolution
L = 1000.0       # simulated domain size (m) — only ratios matter
G = 9.81

# Tuning knobs
SWELL_WIND = 20.0    # wind speed of the main swell: higher = larger waves
CHOP_WIND = 5.0      # wind speed of the fine ripple layer
CHOP_WEIGHT = 0.30   # ripple strength relative to the swell
SLOPE = 0.30         # overall normal strength (std of slope)
QUALITY = 80         # WebP quality


def heightfield(k, kx, ky, wind_speed, wind_dir, damp_px, seed):
    wind = np.asarray(wind_dir, dtype=float)
    wind /= np.linalg.norm(wind)
    lw = wind_speed * wind_speed / G
    dot = (kx * wind[0] + ky * wind[1]) / k
    phillips = np.exp(-1.0 / (k * lw) ** 2) / k**4 * dot**2
    phillips *= np.exp(-((k * (L / N * damp_px)) ** 2))  # kill sub-pixel waves
    phillips[0, 0] = 0
    rng = np.random.default_rng(seed)
    hk = (rng.normal(size=(N, N)) + 1j * rng.normal(size=(N, N))) * np.sqrt(phillips / 2)
    h = np.fft.ifft2(hk).real
    return h / h.std()


def main() -> None:
    k1 = np.fft.fftfreq(N, d=L / N) * 2 * np.pi
    kx, ky = np.meshgrid(k1, k1)
    k = np.sqrt(kx**2 + ky**2)
    k[0, 0] = 1e-6

    h = heightfield(k, kx, ky, SWELL_WIND, [1, 0.35], damp_px=6, seed=7)
    h += CHOP_WEIGHT * heightfield(k, kx, ky, CHOP_WIND, [1, 0.2], damp_px=1.5, seed=13)

    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) / 2
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) / 2
    s = SLOPE / dx.std()
    nx, ny, nz = -dx * s, -dy * s, np.ones_like(h)
    norm = np.sqrt(nx**2 + ny**2 + nz**2)
    rgb = np.stack([nx / norm, ny / norm, nz / norm], axis=-1) * 0.5 + 0.5

    img = Image.fromarray((rgb * 255).astype(np.uint8), "RGB")
    img.save(os.path.abspath(OUT), "WEBP", quality=QUALITY, method=6)
    print(f"wrote {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
