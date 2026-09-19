"""Generate the two Portugal backgrounds:

  pt-porto.svg  — Porto at dusk, looking upriver along the Douro: the
                  Ribeira climbing the left bank (Clérigos, the Sé and the
                  Bishop's Palace on the skyline), Gaia's port-wine lodges
                  and the Serra do Pilar on the right, and between them the
                  Dom Luís I bridge — the great iron arch, both decks, a
                  metro crossing the top one — with rabelos on the water
  pt-lisbon.svg — Lisbon for its place: Alfama rooftops tumbling down to
                  the Tagus from a miradouro, the Sé and the Panteão dome,
                  the 25 de Abril bridge and Cristo Rei far off, and a
                  yellow tram 28 climbing the calçada street in front

Country default + Porto show the bridge; Lisbon crossfades to Alfama.
Sky-critical content stays in the y 190-245 band (the card cover-crops the
top ~185 units). Lamps, windows, boats and the metro animate via SMIL.

Two rules the scenes are built to:

  * Buildings are fully opaque. Distance haze and window light are BAKED
    into solid colours with blend() rather than drawn with `opacity`, so no
    house is ever see-through.
  * No filters. feGaussianBlur re-evaluates every frame and made the moving
    metro stutter, since a SMIL-animated CSS background repaints whole.
    Glows and light smears are radial gradients instead.

Windows, rails and pennants are batched into one <path> per colour (a
`M x y h w v h h-w z` subpath each) — hundreds of tiny <rect>s would bloat
the file for nothing.
"""
import random

W, H = 400, 600


def fmt(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def box(x, y, w, h):
    """One rectangular subpath for batching into a single <path>."""
    return f'M{fmt(x)} {fmt(y)}h{fmt(w)}v{fmt(h)}h-{fmt(w)}z'


def blend(fg, bg, a):
    """fg drawn at alpha `a` over bg, as a solid colour."""
    f = [int(fg.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(bg.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(round(fc * a + bc * (1 - a)) for fc, bc in zip(f, b))


class Batches:
    """Collects same-styled shapes so each style becomes one <path>.

    Paths are emitted by layer `z` (then first use), not by first use alone:
    a lit pane first met after the ironwork would otherwise paint over the
    balcony rail in front of it.
    """

    def __init__(self):
        self.groups = {}
        self.layer = {}

    def add(self, style, d, z=0):
        self.groups.setdefault(style, []).append(d)
        self.layer.setdefault(style, z)

    def render(self, indent='    '):
        ordered = sorted(self.groups, key=lambda s: self.layer[s])
        return '\n'.join(f'{indent}<path d="{"".join(self.groups[s])}" {s}/>' for s in ordered)


def house_row(baseline, x_lo, x_hi, h_lo, h_hi, w_lo, w_hi, walls, roofs, lit_p, seed,
              depth=44, gable_p=0.55, ridge=None, chimney_p=0.0, azulejo=None,
              haze=None):
    """A row of houses along a baseline; returns SVG lines for the row.

    Walls run `depth` below the baseline so the row in front hides their
    feet. `haze` is a (colour, strength) pair mixed into every fill to push
    the row back into the dusk — baked in, never drawn as transparency.
    """
    r = random.Random(seed)
    parts = []
    batches = Batches()

    def far(c):
        return blend(c, haze[0], haze[1]) if haze else c

    x = x_lo + r.uniform(-6, 0)
    while x < x_hi:
        w = r.uniform(w_lo, w_hi)
        if x + w > x_hi + 4:
            w = max(8, x_hi + 4 - x)
        h = r.uniform(h_lo, h_hi)
        b = baseline + r.uniform(-3, 3)
        wall = r.choice(walls)
        if azulejo and r.random() < azulejo[1]:  # a tile-fronted house
            wall = r.choice(azulejo[0])
        roof = r.choice(roofs)
        top = b - h
        parts.append(f'    <rect x="{fmt(x)}" y="{fmt(top)}" width="{fmt(w)}" height="{fmt(h + depth)}" fill="{far(wall)}"/>')
        if r.random() < gable_p:
            parts.append(f'    <path d="M{fmt(x - 1.2)} {fmt(top)} L{fmt(x + w / 2)} {fmt(top - w * 0.27)} L{fmt(x + w + 1.2)} {fmt(top)} Z" fill="{far(roof)}"/>')
        else:
            rr = w * 0.27
            parts.append(f'    <path d="M{fmt(x - 1.2)} {fmt(top)} L{fmt(x + rr)} {fmt(top - w * 0.2)} L{fmt(x + w - rr)} {fmt(top - w * 0.2)} L{fmt(x + w + 1.2)} {fmt(top)} Z" fill="{far(roof)}"/>')
            if ridge:  # a pale line along the ridge tiles
                batches.add(f'fill="none" stroke="{far(blend(ridge, roof, 0.6))}" stroke-width="0.6"',
                            f'M{fmt(x + rr)} {fmt(top - w * 0.2)}h{fmt(w - 2 * rr)}')
        if r.random() < chimney_p:
            parts.append(f'    <rect x="{fmt(x + w * 0.7)}" y="{fmt(top - w * 0.2 - 3)}" width="2.4" height="6" fill="{far(roof)}"/>')
        lit = far(blend('#ffc86a', wall, 0.85))
        dark = far(blend('#2b2436', wall, 0.72))
        rail = far(blend('#1f1a2a', wall, 0.7))
        wy = top + 6
        while wy < b - 4:
            wx = x + 3
            while wx < x + w - 4:
                batches.add(f'fill="{lit if r.random() < lit_p else dark}"', box(wx, wy, 2.6, 3.6), z=1)
                wx += 5.3
            if r.random() < 0.5:  # wrought-iron balcony rail under the row
                batches.add(f'fill="{rail}"', box(x + 1.5, wy + 3.8, w - 3, 0.9), z=2)
            wy += 8.5
        x += w + r.uniform(0, 1.2)
    parts.append(batches.render())
    return parts


def facade(x0, x1, y_top, cornice, wall, cols, rows, y_first, row_gap, lit_cells, seed):
    """A tall close-up façade: cornice, framed windows with iron balconies."""
    r = random.Random(seed)
    w = x1 - x0
    parts = [
        f'  <rect x="{x0}" y="{y_top}" width="{w}" height="{fmt(H + 6 - y_top)}" fill="{wall}"/>',
        f'  <rect x="{x0}" y="{y_top}" width="{w}" height="5" fill="{cornice}"/>',
        f'  <rect x="{x0}" y="{y_top + 5}" width="{w}" height="1.6" fill="{blend("#ffffff", wall, 0.35)}"/>',
    ]
    frame = blend('#f6f1e6', wall, 0.7)
    glass = blend('#3a2f30', wall, 0.8)
    sheen = blend('#ffffff', glass, 0.14)
    lit = blend('#ffc86a', wall, 0.9)
    iron = blend('#1f1a1c', wall, 0.85)
    batches = Batches()
    span = (w - 14) / cols
    for ci in range(cols):
        wx = x0 + 7 + ci * span + (span - 9) / 2
        for ri in range(rows):
            wy = y_first + ri * row_gap
            # layers: frame, pane, sheen, shutters, then the balcony in front
            batches.add(f'fill="{frame}"', box(wx - 1.4, wy - 1.4, 11.8, 16.8), z=0)
            if (ci, ri) in lit_cells:
                batches.add(f'fill="{lit}"', box(wx, wy, 9, 14), z=1)
            else:
                batches.add(f'fill="{glass}"', box(wx, wy, 9, 14), z=1)
                batches.add(f'fill="{sheen}"', box(wx + 1, wy + 1, 3, 12), z=2)
            if r.random() < 0.4:  # shutters folded back
                shade = '#2e7a3c' if r.random() < 0.5 else '#8a4a3c'
                batches.add(f'fill="{shade}"', box(wx - 3.4, wy, 2.2, 14) + box(wx + 10.2, wy, 2.2, 14), z=3)
            batches.add(f'fill="{iron}"', box(wx - 3, wy + 13.4, 15, 1.4), z=4)
            batches.add(f'fill="none" stroke="{iron}" stroke-width="0.7"',
                        f'M{fmt(wx - 3)} {fmt(wy + 8)}h15' + ''.join(f'M{fmt(wx - 3 + k * 2.5)} {fmt(wy + 8)}v5.4' for k in range(7)),
                        z=5)
    parts.append(batches.render(indent='  '))
    return parts


# ------------------------------------------------------------------- Porto
def porto():
    RIVER = 436  # far waterline under the arch
    DECK = 300   # top of the upper deck
    DECK_H = 9
    LOWER = 404  # top of the lower deck
    SPRING_L, SPRING_R = 56, 344

    # the arch is a quadratic Bézier from spring to spring; its apex touches
    # the underside of the upper deck
    apex = DECK + DECK_H
    ctrl_y = 2 * apex - RIVER

    def arch_y(x):
        t = (x - SPRING_L) / (SPRING_R - SPRING_L)
        return RIVER - (RIVER - ctrl_y) * 2 * t * (1 - t) if 0 <= t <= 1 else RIVER

    ribeira_walls = ['#d8a35a', '#c46a4a', '#4f7fb8', '#ece4d4', '#e6cfa3', '#6f8f6a', '#d79a8a', '#c9a03e', '#b8583f', '#e9d8c0']
    ribeira_roofs = ['#a34a36', '#b5533c', '#963f2e']
    gaia_walls = ['#eee8dc', '#e9dcc2', '#f2ece0', '#e4d6bc']
    gaia_roofs = ['#a8452f', '#b04d36', '#9c3f2b']
    HILL = '#2e2a4a'   # what the back Ribeira rows stand against
    CLIFF = '#3a3350'  # and the back Gaia row

    porto_rows = [
        # (baseline, x_hi, h_lo, h_hi, w_lo, w_hi, lit, haze)
        (276, 118, 16, 24, 10, 15, 0.22, (HILL, 0.85)),
        (308, 150, 18, 28, 10, 16, 0.26, (HILL, 0.92)),
        (340, 166, 20, 32, 11, 17, 0.3, None),
        (372, 174, 22, 36, 12, 18, 0.32, None),
        (404, 178, 24, 40, 12, 19, 0.34, None),
        (RIVER, 170, 26, 42, 13, 20, 0.36, None),
    ]
    porto_svg = []
    for i, (b, x_hi, h_lo, h_hi, w_lo, w_hi, lit, haze) in enumerate(porto_rows):
        porto_svg.append('  <g>')
        porto_svg += house_row(b, -6, x_hi, h_lo, h_hi, w_lo, w_hi, ribeira_walls, ribeira_roofs, lit, 500 + i, haze=haze)
        porto_svg.append('  </g>')

    gaia_rows = [
        (380, 262, 14, 20, 26, 40, 0.18, (CLIFF, 0.92)),
        (408, 246, 16, 24, 28, 44, 0.22, None),
        (RIVER, 236, 18, 26, 30, 48, 0.26, None),
    ]
    gaia_svg = []
    for i, (b, x_lo, h_lo, h_hi, w_lo, w_hi, lit, haze) in enumerate(gaia_rows):
        gaia_svg.append('  <g>')
        gaia_svg += house_row(b, x_lo, 406, h_lo, h_hi, w_lo, w_hi, gaia_walls, gaia_roofs, lit, 700 + i,
                              depth=40, gable_p=0.2, haze=haze)
        gaia_svg.append('  </g>')

    # ---------- the bridge ----------
    iron, iron_hi = '#232733', '#4d5563'
    posts, zig, hangers = [], [], []
    for x in range(72, 336, 16):  # spandrel posts between arch and upper deck
        ay = arch_y(x)
        if ay > apex + 2:
            posts.append(f'M{x} {apex}V{fmt(ay)}')
    for x in range(72, 320, 16):  # lattice between the posts
        y0, y1 = arch_y(x), arch_y(x + 16)
        zig.append(f'M{x} {fmt(apex)}L{x + 16} {fmt(y1 - 1)}M{x + 16} {fmt(apex)}L{x} {fmt(y0 - 1)}')
    for x in range(88, 320, 16):  # hangers from the arch down to the lower deck
        ay = arch_y(x)
        if ay < LOWER - 4:
            hangers.append(f'M{x} {fmt(ay)}V{LOWER}')

    def lattice_pier(x, top, bottom, w=10):
        xs = ''.join(f'M{x} {fmt(y)}L{x + w} {fmt(y + 12)}M{x + w} {fmt(y)}L{x} {fmt(y + 12)}' for y in range(int(top) + 2, int(bottom) - 10, 12))
        return (
            f'    <rect x="{x}" y="{top}" width="{w}" height="{fmt(bottom - top)}" fill="none" stroke="{iron}" stroke-width="1.8"/>\n'
            f'    <path d="{xs}" stroke="{iron}" stroke-width="0.9" fill="none"/>\n'
            f'    <rect x="{x - 3}" y="{fmt(bottom - 4)}" width="{w + 6}" height="6" fill="#57525e"/>'
        )

    lamp_svg = []
    for i, x in enumerate([32, 80, 128, 176, 224, 272, 320, 368]):
        anim = ''
        if i % 3 == 1:
            anim = f'<animate attributeName="opacity" values="0.85;1;0.8;1;0.85" dur="{fmt(3.6 + i * 0.3)}s" begin="{fmt(i * 0.4)}s" repeatCount="indefinite"/>'
        lamp_svg.append(
            f'    <line x1="{x}" y1="{DECK}" x2="{x}" y2="{DECK - 9}" stroke="{iron}" stroke-width="1.4"/>\n'
            f'    <circle cx="{x}" cy="{DECK - 11}" r="6" fill="url(#ptLamp)"/>\n'
            f'    <circle cx="{x}" cy="{DECK - 11}" r="1.9" fill="#ffe2b0">{anim}</circle>'
        )
    for x in [120, 200, 280]:
        lamp_svg.append(
            f'    <line x1="{x}" y1="{LOWER}" x2="{x}" y2="{LOWER - 7}" stroke="{iron}" stroke-width="1.2"/>\n'
            f'    <circle cx="{x}" cy="{LOWER - 8.5}" r="5" fill="url(#ptLamp)"/>\n'
            f'    <circle cx="{x}" cy="{LOWER - 8.5}" r="1.5" fill="#ffe2b0"/>'
        )

    arch_d = f'M{SPRING_L} {RIVER} Q200 {fmt(ctrl_y)} {SPRING_R} {RIVER}'
    PACO = '#d9c9a8'
    paco_dark = blend('#4a3a30', PACO, 0.7)
    paco_lit = blend('#ffc86a', PACO, 0.85)
    paco_windows = ''.join(box(x, 266, 2.6, 4) + box(x, 275, 2.6, 4) for x in range(100, 174, 6))
    metro_windows = ''.join(box(x, DECK - 10, 6, 4.5) for x in range(3, 62, 9))

    # the granite quays both banks stand on: a paved walkway edge, a coursed
    # wall face with staggered joints and mooring bollards, then a dark
    # waterline and the wall's reflection fading into the river
    QUAY_TOP = RIVER - 11  # the walkway surface
    WALL_TOP = RIVER - 7   # coping, where the wall face begins

    def quay(x0, x1, cap_x):
        w = x1 - x0
        joints = ''.join(box(x, WALL_TOP + 1.6, 0.8, 1.8) for x in range(x0 + 7, x1 - 2, 14))
        joints += ''.join(box(x, WALL_TOP + 4.2, 0.8, 2.6) for x in range(x0, x1 - 2, 14))
        bollards = ''.join(box(x, QUAY_TOP - 3, 2.2, 3) for x in range(x0 + 22, x1 - 12, 38))
        return (
            f'  <rect x="{x0}" y="{QUAY_TOP}" width="{w}" height="{RIVER - QUAY_TOP}" fill="#4a4652"/>\n'
            f'  <rect x="{x0}" y="{QUAY_TOP}" width="{w}" height="{WALL_TOP - QUAY_TOP}" fill="#75707c"/>\n'
            f'  <rect x="{x0}" y="{WALL_TOP}" width="{w}" height="1.4" fill="#5e5a66"/>\n'
            f'  <rect x="{x0}" y="{WALL_TOP + 3.6}" width="{w}" height="0.7" fill="#3a3642"/>\n'
            f'  <path d="{joints}" fill="#3a3642"/>\n'
            f'  <path d="{bollards}" fill="#2a2733"/>\n'
            f'  <rect x="{cap_x}" y="{QUAY_TOP}" width="1.6" height="{RIVER - QUAY_TOP}" fill="#2e2b36"/>\n'
            f'  <rect x="{x0}" y="{RIVER}" width="{w}" height="2.4" fill="#141a2c"/>\n'
            f'  <rect x="{x0}" y="{RIVER + 2.4}" width="{w}" height="5" fill="#3b4562"/>\n'
            f'  <rect x="{x0}" y="{RIVER + 7.4}" width="{w}" height="4" fill="#33405f"/>'
        )

    quays = quay(-4, 172, 170.4) + '\n' + quay(232, 404, 232)
    # the smear each deck lamp lays down the water
    smears = ''.join(f'<ellipse cx="{x}" cy="{RIVER + 32}" rx="7" ry="{ry}" fill="url(#ptSmear)"/>'
                     for x, ry in ((80, 26), (128, 30), (176, 34), (224, 34), (272, 30), (320, 26)))

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">
  <!-- Porto at dusk for the Portugal card, looking upriver: the Ribeira
       stacked up the left bank under Clérigos and the Sé, Gaia's port
       lodges and the Serra do Pilar on the right, and the Dom Luís I bridge
       spanning the Douro between them — the metro crosses the upper deck,
       rabelos drift, lamps and windows flicker (SMIL).
       Generated by scripts/build-portugal.py. -->
  <defs>
    <linearGradient id="ptSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1e1f4a" stop-opacity="0.96"/>
      <stop offset="0.45" stop-color="#6a4472" stop-opacity="0.96"/>
      <stop offset="0.8" stop-color="#d9805c" stop-opacity="0.96"/>
      <stop offset="1" stop-color="#f3c58a" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="ptFarRiver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8a67a"/>
      <stop offset="1" stop-color="#5a5a8a"/>
    </linearGradient>
    <linearGradient id="ptRiver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a3d66"/>
      <stop offset="0.5" stop-color="#182a4a"/>
      <stop offset="1" stop-color="#0c1730"/>
    </linearGradient>
    <linearGradient id="ptSail" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e9d5b0"/>
      <stop offset="1" stop-color="#cdb28a"/>
    </linearGradient>
    <!-- soft light, as gradients: a blur filter would be re-evaluated on
         every frame of the metro's crossing and make it stutter -->
    <radialGradient id="ptSunGlow">
      <stop offset="0" stop-color="#ffb060" stop-opacity="0.5"/>
      <stop offset="0.45" stop-color="#ffa858" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ptLamp">
      <stop offset="0" stop-color="#ffd9a0" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ptSmear">
      <stop offset="0" stop-color="#ffd9a0" stop-opacity="0.16"/>
      <stop offset="0.55" stop-color="#ffd9a0" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ptSunPath">
      <stop offset="0" stop-color="#ffb878" stop-opacity="0.2"/>
      <stop offset="0.6" stop-color="#ffb878" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#ffb878" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="{W}" height="{RIVER}" fill="url(#ptSky)"/>
  <g fill="#ffffff">
    <circle cx="46" cy="118" r="1.1" opacity="0.55"/>
    <circle cx="150" cy="104" r="1" opacity="0.5"/>
    <circle cx="262" cy="126" r="1.1" opacity="0.5"/>
    <circle cx="352" cy="110" r="1" opacity="0.5"/>
    <circle cx="96" cy="160" r="1.2" opacity="0.5">
      <animate attributeName="opacity" values="0.2;0.7;0.2" dur="3.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="306" cy="172" r="1.1" opacity="0.5">
      <animate attributeName="opacity" values="0.2;0.65;0.2" dur="4.6s" begin="1.4s" repeatCount="indefinite"/>
    </circle>
  </g>

  <!-- the sun going down over the valley, just above the bridge deck -->
  <circle cx="262" cy="268" r="34" fill="url(#ptSunGlow)"/>
  <circle cx="262" cy="268" r="12" fill="#ffd68a"/>

  <!-- the Douro valley receding upriver: hazy ridges and the far river
       catching the sky -->
  <path d="M120 372 L160 322 Q200 300 240 318 L292 366 Z" fill="#5c4468"/>
  <path d="M140 372 L184 342 Q200 334 218 344 L264 372 Z" fill="#493a5e"/>
  <path d="M166 {RIVER} L196 350 L204 350 L234 {RIVER} Z" fill="url(#ptFarRiver)"/>

  <!-- Porto: the hill under the Ribeira, Clérigos and the Sé on the
       skyline, the Bishop's Palace glowing pale beside it -->
  <path d="M0 {RIVER} L0 258 Q40 246 88 252 Q140 258 178 280 Q194 300 200 {RIVER} Z" fill="{HILL}"/>
  <g>
    <!-- Torre dos Clérigos -->
    <rect x="61" y="212" width="13" height="52" fill="#3a3556"/>
    <rect x="63" y="200" width="9" height="13" fill="#3a3556"/>
    <!-- the cupola's curve peaks at y=194.5; the spike grows out of it -->
    <path d="M62 200 Q67.5 189 73 200 Z" fill="{HILL}"/>
    <line x1="67.5" y1="187" x2="67.5" y2="195" stroke="{HILL}" stroke-width="1.2"/>
    <path d="{box(61, 224, 13, 1.4)}{box(61, 238, 13, 1.4)}{box(61, 252, 13, 1.4)}" fill="{HILL}"/>
    <circle cx="67.5" cy="231" r="1.8" fill="{blend('#ffd38a', '#3a3556', 0.85)}"/>
    <rect x="66" y="245" width="3" height="4" rx="1" fill="{blend('#ffd38a', '#3a3556', 0.6)}"/>
    <!-- the Sé: two squat towers under little domes, a rose window between -->
    <rect x="132" y="228" width="14" height="30" fill="#3a3556"/>
    <rect x="160" y="228" width="14" height="30" fill="#3a3556"/>
    <path d="M131 228 Q139 216 147 228 Z" fill="{HILL}"/>
    <path d="M159 228 Q167 216 175 228 Z" fill="{HILL}"/>
    <rect x="146" y="236" width="14" height="22" fill="#33304e"/>
    <circle cx="153" cy="243" r="2.6" fill="{blend('#ffd38a', '#33304e', 0.8)}"/>
    <!-- Paço Episcopal: the long pale façade above the Ribeira -->
    <rect x="96" y="262" width="80" height="22" fill="{PACO}"/>
    <rect x="96" y="258" width="80" height="4.5" fill="#7a3b32"/>
    <path d="{paco_windows}" fill="{paco_dark}"/>
    <path d="{box(112, 275, 2.6, 4)}{box(136, 266, 2.6, 4)}{box(160, 275, 2.6, 4)}" fill="{paco_lit}"/>
  </g>
{chr(10).join(porto_svg)}

  <!-- Gaia: the lodges along the quay, the cliff behind them and the
       Serra do Pilar's round church where the upper deck lands -->
  <path d="M212 {RIVER} L232 360 Q262 322 300 316 L340 300 Q372 288 400 290 L400 {RIVER} Z" fill="#332c48"/>
  <path d="M290 372 L326 328 L352 304 L400 296 L400 372 Z" fill="#413a56"/>
  <g>
    <rect x="352" y="268" width="36" height="34" fill="#e2d4bc"/>
    <!-- the dome peaks at y=257; the finial stands on it -->
    <path d="M351 268 Q370 246 389 268 Z" fill="#8a4a3c"/>
    <line x1="370" y1="250" x2="370" y2="258" stroke="{HILL}" stroke-width="1.2"/>
    <rect x="340" y="262" width="10" height="40" fill="#d6c6ac"/>
    <path d="M339 262 Q345 254 351 262 Z" fill="#8a4a3c"/>
    <path d="{box(358, 278, 3, 7)}{box(379, 278, 3, 7)}" fill="{blend('#4a3a30', '#e2d4bc', 0.7)}"/>
    <rect x="343.5" y="274" width="3" height="6" rx="1.5" fill="{blend('#4a3a30', '#d6c6ac', 0.7)}"/>
    <rect x="368.5" y="278" width="3" height="7" rx="1.5" fill="{blend('#ffc86a', '#e2d4bc', 0.85)}"/>
  </g>
{chr(10).join(gaia_svg)}

  <!-- the river, bank to bank: the whole lower card is open water -->
  <rect y="{RIVER}" width="{W}" height="{H - RIVER}" fill="url(#ptRiver)"/>
  <!-- the quays the houses and lodges stand on, either side of the far
       river running on under the arch -->
{quays}

  <!-- the Dom Luís I bridge -->
  <g>
    <!-- granite abutments at the springs -->
    <rect x="42" y="{RIVER - 14}" width="28" height="18" fill="#5d5866"/>
    <rect x="330" y="{RIVER - 14}" width="28" height="18" fill="#5d5866"/>
    <!-- the arch: a deep lattice rib -->
    <path d="{arch_d}" fill="none" stroke="{iron}" stroke-width="7.5"/>
    <path d="{arch_d}" fill="none" stroke="{iron_hi}" stroke-width="1" opacity="0.7"/>
    <path d="{''.join(posts)}" stroke="{iron}" stroke-width="1.6"/>
    <path d="{''.join(zig)}" fill="none" stroke="{iron}" stroke-width="0.7" opacity="0.75"/>
    <path d="{''.join(hangers)}" stroke="{iron}" stroke-width="1.3"/>
    <!-- lower deck, resting on the abutments -->
    <rect x="{SPRING_L - 2}" y="{LOWER}" width="{SPRING_R - SPRING_L + 4}" height="6" fill="{iron}"/>
    <rect x="{SPRING_L - 2}" y="{LOWER}" width="{SPRING_R - SPRING_L + 4}" height="1.4" fill="{iron_hi}"/>
    <line x1="{SPRING_L}" y1="{LOWER - 3}" x2="{SPRING_R}" y2="{LOWER - 3}" stroke="{iron_hi}" stroke-width="0.8"/>
    <!-- approach viaducts standing on lattice piers -->
{lattice_pier(18, DECK + DECK_H, 372)}
{lattice_pier(372, DECK + DECK_H, 372)}
    <!-- upper deck, edge to edge -->
    <rect x="-4" y="{DECK}" width="{W + 8}" height="{DECK_H}" fill="{iron}"/>
    <rect x="-4" y="{DECK}" width="{W + 8}" height="2" fill="#6a7282"/>
    <line x1="-4" y1="{DECK - 3.5}" x2="{W + 4}" y2="{DECK - 3.5}" stroke="{iron_hi}" stroke-width="0.9"/>
    <!-- lamps along both decks -->
{chr(10).join(lamp_svg)}
    <!-- The metro crossing the upper deck, lit up for the evening. It
         crosses at ~22 units/s, half its first pace: a CSS-background SVG
         is repainted whole for every SMIL frame, so a dropped frame shows
         up as a jump proportional to speed — the scene's blur filters were
         dropped for the same reason. -->
    <g>
      <animateTransform attributeName="transform" type="translate"
        values="-80 0; 480 0; 480 0" keyTimes="0; 0.7; 1" dur="36s" repeatCount="indefinite"/>
      <rect x="0" y="{DECK - 12}" width="64" height="12" rx="3" fill="#e9e7df"/>
      <rect x="0" y="{DECK - 4}" width="64" height="2.6" fill="#f2c230"/>
      <path d="M64 {DECK - 12} L70 {DECK - 6} L70 {DECK} L64 {DECK} Z" fill="#dcd9cf"/>
      <path d="{metro_windows}" fill="{blend('#ffd38a', '#e9e7df', 0.9)}"/>
      <circle cx="69" cy="{DECK - 3}" r="1.4" fill="#fff3d0"/>
    </g>
  </g>

  <!-- lamplight and window light smeared down the water -->
  <g>{smears}</g>
  <!-- the sun's path on the water -->
  <ellipse cx="262" cy="{RIVER + 46}" rx="14" ry="62" fill="url(#ptSunPath)"/>
  <g fill="none" stroke="#8aa4c8" stroke-width="1.5" opacity="0.14">
    <path d="M0 496 Q100 492 200 496 T400 496"/>
    <path d="M0 536 Q100 532 200 536 T400 536"/>
    <path d="M0 574 Q100 570 200 574 T400 574"/>
  </g>

  <!-- rabelos: one moored below the lodges with its barrels stacked, one
       under sail drifting downriver -->
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 0; 0 1.6; 0 0" dur="4.2s" repeatCount="indefinite"/>
    <path d="M286 486 Q302 492 326 486 L322 480 L292 480 Z" fill="#4a2f22"/>
    <path d="M292 480 L322 480 L320 478 L294 478 Z" fill="#6a4632"/>
    <g fill="#8a5a3a" stroke="#4a2f22" stroke-width="0.6">
      <rect x="298" y="473" width="6" height="5.5" rx="1.2"/>
      <rect x="305" y="473" width="6" height="5.5" rx="1.2"/>
      <rect x="312" y="473" width="6" height="5.5" rx="1.2"/>
      <rect x="301.5" y="467.8" width="6" height="5.5" rx="1.2"/>
      <rect x="308.5" y="467.8" width="6" height="5.5" rx="1.2"/>
    </g>
    <line x1="296" y1="480" x2="296" y2="458" stroke="#3a2418" stroke-width="1.2"/>
    <line x1="326" y1="486" x2="336" y2="478" stroke="#3a2418" stroke-width="1.2"/>
  </g>
  <g>
    <animateTransform attributeName="transform" type="translate" values="-50 530; 450 522" dur="96s" repeatCount="indefinite"/>
    <path d="M-18 0 Q0 7 18 0 L14 -5 L-14 -5 Z" fill="#4a2f22"/>
    <path d="M-14 -5 L14 -5 L12 -7 L-12 -7 Z" fill="#6a4632"/>
    <g fill="#8a5a3a" stroke="#4a2f22" stroke-width="0.6">
      <rect x="-8" y="-12" width="6" height="5" rx="1.2"/>
      <rect x="-1" y="-12" width="6" height="5" rx="1.2"/>
      <rect x="6" y="-12" width="6" height="5" rx="1.2"/>
    </g>
    <line x1="-3" y1="-7" x2="-3" y2="-34" stroke="#3a2418" stroke-width="1.3"/>
    <line x1="-13" y1="-31" x2="9" y2="-31" stroke="#3a2418" stroke-width="1.1"/>
    <path d="M-12.5 -30.5 L8.5 -30.5 L7 -11 L-11 -11 Z" fill="url(#ptSail)"/>
    <line x1="18" y1="0" x2="30" y2="-8" stroke="#3a2418" stroke-width="1.3"/>
    <path d="M-24 3 Q0 7 24 3" fill="none" stroke="#8aa4c8" stroke-width="1" opacity="0.35"/>
  </g>
</svg>'''


# ------------------------------------------------------------------ Lisbon
def lisbon():
    RIVER_TOP, RIVER_BOT = 328, 372

    walls = ['#efd9a0', '#e8b7a8', '#f2ece0', '#bcd0e2', '#cfe0d0', '#d9a76a', '#f0e0c8', '#e6c9a0', '#d8b0a0', '#f2ece0']
    roofs = ['#c0623f', '#b5573a', '#cf7048', '#a84f34']
    TAGUS = '#5a6d96'  # the water the back roof row stands against
    # tile-fronted houses: real azulejo façades are pale, white-and-blue
    # glaze, not flat cobalt — a few shades so they don't read as one block
    AZULEJO = ['#a9c6de', '#bcd4e6', '#93b6d2', '#c6d9e8']

    rows = [
        # (baseline, h_lo, h_hi, w_lo, w_hi, lit, haze)
        (RIVER_BOT + 2, 12, 20, 12, 20, 0.16, (TAGUS, 0.9)),
        (404, 14, 24, 14, 22, 0.2, None),
        (436, 16, 28, 15, 24, 0.24, None),
        (468, 18, 32, 16, 26, 0.28, None),
        (500, 20, 36, 18, 28, 0.3, None),
    ]
    roofs_svg = []
    for i, (b, h_lo, h_hi, w_lo, w_hi, lit, haze) in enumerate(rows):
        roofs_svg.append('  <g>')
        roofs_svg += house_row(b, -6, 406, h_lo, h_hi, w_lo, w_hi, walls, roofs, lit, 900 + i,
                               depth=40, gable_p=0.3, ridge='#e8a27a', chimney_p=0.3,
                               azulejo=(AZULEJO, 0.16), haze=haze)
        roofs_svg.append('  </g>')

    # calçada waves rolling down the street toward the viewer
    waves = []
    for i in range(6):
        y = 548 + i * 9.5
        spread = 1 + i * 0.12
        waves.append(f'M{fmt(200 - 120 * spread - 3 * i)} {fmt(y)}' + ''.join(
            f'q{fmt(9 * spread)} -4 {fmt(18 * spread)} 0t{fmt(18 * spread)} 0' for _ in range(7)))

    # the 25 de Abril bridge: hangers hang from three quadratic cable spans
    def cable(x0, y0, cx, cy, x1, y1):
        return f'M{x0} {y0} Q{cx} {cy} {x1} {y1}'

    def qy(t, y0, cy, y1):
        return (1 - t) ** 2 * y0 + 2 * t * (1 - t) * cy + t ** 2 * y1

    hangers = []
    for x in range(258, 344, 7):
        hangers.append(f'M{x} {fmt(qy((x - 250) / 100, 294, 338, 294))}V322')
    for x in range(190, 246, 7):
        hangers.append(f'M{x} {fmt(qy((x - 180) / 70, 322, 318, 294))}V322')
    for x in range(358, 400, 7):
        hangers.append(f'M{x} {fmt(qy((x - 350) / 52, 294, 300, 320))}V322')

    # Santo António bunting along its sagging line (M146 452 Q200 462 254 456)
    bunting = []
    colours = ['#e04a3a', '#f2c230', '#3a7bd0', '#2e9a58', '#f2f2ee']
    for i, x in enumerate(range(150, 250, 10)):
        y = qy((x - 146) / 108, 452, 462, 456)
        bunting.append(f'      <path d="M{fmt(x)} {fmt(y)} L{fmt(x + 3.2)} {fmt(y + 6)} L{fmt(x + 6.4)} {fmt(y + 0.3)} Z" fill="{colours[i % 5]}"/>')

    left_facade = facade(0, 146, 426, '#b5573a', '#efd28a', 4, 3, 446, 40, {(1, 1), (3, 0)}, 31)
    right_facade = facade(254, 400, 440, '#a84f34', '#e8b7a8', 4, 2, 458, 38, {(2, 0)}, 32)
    tiles = ''.join(f'M{x} {y - 4}L{x + 4} {y}L{x} {y + 4}L{x - 4} {y}Z' for y in range(528, 606, 14) for x in range(262, 400, 14))
    tile_dots = ''.join(f'<circle cx="{x + 7}" cy="{y + 7}" r="1.1"/>' for y in range(528, 592, 14) for x in range(262, 386, 14))
    left_dots = ''.join(f'<circle cx="{x}" cy="{y}" r="1.4"/>' for y in (574, 586, 598) for x in range(6, 146, 12))
    ship_windows = ''.join(box(x, 331, 1.6, 1.6) for x in range(13, 43, 3))
    castle_teeth = ''.join(box(x, 308, 4, 4) for x in range(2, 40, 8)) + ''.join(box(x, 292, 3.5, 4) for x in (40, 46.5, 52.5))
    se_teeth = ''.join(box(x, 356, 3.6, 4.5) for x in (112, 118.2, 124.4, 144, 150.2, 156.4))
    towers = (box(247, 292, 2.6, 38) + box(251.4, 292, 2.6, 38) + box(247, 300, 7, 1.8) + box(247, 312, 7, 1.8)
              + box(347, 292, 2.6, 38) + box(351.4, 292, 2.6, 38) + box(347, 300, 7, 1.8) + box(347, 312, 7, 1.8))

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">
  <!-- Lisbon for the Portugal card's Lisbon place: Alfama from a
       miradouro — terracotta roofs and pastel façades tumbling down to the
       Tagus, the Sé's towers and the Panteão dome, the 25 de Abril bridge
       and Cristo Rei far across the water, and a yellow tram 28 climbing
       the calçada street in the foreground. The tram rocks, a cruise ship
       crosses, windows flicker (SMIL); the bunting and washing hang still.
       Generated by scripts/build-portugal.py. -->
  <defs>
    <linearGradient id="lxSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b2f5e" stop-opacity="0.96"/>
      <stop offset="0.5" stop-color="#b56a8a" stop-opacity="0.96"/>
      <stop offset="0.85" stop-color="#f0b08a" stop-opacity="0.96"/>
      <stop offset="1" stop-color="#f7d9a8" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="lxRiver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8a95b8"/>
      <stop offset="1" stop-color="#4f6390"/>
    </linearGradient>
    <linearGradient id="lxStreet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfc5b0"/>
      <stop offset="1" stop-color="#e6dfcf"/>
    </linearGradient>
    <linearGradient id="lxGlass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7a6a80"/>
      <stop offset="1" stop-color="#2c2a3a"/>
    </linearGradient>
    <clipPath id="lxStreetClip">
      <path d="M146 500 L254 500 L300 606 L100 606 Z"/>
    </clipPath>
    <!-- soft light as gradients rather than blur filters, so the moving
         ships and tram don't drag a filter re-evaluation with them -->
    <radialGradient id="lxSunGlow">
      <stop offset="0" stop-color="#ffb878" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#ffb070" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffa868" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lxSunPath">
      <stop offset="0" stop-color="#ffd9a0" stop-opacity="0.3"/>
      <stop offset="0.6" stop-color="#ffd9a0" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lxLamp">
      <stop offset="0" stop-color="#ffe2b0" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#ffe2b0" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="{W}" height="{RIVER_TOP}" fill="url(#lxSky)"/>
  <g fill="#ffffff">
    <circle cx="60" cy="112" r="1.1" opacity="0.55"/>
    <circle cx="188" cy="98" r="1" opacity="0.5"/>
    <circle cx="322" cy="120" r="1.1" opacity="0.5"/>
    <circle cx="130" cy="164" r="1.2" opacity="0.5">
      <animate attributeName="opacity" values="0.2;0.7;0.2" dur="3.6s" repeatCount="indefinite"/>
    </circle>
  </g>
  <!-- the sun low over the river -->
  <circle cx="86" cy="266" r="34" fill="url(#lxSunGlow)"/>
  <circle cx="86" cy="266" r="13" fill="#ffd9a0"/>

  <!-- the far bank: Almada's ridge, Cristo Rei with open arms -->
  <path d="M0 {RIVER_TOP} L0 306 Q60 298 120 304 Q200 312 260 302 Q330 292 400 300 L400 {RIVER_TOP} Z" fill="#7d5a78"/>
  <!-- Cristo Rei on the Almada shore: the tall four-legged portico with
       a lit pillar edge and the dark opening between its legs, the viewing
       terrace on top, and the robed Christ with arms flung wide -->
  <g>
    <rect x="382" y="301.5" width="11" height="4" fill="#6a5f6e"/>
    <rect x="383.5" y="282" width="8" height="21" fill="#7d6f80"/>
    <rect x="384.3" y="283" width="1.4" height="19" fill="#978a99"/>
    <rect x="387" y="284" width="1.2" height="17" fill="#54495a"/>
    <rect x="382.4" y="280.6" width="10.2" height="2.2" rx="0.5" fill="#a093a3"/>
    <path d="M385.4 280.8 L389.6 280.8 L389 272.6 L386 272.6 Z" fill="#e2d2d3"/>
    <rect x="380.2" y="272.2" width="14.6" height="1.5" rx="0.75" fill="#e2d2d3"/>
    <circle cx="387.5" cy="270.7" r="1.55" fill="#e2d2d3"/>
  </g>

  <!-- the 25 de Abril bridge: red towers, cables and deck -->
  <g stroke="#c9503c" fill="none" stroke-linecap="round">
    <path d="{cable(180, 322, 215, 318, 250, 294)} {cable(250, 294, 300, 338, 350, 294)} {cable(350, 294, 375, 300, 400, 320)}" stroke-width="1.5"/>
    <path d="{''.join(hangers)}" stroke-width="0.6" opacity="0.8"/>
  </g>
  <path d="{towers}" fill="#b8412f"/>
  <rect x="180" y="321" width="220" height="3.2" fill="#b8412f"/>
  <rect x="180" y="321" width="220" height="0.8" fill="#e07a68"/>

  <!-- the Tagus -->
  <rect y="{RIVER_TOP}" width="{W}" height="{RIVER_BOT - RIVER_TOP + 6}" fill="url(#lxRiver)"/>
  <ellipse cx="86" cy="{RIVER_TOP + 20}" rx="12" ry="30" fill="url(#lxSunPath)"/>
  <g fill="#ffffff">
    <ellipse cx="60" cy="340" rx="3" ry="0.8" opacity="0"><animate attributeName="opacity" values="0;0.7;0" dur="2.8s" begin="0.4s" repeatCount="indefinite"/></ellipse>
    <ellipse cx="150" cy="350" rx="3.4" ry="0.9" opacity="0"><animate attributeName="opacity" values="0;0.7;0" dur="2.5s" begin="1.5s" repeatCount="indefinite"/></ellipse>
    <ellipse cx="300" cy="344" rx="3" ry="0.8" opacity="0"><animate attributeName="opacity" values="0;0.6;0" dur="3.1s" begin="0.9s" repeatCount="indefinite"/></ellipse>
  </g>
  <!-- a cruise ship far out: its lane (y 338-353) runs below the castle's
       base at 336 and above the first roofs at ~354, so it never slips
       behind either -->
  <g>
    <animateTransform attributeName="transform" type="translate" values="-70 0; 470 0" dur="150s" repeatCount="indefinite"/>
    <g transform="translate(0 13)">
      <path d="M0 340 L54 340 L50 335 L4 335 Z" fill="#f2f2ee"/>
      <rect x="10" y="329" width="34" height="6" rx="1" fill="#ffffff"/>
      <rect x="16" y="325" width="20" height="4" rx="1" fill="#f6f6f2"/>
      <path d="{ship_windows}" fill="{blend('#ffd38a', '#ffffff', 0.8)}"/>
    </g>
  </g>

  <!-- Alfama's skyline: the castle walls up left, the Sé's towers, the
       Panteão's white dome -->
  <g fill="#4a3b48">
    <rect x="0" y="312" width="72" height="24"/>
    <rect x="40" y="296" width="16" height="40"/>
    <path d="{castle_teeth}"/>
  </g>
  <line x1="48" y1="284" x2="48" y2="292" stroke="#4a3b48" stroke-width="1"/>
  <path d="M48 284 L56 286 L48 288 Z" fill="#c8342a"/>
  <path d="M48 284 L52 285 L48 286 Z" fill="#2e7a3c"/>
  <g>
    <rect x="112" y="360" width="16" height="44" fill="#d8cbb4"/>
    <rect x="144" y="360" width="16" height="44" fill="#d8cbb4"/>
    <rect x="128" y="372" width="16" height="32" fill="#cbbda4"/>
    <path d="{se_teeth}" fill="#d8cbb4"/>
    <circle cx="136" cy="381" r="3.4" fill="{blend('#4a3a30', '#cbbda4', 0.8)}"/>
    <circle cx="136" cy="381" r="2" fill="{blend('#ffd38a', blend('#4a3a30', '#cbbda4', 0.8), 0.7)}"/>
    <path d="{box(118, 368, 4, 8)}{box(150, 368, 4, 8)}" fill="{blend('#4a3a30', '#d8cbb4', 0.7)}"/>
    <path d="M128 372 L136 366 L144 372 Z" fill="#b5573a"/>
  </g>
  <g>
    <rect x="262" y="376" width="44" height="30" fill="#ece6d8"/>
    <rect x="270" y="362" width="28" height="14" fill="#f4f0e8"/>
    <!-- the dome peaks at y=349; the lantern sits on it -->
    <path d="M268 362 Q284 336 300 362 Z" fill="#f7f4ee"/>
    <rect x="281" y="343.5" width="6" height="6" rx="1" fill="#e6e0d2"/>
    <path d="M280.5 343.5 Q284 338.5 287.5 343.5 Z" fill="#d8d0c0"/>
    <path d="{box(274, 366, 3, 6)}{box(282.5, 366, 3, 6)}{box(291, 366, 3, 6)}" fill="{blend('#4a3a30', '#f4f0e8', 0.6)}"/>
  </g>
{chr(10).join(roofs_svg)}

  <!-- the street: two tall façades close in on the tram, laundry and
       bunting strung between them -->
{chr(10).join(left_facade)}
  <rect x="0" y="566" width="146" height="40" fill="#2a4f8a"/>
  <g fill="#e8eef6">{left_dots}</g>
  <path d="M0 564 h146" stroke="#f6f1e6" stroke-width="1.6"/>
  <!-- a wall lantern by the door -->
  <rect x="120" y="536" width="6" height="8" rx="1" fill="#1f1a1c"/>
  <circle cx="123" cy="540" r="7" fill="url(#lxLamp)"/>
  <rect x="121.2" y="537.5" width="3.6" height="5" fill="#ffe2b0">
    <animate attributeName="opacity" values="0.8;1;0.85;1;0.8" dur="4s" repeatCount="indefinite"/>
  </rect>

{chr(10).join(right_facade)}
  <!-- azulejo-tiled ground floor: the stamp sits on this -->
  <rect x="254" y="520" width="146" height="86" fill="#1f4d8f"/>
  <path d="M254 518 h146" stroke="#f6f1e6" stroke-width="1.6"/>
  <path d="{tiles}" fill="none" stroke="{blend('#dbe6f4', '#1f4d8f', 0.85)}" stroke-width="0.9"/>
  <g fill="{blend('#dbe6f4', '#1f4d8f', 0.85)}">{tile_dots}</g>

  <!-- the street itself, calçada waves rolling toward the viewer -->
  <path d="M146 500 L254 500 L300 606 L100 606 Z" fill="url(#lxStreet)"/>
  <path d="{''.join(waves)}" fill="none" stroke="{blend('#2a2624', '#dcd3bf', 0.85)}" stroke-width="2.4" clip-path="url(#lxStreetClip)"/>
  <g stroke="#6a6258" stroke-width="1.4">
    <line x1="182" y1="500" x2="160" y2="606"/>
    <line x1="218" y1="500" x2="240" y2="606"/>
  </g>

  <!-- bunting for Santo António, and washing out to dry — both hang still -->
  <g>
    <path d="M146 452 Q200 462 254 456" fill="none" stroke="#3a2f30" stroke-width="0.8"/>
    <g>
{chr(10).join(bunting)}
    </g>
  </g>
  <g>
    <path d="M146 478 Q200 486 254 480" fill="none" stroke="#3a2f30" stroke-width="0.7"/>
    <path d="M158 479.6 L158 490 L165 490 L165 479.9 Z" fill="#f2f2ee"/>
    <path d="M176 482 L175 494 L184 494 L183 482.4 Z" fill="#7aa8d8"/>
    <path d="M226 482.4 L226 496 L232 496 L232 482 Z" fill="#e8b0c0"/>
    <path d="M238 481.6 L238 490 L246 490 L246 481 Z" fill="#f2f2ee"/>
  </g>

  <!-- tram 28 climbing toward us -->
  <g>
    <animateTransform attributeName="transform" type="rotate" values="-0.7 200 566; 0.7 200 566; -0.7 200 566" dur="3.2s" repeatCount="indefinite"/>
    <!-- roof, body, skirt -->
    <path d="M160 496 Q200 484 240 496 L240 502 L160 502 Z" fill="#f4f1e8"/>
    <rect x="160" y="500" width="80" height="60" rx="3" fill="#f4c430"/>
    <rect x="160" y="500" width="80" height="12" fill="#f4f1e8"/>
    <rect x="164" y="556" width="72" height="6" fill="#5a3a2c"/>
    <path d="M158 562 L242 562 L238 568 L162 568 Z" fill="#3a2a22"/>
    <!-- destination board and route number -->
    <rect x="182" y="502" width="36" height="8" rx="1" fill="#2a2624"/>
    <text x="200" y="508.4" font-family="Helvetica, Arial, sans-serif" font-size="5.5" font-weight="bold" fill="#f2e7c4" text-anchor="middle" letter-spacing="0.5">GRAÇA</text>
    <circle cx="170" cy="506" r="4.2" fill="#f2f2ee"/>
    <text x="170" y="508.2" font-family="Helvetica, Arial, sans-serif" font-size="5.6" font-weight="bold" fill="#2a2624" text-anchor="middle">28</text>
    <!-- the big front windows with the sky in them -->
    <rect x="166" y="514" width="20" height="26" rx="1.5" fill="url(#lxGlass)"/>
    <rect x="190" y="514" width="20" height="26" rx="1.5" fill="url(#lxGlass)"/>
    <rect x="214" y="514" width="20" height="26" rx="1.5" fill="url(#lxGlass)"/>
    <path d="{box(168, 516, 5, 22)}{box(192, 516, 5, 22)}{box(216, 516, 5, 22)}" fill="#ffffff" opacity="0.18"/>
    <!-- the driver, a silhouette behind the middle window -->
    <circle cx="200" cy="528" r="3.4" fill="#2a2624" opacity="0.7"/>
    <path d="M194 540 Q200 532 206 540 Z" fill="#2a2624" opacity="0.7"/>
    <!-- headlight and bumper -->
    <circle cx="200" cy="551" r="11" fill="url(#lxLamp)"/>
    <circle cx="200" cy="551" r="3.6" fill="#fff3cc"/>
    <rect x="166" y="546" width="68" height="1.6" fill="#c8961e"/>
    <g fill="#c8342a">
      <rect x="168" y="549" width="6" height="4" rx="1"/>
      <rect x="226" y="549" width="6" height="4" rx="1"/>
    </g>
    <!-- trolley pole from the roof (its curve peaks at y=490) up to the wire -->
    <line x1="200" y1="490" x2="212" y2="472" stroke="#3a2a22" stroke-width="1.4"/>
  </g>
  <line x1="60" y1="470" x2="340" y2="474" stroke="#2a2624" stroke-width="0.7" opacity="0.6"/>
  <!-- headlight thrown onto the stones -->
  <path d="M188 566 L212 566 L236 606 L164 606 Z" fill="#fff3cc" opacity="0.12"/>
</svg>'''


for name, fn in [('pt-porto', porto), ('pt-lisbon', lisbon)]:
    path = f'public/frames/{name}.svg'
    open(path, 'w').write(fn() + '\n')
    print('written', path)
