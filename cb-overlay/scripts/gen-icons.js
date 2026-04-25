// 產生 cb-overlay 所需的 PNG icons（純 Node，不需任何 npm 套件）
// 同時輸出 icons/icon.svg 作為原始向量檔
// 使用方式：node scripts/gen-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// SVG 概念設計（128×128 基準座標）
// - 後方淺紫圓角矩形：原站台
// - 前方深紫圓角矩形：overlay 介面
// - 白色加號：快速預訂
const BG = [199, 210, 254];   // #c7d2fe indigo-200
const FG = [99, 102, 241];    // #6366f1 indigo-500
const FG_SHADE = [79, 70, 229]; // #4f46e5 indigo-600（陰影邊）
const WHITE = [255, 255, 255];

const SHAPES = [
  // 前方卡片右下陰影（深一階）
  { x: 44, y: 44, w: 80, h: 80, r: 14, c: FG_SHADE },
  // 後方淺紫卡片
  { x: 14, y: 14, w: 80, h: 80, r: 14, c: BG },
  // 前方深紫卡片（往右下 offset）
  { x: 40, y: 40, w: 80, h: 80, r: 14, c: FG },
  // 白色加號 - 垂直棒
  { x: 74, y: 60, w: 12, h: 40, r: 4, c: WHITE },
  // 白色加號 - 水平棒
  { x: 60, y: 74, w: 40, h: 12, r: 4, c: WHITE },
];

function inRoundRect(x, y, s) {
  if (x < s.x || x >= s.x + s.w || y < s.y || y >= s.y + s.h) return false;
  const r = Math.min(s.r, s.w / 2, s.h / 2);
  const dxL = x - s.x, dxR = s.x + s.w - x;
  const dyT = y - s.y, dyB = s.y + s.h - y;
  if (Math.min(dxL, dxR) >= r || Math.min(dyT, dyB) >= r) return true;
  const cx = dxL < r ? s.x + r : s.x + s.w - r;
  const cy = dyT < r ? s.y + r : s.y + s.h - r;
  const ex = x - cx, ey = y - cy;
  return ex * ex + ey * ey <= r * r;
}

function topColor(x, y) {
  for (let i = SHAPES.length - 1; i >= 0; i--) {
    if (inRoundRect(x, y, SHAPES[i])) return SHAPES[i].c;
  }
  return null;
}

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function crc32(buf) {
  const tbl = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const b of buf) crc = tbl[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  return Buffer.concat([uint32BE(data.length), t, data, uint32BE(crc32(Buffer.concat([t, data])))]);
}

// 4x supersampling 抗鋸齒
function makeRGBAPng(size) {
  const SS = 4;
  const total = SS * SS;
  const rowBytes = size * 4;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  for (let py = 0; py < size; py++) {
    const base = py * (rowBytes + 1);
    raw[base] = 0; // filter None
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, cnt = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const xs = (px + (sx + 0.5) / SS) * 128 / size;
          const ys = (py + (sy + 0.5) / SS) * 128 / size;
          const c = topColor(xs, ys);
          if (c) { r += c[0]; g += c[1]; b += c[2]; cnt++; }
        }
      }
      const idx = base + 1 + px * 4;
      raw[idx]     = cnt ? Math.round(r / cnt) : 0;
      raw[idx + 1] = cnt ? Math.round(g / cnt) : 0;
      raw[idx + 2] = cnt ? Math.round(b / cnt) : 0;
      raw[idx + 3] = Math.round(cnt * 255 / total);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const SVG = `<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <!-- 前方陰影 -->
  <rect x="44" y="44" width="80" height="80" rx="14" fill="#4f46e5" opacity="0.35"/>
  <!-- 後方原站台卡片 -->
  <rect x="14" y="14" width="80" height="80" rx="14" fill="#c7d2fe"/>
  <!-- 前方 overlay 卡片 -->
  <rect x="40" y="40" width="80" height="80" rx="14" fill="#6366f1"/>
  <!-- 加號 - 垂直棒 -->
  <rect x="74" y="60" width="12" height="40" rx="4" fill="#fff"/>
  <!-- 加號 - 水平棒 -->
  <rect x="60" y="74" width="40" height="12" rx="4" fill="#fff"/>
</svg>
`;

const outDir = path.resolve(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.svg'), SVG);
console.log('✅ icons/icon.svg');

for (const size of [16, 48, 128]) {
  const buf = makeRGBAPng(size);
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, buf);
  console.log(`✅ icons/icon${size}.png (${buf.length} bytes)`);
}
