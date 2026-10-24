// The school logo module on its own (server/instanceLogo.js): what counts as a PNG or JPEG, what the
// upload limits are, and that what gets stored is a fresh, clean PNG. The route and the access rules
// are tested against a real server in instanceLogoLive.test.ts.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  detectImageType, decodeUpload, cleanLogo, saveLogo, removeLogo, logoPath, logoVersion,
  logoBackupsDir, removeClassroomAssets, createUploadLimiter, LogoError, MAX_UPLOAD_BYTES,
} from '../../server/instanceLogo.js';

const solid = (w: number, h: number) => ({ create: { width: w, height: h, channels: 3 as const, background: '#336699' } });
const png = (w = 200, h = 100) => sharp(solid(w, h)).png().toBuffer();
const jpeg = (w = 200, h = 100) => sharp(solid(w, h)).jpeg().toBuffer();
const b64 = (b: Buffer) => b.toString('base64');
const fails = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(LogoError);
  expect((err as LogoError).code).toBe(code);
};

describe('detectImageType: from the real bytes, never the name', () => {
  it('knows a PNG and a JPEG', async () => {
    expect(detectImageType(await png())).toBe('png');
    expect(detectImageType(await jpeg())).toBe('jpeg');
  });
  it('refuses SVG, GIF, text and an empty file', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageType(Buffer.from('hello world, not a picture'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('decodeUpload', () => {
  it('takes plain base64 and a data: address', async () => {
    const p = await png();
    expect(decodeUpload(b64(p)).equals(p)).toBe(true);
    expect(decodeUpload('data:image/png;base64,' + b64(p)).equals(p)).toBe(true);
  });
  it('refuses nothing, junk and a file over 1 MB', () => {
    expect(() => decodeUpload('')).toThrow(LogoError);
    expect(() => decodeUpload(undefined)).toThrow(LogoError);
    expect(() => decodeUpload('not base64 !!!')).toThrow(LogoError);
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 7);
    expect(() => decodeUpload(b64(big))).toThrow(/under 1 MB/);
  });
});

describe('cleanLogo', () => {
  it('turns a PNG and a JPEG into a PNG no longer than 512 px', async () => {
    for (const input of [await png(1200, 600), await jpeg(1200, 600)]) {
      const out = await cleanLogo(input);
      expect(detectImageType(out)).toBe('png');
      const meta = await sharp(out).metadata();
      expect(meta.format).toBe('png');
      expect(Math.max(meta.width!, meta.height!)).toBe(512);
    }
  });
  it('does not blow up a small logo', async () => {
    const meta = await sharp(await cleanLogo(await png(100, 100))).metadata();
    expect(meta.width).toBe(100);
  });
  it('refuses an SVG, even when it is named .png (the bytes decide)', async () => {
    await fails(cleanLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>1</script></svg>')), 'bad_type');
  });
  it('refuses a JPEG that starts with the PNG signature but is not one', async () => {
    const fake = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('garbage garbage garbage')]);
    await fails(cleanLogo(fake), 'bad_image');
  });
  it('throws away anything after the picture data (a PNG carrying text at the end)', async () => {
    const tail = Buffer.from('<script>alert("hidden")</script> SECRET-TRAILER');
    const out = await cleanLogo(Buffer.concat([await png(), tail]));
    expect(out.includes(Buffer.from('SECRET-TRAILER'))).toBe(false);
  });
  it('removes location and camera tags from a JPEG', async () => {
    const withExif = await sharp(solid(200, 200)).withExif({ IFD0: { Copyright: 'LEAK-ME' } }).jpeg().toBuffer();
    expect(withExif.includes(Buffer.from('LEAK-ME'))).toBe(true);
    const out = await cleanLogo(withExif);
    expect(out.includes(Buffer.from('LEAK-ME'))).toBe(false);
  });
  it('refuses a picture under 64 px or over 2000 px (checked from the header, before decoding)', async () => {
    await fails(cleanLogo(await png(30, 200)), 'too_small');
    await fails(cleanLogo(await png(2400, 100)), 'too_large');
    await fails(cleanLogo(await png(5000, 5000)), 'too_large'); // 25 million pixels: never decoded
  });
});

describe('saving, replacing and removing', () => {
  let dataDir: string;
  let instancesRoot: string;
  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-logo-'));
    instancesRoot = path.join(dataDir, 'game-data', 'instances');
    fs.mkdirSync(instancesRoot, { recursive: true });
  });
  afterEach(() => { try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* Windows */ } });

  it('stores it at instance-assets/<id>/logo.png, outside game-data', async () => {
    const r = await saveLogo(dataDir, instancesRoot, 'room-a', b64(await png()));
    expect(logoPath(dataDir, 'room-a')).toBe(path.join(dataDir, 'instance-assets', 'room-a', 'logo.png'));
    expect(fs.existsSync(logoPath(dataDir, 'room-a'))).toBe(true);
    expect(logoPath(dataDir, 'room-a').startsWith(path.join(dataDir, 'game-data'))).toBe(false);
    expect(r.version).toBe(logoVersion(dataDir, 'room-a'));
    expect(detectImageType(fs.readFileSync(logoPath(dataDir, 'room-a')))).toBe('png');
  });

  it('keeps nothing when the upload is refused', async () => {
    await fails(saveLogo(dataDir, instancesRoot, 'room-a', b64(Buffer.from('<svg/>'))), 'bad_type');
    expect(fs.existsSync(logoPath(dataDir, 'room-a'))).toBe(false);
  });

  it('copies the old logo into the classroom backups when it is replaced or removed', async () => {
    await saveLogo(dataDir, instancesRoot, 'room-a', b64(await png(300, 300)));
    expect(fs.existsSync(logoBackupsDir(instancesRoot, 'room-a'))).toBe(false);
    await saveLogo(dataDir, instancesRoot, 'room-a', b64(await jpeg(400, 400)));
    expect(fs.readdirSync(logoBackupsDir(instancesRoot, 'room-a')).length).toBe(1);
    expect(removeLogo(dataDir, instancesRoot, 'room-a')).toBe(true);
    expect(fs.existsSync(logoPath(dataDir, 'room-a'))).toBe(false);
    expect(fs.readdirSync(logoBackupsDir(instancesRoot, 'room-a')).length).toBe(2);
    expect(removeLogo(dataDir, instancesRoot, 'room-a')).toBe(false);
  });

  it('refuses a classroom id that could climb out of the folder', async () => {
    expect(() => logoPath(dataDir, '../evil')).toThrow(LogoError);
    expect(() => logoPath(dataDir, 'a/b')).toThrow(LogoError);
    await fails(saveLogo(dataDir, instancesRoot, '..', b64(await png())), 'bad_id');
  });

  it('deleting the classroom removes its assets', async () => {
    await saveLogo(dataDir, instancesRoot, 'room-a', b64(await png()));
    removeClassroomAssets(dataDir, 'room-a');
    expect(fs.existsSync(path.join(dataDir, 'instance-assets', 'room-a'))).toBe(false);
  });
});

describe('upload limiter: 5 finished uploads per classroom per hour', () => {
  it('lets five through, stops the sixth, frees up after the hour, and counts classrooms separately', () => {
    const lim = createUploadLimiter(5, 3_600_000);
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) { expect(lim.allowed('a', t0 + i)).toBe(true); lim.record('a', t0 + i); }
    expect(lim.allowed('a', t0 + 10)).toBe(false);
    expect(lim.allowed('b', t0 + 10)).toBe(true);
    expect(lim.allowed('a', t0 + 3_600_001)).toBe(true);
  });
});
