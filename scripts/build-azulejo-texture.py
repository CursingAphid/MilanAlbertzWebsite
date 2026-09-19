#!/usr/bin/env python3
"""Bake public/textures/pt-azulejo.jpg — the Portugal card's photo frame.

An 8x8 field of hand-set azulejos: cobalt quatrefoils on glazed white,
quarter-fans in the corners that meet as rosettes, each tile nudged and
tinted a little differently so the frame reads as a real tiled panel. The
CSS shows it at 128px, so one tile is 16px — exactly the frame's padding,
one course of tiles all the way round.

Requires: pillow  (pip install pillow)
Usage:    python3 scripts/build-azulejo-texture.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'textures', 'pt-azulejo.jpg')
TILES = 8
SS = 4            # supersample factor
T = 32 * SS       # tile size while drawing
SIZE = TILES * T

rng = random.Random(1755)


def jitter(rgb, amount):
    return tuple(max(0, min(255, c + rng.randint(-amount, amount))) for c in rgb)


GLAZE = (244, 245, 242)
GROUT = (196, 204, 214)
COBALT = (27, 79, 156)
SKY = (106, 154, 216)


def draw_tile():
    """One tile on its own RGBA canvas, motif slightly rotated and offset."""
    glaze = jitter(GLAZE, 4)
    tile = Image.new('RGBA', (T, T), glaze + (255,))
    d = ImageDraw.Draw(tile)

    # a soft sheen top-left, the glaze catching the light
    sheen = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).ellipse([-T * 0.3, -T * 0.3, T * 0.75, T * 0.75], fill=(255, 255, 255, 46))
    sheen = sheen.filter(ImageFilter.GaussianBlur(T * 0.12))
    tile = Image.alpha_composite(tile, sheen)

    motif = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    m = ImageDraw.Draw(motif)
    blue = jitter(COBALT, 9)
    c = T / 2
    # the curved four-point star: a diamond with pinched sides
    pts = []
    for i in range(4):
        a = math.radians(90 * i)
        pts.append((c + math.cos(a) * T * 0.36, c + math.sin(a) * T * 0.36))
        b = math.radians(90 * i + 45)
        pts.append((c + math.cos(b) * T * 0.11, c + math.sin(b) * T * 0.11))
    m.polygon(pts, fill=blue + (255,))
    # stroke the star's edge a shade darker to fake a brush line
    dark = tuple(max(0, v - 30) for v in blue)
    m.line(pts + [pts[0]], fill=dark + (255,), width=max(1, SS))
    # heart of the star
    r = T * 0.06
    m.ellipse([c - r, c - r, c + r, c + r], fill=jitter(SKY, 10) + (255,))
    # little dots between the points
    for i in range(4):
        a = math.radians(90 * i + 45)
        x, y = c + math.cos(a) * T * 0.3, c + math.sin(a) * T * 0.3
        rr = T * 0.028
        m.ellipse([x - rr, y - rr, x + rr, y + rr], fill=jitter(SKY, 10) + (255,))
    motif = motif.rotate(rng.uniform(-3, 3), resample=Image.BICUBIC)
    off = (rng.randint(-SS, SS), rng.randint(-SS, SS))
    tile.paste(motif, off, motif)

    # corner quarter-fans, drawn unrotated so they meet their neighbours
    fan_r = T * 0.2
    inner = T * 0.1
    for cx, cy in ((0, 0), (T, 0), (T, T), (0, T)):
        d = ImageDraw.Draw(tile)
        d.ellipse([cx - fan_r, cy - fan_r, cx + fan_r, cy + fan_r], fill=jitter(COBALT, 9) + (255,))
        d.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=glaze + (255,))

    # a few speckles of crazing in the glaze
    d = ImageDraw.Draw(tile)
    for _ in range(6):
        x, y = rng.uniform(0, T), rng.uniform(0, T)
        d.point((x, y), fill=(190, 196, 204, 255))
    return tile


def main():
    img = Image.new('RGB', (SIZE, SIZE), GROUT)
    grout = max(2, SS * 1)  # ~1px of grout at output scale
    for ty in range(TILES):
        for tx in range(TILES):
            tile = draw_tile().convert('RGB')
            inset = tile.resize((T - grout, T - grout), Image.LANCZOS)
            img.paste(inset, (tx * T + grout // 2, ty * T + grout // 2))
    out = img.resize((SIZE // SS, SIZE // SS), Image.LANCZOS)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.save(OUT, 'JPEG', quality=88, optimize=True)
    print('written', os.path.relpath(OUT), out.size)


if __name__ == '__main__':
    main()
