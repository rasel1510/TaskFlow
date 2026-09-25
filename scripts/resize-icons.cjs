/**
 * Resizes the source icon image to all required PWA PNG sizes
 * using the 'sharp' npm package (zero-dependency image processing).
 *
 * Run: node scripts/resize-icons.cjs
 * (Install sharp first: npm install sharp --save-dev if not present)
 */

const path = require('path');
const fs   = require('fs');

const SIZES     = [72, 96, 128, 144, 152, 192, 384, 512];
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const SRC       = path.join(__dirname, '..', 'public', 'icons', 'source.jpg');

if (!fs.existsSync(SRC)) {
  console.error('❌  Source icon not found at public/icons/source.jpg');
  console.error('    Copy/rename the generated icon image there first.');
  process.exit(1);
}

if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('❌  "sharp" is not installed. Run: npm install sharp --save-dev');
  process.exit(1);
}

(async () => {
  let ok = 0;
  for (const size of SIZES) {
    const out = path.join(ICONS_DIR, `icon-${size}.png`);
    try {
      await sharp(SRC)
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .png({ compressionLevel: 9 })
        .toFile(out);
      console.log(`✅  ${size}x${size} → ${out}`);
      ok++;
    } catch (err) {
      console.error(`❌  Failed ${size}x${size}: ${err.message}`);
    }
  }
  console.log(`\n🎉 ${ok}/${SIZES.length} icons generated.`);
})();
