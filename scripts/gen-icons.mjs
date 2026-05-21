/**
 * Procedural icon generator.
 *
 * Rather than committing binary PNGs, the toolbar icons are drawn at build
 * time: a brand-coloured disc with a white "play" glyph. This keeps the repo
 * text-only and guarantees every required size exists. The PNGs are encoded
 * by hand (IHDR/IDAT/IEND chunks + CRC) using only Node's built-in `zlib`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const BRAND = [79, 70, 229]; // #4f46e5
const GLYPH = [255, 255, 255];

/* ----- PNG encoding ------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'latin1');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Encode an RGBA pixel buffer (`size*size*4`) as a PNG. */
function encodePng(size, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit channels
  ihdr[9] = 6; // truecolour + alpha

  // Prefix each scanline with filter byte 0 (no filtering).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ----- Drawing ------------------------------------------------------ */

/** Signed area test — point inside triangle (a, b, c)? */
function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** Render the icon at a given size into an RGBA buffer. */
function renderIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const r = size / 2;
  // Play triangle, slightly nudged right for optical centring.
  const ax = size * 0.40;
  const tri = { ax, ay: size * 0.30, bx: ax, by: size * 0.70, cx: size * 0.72, cy: c };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      // 2x2 supersampled coverage for a smoother disc edge.
      let coverage = 0;
      for (const ox of [-0.25, 0.25]) {
        for (const oy of [-0.25, 0.25]) {
          if ((dx + ox) ** 2 + (dy + oy) ** 2 <= r * r) coverage++;
        }
      }
      if (coverage === 0) {
        px[i + 3] = 0;
        continue;
      }
      const glyph = inTriangle(
        x + 0.5,
        y + 0.5,
        tri.ax,
        tri.ay,
        tri.bx,
        tri.by,
        tri.cx,
        tri.cy,
      );
      const colour = glyph ? GLYPH : BRAND;
      px[i] = colour[0];
      px[i + 1] = colour[1];
      px[i + 2] = colour[2];
      px[i + 3] = Math.round((coverage / 4) * 255);
    }
  }
  return px;
}

/** Write every required icon size into `dir`. */
export async function writeIcons(dir) {
  await mkdir(dir, { recursive: true });
  await Promise.all(
    SIZES.map((size) =>
      writeFile(resolve(dir, `icon${size}.png`), encodePng(size, renderIcon(size))),
    ),
  );
}
