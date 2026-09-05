#!/usr/bin/env python3
"""HTG Heavycore — procedural death-metal display face.

Every glyph is a stroke skeleton swept with a broad calligraphic nib, given
spiked terminals, barbs, cracks and a jagged edge, then unioned into TrueType
contours. Deterministic (seeded), no external artwork.

  python3 scripts/build-font.py            # writes assets/fonts/HTGHeavycore.{ttf,woff2}
  python3 scripts/build-font.py --preview  # also renders assets/fonts/specimen.png

Deps: fonttools, brotli, shapely, numpy, pillow (preview only).
"""
import math, sys, os, hashlib
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, LineString, Point
from shapely.ops import unary_union
from shapely.geometry.polygon import orient
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPM = 1000
CAP = 700           # cap height
DESC = -160
NIB_L, NIB_T, NIB_A = 168, 50, math.radians(30)   # nib length, thickness, angle
SB = 28             # sidebearing
FAMILY = "HTG Heavycore"
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")

# ---------------------------------------------------------------- skeletons
# Each glyph: (advance_width_without_sidebearings, [polyline, ...])
# Coordinates: x 0..W, y 0 baseline .. 700 cap. Curves via arc().
def arc(cx, cy, r, a0, a1, n=14, rx=None):
    rx = r if rx is None else rx
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

def bowl(x0, y0, x1, y1, side="right", n=12):
    """Half-ellipse from (x0,y0) top to (x0,y1) bottom bulging to x1."""
    cx, cy = x0, (y0 + y1) / 2
    ry, rx = abs(y0 - y1) / 2, abs(x1 - x0)
    a0, a1 = (90, -90) if side == "right" else (90, 270)
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

G = {}
def g(name, w, *strokes): G[name] = (w, [list(s) for s in strokes])

C = CAP; M = C / 2
g("A", 560, [(20, 0), (280, C)], [(280, C), (540, 0)], [(110, 250), (450, 250)])
g("B", 500, [(60, 0), (60, C)], [(60, C)] + bowl(60, C, 400, M + 20)[:] , [(60, M + 20)] + bowl(60, M + 20, 440, 0))
g("C", 520, arc(300, M, 320, 50, 310, rx=270))
g("D", 540, [(60, 0), (60, C)], [(60, C)] + bowl(60, C, 470, 0))
g("E", 470, [(60, 0), (60, C)], [(60, C), (450, C)], [(60, M), (360, M)], [(60, 0), (450, 0)])
g("F", 450, [(60, 0), (60, C)], [(60, C), (440, C)], [(60, M), (350, M)])
g("G", 560, arc(300, M, 320, 50, 310, rx=270) , [(330, 300), (560, 300), (560, 40)])
g("H", 560, [(60, 0), (60, C)], [(500, 0), (500, C)], [(60, M), (500, M)])
g("I", 200, [(100, 0), (100, C)])
g("J", 420, [(360, C), (360, 130)] + arc(230, 130, 130, 0, -180)[1:])
g("K", 520, [(60, 0), (60, C)], [(490, C), (60, 280)], [(200, 380), (500, 0)])
g("L", 440, [(60, C), (60, 0)], [(60, 0), (430, 0)])
g("M", 680, [(60, 0), (60, C)], [(60, C), (340, 220)], [(340, 220), (620, C)], [(620, C), (620, 0)])
g("N", 580, [(60, 0), (60, C)], [(60, C), (520, 0)], [(520, 0), (520, C)])
g("O", 580, arc(290, M, 330, 90, 450, n=24, rx=260))
g("P", 490, [(60, 0), (60, C)], [(60, C)] + bowl(60, C, 420, 300))
g("Q", 580, arc(290, M, 330, 90, 450, n=24, rx=260), [(330, 160), (560, -120)])
g("R", 520, [(60, 0), (60, C)], [(60, C)] + bowl(60, C, 420, 310), [(230, 310), (510, 0)])
g("S", 480, arc(250, C - 170, 170, 40, 270, n=12, rx=200)[:] + arc(250, 170, 170, 90, -90, n=12, rx=210)[1:] + [(90, 60)])
g("T", 480, [(30, C), (450, C)], [(240, C), (240, 0)])
g("U", 560, [(60, C), (60, 180)] + arc(280, 180, 180, 180, 360)[1:] + [(500, C)])
g("V", 560, [(20, C), (280, 0)], [(280, 0), (540, C)])
g("W", 820, [(20, C), (210, 0)], [(210, 0), (410, 520)], [(410, 520), (610, 0)], [(610, 0), (800, C)])
g("X", 540, [(30, C), (510, 0)], [(510, C), (30, 0)])
g("Y", 540, [(30, C), (270, 320)], [(510, C), (270, 320)], [(270, 320), (270, 0)])
g("Z", 500, [(50, C), (460, C)], [(460, C), (40, 0)], [(40, 0), (470, 0)])
g("zero", 520, arc(260, M, 330, 90, 450, n=24, rx=220), [(150, 200), (370, 500)])
g("one", 320, [(60, 500), (200, C)], [(200, C), (200, 0)], [(60, 0), (300, 0)])
g("two", 480, arc(240, 500, 190, 170, -70, n=12), [(390, 380), (40, 0)], [(40, 0), (460, 0)])
g("three", 480, [(50, C), (430, C)], [(430, C), (220, 400)], [(220, 400)] + bowl(220, 400, 440, 0, n=10))
g("four", 520, [(360, 0), (360, C)], [(360, C), (30, 200)], [(30, 200), (500, 200)])
g("five", 480, [(430, C), (90, C)], [(90, C), (70, 380)], [(70, 380)] + bowl(90, 400, 440, 0, n=10))
g("six", 500, arc(250, 230, 230, 90, 450, n=18, rx=210), [(120, 400), (300, C), (440, C - 40)])
g("seven", 460, [(30, C), (440, C)], [(440, C), (170, 0)])
g("eight", 500, arc(250, 510, 190, 90, 450, n=16, rx=175), arc(250, 215, 215, 90, 450, n=16, rx=210))
g("nine", 500, arc(250, 470, 230, 90, 450, n=18, rx=210), [(380, 300), (200, 0), (60, 40)])
g("period", 200, [(100, 60), (100, 120)])
g("comma", 200, [(110, 120), (60, -110)])
g("colon", 200, [(100, 60), (100, 120)], [(100, 380), (100, 440)])
g("semicolon", 200, [(110, 380), (110, 440)], [(110, 120), (60, -110)])
g("exclam", 220, [(110, C), (110, 220)], [(110, 60), (110, 120)])
g("question", 460, arc(230, 500, 180, 170, -70, n=12), [(380, 400), (240, 260), (240, 200)], [(240, 60), (240, 120)])
g("hyphen", 360, [(40, 300), (320, 300)])
g("endash", 500, [(40, 300), (460, 300)])
g("emdash", 800, [(20, 300), (780, 300)])
g("underscore", 520, [(0, -60), (520, -60)])
g("slash", 440, [(400, C), (40, -80)])
g("backslash", 440, [(40, C), (400, -80)])
g("quotesingle", 180, [(90, C), (90, 500)])
g("quotedbl", 320, [(80, C), (80, 500)], [(240, C), (240, 500)])
g("quoteright", 180, [(110, C), (60, 480)])
g("quoteleft", 180, [(60, C), (110, 480)])
g("apostrophe_alias", 180, [(110, C), (60, 480)])
g("parenleft", 320, arc(420, M, 380, 130, 230, n=10, rx=300))
g("parenright", 320, arc(-100, M, 380, 50, -50, n=10, rx=300))
g("bracketleft", 320, [(280, C), (90, C)], [(90, C), (90, -60)], [(90, -60), (280, -60)])
g("bracketright", 320, [(40, C), (230, C)], [(230, C), (230, -60)], [(230, -60), (40, -60)])
g("ampersand", 600, [(520, 0), (120, 520)] + arc(240, 560, 140, 200, -80, n=10)[1:] , [(200, 420), (60, 220)] + arc(240, 180, 180, 180, 360, n=10)[1:] + [(560, 320)])
g("asterisk", 400, [(200, C), (200, 380)], [(50, 620), (350, 460)], [(350, 620), (50, 460)])
g("plus", 460, [(230, 520), (230, 120)], [(30, 320), (430, 320)])
g("equal", 460, [(40, 420), (420, 420)], [(40, 220), (420, 220)])
g("numbersign", 520, [(160, C), (100, 0)], [(400, C), (340, 0)], [(40, 450), (500, 450)], [(20, 250), (480, 250)])
g("at", 660, arc(330, 330, 300, 30, 340, n=18, rx=280), arc(330, 330, 130, 90, 450, n=12), [(460, 330), (460, 200), (560, 200)])
g("percent", 620, [(560, C), (60, 0)], arc(140, 560, 120, 90, 450, n=12), arc(480, 140, 120, 90, 450, n=12))
g("dollar", 480, arc(250, C - 170, 170, 40, 270, n=12, rx=200)[:] + arc(250, 170, 170, 90, -90, n=12, rx=210)[1:] + [(90, 60)], [(250, C + 60), (250, -80)])
g("less", 420, [(400, 600), (40, 320)], [(40, 320), (400, 40)])
g("greater", 420, [(20, 600), (380, 320)], [(380, 320), (20, 40)])
g("bar", 180, [(90, C + 40), (90, -120)])
g("degree", 260, arc(130, 600, 80, 90, 450, n=10))
g("multiply", 460, [(60, 520), (400, 120)], [(400, 520), (60, 120)])
g("bullet", 300, arc(150, 300, 70, 90, 450, n=10))
g("space", 260)

# ---------------------------------------------------------------- pen
def nib_corners(x, y, scale=1.0):
    L, T = NIB_L * scale / 2, NIB_T * scale / 2
    ca, sa = math.cos(NIB_A), math.sin(NIB_A)
    return [(x + ca * dx - sa * dy, y + sa * dx + ca * dy)
            for dx, dy in ((-L, -T), (L, -T), (L, T), (-L, T))]

def sweep(poly, scale=1.0):
    parts = []
    for (x0, y0), (x1, y1) in zip(poly, poly[1:]):
        parts.append(Polygon(nib_corners(x0, y0, scale) + nib_corners(x1, y1, scale)).convex_hull)
    return unary_union(parts)

def spike(px, py, dx, dy, length, base, rng, curl=0.0):
    """Tapered blade from point along (dx,dy); slight sideways curl."""
    n = math.hypot(dx, dy) or 1
    dx, dy = dx / n, dy / n
    nx, ny = -dy, dx
    tipx = px + dx * length + nx * curl * length
    tipy = py + dy * length + ny * curl * length
    midx = px + dx * length * 0.5 + nx * curl * length * 0.18
    midy = py + dy * length * 0.5 + ny * curl * length * 0.18
    b = base / 2
    return Polygon([(px + nx * b, py + ny * b), (midx + nx * b * 0.45, midy + ny * b * 0.45),
                    (tipx, tipy), (midx - nx * b * 0.45, midy - ny * b * 0.45),
                    (px - nx * b, py - ny * b)])

def jag(geom, rng, amp=11.0, step=20.0):
    """Displace boundary along its normal with band-limited noise: chipped edge."""
    def ring(coords):
        ls = LineString(coords)
        L = ls.length
        n = max(8, int(L / step))
        pts = [ls.interpolate(i / n, normalized=True) for i in range(n)]
        # smooth noise
        raw = rng.normal(0, 1, n + 4)
        sm = np.convolve(raw, [0.15, 0.35, 0.35, 0.15], mode="same")[:n]
        out = []
        for i, p in enumerate(pts):
            a, b = pts[i - 1], pts[(i + 1) % n]
            tx, ty = b.x - a.x, b.y - a.y
            m = math.hypot(tx, ty) or 1
            nx, ny = -ty / m, tx / m
            d = sm[i] * amp
            # occasional deeper nick
            if rng.random() < 0.06:
                d -= rng.uniform(amp, amp * 2.6)
            out.append((p.x + nx * d, p.y + ny * d))
        return out
    def one(poly):
        try:
            p = Polygon(ring(poly.exterior.coords), [ring(h.coords) for h in poly.interiors])
            p = p.buffer(0)
            return p if not p.is_empty else poly
        except Exception:
            return poly
    if isinstance(geom, MultiPolygon):
        return unary_union([one(p) for p in geom.geoms])
    return one(geom)

def crack(geom, rng, count):
    """Thin dark veins cut into the body."""
    minx, miny, maxx, maxy = geom.bounds
    cuts = []
    for _ in range(count):
        x = rng.uniform(minx, maxx); y = rng.uniform(miny + 60, maxy - 60)
        ang = rng.uniform(-0.5, 0.5) + (math.pi / 2 if rng.random() < 0.5 else 0.15)
        L = rng.uniform(110, 240)
        pts = [(x, y)]
        for k in range(3):
            ang += rng.normal(0, 0.55)
            pts.append((pts[-1][0] + math.cos(ang) * L / 3, pts[-1][1] + math.sin(ang) * L / 3))
        cuts.append(LineString(pts).buffer(rng.uniform(7, 12), cap_style=2))
    out = geom.difference(unary_union(cuts))
    # never let a crack sever the glyph
    return out if out.geom_type == geom.geom_type or out.geom_type == "Polygon" else geom

def build_glyph(name):
    w, strokes = G[name]
    rng = np.random.default_rng(int(hashlib.md5(name.encode()).hexdigest()[:8], 16))
    if not strokes:
        return None, w
    body = [sweep(s) for s in strokes]
    body = unary_union(body)
    extras = []
    for s in strokes:
        if len(s) < 2:
            continue
        # terminal blades at both open ends
        for p, q in ((s[0], s[1]), (s[-1], s[-2])):
            dx, dy = p[0] - q[0], p[1] - q[1]
            vertical = abs(dy) > abs(dx)
            length = rng.uniform(140, 260) if vertical else rng.uniform(90, 170)
            base = (NIB_L * math.cos(NIB_A)) * 0.95 if vertical else NIB_L * math.sin(NIB_A) * 1.1
            # bottom terminals drip down, top ones flare up
            if dy < -20:
                dx *= 0.35
            elif dy > 20:
                dx *= 0.5
            extras.append(spike(p[0], p[1], dx, dy, length, base, rng, curl=rng.uniform(-0.35, 0.35)))
        # barbs off the stroke sides
        ls = LineString(s)
        nb = int(ls.length / 110) + 2
        for _ in range(nb):
            t = rng.uniform(0.15, 0.85)
            pt = ls.interpolate(t, normalized=True)
            pt2 = ls.interpolate(min(t + 0.02, 1), normalized=True)
            tx, ty = pt2.x - pt.x, pt2.y - pt.y
            m = math.hypot(tx, ty) or 1
            side = 1 if rng.random() < 0.5 else -1
            nx, ny = -ty / m * side, tx / m * side
            # push origin onto the stroke edge
            ox, oy = pt.x + nx * NIB_L * 0.3, pt.y + ny * NIB_L * 0.3
            ang = math.atan2(ny, nx) + rng.uniform(-0.9, 0.9)
            L = rng.uniform(45, 130)
            extras.append(spike(ox, oy, math.cos(ang), math.sin(ang), L, rng.uniform(20, 40), rng, curl=rng.uniform(-0.5, 0.5)))
    geom = unary_union([body] + extras)
    geom = crack(geom, rng, count=int(rng.integers(2, 4)))
    geom = jag(geom, rng)
    geom = geom.simplify(1.2)
    return geom, w

def draw(pen, geom):
    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    for poly in polys:
        if poly.area < 150:
            continue
        poly = orient(poly, sign=-1.0)          # TrueType: outer clockwise
        for ring in [poly.exterior] + list(poly.interiors):
            coords = list(ring.coords)[:-1]
            if len(coords) < 3:
                continue
            pen.moveTo((round(coords[0][0]), round(coords[0][1])))
            for x, y in coords[1:]:
                pen.lineTo((round(x), round(y)))
            pen.closePath()

# ---------------------------------------------------------------- font
CMAP = {
    "space": 0x20, "exclam": 0x21, "quotedbl": 0x22, "numbersign": 0x23, "dollar": 0x24,
    "percent": 0x25, "ampersand": 0x26, "quotesingle": 0x27, "parenleft": 0x28,
    "parenright": 0x29, "asterisk": 0x2A, "plus": 0x2B, "comma": 0x2C, "hyphen": 0x2D,
    "period": 0x2E, "slash": 0x2F, "colon": 0x3A, "semicolon": 0x3B, "less": 0x3C,
    "equal": 0x3D, "greater": 0x3E, "question": 0x3F, "at": 0x40, "bracketleft": 0x5B,
    "backslash": 0x5C, "bracketright": 0x5D, "underscore": 0x5F, "bar": 0x7C,
    "endash": 0x2013, "emdash": 0x2014, "quoteleft": 0x2018, "quoteright": 0x2019,
    "degree": 0xB0, "multiply": 0xD7, "bullet": 0x2022,
}
for i, n in enumerate("zero one two three four five six seven eight nine".split()):
    CMAP[n] = 0x30 + i
for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
    CMAP[c] = ord(c)

def main():
    names = [n for n in G if n != "apostrophe_alias"]
    glyph_order = [".notdef"] + names
    glyphs, metrics, cmap = {}, {}, {}
    for n in names:
        pen = TTGlyphPen(None)
        geom, w = build_glyph(n)
        if geom is not None:
            draw(pen, geom)
            minx, _, maxx, _ = geom.bounds
            lsb = int(round(minx)) + SB
            adv = int(round(maxx - minx)) + 2 * SB
            # shift so left extreme sits at SB
            pen2 = TTGlyphPen(None)
            from shapely.affinity import translate
            draw(pen2, translate(geom, xoff=SB - minx))
            glyphs[n] = pen2.glyph(); metrics[n] = (adv, SB)
        else:
            glyphs[n] = pen.glyph(); metrics[n] = (w, 0)
        cmap[CMAP[n]] = n
    # lowercase -> caps, nbsp -> space, quotedblleft/right, ellipsis-ish
    for c in "abcdefghijklmnopqrstuvwxyz":
        cmap[ord(c)] = c.upper()
    cmap[0xA0] = "space"; cmap[0x201C] = "quotedbl"; cmap[0x201D] = "quotedbl"
    cmap[0x2010] = "hyphen"; cmap[0x2011] = "hyphen"
    nd = TTGlyphPen(None); nd.moveTo((60, 0)); nd.lineTo((60, CAP)); nd.lineTo((360, CAP)); nd.lineTo((360, 0)); nd.closePath()
    nd.moveTo((120, 60)); nd.lineTo((300, 60)); nd.lineTo((300, CAP - 60)); nd.lineTo((120, CAP - 60)); nd.closePath()
    glyphs[".notdef"] = nd.glyph(); metrics[".notdef"] = (420, 60)

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=CAP + 220, descent=DESC - 80, lineGap=0)
    fb.setupOS2(sTypoAscender=CAP + 220, sTypoDescender=DESC - 80, sTypoLineGap=0,
                usWinAscent=CAP + 260, usWinDescent=-(DESC - 120), sCapHeight=CAP, sxHeight=CAP,
                usWeightClass=900, usWidthClass=5, fsType=0, achVendID="HTG ",
                ulCodePageRange1=1, ulUnicodeRange1=1)
    fb.setupNameTable({
        "familyName": FAMILY, "styleName": "Black",
        "fullName": FAMILY + " Black", "psName": "HTGHeavycore-Black",
        "uniqueFontIdentifier": "HTG;HTGHeavycore-Black;1.0",
        "version": "Version 1.000",
        "copyright": "Copyright 2026 HTG / Hex The Government. Generated by scripts/build-font.py.",
        "manufacturer": "HTG", "designer": "HTG",
        "licenseDescription": "Proprietary. Property of HTG; use on HTG web and merchandise only.",
    })
    fb.setupPost(isFixedPitch=0)
    fb.setupHead(unitsPerEm=UPM)
    os.makedirs(OUT, exist_ok=True)
    ttf = os.path.join(OUT, "HTGHeavycore.ttf")
    fb.save(ttf)
    from fontTools.ttLib import TTFont
    f = TTFont(ttf); f.flavor = "woff2"; f.save(os.path.join(OUT, "HTGHeavycore.woff2"))
    print("wrote", ttf, "glyphs:", len(glyph_order))
    if "--preview" in sys.argv:
        preview(ttf)

def preview(ttf):
    from PIL import Image, ImageDraw, ImageFont
    lines = ["HEX THE GOVERNMENT", "ABRAXAS", "STRETTY  CIGGIE  JUSTIN", "SUIT PURGE",
             "ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "0123456789 !?&.,:;'\"-/()"]
    img = Image.new("L", (2400, 1900), 0); d = ImageDraw.Draw(img)
    y = 40
    for ln in lines:
        size = 180 if len(ln) < 14 else 130
        f = ImageFont.truetype(ttf, size)
        d.text((60, y), ln, font=f, fill=255)
        y += int(size * 1.35)
    p = os.path.join(OUT, "specimen.png"); img.save(p); print("wrote", p)

if __name__ == "__main__":
    main()
