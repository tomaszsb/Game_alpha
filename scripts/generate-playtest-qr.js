// scripts/generate-playtest-qr.js
//
// One-off generator for the playtester-acquisition QR codes (PRD §4).
// Not part of the running app — run manually, print the output, done.
// Usage: node scripts/generate-playtest-qr.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'https://game.unravelcodes.com/challenge';
const CAMPAIGN_TAGS = ['vehicle', 'conference', 'businesscard', 'friend', 'reddit'];
const OUTPUT_DIR = path.join(__dirname, '..', 'Mockups', 'qr-codes');

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const tag of CAMPAIGN_TAGS) {
    const url = `${BASE_URL}?src=${tag}`;
    const outPath = path.join(OUTPUT_DIR, `qr-${tag}.png`);
    await QRCode.toFile(outPath, url, {
      errorCorrectionLevel: 'H',
      margin: 4, // quiet zone
      width: 600,
    });
    console.log(`✅ ${tag.padEnd(12)} -> ${url}  (${outPath})`);
  }

  console.log(`\nDone. ${CAMPAIGN_TAGS.length} QR codes written to ${OUTPUT_DIR}`);
  console.log('Note: these encode the plain URL only — no logo overlay. Add one in image');
  console.log('software afterward if desired (PRD asks for a small logo in the center).');
}

main().catch(err => {
  console.error('Failed to generate QR codes:', err);
  process.exit(1);
});
