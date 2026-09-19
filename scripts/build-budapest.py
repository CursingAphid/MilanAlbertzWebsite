"""Generate public/frames/hu-budapest.svg — the Hungary card background.

Budapest at blue hour turning to night, looking north along the Danube:
the Chain Bridge in front with its two stone arch towers and the chains
picked out in lights, Castle Hill on the left — the floodlit Royal Palace
under its dome, Matthias Church's spire and the Fisherman's Bastion's
turrets, the Sikló funicular climbing from the bridgehead — and the
Parliament in floodlit gold along the right bank, tram 2 running along the
embankment beneath it. Everything lit is mirrored in the dark water; a
river cruise boat drifts through (SMIL).

Built to the same rules as the Portugal scenes: buildings are fully opaque
(haze and window light baked into solid colours with blend()), there are no
filters (soft light is radial gradients), and windows are batched into one
<path> per colour and layer.
"""
import random

W, H = 400, 600
RIVER = 440       # the waterline at the bridge
DECK = 392        # top of the bridge deck
DECK_H = 7
QUAY_TOP = RIVER - 11
WALL_TOP = RIVER - 7


def fmt(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def box(x, y, w, h):
    return f'M{fmt(x)} {fmt(y)}h{fmt(w)}v{fmt(h)}h-{fmt(w)}z'


def blend(fg, bg, a):
    f = [int(fg.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(bg.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(round(fc * a + bc * (1 - a)) for fc, bc in zip(f, b))


def qy(t, y0, cy, y1):
    return (1 - t) ** 2 * y0 + 2 * t * (1 - t) * cy + t ** 2 * y1


class Batches:
    def __init__(self):
        self.groups, self.layer = {}, {}

    def add(self, style, d, z=0):
        self.groups.setdefault(style, []).append(d)
        self.layer.setdefault(style, z)

    def render(self, indent='  '):
        ordered = sorted(self.groups, key=lambda s: self.layer[s])
        return '\n'.join(f'{indent}<path d="{"".join(self.groups[s])}" {s}/>' for s in ordered)


# ---------------------------------------------------------------- pieces
def windows(b, x0, x1, ys, step, w, h, wall, lit_p, r, z=1, lit='#fff0c0', dark='#3a3040'):
    """Rows of windows across a façade, lit ones warm, batched by colour."""
    lit_c, dark_c = blend(lit, wall, 0.92), blend(dark, wall, 0.8)
    for y in ys:
        x = x0
        while x + w <= x1:
            b.add(f'fill="{lit_c if r.random() < lit_p else dark_c}"', box(x, y, w, h), z)
            x += step


def parliament(b, r):
    """The Parliament along the Pest bank, floodlit gold under its dome."""
    WALL = '#e0c187'
    ROOF = '#463e56'
    GOLD = '#c9a24a'
    p = [
        '  <!-- the Parliament: wings, central block, drum and dome, the towers',
        '       and pinnacles that bristle along the roofline -->',
        # the riverside embankment wall under it: stone with buttresses
        f'  <rect x="226" y="396" width="178" height="33" fill="#514868"/>',
        f'  <path d="{"".join(box(x, 400, 2.2, 29) for x in range(232, 404, 16))}" fill="#3a3352"/>',
        f'  <rect x="226" y="400" width="178" height="1.2" fill="#6e6484"/>',
        f'  <rect x="226" y="348" width="178" height="50" fill="{WALL}"/>',
        f'  <rect x="224" y="340" width="182" height="9" fill="{ROOF}"/>',
        f'  <rect x="224" y="340" width="182" height="1" fill="{GOLD}"/>',
        f'  <rect x="292" y="322" width="48" height="27" fill="{blend(WALL, "#ffffff", 0.9)}"/>',
        f'  <rect x="290" y="316" width="52" height="7" fill="{ROOF}"/>',
        f'  <rect x="290" y="316" width="52" height="0.9" fill="{GOLD}"/>',
        # drum and dome
        f'  <rect x="302" y="296" width="28" height="21" fill="#d8ba80"/>',
        f'  <path d="M300 296 Q316 258 332 296 Z" fill="#514a68"/>',
        f'  <path d="M316 277 L304 296 M316 277 L316 296 M316 277 L328 296" fill="none" stroke="{GOLD}" stroke-width="0.8"/>',
        f'  <rect x="313.6" y="270.6" width="4.8" height="7" fill="{GOLD}"/>',
        f'  <line x1="316" y1="262" x2="316" y2="271" stroke="{GOLD}" stroke-width="1.3"/>',
        f'  <circle cx="316" cy="261.4" r="1.1" fill="{GOLD}"/>',
    ]
    # drum slots
    for x in range(305, 328, 5):
        b.add(f'fill="{blend("#3a3040", "#d8ba80", 0.8)}"', box(x, 301, 2, 9), 1)
    # the two towers flanking the dome, and the pinnacles along the wings
    for x in (284, 340):
        p.append(f'  <rect x="{x}" y="300" width="8" height="49" fill="{blend(WALL, "#ffffff", 0.94)}"/>')
        p.append(f'  <path d="M{x - 1} 300 L{x + 4} 284 L{x + 9} 300 Z" fill="{ROOF}"/>')
        p.append(f'  <line x1="{x + 4}" y1="280" x2="{x + 4}" y2="285" stroke="{GOLD}" stroke-width="1"/>')
        b.add(f'fill="{blend("#3a3040", WALL, 0.8)}"', box(x + 2.5, 308, 3, 6) + box(x + 2.5, 322, 3, 6), 1)
    for x in (238, 262, 368, 392):
        p.append(f'  <rect x="{x}" y="326" width="5" height="23" fill="{blend(WALL, "#ffffff", 0.94)}"/>')
        p.append(f'  <path d="M{x - 1} 326 L{x + 2.5} 312 L{x + 6} 326 Z" fill="{ROOF}"/>')
    # windows on wings and central block, the arcade along the base
    windows(b, 230, 404, (356, 372), 7, 2.8, 6, WALL, 0.55, r)
    windows(b, 296, 338, (330,), 7, 2.8, 6, blend(WALL, '#ffffff', 0.9), 0.6, r)
    arc = blend('#3a3040', WALL, 0.85)
    for x in range(232, 402, 8):
        b.add(f'fill="{arc}"', box(x, 384, 4, 8), 1)
    return p


def palace(b, r):
    """The Royal Palace on Castle Hill, its dome floodlit against the night."""
    WALL = '#dcbf86'
    ROOF = '#463e56'
    GOLD = '#c9a24a'
    p = [
        '  <!-- Buda Castle: the Royal Palace standing on the hill\'s flat top,',
        '       and the Castle Garden Bazaar\'s lit arcade at the foot of the',
        '       rock face, just above the embankment houses -->',
        f'  <rect x="0" y="372" width="136" height="18" fill="#4a4058"/>',
        f'  <rect x="0" y="372" width="136" height="1.4" fill="#6e6480"/>',
        f'  <path d="{"".join(box(x, 377, 4.2, 10) for x in range(6, 134, 10))}" fill="#8a7450"/>',
        f'  <rect x="8" y="272" width="122" height="28" fill="{WALL}"/>',
        f'  <rect x="6" y="266" width="126" height="7" fill="{ROOF}"/>',
        f'  <rect x="8" y="262" width="18" height="38" fill="{blend(WALL, "#ffffff", 0.94)}"/>',
        f'  <rect x="112" y="262" width="18" height="38" fill="{blend(WALL, "#ffffff", 0.94)}"/>',
        f'  <rect x="6" y="258" width="22" height="5" fill="{ROOF}"/>',
        f'  <rect x="110" y="258" width="22" height="5" fill="{ROOF}"/>',
        f'  <rect x="52" y="258" width="34" height="42" fill="{blend(WALL, "#ffffff", 0.9)}"/>',
        f'  <rect x="50" y="252" width="38" height="7" fill="{ROOF}"/>',
        f'  <rect x="58" y="246" width="22" height="7" fill="#d8ba80"/>',
        f'  <path d="M56 246 Q69 224 82 246 Z" fill="#514a68"/>',
        f'  <path d="M69 235.5 L60 246 M69 235.5 L69 246 M69 235.5 L78 246" fill="none" stroke="{GOLD}" stroke-width="0.7"/>',
        f'  <rect x="67" y="229" width="4" height="7" fill="{GOLD}"/>',
        f'  <line x1="69" y1="224" x2="69" y2="229.5" stroke="{GOLD}" stroke-width="1.1"/>',
    ]
    for x in range(60, 78, 5):
        b.add(f'fill="{blend("#3a3040", "#d8ba80", 0.8)}"', box(x, 248, 1.8, 4), 1)
    windows(b, 11, 128, (278, 290), 6, 2.4, 4.5, WALL, 0.5, r)
    windows(b, 55, 84, (264,), 6, 2.4, 4.5, blend(WALL, '#ffffff', 0.9), 0.5, r)
    return p


def matthias_and_bastion(b, r):
    """Matthias Church's spire and the Fisherman's Bastion's white turrets."""
    STONE = '#d8c9a8'
    p = [
        '  <!-- Matthias Church and the Fisherman\'s Bastion on the hill\'s',
        '       higher step -->',
        f'  <rect x="134" y="274" width="42" height="12" fill="#eae2d0"/>',
    ]
    for x in (136, 153, 169):
        p.append(f'  <rect x="{x}" y="264" width="8" height="12" fill="#efe8d8"/>')
        p.append(f'  <path d="M{x - 1} 264 L{x + 4} 254 L{x + 9} 264 Z" fill="#cdbfa4"/>')
        b.add(f'fill="{blend("#3a3040", "#efe8d8", 0.7)}"', box(x + 3, 267, 2, 4), 1)
    p += [
        f'  <rect x="154" y="266" width="20" height="20" fill="{STONE}"/>',
        f'  <path d="M152 266 L164 252 L176 266 Z" fill="#3f8a6a"/>',
        f'  <path d="{box(160, 258, 2, 2)}{box(165, 260, 2, 2)}{box(162.5, 262.5, 2, 2)}" fill="#c9a24a"/>',
        f'  <rect x="148" y="240" width="6" height="46" fill="{STONE}"/>',
        f'  <path d="M146.5 240 L151 206 L155.5 240 Z" fill="#a8967a"/>',
        f'  <line x1="151" y1="201" x2="151" y2="206.5" stroke="#a8967a" stroke-width="1"/>',
    ]
    for y in (246, 256, 266, 276):
        b.add(f'fill="{blend("#3a3040", STONE, 0.75)}"', box(150, y, 2, 5), 1)
    return p


def embankment_houses(seed):
    """A row of lit Buda houses along the left quay."""
    r = random.Random(seed)
    b = Batches()
    parts = []
    walls = ['#cdbb9a', '#bfae90', '#d9c8a8', '#c4b39a']
    x = -4
    while x < 174:
        w = r.uniform(24, 34)
        h = r.uniform(26, 40)
        wall = r.choice(walls)
        top = QUAY_TOP - h
        parts.append(f'  <rect x="{fmt(x)}" y="{fmt(top)}" width="{fmt(w)}" height="{fmt(h + 20)}" fill="{wall}"/>')
        parts.append(f'  <path d="M{fmt(x - 1)} {fmt(top)} L{fmt(x + w * 0.3)} {fmt(top - 6)} L{fmt(x + w * 0.7)} {fmt(top - 6)} L{fmt(x + w + 1)} {fmt(top)} Z" fill="#3e3a50"/>')
        lit_c, dark_c = blend('#fff0c0', wall, 0.92), blend('#3a3040', wall, 0.8)
        wy = top + 5
        while wy < QUAY_TOP - 5:
            wx = x + 3
            while wx < x + w - 4:
                b.add(f'fill="{lit_c if r.random() < 0.4 else dark_c}"', box(wx, wy, 2.6, 4), 1)
                wx += 5.5
            wy += 8.5
        x += w + r.uniform(0.5, 2)
    return parts + [b.render()]


def quay(x0, x1, cap_x):
    w = x1 - x0
    joints = ''.join(box(x, WALL_TOP + 1.6, 0.8, 1.8) for x in range(x0 + 7, x1 - 2, 14))
    joints += ''.join(box(x, WALL_TOP + 4.2, 0.8, 2.6) for x in range(x0, x1 - 2, 14))
    return (
        f'  <rect x="{x0}" y="{QUAY_TOP}" width="{w}" height="{RIVER - QUAY_TOP}" fill="#3c3a48"/>\n'
        f'  <rect x="{x0}" y="{QUAY_TOP}" width="{w}" height="{WALL_TOP - QUAY_TOP}" fill="#625e6c"/>\n'
        f'  <rect x="{x0}" y="{WALL_TOP}" width="{w}" height="1.4" fill="#4e4a5a"/>\n'
        f'  <rect x="{x0}" y="{WALL_TOP + 3.6}" width="{w}" height="0.7" fill="#2c2a36"/>\n'
        f'  <path d="{joints}" fill="#2c2a36"/>\n'
        f'  <rect x="{cap_x}" y="{QUAY_TOP}" width="1.6" height="{RIVER - QUAY_TOP}" fill="#24222e"/>\n'
        f'  <rect x="{x0}" y="{RIVER}" width="{w}" height="2.4" fill="#070c1e"/>\n'
        f'  <rect x="{x0}" y="{RIVER + 2.4}" width="{w}" height="5" fill="#26304e"/>\n'
        f'  <rect x="{x0}" y="{RIVER + 7.4}" width="{w}" height="4" fill="#1c2644"/>'
    )


def chain_bridge():
    """The Széchenyi Chain Bridge: towers, deck, chains, hangers, lights."""
    # the towers are cooler, greyer stone than the Parliament's gold so they
    # read in front of it rather than dissolving into it
    STONE, SHADE, CORNICE, IRON = '#8d8474', '#5f5749', '#aa9f8c', '#30303c'
    LION, PLINTH = '#c9b58c', '#6a6254'
    TL, TR = 96, 304  # tower centrelines
    p = []

    def tower(cx):
        x0 = cx - 13
        return (
            f'    <rect x="{x0}" y="{DECK + DECK_H}" width="26" height="{RIVER - DECK - DECK_H}" fill="{SHADE}"/>\n'
            f'    <rect x="{x0}" y="{DECK + DECK_H}" width="20" height="{RIVER - DECK - DECK_H}" fill="{STONE}"/>\n'
            # pillars either side of the arch, the block above it
            f'    <rect x="{x0}" y="326" width="6" height="{DECK - 326}" fill="{STONE}"/>\n'
            f'    <rect x="{x0 + 20}" y="326" width="6" height="{DECK - 326}" fill="{SHADE}"/>\n'
            f'    <path d="M{x0} 326 H{x0 + 26} V368 H{x0 + 20} A7 7 0 0 0 {x0 + 6} 368 H{x0} Z" fill="{STONE}"/>\n'
            f'    <rect x="{x0 + 20}" y="326" width="6" height="42" fill="{SHADE}"/>\n'
            # the classical entablature: a string course over the arch and
            # the deep cornice slab that crowns the tower
            f'    <rect x="{x0 - 1.5}" y="342" width="29" height="3" fill="{CORNICE}"/>\n'
            f'    <rect x="{x0 - 2.5}" y="321" width="31" height="6" fill="{CORNICE}"/>\n'
            f'    <rect x="{x0 - 2.5}" y="326.5" width="31" height="1" fill="{SHADE}"/>\n'
            f'    <rect x="{x0 - 1}" y="318" width="28" height="3.4" fill="{STONE}"/>'
        )

    main = f'M{TL} 332 Q200 428 {TR} 332'
    side_l = f'M{TL} 332 Q52 380 10 388'
    side_r = f'M{TR} 332 Q348 380 390 388'
    hangers, lights = [], []
    for x in range(TL + 9, TR, 9):
        y = qy((x - TL) / (TR - TL), 332, 428, 332)
        hangers.append(f'M{x} {fmt(y)}V{DECK}')
        lights.append(f'<circle cx="{x}" cy="{fmt(y)}" r="1.05"/>')
    for x in range(18, TL - 4, 9):
        y = qy((x - 10) / (TL - 10), 388, 380, 332)
        hangers.append(f'M{x} {fmt(y)}V{DECK}')
        lights.append(f'<circle cx="{x}" cy="{fmt(y)}" r="1.05"/>')
    for x in range(TR + 9, 388, 9):
        y = qy((x - TR) / (390 - TR), 332, 380, 388)
        hangers.append(f'M{x} {fmt(y)}V{DECK}')
        lights.append(f'<circle cx="{x}" cy="{fmt(y)}" r="1.05"/>')
    lamps = []
    for x in (30, 62, 140, 200, 260, 338, 370):
        lamps.append(
            f'    <line x1="{x}" y1="{DECK}" x2="{x}" y2="{DECK - 8}" stroke="{IRON}" stroke-width="1.2"/>\n'
            f'    <circle cx="{x}" cy="{DECK - 9.5}" r="4.5" fill="url(#huLamp)"/>\n'
            f'    <circle cx="{x}" cy="{DECK - 9.5}" r="1.5" fill="#ffe9b0"/>'
        )

    def lion(x, flip):
        s = -1 if flip else 1
        return (
            f'    <rect x="{x - 9}" y="380" width="18" height="12" fill="{PLINTH}"/>\n'
            f'    <g transform="translate({x} 380) scale({s} 1)">\n'
            f'      <path d="M-7 0 Q-7 -6 -1 -7 Q5 -8 7 -3 L7 0 Z" fill="{LION}"/>\n'
            f'      <circle cx="5" cy="-7.5" r="2.6" fill="{LION}"/>\n'
            f'      <path d="M2.5 -9 Q5 -12 8 -9" fill="none" stroke="{LION}" stroke-width="1.4"/>\n'
            f'    </g>'
        )

    p.append('  <!-- the Chain Bridge: deck, stone arch towers, the chains and their')
    p.append('       hangers, and the string of lights that outlines them at night -->')
    p.append('  <g>')
    p.append(f'    <rect x="-4" y="{DECK}" width="{W + 8}" height="{DECK_H}" fill="#2a2a36"/>')
    p.append(f'    <rect x="-4" y="{DECK}" width="{W + 8}" height="1.6" fill="#5a5a68"/>')
    p.append(f'    <line x1="-4" y1="{DECK - 2.5}" x2="{W + 4}" y2="{DECK - 2.5}" stroke="#5a5a68" stroke-width="0.8"/>')
    p.append(tower(TL))
    p.append(tower(TR))
    p.append(f'    <rect x="2" y="384" width="16" height="8" fill="{SHADE}"/>')
    p.append(f'    <rect x="382" y="384" width="16" height="8" fill="{SHADE}"/>')
    p.append(f'    <path d="{"".join(hangers)}" stroke="{IRON}" stroke-width="0.6"/>')
    p.append(f'    <path d="{main} {side_l} {side_r}" fill="none" stroke="#ffd9a0" stroke-width="5" opacity="0.12"/>')
    p.append(f'    <path d="{main} {side_l} {side_r}" fill="none" stroke="{IRON}" stroke-width="2.4"/>')
    p.append(f'    <g fill="#ffe9b0">{"".join(lights)}</g>')
    p.append('\n'.join(lamps))
    p.append(lion(22, False))
    p.append(lion(378, True))
    p.append('  </g>')
    return p


# ------------------------------------------------------------------ scene
def budapest():
    r = random.Random(1873)
    b = Batches()  # windows across all the floodlit buildings

    parl = parliament(b, r)
    pal = palace(b, r)
    matt = matthias_and_bastion(b, r)
    houses = embankment_houses(1896)
    bridge = chain_bridge()

    # the Sikló: rails from the bridgehead up to the palace terrace, and the
    # cabin riding them
    rails = ''.join(f'M{fmt(46 + d)} 392 L{fmt(24 + d)} 304' for d in (-1.6, 1.6))

    # tram windows
    tram_windows = ''.join(box(x, 423, 2.6, 3) for x in range(2, 22, 4))
    boat_windows = ''.join(box(x, -9, 2.2, 2.2) for x in range(-16, 16, 4))

    stars = []
    sr = random.Random(1956)
    for i in range(16):
        x, y = sr.uniform(6, 394), sr.uniform(96, 250)
        rr = sr.uniform(0.7, 1.2)
        if i % 4 == 0:
            stars.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(rr)}" opacity="0.5"><animate attributeName="opacity" values="0.2;0.75;0.2" dur="{fmt(3 + i * 0.3)}s" begin="{fmt(i * 0.4)}s" repeatCount="indefinite"/></circle>')
        else:
            stars.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(rr)}" opacity="{fmt(sr.uniform(0.35, 0.6))}"/>')

    # shimmer across the big reflections: thin dark bars, batched
    shimmer = ''.join(box(x, y, w, 0.8) for x, y, w in (
        (240, 454, 50), (300, 466, 70), (250, 482, 90), (330, 500, 50),
        (14, 452, 44), (60, 468, 56), (24, 486, 70),
    ))

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">
  <!-- Budapest at night for the Hungary card, looking north up the Danube:
       the Chain Bridge outlined in lights, Castle Hill with the Royal
       Palace, Matthias Church and the Fisherman's Bastion on the left, the
       Parliament floodlit along the Pest bank on the right, all of it
       mirrored in the river. Tram 2 runs the embankment, the Sikló climbs
       the hill, a cruise boat drifts through, stars twinkle (SMIL).
       Generated by scripts/build-budapest.py. -->
  <defs>
    <linearGradient id="huSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#080c26" stop-opacity="0.96"/>
      <stop offset="0.4" stop-color="#151f4a" stop-opacity="0.96"/>
      <stop offset="0.75" stop-color="#2a3468" stop-opacity="0.96"/>
      <stop offset="1" stop-color="#5c4a6e" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="huFarRiver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6a5878"/>
      <stop offset="1" stop-color="#23305a"/>
    </linearGradient>
    <linearGradient id="huRiver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#10203f"/>
      <stop offset="0.5" stop-color="#0a152f"/>
      <stop offset="1" stop-color="#050b1f"/>
    </linearGradient>
    <linearGradient id="huGoldRef" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e0c187" stop-opacity="0.42"/>
      <stop offset="0.5" stop-color="#e0c187" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#e0c187" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="huMoon">
      <stop offset="0" stop-color="#f4f0dc" stop-opacity="0.5"/>
      <stop offset="0.5" stop-color="#e6e0d0" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#d8d4c8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="huLamp">
      <stop offset="0" stop-color="#ffe9b0" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="huSmear">
      <stop offset="0" stop-color="#ffd9a0" stop-opacity="0.2"/>
      <stop offset="0.55" stop-color="#ffd9a0" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="{W}" height="{RIVER}" fill="url(#huSky)"/>
  <g fill="#ffffff">{"".join(stars)}</g>
  <!-- the moon over Pest -->
  <circle cx="322" cy="212" r="30" fill="url(#huMoon)"/>
  <circle cx="322" cy="212" r="10" fill="#f2eedc"/>
  <circle cx="318.5" cy="209" r="1.6" fill="#e0dccc"/>
  <circle cx="325" cy="215" r="1.1" fill="#e0dccc"/>

  <!-- the river bending away north between dark far banks -->
  <path d="M150 {RIVER} L172 384 Q200 362 228 384 L250 {RIVER} Z" fill="#111736"/>
  <path d="M172 {RIVER} L196 374 L204 374 L228 {RIVER} Z" fill="url(#huFarRiver)"/>

  <!-- Castle Hill: stepped rock with two flat tops — the palace stands on
       the lower one, Matthias and the Bastion on the higher — and a face
       that runs solid down to the embankment; faint strata on the face -->
  <path d="M0 {RIVER} L0 300 L136 300 L136 286 L176 286 L190 {RIVER} Z" fill="#1a1e40"/>
  <path d="M0 300 H136 V286 H176" fill="none" stroke="#3a3e6a" stroke-width="1.4"/>
  <path d="{box(0, 322, 136, 0.9)}{box(0, 346, 136, 0.9)}{box(136, 310, 41, 0.9)}{box(136, 334, 43, 0.9)}{box(136, 358, 45, 0.9)}" fill="#242a52"/>
{chr(10).join(matt)}
{chr(10).join(pal)}
  <!-- the Sikló -->
  <path d="{rails}" stroke="#5a5a6a" stroke-width="0.8"/>
  <g>
    <animateTransform attributeName="transform" type="translate"
      values="46 388; 24 300; 24 300; 46 388; 46 388" keyTimes="0; 0.42; 0.5; 0.92; 1" dur="34s" repeatCount="indefinite"/>
    <rect x="-3.2" y="-5.5" width="6.4" height="5.5" rx="0.8" fill="#d8c8a0"/>
    <rect x="-2.2" y="-4.5" width="4.4" height="2.6" fill="#fff0c0"/>
  </g>
{chr(10).join(houses)}

  <!-- Pest -->
{chr(10).join(parl)}
{b.render()}
  <!-- tram 2 along the embankment, pausing out of sight behind the tower -->
  <g>
    <animateTransform attributeName="transform" type="translate"
      values="410 0; 292 0; 292 0; 410 0; 410 0" keyTimes="0; 0.36; 0.56; 0.92; 1" dur="44s" repeatCount="indefinite"/>
    <rect x="0" y="421" width="24" height="8" rx="1.5" fill="#f2c230"/>
    <rect x="0" y="421" width="24" height="1.4" fill="#e8e3d6"/>
    <path d="{tram_windows}" fill="#fff0c0"/>
    <rect x="1" y="428" width="22" height="1.2" fill="#3a2a22"/>
  </g>

  <!-- the Danube -->
  <rect y="{RIVER}" width="{W}" height="{H - RIVER}" fill="url(#huRiver)"/>
  <rect x="230" y="{RIVER}" width="174" height="90" fill="url(#huGoldRef)"/>
  <rect x="6" y="{RIVER}" width="126" height="64" fill="url(#huGoldRef)"/>
  <path d="{shimmer}" fill="#0a1230"/>
  <ellipse cx="96" cy="{RIVER + 30}" rx="9" ry="30" fill="url(#huSmear)"/>
  <ellipse cx="200" cy="{RIVER + 28}" rx="8" ry="26" fill="url(#huSmear)"/>
  <ellipse cx="304" cy="{RIVER + 30}" rx="9" ry="30" fill="url(#huSmear)"/>
{quay(-4, 172, 170.4)}
{quay(228, 404, 228)}

{chr(10).join(bridge)}

  <g fill="none" stroke="#5a6a98" stroke-width="1.4" opacity="0.16">
    <path d="M0 500 Q100 496 200 500 T400 500"/>
    <path d="M0 540 Q100 536 200 540 T400 540"/>
    <path d="M0 578 Q100 574 200 578 T400 578"/>
  </g>

  <!-- a sightseeing boat, cabin lit, drifting downriver -->
  <g>
    <animateTransform attributeName="transform" type="translate" values="-60 536; 460 530" dur="120s" repeatCount="indefinite"/>
    <path d="M-22 0 Q0 6 22 0 L19 -4 L-19 -4 Z" fill="#1a1a24"/>
    <rect x="-17" y="-11" width="34" height="7.5" rx="1.5" fill="#e8e3d6"/>
    <path d="{boat_windows}" fill="#ffe9b0"/>
    <line x1="10" y1="-11" x2="10" y2="-16" stroke="#e8e3d6" stroke-width="0.9"/>
    <circle cx="10" cy="-16.5" r="1" fill="#ff8a7a"/>
    <path d="M-28 3 Q0 7 28 3" fill="none" stroke="#5a6a98" stroke-width="1" opacity="0.35"/>
  </g>
</svg>'''


open('public/frames/hu-budapest.svg', 'w').write(budapest() + '\n')
print('written public/frames/hu-budapest.svg')
