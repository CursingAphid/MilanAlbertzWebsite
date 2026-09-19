#!/usr/bin/env python3
"""Bake public/textures/hu-zsolnay.jpg — the Hungary card's photo frame.

Zsolnay roof tiles the way they sit on Matthias Church and the Museum of
Applied Arts: glazed lozenges in eosin green and ochre laid in a diagonal
checker, with brick-red and cream ones scattered through, every tile a
touch different in shade and each catching a glossy highlight along its
upper edge. The CSS shows it at 128px, so one lozenge is 16px — the frame's
padding, one course of tiles around the photo.

Requires: pillow  (pip install pillow)
Usage:    python3 scripts/build-zsolnay-texture.py
"""
import os
import random

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'textures', 'hu-zsolnay.jpg')
SS = 4               # supersample factor
T = 32 * SS          # lozenge width/height while drawing
COLS = ROWS = 8
SIZE = COLS * T

rng = random.Random(1896)

GREEN = (47, 138, 106)
OCHRE = (201, 162, 39)
BRICK = (168, 69, 47)
CREAM = (232, 220, 192)
GROUT = (52, 48, 46)


def jitter(rgb, amount):
    return tuple(max(0, min(255, c + rng.randint(-amount, amount))) for c in rgb)


def lighter(rgb, f):
    return tuple(min(255, int(c + (255 - c) * f)) for c in rgb)


def darker(rgb, f):
    return tuple(int(c * (1 - f)) for c in rgb)


def main():
    img = Image.new('RGB', (SIZE, SIZE), GROUT)
    d = ImageDraw.Draw(img)
    half = T // 2
    gap = SS * 1.2  # grout showing between lozenges
    # lozenges tile the plane on a half-offset grid: centres every T along
    # rows T/2 apart, alternate rows shifted by T/2 — draw an extra ring so
    # the edges wrap seamlessly
    for row in range(-1, ROWS * 2 + 1):
        cy = row * half
        shift = half if row % 2 else 0
        for col in range(-1, COLS + 1):
            cx = col * T + shift
            # every lozenge's colour comes from its WRAPPED grid position, so
            # the ones cut by the image edge match their other half and the
            # texture repeats without a seam
            cell = random.Random((row % (ROWS * 2)) * 977 + (col % COLS) * 31 + 7)
            base = GREEN if (row + col) % 2 == 0 else OCHRE
            roll = cell.random()
            if roll < 0.08:
                base = BRICK
            elif roll < 0.14:
                base = CREAM
            c = tuple(max(0, min(255, v + cell.randint(-10, 10))) for v in base)
            pts = [(cx, cy - half + gap), (cx + half - gap, cy), (cx, cy + half - gap), (cx - half + gap, cy)]
            d.polygon(pts, fill=c)
            # glaze: a glossy highlight along the upper-left edge, shade
            # along the lower-right
            hi = [(cx, cy - half + gap), (cx - half + gap, cy), (cx - half + gap * 3, cy), (cx, cy - half + gap * 3)]
            d.polygon(hi, fill=lighter(c, 0.35))
            lo = [(cx + half - gap, cy), (cx, cy + half - gap), (cx, cy + half - gap * 3), (cx + half - gap * 3, cy)]
            d.polygon(lo, fill=darker(c, 0.18))
            # a small specular glint near the top
            gx, gy = cx - half * 0.18, cy - half * 0.45
            d.ellipse([gx - SS * 1.6, gy - SS * 0.9, gx + SS * 1.6, gy + SS * 0.9], fill=lighter(c, 0.6))
    out = img.resize((SIZE // SS, SIZE // SS), Image.LANCZOS)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.save(OUT, 'JPEG', quality=88, optimize=True)
    print('written', os.path.relpath(OUT), out.size)


if __name__ == '__main__':
    main()
