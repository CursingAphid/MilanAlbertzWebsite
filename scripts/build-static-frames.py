#!/usr/bin/env python3
"""Write a motionless twin of every animated card scene, for reduced motion.

The trips cards paint their backgrounds with SVG scenes that animate via
SMIL (boats drift, trams cross, lamps flicker). CSS can't reach inside a
background image, so for `prefers-reduced-motion: reduce` each scene gets a
static copy — the same picture with every <animate>, <animateTransform>,
<animateMotion> and <set> element removed — and the stylesheet swaps the
URL under that media query.

Reads the scene list from src/index.css (every `/frames/*.svg` used as a
`center bottom / cover` background), writes public/frames/<name>-static.svg
beside each, and prints the CSS block to paste into index.css.

Usage: python3 scripts/build-static-frames.py
Re-run after regenerating any scene.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / 'src' / 'index.css'
FRAMES = ROOT / 'public' / 'frames'

# an animation element, self-closing or with content
ANIM = re.compile(r'\s*<(animate|animateTransform|animateMotion|set)\b[^>]*?(?:/>|>.*?</\1>)', re.S)

css = CSS.read_text()
scenes = sorted(set(re.findall(r"url\('/frames/([a-z0-9-]+)\.svg'\) center bottom / cover", css)))
if not scenes:
    raise SystemExit('no scene backgrounds found in src/index.css')

rules = []
for name in scenes:
    src = FRAMES / f'{name}.svg'
    if not src.exists():
        print(f'!! missing {src.name}, skipped')
        continue
    svg = src.read_text()
    static, n = ANIM.subn('', svg)
    static = static.replace('<svg ', '<svg data-static="reduced-motion twin" ', 1)
    (FRAMES / f'{name}-static.svg').write_text(static)
    cls = re.search(rf"\.([a-z0-9-]+-bg)\s*\{{[^}}]*url\('/frames/{name}\.svg'\)", css)
    print(f'{name:<18} {n:>3} animations removed  -> {name}-static.svg' + ('' if cls else '  (no -bg class found)'))
    if cls:
        rules.append(f"  .{cls.group(1)} {{\n    background-image: url('/frames/{name}-static.svg');\n  }}")

print('\n/* ---- paste into src/index.css, inside @media (prefers-reduced-motion: reduce) ---- */')
print('\n'.join(rules))
