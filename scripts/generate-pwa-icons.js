// scripts/generate-pwa-icons.js
//
// One-off generator for correctly-sized PWA manifest icons. The manifest
// previously declared logo.png as "512x512" when the real file is 1024x1024
// and had no 192x192 icon at all — both are required for Chrome to consider
// the site installable. Run manually if the source logo ever changes.
// Usage: node scripts/generate-pwa-icons.js

import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, '..', 'public', 'images', 'logo.png');
const OUT_DIR = path.join(__dirname, '..', 'public', 'images');

const SIZES = [192, 512];

async function main() {
  for (const size of SIZES) {
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(SOURCE).resize(size, size).toFile(outPath);
    console.log(`✅ icon-${size}.png written (${outPath})`);
  }
}

main().catch(err => {
  console.error('Failed to generate PWA icons:', err);
  process.exit(1);
});
