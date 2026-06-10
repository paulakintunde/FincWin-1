// gen-icons.mjs — regenerate PWA PNG icons to match favicon.svg.
// Zero dependencies: pure-JS supersampled rasteriser + Node zlib PNG encoder.
// Run:  node scripts/gen-icons.mjs
//
// Design (favicon.svg, 32-unit grid): sage rounded square, white serif "F"
// (top bar, middle bar, vertical stem) and a gold accent dot bottom-right.

import zlib from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SAGE  = [0x5a, 0x6e, 0x3f];
const WHITE = [0xff, 0xff, 0xff];
const GOLD  = [0xd4, 0xa8, 0x53];

// ── geometry helpers (operate in the 32-unit favicon grid) ──────────────
function inRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const rx = Math.min(r, w / 2), ry = Math.min(r, h / 2);
  const cx = px < x + rx ? x + rx : (px > x + w - rx ? x + w - rx : px);
  const cy = py < y + ry ? y + ry : (py > y + h - ry ? y + h - ry : py);
  const dx = px - cx, dy = py - cy;
  if (dx === 0 && dy === 0) return true;
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}
function inCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

// Returns [r,g,b,a] (0-255) for a point in the 32-grid. `bgRounded` controls
// whether the background is a rounded square (any-purpose) or full-bleed (maskable).
function sampleColor(px, py, bgRounded) {
  // F glyph (white) — topmost over background
  if (inRoundedRect(px, py, 9, 8, 14, 2.5, 1) ||   // top bar
      inRoundedRect(px, py, 9, 14.5, 10, 2.5, 1) || // middle bar
      inRoundedRect(px, py, 9, 8, 2.8, 16, 1)) {    // stem
    return [...WHITE, 255];
  }
  if (inCircle(px, py, 24, 24.5, 2.8)) return [...GOLD, 255]; // accent dot
  if (bgRounded) {
    return inRoundedRect(px, py, 0, 0, 32, 32, 7) ? [...SAGE, 255] : [0, 0, 0, 0];
  }
  return [...SAGE, 255]; // maskable: full-bleed sage
}

// Render an RGBA buffer at `size` px. `mode` = 'any' | 'maskable'.
function render(size, mode) {
  const SS = 4;                       // supersampling factor (4x4 = 16 samples)
  const buf = Buffer.alloc(size * size * 4);
  // maskable maps the 32-grid into the inner ~80% safe zone: coord = 13.1*p + 46.4
  // on a 512 canvas → scale to this `size`. any-purpose maps 0..32 across the canvas.
  const k = size / 512;              // canvas scale relative to 512 design space
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          let gx, gy;
          if (mode === 'maskable') {
            gx = (fx / k - 46.4) / 13.1;
            gy = (fy / k - 46.4) / 13.1;
          } else {
            gx = fx / size * 32;
            gy = fy / size * 32;
          }
          const c = sampleColor(gx, gy, mode !== 'maskable');
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const n = SS * SS;
      const idx = (y * size + x) * 4;
      // premultiplied accumulation → un-premultiply for straight-alpha PNG
      const aAvg = a / n;
      if (a > 0) {
        buf[idx]     = Math.round(r / a);
        buf[idx + 1] = Math.round(g / a);
        buf[idx + 2] = Math.round(b / a);
      }
      buf[idx + 3] = Math.round(aAvg);
    }
  }
  return buf;
}

// ── minimal PNG encoder (RGBA, 8-bit) ───────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  // raw scanlines with filter byte 0 per row
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── generate all four PNGs ──────────────────────────────────────────────
const jobs = [
  ['icon-180.png', 180, 'any'],
  ['icon-192.png', 192, 'any'],
  ['icon-512.png', 512, 'any'],
  ['icon-maskable-512.png', 512, 'maskable'],
];
for (const [name, size, mode] of jobs) {
  const png = encodePNG(render(size, mode), size);
  writeFileSync(join(ROOT, name), png);
  console.log(`✓ ${name}  (${size}×${size}, ${mode}, ${png.length} bytes)`);
}
console.log('Done.');
