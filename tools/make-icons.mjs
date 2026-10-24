// Generates the Android launcher icons from code, so the build stays dependency-free and the
// icon can never drift out of sync with the brand colours in the game.
//
//   node tools/make-icons.mjs
//
// Writes res/mipmap-*/ic_launcher.png and ic_launcher_round.png at the five Android densities,
// plus a vector foreground for the API 26+ adaptive icon.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES = path.join(ROOT, 'android', 'res');

// --- brand ---------------------------------------------------------------------------------
const INK = [0x0b, 0x0e, 0x14];      // night asphalt, matches the game's #050608 shell
const RED = [0xce, 0x11, 0x26];      // Bahrain flag red
const WHITE = [0xf5, 0xf7, 0xfa];
const GOLD = [0xe8, 0xc4, 0x3a];     // the road's centre-line yellow

// --- minimal PNG writer --------------------------------------------------------------------
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
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const png = (w, h, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;                                        // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// --- tiny software rasteriser (supersampled 3x, so edges are smooth) ------------------------
class Canvas {
  constructor(size, ss = 3) { this.n = size * ss; this.ss = ss; this.size = size; this.px = new Float32Array(this.n * this.n * 4); }
  set(x, y, [r, g, b], a = 1) {
    if (x < 0 || y < 0 || x >= this.n || y >= this.n || a <= 0) return;
    const i = (y * this.n + x) * 4, ia = 1 - a;
    this.px[i] = this.px[i] * ia + r * a;
    this.px[i + 1] = this.px[i + 1] * ia + g * a;
    this.px[i + 2] = this.px[i + 2] * ia + b * a;
    this.px[i + 3] = this.px[i + 3] * ia + 255 * a;
  }
  fill(color) { for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) this.set(x, y, color, 1); }
  /** signed area test: point-in-shape via a half-plane product */
  poly(points, color, alpha = 1) {
    const n = points.length;
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y, color, alpha);
    }
  }
  ring(cx, cy, rOuter, rInner, color, alpha = 1) {
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= rOuter && d >= rInner) this.set(x, y, color, alpha);
    }
  }
  disc(cx, cy, r, color, alpha = 1) {
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) this.set(x, y, color, alpha);
    }
  }
  /**
   * Scale the art about the centre. f < 1 shrinks it, which is how the mark is fitted into an
   * adaptive icon's 66% safe zone (a 108dp canvas only guarantees the middle 72dp).
   */
  resize(f) {
    const out = new Float32Array(this.px.length), n = this.n, src = this.px, c = n / 2;
    const cl = v => Math.max(0, Math.min(n - 1, Math.round(v)));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const sx = (x + 0.5 - c) / f + c, sy = (y + 0.5 - c) / f + c;
      const i = (cl(sy) * n + cl(sx)) * 4, o = (y * n + x) * 4;
      out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = src[i + 3];
    }
    this.px = out;
  }
  circleMask() {
    const n = this.n, c = n / 2, r = n / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > r) { const i = (y * n + x) * 4; this.px[i + 3] = 0; }
    }
  }
  /** box-downsample the supersampled buffer to the requested size */
  toPNG() {
    const s = this.size, f = this.ss, out = Buffer.alloc(s * s * 4);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
        const k = ((y * f + j) * this.n + (x * f + i)) * 4;
        const pa = this.px[k + 3] / 255;          // colour is stored straight (not premultiplied)
        r += this.px[k] * pa; g += this.px[k + 1] * pa; b += this.px[k + 2] * pa;
        a += this.px[k + 3]; wsum += pa;
      }
      const n = f * f, o = (y * s + x) * 4;
      out[o] = Math.round(wsum ? r / wsum : 0);
      out[o + 1] = Math.round(wsum ? g / wsum : 0);
      out[o + 2] = Math.round(wsum ? b / wsum : 0);
      out[o + 3] = Math.round(a / n);
    }
    return png(s, s, out);
  }
}

/**
 * The mark: a red/white serrated flag wedge over a night road, with the gold centre-line
 * running down the middle — the same three colours the game puts on screen every second.
 */
function drawIcon(size, { round }) {
  const c = new Canvas(size);
  const N = c.n;
  c.fill(INK);

  // flag band across the upper two-thirds
  const bandTop = N * 0.20, bandBot = N * 0.60;
  c.poly([[0, bandTop], [N, bandTop], [N, bandBot], [0, bandBot]], RED);

  // The serrated white edge, drawn as one polygon whose left boundary is a true zigzag.
  // Stacking per-tooth triangles merged into a wedge at small sizes, which read as a diagonal
  // instead of the flag's teeth.
  const flat = N * 0.56, cells = 3, ch = (bandBot - bandTop) / cells;
  const zig = [[N, bandTop], [flat, bandTop]];
  for (let i = 0; i < cells; i++) {
    const yT = bandTop + i * ch;
    zig.push([N, yT + ch / 2], [flat, yT + ch]);   // notch out to the right, then back in
  }
  zig.push([N, bandBot]);
  c.poly(zig, WHITE);

  // road below the band, tapering towards the horizon
  c.poly([[N * 0.18, bandBot], [N * 0.82, bandBot], [N * 1.05, N], [-N * 0.05, N]], [0x2b, 0x32, 0x3f]);
  // gold centre-line dashes
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4, t1 = t0 + 0.13;
    const yA = bandBot + (N - bandBot) * t0, yB = bandBot + (N - bandBot) * t1;
    const wA = N * (0.022 + 0.040 * t0), wB = N * (0.022 + 0.040 * t1);
    c.poly([[N / 2 - wA, yA], [N / 2 + wA, yA], [N / 2 + wB, yB], [N / 2 - wB, yB]], GOLD);
  }
  // solid edge lines
  c.poly([[N * 0.20, bandBot], [N * 0.235, bandBot], [N * 0.02, N], [-N * 0.06, N]], WHITE, 0.75);
  c.poly([[N * 0.80, bandBot], [N * 0.765, bandBot], [N * 0.98, N], [N * 1.06, N]], WHITE, 0.75);

  // front wheel, centred low
  c.ring(N * 0.5, N * 0.80, N * 0.20, N * 0.135, [0x2b, 0x31, 0x3d]);
  c.ring(N * 0.5, N * 0.80, N * 0.135, N * 0.105, [0x1a, 0x1e, 0x26]);
  c.disc(N * 0.5, N * 0.80, N * 0.052, [0x39, 0x41, 0x50]);
  c.disc(N * 0.5, N * 0.80, N * 0.022, RED);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    c.poly([
      [N * 0.5 + Math.cos(a) * N * 0.030, N * 0.80 + Math.sin(a) * N * 0.030],
      [N * 0.5 + Math.cos(a + 0.16) * N * 0.115, N * 0.80 + Math.sin(a + 0.16) * N * 0.115],
      [N * 0.5 + Math.cos(a - 0.16) * N * 0.115, N * 0.80 + Math.sin(a - 0.16) * N * 0.115],
    ], [0x6f, 0x7a, 0x8c], 0.9);
  }

  // adaptive icons crop hard, so the mark is scaled into the 66% safe zone
  c.resize(0.66);
  if (round) c.circleMask();
  return c;
}

const DENSITIES = [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]];
let written = 0;
for (const [dpi, size] of DENSITIES) {
  const dir = path.join(RES, 'mipmap-' + dpi);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), drawIcon(size, { round: false }).toPNG());
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), drawIcon(size, { round: true }).toPNG());
  written += 2;
}

// API 26+ adaptive icon: a flat background plus the mark as a vector, so it stays crisp at any size.
const anydpi = path.join(RES, 'mipmap-anydpi-v26');
fs.mkdirSync(anydpi, { recursive: true });
fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/bg"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`);
fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/bg"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`);

const drawable = path.join(RES, 'drawable');
fs.mkdirSync(drawable, { recursive: true });
// 108x108dp viewport; the mark is drawn inside the central 72x72dp safe zone.
fs.writeFileSync(path.join(drawable, 'ic_launcher_foreground.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by tools/make-icons.mjs. 108dp viewport, art inside the 72dp safe zone. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#CE1126" android:pathData="M18,30 h72 v14 h-72 z"/>
    <path android:fillColor="#F5F7FA" android:pathData="M78,30 l12,7 l-12,7 z"/>
    <path android:fillColor="#F5F7FA" android:pathData="M66,37 l12,7 l-12,7 z"/>
    <path android:fillColor="#F5F7FA" android:pathData="M54,37 l12,7 l-12,7 z"/>
    <path android:fillColor="#161A22" android:pathData="M24,44 h60 l18,34 h-96 z"/>
    <path android:fillColor="#E8C43A" android:pathData="M52.5,46 h3 l0.6,7 h-4.2 z M51.5,55 h5 l1,7 h-7 z"/>
    <path android:fillColor="#E8C43A" android:pathData="M50,64 h8 l1.6,8 h-11.2 z"/>
    <path android:fillColor="#FFFFFF" android:fillAlpha="0.75" android:pathData="M27,44 h4 l-8,34 h-6 z M77,44 h4 l14,34 h-6 z"/>
    <path android:fillColor="#2B313D" android:pathData="M54,58 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0"/>
    <path android:fillColor="#394150" android:pathData="M54,58 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0"/>
    <path android:fillColor="#CE1126" android:pathData="M54,58 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0"/>
</vector>
`);

console.log('wrote ' + written + ' raster icons across ' + DENSITIES.length + ' densities, plus the adaptive icon');
