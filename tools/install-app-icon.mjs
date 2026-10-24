// Installs a single artwork file as the app icon everywhere it is needed: the Android launcher
// mipmaps, the API 26+ adaptive icon, and the web/PWA icons. No npm dependencies -- the PNG is
// decoded and re-encoded here with zlib, the same way tools/make-icons.mjs writes them.
//
//   node tools/install-app-icon.mjs ["<path to a png>"]
//
// The source art is usually not square (the shipped artwork is 610x409), so it is centre-cropped to
// a square first. Everything downstream is generated from that one crop, so the launcher, the
// home-screen shortcut and the installed PWA can never disagree about what the icon looks like.
//
// This tool now owns the icon. tools/make-icons.mjs is the code-drawn fallback it replaced; running
// that instead will overwrite these files with the old generated mark.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SRC = path.resolve(ROOT, '..', 'Favicon', 'Bike Rider App .png');
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SRC;

// The adaptive icon is 108dp with only the middle 72dp guaranteed visible, and the PWA maskable
// icons lose the outer ~20% to the launcher's mask. Both get the art inset so nothing important is
// shaved off, on a flat brand background that fills the rest.
const SAFE = 72 / 108;
const BG = [0x05, 0x06, 0x08];          // manifest background_color / theme_color
const DENSITIES = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];

// ---------------------------------------------------------------- PNG decode
// Only what the source actually is: 8-bit RGBA, non-interlaced. Anything else is a loud error
// rather than a silently wrong icon.
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let i = 8, w = 0, h = 0, depth = 0, colour = 0, inter = 0;
  const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i), type = buf.toString('latin1', i + 4, i + 8);
    const body = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4);
      depth = body[8]; colour = body[9]; inter = body[12];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    i += 12 + len;
  }
  if (depth !== 8 || colour !== 6) throw new Error(`need 8-bit RGBA, got depth ${depth} colour type ${colour}`);
  if (inter) throw new Error('interlaced PNGs are not supported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 255;
      else if (filter === 2) line[x] = (line[x] + b) & 255;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else if (filter !== 0) throw new Error('unknown PNG filter ' + filter);
    }
    line.copy(px, y * stride);
    prev = line;
  }
  return { w, h, px };
}

// ---------------------------------------------------------------- PNG encode
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, body) {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'latin1');
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}
function encodePNG(w, h, px) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;                                   // filter: none
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- resampling
// Area-average downscale. A nearest-neighbour resize of artwork this size puts visible aliasing on
// the launcher icon, and a plain bilinear resize in the other direction drops the detail.
function resize(src, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * src.h / h), y1 = Math.max(y0 + 1, Math.ceil((y + 1) * src.h / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * src.w / w), x1 = Math.max(x0 + 1, Math.ceil((x + 1) * src.w / w));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < src.h; sy++) {
        for (let sx = x0; sx < x1 && sx < src.w; sx++) {
          const o = (sy * src.w + sx) * 4;
          const al = src.px[o + 3] / 255;
          r += src.px[o] * al; g += src.px[o + 1] * al; b += src.px[o + 2] * al; a += al; n++;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
      out[o + 3] = Math.round(a / n * 255);
    }
  }
  return { w, h, px: out };
}

// centre-crop to a square, then flatten onto a background so a transparent source cannot leave the
// launcher showing whatever is behind it
function squareArt(img) {
  const s = Math.min(img.w, img.h);
  const x0 = Math.floor((img.w - s) / 2), y0 = Math.floor((img.h - s) / 2);
  const px = Buffer.alloc(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const si = ((y + y0) * img.w + (x + x0)) * 4, di = (y * s + x) * 4;
      const a = img.px[si + 3] / 255;
      px[di] = Math.round(img.px[si] * a + BG[0] * (1 - a));
      px[di + 1] = Math.round(img.px[si + 1] * a + BG[1] * (1 - a));
      px[di + 2] = Math.round(img.px[si + 2] * a + BG[2] * (1 - a));
      px[di + 3] = 255;
    }
  }
  return { w: s, h: s, px };
}

// the art inset on a flat background, for launchers that crop or mask the edges
function insetArt(square, size, scale) {
  const inner = Math.max(1, Math.round(size * scale));
  const art = resize(square, inner, inner);
  const out = Buffer.alloc(size * size * 4);
  const off = Math.floor((size - inner) / 2);
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = BG[0]; out[i * 4 + 1] = BG[1]; out[i * 4 + 2] = BG[2]; out[i * 4 + 3] = 255;
  }
  for (let y = 0; y < inner; y++) {
    for (let x = 0; x < inner; x++) {
      const s = (y * inner + x) * 4, d = ((y + off) * size + (x + off)) * 4;
      out[d] = art.px[s]; out[d + 1] = art.px[s + 1]; out[d + 2] = art.px[s + 2]; out[d + 3] = 255;
    }
  }
  return { w: size, h: size, px: out };
}

// circular alpha, for the legacy round icon
function roundArt(square, size) {
  const src = resize(square, size, size);
  const c = size / 2, px = Buffer.from(src.px);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 1px of feathering so the round icon is not visibly jagged against a light wallpaper
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const cov = Math.max(0, Math.min(1, c - d));
      const o = (y * size + x) * 4;
      px[o + 3] = Math.round(px[o + 3] * cov);
    }
  }
  return { w: size, h: size, px };
}

// ---------------------------------------------------------------- write
const written = [];
const write = (file, buf) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); written.push(file); };

if (!fs.existsSync(SRC)) {
  console.error('source artwork not found: ' + SRC + '\npass a path: node tools/install-app-icon.mjs <file.png>');
  process.exit(1);
}
const src = decodePNG(fs.readFileSync(SRC));
const square = squareArt(src);
console.log(`source   ${SRC}`);
console.log(`         ${src.w}x${src.h} -> centre-cropped to ${square.w}x${square.h}`);

// Android legacy launcher icons + the round variant, at all five densities
for (const [dpi, scale] of DENSITIES) {
  const px = Math.round(48 * scale);
  const dir = path.join(ROOT, 'android', 'res', 'mipmap-' + dpi);
  write(path.join(dir, 'ic_launcher.png'), encodePNG(px, px, resize(square, px, px).px));
  write(path.join(dir, 'ic_launcher_round.png'), encodePNG(px, px, roundArt(square, px).px));
  // adaptive foreground: 108dp at this density, art inside the 72dp safe zone
  const fg = Math.round(108 * scale);
  write(path.join(dir, 'ic_launcher_fg.png'), encodePNG(fg, fg, insetArt(square, fg, SAFE).px));
}

// adaptive icon XML now points at the raster foreground
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/bg"/>
    <foreground android:drawable="@mipmap/ic_launcher_fg"/>
    <monochrome android:drawable="@mipmap/ic_launcher_fg"/>
</adaptive-icon>
`;
for (const n of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  write(path.join(ROOT, 'android', 'res', 'mipmap-anydpi-v26', n), Buffer.from(adaptive, 'utf8'));
}

// Web / PWA icons go to the ROOT icons/ directory, which is the source of truth. public/icons/ is
// only a mirror that tools/sync-public.mjs copies from here, so writing straight into public/ gets
// silently reverted on the next sync -- which is exactly what happened the first time.
const icons = path.join(ROOT, 'icons');
for (const n of [16, 32, 48, 180, 192, 512]) {
  write(path.join(icons, `icon-${n}.png`), encodePNG(n, n, resize(square, n, n).px));
  write(path.join(icons, `favicon-${n}.png`), encodePNG(n, n, resize(square, n, n).px));
}
for (const n of [192, 512]) {
  write(path.join(icons, `icon-${n}-maskable.png`), encodePNG(n, n, insetArt(square, n, 0.72).px));
}
// index.html links apple-touch-icon for iOS, so leaving it out would have shipped the old mark to
// the home screen while every other slot changed. The larger favicon-* sizes are not referenced by
// anything today but are written too, so a stale copy cannot be picked up later.
write(path.join(icons, 'apple-touch-icon.png'), encodePNG(180, 180, resize(square, 180, 180).px));
for (const n of [180, 192, 512]) {
  write(path.join(icons, `favicon-${n}.png`), encodePNG(n, n, resize(square, n, n).px));
}

// favicon.ico with a 32x32 PNG inside it, which every browser that matters still accepts
const ico32 = encodePNG(32, 32, resize(square, 32, 32).px);
const ico = Buffer.alloc(6 + 16 + ico32.length);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 32; ico[7] = 32; ico[8] = 0; ico[9] = 0;
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(ico32.length, 14); ico.writeUInt32LE(22, 18);
ico32.copy(ico, 22);
write(path.join(icons, 'favicon.ico'), ico);

// the SVG slot is referenced by index.html and precached by the service worker, so it gets the same
// crop wrapped as an embedded raster rather than being left showing the old generated mark
const svg192 = encodePNG(192, 192, resize(square, 192, 192).px);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">`
  + `<image width="192" height="192" href="data:image/png;base64,${svg192.toString('base64')}"/></svg>\n`;
write(path.join(icons, 'favicon.svg'), Buffer.from(svg, 'utf8'));

console.log(`\nwrote ${written.length} files:`);
for (const [name, list] of [
  ['android launcher', written.filter(f => f.includes('ic_launcher'))],
  ['web/pwa', written.filter(f => f.includes('public') || f.includes('icons'))],
]) {
  console.log(`  ${name}: ${list.length}`);
}
console.log('  densities: ' + DENSITIES.map(d => d[0]).join(', ') + '  |  adaptive foreground inset to ' + Math.round(SAFE * 100) + '%');
console.log('\n  root icons/ updated. public/icons/ is a mirror -- run: node tools/sync-public.mjs');
