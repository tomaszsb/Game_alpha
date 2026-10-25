// server/instanceLogo.js
// A school logo for one classroom (TEACHER_LAYER_DESIGN.md "Safe logo upload").
//
// The rules, in one place:
//   - PNG or JPEG only, decided from the file's own first bytes, never from its name or the
//     type the browser claims. SVG (which can carry scripts) is refused.
//   - At most 1 MB of picture, 64..2000 pixels on each side. The size is read from the file's
//     header BEFORE any decoding, so a small file that unpacks to a huge picture is refused.
//   - The picture is decoded and written again as a fresh PNG (long side at most 512 px, no
//     location tags or other extra data). Only that clean copy is kept; the original is dropped.
//   - Stored at <DATA_DIR>/instance-assets/<classroom-id>/logo.png: outside game-data and outside
//     everything express.static serves, so the only way to it is GET /api/instances/:id/logo.
//
// `sharp` is loaded on first use, not at boot: if it cannot load on some machine the game still
// starts and only the logo upload says "not available".

import fs from 'fs';
import path from 'path';

export const ASSETS_DIRNAME = 'instance-assets';
export const LOGO_FILE = 'logo.png';
export const MAX_UPLOAD_BYTES = 1024 * 1024;
export const MIN_SIDE = 64;
export const MAX_SIDE = 2000;
export const OUTPUT_LONG_SIDE = 512;
export const LOGO_BACKUP_KEEP = 5;

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** An error the route can show the teacher as is. `code` is a short machine word. */
export class LogoError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function assertId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new LogoError('bad_id', 'Not a valid classroom id');
}

/** 'png', 'jpeg' or null, from the first bytes. */
export function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  return null;
}

/**
 * The picture bytes from what the teacher's browser sent: plain base64, or a data: address
 * ("data:image/png;base64,..."). Anything else is refused. The size cap is checked on the bytes.
 */
export function decodeUpload(data) {
  if (typeof data !== 'string' || data.length === 0) throw new LogoError('no_image', 'Choose a picture first');
  let b64 = data;
  const m = /^data:([^;,]*);base64,/i.exec(data);
  if (m) b64 = data.slice(m[0].length);
  b64 = b64.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 === 1) {
    throw new LogoError('bad_encoding', 'That is not a picture file');
  }
  // Refuse before decoding if the text alone is too long to be under the cap.
  if (b64.length > Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 4) {
    throw new LogoError('too_big', 'Use a PNG or JPEG under 1 MB', 413);
  }
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_UPLOAD_BYTES) throw new LogoError('too_big', 'Use a PNG or JPEG under 1 MB', 413);
  return buf;
}

let sharpPromise = null;
async function loadSharp() {
  if (!sharpPromise) {
    sharpPromise = import('sharp').then(mod => mod.default || mod).catch(() => {
      sharpPromise = null;
      throw new LogoError('unavailable', 'Logo upload is not available on this server right now', 503);
    });
  }
  return sharpPromise;
}

/**
 * Check an upload and return the clean PNG to store. Throws LogoError with plain words.
 * @param {Buffer} buf the decoded upload
 * @returns {Promise<Buffer>}
 */
export async function cleanLogo(buf) {
  const type = detectImageType(buf);
  if (!type) throw new LogoError('bad_type', 'Use a PNG or JPEG under 1 MB');
  const sharp = await loadSharp();
  try {
    // limitInputPixels makes sharp refuse a decompression bomb from the header alone.
    const opts = { limitInputPixels: MAX_SIDE * MAX_SIDE, failOn: 'error' };
    const meta = await sharp(buf, opts).metadata();
    const kind = meta.format === 'jpeg' ? 'jpeg' : meta.format === 'png' ? 'png' : null;
    if (!kind || kind !== type) throw new LogoError('bad_type', 'Use a PNG or JPEG under 1 MB');
    if (!meta.width || !meta.height || meta.width < MIN_SIDE || meta.height < MIN_SIDE) {
      throw new LogoError('too_small', `The picture must be at least ${MIN_SIDE} x ${MIN_SIDE} pixels`);
    }
    if (meta.width > MAX_SIDE || meta.height > MAX_SIDE) {
      throw new LogoError('too_large', `The picture must be at most ${MAX_SIDE} x ${MAX_SIDE} pixels`);
    }
    return await sharp(buf, opts)
      .rotate()
      .resize({ width: OUTPUT_LONG_SIDE, height: OUTPUT_LONG_SIDE, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (err) {
    if (err instanceof LogoError) throw err;
    // sharp refuses a picture over the pixel limit from its header alone: say so plainly.
    if (/pixel/i.test(String(err && err.message))) {
      throw new LogoError('too_large', `The picture must be at most ${MAX_SIDE} x ${MAX_SIDE} pixels`);
    }
    throw new LogoError('bad_image', 'That picture could not be read. Use a PNG or JPEG under 1 MB');
  }
}

export function assetsDir(dataDir, id) {
  assertId(id);
  return path.join(dataDir, ASSETS_DIRNAME, id);
}

export function logoPath(dataDir, id) {
  return path.join(assetsDir(dataDir, id), LOGO_FILE);
}

/** Where a replaced or removed logo is kept: with the other classroom backups. */
export function logoBackupsDir(instancesRoot, id) {
  assertId(id);
  return path.join(path.dirname(instancesRoot), 'backups', ASSETS_DIRNAME, id);
}

/** When the classroom has a logo: the file's modified time (a cache-busting number). Else null. */
export function logoVersion(dataDir, id) {
  try {
    return Math.round(fs.statSync(logoPath(dataDir, id)).mtimeMs);
  } catch {
    return null;
  }
}

function keepBackup(dataDir, instancesRoot, id) {
  const src = logoPath(dataDir, id);
  if (!fs.existsSync(src) || !instancesRoot) return;
  try {
    const dir = logoBackupsDir(instancesRoot, id);
    fs.mkdirSync(dir, { recursive: true });
    // The name ends in a counter: two backups made in the same millisecond must not share a file
    // name (the second would silently replace the first). The fixed width keeps names sorted by age.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    for (let n = 0; n < 1000; n++) {
      const target = path.join(dir, `logo-${stamp}-${String(n).padStart(3, '0')}.png`);
      try {
        fs.copyFileSync(src, target, fs.constants.COPYFILE_EXCL);
        break;
      } catch (err) {
        if (!err || err.code !== 'EEXIST') throw err;
      }
    }
    const files = fs.readdirSync(dir).filter(n => /^logo-.*\.png$/.test(n)).sort();
    for (const old of files.slice(0, Math.max(0, files.length - LOGO_BACKUP_KEEP))) {
      fs.rmSync(path.join(dir, old), { force: true });
    }
  } catch {
    // A failed backup copy must never stop the teacher's upload.
  }
}

/**
 * Validate, clean and store a logo (replacing any earlier one, atomically).
 * @returns {Promise<{ version: number, bytes: number }>}
 */
export async function saveLogo(dataDir, instancesRoot, id, data) {
  assertId(id);
  const clean = await cleanLogo(decodeUpload(data));
  keepBackup(dataDir, instancesRoot, id);
  const dir = assetsDir(dataDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const target = logoPath(dataDir, id);
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, clean);
  fs.renameSync(tmp, target);
  return { version: logoVersion(dataDir, id), bytes: clean.length };
}

/** Remove a classroom's logo. Returns true if there was one. */
export function removeLogo(dataDir, instancesRoot, id) {
  assertId(id);
  if (!fs.existsSync(logoPath(dataDir, id))) return false;
  keepBackup(dataDir, instancesRoot, id);
  fs.rmSync(logoPath(dataDir, id), { force: true });
  return true;
}

/** Remove everything stored for a classroom (when the classroom itself is deleted). */
export function removeClassroomAssets(dataDir, id) {
  assertId(id);
  fs.rmSync(assetsDir(dataDir, id), { recursive: true, force: true });
}

/**
 * "At most `max` successful uploads per classroom per window" (default 5 an hour). A refused picture
 * does not use one up: the per-address limit on the route already bounds that kind of spam.
 * @param {number} [max]
 * @param {number} [windowMs]
 */
export function createUploadLimiter(max = 5, windowMs = 60 * 60 * 1000) {
  const seen = new Map(); // classroom id -> upload times inside the window
  const recent = (id, now) => {
    const times = (seen.get(id) || []).filter(t => now - t < windowMs);
    seen.set(id, times);
    return times;
  };
  return {
    /** True when this classroom may upload another logo right now. */
    allowed(id, now = Date.now()) { return recent(id, now).length < max; },
    /** Note one finished upload. */
    record(id, now = Date.now()) { recent(id, now).push(now); },
  };
}
