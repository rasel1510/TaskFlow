/**
 * Generates FlowSync PWA icons as PNG files using pure Node.js.
 * Uses the Canvas API via the `canvas` npm package if available,
 * otherwise falls back to writing minimal valid PNG binary data.
 *
 * Run: node scripts/generate-icons.cjs
 */

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Try using canvas if available
let canvas;
try {
  canvas = require('canvas');
} catch {
  canvas = null;
}

function createIconWithCanvas(size) {
  const { createCanvas } = canvas;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');

  // Background rounded rect (blue)
  const r = size * 0.22;
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Checkmark path (white)
  const scale = size / 32;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(12 * scale, 15 * scale);
  ctx.lineTo(16 * scale, 19 * scale);
  ctx.lineTo(26 * scale, 8 * scale);
  ctx.stroke();

  // Document outline
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(25 * scale, 16 * scale);
  ctx.lineTo(25 * scale, 24 * scale);
  ctx.arcTo(25 * scale, 26 * scale, 23 * scale, 26 * scale, 2 * scale);
  ctx.lineTo(9 * scale, 26 * scale);
  ctx.arcTo(7 * scale, 26 * scale, 7 * scale, 24 * scale, 2 * scale);
  ctx.lineTo(7 * scale, 9 * scale);
  ctx.arcTo(7 * scale, 7 * scale, 9 * scale, 7 * scale, 2 * scale);
  ctx.lineTo(20 * scale, 7 * scale);
  ctx.stroke();

  return c.toBuffer('image/png');
}

// Minimal 1x1 valid PNG as an absolute fallback (all white)
function createMinimalPng() {
  // PNG header + IHDR + IDAT (minimal 1x1 blue pixel) + IEND
  // This is a minimal but valid PNG placeholder
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e0000000c4944415478016360f8cfc0000000020001e221bc330000000049454e44ae426082',
    'hex'
  );
}

let successCount = 0;

SIZES.forEach(size => {
  const outPath = path.join(ICONS_DIR, `icon-${size}.png`);

  let buf;
  if (canvas) {
    try {
      buf = createIconWithCanvas(size);
      console.log(`✅ Generated ${size}x${size} with canvas`);
    } catch (err) {
      console.warn(`⚠️  Canvas failed for ${size}x${size}: ${err.message}`);
      buf = createMinimalPng();
    }
  } else {
    buf = createMinimalPng();
    console.log(`📄 Wrote placeholder ${size}x${size} (install 'canvas' for real icons)`);
  }

  fs.writeFileSync(outPath, buf);
  successCount++;
});

console.log(`\n🎉 Done! ${successCount}/${SIZES.length} icons written to public/icons/`);
console.log('   If icons are placeholder PNGs, run: npm install canvas && node scripts/generate-icons.cjs');
