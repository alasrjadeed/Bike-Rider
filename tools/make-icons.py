#!/usr/bin/env python3
"""
make-icons.py — regenerate the Bike Rider PWA icon set.

Everything here is generated from the master artwork, per Rules.md ("every icon
is generated from code"). Re-run after any brand change:

    python3 tools/make-icons.py            # write icons/
    python3 tools/make-icons.py --check    # verify icons/ matches the spec

Outputs (in icons/):
    favicon-16.png  favicon-32.png  favicon-48.png
    icon-16.png     icon-32.png     icon-48.png    icon-180.png
    icon-192.png    icon-512.png
    icon-192-maskable.png  icon-512-maskable.png
    apple-touch-icon.png   favicon.ico   favicon.svg

Maskable icons are NOT plain copies: the artwork is scaled into the central
80% safe zone on a solid field so Android circle/squircle crops never clip it.
"""

import argparse
import base64
import io
import os
import sys

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'icons')

# Master artwork: largest square brand mark available (310x310, white field).
MASTER_CANDIDATES = [
    os.path.join(ROOT, '..', 'Favicon', 'ms-icon-310x310.png'),
    os.path.join(ROOT, 'brand', 'ms-icon-310x310.png'),
    os.path.join(ROOT, 'ms-icon-310x310.png'),
]
MASTER = next((p for p in MASTER_CANDIDATES if os.path.exists(p)), None)

# Field colour behind the artwork. The master has white corners, so white keeps
# the maskable padding seamless.
FIELD = (255, 255, 255, 255)
# Fraction of the canvas the artwork may occupy in a maskable icon.
MASKABLE_SCALE = 0.80

PNG_SIZES = {
    'favicon-16.png': 16,
    'favicon-32.png': 32,
    'favicon-48.png': 48,
    'icon-16.png': 16,
    'icon-32.png': 32,
    'icon-48.png': 48,
    'icon-180.png': 180,
    'icon-192.png': 192,
    'icon-512.png': 512,
    'apple-touch-icon.png': 180,
    'icon-192-maskable.png': 192,
    'icon-512-maskable.png': 512,
}
ICO_SIZES = [16, 32, 48]


def load_master():
    if not MASTER:
        sys.exit('master artwork not found; looked in:\n  ' + '\n  '.join(MASTER_CANDIDATES))
    im = Image.open(MASTER).convert('RGBA')
    side = min(im.size)
    # Centre-crop to square so a non-square master still works.
    left = (im.size[0] - side) // 2
    top = (im.size[1] - side) // 2
    return im.crop((left, top, left + side, top + side))


def flatten(im):
    """Composite onto FIELD — iOS ignores alpha in touch icons."""
    base = Image.new('RGBA', im.size, FIELD)
    return Image.alpha_composite(base, im).convert('RGB')


def render(master, size, maskable=False):
    inner = max(1, int(round(size * (MASKABLE_SCALE if maskable else 1.0))))
    art = master.resize((inner, inner), Image.LANCZOS)
    if inner > master.size[0]:  # upscaling: restore some crispness
        art = art.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=3))
    if not maskable:
        return art.convert('RGBA')
    canvas = Image.new('RGBA', (size, size), FIELD)
    canvas.alpha_composite(art, ((size - inner) // 2, (size - inner) // 2))
    return canvas


def write_png(im, path):
    im.save(path, 'PNG', optimize=True)


def write_ico(master, path):
    ico_master = render(master, max(ICO_SIZES))
    ico_master.save(path, 'ICO', sizes=[(s, s) for s in ICO_SIZES])


def write_svg(master, path):
    png = io.BytesIO()
    render(master, 512).convert('RGB').save(png, 'PNG', optimize=True)
    b64 = base64.b64encode(png.getvalue()).decode('ascii')
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n'
        '  <title>Bike Rider</title>\n'
        f'  <image width="512" height="512" href="data:image/png;base64,{b64}"/>\n'
        '</svg>\n'
    )
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(svg)


def build():
    os.makedirs(OUT, exist_ok=True)
    master = load_master()
    for name, size in PNG_SIZES.items():
        maskable = 'maskable' in name
        im = render(master, size, maskable)
        if name == 'apple-touch-icon.png':
            im = flatten(im)
        write_png(im, os.path.join(OUT, name))
    write_ico(master, os.path.join(OUT, 'favicon.ico'))
    write_svg(master, os.path.join(OUT, 'favicon.svg'))
    print(f'master: {MASTER} ({master.size[0]}x{master.size[1]})')
    print(f'wrote {len(PNG_SIZES) + 2} files to {OUT}')


def check():
    bad = []
    for name, size in PNG_SIZES.items():
        p = os.path.join(OUT, name)
        if not os.path.exists(p):
            bad.append(f'{name}: MISSING')
            continue
        with Image.open(p) as im:
            if im.size != (size, size):
                bad.append(f'{name}: {im.size[0]}x{im.size[1]} != {size}x{size}')
    ico = os.path.join(OUT, 'favicon.ico')
    if not os.path.exists(ico):
        bad.append('favicon.ico: MISSING')
    else:
        with Image.open(ico) as im:
            have = sorted(s[0] for s in im.info.get('sizes', []))
            if have != sorted(ICO_SIZES):
                bad.append(f'favicon.ico: sizes {have} != {sorted(ICO_SIZES)}')
    svg = os.path.join(OUT, 'favicon.svg')
    if not os.path.exists(svg) or 'base64' not in open(svg, encoding='utf-8').read():
        bad.append('favicon.svg: MISSING or not an embedded-image svg')

    # maskable safe-zone assertion: the outer 10% ring must be flat field colour
    for name in ('icon-192-maskable.png', 'icon-512-maskable.png'):
        p = os.path.join(OUT, name)
        if not os.path.exists(p):
            continue
        with Image.open(p).convert('RGBA') as im:
            w, h = im.size
            ring = im.crop((0, 0, w, max(1, int(h * 0.05))))
            if ring.getcolors(maxcolors=1 << 24) and len(ring.getcolors(maxcolors=1 << 24)) > 2:
                bad.append(f'{name}: outer 5% ring is not flat (no safe-zone padding?)')
    if bad:
        print('FAIL')
        for b in bad:
            print('  ' + b)
        return 1
    print(f'OK: {len(PNG_SIZES)} PNGs + favicon.ico + favicon.svg verified in {OUT}')
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='verify instead of writing')
    args = ap.parse_args()
    if args.check:
        sys.exit(check())
    build()
    sys.exit(check())
