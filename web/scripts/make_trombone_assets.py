#!/usr/bin/env python3
"""Generate the 7 trombone slide-position images for PitchQuest.

Run from anywhere:  python3 web/scripts/make_trombone_assets.py
Source asset : .tmp/trombone.webp (1920x1356 flat vector, white background).
             (repo copy of the licensed source drawing; keep in sync)
Output       : web/public/trombone/trombone-pos-{1..7}.webp (lossless WebP, alpha)

PHYSICS (why the offsets are NOT linear):
  A trombone slide extends logarithmically. For a tenor trombone with
  effective tube length L ~= 111 in, the extension from position 1 needed to
  sound n-1 semitones lower is
      E_n = (L/2) * (2^((n-1)/12) - 1)
  The artwork is drawn ~34 px per inch (bell rim = 270 px for ~8 in, bell
  section = 1106 px for ~33 in), so K = L/2 * 34 = 1887 px and
      E_n = round(K * (2^((n-1)/12) - 1))
      pos 1..7 -> 0, 112, 231, 358, 492, 632, 782 px
  (per-position deltas grow ~112 -> 150 px; the old linear 60 px/position
  compressed positions 3-7 into what looked like position 3.)

GEOMETRY / METHOD:
  The movable OUTER SLIDE is the lower-band artwork at x >= CUT_X: upper
  tube, slide brace (x 842-857), lower tube and the right U-crook (right
  edge x = 1831 at position 1). The joint caps (light band, x 791-799) stay
  with the BODY, together with the bell, top tube, left crook, mouthpiece
  and body-side brace (x 733-748).

  For position p the slide layer is alpha_composite'd at offset E_p, and the
  two exposed inner-slide tubes are drawn across the widening gap by
  horizontally replicating a reference column of each tube (preserves the
  tubes' vertical shading: light top edge, highlight band, fill, dark bottom
  edge). pos-1 is offset 0 with no bars => pixel-identical to the source.

  Canvas: 2700 x 1000 (2.7:1) for all seven variants. The source drawing wastes
  most of its frame: the artwork occupies x 88..1831 (+E_p), y 440..919 of the
  1920x1356 sheet, i.e. 64% of the width and 35% of the height. The new canvas
  trims that away:
    * Y_OFFSET = 400 removes the empty band above the artwork, so it starts at
      y=40 (40 px of top padding) and ends at y=519.
    * SHIFTS re-centers each variant: the slide layer moves with the body, so
      the whole artwork (x 88 .. 1831 + E_p) is shifted by
      1350 - (88 + 1831 + E_p) / 2 and lands centered on the canvas at every
      position, with equal left/right margins (87 px at pos-7).
  CSS in web/src/styles/pages.css keys off these numbers (ruler band, figure
  max-width, image max-height).
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))          # web/scripts
ROOT = os.path.dirname(os.path.dirname(HERE))              # repo root
SRC = os.path.join(ROOT, ".tmp", "trombone.webp")
OUT_DIR = os.path.join(HERE, "..", "public", "trombone")   # web/public/trombone

SOFT_LO = 8        # L1 distance from background below which pixels are transparent
SOFT_RAMP = 6      # alpha = (dist - SOFT_LO) * SOFT_RAMP, clamped to 255
CUT_X = 805        # slide layer = artwork with x >= CUT_X and y >= BAND_TOP
BAND_TOP = 745     # lower band top (bell rim AA ends y=734; tube AA starts y=754)
REF_X = 1500       # column used to sample tube cross-sections for the bars
STRIP_PAD = 4      # rows added above/below each measured tube run
ART_X0 = 88        # artwork's leftmost x in source px (mouthpiece end)
CROOK_RIGHT_X1 = 1831  # slide crook rightmost x at position 1 (in source px)
K_PX = 1887        # L/2 (in) * 34 px/in: px of slide extension per 2^((n-1)/12)-1
# E_n = round(K_PX * (2^((n-1)/12) - 1)); values as derived in the task brief
OFFSETS = [0, 112, 231, 358, 492, 632, 782]
N_POS = 7

# -------------------------------------------------------------- new canvas
CANVAS_W = 2700    # 87 px of margin either side of the pos-7 artwork
CANVAS_H = 1000    # artwork occupies y 40..519; the rest is empty
Y_OFFSET = 400     # trim the empty band above the artwork (topmost y is 440)


def round_px(v: float) -> int:
    """Round a pixel offset to the nearest whole pixel (halves away from zero)."""
    return int(v + 0.5) if v >= 0 else -int(-v + 0.5)


# Per-variant x shift that re-centers the artwork (slide included) on the canvas.
SHIFTS = [round_px(CANVAS_W / 2 - (ART_X0 + CROOK_RIGHT_X1 + e) / 2) for e in OFFSETS]

# ---------------------------------------------------------------- load + cut
src = Image.open(SRC).convert("RGB")
W, H = src.size
spx = src.load()
bg = spx[5, 5]
print(f"source {W}x{H}, bg={bg}")

def dist(c):
    return abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2])

def soft_alpha(c):
    """Alpha by color distance from the background: fully transparent for
    near-background pixels, smooth ramp so anti-aliased edges don't leave
    opaque near-white specks, fully opaque for all real artwork."""
    d = dist(c)
    if d <= SOFT_LO:
        return 0
    return min(255, (d - SOFT_LO) * SOFT_RAMP)

body = Image.new("RGBA", (W, H), (0, 0, 0, 0))
slide = Image.new("RGBA", (W, H), (0, 0, 0, 0))
bpx, slpx = body.load(), slide.load()
for y in range(H):
    for x in range(W):
        c = spx[x, y]
        a = soft_alpha(c)
        if a == 0:
            continue
        if x >= CUT_X and y >= BAND_TOP:
            slpx[x, y] = (c + (a,))
        else:
            bpx[x, y] = (c + (a,))

# sanity: slide layer must contain exactly the lower-band artwork
slide_runs = {}
for x in range(CUT_X, W):
    ys = [y for y in range(BAND_TOP, H) if slpx[x, y][3] > 0]
    if ys:
        slide_runs[x] = (min(ys), max(ys))
xs = sorted(slide_runs)
print(f"slide layer: x {xs[0]}..{xs[-1]}, y {min(v[0] for v in slide_runs.values())}"
      f"..{max(v[1] for v in slide_runs.values())}")
assert xs[-1] == CROOK_RIGHT_X1, f"crook right edge {xs[-1]} != {CROOK_RIGHT_X1}"

# ------------------------------------------------- measure tubes at REF_X
def col_runs(x, img_px):
    runs, cur = [], None
    for y in range(BAND_TOP, H):
        if img_px[x, y][3] > 0:
            cur = [y, y] if cur is None else [cur[0], y]
        elif cur:
            runs.append(tuple(cur))
            cur = None
    if cur:
        runs.append(tuple(cur))
    return runs

runs = col_runs(REF_X, slpx)
assert len(runs) == 2, f"expected 2 tube runs at x={REF_X}, got {runs}"
(yu0, yu1), (yl0, yl1) = runs
print(f"tube y-ranges at x={REF_X}: upper {yu0}-{yu1}, lower {yl0}-{yl1}")

# bar strips: tube run expanded by STRIP_PAD, pixels carry soft alpha so the
# anti-aliased top/bottom edges blend into the transparent background
def make_strip(y0, y1):
    a, b = y0 - STRIP_PAD, y1 + STRIP_PAD + 1
    strip = Image.new("RGBA", (1, b - a), (0, 0, 0, 0))
    sp = strip.load()
    for i, y in enumerate(range(a, b)):
        c = spx[REF_X, y]
        sp[0, i] = (c[0], c[1], c[2], soft_alpha(c))
    return strip, a

strip_u, su_top = make_strip(yu0, yu1)
strip_l, sl_top = make_strip(yl0, yl1)

# ------------------------------------------------------------------ compose
BAR_X0 = CUT_X - 1           # bars tuck 1 px under the body tube end
for p in range(1, N_POS + 1):
    left, right = ART_X0 + SHIFTS[p - 1], CROOK_RIGHT_X1 + OFFSETS[p - 1] + SHIFTS[p - 1]
    assert 0 <= left and right < CANVAS_W, f"pos-{p} artwork x {left}..{right} overflows canvas"
os.makedirs(OUT_DIR, exist_ok=True)

for p in range(1, N_POS + 1):
    s = OFFSETS[p - 1]
    shift = SHIFTS[p - 1]
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    canvas.alpha_composite(body, (shift, -Y_OFFSET))
    if s > 0:
        bar_w = CUT_X + s - BAR_X0
        for strip, top in ((strip_u, su_top), (strip_l, sl_top)):
            bar = strip.resize((bar_w, strip.height), Image.NEAREST)
            canvas.alpha_composite(bar, (BAR_X0 + shift, top - Y_OFFSET))
    canvas.alpha_composite(slide, (s + shift, -Y_OFFSET))
    out = os.path.join(OUT_DIR, f"trombone-pos-{p}.webp")
    canvas.save(out, format="WEBP", lossless=True)
    kb = os.path.getsize(out) / 1024
    print(f"pos-{p}: offset={s:3d}px  x-shift={shift:+4d}px  "
          f"artwork x {ART_X0 + shift}..{CROOK_RIGHT_X1 + s + shift}  "
          f"{CANVAS_W}x{CANVAS_H}  {kb:.0f} kB  -> {out}")

# ------------------------------------------------------------------- checks
# pos-1 is a pure shift of the source, so canvas (x, y) must still hold the
# source pixel at (x - shift, y + Y_OFFSET) once composited over white.
pos1 = Image.open(os.path.join(OUT_DIR, "trombone-pos-1.webp")).convert("RGBA")
ppx = pos1.load()
shift = SHIFTS[0]
bad_rgb = max_delta = 0
for y in range(pos1.height):
    sy = y + Y_OFFSET
    if not 0 <= sy < H:
        continue
    for x in range(pos1.width):
        sx = x - shift
        if not 0 <= sx < W:
            continue
        r, g, b, a = ppx[x, y]
        s_c = spx[sx, sy]
        if a > 0 and (r, g, b) != s_c:
            bad_rgb += 1
        # compositing pos-1 over white must reproduce the source closely
        comp = tuple((v * a + 255 * (255 - a)) // 255 for v in (r, g, b))
        max_delta = max(max_delta, max(abs(comp[i] - s_c[i]) for i in range(3)))
print(f"pos-1: {bad_rgb} pixels with altered RGB (expect 0), "
      f"max channel delta vs source when composited over white: {max_delta}")

# per-variant: artwork sits inside the canvas and is centered on it
for p in range(1, N_POS + 1):
    im = Image.open(os.path.join(OUT_DIR, f"trombone-pos-{p}.webp")).convert("RGBA")
    ipx = im.load()
    right = 0
    for x in range(im.width - 1, -1, -1):
        if any(ipx[x, y][3] > 0 for y in range(im.height)):
            right = x
            break
    expect = CROOK_RIGHT_X1 + OFFSETS[p - 1] + SHIFTS[p - 1]
    edge_ok = abs(right - expect) <= 2
    bbox = im.getbbox()
    center = (bbox[0] + bbox[2]) / 2
    centered_ok = abs(center - CANVAS_W / 2) <= 1
    print(f"pos-{p}: measured crook right x={right}, expected {expect} "
          f"(delta {right - expect:+d}) {'OK' if edge_ok else 'FAIL'}; "
          f"artwork bbox x {bbox[0]}..{bbox[2]} (center {center}, want {CANVAS_W / 2}) "
          f"{'OK' if centered_ok else 'FAIL'}, y {bbox[1]}..{bbox[3]}; "
          f"bbox right {bbox[2]} <= canvas {im.width}: {bbox[2] <= im.width}")
    assert edge_ok and centered_ok and bbox[2] <= im.width

# no opaque near-background specks anywhere in the widest variant
pos7 = Image.open(os.path.join(OUT_DIR, "trombone-pos-7.webp")).convert("RGBA")
specks = sum(1 for q in pos7.getdata() if q[3] == 255 and dist(q[:3]) < 40)
print(f"pos-7 opaque near-background (dist<40) pixels: {specks} (expect 0)")
assert specks == 0
print("DONE")
